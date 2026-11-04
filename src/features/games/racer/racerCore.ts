// Koogalien Racer, the pure part: a phrase becomes a road, and what the player actually played becomes a drive.
// No DOM, no stores, no audio, so scripts/racer-fixtures.ts can test every rule.
//
// THE TRACK IS A TIMELINE. Distance along the road = time: UNIT world units per beat. The car passes the gate of note i exactly at beat_i.
// A note's interval from the previous note bends the road after its gate: up = turn right, down = turn left, the same note = straight,
// a bigger interval = a sharper turn. The road gently relaxes back toward straight so a long run of notes snakes instead of spiralling.
//
// THE DRIVE. The car follows the road, plus a sideways offset `d` that only the player's mistakes make:
//   wrong pitch  -> the car points off the road by K_ERR degrees per semitone (per lane step x LANE_SEMIS on pads) until the next note
//   early / late -> a sideways kick, late runs wide, early cuts the corner
//   missed note  -> the cow wanders onto the road (a mishap right away)
// Leave the road (|d| > ROAD_HALF) and a funny, kid-safe mishap plays; the car is put back on the road and the lap goes on.
import { PC_NAMES } from '../../../music/theory'
import { LANE_SEMIS } from '../../../kode/kodeCore'

export const UNIT = 60          // world units per beat
export const SPB = 8            // samples per beat (road polyline resolution)
export const DS = UNIT / SPB    // world distance between two samples
export const ROAD_HALF = 30     // half the road width
export const LEAD_BEATS = 2     // road before gate 0: the start line
export const RUN_BEATS = 2      // road after the last note: the finish
export const TURN_DEG = 6       // road turn per semitone of interval
export const MAX_TURN = 62      // sharpest single turn, degrees
export const RELAX = 0.9        // heading keeps this fraction per beat
export const RAMP_BEATS = 1     // a turn takes this long to happen after its gate
export const K_ERR = 10         // degrees of steering error per semitone off
export const MATCH_BEATS = 1    // a played note belongs to a gate if it is this close in time
export const GOOD_BEATS = 0.2   // "on the beat"
export const PULL = 0.012       // the car drifts back to the middle of the road at this rate per world unit
export const RECOVER_BEATS = 1.5

const RAD = Math.PI / 180
export type Mode = 'keys' | 'pads'

export interface PhraseNote { /** MIDI note */ note: number; /** beats from the phrase start */ beat: number; beats: number }
export interface Gate {
  i: number; beat: number; beats: number
  /** the number the road steers by: semitones for keys, lane x LANE_SEMIS for pads */
  u: number
  /** MIDI note (keys) or lane 0..7 (pads) */
  v: number
  /** road turn after this gate, degrees (right is positive) */
  turn: number
  /** index of the road sample under the gate */
  j: number
}
export interface Track {
  mode: Mode
  gates: Gate[]
  /** samples: beat of sample j is j / SPB - LEAD_BEATS */
  n: number
  x: Float32Array; y: Float32Array; h: Float32Array
  /** total length in beats (start line to finish) */
  beats: number
  /** the road ends where the last gate's note ends, plus RUN_BEATS */
  endBeat: number
}
export const beatOfSample = (j: number) => j / SPB - LEAD_BEATS
export const sampleOfBeat = (b: number) => Math.round((b + LEAD_BEATS) * SPB)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const smooth = (u: number) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k) }

/**
 * Pad phrases: the same tune, played on pads. Lowest note -> the leftmost pad used, highest -> rightmost, steps spread over the 8 pads
 * (at most every second pad apart, so a three-note tune is pads 1, 3, 5). Returns the lane of each note.
 */
export function lanesFor(notes: readonly number[]): number[] {
  const uniq = [...new Set(notes)].sort((a, b) => a - b)
  const step = uniq.length > 1 ? Math.min(2, 7 / (uniq.length - 1)) : 0
  return notes.map((n) => Math.round(uniq.indexOf(n) * step))
}

/** the next octave-shifted copy of a phrase that sits in the middle of the keyboard (the same letters, easier to reach) */
export function centered(notes: readonly PhraseNote[]): PhraseNote[] {
  if (!notes.length) return []
  const mid = notes.reduce((s, n) => s + n.note, 0) / notes.length
  const shift = Math.round((66 - mid) / 12) * 12
  return notes.map((n) => ({ ...n, note: n.note + shift }))
}

/** Build the road from a phrase. `lanes` (pads mode) are the lane of each note; otherwise the MIDI notes steer. */
export function buildTrack(notes: readonly PhraseNote[], mode: Mode = 'keys'): Track {
  const lanes = mode === 'pads' ? lanesFor(notes.map((n) => n.note)) : null
  const gates: Gate[] = notes.map((p, i) => {
    const v = lanes ? lanes[i] : p.note
    const u = lanes ? lanes[i] * LANE_SEMIS : p.note
    return { i, beat: p.beat, beats: p.beats, u, v, turn: 0, j: sampleOfBeat(p.beat) }
  })
  gates.forEach((g, i) => {
    const interval = i === 0 ? 0 : g.u - gates[i - 1].u
    g.turn = clamp(interval * TURN_DEG, -MAX_TURN, MAX_TURN)
  })
  const last = gates[gates.length - 1]
  const endBeat = (last ? last.beat + Math.max(1, last.beats) : 1) + RUN_BEATS
  const n = Math.round((endBeat + LEAD_BEATS) * SPB) + 1
  const inc = new Float32Array(n + RAMP_BEATS * SPB + 2) // heading added at each sample, degrees
  for (const g of gates) {
    const len = Math.max(1, Math.round(RAMP_BEATS * SPB))
    for (let k = 0; k < len; k++) inc[g.j + k] += g.turn * (smooth((k + 1) / len) - smooth(k / len))
  }
  const x = new Float32Array(n), y = new Float32Array(n), h = new Float32Array(n)
  const relax = Math.pow(RELAX, 1 / SPB)
  let hd = 0, px = 0, py = 0
  for (let j = 0; j < n; j++) {
    hd = (hd + inc[j]) * relax
    h[j] = hd * RAD
    x[j] = px; y[j] = py
    px += Math.sin(h[j]) * DS; py -= Math.cos(h[j]) * DS
  }
  return { mode, gates, n, x, y, h, beats: endBeat + LEAD_BEATS, endBeat }
}

// ------------------------------------------------------------------ the drive
/** one thing the player did: a note (keys) or pad (pads) at a time measured in beats from the phrase start */
export interface Play { beat: number; v: number }
export type MishapKind = 'pond' | 'hay' | 'chickens' | 'spin' | 'cow'
export interface GateResult {
  i: number
  played: boolean
  /** steering error in semitones (pad lanes scaled). 0 = right. Octave slips fold to 0. */
  e: number
  /** beats late (negative = early) */
  dt: number
  /** the note / lane actually played */
  v: number | null
  octave: boolean
  /** 'perfect' right note on the beat, 'good' right note a little off, 'wrong' wrong pitch, 'missed' */
  grade: 'perfect' | 'good' | 'wrong' | 'missed'
}
export interface Mishap { j: number; beat: number; gate: number; kind: MishapKind; side: 1 | -1; text: string }
export interface Drive {
  d: Float32Array; phi: Float32Array
  results: GateResult[]
  mishaps: Mishap[]
  /** max sideways distance reached, world units */
  maxOff: number
  wrong: number; missed: number; avgDt: number
  stars: number
  clean: boolean
  /** lap time in seconds, with a 2 s penalty per mishap */
  seconds: number
}

/** semitone error between two notes, octave slips folded away: -6..+5 */
export const foldPc = (diff: number) => ((((diff % 12) + 18) % 12) - 6)

export function nameOfValue(v: number, mode: Mode): string {
  return mode === 'pads' ? `pad ${v + 1}` : PC_NAMES[((v % 12) + 12) % 12].replace('#', '♯')
}

/** match plays to gates: each play belongs to its nearest gate (within MATCH_BEATS); a gate keeps the closest play that chose it. Extra plays are ignored. */
export function matchPlays(track: Track, plays: readonly Play[]): number[] {
  const out = track.gates.map(() => -1), bd = track.gates.map(() => Infinity)
  plays.forEach((p, k) => {
    let gi = -1, gd = Infinity
    track.gates.forEach((g, i) => { const dt = Math.abs(p.beat - g.beat); if (dt < gd) { gd = dt; gi = i } })
    if (gi >= 0 && gd <= MATCH_BEATS && gd < bd[gi]) { bd[gi] = gd; out[gi] = k }
  })
  return out
}

export function grade(e: number, dt: number): GateResult['grade'] {
  if (Math.abs(e) > 0.01) return 'wrong'
  return Math.abs(dt) <= GOOD_BEATS ? 'perfect' : 'good'
}

/** Drive the track with what the player played. Pure and deterministic. */
export function drive(track: Track, plays: readonly Play[], bpm: number, opts: { /** road half-width multiplier (the snail is forgiving) */ half?: number } = {}): Drive {
  const half = ROAD_HALF * (opts.half ?? 1)
  const { gates, n, mode } = track
  const hit = matchPlays(track, plays)
  const results: GateResult[] = gates.map((g, i) => {
    const k = hit[i]
    if (k < 0) return { i, played: false, e: 0, dt: 0, v: null, octave: false, grade: 'missed' as const }
    const p = plays[k]
    let e: number, octave = false
    if (mode === 'pads') e = (p.v - g.v) * LANE_SEMIS
    else { e = foldPc(p.v - g.v); octave = e === 0 && p.v !== g.v }
    const dt = p.beat - g.beat
    return { i, played: true, e, dt, v: p.v, octave, grade: grade(e, dt) }
  })
  const d = new Float32Array(n), phi = new Float32Array(n)
  // events: when each played gate's note happened, in samples
  const noteAt = new Int32Array(gates.length).fill(-1)
  const kick = new Float32Array(n + 8)
  gates.forEach((g, i) => {
    const r = results[i]
    if (!r.played) return
    const sj = clamp(sampleOfBeat(plays[hit[i]].beat), 0, n - 1)
    noteAt[i] = sj
    // late runs wide (the outside of the bend), early cuts the corner (the inside). Even a straight gets a small wobble.
    const dir = g.turn !== 0 ? Math.sign(g.turn) : (i % 2 ? 0.5 : -0.5)
    const mag = 0.9 * (0.4 + Math.min(1, Math.abs(g.turn) / 30))
    const k = -dir * r.dt * UNIT * mag
    for (let q = 0; q < 4; q++) kick[sj + q] += k / 4
  })
  const mishaps: Mishap[] = []
  const missAt = gates.map((g, i) => (results[i].played ? -1 : clamp(g.j + (SPB >> 1), 0, n - 1)))
  let dd = 0, ph = 0, target = 0, maxOff = 0, recoverUntil = -1, nextNote = 0
  const order = gates.map((_, i) => i).filter((i) => noteAt[i] >= 0).sort((a, b) => noteAt[a] - noteAt[b])
  let lastGate = -1
  for (let j = 0; j < n; j++) {
    while (nextNote < order.length && noteAt[order[nextNote]] <= j) {
      const gi = order[nextNote++]
      target = clamp(results[gi].e * K_ERR, -48, 48) * RAD
      lastGate = gi
    }
    ph += (target - ph) * 0.35
    if (j <= recoverUntil) { ph *= 0.5; dd *= 0.8 } else dd += Math.tan(ph) * DS - PULL * dd * DS + kick[j]
    d[j] = dd; phi[j] = ph
    if (Math.abs(dd) > maxOff) maxOff = Math.abs(dd)
    // a missed note: the cow
    for (let i = 0; i < gates.length; i++) {
      if (missAt[i] === j && j > recoverUntil) {
        mishaps.push({ j, beat: beatOfSample(j), gate: i, kind: 'cow', side: i % 2 ? 1 : -1, text: `Note ${i + 1} never came, so a cow wandered onto the road. Honk!` })
        recoverUntil = j + Math.round(RECOVER_BEATS * SPB); target = 0; ph = 0
      }
    }
    if (j > recoverUntil && Math.abs(dd) > half) {
      // blame the gate that pushed it: the latest one that was wrong, else the latest played
      let g = lastGate
      for (let q = nextNote - 1; q >= Math.max(0, nextNote - 2); q--) if (Math.abs(results[order[q]].e) > 0) { g = order[q]; break }
      const side: 1 | -1 = dd > 0 ? 1 : -1
      const r = g >= 0 ? results[g] : null
      const pitchy = !!r && Math.abs(r.e) > 0
      const straight = g >= 0 && Math.abs(gates[g].turn) < 10
      const kind: MishapKind = !pitchy ? 'spin' : straight && Math.abs(r!.e) >= 4 ? 'chickens' : side < 0 ? 'pond' : 'hay'
      mishaps.push({ j, beat: beatOfSample(j), gate: g, kind, side, text: g < 0 ? 'The car wandered off the road.' : mishapText(g, kind, results[g], gates[g], mode) })
      recoverUntil = j + Math.round(RECOVER_BEATS * SPB); dd = 0; ph = 0; target = 0
    }
  }
  const played = results.filter((r) => r.played)
  const avgDt = played.length ? played.reduce((s, r) => s + Math.abs(r.dt), 0) / played.length : 0
  const wrong = results.filter((r) => r.grade === 'wrong').length
  const missed = results.filter((r) => r.grade === 'missed').length
  const clean = mishaps.length === 0
  const seconds = Math.round(((track.endBeat + LEAD_BEATS) * 60 / bpm + mishaps.length * 2) * 10) / 10
  return { d, phi, results, mishaps, maxOff, wrong, missed, avgDt, stars: starsFor(mishaps.length, wrong, missed, avgDt, played.length), clean, seconds }
}

/** 3 stars: no mishaps, every note right and on the beat. 2: at most one mishap. 1: you finished the lap. 0: no notes at all. */
export function starsFor(mishaps: number, wrong: number, missed: number, avgDt: number, played: number): number {
  if (played === 0) return 0
  if (mishaps === 0 && wrong === 0 && missed === 0 && avgDt <= 0.22) return 3
  if (mishaps <= 1) return 2
  return 1
}

function mishapText(i: number, kind: MishapKind, r: GateResult, g: Gate, mode: Mode): string {
  const n = i + 1
  if (r.played && Math.abs(r.e) > 0 && r.v != null) {
    const got = nameOfValue(r.v, mode), want = nameOfValue(g.v, mode)
    const place = kind === 'pond' ? 'splash in the pond' : kind === 'hay' ? 'bounced off the hay bales' : 'chickens everywhere'
    return `Note ${n} was ${got}, the road wanted ${want}: ${place}!`
  }
  if (r.played) return `Note ${n} came ${r.dt > 0 ? 'late' : 'early'} (${Math.abs(r.dt).toFixed(1)} beats), so the car spun out. Dizzy!`
  return `Note ${n} never came. Honk!`
}

/** the car's world position at sample position `s` (fractional), with its sideways offset applied. Writes into `out` (no allocation). */
export function carAt(track: Track, dr: Drive | null, s: number, out: { x: number; y: number; heading: number; d: number }) {
  const j = clamp(Math.floor(s), 0, track.n - 1), j2 = Math.min(track.n - 1, j + 1), f = clamp(s - j, 0, 1)
  const hx = track.h[j] + (track.h[j2] - track.h[j]) * f
  const cx = track.x[j] + (track.x[j2] - track.x[j]) * f, cy = track.y[j] + (track.y[j2] - track.y[j]) * f
  const dd = dr ? dr.d[j] + (dr.d[j2] - dr.d[j]) * f : 0
  const ph = dr ? dr.phi[j] + (dr.phi[j2] - dr.phi[j]) * f : 0
  out.x = cx + Math.cos(hx) * dd; out.y = cy + Math.sin(hx) * dd
  out.heading = hx + ph; out.d = dd
  return out
}
