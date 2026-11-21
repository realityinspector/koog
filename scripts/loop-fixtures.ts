// Loop station rules: pre-roll capture, boundary wrap, loop length snapping and the big button's tap state machine.
// Pure functions only (src/features/loopstation/loopCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/loop-fixtures.ts        (exit 1 on any failure)
import {
  BIG_DOUBLE_MS, BIG_HOLD_MS, POST_ROLL_MS, PRE_ROLL_MS, TIMING_WORDS, bigAfter, bigNext, capturePos, classifyPress, deriveFreeTempo, hasNear, holdChoice, lockedStartBeat,
  loopLenLabel, postRollPos, preRollBeats, snapLoopLen, timingMode, wrapNotes,
  SIMPLE_DOUBLE_MS, UNDO_CLEAR_MS, LOOP_STYLES, LAG_MAX_MS, classifyPressFor, simpleDropsFirstTap, simpleNext, lagNext, noteTime, isMetronomeKey,
  GRACE_MS, graceBeats, closeLeadMs, trimSamePitch, lockedStartBeat as lsb, mod,
  type BigState, type Gesture,
} from '../src/features/loopstation/loopCore'
import { bpmFromTaps, pushTap } from '../src/music/tapTempo'

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
eq('unsynced: exactly what you played (no rounding)', snapLoopLen(5.3, false), 5.3)
eq('unsynced: at least a quarter beat', snapLoopLen(0.1, false), 0.25)
eq('click on: whole bars (a bit late)', snapLoopLen(8.6, true), 8)
eq('click on: whole bars (a bit early)', snapLoopLen(7.4, true), 8)
eq('click on: never shorter than a bar', snapLoopLen(1.2, true), 4)
eq('never longer than 32 beats', snapLoopLen(90, false), 32)
// nearest whole bar (half way rounds up)
eq('bars: 3.7 beats -> 1 bar', snapLoopLen(3.7, true), 4)
eq('bars: 5.9 beats (1.475 bars) -> 1 bar', snapLoopLen(5.9, true), 4)
eq('bars: 6.1 beats (1.525 bars) -> 2 bars', snapLoopLen(6.1, true), 8)
eq('bars: exactly 1.5 bars rounds up', snapLoopLen(6, true), 8)
eq('bars: stopped on beat 4 of bar 2 -> 2 bars', snapLoopLen(7.1, true), 8)
eq('bars: stopped just after beat 1 of bar 3 -> 2 bars', snapLoopLen(8.3, true), 8)
eq('bars: 3 bars allowed', snapLoopLen(11.6, true), 12)
eq('bars: at most 8 bars', snapLoopLen(40, true), 32)

// ---- the two timing modes ----
eq('all off: free', timingMode({ metronome: false, beat: false, countIn: 0 }), 'free')
eq('metronome on: locked', timingMode({ metronome: true, beat: false, countIn: 0 }), 'locked')
eq('beat on: locked', timingMode({ metronome: false, beat: true, countIn: 0 }), 'locked')
eq('count-in on: locked', timingMode({ metronome: false, beat: false, countIn: 1 }), 'locked')
eq('DJ owns the grid: locked', timingMode({ metronome: false, beat: false, countIn: 0, following: true }), 'locked')
eq('mode words (no brand names)', /roland|boss/i.test(Object.values(TIMING_WORDS).join(' ')), false)

// ---- free time: the tempo follows the loop ----
const bpmFor = (beats: number, ms: number) => (beats * 60000) / ms
const ft = (ms: number, cur: number) => { const r = deriveFreeTempo(ms, cur); return [r.beats, Math.round(r.bpm * 10) / 10] }
eq('3.1 s at 120 -> 2 bars, 154.8 BPM (77.4 is further from 120)', ft(3100, 120), [8, 154.8])
eq('1.9 s at 120 -> 1 bar, 126.3 BPM', ft(1900, 120), [4, 126.3])
eq('2.0 s at 120 -> 1 bar, exactly 120', ft(2000, 120), [4, 120])
eq('4.0 s at 120 -> 2 bars, 120', ft(4000, 120), [8, 120])
eq('8.0 s at 100 -> 4 bars, 120 (2 bars at 60 is further)', ft(8000, 100), [16, 120])
eq('8.0 s at 70 -> 2 bars, 60', ft(8000, 70), [8, 60])
eq('3.1 s at 80 -> 1 bar, 77.4', ft(3100, 80), [4, 77.4])
eq('16 s at 120 -> 8 bars, 120', ft(16000, 120), [32, 120])
eq('1.0 s (too short for a bar in 60..180) -> 2 beats, 120', ft(1000, 120), [2, 120])
eq('0.3 s -> 1 beat, 200', ft(300, 120), [1, 200])
eq('0.1 s is treated as the 0.25 s minimum -> 1 beat, 240', ft(100, 120), [1, 240])
eq('60 s (longer than 8 bars at 60) -> 8 bars, slowest the clock goes', ft(60000, 120), [32, 40])
// the loop is exactly n bars at the derived tempo (no rounding left to drift)
for (const ms of [1500, 1900, 2345, 3100, 5000, 7777, 12000]) {
  const r = deriveFreeTempo(ms, 110)
  eq(`free ${ms} ms: n bars at the new tempo last exactly ${ms} ms`, Math.abs((r.beats * 60000) / r.bpm - ms) < 1e-6, true)
  eq(`free ${ms} ms: whole bars`, r.beats % 4, 0)
  eq(`free ${ms} ms: tempo inside 60..180`, r.bpm >= 60 && r.bpm <= 180, true)
}
eq('bpmFor sanity', bpmFor(4, 2000), 120)
// 100 cycles of a free loop scheduled from the loop start stay on the grid (absolute, not incremental)
{
  const r = deriveFreeTempo(3100, 120), mspb = 60000 / r.bpm
  let worst = 0
  for (let k = 0; k <= 100; k++) { const loopMs = k * 3100, beatMs = k * r.beats * mspb; worst = Math.max(worst, Math.abs(loopMs - beatMs)) }
  eq('free loop vs beat grid after 100 cycles: < 0.001 ms apart', worst < 1e-3, true)
}

// ---- locked start when the beat is already playing ----
eq('beat playing, press mid-bar: start on the next bar line', lockedStartBeat(13.2, 0), 16)
eq('a press just after a bar line keeps that bar', lockedStartBeat(16.1, 0), 16)
eq('count-in after the next bar line', lockedStartBeat(13.2, 1, 0), 20)

// ---- loop length label ----
eq('label: 2 bars at 120', loopLenLabel(8, 120), '2 bars · 4.0 s')
eq('label: 1 bar at 126.3', loopLenLabel(4, 126.3), '1 bar · 1.9 s')
eq('label: 2 beats', loopLenLabel(2, 120), '2 beats · 1.0 s')
eq('label: nothing yet', loopLenLabel(0, 120), '')

// ---- classic pedal gesture timings ----
eq('hold is 2 s', BIG_HOLD_MS, 2000)
eq('press twice within 1 s', BIG_DOUBLE_MS, 1000)

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

// ---- hold = undo, hold again = redo ----
eq('first hold undoes', holdChoice(null, 0), 'undo')
eq('hold after an undo redoes', holdChoice('undo', 1), 'redo')
eq('hold after a redo undoes again', holdChoice('redo', 0), 'undo')
eq('nothing to redo: undo', holdChoice('undo', 0), 'undo')
{ // a little model of the layer stack: undo moves the newest layer to the redo stack, redo brings it back
  let layers = ['bass', 'piano'], redo: string[] = [], last: 'undo' | 'redo' | null = null
  const hold = () => { const c = holdChoice(last, redo.length); if (c === 'redo') { layers.push(redo.pop()!) } else if (layers.length) { redo.push(layers.pop()!) } last = c }
  hold(); eq('hold: piano undone', layers, ['bass'])
  hold(); eq('hold again: piano back', layers, ['bass', 'piano'])
  hold(); eq('third hold: undone again', layers, ['bass'])
  layers = [...layers, 'synth']; redo = []; last = null // recording something new forgets the redo
  hold(); eq('after a new layer, a hold undoes it', layers, ['bass'])
}


// ---- the pedal's SIMPLE style (one tap record / one tap play) ----
eq('simple is the first (default) style', LOOP_STYLES[0][0], 'simple')
eq('simple double-tap window is 0.5 s or less', SIMPLE_DOUBLE_MS <= 500 && SIMPLE_DOUBLE_MS < BIG_DOUBLE_MS, true)
eq('undo-clear lasts 5 s', UNDO_CLEAR_MS, 5000)
eq('simple: 2nd press inside the window is a double', classifyPressFor('simple', 1000 + SIMPLE_DOUBLE_MS - 1, 1000), 'double')
eq('simple: 2nd press after the window is a tap', classifyPressFor('simple', 1000 + SIMPLE_DOUBLE_MS + 1, 1000), 'tap')
eq('classic keeps its 1 s window', classifyPressFor('classic', 1000 + 900, 1000), 'double')
eq('simple: 0.7 s apart is two taps, not a double', classifyPressFor('simple', 1700, 1000), 'tap')
{
  // one tap records, one tap closes and the loop keeps playing, tap = new layer, tap = finish it, double = stop all, hold = clear all
  let st: BigState = 'empty'; const trail: string[] = []
  const g = (x: Gesture) => { const a = simpleNext(st, x); st = bigAfter(st, a, 1); trail.push(a + '>' + st) }
  g('tap'); st = 'rec' // (count-in over: recording)
  g('tap'); g('tap'); st = 'over'; g('tap'); g('double'); g('hold')
  eq('simple: full flow', trail, ['record>count', 'close>play', 'overdub>over', 'finish>play', 'stop>stop', 'clear>empty'])
}
for (const s of ['empty', 'count', 'rec', 'play', 'over', 'stop'] as BigState[]) eq('simple: hold always clears (' + s + ')', simpleNext(s, 'hold'), 'clear')
eq('classic hold still undoes while playing', bigNext('play', 'hold'), 'undo')
eq('simple: tap while empty records', simpleNext('empty', 'tap'), 'record')
eq('simple: tap while recording closes (keeps playing)', bigAfter('rec', simpleNext('rec', 'tap')), 'play')
eq('simple: tap while playing starts a layer', simpleNext('play', 'tap'), 'overdub')
// a double-tap takes back what its first tap started
eq('double after a tap that began a recording: drop it', simpleDropsFirstTap('empty'), true)
eq('double after a tap that began a layer: drop it', simpleDropsFirstTap('play'), true)
eq('double after a tap that closed the loop: keep it', simpleDropsFirstTap('rec'), false)
eq('double after a tap that finished a layer: keep it', simpleDropsFirstTap('over'), false)
eq('double after a tap that started playback: nothing to drop', simpleDropsFirstTap('stop'), false)

// ---- timer lag tracking and event timestamps ----
{
  let a = 0; for (let i = 0; i < 80; i++) a = lagNext(a, 6)
  eq('lag converges to the steady lateness', Math.round(a), 6)
  eq('a huge stall is capped', lagNext(0, 5000) <= LAG_MAX_MS * 0.1 + 1e-9, true)
  eq('lag never goes below 0', lagNext(0, -50), 0)
  let b = LAG_MAX_MS; for (let i = 0; i < 200; i++) b = lagNext(b, 0)
  eq('lag decays to 0 when timers are on time', Math.round(b), 0)
}
eq('a MIDI timestamp 12 ms old is used', noteTime(988, 1000), 988)
eq('a missing timestamp falls back to now', noteTime(undefined, 1000), 1000)
eq('a timestamp from the future falls back to now', noteTime(1010, 1000), 1000)
eq('a very old timestamp falls back to now', noteTime(500, 1000), 1000)
eq('timestamp 0 (synthetic) falls back to now', noteTime(0, 1000), 1000)

// ---- the M key ----
const key = (o: Partial<{ code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean }>) => ({ code: 'KeyM', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...o })
eq('plain M never toggles the metronome (it is the note B)', isMetronomeKey(key({})), false)
eq('Shift+M toggles, everywhere', isMetronomeKey(key({ shiftKey: true })), true)
eq('Ctrl+Shift+M never toggles', isMetronomeKey(key({ ctrlKey: true, shiftKey: true })), false)
eq('Cmd+Shift+M never toggles', isMetronomeKey(key({ metaKey: true, shiftKey: true })), false)
eq('Alt+Shift+M never toggles', isMetronomeKey(key({ altKey: true, shiftKey: true })), false)
eq('a held (repeating) Shift+M toggles once', isMetronomeKey(key({ repeat: true, shiftKey: true })), false)
eq('another key never toggles', isMetronomeKey(key({ code: 'KeyN', shiftKey: true })), false)

// ---- timing science round: grace in time, stop-press lead, seam, tap tempo, drift ----
eq('grace is 0.25 beat at 120 bpm', graceBeats(500), 0.25)
eq('grace shrinks in beats at 160 bpm (still 125 ms)', Math.round(graceBeats(375) * 1000), 333)
eq('grace at 40 bpm is the 0.1 beat floor (GRACE_MS ' + GRACE_MS + ')', graceBeats(1500), 0.1)
// before: fixed 0.25 beat at 60 bpm = 250 ms forgiven; after: 125 ms. A press 200 ms after a bar line at 60 bpm now goes to the NEXT bar.
eq('60 bpm, press 200 ms (0.2 beat) late: next bar now', lsb(8.2, 0, graceBeats(1000)), 12)
eq('60 bpm, press 100 ms late: keeps the bar', lsb(8.1, 0, graceBeats(1000)), 8)
eq('foot lead is bigger than hand lead', closeLeadMs(true) > closeLeadMs(false), true)
eq('nudge is clamped to +-50', closeLeadMs(false, 500), 15 + 50)
// free-time first loop: intended 2000 ms, foot presses early by ~45 ms (+-15 jitter, deterministic spread)
{
  const errs = [-60, -45, -30, -50, -40, -35, -55, -45]
  const before = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length
  const after = errs.reduce((a, e) => a + Math.abs(e + closeLeadMs(true)), 0) / errs.length
  eq('foot early-press length error shrinks (mean ms, before -> after)', [Math.round(before), Math.round(after)], [45, 9])
}
const nn = (t: number, d: number, n = 60) => ({ t, d, n, v: 90 })
eq('a long note is trimmed before the next same-pitch hit', trimSamePitch([nn(0, 4), nn(2, 1)], 8).map((x) => x.d), [1.98, 1])
eq('a note held over the seam stops before its own first note', trimSamePitch([nn(0, 1), nn(6, 4)], 8).map((x) => x.d), [1, 1.98])
eq('a lone note is trimmed under one loop', trimSamePitch([nn(1, 8)], 8)[0].d < 8, true)
eq('different pitches are left alone', trimSamePitch([nn(0, 4, 60), nn(1, 4, 64)], 8).map((x) => x.d), [4, 4])
eq('short notes are untouched', trimSamePitch([nn(0, 0.5), nn(2, 0.5)], 8).map((x) => x.d), [0.5, 0.5])
{
  const T = (...g: number[]) => g.reduce<number[]>((a, x) => [...a, (a.length ? a[a.length - 1] : 0) + x], [0])
  const steady = bpmFromTaps(T(500, 500, 500, 500))
  eq('steady taps: 120 bpm', Math.round(steady!), 120)
  // one missed tap (a 1000 ms gap) in an otherwise 500 ms pulse: old first-to-last mean read 4 gaps/2500ms = 96 bpm
  eq('a missed tap no longer drags the tempo', Math.round(bpmFromTaps(T(500, 500, 1000, 500, 500))!), 120)
  eq('a doubled tap: the 80 ms gap is dropped (old mean said 125 too, but also with 2 stray taps); stays within 5%', Math.round(bpmFromTaps(T(500, 500, 80, 420, 500))!), 125)
  eq('one tap is not a tempo', bpmFromTaps([100]), null)
  eq('a pause over 2 s starts fresh', pushTap([0, 500, 1000], 4000), [4000])
  eq('only the last 8 taps are kept', pushTap([0, 1, 2, 3, 4, 5, 6, 7], 8).length, 8)
}
{ // drift: every cycle start is base + k*period, never a running sum. 100,000 cycles of a 7.3 beat loop stay exact to 1e-9 beats.
  const P = 7.3, base = 4
  eq('no drift over 100,000 cycles', Math.abs(mod(base + 100000 * P - base, P)) < 1e-6 || Math.abs(mod(100000 * P, P) - P) < 1e-6, true)
}

console.log(`${fails ? 'FAILED' : 'ok'}: ${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
