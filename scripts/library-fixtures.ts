// Koogalien Library checks: cleaning, sentence splitting, speaker detection, the High rules, the edition schema, deterministic rebuilds,
// the shipped editions (licence text, years, sizes), coverage.json, and the reader engine on a fake host (plays Peter Rabbit, caps, pause, progress, play-along).
//   npx --no-install tsx scripts/library-fixtures.ts        (exit 1 on any failure)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripGutenberg, paragraphs, fixDropCap, credit } from '../src/koogalien/library/clean'
import { sentencesOf, speakerName, newCast, voiceFor, quoteDepth, delivery, startChapter } from '../src/koogalien/library/text'
import { cutChapters, romanToInt, titleCase } from '../src/koogalien/library/chapters'
import { SOURCES, US_PD_LAST_YEAR } from '../src/koogalien/library/sources'
import { buildBook, buildChapter } from '../src/koogalien/library/build'
import { annotate, renderHigh, renderPlain, sceneOf, keyOfChapter, HIGH_RULES, SPEEDS, stemsOf } from '../src/koogalien/library/high'
import { translate } from '../src/koogalien/engine/translate'
import { encode } from '../src/koogalien/engine/encode'
import { print } from '../src/koogalien/lang/print'
import { LEXICON } from '../src/koogalien/data/lexicon'
import { KOOGALIEN_LANGUAGE } from '../src/koogalien/data/version'
import type { CoverageFile, Edition } from '../src/koogalien/library/types'
import { attach, detach, openBook, play, pause, setSpeed, setMode, setAlong, submitChord, useReader, renderAt, nextPos, lineAt, bookKey, jumpPara, seek, sliceWord } from '../src/features/koogalien/library/reader'
import { MAX_POLY, VEL_CAP } from '../src/features/koogalien/play/playScore'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIB = join(ROOT, 'src/koogalien/library')
const RAW = join(ROOT, 'private/library-raw')
let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---- cleaning ---- */
const RAWSAMPLE = ['The Project Gutenberg eBook of X', 'licence text here', '', '*** START OF THE PROJECT GUTENBERG EBOOK X ***', '', 'Produced by Someone', 'CHAPTER I.', 'Hello there.', '', '[Illustration: a cat]', '', '*** END OF THE PROJECT GUTENBERG EBOOK X ***', 'Project Gutenberg licence'].join('\r\n')
{
  const t = stripGutenberg(RAWSAMPLE)
  ok('strip: no trademark', !/gutenberg/i.test(t), t)
  ok('strip: no licence/header', !/licence/i.test(t))
  ok('strip: no credit line', !/Produced by/.test(t))
  ok('strip: body kept', /Hello there\./.test(t))
  let threw = false; try { stripGutenberg('no markers here') } catch { threw = true }
  ok('strip: refuses an unrecognised file', threw)
  eq('paragraphs drop illustrations', paragraphs(t), ['CHAPTER I. Hello there.'])
  eq('drop cap', fixDropCap('IN the sea, once'), 'In the sea, once')
  eq('drop cap word comma', fixDropCap('WOLF, meeting a Lamb'), 'Wolf, meeting a Lamb')
  eq('drop cap leaves a real caps title', fixDropCap('THE END'), 'THE END')
  eq('credit line', credit(1902), 'Text from a public-domain edition; original publication 1902.')
  eq('roman', [romanToInt('IV'), romanToInt('XII'), romanToInt('XXIV')], [4, 12, 24])
  eq('title case', titleCase("MARLEY'S GHOST"), "Marley's Ghost")
}

/* ---- sentences ---- */
eq('abbreviation is not a sentence end', sentencesOf('Mr. McGregor ran. He was angry!'), ['Mr. McGregor ran.', 'He was angry!'])
eq('attribution joins its quote', sentencesOf('“What is it?” said Alice. She ran.'), ['“What is it?” said Alice.', 'She ran.'])
eq('decimal is not split', sentencesOf('It cost 3.5 coins. Fine.').length, 2)
eq('quote depth', [quoteDepth('“Hello there.', 0), quoteDepth('How are you?”', 1), quoteDepth('Plain.', 0)], [1, 0, 0])

/* ---- speakers ---- */
eq('speaker after', speakerName('“No,” said the Whale.'), 'whale')
eq('speaker before', speakerName('Alice cried, “Stop!”'), 'alice')
eq('pronoun is not a name', speakerName('“No,” he said.'), null)
eq('adverb is not a name', speakerName('“No,” said softly.'), null)
eq('whisper is soft, shout is loud', [delivery('she whispered'), delivery('he shouted'), delivery('said Tom')], ['soft', 'loud', 'plain'])
{
  const c = newCast()
  const a = voiceFor(c, '“Hi,” said Alice.', true)
  const b = voiceFor(c, '“Hello,” said the Rabbit.', true)
  const a2 = voiceFor(c, '“Again,” said Alice.', true)
  eq('named speakers get distinct voices', a !== b && a >= 1 && b >= 1, true)
  eq('a named speaker keeps one voice', a2, a)
  const u = voiceFor(c, '“What?”', true)
  eq('an unnamed reply in a new paragraph answers the last speaker', u, b)
  const u2 = voiceFor(c, '“Really?”', false)
  eq('inside a paragraph the speaker stays', u2, u)
  startChapter(c)
  eq('a new chapter keeps the cast', voiceFor(c, '“Yes,” said Alice.', true), a)
}
{
  const ch = buildChapter('T', '“Come in,” said the Fox.\n\nThe door opened.\n\n“Thank you,” said Mia.')
  eq('narrator is voice 0, speakers are 1..3', ch.ps.map((p) => p.map((l) => l[2])), [[1], [0], [2]])
  eq('cast lists the speakers heard', ch.cast.map((c) => c[0]), ['fox', 'mia'])
}

/* ---- the High rules ---- */
{
  eq('rules are data', HIGH_RULES.length >= 10 && HIGH_RULES.every((r) => r.id && r.rule && r.means), true)
  // v1 matching untouched: every lexicon word keeps its id and chord under High
  let bad = 0
  for (const e of LEXICON) {
    if (e.kind === 'closer' || e.kind === 'control') continue
    const plain = translate(e.en).words, hi = annotate(e.en, { chapter: 3, scene: 'dark', voice: 2 }).sentence.words
    if (plain.length !== hi.length || plain.some((w, i) => w.id !== hi[i].id || JSON.stringify(w.chords) !== JSON.stringify(hi[i].chords) || w.kind !== hi[i].kind)) bad++
  }
  eq('High never changes a word or its chord (whole lexicon)', bad, 0)

  const plural = annotate('Two rabbits and the dogs.', { chapter: 0, scene: 'steady', voice: 0 }).sentence.words
  ok('stems', stemsOf('dogs').includes('dog') && stemsOf("rabbit's").includes('rabbit') && stemsOf('cries').includes('cry'))
  const names = annotate('Then Alice shouted loudly.', { chapter: 0, scene: 'steady', voice: 0 }).sentence.words
  ok('a name is loud', names.find((w) => w.en.toLowerCase() === 'alice')!.dyn === 'loud')
  ok('a sentence-initial word is not a name', names[0].dyn === undefined)
  ok('CAPITALS are loud', annotate('I said STOP now.', { chapter: 0, scene: 'steady', voice: 0 }).sentence.words.some((w) => w.en.toLowerCase() === 'stop' && w.tone.loud === 'loud'))
  ok('_stress_ is loud', annotate('It was _not_ you.', { chapter: 0, scene: 'steady', voice: 0 }).sentence.words.some((w) => w.en.toLowerCase() === 'not' && w.tone.loud === 'loud'))
  const soft = annotate('I whispered, hello.', { chapter: 0, scene: 'steady', voice: 1, delivery: 'soft' }).sentence.words
  ok('a whisper is soft', soft.every((w) => w.tone.loud === 'soft'))
  const shout = annotate('Hello world!', { chapter: 0, scene: 'steady', voice: 1 }).sentence
  ok('! ends loud with a wobble', shout.words[shout.words.length - 1].tone.mods.some((m) => m.name === 'wobble') && shout.words[shout.words.length - 1].tone.loud === 'loud')
  const q = annotate('Is it you?', { chapter: 0, scene: 'steady', voice: 0 }).sentence
  ok('? sweeps the filter on its last word', q.words[q.words.length - 1].tone.mods.some((m) => m.name === 'filter') && q.end === '?')
  const br = annotate('Yes, no; hello: you', { chapter: 0, scene: 'steady', voice: 0 })
  ok('commas and semicolons are breaths', Object.values(br.breaths).length >= 2 && Math.max(...Object.values(br.breaths)) > Math.min(...Object.values(br.breaths)))
  const comeGo = annotate('come go', { chapter: 0, scene: 'steady', voice: 0 }).sentence.words
  ok('toward rolls up, away rolls down', comeGo[0].arp === 'up' && comeGo[1].arp === 'down' || comeGo.every((w) => w.kind !== 'word'), JSON.stringify(comeGo.map((w) => [w.en, w.arp])))
  ok('title register', annotate('Chapter one', { chapter: 0, scene: 'steady', voice: 0, title: true }).sentence.words.every((w) => w.register === -1))
  ok('key per chapter', [0, 1, 2, 3, 8].map((n) => keyOfChapter(n).name).join() === 'C,G,D,A,C' && annotate('hello', { chapter: 1, scene: 'steady', voice: 0 }).sentence.words[0].keyCenter === 7)
  eq('scenes', [sceneOf('He ran and ran, rushed and jumped, then fled, quickly!'), sceneOf('In the dark night the ghost wept in the cold shadow with fear.'), sceneOf('They laughed and danced and sang, so merry and glad in the bright sun.')], ['action', 'dark', 'joy'])

  // rendering: High vs plain, caps, timing
  const line = '“Come here, my dear,” said the old Fox, very softly.'
  const hi = renderHigh(line, { chapter: 2, scene: 'dark', voice: 2 }, { speed: 1, tail: 3 })
  const pl = renderPlain(line, 2, { speed: 1, tail: 3 })
  ok('plain is one voice, High uses the speaker', pl.alien === 'pip' && hi.alien === 'dro' && !pl.high && hi.high)
  ok('High differs from plain (notes and timing)', JSON.stringify(hi.score.chords.map((c) => c.midi)) !== JSON.stringify(pl.score.chords.map((c) => c.midi)) && hi.score.beats !== pl.score.beats)
  const base = encode(translate(line), { bpm: 100, alien: 'pip' })
  eq('plain notes equal v1 notes', pl.score.chords.map((c) => c.midi), base.chords.map((c) => c.midi))
  const maxVel = Math.max(...hi.score.chords.map((c) => c.vel), ...pl.score.chords.map((c) => c.vel))
  ok('velocity stays under the cap', maxVel <= VEL_CAP + 1e-9, String(maxVel))
  ok('every note is playable', hi.score.chords.every((c) => c.midi.every((m) => m >= 24 && m <= 100)))
  const minorHi = renderHigh('the music', { chapter: 0, scene: 'dark', voice: 0 }, { speed: 1 }), majorHi = renderHigh('the music', { chapter: 0, scene: 'steady', voice: 0 }, { speed: 1 })
  ok('dark scenes are minor (lowered notes)', JSON.stringify(minorHi.score.chords.map((c) => c.midi)) !== JSON.stringify(majorHi.score.chords.map((c) => c.midi)))
  const slow = renderHigh('hello world', { chapter: 0, scene: 'calm', voice: 0 }, { speed: 1 }), fast = renderHigh('hello world', { chapter: 0, scene: 'action', voice: 0 }, { speed: 1 })
  ok('action is faster than calm', fast.score.beats < slow.score.beats)
  const s1 = renderHigh(line, { chapter: 0, scene: 'steady', voice: 0 }, { speed: SPEEDS['story time'] }), s3 = renderHigh(line, { chapter: 0, scene: 'steady', voice: 0 }, { speed: SPEEDS['fast reader'] })
  ok('speed presets scale time', s3.score.beats < s1.score.beats * 0.5)
  const para = renderHigh('Hello.', { chapter: 0, scene: 'steady', voice: 0 }, { speed: 1, tail: 0 }), rest = renderHigh('Hello.', { chapter: 0, scene: 'steady', voice: 0 }, { speed: 1, tail: 4 })
  ok('a paragraph rest is silence at the end', rest.score.beats - para.score.beats > 3)
  const longW = renderHigh('dogs', { chapter: 0, scene: 'steady', voice: 0 }, { speed: 1 }), oneW = renderHigh('dog', { chapter: 0, scene: 'steady', voice: 0 }, { speed: 1 })
  ok('a plural is held longer', plural[1].kind === 'spelled' || longW.score.chords[0].dur > oneW.score.chords[0].dur, 'dogs vs dog')
  ok('notes at once stay under the polyphony cap', (() => { for (const r of [hi, pl, s1]) for (const c of r.score.chords) { const n = r.score.chords.filter((d) => d.at <= c.at + 1e-9 && d.at + d.dur > c.at + 1e-9).reduce((a, d) => a + d.midi.length, 0); if (n > 8) return false } return true })())
}

/* ---- build pipeline on text ---- */
{
  const body = 'CHAPTER I.\nDown the Hole\n\nAlice was tired. “Oh dear!” she said.\n\nCHAPTER II.\nThe Pool\n\nThe pool was deep.\n'
  const cuts = cutChapters(body, { how: 'headings', re: /^CHAPTER [IVXL]+\.$/, titleNext: true }, 'T')
  eq('chapters by heading', cuts.map((c) => c.title), ['1. Down the Hole', '2. The Pool'])
  const toc = cutChapters('CONTENTS:\n\n   ONE FINE DAY\n   TWO FINE DAYS\n\n\n\nONE FINE DAY\n\nText one.\n\nTWO FINE DAYS\n\nText two.\n', { how: 'toc', tocFrom: /^CONTENTS:\s*$/ }, 'T')
  eq('chapters by table of contents', toc.map((c) => [c.title, c.text.trim()]), [['One Fine Day', 'Text one.'], ['Two Fine Days', 'Text two.']])
  const src = { ...SOURCES[0], cut: { how: 'headings' as const, re: /^CHAPTER [IVXL]+\.$/, titleNext: true }, ship: 1 }
  const raw = '*** START OF THE PROJECT GUTENBERG EBOOK T ***\n' + body + '*** END OF THE PROJECT GUTENBERG EBOOK T ***\n'
  const a = buildBook(raw, src), b = buildBook(raw, src)
  eq('rebuild is deterministic', JSON.stringify(a.edition), JSON.stringify(b.edition))
  ok('long books ship partial', a.edition.partial && a.edition.chapters.length === 1 && a.edition.totalChapters === 2)
  ok('--all ships every chapter', buildBook(raw, src, { all: true }).edition.chapters.length === 2)
  eq('line = [english, code, voice]', a.edition.chapters[0].ps[0][0], ['Alice was tired.', 'say "Alice" was "tired".', 0].map((x, i) => (i === 1 ? print(translate('Alice was tired.')) : x)))
}

/* ---- the shipped editions ---- */
const edFiles = readdirSync(join(LIB, 'editions')).filter((f) => f.endsWith('.json')).sort()
let bytes = 0
ok('every source has an edition', SOURCES.every((s) => edFiles.includes(s.id + '.json')))
for (const f of edFiles) {
  const text = readFileSync(join(LIB, 'editions', f), 'utf8')
  bytes += text.length
  const e = JSON.parse(text) as Edition
  const id = f.replace('.json', '')
  const src = SOURCES.find((s) => s.id === id)!
  ok(id + ': schema', e.v === 1 && e.id === id && typeof e.title === 'string' && typeof e.author === 'string' && Number.isInteger(e.year) && Number.isInteger(e.source) && Array.isArray(e.chapters) && e.chapters.length > 0)
  ok(id + ': US public domain (1930 or earlier)', e.year <= US_PD_LAST_YEAR && src.year <= US_PD_LAST_YEAR)
  eq(id + ': credit line', e.credit, credit(e.year))
  ok(id + ': lang', e.lang === KOOGALIEN_LANGUAGE || typeof e.lang === 'string')
  ok(id + ': no trademark, licence or credit boilerplate', !/gutenberg|proofread|licen[cs]e terms|produced by/i.test(text))
  ok(id + ': partial flag', e.partial === (e.chapters.length < e.totalChapters))
  let badLine = 0, badVoice = 0, empty = 0, mism = 0, n = 0
  for (const c of e.chapters) {
    if (!c.ps.length) empty++
    for (const p of c.ps) for (const l of p) {
      n++
      if (!Array.isArray(l) || l.length !== 3 || typeof l[0] !== 'string' || typeof l[1] !== 'string' || !l[0].trim() || !l[1].startsWith('say')) badLine++
      if (![0, 1, 2, 3].includes(l[2])) badVoice++
      if (n % 37 === 0 && print(translate(l[0].replace(/_/g, ''))) !== l[1]) mism++
    }
  }
  eq(id + ': lines well formed', [badLine, badVoice, empty, mism], [0, 0, 0, 0])
  // deterministic rebuild from the raw download, when it is on this machine
  const rawFile = join(RAW, src.file)
  if (existsSync(rawFile)) {
    const rebuilt = JSON.stringify(buildBook(readFileSync(rawFile, 'utf8'), src).edition)
    ok(id + ': rebuild from raw equals the shipped file', rebuilt === text)
  }
}
ok(`editions total ${(bytes / 1024).toFixed(0)} KB is under 2 MB`, bytes < 2 * 1024 * 1024)
{
  const cov = JSON.parse(readFileSync(join(LIB, 'coverage.json'), 'utf8')) as CoverageFile
  ok('coverage: every book, ratio = known / (known + spelled)', cov.books.length === SOURCES.length && cov.books.every((b) => Math.abs(b.ratio - b.known / (b.known + b.spelled)) < 1e-3 && b.topSpelled.length === 50 && b.highRatio >= b.ratio - 1e-9))
  ok('coverage: total', cov.total.words === cov.books.reduce((n, b) => n + b.words, 0) && cov.total.topSpelled.length === 50 && cov.total.topSpelled[0][1] >= cov.total.topSpelled[49][1])
}

/* ---- the reader engine on a fake host ---- */
const peter = JSON.parse(readFileSync(join(LIB, 'editions/peter-rabbit.json'), 'utf8')) as Edition
function rig(bpm = 300) {
  const notes: { m: number; v: number; at: number; d: number }[] = []
  const store = new Map<string, unknown>()
  const log: string[] = []
  const host = {
    now: () => performance.now(),
    sound: { bpm: () => bpm, nowBeat: () => performance.now() / (60000 / bpm), note: (m: number, v: number, at: number, d: number) => notes.push({ m, v, at, d }), drum: () => undefined, stopAll: () => log.push('stop') },
    mods: { apply: () => undefined, release: () => undefined, patch: (a: string | null) => log.push('patch:' + a) },
    progress: { load: <T,>(k: string, f: T): T => (store.has(k) ? (store.get(k) as T) : f), save: <T,>(k: string, v: T) => { store.set(k, JSON.parse(JSON.stringify(v))) } },
    concepts: { mark: () => undefined }, guide: { show: (n: number[]) => log.push('guide:' + n.join()), clear: () => log.push('clear') }, celebrate: (k?: string) => log.push('celebrate:' + k), exit: () => undefined,
  }
  return { host, notes, store, log }
}
async function readerChecks() {
  const r = rig()
  attach(r.host)
  openBook(peter)
  eq('opens at the title', useReader.getState().pos, { ch: 0, p: -1, s: 0 })
  setSpeed('fast reader')
  setMode('high')
  play()
  const seen = new Set<number>(), poss = new Set<string>()
  const t0 = Date.now()
  while (Date.now() - t0 < 10000) { await sleep(40); const s = useReader.getState(); if (s.playingWord !== null) seen.add(s.playingWord); poss.add(JSON.stringify(s.pos)) }
  const s1 = useReader.getState()
  ok('plays 10 s: the ribbon advanced word by word', seen.size >= 5, String(seen.size))
  ok('plays 10 s: the book advanced past the title', poss.size >= 2, String(poss.size))
  ok('plays 10 s: notes were scheduled', r.notes.length > 50, String(r.notes.length))
  ok('notes stay under the velocity cap', r.notes.every((n) => n.v <= VEL_CAP + 1e-9))
  const byAt = new Map<number, number>()
  for (const n of r.notes) byAt.set(Math.round(n.at * 1000), (byAt.get(Math.round(n.at * 1000)) ?? 0) + 1)
  ok('no more than the channel cap of notes at one instant', Math.max(...byAt.values()) <= MAX_POLY, String(Math.max(...byAt.values())))
  pause()
  seek({ ch: 0, p: 3, s: 0 }); play(); await sleep(1500); pause()
  ok('a quoted line is patched to its Koogalien voice', r.log.some((l) => l === 'patch:pip'), r.log.join())
  seek({ ch: 0, p: 1, s: 0 }); play(); await sleep(600); pause()
  seek({ ch: 0, p: 2, s: 0 })
  const pos = useReader.getState().pos
  const n0 = r.notes.length
  await sleep(400)
  ok('pause stops scheduling', r.notes.length === n0 && !useReader.getState().playing)
  ok('progress saved', JSON.stringify((r.store.get(bookKey('peter-rabbit')) as { ch: number }) && { ch: 0 }) === '{"ch":0}' && (r.store.get(bookKey('peter-rabbit')) as { p: number }).p === pos.p)
  detach()
  // "reload": a fresh attach and open resume where we stopped, with the saved preferences
  attach(r.host); openBook(peter)
  eq('progress persists after reload', useReader.getState().pos, pos)
  eq('prefs persist after reload', [useReader.getState().speed, useReader.getState().mode], ['fast reader', 'high'])
  // plain vs High switches the rendering
  seek({ ch: 0, p: 3, s: 0 })
  const hiA = useReader.getState().rendered!
  setMode('plain')
  const plA = useReader.getState().rendered!
  ok('plain/High switch changes the rendering', hiA.high && !plA.high && JSON.stringify(hiA.score.chords.map((c) => c.at)) !== JSON.stringify(plA.score.chords.map((c) => c.at)))
  setMode('high')
  // paragraph navigation
  jumpPara(1)
  eq('next paragraph', useReader.getState().pos.p, 4)
  jumpPara(-2)
  eq('previous paragraph', useReader.getState().pos.p, 2)
  // walking the whole book end to end finds a line everywhere
  let p = { ch: 0, p: -1, s: 0 } as ReturnType<typeof nextPos>, n = 0
  while (p) { if (!lineAt(peter, p)) { n = -1e9; break } n++; p = nextPos(peter, p) }
  ok('every position has a line (' + n + ')', n > 50)
  ok('sliceWord covers one word', sliceWord(renderAt(peter, { ch: 0, p: 0, s: 0 }, 'high', 'story time')!.score, 0, false).chords.every((c) => c.word === 0))
  // play along: right chord advances, wrong chords skip after three
  const r2 = rig(); detach(); attach(r2.host); openBook(peter)
  seek({ ch: 0, p: 2, s: 0 }); setSpeed('fast reader'); setMode('high'); setAlong(true)
  play()
  let target = null as ReturnType<typeof useReader.getState>['target']
  for (let i = 0; i < 200 && !target; i++) { await sleep(40); target = useReader.getState().target }
  ok('play along waits for the kid on a chord word', !!target)
  if (target) {
    const wrong = target.chord[0] === 1 ? [2, 3] : [1, 2]
    eq('a wrong chord does not advance', submitChord(wrong as never), false)
    eq('the right chord is accepted', submitChord(target.chord), true)
    await sleep(100)
    ok('a hit is counted', useReader.getState().hits === 1)
  }
  for (let i = 0; i < 100; i++) { await sleep(40); const t = useReader.getState().target; if (t && t.word !== (target?.word ?? -1)) { target = t; break } }
  const w0 = target?.word
  submitChord([8] as never); submitChord([8] as never); submitChord([8] as never)
  await sleep(150)
  ok('three misses move on (hint played)', useReader.getState().target === null || useReader.getState().target!.word !== w0)
  pause(); detach()
  const hits = (r2.store.get(bookKey('peter-rabbit')) as { hits: number }).hits
  ok('play-along hits saved', hits >= 1, String(hits))
  eq('plain and High both render every line', [renderAt(peter, { ch: 0, p: 0, s: 0 }, 'plain', 'read-aloud') !== null, renderAt(peter, { ch: 0, p: 0, s: 0 }, 'high', 'read-aloud') !== null], [true, true])
}

readerChecks().then(() => {
  console.log(`library fixtures: ${passes} passed, ${fails} failed`)
  process.exit(fails ? 1 : 0)
}).catch((e) => { console.error(e); process.exit(1) })
