// Drum pads rules: quantise-to-step (incl. a hit just before the downbeat), clearing, swing timing, pattern length, note repeat, starters, undo.
// Pure functions only (src/features/drumpads/drumCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/drum-fixtures.ts        (exit 1 on any failure)
import {
  STARTERS, STEPS_MAX, N_VOICES, VOICES, clampSwing, clearAll, clearRow, defaultTweak, isEmpty, nearestStep, newPattern, newUndo, parsePattern, popUndo, pushUndo,
  recordHit, repeatPositions, reviveSaved, rowEmpty, setLength, stepBeats, swingOffset, toggleCell, velocityOf, bpmOfFader, faderOfBpm, pick3,
} from '../src/features/drumpads/drumCore'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const close = (name: string, got: number, want: number, eps = 1e-9) => eq(name, Math.abs(got - want) < eps, true)

// ---- quantise to the nearest 16th ----
eq('on the step', nearestStep(4), 4)
eq('a little late rounds back', nearestStep(4.3), 4)
eq('a little early rounds forward', nearestStep(3.7), 4)
eq('just before the downbeat lands on step 1 (index 0), not lost', nearestStep(15.8, 16), 0)
eq('a hair after the downbeat stays on step 1', nearestStep(16.2, 16), 0)
eq('later bars wrap (absolute step 35.9 of 16)', nearestStep(35.9, 16), 4)
eq('two bars: step 31.7 wraps to 0', nearestStep(31.7, 32), 0)
eq('two bars: step 17.2 is index 17', nearestStep(17.2, 32), 17)
eq('negative positions (before beat 0) wrap', nearestStep(-0.4, 16), 0)
eq('negative positions wrap to the end', nearestStep(-1.2, 16), 15)

// ---- recording ----
{
  const p = newPattern()
  eq('record just before the bar lands on index 0', recordHit(p, 0, 15.8, 0.9), 0)
  eq('...with its velocity', p.rows[0][0], 0.9)
  recordHit(p, 0, 0.1, 0.5)
  eq('a softer second hit never lowers the level', p.rows[0][0], 0.9)
  recordHit(p, 1, 8.4, 0)
  eq('velocity floor keeps the hit audible', p.rows[1][8], 0.1)
  eq('only that voice changed', rowEmpty(p, 2), true)
  clearRow(p, 0)
  eq('clear row empties just that drum', [rowEmpty(p, 0), rowEmpty(p, 1)], [true, false])
  clearAll(p)
  eq('clear all', isEmpty(p), true)
}

// ---- toggle ----
{
  const p = newPattern()
  eq('toggle on', toggleCell(p, 3, 5), true); eq('cell is set', p.rows[3][5], 1)
  eq('toggle off', toggleCell(p, 3, 5), false); eq('cell is clear', p.rows[3][5], 0)
  eq('out of range is ignored', toggleCell(p, 3, 99), false)
}

// ---- swing ----
eq('no swing: no offset', swingOffset(1, 0), 0)
eq('even 16ths never move', swingOffset(2, 0.6), 0)
close('odd 16ths move by swing/1.8 steps', swingOffset(3, 0.3), 0.3 / 1.8)
close('60% is a triplet feel (a third of a step)', swingOffset(1, 0.6), 1 / 3)
eq('swing is clamped to 60%', clampSwing(2), 0.6); eq('and to 0', clampSwing(-1), 0); eq('NaN is 0', clampSwing(NaN), 0)
close('step 1 at 0 swing sits at 1/4 beat', stepBeats(1, 0), 0.25)
close('step 1 at 60% swing is a third of a step later', stepBeats(1, 0.6), (1 + 1 / 3) / 4)
close('step 2 is never swung', stepBeats(2, 0.6), 0.5)
close('absolute step 17 swings like an odd step', stepBeats(17, 0.6), (17 + 1 / 3) / 4)
close('swung step stays before the next step', stepBeats(1, 0.6) < stepBeats(2, 0.6) ? 1 : 0, 1)

// ---- pattern length ----
{
  const p = parsePattern(STARTERS[0].rows)
  eq('starts at 16', p.len, 16)
  setLength(p, 32)
  eq('growing copies bar 1 into the empty bar 2', p.rows[0].slice(16, 32), p.rows[0].slice(0, 16))
  p.rows[0][16] = 0; p.rows[1][20] = 1
  setLength(p, 16)
  eq('shrinking keeps bar 2 data', p.rows[1][20], 1)
  setLength(p, 32)
  eq('growing again does not overwrite an edited bar 2', p.rows[0][16], 0)
  eq('length is 32', p.len, 32)
  eq('hits record into bar 2 when 32 long', recordHit(p, 4, 20.1, 1), 20)
  setLength(p, 32); eq('same length is a no-op', p.len, 32)
  eq('rows stay STEPS_MAX long', p.rows.every((r) => r.length === STEPS_MAX), true)
}

// ---- note repeat ----
eq('1/16 repeat: every step in the window', repeatPositions(0.2, 3.1, 1), [1, 2, 3])
eq('1/8 repeat: every second step', repeatPositions(0.2, 4.1, 2), [2, 4])
eq('exactly on the start is not re-fired', repeatPositions(2, 4, 2), [4])
eq('window end is inclusive', repeatPositions(0, 2, 1), [1, 2])
eq('too-soon first point is skipped (no flam)', repeatPositions(0.9, 2.1, 1, 0.25), [2])
eq('rate 0 (off) gives nothing', repeatPositions(0, 10, 0), [])
eq('empty window gives nothing', repeatPositions(5, 5, 1), [])
eq('works on fractional positions across bars', repeatPositions(15.5, 18, 2), [16, 18])
// at 120 bpm a 1/16 is 125 ms: a 20 ms tick window holds at most one point
eq('one tick holds at most one 1/16 point', repeatPositions(10.01, 10.17, 1).length <= 1, true)

// ---- velocity + faders ----
close('no velocity = full', velocityOf(undefined), 1); close('velocity 0 = full', velocityOf(0), 1)
close('127 = full', velocityOf(127), 1); close('1 = very soft but audible', velocityOf(1), 0.3 + 0.7 / 127)
close('tempo fader low end is 60', bpmOfFader(0), 60); close('top end is 180', bpmOfFader(1), 180); close('round trip', faderOfBpm(bpmOfFader(0.25)), 0.25)
eq('pick3 thirds', [pick3(0), pick3(0.5), pick3(0.99)], [0, 1, 2])

// ---- starters ----
eq('four starter patterns', STARTERS.length, 4)
for (const s of STARTERS) {
  const p = parsePattern(s.rows)
  eq(`${s.id}: 8 rows`, s.rows.length, N_VOICES)
  eq(`${s.id}: every row is 16 long`, s.rows.every((r) => r.length === 16), true)
  eq(`${s.id}: has a kick`, !rowEmpty(p, 0), true)
  eq(`${s.id}: sane tempo`, s.bpm >= 80 && s.bpm <= 130, true)
}
eq('parse: X is full, x is soft', [parsePattern(['Xx.']).rows[0].slice(0, 3)], [[1, 0.55, 0]])
eq('voices', VOICES.map((v) => v.id), ['kick', 'snare', 'hat', 'open', 'clap', 'tomLo', 'tomHi', 'rim'])

// ---- undo ----
{
  const p = parsePattern(STARTERS[0].rows), u = newUndo()
  pushUndo(u, p)
  recordHit(p, 4, 3, 1)
  eq('the recording changed the pattern', p.rows[4][3], 1)
  eq('undo succeeds', popUndo(u, p), true)
  eq('undo restores the pattern', p.rows[4][3], 0)
  eq('nothing more to undo', popUndo(u, p), false)
  for (let i = 0; i < 12; i++) pushUndo(u, p)
  eq('undo keeps the last 8', u.snaps.length, 8)
}

// ---- saved data ----
{
  eq('garbage is rejected', reviveSaved(null), null); eq('not-an-object is rejected', reviveSaved('x'), null)
  const s = reviveSaved({ len: 32, rows: [[1, 'x', 5, -1]], kit: 9, swing: 2, vol: -1, patVol: 'a', repeat: 1.2, tweak: [{ pitch: 9 }] })!
  eq('rows padded to every drum', s.rows.length, N_VOICES); eq('and every step', s.rows[0].length, STEPS_MAX)
  eq('values are clamped / cleaned', s.rows[0].slice(0, 4), [1, 0, 1, 0])
  eq('kit clamped', s.kit, 2); eq('swing clamped', s.swing, 0.6); eq('volume clamped', s.vol, 0); eq('bad number falls back', s.patVol, 1); eq('repeat rounded', s.repeat, 1)
  eq('tweak clamped, missing ones default', [s.tweak[0].pitch, s.tweak[1]], [1, defaultTweak()])
  eq('len 32 kept', s.len, 32)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
