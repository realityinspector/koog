// Koogalien core: data invariants, lexicon drift vs LANGUAGE.md, translate / encode / recognize round trips, near misses, modulation, streaming, coverage. Pure, no DOM or audio.
//   npx --no-install tsx scripts/koogalien-fixtures.ts        (exit 1 on any failure)
import { readFileSync } from 'node:fs'
import { ALPHABET, SPELL_END, glyphByChar, glyphByPair } from '../src/koogalien/data/alphabet'
import { ALIENS } from '../src/koogalien/data/aliens'
import { degreeOf, midiOfDegree } from '../src/koogalien/data/degrees'
import { LEXICON, lexByChord, lexByEnglish, lexById } from '../src/koogalien/data/lexicon'
import { DEFAULT_DECODE } from '../src/koogalien/data/types'
import type { Chord, Degree, Dims, Ending, ModSample, Score, Sentence, WordSlot } from '../src/koogalien/data/types'
import { acceptGuesses, confirmAlt, needsConfirm } from '../src/koogalien/engine/confirm'
import { encode } from '../src/koogalien/engine/encode'
import { gloss, sameSentence } from '../src/koogalien/engine/gloss'
import { chordDistance, matchChord } from '../src/koogalien/engine/match'
import { decodeAll, newRecState, pending, step } from '../src/koogalien/engine/recognize'
import type { RecOut } from '../src/koogalien/engine/recognize'
import { coverage, spellSlot, translate, translateAll, translateStream } from '../src/koogalien/engine/translate'
import type { KodeToken } from '../src/kode/kodeCore'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++
  else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, extra = '') => eq(name + extra, !!c, true)

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------- lexicon drift vs LANGUAGE.md ----------
const md = readFileSync(new URL('../docs/koogalien/LANGUAGE.md', import.meta.url), 'utf8')
const mdRows: { word: string; chord: number[] }[] = []
for (const l of md.split('\n')) {
  const m = /^\| ([^|]+) \| ([0-9 +]+) \| [A-G' +]+ \| (.*) \|$/.exec(l)
  if (m && m[1].trim() !== 'Word') mdRows.push({ word: m[1].trim(), chord: m[2].split('+').map(Number) })
}
eq('md table has 120 rows', mdRows.length, 120)
eq('LEXICON has 120 entries', LEXICON.length, 120)
eq('lexicon equals the LANGUAGE.md table (word + chord, in order)', LEXICON.map(e => ({ word: e.en, chord: [...e.chord] })), mdRows)

// ---------- data invariants ----------
const chordKeys = LEXICON.map(e => e.chord.join('+'))
eq('unique chords', new Set(chordKeys).size, LEXICON.length)
eq('unique ids', new Set(LEXICON.map(e => e.id)).size, LEXICON.length)
ok('ids lowercase, no spaces except hyphen', LEXICON.every(e => e.id === e.id.toLowerCase() && !/\s/.test(e.id)))
ok('every chord is 2..4 sorted degrees in 1..8', LEXICON.every(e => e.chord.length >= 2 && e.chord.length <= 4 && e.chord.every((d, i) => d >= 1 && d <= 8 && (i === 0 || d > e.chord[i - 1]))))
eq('closer ids', LEXICON.filter(e => e.kind === 'closer').map(e => e.id), ['question', 'period', 'shout'])
eq('tier-1 words are exactly the first dozen', LEXICON.filter(e => e.tier === 1 && e.kind !== 'closer').map(e => e.en).sort(), ['Koog', 'I', 'friend', 'happy', 'hello', 'love', 'music', 'no', 'say', 'world', 'yes', 'you'].sort())
ok('every entry has emoji, unit 1..9, freq, why', LEXICON.every(e => e.emoji && e.unit >= 1 && e.unit <= 9 && e.freq && e.why))
ok('freq ranks are unique', new Set(LEXICON.map(e => e.freq)).size === LEXICON.length)
eq('26 letters', ALPHABET.length, 26)
ok('all 26 letters reachable by (row, col)', 'abcdefghijklmnopqrstuvwxyz'.split('').every(c => { const g = glyphByChar(c); return !!g && glyphByPair(g.row, g.col)?.ch === c && g.row >= 1 && g.row <= 7 && g.col >= 1 && g.col <= 4 }))
eq('h = (2,4) and w = (6,3) and d = (1,4)', ['h', 'w', 'd'].map(c => { const g = glyphByChar(c)!; return [g.row, g.col] }), [[2, 4], [6, 3], [1, 4]])
eq('three voices with distinct patches', new Set(ALIENS.map(a => JSON.stringify(a.patch))).size, 3)
ok('voice centres are C so white keys stay white', ALIENS.every(a => a.centre % 12 === 0))
eq('lookups', [lexByEnglish('Hello')?.id, lexByEnglish('hi')?.id, lexById('world')?.chord.join(), lexByChord([1, 5, 6])?.en, lexByEnglish('koog alien')?.id, lexByEnglish('Koogalien')?.id], ['hello', 'hello', '1,5,8', 'Koog', 'koog-alien', 'koogalien'])
eq('reserved names stay reserved', [lexByChord([1, 5, 6, 7])?.en, lexByChord([1, 5, 6, 8])?.en], ['Koogalien', 'Koog Alien'])

// degrees (lead decision 3)
eq('white keys C..C to 1..8', [60, 62, 64, 65, 67, 69, 71, 72].map(m => degreeOf(m, 60)), [1, 2, 3, 4, 5, 6, 7, 8])
eq('other octaves fold', [48, 74, 83, 36].map(m => degreeOf(m, 60)), [1, 2, 7, 1])
eq('black keys ignored', [61, 63, 66, 68, 70].map(m => degreeOf(m, 60)), [null, null, null, null, null])
eq('midiOfDegree', [1, 4, 8].map(d => midiOfDegree(d as Degree, 60)), [60, 65, 72])

// ---------- match ----------
eq('distance 1 5 8 vs 1 5 7', chordDistance([1, 5, 8], [1, 5, 7]), 0.5)
eq('exact match is 1', matchChord([1, 5, 8])[0], { id: 'world', confidence: 1 })
eq('one key off gives maybe-range alts, max 3', (() => { const m = matchChord([2, 3, 4, 5]); return [m[0].confidence >= 0.5 && m[0].confidence < 0.85, m.length <= 3] })(), [true, true])
eq('a free 4-key set is only a maybe (every near word offered)', matchChord([2, 3, 4, 5]).length, 3)
eq('a lone key matches no word (it is a digit)', matchChord([3]), [])

// ---------- translate ----------
const hw = translate('hello world.')
eq('translate hello world.', [hw.words.map(w => w.id), hw.end, gloss(hw)], [['hello', 'world'], '.', 'hello world'])
eq('translate question and shout', [translate('hello?').end, translate('hello!').end, translate('hello').end], ['?', '!', '.'])
eq('numbers', translate('3 2 1').words.map(w => [w.kind, w.en]), [['digit', '3'], ['digit', '2'], ['digit', '1']])
eq('zero nine ten', translate('0 9 10').words.map(w => w.id), ['zero', 'nine', 'ten'])
eq('number words', translate('two friends').words.map(w => w.en), ['2', 'friend'])
const maya = translate('Maya')
eq('unknown word is spelled', [maya.words[0].kind, maya.words[0].en, maya.words[0].chords.length], ['spelled', 'Maya', 1 + 8 + 1])
eq('spelled chords: spell, hops, end', [maya.words[0].chords[0], maya.words[0].chords[1], maya.words[0].chords[2], maya.words[0].chords[9]], [[1, 2], [4], [1], [5, 8]])
eq('the word "spell" is spelled, never the control chord', translate('spell').words[0].kind, 'spelled')
eq('two-word entry', translate('Koog Alien!').words.map(w => w.id), ['koog-alien'])
eq('accents and apostrophes survive', [spellSlot("o'neil")?.en, spellSlot('café')?.en], ["o'neil", 'cafe'])
eq('nothing spellable gives null', spellSlot('---'), null)
eq('translate is deterministic', JSON.stringify(translate('I love music. You sing, Zib!')), JSON.stringify(translate('I love music. You sing, Zib!')))

// streaming
const fable = 'A Fox one day spied a beautiful bunch of ripe grapes hanging from a vine trained along the branches of a tree. The grapes seemed ready to burst with juice, and the Fox\'s mouth watered as he gazed longingly at them. The bunch hung from a high branch, and the Fox had to jump for it. The first time he jumped he missed it by a long way. So he walked off a short distance and took a running leap, only to fall short once more. Again and again he tried, but in vain. Now he sat down and looked at the grapes in disgust. "What a fool I am," he said. "Here I am wearing myself out to get a bunch of sour grapes that are not worth gaping for." And off he walked very, very scornfully.'
const sens = translateAll(fable)
eq('fable splits into sentences', sens.length, 10)
eq('streaming equals batch', JSON.stringify([...translateStream(fable)]), JSON.stringify(sens))
eq('sentence endings', sens.map(s => s.end), Array(10).fill('.'))
eq('decimals do not split', translateAll('It cost 3.5 dollars. Yes.').length, 2)
const cov = coverage(fable)
ok('coverage counts known and spelled', cov.known > 0 && cov.spelled > 0 && Math.abs(cov.ratio - cov.known / (cov.known + cov.spelled)) < 1e-9, ' ' + JSON.stringify(cov))
eq('coverage of pure lexicon text is 1', coverage('hello world. I love music!').ratio, 1)
eq('coverage of an empty text', coverage(''), { known: 0, spelled: 0, ratio: 1 })
eq('every English word translates (no throw, no empty)', ['antidisestablishmentarianism', 'xylophone', 'qwerty'].every(w => translate(w).words.length === 1), true)
const longText = Array.from({ length: 2000 }, (_, i) => 'hello world ' + (i % 2 ? 'zork' : 'friend') + '.').join(' ')
eq('no length limit in translate (2000 sentences)', translateAll(longText).length, 2000)

// ---------- encode ----------
const sc = encode(hw, { bpm: 100 })
eq('hello world score: first chord at beat 0', [sc.chords[0].at, sc.chords[0].degrees, sc.chords[0].midi], [0, [1, 6], [60, 69]])
eq('hello world score: word starts, closer', [sc.wordStarts, sc.chords[2].degrees, sc.chords.length], [[0, 1.75], [5, 8], 3])
ok('score velocity under the 0.85 cap', encode(translate('hello world!'), { bpm: 100 }).chords.every(c => c.vel <= 0.85))
eq('? lifts the last word once, encode owns it', (() => { const q = encode(translate('hello world?'), { bpm: 100 }); const w = q.chords.find(c => c.word === 1)!; return [q.liftApplied, q.liftAt, w.midi, w.degrees] })(), [true, 1.75, [62, 69, 74], [1, 5, 8]])
eq('no lift for a statement', encode(hw, { bpm: 100 }).liftApplied, undefined)
eq('alien centre transposes', encode(hw, { bpm: 100, alien: 'pip' }).chords[0].midi, [72, 81])
eq('encode is stable', JSON.stringify(encode(maya, { bpm: 90 })), JSON.stringify(encode(maya, { bpm: 90 })))

// ---------- token synthesis (the player) ----------
interface PlayOpts { jitter?: number; velNoise?: number; seed?: number; homeC?: number; padLanes?: boolean; t0?: number }
function playTokens(sc: Score, o: PlayOpts = {}): { tokens: KodeToken[]; mods: ModSample[] } {
  const r = rng(o.seed ?? 1), beat = 60000 / sc.bpm, home = o.homeC ?? 60, t0 = o.t0 ?? 1000
  const tokens: KodeToken[] = [], mods: ModSample[] = []
  for (const ev of sc.chords) {
    ev.degrees.forEach((d, k) => {
      const t = t0 + ev.at * beat + (k === 0 ? 0 : Math.round(r() * (o.jitter ?? 0)))
      const vel = Math.max(0.05, Math.min(1, ev.vel * (1 + (r() * 2 - 1) * (o.velNoise ?? 0))))
      const tok: KodeToken & { dims?: Dims } = o.padLanes
        ? { src: 'drums', value: d - 1, lane: d - 1, vel, t }
        : { src: 'keys', value: midiOfDegree(d, home), pitch: midiOfDegree(d, home), vel, t }
      if (k === 0 && ev.dims) tok.dims = ev.dims
      tokens.push(tok)
    })
  }
  for (const m of sc.mods) {
    for (let t = 0; t <= m.dur * beat; t += 100) mods.push({ kind: 'wheel', value: m.mod.depth, t: t0 + m.at * beat + t })
    mods.push({ kind: 'wheel', value: 0, t: t0 + (m.at + m.dur) * beat + 50 })
  }
  return { tokens, mods }
}
const back = (s: Sentence, o: PlayOpts = {}, d: object = {}) => { const sc2 = encode(s, { bpm: 100 }); const p = playTokens(sc2, o); return decodeAll(p.tokens, p.mods, { bpm: 100, ...d }) }

eq('hello world round trip (clean)', sameSentence(back(hw), hw), true)
eq('hello world: a pad player reads the same', sameSentence(back(hw, { padLanes: true }), hw), true)
eq('hello world decoded: confidence 1, ok', back(hw).words.map(w => [w.status, w.confidence]), [['ok', 1], ['ok', 1]])

// every lexicon word round trips (with noise)
let lexBad = ''
for (const e of LEXICON) {
  if (e.kind === 'closer' || e.kind === 'control') continue
  const s = translate(e.en + '.')
  const b = back(s, { jitter: 30, velNoise: 0.2, seed: 7 })
  if (!sameSentence(b, s)) lexBad += e.id + ' '
}
eq('every lexicon word round trips with 30 ms jitter and 20% velocity noise', lexBad, '')
// closers
for (const [txt, end] of [['hello.', '.'], ['hello?', '?'], ['hello!', '!']] as [string, Ending][]) eq('closer ' + end, back(translate(txt), { jitter: 25, velNoise: 0.2 }).end, end)
// spelled
eq('spelled maya round trips', sameSentence(back(translate('Maya is happy.'), { jitter: 20 }), translate('Maya is happy.')), true)
eq('spelled word text', back(translate('Maya.')).words[0].en, 'maya')
eq('every letter spells', (() => { const s = translate('abcdefghijklm nopqrstuvwxyz'); return back(s).words.map(w => w.en).join('') })(), 'abcdefghijklmnopqrstuvwxyz')
eq('spelled apostrophe', back(translate("o'neil")).words[0].en, "o'neil")

// 50 seeded random sentences with noise
{
  const r = rng(99)
  const pool = LEXICON.filter(e => e.kind !== 'closer' && e.kind !== 'control')
  const names = ['Maya', 'Zib', 'Oscar', 'Lu', 'Quentin']
  let bad = 0
  for (let n = 0; n < 50; n++) {
    const words: WordSlot[] = []
    const len = 1 + Math.floor(r() * 6)
    for (let k = 0; k < len; k++) {
      const x = r()
      let w: WordSlot
      if (x < 0.12) w = translate(String(1 + Math.floor(r() * 8))).words[0]
      else if (x < 0.22) w = translate(names[Math.floor(r() * names.length)]).words[0]
      else w = translate(pool[Math.floor(r() * pool.length)].en).words[0]
      const y = r()
      w.tone = { loud: y < 0.2 ? 'soft' : y < 0.4 ? 'loud' : 'normal', mods: r() < 0.2 ? [{ name: 'wobble', depth: 0.8 }] : [] }
      words.push(w)
    }
    const s: Sentence = { v: 1, words, end: (['.', '?', '!'] as Ending[])[Math.floor(r() * 3)] }
    const b = back(s, { jitter: 30, velNoise: 0.2, seed: n + 1 })
    if (!sameSentence(b, s)) { bad++; if (bad < 4) console.log('  mismatch', JSON.stringify(s.words.map(w => [w.en, w.tone])), JSON.stringify(b.words.map(w => [w.en, w.tone, w.status]))) }
  }
  eq('50 random sentences round trip with noise (tone included)', bad, 0)
}

// ---------- chord window edges ----------
const tk = (pitch: number, t: number, vel = 0.5): KodeToken => ({ src: 'keys', value: pitch, pitch, vel, t })
const gotWords = (tokens: KodeToken[], o = {}) => decodeAll(tokens, [], { bpm: 100, ...o }).words.map(w => w.id ?? w.en)
eq('60 ms apart is one chord (hello)', gotWords([tk(60, 0), tk(69, 60)]), ['hello'])
eq('70 ms apart is still one chord', gotWords([tk(60, 0), tk(69, 70)]), ['hello'])
eq('150 ms apart splits into two digits', gotWords([tk(60, 0), tk(69, 150)]), ['1', '6'])
eq('chord window is configurable', gotWords([tk(60, 0), tk(69, 110)], { chordMs: 120 }), ['hello'])
eq('black keys are ignored', gotWords([tk(60, 0), tk(61, 10), tk(69, 20)]), ['hello'])
eq('other octaves fold into the same chord', gotWords([tk(48, 0), tk(81, 20)]), ['hello'])
eq('pad lanes behave as keys', decodeAll([{ src: 'drums', value: 0, lane: 0, vel: 0.5, t: 0 }, { src: 'dj', value: 5, lane: 5, vel: 0.5, t: 10 }], [], { bpm: 100 }).words.map(w => w.id), ['hello'])
// boundaries
const live = (inputs: Parameters<typeof step>[1][], o = {}) => { let st = newRecState({ bpm: 100, ...o }); const out: RecOut[] = []; for (const i of inputs) { const r = step(st, i); st = r.state; out.push(...r.out) } return { st, out } }
const pedal = (t: number): KodeToken => ({ src: 'pedal', value: 0, vel: 1, t })
eq('a pedal tap closes the chord: next key within 70 ms starts a new word', gotWords([tk(60, 0), pedal(20), tk(69, 40)]), ['1', '6'])
{
  const r = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'token', token: pedal(100) }, { type: 'token', token: pedal(600) }])
  eq('double pedal ends the sentence with a full stop', r.out.filter(o => o.type === 'sentence').map(o => o.type === 'sentence' && [o.sentence.end, o.sentence.words.map(w => w.id)]), [['.', ['hello']]])
}
{
  const r = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'tick', t: 100 }, { type: 'tick', t: 1100 }])
  eq('a 2-beat rest acts like a full stop (not before)', r.out.filter(o => o.type === 'sentence').length, 0)
  const r2 = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'tick', t: 1100 }])
  eq('before 2 beats: still waiting', r2.out.filter(o => o.type === 'sentence').length, 0)
  const r3 = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'tick', t: 1300 }, { type: 'tick', t: 2300 }])
  eq('after 2 beats: sentence ends with .', r3.out.filter(o => o.type === 'sentence').map(o => o.type === 'sentence' && o.sentence.end), ['.'])
}
{ // live feedback: a chord event appears when the window passes
  const r = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'tick', t: 40 }])
  eq('window still open at 40 ms: nothing out', r.out.length, 0)
  eq('pending shows the open chord', pending(r.st).chords, [[1, 6]])
  const r2 = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 20) }, { type: 'tick', t: 100 }])
  eq('window closed at 100 ms: chord then word', r2.out.map(o => o.type), ['chord', 'word'])
}
// chord builder
{
  const r = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 5000) }, { type: 'commit', t: 6000 }], { chordBuilder: true })
  eq('chord builder: keys seconds apart commit as one chord', r.out.filter(o => o.type === 'word').map(o => o.type === 'word' && o.word.id), ['hello'])
  const r2 = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 50) }, { type: 'commit', t: 60 }])
  eq('commit closes a normal chord early', r2.out.filter(o => o.type === 'word').length, 1)
}
// on-screen Space / End
{
  const r = live([{ type: 'token', token: tk(60, 0) }, { type: 'token', token: tk(69, 10) }, { type: 'boundary', t: 50 }, { type: 'token', token: tk(60, 60) }, { type: 'token', token: tk(65, 70) }, { type: 'end', t: 100, ending: '?' }])
  eq('Space then End(?)', r.out.filter(o => o.type === 'sentence').map(o => o.type === 'sentence' && [o.sentence.end, o.sentence.words.map(w => w.id)]), [['?', ['hello', 'is']]])
}

// ---------- spell mode details ----------
const seq = (degs: number[], t0 = 0, gap = 400): KodeToken[] => degs.map((d, i) => tk(midiOfDegree(d as Degree, 60), t0 + i * gap))
const chordAt = (ds: number[], t: number): KodeToken[] => ds.map((d, k) => tk(midiOfDegree(d as Degree, 60), t + k * 5))
{
  // h = 2,4 ; backspace lone 8 ; then e = 2,1 ; end 5+8 ; period 5+8
  const toks = [...chordAt([1, 2], 0), ...seq([2, 4, 8, 2, 1], 600), ...chordAt([5, 8], 3000), ...chordAt([5, 8], 3600)]
  const s = decodeAll(toks, [], { bpm: 100 })
  eq('backspace removes the last letter', [s.words[0].en, s.words[0].kind, s.end], ['', 'spelled', '.'].slice(0, 0).concat(['e', 'spelled', '.']))
}
{
  const r = live([...chordAt([1, 2], 0), ...seq([2], 600)].map(token => ({ type: 'token' as const, token })).concat([{ type: 'tick' as const, t: 800 } as never]))
  eq('half a letter is pending', [pending(r.st).spelling, pending(r.st).half], [true, 2])
  const r2 = live([...chordAt([1, 2], 0), ...seq([2, 8], 600)].map(token => ({ type: 'token' as const, token })).concat([{ type: 'tick' as const, t: 1100 } as never]))
  eq('lone 8 with a half letter drops the half', pending(r2.st).half, null)
  const r3 = live([...chordAt([1, 2], 0), ...seq([2, 4], 600)].map(token => ({ type: 'token' as const, token })).concat([{ type: 'tick' as const, t: 600 + 400 + 3000 } as never]))
  eq('a 2-beat rest ends spell mode', [pending(r3.st).spelling, r3.out.filter(o => o.type === 'word').length], [false, 1])
}
eq('spell letters limit (20)', decodeAll([...chordAt([1, 2], 0), ...seq(Array.from({ length: 50 }, (_, i) => (i % 2 ? 1 : 1)), 600, 100)], [], { bpm: 100 }).words[0].en.length, 20)
eq('letter emitted when the column closes', (() => { const r = live([...chordAt([1, 2], 0), ...seq([2, 4], 600), ...seq([1], 3000)].map(token => ({ type: 'token' as const, token }))); return r.out.filter(o => o.type === 'letter').map(o => o.type === 'letter' && o.ch) })(), ['h'])

// ---------- near misses (lead decision 2) ----------
{
  const s = decodeAll(chordAt([2, 3, 4, 5], 0), [], { bpm: 100 })
  const w = s.words[0]
  eq('a near miss gives maybe with alternatives', [w.status, w.id, w.confidence >= 0.5 && w.confidence < 0.85, (w.alts?.length ?? 0) > 0, w.alts?.some(a => a.id === w.id)], ['maybe', w.id, true, true, true])
  ok('maybe waits for the kid', needsConfirm(s))
  const c = confirmAlt(s, 0, w.alts![1].id)
  eq('confirming an alternative resolves it', [c.words[0].id, c.words[0].status, needsConfirm(c)], [w.alts![1].id, 'ok', false])
  eq('auto-accept off by default; accept keeps the guess', acceptGuesses(s).words[0].status, 'ok')
  const auto = decodeAll(chordAt([2, 3, 4, 5], 0), [], { bpm: 100, autoAccept: true })
  eq('autoAccept takes the best guess', [auto.words[0].status, auto.words[0].id], ['ok', w.id])
  const g = decodeAll(chordAt([1, 2, 3, 4, 5, 6, 7, 8], 0), [], { bpm: 100 }).words[0]
  eq('garbage gives unknown', [g.status, g.kind], ['unknown', 'unknown'])
  eq('maybe never changes the sentence silently: the played chord is kept', s.words[0].chords, [[2, 3, 4, 5]])
}

// ---------- modulation: wobble from CC1 ----------
{
  const wob = (vals: [number, number][]) => decodeAll([tk(60, 1000), tk(69, 1010)], vals.map(([value, t]) => ({ kind: 'wheel' as const, value, t })), { bpm: 100 }).words[0].tone.mods
  eq('wheel above 0.4 for 250 ms attaches wobble', wob([[0.8, 1000], [0.8, 1150], [0.8, 1300], [0.8, 1400]]).map(m => m.name), ['wobble'])
  eq('wheel held only 100 ms does not', wob([[0.8, 1000], [0.8, 1100], [0, 1150]]), [])
  eq('wheel below threshold does not', wob([[0.3, 1000], [0.3, 1300], [0.3, 1500]]), [])
  eq('slider counts too', decodeAll([tk(60, 1000), tk(69, 1010)], [0.9, 0.9, 0.9].map((value, k) => ({ kind: 'slider' as const, value, t: 1000 + k * 200 })), { bpm: 100 }).words[0].tone.mods.length, 1)
  eq('loud velocity reads loud, soft reads soft', [decodeAll([tk(60, 0, 0.9), tk(69, 5, 0.9)]).words[0].tone.loud, decodeAll([tk(60, 0, 0.1), tk(69, 5, 0.1)]).words[0].tone.loud], ['loud', 'soft'])
}

// ---------- reserved dimensions pass through (THESIS: literature) ----------
{
  const dims: Dims = { bass: 55, durationClass: 'long', dyn: 'loud', arp: 'up', rhythm: 'r1', keyCenter: 7, mode: 'minor', register: -1, tempo: 80, mod: 'x' }
  const s = translate('hello world.')
  s.words[0] = { ...s.words[0], ...dims }
  const sc2 = encode(s, { bpm: 100 })
  eq('encode keeps dims on the stroke', sc2.chords[0].dims, dims)
  const b = back(s)
  const w0 = b.words[0] as WordSlot
  eq('dims survive encode -> tokens -> decode', [w0.durationClass, w0.dyn, w0.arp, w0.rhythm, w0.keyCenter, w0.mode, w0.register, w0.tempo, w0.mod], ['long', 'loud', 'up', 'r1', 7, 'minor', -1, 80, 'x'])
  eq('raw bass note is kept from the lowest pitch', b.words[1].bass, 60)
  eq('plain words carry no dims', Object.keys(encode(translate('hello'), { bpm: 100 }).chords[0]).includes('dims'), false)
  ok('dims never change matching', sameSentence(b, s))
}

// ---------- performance ----------
{
  const r = rng(5)
  const toks: KodeToken[] = []
  let t = 0
  for (let i = 0; i < 10000; i++) { t += 5 + Math.floor(r() * 300); toks.push(r() < 0.1 ? pedal(t) : tk(48 + Math.floor(r() * 40), t, r())) }
  const t0 = performance.now()
  const s = decodeAll(toks, [], { bpm: 100 })
  const ms = performance.now() - t0
  ok('10,000 random tokens decode under 200 ms (' + ms.toFixed(0) + ' ms)', ms < 200)
  ok('result is sane', Array.isArray(s.words))
}
ok('DEFAULT_DECODE is sane', DEFAULT_DECODE.chordMs === 70 && DEFAULT_DECODE.autoAccept === false)

console.log(fails ? `\nkoogalien fixtures: ${fails} FAILED, ${passes} passed` : `koogalien fixtures: all ${passes} passed`)
process.exit(fails ? 1 : 0)
