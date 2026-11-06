// Koogalien Games checks: the help ladder, crediting words into the shared progress (a miss comes back due), Alien Says rounds,
// Spell Station steps, Chat's dialogue tree, Word Rocket's adaptive difficulty. Chords always come from the lexicon.
//   npx --no-install tsx scripts/koogalien-games-fixtures.ts        (exit 1 on any failure)
import { SPELL_END, glyphByChar } from '../src/koogalien/data/alphabet'
import { lexById } from '../src/koogalien/data/lexicon'
import type { Chord } from '../src/koogalien/data/types'
import { ALL_ITEMS, itemById } from '../src/koogalien/learn/items'
import { pickRound } from '../src/koogalien/learn/checks'
import { due, DAY_MS } from '../src/koogalien/learn/srs'
import { emptyProgress } from '../src/koogalien/learn/progress'
import { cleanName, credit, emptySave, helpFor, sanitizeSave, starsFor } from '../src/features/koogalien/games/core'
import { MAX_PLAY_MISSES, UFO_GOAL, buildChoices, dismiss, newSays, pickChoice, playChord, saysDone, saysItem, saysPerfect, ufoProgress } from '../src/features/koogalien/games/says'
import { SPELL_CHORD, gridMode, newSpell, shipsFor, spellClean, spellCoach, spellPlay, spellResults, spellable, type SpellState } from '../src/features/koogalien/games/spell'
import { DIALOGUES, allDialogueWords, answer, availableDialogues, closerOf, codeOfSay, englishOfSay, matchBranch, missingFor, newChat, nextLine, skipTurn, wobbleUnlocked, wordOfChord } from '../src/features/koogalien/games/chat'
import { fallMs, gapMs, lowest, maxActive, newRocket, progressOf, rocketDone, startLevel, tick, zap, MAX_LEVEL } from '../src/features/koogalien/games/rocket'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)
const T0 = 1_700_000_000_000
const chordOf = (id: string): Chord => (itemById(id) ?? lexById(id))!.chord

// ---- help ladder
{
  eq('new word: glow', helpFor(undefined), 'glow')
  eq('hunt: glow', helpFor({ rung: 'hunt', stars: 1, best: 1 }), 'glow')
  eq('follow: fade', helpFor({ rung: 'follow', stars: 1, best: 1 }), 'fade')
  eq('echo: fade', helpFor({ rung: 'echo', stars: 1, best: 1 }), 'fade')
  eq('memory: none', helpFor({ rung: 'memory', stars: 1, best: 1 }), 'none')
  eq('two misses bring the glow back', helpFor({ rung: 'memory', stars: 1, best: 1 }, 2), 'glow')
  eq('stars', [starsFor(0), starsFor(1), starsFor(4)], [3, 2, 1])
}

// ---- SRS integration: a miss comes back due, a hit climbs
{
  let p = emptyProgress()
  p = credit(p, 'hello', true, 3, T0, 'echo')
  const c1 = p.cards.find((c) => c.id === 'hello')!
  eq('hit: box 2, due in a day', [c1.box, c1.due - T0], [2, DAY_MS])
  eq('hit climbs to hunt rung', p.words.hello.rung, 'hunt')
  eq('hit not due now', due(p.cards, T0 + 1000, 9).length, 0)
  p = credit(p, 'hello', false, 0, T0 + 5000, 'echo')
  const c2 = p.cards.find((c) => c.id === 'hello')!
  eq('miss: back to box 1, due right now', [c2.box, c2.due], [1, T0 + 5000])
  eq('miss: due soon (in the due list a moment later)', due(p.cards, T0 + 6000, 9).map((c) => c.id), ['hello'])
  eq('miss does not drop the rung', p.words.hello.rung, 'hunt')
  ok('pickRound brings the missed word back into the next round', pickRound(2, p.cards, T0 + 6000, 5, 1).some((e) => e.id === 'hello'))
  // cap: a word already at the cap only moves its box, the rung stays
  let q = emptyProgress(); q.words.yes = { rung: 'memory', stars: 3, best: 1 }
  q = credit(q, 'yes', true, 3, T0, 'memory'); eq('cap: rung stays memory', q.words.yes.rung, 'memory'); eq('cap: card still moves', q.cards.find((c) => c.id === 'yes')?.box, 2)
  // letters live in the same progress
  let r = credit(emptyProgress(), 'letter-k', false, 0, T0, 'memory'); eq('letter card due', due(r.cards, T0, 9).map((c) => c.id), ['letter-k'])
  // every game credits the same object: Rocket then Says sees the same card
  r = credit(r, 'hello', true, 2, T0, 'memory'); eq('shared progress holds both', r.cards.map((c) => c.id).sort(), ['hello', 'letter-k'])
}

// ---- saves
{
  eq('cleanName', [cleanName('  Maya! '), cleanName('Mary  Ann'), cleanName("O'Neil"), cleanName(7), cleanName('abcdefghijklmnopqrstuvwxyz').length], ['maya', 'mary ann', "o'neil", '', 12])
  const s = sanitizeSave({ names: ['Maya', 'maya', 'x1y', 5], bestStreak: 7, rocketBest: -3, chat: { hello: 2, bad: 'x' }, last: 'says', junk: 1 })
  eq('save sanitized', [s.names, s.bestStreak, s.rocketBest, s.chat, s.last], [['maya', 'xy'], 7, 0, { hello: 2, bad: 0 }, 'says'])
  eq('empty save', sanitizeSave(null), emptySave())
}

// ---- Alien Says
{
  const entries = pickRound(2, [], T0, 5, 3)
  const s0 = newSays(entries, 11)
  eq('five items', s0.items.length, 5)
  ok('each item has 3 distinct choices incl. the target', s0.items.every((it) => it.choices.length === 3 && new Set(it.choices).size === 3 && it.choices.includes(it.id)))
  ok('choices have distinct pictures', s0.items.every((it) => new Set(it.choices.map((c) => itemById(c)!.emoji)).size === 3))
  eq('choices are deterministic', buildChoices(itemById('hello')!, 5), buildChoices(itemById('hello')!, 5))
  // play: right pick then right chord
  let s = s0
  const first = saysItem(s)!
  let r = pickChoice(s, first.choices.find((c) => c !== first.id)!); eq('wrong pick stays on pick', [r.event, saysItem(r.state)!.stage, saysItem(r.state)!.pickMiss], ['pick-wrong', 'pick', 1])
  r = pickChoice(r.state, first.id); eq('right pick moves to play', [r.event, saysItem(r.state)!.stage], ['pick-right', 'play'])
  let pr = playChord(r.state, chordOf(first.id)); eq('right chord finishes item', pr.event, 'next'); eq('1 miss = 2 stars, no streak', [pr.state.results[0].stars, pr.state.streak], [2, 0])
  s = pr.state
  // clean items build a streak and charge the UFO
  for (let k = 1; k <= 4; k++) {
    const it = saysItem(s)!
    s = pickChoice(s, it.id).state
    const res = playChord(s, chordOf(it.id)); s = res.state
    eq(`clean item ${k}: streak ${k}`, s.streak, k)
    if (k === 4) eq('round done', res.event, 'round-done')
  }
  eq('done', saysDone(s), true); eq('best streak 4', s.best, 4); eq('ufo 4/5', ufoProgress(4), 4 / UFO_GOAL); eq('ufo capped', ufoProgress(99), 1)
  eq('not perfect after a slip', saysPerfect(s), false)
  // give-up after three wrong chords, then Next: counted as a miss with no stars, streak reset
  let g = pickChoice(newSays(entries, 11), saysItem(newSays(entries, 11))!.id).state
  const wantId = saysItem(g)!.id
  const wrong: Chord = [1, 2, 3, 4, 5, 6, 7, 8].slice(0, 2).map((d) => d) as unknown as Chord
  const notIt = ALL_ITEMS.find((e) => e.id !== wantId && e.chord.length === 2 && !(e.chord[0] === chordOf(wantId)[0] && e.chord[1] === chordOf(wantId)[1]))!
  void wrong
  let ev = ''
  for (let k = 0; k < MAX_PLAY_MISSES; k++) { const x = playChord(g, notIt.chord); g = x.state; ev = x.event }
  eq('three wrong chords reveal the answer', [ev, saysItem(g)!.revealed], ['gave-up', true])
  eq('a revealed item ignores more chords', playChord(g, chordOf(wantId)).event, 'none')
  const d = dismiss(g); eq('dismiss records a miss', [d.state.results[0].passed, d.state.results[0].stars, d.state.streak], [false, 0, 0])
  eq('dismiss when not revealed does nothing', dismiss(newSays(entries, 1)).event, 'none')
  // SRS: a missed item credited like the game does comes back due
  const p = credit(emptyProgress(), d.state.results[0].id, false, 0, T0, 'echo')
  eq('missed Says word is due', due(p.cards, T0 + 10, 9).map((c) => c.id), [d.state.results[0].id])
}

// ---- Spell Station
{
  const feedAll = (word: string, slip?: { at: number }) => {
    let s = newSpell(word); const events: string[] = []
    const push = (c: Chord) => { const r = spellPlay(s, c); s = r.state; events.push(r.event) }
    push(SPELL_CHORD)
    for (let i = 0; i < word.length; i++) {
      const g = glyphByChar(word[i])!
      if (slip && slip.at === i) push([(g.row % 7) + 1] as unknown as Chord)
      push([g.row] as unknown as Chord); push([g.col] as unknown as Chord)
    }
    push(SPELL_END)
    return { s, events }
  }
  const k = feedAll('koog')
  eq('KOOG docks', k.s.phase, 'docked'); eq('KOOG is clean', spellClean(k.s), true)
  eq('KOOG events', k.events, ['started', 'row-ok', 'letter-done', 'row-ok', 'letter-done', 'row-ok', 'letter-done', 'row-ok', 'letter-done', 'docked'])
  eq('KOOG results are one per distinct letter', spellResults(k.s).map((r) => r.ch + (r.passed ? '+' : '-')), ['k+', 'o+', 'g+'])
  const sl = feedAll('koog', { at: 1 })
  eq('a wrong row is a slip on that letter', [sl.events[3], spellClean(sl.s)], ['row-wrong', false])
  eq('slipped letter fails, others pass', spellResults(sl.s).map((r) => r.ch + (r.passed ? '+' : '-')), ['k+', 'o-', 'g+'])
  const sp2 = feedAll('mary ann'); eq('a name with a space docks', sp2.s.phase, 'docked')
  // order rules
  let s: SpellState = newSpell('ab')
  eq('letters before spell are coached', spellPlay(s, [1] as unknown as Chord).event, 'wrong-start')
  s = spellPlay(s, SPELL_CHORD).state
  eq('end too early', spellPlay(s, SPELL_END).event, 'early-end')
  eq('coach names the row', /row is 1 \(ABCD\)/.test(spellCoach(s)), true)
  s = spellPlay(s, [1] as unknown as Chord).state
  eq('back from the column step', [spellPlay(s, [8] as unknown as Chord).event, spellPlay(s, [8] as unknown as Chord).state.phase], ['back', 'row'])
  s = spellPlay(s, [1] as unknown as Chord).state
  eq('letter a done', [s.pos, s.phase], [1, 'row'])
  eq('back removes a finished letter', spellPlay(s, [8] as unknown as Chord).state.pos, 0)
  eq('back at the very start does nothing', spellPlay(spellPlay(newSpell('a'), SPELL_CHORD).state, [8] as unknown as Chord).event, 'none')
  ok('spellable', spellable('koog') && !spellable('k1') && spellable("o'neil"))
  eq('ships', shipsFor(['maya', 'bad1']), ['koog', 'maya'])
  // the grid fades with mastery and comes back after misses
  eq('grid: new letter full', gridMode(undefined), 'full'); eq('grid: follow shows rows', gridMode({ rung: 'follow', stars: 1, best: 1 }), 'rows')
  eq('grid: memory hidden', gridMode({ rung: 'memory', stars: 3, best: 1 }), 'hidden'); eq('grid: misses bring it back', gridMode({ rung: 'memory', stars: 3, best: 1 }, 2), 'full')
  // the spell chord and the glyph pairs come from the data, not from this file
  eq('spell chord from lexicon', SPELL_CHORD, lexById('spell')!.chord)
}

// ---- Chat
{
  ok('every dialogue word exists in the lexicon', allDialogueWords().every((w) => !!lexById(w)), allDialogueWords().filter((w) => !lexById(w)).join(','))
  eq('3 to 5 dialogues', DIALOGUES.length >= 3 && DIALOGUES.length <= 5, true)
  ok('every dialogue ends and every goto exists', DIALOGUES.every((d) => d.nodes[d.start] && Object.values(d.nodes).every((n) => n.branches.every((b) => b.goto === null || !!d.nodes[b.goto]))))
  ok('every dialogue can finish', DIALOGUES.every((d) => { let c = newChat(d), guard = 0; while (!c.done && guard++ < 10) c = answer(c, d.nodes[c.node].hint).state; return c.done }))
  eq('first chat is always open', availableDialogues({}).map((d) => d.id), ['hello'])
  const metWords: Record<string, { rung: 'hunt'; stars: number; best: number }> = {}
  for (const w of ['i', 'you', 'happy', 'yes', 'no']) metWords[w] = { rung: 'hunt', stars: 1, best: 1 }
  eq('feelings opens when its words are met', availableDialogues(metWords).map((d) => d.id), ['hello', 'feelings'])
  eq('missing words listed', missingFor(DIALOGUES.find((d) => d.id === 'sky')!, metWords), ['star', 'moon', 'see', 'look'])
  eq('wobble locked at the start', wobbleUnlocked({}), false)
  // answers
  const feel = DIALOGUES.find((d) => d.id === 'feelings')!
  let c = newChat(feel)
  eq('Koogalien asks you happy?', [codeOfSay(feel.nodes.a.say), englishOfSay(feel.nodes.a.say)], ['say you happy?', 'you happy?'])
  let r = answer(c, ['i', 'happy']); eq('I happy -> reply, goes to c', [r.event, r.state.node, codeOfSay(r.say!)], ['reply', 'c', 'say friend happy!'])
  eq('nextLine is the follow-up question', englishOfSay(nextLine(r.state)!), 'you love music?')
  r = answer(c, ['no']); eq('no -> sad branch b', [r.event, r.state.node, englishOfSay(r.say!)], ['reply', 'b', 'friend sad.'])
  r = answer(c, ['i', 'not', 'happy']); eq('I not happy matches the no branch', r.state.node, 'b')
  r = answer(c, ['dog']); eq('nonsense retries, node unchanged', [r.event, r.state.node, r.state.turns], ['retry', 'a', 0])
  eq('yes alone counts as happy', answer(c, ['yes']).state.node, 'c')
  eq('negation must agree', matchBranch(feel.nodes.a, ['i', 'not', 'happy'])?.goto, 'b')
  // wobble = excited: only when unlocked and a branch has an excited reply
  const e1 = answer(c, ['i', 'happy'], true, true); eq('excited reply when unlocked', [e1.wobble, englishOfSay(e1.say!)], [true, 'happy!'])
  const e2 = answer(c, ['i', 'happy'], true, false); eq('no excited reply while locked', [e2.wobble, englishOfSay(e2.say!)], [false, 'friend happy!'])
  eq('wobble shows in the code', codeOfSay({ words: ['happy'], end: '!' }, true), 'say happy~wobble!')
  // finishing
  let f = r.state; f = answer({ ...newChat(feel), node: 'c' }, ['yes']).state; eq('chat can finish', [f.done, nextLine(f)], [true, null])
  eq('answers after the end are ignored', answer(f, ['yes']).event, 'none')
  const sk = skipTurn(newChat(feel)); eq('skip takes the model answer so there is no dead end', sk.event, 'reply')
  // reading chords
  eq('closers', [closerOf([5, 8] as unknown as Chord), closerOf([2, 5] as unknown as Chord), closerOf([1, 3, 5, 8] as unknown as Chord), closerOf([1, 3] as unknown as Chord)], ['.', '?', '!', null])
  eq('chord -> word, from the lexicon', ['happy', 'yes', 'no'].map((w) => wordOfChord(chordOf(w))), ['happy', 'yes', 'no'])
  eq('a lone note is not a word', wordOfChord([3] as unknown as Chord), null)
}

// ---- Word Rocket
{
  ok('chill is slower than fast at every level', [1, 2, 3, 4, 5, 6].every((l) => fallMs(l, 'chill') > fallMs(l, 'fast')))
  ok('higher level falls faster', fallMs(6, 'chill') < fallMs(1, 'chill'))
  ok('chill never under 4 seconds, fast never under 2.5', fallMs(99, 'chill') >= 4000 && fallMs(99, 'fast') >= 2500)
  ok('gaps shrink with level', gapMs(6, 'chill') < gapMs(1, 'chill'))
  eq('active meteors by level', [1, 2, 3, 4, 5, 6].map(maxActive), [1, 1, 2, 2, 3, 3])
  // difficulty adapts to the SRS boxes
  const pool = ['hello', 'yes', 'no', 'happy', 'friend', 'world'].map((i) => itemById(i)!)
  eq('new words start at level 2', startLevel(pool, []), 2)
  const high = pool.map((e) => ({ id: e.id, box: 5 as const, due: T0 + 9e9, seen: 9, right: 9 }))
  const low = pool.map((e) => ({ id: e.id, box: 1 as const, due: T0, seen: 9, right: 0 }))
  eq('boxes 5 start at the top level', startLevel(pool, high), MAX_LEVEL)
  ok('a hard word set starts easier than a mastered one', startLevel(pool, low) < startLevel(pool, high))
  // spawn, land, zap
  let s = newRocket(pool, [], 'chill', 0, 6)
  eq('nothing yet', s.meteors.length, 0)
  let t = tick(s, 900); s = t.state; eq('first meteor spawns', [t.events.map((e) => e.event), s.meteors.length], [['spawn'], 1])
  const m0 = s.meteors[0]
  eq('lowest is the oldest', lowest(s)?.uid, m0.uid)
  eq('a wrong chord is a miss, nothing lost', [zap(s, [1, 2, 3, 4] as unknown as Chord, 1000, itemById).event, s.meteors.length], ['miss', 1])
  // a zap
  let z = zap(s, chordOf(m0.id), 1000, itemById); eq('right chord zaps', [z.event, z.state.meteors.length, z.state.zapped], ['zap', 0, [m0.id]])
  // a landing: bounces, id kept for SRS, level eases, no game over
  t = tick(s, 900 + m0.fall + 1); eq('meteor lands', [t.events.some((e) => e.event === 'land' && e.id === m0.id), t.state.landed, t.state.streak], [true, [m0.id], 0])
  ok('landing eases the level', t.state.level <= s.level)
  // level up after three quick zaps in a row
  let u = newRocket(pool, [], 'chill', 0, 10); const lv0 = u.level; let now = 0
  for (let k = 0; k < 3; k++) {
    now += 6000; u = tick(u, now).state
    const m = lowest(u)!; const zz = zap(u, chordOf(m.id), now + 100, itemById); u = zz.state
  }
  eq('three quick zaps raise the level by one', u.level, Math.min(MAX_LEVEL, lv0 + 1)); eq('streak 3', u.streak, 3)
  // slow zaps do not raise it
  let v = newRocket(pool, [], 'chill', 0, 10); now = 0
  for (let k = 0; k < 3; k++) { now += 6000; v = tick(v, now).state; const m = lowest(v)!; v = zap(v, chordOf(m.id), m.spawn + m.fall * 0.9, itemById).state }
  eq('slow zaps keep the level', v.level, v.peak === v.level ? v.level : -1)
  eq('slow zaps: same level as the start', v.level, newRocket(pool, [], 'chill', 0, 10).level)
  // a full round always ends (no stuck state): let every meteor land
  let w = newRocket(pool, [], 'chill', 0, 6); now = 0
  for (let k = 0; k < 400 && !rocketDone(w); k++) { now += 500; w = tick(w, now).state }
  eq('a round with no input still ends', [rocketDone(w), w.landed.length], [true, 6])
  ok('missed words are all accounted for (for SRS)', new Set(w.landed).size === 6)
  // progress down the sky
  ok('progressOf is 0..1', progressOf(m0, 0) === 0 && progressOf(m0, 1e9) === 1)
  // fast mode is quicker than chill from the same start
  eq('fast meteors fall faster', fallMs(newRocket(pool, [], 'fast', 0).level, 'fast') < fallMs(newRocket(pool, [], 'chill', 0).level, 'chill'), true)
}

console.log(`${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
