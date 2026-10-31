// Koog's arranger: melody in, a playable arrangement out. Pure functions, no audio, no React.
//
// In plain words:
//  1. Cut the tune into bars (or half bars when the tune clearly changes harmony mid-bar).
//  2. For each piece, ask the Smart Band harmonizer which friendly chord likes the tune's notes best.
//     Tunes end with V then I (the "cadence"), and begin on I.
//  3. EASY: show the chord names and one low root note per chord for the left hand.
//     FULL: a real left-hand pattern (Alberti or broken chords in 4/4, oom-pah-pah in 3/4, oom-pah for marches,
//     block chords for hymns). Chords are voiced as close as possible to the last one (smooth voice leading).
//  Where real harmony is known (Bach's Prelude in C), it is used instead of guessing.
// Generated arrangements are original; only public-domain melodies go in.
import type { Key } from './theory'
import type { SongNote } from '../features/songs/songs'
import { candidateChords, scoreChord, type Chord, type MelodyNote } from '../features/smartband/harmonizer'
import type { SheetLevel } from './sheetLevel'

export type ArrStyle = 'auto' | 'alberti' | 'broken' | 'oompah' | 'block'
/** chord data that already exists for a piece (e.g. Bach's Prelude): used instead of generating */
export interface HarmonyBar { start: number; beats: number; name: string; pcs: number[]; bass: number }
export interface ArrInput {
  notes: SongNote[]; key?: Key; beatsPerBar?: number
  /** beats before the first full bar (an upbeat) */
  pickup?: number
  title: string; style?: ArrStyle; harmony?: HarmonyBar[]
}
export interface RhEvent { note: number | null; midis?: number[]; beats: number }
/** one left-hand event; midis empty = rest */
export interface LhEvent { start: number; beats: number; midis: number[]; seg: number }
export interface ChordSeg { start: number; beats: number; name: string; root: number; pcs: number[]; seventh: boolean; roman: string }
/** something the kid can be asked to play with the left hand: any note whose pitch class is in pcs, inside [start, end) beats */
export interface LhTarget { start: number; end: number; pcs: number[]; idxs: number[] }
export interface Arrangement {
  level: SheetLevel; title: string; generated: boolean
  /** one per melody note, same indexes as the input (so hit/miss colours still line up) */
  rh: RhEvent[]
  lh: LhEvent[]
  segs: ChordSeg[]
  /** chord symbols to print (only where the chord changes) */
  marks: { start: number; name: string }[]
  targets: LhTarget[]
  bpb: number; pickup: number; total: number
  /** the key used (given, or guessed) */
  key: Key
  style: ArrStyle
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6])
const minorish = (k: Key) => k.scale === 'minor' || k.scale === 'minorPentatonic' || k.scale === 'blues'
const usesFlats = (k: Key) => FLAT_MAJOR.has(minorish(k) ? (k.tonic + 3) % 12 : k.tonic)
const mod12 = (n: number) => ((n % 12) + 12) % 12
const EPS = 1e-6

/** Guess a key from the notes (histogram vs major/minor scales, plus a nudge for the last note). */
export function inferKey(notes: SongNote[]): Key {
  const h = new Array(12).fill(0)
  let last = -1
  for (const n of notes) if (n.note != null) { h[mod12(n.note)] += n.beats; last = mod12(n.note) }
  let best: Key = { tonic: 0, scale: 'major' }, bestS = -1
  for (let t = 0; t < 12; t++) {
    for (const sc of ['major', 'minor'] as const) {
      const steps = sc === 'major' ? MAJOR : MINOR
      let s = 0
      for (const st of steps) s += h[(t + st) % 12]
      if (last === t) s += 0.8
      if (s > bestS) { bestS = s; best = { tonic: t, scale: sc } }
    }
  }
  return best
}

function mkChord(root: number, quality: 'maj' | 'min' | 'dim', primary: boolean, names: string[]): Chord {
  const third = quality === 'maj' ? 4 : 3, fifth = quality === 'dim' ? 6 : 7
  return { root, quality, name: names[root] + (quality === 'min' ? 'm' : quality === 'dim' ? 'dim' : ''), pcs: [root, (root + third) % 12, (root + fifth) % 12], primary }
}

/** the friendly chords of a key. In minor, V is major when the tune uses the leading tone. */
function candidates(key: Key, leading: boolean, names: string[]): Chord[] {
  const base = candidateChords(key).map((c) => mkChord(c.root, c.quality, c.primary, names))
  if (minorish(key) && leading) {
    const v = (key.tonic + 7) % 12
    return base.map((c) => (c.root === v ? mkChord(v, 'maj', true, names) : c))
  }
  return base
}

interface Piece { pc: number; midi: number; w: number }
function piecesIn(starts: number[], notes: SongNote[], a: number, b: number): Piece[] {
  const out: Piece[] = []
  notes.forEach((n, i) => {
    if (n.note == null) return
    const s = starts[i], e = s + n.beats
    const ov = Math.min(e, b) - Math.max(s, a)
    if (ov <= EPS) return
    const rel = s - a
    const strong = Math.abs(rel) < 0.01 ? 1.5 : Math.abs(rel - Math.round(rel)) < 0.01 ? 1.1 : 1
    out.push({ pc: mod12(n.note), midi: n.note, w: ov * strong * (n.beats < 0.5 ? 0.7 : 1) })
  })
  return out
}
const total = (p: Piece[]) => p.reduce((a, x) => a + x.w, 0)
const share = (c: Chord, p: Piece[]) => { const t = total(p); return t ? p.filter((x) => c.pcs.includes(x.pc)).reduce((a, x) => a + x.w, 0) / t : 0 }
const mel = (p: Piece[]): MelodyNote[] => p.map((x) => ({ pc: x.pc, w: x.w }))

interface Pick { c: Chord; sc: number }
function best(cands: Chord[], p: Piece[], prev: Chord | null, first: boolean, key: Key): Pick {
  const W = total(p) || 1
  let bc = cands[0], bs = -1e9
  for (const c of cands) {
    let s = scoreChord(c, mel(p))
    if (prev && prev.root === c.root && prev.quality === c.quality) s += 0.2 * W
    s += (c.primary ? 0.12 : -0.12) * W + (c.root === key.tonic ? 0.1 * W : 0)
    if (first && c.root === key.tonic) s += 0.3 * W
    if (s > bs) { bs = s; bc = c }
  }
  return { c: bc, sc: bs }
}

const triad = (c: Chord, seventh: boolean) => (seventh ? [c.root, c.pcs[1], (c.root + 10) % 12] : c.pcs.slice())
const sameC = (a: Chord, b: Chord) => a.root === b.root && a.quality === b.quality

/** all close-position voicings (one note per pitch class, spread <= 10 semitones) inside [lo, hi], sorted low to high */
function voicings(pcs: number[], lo: number, hi: number): number[][] {
  const opts = pcs.map((p) => { const o: number[] = []; for (let m = lo; m <= hi; m++) if (mod12(m) === p) o.push(m); return o })
  const out: number[][] = []
  for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) {
    const v = [a, b, c].sort((x, y) => x - y)
    if (v[2] - v[0] <= 10 && new Set(v).size === 3) out.push(v)
  }
  return out
}
/** the voicing that moves least from the previous one (first chord: root position nearest the middle of the window) */
function voiceLead(pcs: number[], lo: number, hi: number, prev: number[] | null): number[] {
  const all = voicings(pcs, lo, hi)
  if (!all.length) return voicings(pcs, lo - 12, hi + 12)[0] ?? [lo, lo + 4, lo + 7]
  const mid = (lo + hi) / 2
  let bv = all[0], bc = 1e9
  for (const v of all) {
    const cost = prev ? v.reduce((a, n, i) => a + Math.abs(n - prev[i]), 0) : Math.abs(v[0] + 4 - mid) + (mod12(v[0]) === pcs[0] ? 0 : 6)
    if (cost < bc) { bc = cost; bv = v }
  }
  return bv
}
const inWindow = (pc: number, lo: number) => { let m = lo; while (mod12(m) !== pc) m++; return m }

const DURS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]
/** split a length into notatable pieces (4, 3, 2, 1.5, 1, ...) */
function pieces(beats: number): number[] {
  const out: number[] = []
  let r = beats
  while (r > 0.02) {
    const d = DURS.find((x) => x <= r + EPS) ?? 0.25
    out.push(d); r -= d
  }
  return out
}

function majorScalePcs(key: Key) { return (minorish(key) ? MINOR : MAJOR).map((s) => (key.tonic + s) % 12) }

/** the main entry point. level 'single' returns just the melody. */
export function arrange(input: ArrInput, level: SheetLevel): Arrangement {
  const { notes } = input
  const key = input.key && input.key.scale !== 'chromatic' ? input.key : inferKey(notes)
  const bpb = input.beatsPerBar && input.beatsPerBar > 0 ? input.beatsPerBar : 4
  const style = input.style ?? 'auto'
  const starts: number[] = []
  let t = 0
  for (const n of notes) { starts.push(t); t += n.beats }
  const tot = t
  const rh: RhEvent[] = notes.map((n) => ({ note: n.note, beats: n.beats }))
  const pickup = Math.max(0, Math.min(input.pickup ?? 0, bpb, tot))
  const base: Arrangement = { level, title: input.title, generated: false, rh, lh: [], segs: [], marks: [], targets: [], bpb, pickup, total: tot, key, style }
  if (level === 'single' || tot <= 0 || !notes.some((n) => n.note != null)) return { ...base, level: level === 'single' ? level : base.level }

  const names = usesFlats(key) ? FLAT_NAMES : SHARP_NAMES
  const mids = notes.filter((n) => n.note != null).map((n) => n.note as number).sort((a, b) => a - b)
  const q25 = mids[Math.floor(mids.length * 0.25)]
  const shift = q25 < 55 ? -12 : 0
  const nameOf = (root: number, q: string, sev: boolean) => names[root] + (q === 'min' ? 'm' : q === 'dim' ? 'dim' : '') + (sev ? '7' : '')

  // ---- chords ----
  const segs: ChordSeg[] = []
  if (input.harmony?.length) {
    for (const h of input.harmony) {
      const root = mod12(h.bass)
      segs.push({ start: h.start, beats: h.beats, name: h.name, root, pcs: h.pcs, seventh: false, roman: '' })
    }
  } else {
    const leading = notes.some((n) => n.note != null && mod12(n.note) === (key.tonic + 11) % 12)
    const cands = candidates(key, leading, names)
    const dom = (key.tonic + 7) % 12
    // bars as [start, end]
    const bars: [number, number][] = []
    for (let s = pickup; s < tot - EPS; s += bpb) bars.push([s, Math.min(s + bpb, tot)])
    const chosen: { a: number; b: number; c: Chord; p: Piece[] }[] = []
    let prev: Chord | null = null
    bars.forEach(([a, b], bi) => {
      const p = piecesIn(starts, notes, a, b)
      const whole = best(cands, p, prev, bi === 0, key)
      const W = total(p) || 1
      if (b - a === bpb && bpb % 2 === 0 && bpb >= 4) {
        const mid = a + bpb / 2
        const p1 = piecesIn(starts, notes, a, mid), p2 = piecesIn(starts, notes, mid, b)
        if (p1.length && p2.length) {
          const c1 = best(cands, p1, prev, bi === 0, key), c2 = best(cands, p2, c1.c, false, key)
          const fit = (share(c1.c, p1) * total(p1) + share(c2.c, p2) * total(p2)) / W
          if (!sameC(c1.c, c2.c) && fit - share(whole.c, p) >= 0.2) {
            chosen.push({ a, b: mid, c: c1.c, p: p1 }, { a: mid, b, c: c2.c, p: p2 })
            prev = c2.c
            return
          }
        }
      }
      chosen.push({ a, b, c: whole.c, p })
      prev = whole.c
    })
    // cadence: end on I, and move there from V
    const lastNote = [...notes].reverse().find((n) => n.note != null)
    const tonic = cands.find((c) => c.root === key.tonic)!
    const L = chosen.length - 1
    if (L >= 0 && lastNote && tonic.pcs.includes(mod12(lastNote.note as number))) {
      chosen[L].c = tonic
      if (L >= 1 && chosen[L - 1].a >= pickup) {
        const v = cands.find((c) => c.root === dom && c.quality === 'maj') ?? cands.find((c) => c.root === dom)
        if (v && !sameC(chosen[L - 1].c, v) && share(v, chosen[L - 1].p) >= 0.25) chosen[L - 1].c = v
        else if (v && sameC(chosen[L - 1].c, v)) { /* already V */ }
      }
    }
    chosen.forEach((x, i) => {
      const c = x.c
      const isDom = c.root === dom && c.quality === 'maj'
      const seventh = isDom && (x.p.some((q) => q.pc === (dom + 10) % 12) || i === L - 1)
      const rel = mod12(c.root - key.tonic)
      const degree = ({ 0: 'I', 2: 'ii', 3: 'III', 4: 'iii', 5: 'IV', 7: 'V', 8: 'VI', 9: 'vi', 10: 'VII' } as Record<number, string>)[rel] ?? ''
      segs.push({ start: x.a, beats: x.b - x.a, name: nameOf(c.root, c.quality, seventh), root: c.root, pcs: seventh ? [c.root, c.pcs[1], c.pcs[2], (c.root + 10) % 12] : c.pcs, seventh, roman: degree })
    })
  }

  // ---- left hand ----
  const lh: LhEvent[] = []
  const rest = (start: number, beats: number, seg = -1) => { let s = start; for (const d of pieces(beats)) { lh.push({ start: s, beats: d, midis: [], seg }); s += d } }
  const note = (start: number, beats: number, midis: number[], seg: number) => lh.push({ start, beats, midis, seg })
  if (pickup > EPS) rest(0, pickup)
  const lowMel = Math.min(...mids)
  let prevV: number[] | null = null
  const harmonic = !!input.harmony?.length
  const effStyle: ArrStyle = style !== 'auto' ? style : bpb % 3 === 0 ? 'oompah' : bpb === 2 ? 'oompah' : 'alberti'
  const waltz = bpb % 3 === 0
  const targets: LhTarget[] = []
  segs.forEach((sg, si) => {
    const L = sg.beats, s0 = sg.start
    if (level === 'easy' || harmonic) {
      const lo = harmonic ? 43 : 48 + (lowMel < 55 ? -12 : 0)
      const r = inWindow(sg.root, lo)
      let s = s0
      for (const d of pieces(L)) { note(s, d, [r], si); s += d }
      const changed = si === 0 || segs[si - 1].name !== sg.name
      if (changed) targets.push({ start: s0, end: s0 + L, pcs: sg.pcs, idxs: [lh.length - pieces(L).length] })
      return
    }
    // FULL
    const tri = triad({ root: sg.root, quality: 'maj', name: '', pcs: sg.pcs.slice(0, 3), primary: true }, sg.seventh)
    const idx0 = lh.length
    let st = style === 'auto' ? effStyle : style
    const mel0 = piecesIn(starts, notes, s0, s0 + L)
    if (st === 'alberti' && mel0.length >= 7) st = 'broken'
    if (st === 'oompah') {
      const bass = inWindow(sg.root, Math.max(36, 40 + shift))
      const vo = voiceLead(tri, 51 + shift, 64 + shift, prevV); prevV = vo
      const up = vo.slice(1)
      const fifthPc = tri[2]
      const bass2 = waltz ? bass : inWindow(fifthPc, bass - 5) // march: root then fifth
      let b = 0, s = s0
      while (L - b > EPS) { const d = Math.min(1, L - b); note(s, d, b === 0 ? [bass] : waltz ? up : b % 2 === 0 ? [bass2] : up, si); b++; s += d }
    } else if (st === 'block') {
      const vo = voiceLead(tri, 48 + shift, 64 + shift, prevV); prevV = vo
      let s = s0
      let r = L
      while (r > EPS) { const d = Math.min(2, r); for (const p of pieces(d)) { note(s, p, vo, si); s += p } ; r -= d }
    } else {
      const vo = voiceLead(tri, 48 + shift, 64 + shift, prevV); prevV = vo
      const seq = st === 'broken' ? [vo[0], vo[1], vo[2], vo[1]] : [vo[0], vo[2], vo[1], vo[2]]
      const step = st === 'broken' ? 1 : 0.5
      let s = s0, k = 0
      while (s0 + L - s > EPS) { const d = Math.min(step, s0 + L - s); note(s, d, [seq[k % 4]], si); s += d; k++ }
    }
    // judging targets: one per beat (consecutive events in the same beat are one target)
    let cur: LhTarget | null = null, curBeat = -1
    for (let i = idx0; i < lh.length; i++) {
      const e = lh[i]
      if (!e.midis.length) continue
      const bt = Math.floor(e.start - s0 + EPS)
      if (cur && curBeat === bt) { cur.end = e.start + e.beats; cur.idxs.push(i) }
      else { cur = { start: e.start, end: e.start + e.beats, pcs: sg.pcs, idxs: [i] }; curBeat = bt; targets.push(cur) }
    }
  })
  const lastSeg = segs[segs.length - 1]
  const lhEnd = lastSeg ? lastSeg.start + lastSeg.beats : pickup
  if (tot - lhEnd > EPS) rest(lhEnd, tot - lhEnd)

  // ---- thirds on strong beats (full only) ----
  if (level === 'full' && !harmonic) {
    const sc = majorScalePcs(key)
    notes.forEach((n, i) => {
      if (n.note == null || n.beats < 1 - EPS) return
      const rel = starts[i] - pickup
      if (rel < -EPS || Math.abs(rel / bpb - Math.round(rel / bpb)) > 0.001) return
      const deg = sc.indexOf(mod12(n.note))
      if (deg < 0) return
      const lowPc = sc[(deg + 5) % 7]
      let m = n.note - 3
      while (mod12(m) !== lowPc && m > n.note - 6) m--
      if (mod12(m) !== lowPc || n.note - m < 3 || n.note - m > 4 || m < 55) return
      rh[i] = { note: n.note, midis: [m, n.note], beats: n.beats }
    })
  }

  const marks: { start: number; name: string }[] = []
  segs.forEach((sg, i) => { if (i === 0 || segs[i - 1].name !== sg.name) marks.push({ start: sg.start, name: sg.name }) })
  const title = input.title + (harmonic || / \(arr\. Koog\)$/.test(input.title) ? '' : ' (arr. Koog)')
  return { ...base, title, generated: !harmonic, rh, lh, segs, marks, targets, style: effStyle }
}
