// Loop station rules: pre-roll capture, boundary wrap, loop length snapping and the big button's tap state machine.
// Pure functions only (src/features/loopstation/loopCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/loop-fixtures.ts        (exit 1 on any failure)
import {
  BIG_DOUBLE_MS, POST_ROLL_MS, PRE_ROLL_MS, bigAfter, bigNext, capturePos, classifyPress, hasNear, postRollPos, preRollBeats, snapLoopLen, wrapNotes,
  type BigState, type Gesture,
} from '../src/features/loopstation/loopCore'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const near = (a: number | null, b: number) => a != null && Math.abs(a - b) < 1e-9

// ---- pre-roll ----
const mspb120 = 500 // 120 bpm
eq('pre-roll is ~300 ms without a count-in', preRollBeats(mspb120, 0), PRE_ROLL_MS / mspb120)
eq('pre-roll covers the whole last count-in beat', preRollBeats(mspb120, 1), 1)
eq('slow tempo: 300 ms is still at least the window', preRollBeats(1500, 0), 0.2)
eq('a note 250 ms early (no count-in) lands on beat 1', capturePos(-0.5, 0, preRollBeats(mspb120, 0)), 0)
eq('a note 400 ms early (no count-in) is dropped', capturePos(-0.8, 0, preRollBeats(mspb120, 0)), null)
eq('a note in the last count-in beat lands on beat 1', capturePos(-0.9, 0, preRollBeats(mspb120, 1)), 0)
eq('a note two beats into the count-in is dropped', capturePos(-2, 0, preRollBeats(mspb120, 1)), null)
eq('on time stays on time', capturePos(1.5, 8, 0.6), 1.5)
eq('overdub across the boundary wraps (beat 9 of an 8-beat loop -> 1)', capturePos(9, 8, 0.6), 1)
eq('overdub on the third pass wraps too', capturePos(17.25, 8, 0.6), 1.25)

// ---- wrap at the loop end ----
const take = [{ t: 0, d: 1, n: 60, v: 90 }, { t: 7.5, d: 4, n: 64, v: 90 }, { t: 8.1, d: 0.5, n: 67, v: 90 }, { t: 16.2, d: 0.5, n: 72, v: 90 }]
const w = wrapNotes(take, 8)
eq('late note at 8.1 wraps to 0.1', near(w.find((x) => x.n === 67)!.t, 0.1), true)
eq('very late note wraps by whole loops', near(w.find((x) => x.n === 72)!.t, 0.2), true)
eq('nothing is longer than the loop', w.every((x) => x.d <= 8), true)
eq('no note is lost', w.length, 4)

// ---- post-roll (a note just after closing a take) ----
eq('100 ms after closing: wraps to the start', postRollPos(100, 8.2, 8) != null && near(postRollPos(100, 8.2, 8), 0.2), true)
eq('too late: ignored', postRollPos(POST_ROLL_MS + 1, 8.6, 8), null)
eq('closed early: the note keeps its place near the end', near(postRollPos(80, 7.8, 8), 7.8), true)
eq('a repeat of the first note is not doubled', hasNear(take, 60, 7.9, 8), true)
eq('a different note is kept', hasNear(take, 62, 0.1, 8), false)

// ---- loop length ----
eq('free: exactly what you played (to 1/16)', snapLoopLen(5.3, false), 5.25)
eq('free: at least one beat', snapLoopLen(0.2, false), 1)
eq('click on: whole bars (a bit late)', snapLoopLen(8.6, true), 8)
eq('click on: whole bars (a bit early)', snapLoopLen(7.4, true), 8)
eq('click on: never shorter than a bar', snapLoopLen(1.2, true), 4)
eq('never longer than 32 beats', snapLoopLen(90, false), 32)

// ---- double-tap timing ----
eq('first press is a tap', classifyPress(1000, null), 'tap')
eq('a quick second press is a double', classifyPress(1000 + BIG_DOUBLE_MS - 1, 1000), 'double')
eq('a slow second press is a tap', classifyPress(1000 + BIG_DOUBLE_MS + 1, 1000), 'tap')

// ---- the big button, like a looper pedal ----
function run(gs: Gesture[], from: BigState = 'empty', layersLeft = 1) {
  let st = from; const trail: string[] = []
  for (const g of gs) { const a = bigNext(st, g); st = bigAfter(st, a, layersLeft); trail.push(`${a}>${st}`) }
  return trail
}
eq('tap, (count-in ends), tap, tap, tap, double', (() => {
  let st: BigState = 'empty'; const out: string[] = []
  const step = (g: Gesture) => { const a = bigNext(st, g); st = bigAfter(st, a); out.push(a) }
  step('tap'); st = 'rec' // count-in over: recording
  step('tap'); step('tap'); step('tap'); step('double')
  return [out, st]
})(), [['record', 'close', 'overdub', 'finish', 'stop'], 'stop'])
eq('stopped: tap plays', run(['tap'], 'stop'), ['play>play'])
eq('stopped: hold clears', run(['hold'], 'stop'), ['clear>empty'])
eq('playing: hold undoes the last layer', run(['hold'], 'play', 1), ['undo>play'])
eq('playing: undoing the only layer empties it', run(['hold'], 'play', 0), ['undo>empty'])
eq('tap during the count-in cancels', run(['tap'], 'count'), ['cancel>empty'])
eq('double on an empty looper does nothing', run(['double'], 'empty'), ['none>empty'])
eq('recording: double stops', run(['double'], 'rec'), ['stop>stop'])

console.log(`${fails ? 'FAILED' : 'ok'}: ${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
