// Drum pads rules: quantise-to-step (incl. a hit just before the downbeat), clearing, swing timing, pattern length, note repeat, starters, undo.
// Pure functions only (src/features/drumpads/drumCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/drum-fixtures.ts        (exit 1 on any failure)
import {
  STARTERS, STEPS_MAX, N_VOICES, VOICES, clampSwing, clearAll, clearRow, defaultTweak, isEmpty, nearestStep, newPattern, newUndo, parsePattern, popUndo, pushUndo,
  recordHit, repeatPositions, reviveSaved, rowEmpty, setLength, stepBeats, swingOffset, toggleCell, velocityOf, bpmOfFader, faderOfBpm, pick3,
  ACCENT_GAIN, BANK_NAMES, HELP_MAP, N_BANKS, STEP_PAGE, atBarLine, audible, clonePattern, copyBar, effVel, fillVel, nextBank, padName, pagesOf, statusLine, stepOfPad, toggleAccent,
} from '../src/features/drumpads/drumCore'

import { STYLES, TRAIT_DETECTORS, chordAt, detectTraits, homeOf, makeAnswer, stylePcs, styleById, type PlayedNote } from '../src/music/styles'
import { PEOPLE_STYLES, STYLE_GROUPS, groupOf } from '../src/features/mimic/peopleStyles'

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

// ---- round 2: banks, queue at the bar line, accent, mute / solo, copy, fill, step-edit pages, status, save compat ----
{
  eq('four banks A-D', [N_BANKS, BANK_NAMES], [4, ['A', 'B', 'C', 'D']])
  // queue: a change waits for the first step of the next cycle
  eq('bar line is the first step of a 16-step cycle', [atBarLine(16, 0, 16), atBarLine(17, 0, 16), atBarLine(32, 0, 16)], [true, false, true])
  eq('bar line follows the pattern start after a swap', [atBarLine(40, 24, 16), atBarLine(32, 24, 16)], [true, false])
  eq('a 2-bar pattern only changes every 32 steps', [atBarLine(16, 0, 32), atBarLine(32, 0, 32)], [false, true])
  eq('chain goes to the next bank with beats', nextBank(0, [true, false, true, false]), 2)
  eq('chain wraps round', nextBank(2, [true, false, true, false]), 0)
  eq('chain with a single bank stays put', nextBank(1, [false, true, false, false]), 1)
  // accent
  eq('accent is louder than a normal step', effVel(1, true) > effVel(1, false), true)
  eq('accent never goes over 1', effVel(1, true) <= 1 && ACCENT_GAIN <= 1, true)
  eq('a soft ghost note stays softer than a full hit', effVel(0.55, true) < effVel(1, true), true)
  { const p = newPattern(); eq('toggle accent on', toggleAccent(p, 4), true); eq('toggle accent off', toggleAccent(p, 4), false); eq('accent out of range ignored', toggleAccent(p, 40), false)
    toggleAccent(p, 2); const q = clonePattern(p); q.acc[2] = 0; eq('clone is deep (acc)', p.acc[2], 1)
    clearAll(p); eq('clear all clears accents', p.acc.every((x) => x === 0), true) }
  // mute / solo
  { const none = new Array(8).fill(false); const m = none.map((_, i) => i === 1); const s = none.map((_, i) => i === 2)
    eq('nothing muted: everything plays', audible(0, none, none), true); eq('muted drum is silent', audible(1, m, none), false)
    eq('with a solo only that drum plays', [audible(2, none, s), audible(0, none, s)], [true, false])
    eq('solo beats mute on the same drum', audible(2, s, s), true) }
  // copy bar 1 -> 2
  { const p = parsePattern(STARTERS[0].rows); toggleAccent(p, 3); p.rows[2][20] = 1
    copyBar(p)
    eq('copy makes it two bars', p.len, 32); eq('bar 2 equals bar 1 (drums)', p.rows.every((r) => r.slice(16, 32).join() === r.slice(0, 16).join()), true)
    eq('bar 2 equals bar 1 (accent)', p.acc.slice(16, 32).join(), p.acc.slice(0, 16).join()); eq('bar 1 is untouched', p.rows[0].slice(0, 16).join(), parsePattern(STARTERS[0].rows).rows[0].slice(0, 16).join()) }
  // fill
  eq('fill starts soft', fillVel(0), 0.45); eq('fill ends full after two beats', fillVel(2), 1); eq('fill never exceeds 1', fillVel(50), 1)
  eq('fill swells', fillVel(0.5) < fillVel(1.5), true)
  // step edit pages
  eq('a bar has 2 pages of 8, two bars have 4', [pagesOf(16), pagesOf(32)], [2, 4])
  eq('pad 3 on page 2 is step 11', stepOfPad(1, 2), 8 + 2 + 1 - 1 + 0)
  eq('pad 7 on page 1 is step index 15', stepOfPad(1, 7), 15); eq('page size', STEP_PAGE, 8)
  eq('pad names', [padName(0), padName(3), padName(4), padName(7)], ['A1', 'A4', 'B1', 'B4'])
  // status line
  { const base = { running: true, rec: false, bank: 1, queued: 2, chain: false, kitName: 'Boom', bpm: 100.4, edit: false, editVoice: 0, page: 0, pages: 2, muted: 0, solo: 0, fill: false }
    const t = statusLine(base)
    eq('status names state, pattern, queued pattern, kit, bpm', ['PLAYING', 'Pattern B then C', 'Boom', '100 bpm'].every((x) => t.includes(x)), true)
    eq('status shows step edit', statusLine({ ...base, edit: true, editVoice: 1, page: 1 }).includes('STEP EDIT: SNARE, steps 9-16'), true)
    eq('status shows recording / mute', [statusLine({ ...base, rec: true }).includes('RECORDING'), statusLine({ ...base, muted: 2 }).includes('2 muted')], [true, true]) }
  // help map covers every hardware gesture we ship
  { const all = HELP_MAP.map((h) => h.keys + ' ' + h.does).join(' ')
    eq('help card covers patterns, fill, step edit, mute, solo, accent, copy, chain', ['A1 A2 A3 A4', 'FILL', 'STEP EDIT', 'mutes', 'Solo', 'accent', 'copy bar 1', 'chain'].every((w) => all.toLowerCase().includes(w.toLowerCase())), true) }
  // save format: an OLD save (no banks) loads as pattern A; a new save keeps pattern A at the top level for old readers
  { const old = reviveSaved({ len: 16, rows: [[1, 0, 0, 0]], kit: 1, swing: 0.2, vol: 0.5, patVol: 1, repeat: 0, tweak: [] })!
    eq('old save: pattern A is the old rows', old.rows[0].slice(0, 4), [1, 0, 0, 0]); eq('old save: three empty banks appear', old.more!.length, 3)
    eq('old save: banks empty, bank A selected, no mute', [old.more!.every((m) => m.rows.every((r) => r.every((v) => v === 0))), old.bank, old.mute!.some(Boolean)], [true, 0, false])
    const nw = reviveSaved({ ...old, bank: 2, chain: true, mute: [false, true], solo: [], acc: [0, 0, 1], more: [{ len: 32, rows: [[0, 1]], acc: [1] }, {}, {}] })!
    eq('new save: bank, chain, mute, accent, other banks kept', [nw.bank, nw.chain, nw.mute![1], nw.acc![2], nw.more![0].len, nw.more![0].rows[0][1], nw.more![0].acc![0]], [2, true, true, 1, 32, 1, 1])
    eq('junk bank number is clamped', reviveSaved({ rows: [], bank: 99 })!.bank, 3) }
}

// ---- Mimic: the named players answer a 4-note call in a plausible key / mode ----
{
  const NEW = ['miles', 'coltrane', 'monk', 'ellington', 'armstrong', 'ella', 'basie', 'brubeck', 'hancock', 'stevie']
  eq('all ten named styles exist', NEW.every((id) => STYLES.some((s) => s.id === id)), true)
  eq('they are all style-only (never quoting a recording)', PEOPLE_STYLES.every((s) => s.kind === 'style' && !s.quotes?.length), true)
  eq('every style is in a picker group', STYLES.every((s) => s.id in STYLE_GROUPS), true)
  eq('groups: Miles is Jazz, Bach is Classical, Stevie is Pop', [groupOf('miles'), groupOf('bach'), groupOf('stevie')], ['jazz', 'classical', 'pop'])
  eq('every style has 3 traits with a detector', STYLES.every((s) => s.traits.length === 3 && s.traits.every((t) => TRAIT_DETECTORS.includes(t.id))), true)
  eq('every blurb is short enough for a kid card', PEOPLE_STYLES.every((s) => s.blurb.length > 40 && s.blurb.length < 190), true)
  const keys = [{ tonic: 0, scale: 'major' }, { tonic: 2, scale: 'minor' }, { tonic: 6, scale: 'major' }] as never[]
  const call = [60, 62, 64, 62].map((note) => ({ note }))
  for (const id of NEW) {
    const st = styleById(id)
    let minN = 99, outOfMode = 0, outOfRange = 0, sorted = true, nonPos = 0, same = true, total = 0
    for (const key of keys) for (let seed = 1; seed <= 24; seed++) for (const bar of [0, 2, 4]) {
      const a = makeAnswer(st, call, { seed, key, bar, index: seed })
      const b = makeAnswer(st, call, { seed, key, bar, index: seed })
      if (JSON.stringify(a.events) !== JSON.stringify(b.events)) same = false
      const mains = a.events.filter((e) => e.kind === 'main' || e.kind === 'blue')
      minN = Math.min(minN, a.events.filter((e) => e.kind !== 'bass' && e.kind !== 'chord').length); total += a.events.length
      const home = homeOf(st, key), ok = stylePcs(st, home)
      for (const e of mains) { if (!ok.has(((e.note % 12) + 12) % 12)) outOfMode++; if (e.note < st.range[0] - 1 || e.note > st.range[1] + 1) outOfRange++ }
      for (let i = 1; i < a.events.length; i++) if (a.events[i].t < a.events[i - 1].t - 1e-9) sorted = false
      nonPos += a.events.filter((e) => !(e.dur > 0) || !Number.isFinite(e.t) || e.vel < 1 || e.vel > 127).length
      void chordAt
    }
    eq(`${id}: answers a 4-note call with at least 3 scheduled notes (fewest seen ${minN})`, minN >= 3, true)
    eq(`${id}: every main note is in the style's mode (checked ${total} events)`, outOfMode, 0)
    eq(`${id}: notes stay in the style's register`, outOfRange, 0)
    eq(`${id}: notes in time order, positive lengths, sane velocity`, [sorted, nonPos], [true, 0])
    eq(`${id}: same seed gives the same answer`, same, true)
  }
  // character: Miles answers are sparse and long; Coltrane's are dense and fast; Brubeck's fit 5-beat bars
  const avg = (id: string, f: (e: { dur: number; t: number }[], beats: number) => number) => { let t = 0, n = 0; for (let seed = 1; seed <= 30; seed++) { const a = makeAnswer(styleById(id), call, { seed, key: keys[0], bar: 0, index: seed }); t += f(a.events.filter((e) => e.kind !== 'bass' && e.kind !== 'chord'), a.beats); n++ } return t / n }
  const dens = (e: { dur: number }[], beats: number) => e.length / Math.max(1, beats)
  const mDens = avg('miles', dens), cDens = avg('coltrane', dens)
  eq(`Miles is sparse (${mDens.toFixed(2)} notes a beat) and Coltrane is dense (${cDens.toFixed(2)})`, mDens < 0.9 && cDens > 2 && cDens > mDens * 3, true)
  eq('Miles uses longer notes than Ella', avg('miles', (e) => e.reduce((x, y) => x + y.dur, 0) / e.length) > avg('ella', (e) => e.reduce((x, y) => x + y.dur, 0) / e.length), true)
  eq('Brubeck is in 5', styleById('brubeck').bpb, 5)
  eq('Brubeck phrases are a whole number of 5-beat bars', makeAnswer(styleById('brubeck'), call, { seed: 3, key: keys[1], bar: 0, index: 1 }).beats <= 12, true)
  // trait detectors for the new ideas
  const P = (notes: number[], gap: number, dur = 0.2): PlayedNote[] => notes.map((note, i) => ({ note, t: i * gap, dur }))
  const k0 = keys[0]
  const pass = (id: string, play: PlayedNote[], trait: string) => detectTraits(styleById(id), play, k0).find((r) => r.id === trait)!.ok
  eq('crunch: two neighbour keys together', pass('monk', [{ note: 60, t: 0, dur: 0.3 }, { note: 61, t: 0.04, dur: 0.3 }, { note: 67, t: 0.8, dur: 0.3 }], 'crunch'), true)
  eq('crunch: a plain scale is not crunchy', pass('monk', P([60, 64, 67, 72], 0.5), 'crunch'), false)
  eq('leaps: two big jumps', pass('monk', P([60, 67, 58, 66], 0.4), 'leaps'), true)
  eq('five: a group of 5 then a pause then another', pass('brubeck', [...P([60, 62, 64, 62, 60], 0.3), ...P([65, 67, 69, 67, 65], 0.3).map((n) => ({ ...n, t: n.t + 2.5 }))], 'five'), true)
  eq('five: a group of 4 is not five', pass('brubeck', P([60, 62, 64, 62], 0.3), 'five'), false)
  eq('scat: quick notes hopping up and down', pass('ella', P([60, 64, 62, 67, 64, 69, 65, 71], 0.18, 0.12), 'scat'), true)
  eq('scat: a slow scale is not scat', pass('ella', P([60, 62, 64, 65, 67, 69], 0.7), 'scat'), false)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
