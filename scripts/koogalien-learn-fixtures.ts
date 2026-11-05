// Koogalien learning checks: spaced repetition, the word ladder, judging, round picking, Echo round rules, chord windows, saved progress, why-lines.
//   npx --no-install tsx scripts/koogalien-learn-fixtures.ts        (exit 1 on any failure)
import { LEXICON } from '../src/koogalien/data/lexicon'
import type { Chord, LexEntry } from '../src/koogalien/data/types'
import { BOX_DAYS, DAY_MS, due, newCard, review, type Card } from '../src/koogalien/learn/srs'
import { RUNGS, isKnown, isLearned, newWordProg, nextRung, playRung, unitUnlocked, type WordProg } from '../src/koogalien/learn/ladder'
import { judgeWord, nearest, pickRound } from '../src/koogalien/learn/checks'
import { ALL_ITEMS, DIGITS, itemById, itemsOfUnit, UNITS } from '../src/koogalien/learn/items'
import { CHORD_MS, degreeOfToken, emptyWin, flush, press } from '../src/koogalien/learn/chordWindow'
import { MAX_MISSES, current, dismissReveal, isDone, newRound, onPlayed, perfect, roundStars, target } from '../src/koogalien/learn/echoRound'
import { emptyProgress, recordWord, sanitize } from '../src/koogalien/learn/progress'
import { chordsScore, sentenceOf } from '../src/koogalien/learn/speak'
import { WHY } from '../src/koogalien/learn/whys'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)
const word = (id: string) => itemById(id)!
const T0 = 1_700_000_000_000

// ---- SRS
{
  eq('box days', [...BOX_DAYS], [0, 1, 3, 7, 14])
  let c = newCard('hello', T0)
  eq('new card: box 1, due now', [c.box, c.due, c.seen], [1, T0, 0])
  c = review(c, true, T0); eq('right: box 2, due in 1 day', [c.box, c.due - T0, c.right], [2, DAY_MS, 1])
  c = review(c, true, T0); eq('right again: box 3, 3 days', [c.box, c.due - T0], [3, 3 * DAY_MS])
  c = review(c, true, T0); c = review(c, true, T0); eq('box 5, 14 days', [c.box, c.due - T0], [5, 14 * DAY_MS])
  c = review(c, true, T0); eq('box never passes 5', c.box, 5)
  c = review(c, false, T0 + 5); eq('wrong: back to box 1, due now', [c.box, c.due, c.seen], [1, T0 + 5, 6])
  const cards: Card[] = [{ ...newCard('b', T0), due: T0 + 50 }, { ...newCard('a', T0), due: T0 - 10, box: 2 }, { ...newCard('c', T0), due: T0 - 10, box: 1 }, { ...newCard('d', T0), due: T0 - 99 }]
  eq('due order: most overdue, low box, id', due(cards, T0, 10).map((x) => x.id), ['d', 'c', 'a'])
  eq('due honors the limit', due(cards, T0, 2).map((x) => x.id), ['d', 'c'])
  eq('nothing due early', due(cards, T0 - 1000, 10).length, 0)
  const frozen = JSON.stringify(cards); due(cards, T0, 3); eq('due does not mutate', JSON.stringify(cards), frozen)
}

// ---- ladder
{
  eq('six rungs', RUNGS.length, 6)
  let p: WordProg = newWordProg()
  eq('untouched word is played on hunt', playRung(p), 'hunt')
  p = nextRung(p, false, 3); eq('a fail changes nothing', [p.rung, p.stars], [null, 0])
  p = nextRung(p, true, 3); eq('pass hunt', p.rung, 'hunt'); eq('then follow next', playRung(p), 'follow')
  p = nextRung(p, true, 2); p = nextRung(p, true, 3)
  eq('after echo: learned', [p.rung, isLearned(p), isKnown(p)], ['echo', true, false])
  eq('then memory is the top rung v1 plays', playRung(nextRung(p, true, 1)), 'memory')
  for (let i = 0; i < 5; i++) p = nextRung(p, true, 3)
  eq('master is known', [p.rung, isKnown(p)], ['master', true])
  eq('stars clamp', nextRung(newWordProg(), true, 9).stars, 3)
  const prog: Record<string, WordProg> = {}
  eq('unit 1 always open', unitUnlocked(1, prog), true)
  eq('unit 2 closed on a fresh player', unitUnlocked(2, prog), false)
  for (const e of itemsOfUnit(1)) prog[e.id] = { rung: 'echo', stars: 3, best: 1 }
  eq('unit 2 opens when unit 1 is learned', unitUnlocked(2, prog), true)
  const some: Record<string, WordProg> = {}
  const u1 = itemsOfUnit(1); for (const e of u1.slice(0, Math.floor(u1.length * 0.5))) some[e.id] = { rung: 'echo', stars: 1, best: 1 }
  eq('half is not enough', unitUnlocked(2, some), u1.length === 0)
  ok('digits exist for unit 1', DIGITS.length === 8 && itemsOfUnit(1).some((e) => e.id === 'digit-3'))
}

// ---- judgeWord
{
  const hello = LEXICON.find((e) => e.id === 'hello')!, world = LEXICON.find((e) => e.id === 'world')!
  eq('exact chord ok', judgeWord(hello.chord, hello), { ok: true, confidence: 1 })
  eq('jitter changes nothing: the chord is what counts, order is free', judgeWord([6, 1] as unknown as Chord, hello).ok, true)
  eq('duplicates folded', judgeWord([1, 1, 6] as unknown as Chord, hello).ok, true)
  eq('a different word is rejected', judgeWord(world.chord, hello).ok, false)
  eq('one key off a 2-key chord is rejected', judgeWord([1, 5] as unknown as Chord, hello).ok, false)
  eq('empty is rejected', judgeWord([] as unknown as Chord, hello).ok, false)
  eq('a digit must be exact', judgeWord([3] as unknown as Chord, word('digit-3')).ok, true)
  eq('wrong digit', judgeWord([4] as unknown as Chord, word('digit-3')).ok, false)
  eq('a chord is not a digit', judgeWord(hello.chord, word('digit-1')).ok, false)
  const n = nearest(hello.chord, 3)
  eq('nearest finds hello first at 100%', [n[0]?.entry.id, n[0]?.confidence], ['hello', 1])
  ok('nearest returns at most 3, best first', n.length <= 3 && n.every((x, i) => i === 0 || n[i - 1].confidence >= x.confidence))
  eq('lone note looks up digits', nearest([5] as unknown as Chord, 1)[0]?.entry.id, 'digit-5')
  // every lexicon chord is judged right for itself and wrong for every other (so no two words can be confused)
  let confused = 0
  for (const a of LEXICON) { if (!judgeWord(a.chord, a).ok) confused++ }
  eq('every word accepts its own chord', confused, 0)
  let cross = 0
  for (const a of LEXICON) for (const b of LEXICON) if (a !== b && a.chord.join() !== b.chord.join() && judgeWord(a.chord, b).ok) cross++
  eq('no word accepts another word\'s chord', cross, 0)
}

// ---- pickRound
{
  const a = pickRound(2, [], T0, 5, 42), b = pickRound(2, [], T0, 5, 42), c = pickRound(2, [], T0, 5, 43)
  eq('deterministic', a.map((x) => x.id), b.map((x) => x.id))
  ok('seed changes the order or words', c.map((x) => x.id).join() !== a.map((x) => x.id).join() || itemsOfUnit(2).length <= 5)
  eq('no repeats', new Set(a.map((x) => x.id)).size, a.length)
  eq('asks for n', a.length, Math.min(5, ALL_ITEMS.filter((e) => e.unit <= 2).length))
  ok('words are from this unit or earlier', a.every((x) => x.unit <= 2))
  ok('never a closer', pickRound(9, [], T0, 40, 1).every((x) => x.kind !== 'closer'))
  const cards: Card[] = [{ ...newCard('digit-3', T0), due: T0 - 1, box: 1 }, { ...newCard('digit-4', T0), due: T0 + 9 * DAY_MS, box: 3 }]
  const r = pickRound(2, cards, T0, 5, 7)
  ok('a due review card is included', r.some((x) => x.id === 'digit-3'))
  eq('review pool never exceeds half', r.filter((x) => cards.some((cc) => cc.id === x.id && cc.due <= T0)).length <= 3, true)
  eq('n larger than the pool is fine', pickRound(1, [], T0, 500, 3).length, ALL_ITEMS.filter((e) => e.unit <= 1).length)
}

// ---- chord window
{
  let w = press(emptyWin(), 1, 1000); w = press(w, 6, 1030); w = press(w, 6, 1040)
  eq('too early to close', flush(w, 1000 + CHORD_MS - 1).chord, null)
  const f = flush(w, 1000 + CHORD_MS)
  eq('closes into a sorted chord, duplicates folded', f.chord, [1, 6]); eq('window resets', f.win.start, null)
  eq('keys 30 ms apart are one chord', flush(press(press(emptyWin(), 8, 0), 1, 30), 200).chord, [1, 8])
  eq('piano C4 and A4 -> 1,6', [degreeOfToken({ src: 'keys', pitch: 60, value: 60 }), degreeOfToken({ src: 'midi', pitch: 69, value: 69 })], [1, 6])
  eq('black key ignored', degreeOfToken({ src: 'keys', pitch: 61, value: 61 }), null)
  eq('any octave folds', [degreeOfToken({ src: 'keys', pitch: 67 + 24, value: 91 }), degreeOfToken({ src: 'keys', pitch: 36 + 7, value: 43 })], [5, 5])
  eq('pads lane 0..7 -> 1..8', [degreeOfToken({ src: 'drums', lane: 0, value: 0 }), degreeOfToken({ src: 'dj', lane: 7, value: 7 })], [1, 8])
  eq('pedal ignored', degreeOfToken({ src: 'pedal', value: 0 }), null)
}

// ---- Echo round rules
{
  const hello = word('hello'), world = word('world')
  const fresh = newRound([hello, world], {})
  eq('fresh words start on hunt', fresh.steps.map((s) => s.rung), ['hunt', 'hunt'])
  eq('no sentence step until two words are learned', fresh.steps.length, 2)
  let r = fresh
  let res = onPlayed(r, [2, 3] as unknown as Chord); eq('hunt: a miss is just a miss', res.event, 'wrong'); r = res.state
  for (let i = 0; i < 6; i++) { res = onPlayed(r, [2, 3] as unknown as Chord); r = res.state }
  eq('hunt never gives up', r.revealed, false)
  res = onPlayed(r, hello.chord); r = res.state
  eq('hunt right: word done', res.event, 'word-done'); eq('hunt gets 3 stars regardless of misses', r.results[0], { id: 'hello', passed: true, stars: 3, sentence: false })
  res = onPlayed(r, world.chord); eq('last word ends the round', res.event, 'round-done'); r = res.state
  ok('round is done and perfect', isDone(r) && perfect(r)); eq('round stars', roundStars(r), 6)

  // echo rung: misses cost stars, three misses reveal the answer
  const prog: Record<string, WordProg> = { hello: { rung: 'follow', stars: 3, best: 1 }, world: { rung: 'echo', stars: 3, best: 1 } }
  let e = newRound([hello, world], prog)
  eq('rungs follow progress', e.steps.map((s) => s.rung), ['echo', 'memory'])
  eq('one learned word... world is learned, hello is not: no sentence', e.steps.length, 2)
  res = onPlayed(e, [1, 5] as unknown as Chord, 'friend'); e = res.state; eq('wrong event and what it looked like', [res.event, e.lastWrong], ['wrong', 'friend'])
  res = onPlayed(e, hello.chord); e = res.state; eq('one miss = 2 stars', e.results[0].stars, 2)
  for (let i = 0; i < MAX_MISSES; i++) { res = onPlayed(e, [2, 7] as unknown as Chord); e = res.state }
  eq('three misses reveal', [res.event, e.revealed], ['gave-up', true])
  eq('input ignored while revealed', onPlayed(e, world.chord).event, 'none')
  res = dismissReveal(e); eq('dismissing records a not-passed word and ends the round', [res.event, res.state.results[1].passed, res.state.results[1].stars], ['round-done', false, 0])
  ok('not perfect after a give-up', !perfect(res.state))

  // a sentence step when two words are learned
  const both: Record<string, WordProg> = { hello: { rung: 'echo', stars: 3, best: 1 }, world: { rung: 'echo', stars: 3, best: 1 } }
  let s = newRound([hello, world], both)
  eq('sentence step is added', s.steps.map((x) => x.sentence), [false, false, true])
  s = onPlayed(onPlayed(s, hello.chord).state, world.chord).state
  eq('on the sentence step now', [current(s)?.sentence, target(s)?.id], [true, 'hello'])
  res = onPlayed(s, hello.chord); eq('first word of the sentence', [res.event, target(res.state)?.id], ['right', 'world'])
  res = onPlayed(res.state, world.chord); eq('sentence done', [res.event, res.state.results[2].sentence], ['round-done', true])
}

// ---- progress save/load
{
  let p = emptyProgress()
  p = recordWord(p, 'hello', true, 3, T0)
  eq('word climbed and card moved a box', [p.words.hello.rung, p.cards[0].box, p.stars], ['hunt', 2, 3])
  p = recordWord(p, 'hello', false, 0, T0 + 10)
  eq('a miss resets the card but keeps the rung', [p.words.hello.rung, p.cards[0].box, p.cards.length], ['hunt', 1, 1])
  const round = sanitize(JSON.parse(JSON.stringify(p)))
  eq('save/load round trip', round, p)
  eq('garbage in -> empty', sanitize('nope'), emptyProgress())
  eq('garbage fields dropped', sanitize({ words: { x: { rung: 'bogus', stars: 99, best: -4 }, y: 7 }, cards: [{ id: 'z', box: 9, due: 1 }, { id: 'ok', box: 2, due: 5, seen: 1, right: 1 }], stars: -3 }),
    { v: 1, words: { x: { rung: null, stars: 3, best: 0 } }, cards: [{ id: 'ok', box: 2, due: 5, seen: 1, right: 1 }], sentences: 0, stars: 0 })
  // per-player: two stores never mix
  const store: Record<string, string> = {}
  const save = (who: string, v: unknown) => { store[who + ':koogalien'] = JSON.stringify(v) }
  const load = (who: string) => sanitize(store[who + ':koogalien'] ? JSON.parse(store[who + ':koogalien']) : null)
  save('ada', p); eq('another player starts empty', load('ben'), emptyProgress()); eq('ada keeps hers', load('ada').words.hello.rung, 'hunt')
}

// ---- speaking + why lines
{
  const sc = chordsScore([[1, 6], [1, 5, 8]] as unknown as Chord[], 'pip', 100)
  eq('two words are spaced', sc.chords.map((c) => c.at), [0, 1.5])
  ok('velocity under the cap', sc.chords.every((c) => c.vel <= 0.85))
  eq('midi count matches degrees', sc.chords.map((c) => c.midi.length), [2, 3])
  eq('wordStarts line up', sc.wordStarts, [0, 1.5])
  eq('sentenceOf is one slot per word', sentenceOf([word('hello'), word('digit-3')]).words.map((x) => [x.kind, x.id, x.en]), [['word', 'hello', 'hello'], ['digit', null, '3']])
  const missing = LEXICON.filter((e) => e.kind !== 'closer' || true).filter((e) => !WHY[e.en.toLowerCase()] && !WHY[e.id])
  eq('every lexicon word has a why line', missing.map((e) => e.id), [])
  ok('units are 1..9', UNITS.every((u) => u >= 1 && u <= 9))
  const fresh = JSON.stringify(LEXICON); pickRound(3, [], T0, 5, 9); eq('pickRound does not touch the lexicon', JSON.stringify(LEXICON), fresh)
  void (null as unknown as LexEntry)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
