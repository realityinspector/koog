// Koogalien code language checks: print/parse round trip, diagnostics, let/say joins, quoted spelling, share links, toKode, suggest.
//   npx --no-install tsx scripts/koogalien-lang-fixtures.ts        (exit 1 on any failure)
import { parse } from '../src/koogalien/lang/parse'
import { print } from '../src/koogalien/lang/print'
import { lower } from '../src/koogalien/lang/lower'
import { toShare, fromShare } from '../src/koogalien/lang/share'
import { toKode } from '../src/koogalien/lang/toKode'
import { closestWord } from '../src/koogalien/lang/suggest'
import { LEXICON } from '../src/koogalien/data/lexicon'
import { LIMITS, type Sentence, type WordSlot } from '../src/koogalien/data/types'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)

let seed = 12345
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]
const words = LEXICON.filter((e) => e.kind !== 'closer' && e.kind !== 'control' && e.id !== 'spell')

function randSentence(): Sentence {
  const n = 1 + Math.floor(rnd() * 6)
  const ws: WordSlot[] = []
  for (let i = 0; i < n; i++) {
    const r = rnd()
    let w: WordSlot
    if (r < 0.7) { const e = pick(words); w = { kind: 'word', id: e.id, en: e.en, chords: [e.chord], tone: { loud: 'normal', mods: [] }, confidence: 1, status: 'ok' } }
    else if (r < 0.85) { const d = 1 + Math.floor(rnd() * 8); w = { kind: 'digit', id: null, en: String(d), chords: [[d as 1]], tone: { loud: 'normal', mods: [] }, confidence: 1, status: 'ok' } }
    else { const len = 1 + Math.floor(rnd() * 8); let t = ''; for (let k = 0; k < len; k++) t += String.fromCharCode(97 + Math.floor(rnd() * 26)); if (rnd() < 0.5) t = t[0].toUpperCase() + t.slice(1); w = { kind: 'spelled', id: null, en: t, chords: [], tone: { loud: 'normal', mods: [] }, confidence: 1, status: 'ok' } }
    const q = rnd()
    if (q < 0.15) w.tone.loud = 'soft'; else if (q < 0.3) w.tone.loud = 'loud'
    if (rnd() < 0.2) w.tone.mods = [{ name: 'wobble', depth: Math.round(rnd() * 100) / 100 }]
    ws.push(w)
  }
  return { v: 1, words: ws, end: pick(['.', '?', '!'] as const) }
}

// ---- canonical form
{
  const p = parse('say hello world.')
  eq('hello world no errors', p.errors, [])
  eq('hello world prints bare', print(p.sentence!), 'say hello world.')
  eq('hello world words', p.sentence!.words.map((w) => w.id), ['hello', 'world'])
  eq('quoted whole text accepted', print(parse('say "hello world".').sentence!), 'say hello world.')
  eq('no closer defaults to period', print(parse('say hello').sentence!), 'say hello.')
  eq('question', parse('say are you happy?').errors.length > 0 || print(parse('say you happy?').sentence!), 'say you happy?')
  eq('case insensitive', print(parse('SAY Hello WORLD!').sentence!), 'say hello world!')
  eq('comment ignored', print(parse('# hi\nsay hello. # trailing').sentence!), 'say hello.')
  eq('digits', print(parse('say 3 2 1!').sentence!), 'say 3 2 1!')
  eq('two-word entry', print(parse('say Koog Alien.').sentence!), 'say Koog Alien.')
  eq('wobble default', print(parse('say hello~wobble.').sentence!), 'say hello~wobble.')
  eq('wobble depth', print(parse('say hello~wobble=0.3.').sentence!), 'say hello~wobble=0.3.')
  eq('soft + wobble', print(parse('say hello ~soft~wobble.').sentence!), 'say hello~soft~wobble.')
}

// ---- quoted spelling
{
  const p = parse('say hello "Maya".')
  eq('spelled kind', p.sentence!.words.map((w) => w.kind), ['word', 'spelled'])
  eq('spelled keeps case', p.sentence!.words[1].en, 'Maya')
  eq('spelled prints quoted', print(p.sentence!), 'say hello "Maya".')
  ok('spelled chords start with spell chord', p.sentence!.words[1].chords.length >= 3)
  eq('quoted known word stays spelled', parse('say "love".').sentence!.words[0].kind, 'spelled')
  eq('long spell capped', parse('say "' + 'a'.repeat(30) + '".').sentence!.words[0].en.length, LIMITS.lettersPerSpell)
}

// ---- let / say
{
  const p = parse('let hi = hello friend.\nsay hi world.')
  eq('let substitution', print(lower(p)), 'say hello friend world.')
  eq('vars recorded', Object.keys(p.vars), ['hi'])
  eq('says join', print(parse('say hello. say world?').sentence!), 'say hello world?')
  eq('same line statements', parse('say hello. say world.').says.length, 2)
  eq('var with mod', print(parse('let a = hello world.\nsay a~soft.').sentence!), 'say hello~soft world~soft.')
  eq('let alone has no sentence', parse('let a = hello.').sentence, null)
}

// ---- errors: exact positions and hints
{
  let p = parse('say hello wrold.')
  eq('unknown word diag', [p.errors.length, p.errors[0].start, p.errors[0].end, p.errors[0].line, p.errors[0].col], [1, 10, 15, 1, 11])
  ok('hint suggests world', /Did you mean "world"/.test(p.errors[0].hint ?? ''), p.errors[0].hint)
  ok('hint teaches quotes', /quotes/.test(p.errors[0].hint ?? ''))
  eq('unknown slot kept', p.sentence!.words[1].status, 'unknown')
  p = parse('say hello\nsay blorgx.')
  eq('error on line 2', [p.errors[0].line, p.errors[0].col], [2, 5])
  p = parse('hello world.')
  eq('missing say', [p.errors[0].start, p.errors[0].end], [0, 5]); ok('missing say hint', /say hello/.test(p.errors[0].hint ?? '') || /Start with say/.test(p.errors[0].hint ?? ''))
  p = parse('say "oops.')
  eq('unclosed quote', p.errors[0].message, 'This quote never closes.')
  p = parse('say.')
  eq('say nothing', p.errors[0].message, 'Say what?')
  p = parse('say hello~sparkle.')
  ok('unknown mod', p.errors.length === 1 && p.errors[0].start === 9, JSON.stringify(p.errors))
  p = parse('say hello~sweep.')
  ok('reserved mod', /later/.test(p.errors[0]?.message ?? ''))
  p = parse('say 12.')
  ok('multi digit', p.errors.length === 1)
  p = parse('let = hello.')
  eq('let needs name', p.errors[0].message, 'let needs a name.')
  p = parse('say ' + 'hello '.repeat(40) + '.')
  eq('word cap', p.sentence!.words.length, LIMITS.wordsPerSentence); ok('word cap diag', p.errors.length >= 1)
  p = parse('say hello. '.repeat(100))
  ok('code cap diag', p.errors.some((e) => /characters/.test(e.message)))
  ok('never throws on junk', (() => { for (let i = 0; i < 500; i++) { let s = ''; const n = Math.floor(rnd() * 60); for (let k = 0; k < n; k++) s += String.fromCharCode(Math.floor(rnd() * 200)); parse(s) } return true })())
}

// ---- round trip
{
  let bad = 0
  for (let i = 0; i < 100; i++) {
    const s = randSentence()
    const a = print(s)
    const p = parse(a)
    const b = p.sentence ? print(p.sentence) : '(null)'
    if (a !== b || p.errors.length) { bad++; if (bad < 4) console.log('  roundtrip', a, '=>', b, JSON.stringify(p.errors)) }
  }
  eq('print(parse(print(s))) === print(s) x100', bad, 0)
}

// ---- share links
{
  const s = parse('say hello "Maya" 3~wobble!').sentence!
  const code = toShare(s)
  ok('share prefix', code.startsWith('v1~'))
  ok('share cap', code.length <= LIMITS.shareChars)
  eq('share round trip', print(fromShare(code).sentence!), print(s))
  let threw = false
  try { toShare(parse('say ' + 'f'.repeat(0) + '"' + 'x'.repeat(20) + '" ' + '"' + 'y'.repeat(20) + '" '.repeat(1) + '"' + 'z'.repeat(20) + '"' + ' "abcdefghijklmnopqrst" '.repeat(14) + '.').sentence!) } catch (e) { threw = e instanceof RangeError }
  ok('too long share throws RangeError', threw)
  let ok1000 = true
  for (let i = 0; i < 1000; i++) {
    let g = ''
    const n = Math.floor(rnd() * 80)
    for (let k = 0; k < n; k++) g += String.fromCharCode(Math.floor(rnd() * 400))
    if (i % 3 === 0) g = 'v1~' + g
    if (i % 7 === 0) g = 'v1~%E0%A4%A' + g
    try { const r = fromShare(g); if (!r || !Array.isArray(r.errors)) ok1000 = false } catch { ok1000 = false }
  }
  ok('fromShare never throws on 1000 garbage strings', ok1000)
  ok('fromShare non-string', (() => { try { fromShare(undefined as unknown as string); fromShare(null as unknown as string); return true } catch { return false } })())
  eq('newer version refused', fromShare('v9~say%20hi.').sentence, null)
  ok('oversize refused', fromShare('v1~' + 'a'.repeat(500)).errors.length === 1)
}

// ---- toKode
{
  const sc = { v: 1, bpm: 100, beats: 3, wordStarts: [0, 2], mods: [], chords: [
    { word: 0, degrees: [1, 6] as const, midi: [60, 69], at: 0, dur: 1, vel: 0.7 },
    { word: 1, degrees: [1, 5, 8] as const, midi: [60, 67, 72], at: 2, dur: 1, vel: 0.7 }] }
  eq('toKode one bar', toKode(sc), 'tempo 100\nnotes "[c4,a4] ~ [c4,g4,c5] ~"\n')
  eq('toKode empty', toKode({ ...sc, chords: [] }), 'tempo 100\n')
  ok('toKode two bars', toKode({ ...sc, chords: [...sc.chords, { ...sc.chords[0], at: 5 }] }).includes('<['))
}

// ---- suggest
{
  eq('wrold', closestWord('wrold')?.id, 'world')
  eq('hapy', closestWord('hapy')?.id, 'happy')
  eq('far away', closestWord('qwertyuiop'), null)
  eq('empty', closestWord(''), null)
}

console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `PASS ${passes} checks`)
process.exit(fails ? 1 : 0)
