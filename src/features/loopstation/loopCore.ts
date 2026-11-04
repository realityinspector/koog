// Pure looper rules (no DOM, no audio, no stores), shared by loopEngine.ts and scripts/loop-fixtures.ts.
//
// THE BIG BUTTON (and the foot pedal), like a guitar looper pedal:
//   tap            empty: start recording  ·  recording: close the loop and play  ·  playing: record a new layer on top
//                  adding a layer: finish it  ·  stopped: play  ·  counting in: cancel
//   press twice    stop (the second press within BIG_DOUBLE_MS)
//   hold 2 s       playing: undo the newest layer, hold again: redo it  ·  stopped: clear everything
//   (the same gestures and timings as the classic one-pedal guitar loopers)
//
// TIMING HELP (kids are rarely exactly on the beat):
//   pre-roll   a note up to PRE_ROLL_MS before the loop starts (or anywhere in the last count-in beat) lands ON beat 1
//   post-roll  a note up to POST_ROLL_MS after you close a take wraps round to the start of the loop
//   wrap       a take's notes past the loop end wrap to the start (closing a little late never loses a note)
export const PRE_ROLL_MS = 300
export const POST_ROLL_MS = 250
export const BIG_HOLD_MS = 2000
export const BIG_DOUBLE_MS = 1000
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

/**
 * The length of a first take.
 *   bars=true  (LOCKED: metronome / beat / count-in on): the NEAREST whole bar (3.7 beats -> 1 bar, 5.9 -> 1 bar, 6.1 -> 2 bars;
 *              exactly half way rounds up), at least 1 bar, at most MAX_LOOP_BEATS. Stopping a little early or late still gives whole bars.
 *   bars=false (an unsynced track / free time without a tempo change): exactly what you played, no rounding (at least 1/4 beat).
 */
export function snapLoopLen(elapsedBeats: number, bars: boolean): number {
  if (bars) return clamp(Math.round(elapsedBeats / 4), 1, MAX_LOOP_BEATS / 4) * 4
  return clamp(elapsedBeats, 0.25, MAX_LOOP_BEATS)
}

// ---------- the two timing modes ----------
// FREE   (metronome, beat and count-in all off): the first loop is exactly as long as you played; the tempo is worked out FROM it.
// LOCKED (metronome, beat or count-in on, or the grid belongs to someone else): recording starts on beat 1, loops snap to whole bars.
export type TimingMode = 'free' | 'locked'
export function timingMode(o: { metronome: boolean; beat: boolean; countIn: number; measure?: boolean; following?: boolean }): TimingMode {
  return o.metronome || o.beat || o.countIn > 0 || o.measure || o.following ? 'locked' : 'free'
}
export const TIMING_WORDS: Record<TimingMode, string> = {
  free: 'Free time — tempo follows your loop',
  locked: 'Locked to the beat — loops snap to whole bars',
}
/** the shortest first loop in free time (a classic looper pedal's minimum) */
export const FREE_MIN_MS = 250
export const FREE_BPM_LO = 60, FREE_BPM_HI = 180
/** the master clock's own limits (a derived tempo never goes past them) */
export const CLOCK_BPM_MIN = 40, CLOCK_BPM_MAX = 240

/**
 * FREE time: the tempo that makes a loop of `ms` milliseconds exactly n bars of 4/4.
 * n in {1, 2, 4, 8}: of those with a tempo inside 60..180 BPM, the one closest to the current tempo wins
 * (3.1 s at 120 -> 2 bars at 154.8; 1.9 s -> 1 bar at 126.3; 8 s at 100 -> 4 bars at 120).
 * A loop too short for a whole bar inside 60..180 (under 1.33 s) becomes 2 beats or 1 beat (up to 240 BPM, so 0.25 s is 1 beat);
 * a loop too long for 8 bars at 60 becomes 8 bars, slower (down to 40 BPM).
 */
export function deriveFreeTempo(ms: number, curBpm: number): { beats: number; bpm: number } {
  const len = Math.max(FREE_MIN_MS, ms)
  const bpmFor = (beats: number) => (beats * 60000) / len
  const pick = (cands: number[], lo: number, hi: number) => {
    const ok = cands.filter((b) => bpmFor(b) >= lo - 1e-9 && bpmFor(b) <= hi + 1e-9)
    if (!ok.length) return null
    return ok.reduce((a, b) => (Math.abs(bpmFor(b) - curBpm) < Math.abs(bpmFor(a) - curBpm) ? b : a))
  }
  const beats = pick([4, 8, 16, 32], FREE_BPM_LO, FREE_BPM_HI) ?? pick([2, 1], FREE_BPM_LO, CLOCK_BPM_MAX) ?? (bpmFor(32) < FREE_BPM_LO ? 32 : 1)
  return { beats, bpm: clamp(bpmFor(beats), CLOCK_BPM_MIN, CLOCK_BPM_MAX) }
}

/** "2 bars · 4.0 s" (or "2 beats · 1.0 s" for a loop shorter than a bar) */
export function loopLenLabel(beats: number, bpm: number): string {
  if (!(beats > 0) || !(bpm > 0)) return ''
  const sec = ((beats * 60) / bpm).toFixed(1) + ' s'
  const bars = beats / 4
  if (Math.abs(bars - Math.round(bars)) < 1e-6 && bars >= 1) return `${Math.round(bars)} bar${Math.round(bars) === 1 ? '' : 's'} · ${sec}`
  const b = Math.round(beats * 100) / 100
  return `${b} beat${b === 1 ? '' : 's'} · ${sec}`
}

/** LOCKED start: the bar line the first take starts on when the beat is already playing (a press just after a bar line keeps that bar) */
export function lockedStartBeat(beatNow: number, countInBars: number, graceBeats = 0.25): number {
  const prev = Math.floor(beatNow / 4) * 4
  const bar = beatNow - prev <= graceBeats ? prev : prev + 4
  return bar + countInBars * 4
}

/** a press just after a bar line keeps that bar for this long (in TIME, so it feels the same at 60 and 160 bpm): 0.25 beat at 120 bpm */
export const GRACE_MS = 125
export const graceBeats = (msPerBeat: number): number => clamp(GRACE_MS / Math.max(1, msPerBeat), 0.1, 0.5)

/**
 * Stop-press lead. A stop press is timed to a beat you hear in your head, so people press EARLY (negative mean asynchrony: ~20-50 ms,
 * more with the foot). The first loop in free time would come out that much short. Add the lead back to the closing press.
 * `nudgeMs` is the grown-up's own fine-tune (Boss mode), -50..+50.
 */
export const CLOSE_LEAD_FOOT_MS = 40
export const CLOSE_LEAD_HAND_MS = 15
export const closeLeadMs = (foot: boolean, nudgeMs = 0): number => (foot ? CLOSE_LEAD_FOOT_MS : CLOSE_LEAD_HAND_MS) + clamp(nudgeMs, -50, 50)

/**
 * Notes of one pitch must not overlap each other round the loop: a long note's scheduled release would cut the next cycle's (or the next
 * note's) same-pitch hit. Trim each note to end just before the next same-pitch onset, counting the wrap to the start of the loop.
 */
export function trimSamePitch<N extends CoreNote>(notes: N[], len: number): N[] {
  if (len <= 0) return notes
  const byPitch = new Map<number, N[]>()
  for (const x of notes) { const a = byPitch.get(x.n); if (a) a.push(x); else byPitch.set(x.n, [x]) }
  const out = new Map<N, number>()
  for (const arr of byPitch.values()) {
    const s = [...arr].sort((a, b) => a.t - b.t)
    s.forEach((x, k) => {
      const nx = s[(k + 1) % s.length]
      let gap = nx.t - x.t; if (gap <= 1e-9) gap += len // same moment: wrap a whole loop (single note: its own next cycle)
      out.set(x, Math.min(x.d, Math.max(0.05, gap - 0.02)))
    })
  }
  return notes.map((x) => ({ ...x, d: out.get(x) ?? x.d }))
}

/** a hold while playing: undo, or (right after an undo, with something to bring back) redo */
export const holdChoice = (lastHold: 'undo' | 'redo' | null, redoCount: number): 'undo' | 'redo' => (lastHold === 'undo' && redoCount > 0 ? 'redo' : 'undo')

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

// ---------- the pedal's two styles ----------
// classic: the guitar-pedal rules above (press twice within BIG_DOUBLE_MS = stop, hold 2 s = undo / redo, hold while stopped = clear).
// simple:  tap = record / close the loop and keep it playing / start a layer / finish the layer.
//          two quick taps (SIMPLE_DOUBLE_MS) = stop everything.   hold 2 s = clear everything (with a 5 s "Undo clear").
//   A tap acts at once (no waiting out the double-tap window, so a single tap never feels late). The second tap of a double
//   quietly takes back whatever the first tap started (a layer that was just begun, a recording that was just begun) and stops.
export type LoopStyle = 'simple' | 'classic'
export const SIMPLE_DOUBLE_MS = 500
export const UNDO_CLEAR_MS = 5000
export const LOOP_STYLES: [LoopStyle, string, string][] = [
  ['simple', 'Simple (one tap record / one tap play)', 'Tap: record, tap again: loop it and keep it playing. Tap to add a layer, tap to finish it. Two quick taps: stop everything. Hold 2 s: clear everything (you get 5 s to Undo).'],
  ['classic', 'Classic (hold = undo)', 'Like a guitar looper pedal. Tap: record, loop, add a layer. Press twice: stop. Hold 2 s: undo the newest layer, hold again to redo. Hold while stopped: clear.'],
]
export const classifyPressFor = (style: LoopStyle, now: number, lastDown: number | null): 'tap' | 'double' =>
  lastDown != null && now - lastDown < (style === 'simple' ? SIMPLE_DOUBLE_MS : BIG_DOUBLE_MS) ? 'double' : 'tap'
/** does the first tap of a simple double-tap have to be taken back? (it began a recording or a layer, which is dropped) */
export const simpleDropsFirstTap = (firstPrev: BigState): boolean => firstPrev === 'empty' || firstPrev === 'play'
/** simple style: what a gesture does (the first tap of a double already happened) */
export function simpleNext(state: BigState, g: Gesture): BigAction {
  if (g === 'hold') return 'clear'
  return bigNext(state, g)
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
  play: { word: 'PLAYING', hint: 'Tap to add a layer. Press twice to stop. Hold 2 s to undo.' },
  over: { word: 'ADDING A LAYER', hint: 'Tap to finish this layer.' },
  stop: { word: 'STOPPED', hint: 'Tap to play. Hold 2 s to clear everything.' },
}

/** timer lag tracking: a smoothed average of how late timers fire (ms), kept within 0..LAG_MAX_MS so a stall never makes notes fire far too early */
export const LAG_MAX_MS = 20
export const lagNext = (avg: number, lateMs: number): number => Math.min(LAG_MAX_MS, Math.max(0, avg * 0.9 + Math.min(LAG_MAX_MS, Math.max(0, lateMs)) * 0.1))

/** a note's own timestamp (the MIDI event's timeStamp, performance.now ms) when it is sane (not in the future, under 250 ms old), else `now` */
export function noteTime(t: number | undefined, now = performance.now()): number { return t != null && t > 0 && t <= now && now - t < 250 ? t : now }

/** does this key press mean "flip the metronome"? M anywhere; while the computer keys play notes (M is the note B) it takes Shift+M */
export function isMetronomeKey(e: { code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; isComposing?: boolean }, keysPlayNotes: boolean): boolean {
  if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false
  return keysPlayNotes ? e.shiftKey : true
}
