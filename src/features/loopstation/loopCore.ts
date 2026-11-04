// Pure looper rules (no DOM, no audio, no stores), shared by loopEngine.ts and scripts/loop-fixtures.ts.
//
// THE BIG BUTTON (and the foot pedal), like a guitar looper pedal:
//   tap            empty: start recording  ·  recording: close the loop and play  ·  playing: record a new layer on top
//                  adding a layer: finish it  ·  stopped: play  ·  counting in: cancel
//   double-tap     stop
//   hold ~1 s      undo the last layer (stopped: clear everything)
//
// TIMING HELP (kids are rarely exactly on the beat):
//   pre-roll   a note up to PRE_ROLL_MS before the loop starts (or anywhere in the last count-in beat) lands ON beat 1
//   post-roll  a note up to POST_ROLL_MS after you close a take wraps round to the start of the loop
//   wrap       a take's notes past the loop end wrap to the start (closing a little late never loses a note)
export const PRE_ROLL_MS = 300
export const POST_ROLL_MS = 250
export const BIG_HOLD_MS = 1000
export const BIG_DOUBLE_MS = 400
export const MAX_LOOP_BEATS = 32

export const mod = (x: number, n: number) => ((x % n) + n) % n
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** how early (in beats) a note may come and still count as beat 1: ~300 ms, or the whole last count-in beat */
export function preRollBeats(msPerBeat: number, countInBars: number): number {
  return Math.max(PRE_ROLL_MS / Math.max(1, msPerBeat), countInBars > 0 ? 1 : 0)
}

/** where a note at `rel` beats from the loop start goes in the take: null = too early (still counting in) */
export function capturePos(rel: number, len: number, preBeats: number): number | null {
  if (rel < -preBeats - 1e-9) return null
  if (rel < 0) return 0 // a hair early on the "1": it belongs to the downbeat
  return len > 0 ? mod(rel, len) : rel
}

/** the length of a first take: whole bars when a beat/click is on, otherwise exactly what you played (to 1/16 of a beat) */
export function snapLoopLen(elapsedBeats: number, bars: boolean): number {
  if (bars) return clamp(Math.round(elapsedBeats / 4), 1, MAX_LOOP_BEATS / 4) * 4
  return clamp(Math.round(elapsedBeats * 4) / 4, 1, MAX_LOOP_BEATS)
}

export interface CoreNote { t: number; d: number; n: number; v: number }
/** finish a take: notes past the end wrap to the start, nothing is longer than the loop */
export function wrapNotes<N extends CoreNote>(notes: N[], len: number): N[] {
  if (len <= 0) return notes
  return notes.map((x) => ({ ...x, t: x.t >= len ? mod(x.t, len) : x.t, d: Math.min(x.d, len) })).filter((x) => x.t >= 0 && x.t < len)
}

/** is there already this note within `tol` beats of t (round the loop)? stops a late note doubling the loop's own first note */
export function hasNear(notes: CoreNote[], n: number, t: number, len: number, tol = 0.25): boolean {
  return notes.some((x) => x.n === n && Math.min(Math.abs(x.t - t), len > 0 ? len - Math.abs(x.t - t) : Infinity) <= tol)
}

/** a note that came just after a take was closed: where it goes, or null when it is too late */
export function postRollPos(msAfterClose: number, rel: number, len: number): number | null {
  if (msAfterClose < 0 || msAfterClose > POST_ROLL_MS || len <= 0) return null
  return mod(rel, len)
}

// ---------- the big button's state machine ----------
export type BigState = 'empty' | 'count' | 'rec' | 'play' | 'over' | 'stop'
export type Gesture = 'tap' | 'double' | 'hold'
export type BigAction = 'record' | 'cancel' | 'close' | 'overdub' | 'finish' | 'play' | 'stop' | 'undo' | 'clear' | 'none'

/** a press: 'double' when it comes within BIG_DOUBLE_MS of the previous press */
export const classifyPress = (now: number, lastDown: number | null): 'tap' | 'double' => (lastDown != null && now - lastDown < BIG_DOUBLE_MS ? 'double' : 'tap')

/**
 * What a gesture does. `state` is the state BEFORE the gesture's press (a hold also fired a tap when it went down,
 * and the engine undoes that tap first). A double's first tap already happened, so double is just "stop".
 */
export function bigNext(state: BigState, g: Gesture): BigAction {
  if (g === 'double') return state === 'empty' ? 'none' : 'stop'
  if (g === 'hold') {
    if (state === 'stop' || state === 'empty' || state === 'count') return 'clear'
    return 'undo'
  }
  switch (state) {
    case 'empty': return 'record'
    case 'count': return 'cancel'
    case 'rec': return 'close'
    case 'play': return 'overdub'
    case 'over': return 'finish'
    case 'stop': return 'play'
  }
}

/** what the state becomes after an action (for the tests and the hint line) */
export function bigAfter(state: BigState, a: BigAction, layersLeft = 1): BigState {
  switch (a) {
    case 'record': return 'count'
    case 'cancel': return 'empty'
    case 'close': case 'finish': case 'play': return 'play'
    case 'overdub': return 'over'
    case 'stop': return state === 'empty' || state === 'count' ? 'empty' : 'stop'
    case 'undo': return layersLeft > 0 ? (state === 'stop' ? 'stop' : 'play') : 'empty'
    case 'clear': return 'empty'
    case 'none': return state
  }
}

/** kid-readable words for the big button */
export const BIG_WORDS: Record<BigState, { word: string; hint: string }> = {
  empty: { word: 'TAP TO RECORD', hint: 'Tap, then play something.' },
  count: { word: 'GET READY', hint: 'Recording starts on beat 1. Tap to cancel.' },
  rec: { word: 'RECORDING', hint: 'Tap when you are done. It will loop!' },
  play: { word: 'PLAYING', hint: 'Tap to add a layer on top. Double-tap to stop.' },
  over: { word: 'ADDING A LAYER', hint: 'Tap to finish this layer.' },
  stop: { word: 'STOPPED', hint: 'Tap to play. Hold to clear everything.' },
}
