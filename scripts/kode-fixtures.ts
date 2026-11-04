// Koog Kode language: parser, interpreter, limits, bar-line switching, and "write it for me" quantising. Pure (src/kode/lang), no audio or DOM.
//   npx --no-install tsx scripts/kode-fixtures.ts        (exit 1 on any failure)
import { parseProgram } from '../src/kode/lang/parse'
import { planCycle } from '../src/kode/lang/query'
import { Runner, type Clock, type Sink } from '../src/kode/lang/scheduler'
import { drumRowsToLine, loopNotesToLine, writeFromPlayed, type Played } from '../src/kode/lang/write'
import { EXAMPLES } from '../src/kode/lang/examples'
import { LIMITS, describe, type PlanEvent } from '../src/kode/lang/types'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const notes = (src: string, cyc = 0) => planCycle(parseProgram(src), cyc).map((e) => [e.value, +e.beat.toFixed(3), +e.dur.toFixed(3)])
const firstErr = (src: string) => { const p = parseProgram(src); return p.errors[0] ? { m: p.errors[0].message, s: p.errors[0].start, e: p.errors[0].end, l: p.errors[0].line, c: p.errors[0].col } : null }

// ---- notation features ----
eq('four steps fill the bar', notes('notes "c e g e"'), [[60, 0, 1], [64, 1, 1], [67, 2, 1], [60 + 4, 3, 1]])
eq('rest ~ takes a step', notes('notes "c ~ e ~"'), [[60, 0, 1], [64, 2, 1]])
eq('[ ] subdivides', notes('notes "c [e g]"'), [[60, 0, 2], [64, 2, 1], [67, 3, 1]])
eq('c*2 repeats inside its step', notes('notes "c*2 e"'), [[60, 0, 1], [60, 1, 1], [64, 2, 2]])
eq('[c e]*2', notes('notes "[c e]*2"'), [[60, 0, 1], [64, 1, 1], [60, 2, 1], [64, 3, 1]])
eq('octave numbers: c3 is 48, c4 60, c5 72', notes('notes "c3 c4 c c5"').map((x) => x[0]), [48, 60, 60, 72])
eq('sharps and flats', notes('notes "c# bb f#3 eb"').map((x) => x[0]), [61, 70, 54, 63])
eq('upper case works', notes('notes "C E G"').map((x) => x[0]), [60, 64, 67])
eq('< > alternates per bar: bar 0', notes('notes "<c d e> g"', 0).map((x) => x[0]), [60, 67])
eq('< > alternates per bar: bar 1', notes('notes "<c d e> g"', 1).map((x) => x[0]), [62, 67])
eq('< > alternates per bar: bar 3 wraps', notes('notes "<c d e> g"', 3).map((x) => x[0]), [60, 67])
eq('nested alt advances every n bars', [0, 1, 2, 3].map((c) => notes('notes "<c <d e>>"', c)[0][0]), [60, 62, 60, 64])
eq('<a b>*2 gives each repeat its own pick', notes('notes "<c d>*2"').map((x) => x[0]), [60, 62])
eq('stack plays together', notes('notes "[c,e,g] d"').map((x) => [x[0], x[1]]), [[60, 0], [64, 0], [67, 0], [62, 2]])
eq('drums by name', notes('drums "kick snare hat open clap lotom hitom rim"').map((x) => x[0]), [0, 1, 2, 3, 4, 5, 6, 7])
eq('drum short names', notes('drums "bd sd hh oh"').map((x) => x[0]), [0, 1, 2, 3])
eq('empty bar for an all-rest pattern', notes('notes "~ ~"'), [])

// ---- lines, layers, settings ----
{
  const p = parseProgram('# my song\ntempo 120\nsound "ladder"\nloud 0.5\nnotes "c e"\ndrums "kick ~"   # beat\nnotes "g" sound "bell" loud 1\n')
  eq('no errors', p.errors, [])
  eq('tempo', p.tempo, 120)
  eq('three layers', p.layers.length, 3)
  eq('sound/loud carry down', [p.layers[0].sound, p.layers[0].loud, p.layers[1].sound], ['ladder', 0.5, 'ladder'])
  eq('inline sound/loud win for that layer only', [p.layers[2].sound, p.layers[2].loud], ['bell', 1])
  eq('layer lines', p.layers.map((l) => l.line), [5, 6, 7])
}
eq('piano is the default sound, 0.8 loud', (() => { const p = parseProgram('notes "c"'); return [p.layers[0].sound, p.layers[0].loud] })(), ['piano', 0.8])
eq('koog = piano', parseProgram('sound koog\nnotes "c"').layers[0].sound, 'piano')
eq('sound without quotes', parseProgram('sound ladder\nnotes "c"').layers[0].sound, 'ladder')
eq('# inside quotes is a sharp, not a comment', notes('notes "c# d"  # hi').map((x) => x[0]), [61, 62])
eq('comment-only program is an error', parseProgram('# nothing').errors.length, 1)
eq('last tempo wins', parseProgram('tempo 80\ntempo 90\nnotes "c"').tempo, 90)
eq('other lines still parse around an error', (() => { const p = parseProgram('notes "h"\nnotes "c"'); return [p.errors.length, p.layers.length] })(), [1, 1])

// ---- friendly errors, with exact positions ----
eq("note 'h'", firstErr('notes "c h"'), { m: "I don't know the note 'h'. Notes are a to g.", s: 9, e: 10, l: 1, c: 10 })
eq('error on line 3', firstErr('tempo 100\n\nnotes "c e x"')?.l, 3)
eq('multi-line char offset', firstErr('tempo 100\nnotes "c z"')?.s, 19)
eq('bad octave points at the word', firstErr('notes "c9x"'), { m: "I can't read 'c9x' as a note. After the letter you can add # (sharp) or b (flat), then an octave number 0 to 8, like c#3 or e5.", s: 7, e: 10, l: 1, c: 8 })
eq('drum in a notes line', firstErr('notes "kick"')?.m.startsWith("'kick' is a drum"), true)
eq('unknown drum suggests', firstErr('drums "snar"')?.m, "I don't know the drum 'snar'. Did you mean 'snare'? Drums are kick, snare, hat, open, clap, lotom, hitom, rim.")
eq('unknown word suggests', firstErr('nots "c"')?.m.startsWith("I don't know the word 'nots'. Did you mean 'notes'?"), true)
eq('unknown sound', firstErr('sound "banjo"\nnotes "c"')?.m.startsWith("I don't know the sound 'banjo'."), true)
eq('unclosed quote', firstErr('notes "c e')?.m.startsWith('This quote never closes'), true)
eq('unclosed bracket points at the opener', firstErr('notes "c [e g"'), { m: "This '[' never closes. Add a ']' at the end.", s: 9, e: 10, l: 1, c: 10 })
eq('stray ]', firstErr('notes "c ]"')?.s, 9)
eq('comma outside brackets', firstErr('notes "c,e"')?.m.startsWith('Commas only work inside square brackets'), true)
eq('star needs a number', firstErr('notes "c*"')?.m, 'After * I need a number, like c*2.')
eq('repeat of 0', firstErr('notes "c*0"')?.m.startsWith('You can repeat from 1'), true)
eq('empty brackets', firstErr('notes "c []"')?.m.startsWith('There is nothing inside'), true)
eq('notes need quotes', firstErr('notes c')?.m.startsWith('notes needs a pattern in quotes'), true)
eq('tempo range', firstErr('tempo 500')?.m, 'tempo goes from 40 to 240 beats per minute.')
eq('tempo needs number', firstErr('tempo fast')?.m, 'tempo needs a number, like tempo 100.')
eq('loud range', firstErr('loud 3')?.m, 'loud goes from 0 (silent) to 1 (full).')
eq('two patterns on one line', firstErr('notes "c" drums "kick"')?.m.startsWith('Put each pattern on its own line'), true)
eq('describe() reads well', describe(parseProgram('notes "c h"').errors[0]), "Line 1, character 10: I don't know the note 'h'. Notes are a to g.")
eq('empty program', parseProgram('').errors.length, 1)

// ---- limits: nothing can hang ----
eq('depth limit ok at 4', parseProgram('notes "[[[[c]]]]"').errors.length, 0)
eq('depth limit stops at 5', firstErr('notes "[[[[[c]]]]]"')?.m.startsWith('The brackets are nested too deep'), true)
eq('depth counts < > too', firstErr('notes "<[<[<c>]>]>"')?.m.startsWith('The brackets are nested too deep'), true)
eq('too many sounds in a bar', firstErr('notes "[c*16 c*16 c*16 c*16 c*16 c*16 c*16 c*16 c*16]"')?.m.includes('The limit is 128'), true)
eq('rest bombs hit the work limit', firstErr('notes "[[[~*16]*16]*16]*16"')?.m.startsWith('That pattern is too busy'), true)
eq('rest bomb is instant', (() => { const t = Date.now(); parseProgram('notes "[[[~*16]*16]*16]*16"'); return Date.now() - t < 200 })(), true)
eq('steps limit', firstErr('notes "' + 'c '.repeat(65) + '"')?.m.startsWith('That is too many steps'), true)
eq('program length limit', parseProgram('# ' + 'x'.repeat(LIMITS.src)).errors[0]?.message.startsWith('That is a lot of code'), true)
eq('too many lines', parseProgram(Array.from({ length: 40 }, () => 'tempo 100').join('\n')).errors.length, 1)
eq('line limit counts code lines', parseProgram(Array.from({ length: 40 }, () => 'notes "c"').join('\n')).errors[0]?.message.includes('more than 32 lines') || parseProgram(Array.from({ length: 40 }, () => 'notes "c"').join('\n')).errors[0]?.message.includes('8 layers'), true)
eq('8 layers ok', parseProgram(Array.from({ length: 8 }, () => 'notes "c"').join('\n')).layers.length, 8)
eq('9th layer refused', parseProgram(Array.from({ length: 9 }, () => 'notes "c"').join('\n')).errors[0]?.message.startsWith('Koog Kode plays up to 8 layers'), true)
eq('no code execution: odd text is just an error', parseProgram('notes "c"; process.exit(1)').errors.length > 0, true)
eq('eval text is just an error', parseProgram('eval("1")').errors[0]?.message.startsWith("I don't know the word"), true)
eq('every example parses', EXAMPLES.map((e) => parseProgram(e.code).errors.length), EXAMPLES.map(() => 0))
eq('examples count', EXAMPLES.length >= 6 && EXAMPLES.length <= 8, true)

// ---- the player: bar-line switching on a fake clock ----
{
  const bpm = 120, msb = 500 // 120 bpm: a beat is 500 ms, a bar 2000 ms
  const clock: Clock & { setTo: number[] } = {
    setTo: [], beatPos: (t) => t / msb, timeOfBeat: (b) => b * msb, bpm: () => bpm, setBpm(b) { this.setTo.push(b) },
  }
  const got: { v: number; at: number; beat: number; s: number }[] = []
  let stops = 0
  const sink: Sink = { event: (ev: PlanEvent, at, _d, beat) => { got.push({ v: ev.value, at, beat, s: ev.s }) }, stop: () => { stops++ } }
  const r = new Runner(clock, sink, 100)
  const A = parseProgram('tempo 120\nnotes "c c c c"'), B = parseProgram('notes "g g g g"')
  eq('start at bar 0 when idle on a fresh clock', r.run(A, 0), 0)
  for (let t = 0; t <= 2900; t += 20) r.tick(t)
  eq('A plays 4 notes in bar 0 on their beats', got.filter((g) => g.beat < 4).map((g) => [g.v, g.at]), [[60, 0], [60, 500], [60, 1000], [60, 1500]])
  eq('tempo line equal to the clock does not re-set it', clock.setTo, [])
  // an edit arrives mid-bar-1 (t = 2300 ms = beat 4.6): it must land at bar 2 (beat 8, 4000 ms)
  const sw = r.run(B, 2300)
  eq('switch is the next bar line', sw, 2)
  for (let t = 2920; t <= 4500; t += 20) r.tick(t)
  const bar1 = got.filter((g) => g.beat >= 4 && g.beat < 8), bar2 = got.filter((g) => g.beat >= 8 && g.beat < 12)
  eq('bar 1 is still A (finishes first)', bar1.map((g) => g.v), [60, 60, 60, 60])
  eq('bar 2 is B, exactly on the bar line', bar2.map((g) => [g.v, g.at]), [[67, 4000], [67, 4500]].slice(0, bar2.length))
  eq('no note was scheduled twice', new Set(got.map((g) => g.beat)).size, got.length)
  // a new tempo only applies when its bar arrives
  const C = parseProgram('tempo 150\nnotes "e"')
  const sw2 = r.run(C, 4600)
  eq('tempo change waits for the bar line (bar 3)', [sw2, clock.setTo.length], [3, 0])
  for (let t = 4620; t <= 5950; t += 20) r.tick(t)
  eq('tempo applied at the switch', clock.setTo, [150])
  // stop is silent
  r.stop()
  const n = got.length
  for (let t = 6000; t <= 9000; t += 20) r.tick(t)
  eq('stop: sink told, nothing scheduled afterwards', [stops, got.length], [1, n])
  eq('stop: runner idle', r.isPlaying(), false)
  // two edits before the bar line: the last one wins
  const r2 = new Runner(clock, sink, 100)
  r2.run(A, 10000); r2.run(B, 10010)
  eq('latest edit wins', r2.pending?.prog.src, B.src)
}
{ // never schedules into already-handed-out time: a run right at a bar line goes to the following bar
  const clock: Clock = { beatPos: (t) => t / 500, timeOfBeat: (b) => b * 500, bpm: () => 120, setBpm() {} }
  const ev: number[] = []
  const r = new Runner(clock, { event: (_e, _a, _d, b) => ev.push(b), stop() {} }, 100)
  r.run(parseProgram('notes "c"'), 0)
  for (let t = 0; t <= 1960; t += 20) r.tick(t) // lookahead has reached beat 4.12 -> bar 1's first note (beat 4) is already out
  const at = r.run(parseProgram('notes "d d"'), 1960)
  eq('a switch never lands inside what was already scheduled', at >= 2, true)
}

// ---- Write it for me: quantise a synthetic stream to the tempo grid ----
const key = (pitch: number, t: number): Played => ({ src: 'keys', pitch, vel: 0.8, t })
const pad = (lane: number, t: number): Played => ({ src: 'drums', lane, vel: 0.9, t })
{
  const bpm = 100, msb = 600
  // C E G E on the quarter notes, a little sloppy (+-60 ms)
  const w = writeFromPlayed([key(60, 1000), key(64, 1000 + msb + 55), key(67, 1000 + 2 * msb - 40), key(64, 1000 + 3 * msb + 30)], bpm)
  eq('quarter notes -> "c e g e"', w.lines, ['notes "c e g e"'])
  const w2 = writeFromPlayed([key(60, 0), key(64, msb * 0.5), key(67, msb), key(72, msb * 2.5)], bpm)
  eq('eighths keep their place', w2.lines, ['notes "c e g ~ ~ c5 ~ ~"'])
  const w3 = writeFromPlayed([key(60, 0), key(64, msb * 0.25 + 10), key(67, msb * 0.5)], bpm)
  eq('sixteenths when the playing is fiddly', w3.lines[0].startsWith('notes "c e g'), true)
  const w4 = writeFromPlayed([key(60, 0), key(64, 2), key(67, 4), key(72, msb * 2)], bpm)
  eq('a chord (sounds within 45 ms) becomes [a,b,c]', w4.lines, ['notes "[c,e,g] ~ c5 ~"'])
  const w5 = writeFromPlayed([pad(0, 0), pad(2, msb / 2), pad(1, msb), pad(2, msb * 1.5), pad(0, msb * 2), pad(2, msb * 2.5), pad(1, msb * 3), pad(2, msb * 3.5)], bpm)
  eq('drum pads -> a drums line', w5.lines, ['drums "kick hat snare hat kick hat snare hat"'])
  const mixed = writeFromPlayed([key(60, 0), pad(0, msb), key(64, msb * 2), pad(1, msb * 3)], bpm)
  eq('piano and pads together -> two lines on one time base', mixed.lines, ['notes "c ~ e ~"', 'drums "~ kick ~ snare"'])
  eq('pedal = kick', writeFromPlayed([{ src: 'pedal', vel: 1, t: 0 }, { src: 'pedal', vel: 1, t: msb * 2 }], bpm).lines, ['drums "kick ~ kick ~"'])
  eq('on-screen button is ignored', writeFromPlayed([{ src: 'screen', vel: 1, t: 0 }], bpm).lines, [])
  const two = writeFromPlayed([key(60, 0), key(62, msb), key(64, msb * 4), key(65, msb * 5)], bpm)
  eq('longer than a bar -> <[bar1] [bar2]>', two.lines, ['notes "<[c d ~ ~] [e f ~ ~]>"'])
  eq('result parses back to the same notes', planCycle(parseProgram(two.lines[0]), 1).map((e) => e.value), [64, 65])
  eq('round trip c e g e', planCycle(parseProgram(w.lines[0]), 0).map((e) => [e.value, e.beat]), [[60, 0], [64, 1], [67, 2], [64, 3]])
  eq('round trip drums', planCycle(parseProgram(w5.lines[0]), 0).map((e) => e.value), [0, 2, 1, 2, 0, 2, 1, 2])
  eq('octaves are kept in the text', writeFromPlayed([key(48, 0), key(72, msb)], bpm).lines, ['notes "c3 c5 ~ ~"'])
  eq('sharps are written with #', writeFromPlayed([key(61, 0), key(70, msb)], bpm).lines, ['notes "c# a# ~ ~"'])
  eq('nothing played -> nothing written', writeFromPlayed([], bpm).lines, [])
  eq('very long phrases are cut at 4 bars', writeFromPlayed(Array.from({ length: 30 }, (_, i) => key(60, i * msb * 1)), bpm).dropped > 0, true)
}
{ // Use my loop
  const rows = Array.from({ length: 8 }, () => new Array<number>(32).fill(0))
  ;[0, 4, 8, 12].forEach((s) => { rows[0][s] = 1 }); ;[4, 12].forEach((s) => { rows[1][s] = 1 }); for (let s = 0; s < 16; s += 2) rows[2][s] = 1
  eq('drum pattern -> a drums line (4 steps per beat)', drumRowsToLine(rows, 16), 'drums "[hat,kick] hat [hat,kick,snare] hat [hat,kick] hat [hat,kick,snare] hat"')
  eq('empty drum pattern', drumRowsToLine(Array.from({ length: 8 }, () => new Array<number>(16).fill(0)), 16), null)
  eq('looper layer -> a notes line', loopNotesToLine([{ t: 0, n: 60 }, { t: 1, n: 64 }, { t: 2, n: 67 }, { t: 3, n: 64 }]), 'notes "c e g e"')
  eq('empty looper layer', loopNotesToLine([]), null)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
