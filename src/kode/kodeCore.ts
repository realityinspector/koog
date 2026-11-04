// Koog Kode, the pure part: what a "Kode token" is and the small rules every Kode app shares.
// No DOM, no stores, so scripts/racer-fixtures.ts can test it. The live wiring (piano, pads, DJ controller, pedal) is src/kode/tokens.ts.
// Docs: docs/KOOG_KODE.md

/** Where a token came from. Piano notes arrive as 'keys' (computer keys, on-screen keys) or 'midi' (a real keyboard). */
export type KodeSrc = 'keys' | 'midi' | 'drums' | 'dj' | 'pedal' | 'screen'

export interface KodeToken {
  src: KodeSrc
  /** The steering value. Pitched sources: the MIDI note. Pad sources (drums, dj): the lane index 0..7, left pads low. Pedal / screen buttons: 0. */
  value: number
  /** MIDI note, for pitched tokens */
  pitch?: number
  /** pad lane 0..7 (pads A1..A4 = 0..3 on the left, B1..B4 = 4..7 on the right), for pad tokens */
  lane?: number
  /** 0..1 */
  vel: number
  /** performance.now() ms when the player did it */
  t: number
}

export const N_LANES = 8
/** One pad lane is about this many semitones of steering, so a pad phrase and a piano phrase turn the same amount for the same "size" of move. */
export const LANE_SEMIS = 1.75

export type TokenKind = 'pitch' | 'lane' | 'button'
export const kindOf = (t: KodeToken): TokenKind => (t.pitch != null ? 'pitch' : t.lane != null ? 'lane' : 'button')
export const isMusical = (t: KodeToken) => kindOf(t) !== 'button'
/** the pitch-like number a token steers with (semitones; pad lanes are scaled to match) */
export const steerOf = (t: KodeToken) => (t.pitch != null ? t.pitch : t.lane != null ? t.lane * LANE_SEMIS : 0)

export const keyToken = (src: 'keys' | 'midi', note: number, vel: number, t: number): KodeToken => ({ src, value: note, pitch: note, vel: Math.min(1, Math.max(0, vel)), t })
export const padToken = (src: 'drums' | 'dj', lane: number, vel: number, t: number): KodeToken => {
  const l = Math.min(N_LANES - 1, Math.max(0, Math.round(lane)))
  return { src, value: l, lane: l, vel: Math.min(1, Math.max(0, vel)), t }
}
export const buttonToken = (src: 'pedal' | 'screen', vel: number, t: number): KodeToken => ({ src, value: 0, vel: Math.min(1, Math.max(0, vel)), t })

/** which side of the controller a lane is on: pads A1-A4 are the left deck, B1-B4 the right */
export const sideOfLane = (lane: number): 'left' | 'right' => (lane < N_LANES / 2 ? 'left' : 'right')
export const laneName = (lane: number) => `${sideOfLane(lane) === 'left' ? 'A' : 'B'}${(lane % 4) + 1}`
/** a friendly name: "pad 1" .. "pad 8" */
export const padLabel = (lane: number) => `pad ${lane + 1}`

/** DJ controller control (decoded by src/features/dj/map.ts) -> lane. Pads map straight onto lanes; transport buttons steer to the middle of their deck's side. */
export function djLane(id: string, deck: string | null): number | null {
  const b = deck === 'B' ? 4 : 0
  const m = /^pad([1-4])$/.exec(id)
  if (m) return b + Number(m[1]) - 1
  if (id === 'cue') return b + 1
  if (id === 'play') return b + 2
  if (id === 'sync') return b + 3
  if (id === 'padmode') return b
  return null
}

/** drum voice index (0..7) -> lane. The drum machine's 8 pads are already ordered left to right. */
export const laneOfVoice = (v: number) => Math.min(N_LANES - 1, Math.max(0, v))

/**
 * "Play C four times": do the last `n` musical tokens all name the same key (same letter at any octave) or the same pad,
 * each within `gapMs` of the one before? Returns what they named, or null.
 */
export function repeatedKey(tokens: readonly KodeToken[], n = 4, gapMs = 1600): { kind: 'pc' | 'lane'; value: number } | null {
  const mus: KodeToken[] = []
  for (let i = tokens.length - 1; i >= 0 && mus.length < n; i--) if (isMusical(tokens[i])) mus.push(tokens[i])
  if (mus.length < n) return null
  mus.reverse()
  const first = mus[0], kind = kindOf(first)
  for (let i = 0; i < n; i++) {
    const t = mus[i]
    if (kindOf(t) !== kind) return null
    if (kind === 'pitch' ? t.pitch! % 12 !== first.pitch! % 12 : t.lane !== first.lane) return null
    if (i > 0 && (t.t - mus[i - 1].t > gapMs || t.t < mus[i - 1].t)) return null
  }
  return kind === 'pitch' ? { kind: 'pc', value: first.pitch! % 12 } : { kind: 'lane', value: first.lane! }
}
