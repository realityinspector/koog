// Agentic Koog Alien: translate, learn a free chord, keep a song, adapt to a place.
//   npx --no-install tsx scripts/alien-fixtures.ts
import { CHECK_HOLD, chordWords, chordsToMidi, findTune, freshMemory, pickChord, sanitizeMemory, step } from '../src/features/alien/agent'
import { chordKey } from '../src/koogalien/data/degrees'
import { LEXICON } from '../src/koogalien/data/lexicon'

let fails = 0
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) return
  fails++
  console.error('FAIL', name, extra ?? '')
}

const used = new Set(LEXICON.map((e) => chordKey(e.chord)))
const mem = freshMemory()
const hello = step(mem, { kind: 'ask', text: 'hello' })
ok('hello is already Koogalien', hello.memory.words.length === 0, hello.memory.words)
ok('hello code', hello.code === 'say hello.', hello.code)
ok('hello midi is do and la', JSON.stringify(chordsToMidi(hello.sentence!)) === JSON.stringify([[60, 69]]))

const learned = step(mem, { kind: 'ask', text: 'zizzle' })
ok('zizzle is a new word', learned.memory.words.length === 1 && learned.memory.words[0].en === 'zizzle')
ok('zizzle code is a word, not a spelling', learned.code === 'say zizzle.', learned.code)
const zChord = learned.memory.words[0].chord
ok('zizzle chord is free', zChord.length >= 2 && !used.has(chordKey(zChord as never)), zChord)
ok('zizzle line names the notes', learned.memory.line.includes('zizzle') && learned.memory.line.includes(chordWords(zChord)))

const again = step(learned.memory, { kind: 'ask', text: 'zizzle' })
ok('second zizzle is not a second word', again.memory.words.length === 1)
ok('same chord next time', chordKey(again.memory.words[0].chord as never) === chordKey(zChord as never))

const two = step(learned.memory, { kind: 'ask', text: 'quibble' })
ok('two learned words get two chords', two.memory.words.length === 2)
ok('chords differ', chordKey(two.memory.words[0].chord as never) !== chordKey(two.memory.words[1].chord as never))
ok('pick is stable', JSON.stringify(pickChord([])) === JSON.stringify(pickChord([])))

const ode = [{ id: 'ode', title: 'Ode to Joy', notes: [64, 64, 65, 67, 67, 65, 64, 62] }]
const heard = step(mem, { kind: 'notes', notes: [64, 64, 65, 67], book: true })
ok('four Es are not a song without a book', heard.memory.songs.length === 0)
const kept = step(mem, { kind: 'notes', notes: [64, 64, 65, 67], book: true }, ode)
ok('ode is kept once', kept.said && kept.memory.songs.length === 1 && kept.memory.songs[0].title === 'Ode to Joy')
const kept2 = step(kept.memory, { kind: 'notes', notes: [60, 64, 64, 65, 67], book: true, yours: true, count: true }, ode)
ok('ode is not kept twice', kept2.memory.songs.length === 1 && kept2.said === false)
ok('notes get counted on the rest', kept2.memory.heard === 5)

const mine = step(mem, { kind: 'notes', notes: [60, 62, 64, 65, 67, 69], book: true, yours: true }, ode)
ok('a scale I played gets a name', mine.memory.songs.length === 1 && mine.memory.songs[0].from === 'you' && mine.memory.songs[0].title.endsWith('tune'))
const flat = step(mem, { kind: 'notes', notes: [60, 60, 60, 60, 60, 60], book: true, yours: true }, [])
ok('one note repeating is not a tune', flat.memory.songs.length === 0)

const longer = findTune([60, 62, 64, 65, 67], [
  { id: 'b', title: 'Short', notes: [60, 62, 64, 65] },
  { id: 'a', title: 'Long', notes: [60, 62, 64, 65, 67] },
])
ok('longer opening wins', longer?.id === 'a')

const play = step(mem, { kind: 'place', place: 'play' })
ok('play place speaks', play.said && play.memory.line.includes('keys'))
const stay = step(play.memory, { kind: 'place', place: 'play' })
ok('same place stays quiet', stay.said === false && stay.memory === play.memory)
const feast = step(play.memory, { kind: 'place', place: 'games', game: 'feast' })
ok('the feast is a different world', feast.said && feast.memory.line.includes('feast'))

const gone = step(learned.memory, { kind: 'forget-word', id: 'learn-zizzle' })
ok('a word can be let go', gone.memory.words.length === 0)
const empty = step(kept.memory, { kind: 'fresh' })
ok('an empty notebook is the introduction', empty.memory.words.length === 0 && empty.memory.songs.length === 0 && empty.memory.line.includes('Agentic Koog Alien'))

const letters = 'abcdefghijklmnopqrstuvwxyz'
let book = freshMemory()
for (let i = 0; i < 50; i++) book = step(book, { kind: 'ask', text: 'zz' + letters[i % 26] + letters[Math.floor(i / 26) % 26] }).memory
ok('learning continues after the free chords run out', book.words.some((w) => w.chord.length === 0))
ok('the notebook stays capped', book.words.length <= 40 && book.words.length > 0)

const junk = sanitizeMemory({ v: 1, words: [{ en: 'hello', id: 'x', chord: [1, 6], why: 'no' }, { en: 'zizzle', chord: [9], why: '' }, { en: 'quibble', chord: [3, 4, 6], why: 'ok' }, { en: 'blip', chord: [], why: 'spelled' }], songs: [{ id: 'x' }], line: 4, pose: 'nope' })
ok('core words and broken chords are dropped', junk.words.length === 2 && junk.words.some((w) => w.en === 'quibble') && junk.words.some((w) => w.en === 'blip' && w.chord.length === 0))
ok('a broken song and a bad pose do not crash', junk.songs.length === 0 && junk.pose === 'wave' && junk.line.includes('Agentic'))
ok('not a notebook', sanitizeMemory(null).v === 1)
ok('two spelled words both stay', sanitizeMemory({ v: 1, words: [{ en: 'blip', chord: [], why: 'a' }, { en: 'blop', chord: [], why: 'a' }] }).words.length === 2)

const studied = step(freshMemory(), { kind: 'study' })
ok('a background try learns one word', studied.said && studied.memory.words.length === 1 && studied.memory.tries === 1 && studied.memory.kept === 1)
ok('the try says he did it himself', studied.memory.line.includes('on my own') && studied.memory.line.includes(studied.memory.words[0].en))
const quietStudy = step({ ...studied.memory, tries: 2 }, { kind: 'study' })
ok('a check with nothing new stays quiet', quietStudy.said === false && quietStudy.memory.words.length === 1 && quietStudy.memory.check === CHECK_HOLD && quietStudy.memory.line === studied.memory.line)

const odeNotes = [64, 64, 65, 67]
const againSong = step({ ...studied.memory, tries: 1 }, { kind: 'study', notes: odeNotes }, ode)
ok('the next try can keep a song from the notes', againSong.said && againSong.memory.songs.length === 1 && againSong.memory.songs[0].title === 'Ode to Joy')

const shared = [3, 4, 6]
const poisoned = {
  ...freshMemory(),
  words: [
    { en: 'zizzle', id: 'learn-zizzle', chord: shared, why: 'a' },
    { en: 'quibble', id: 'learn-quibble', chord: shared, why: 'a' },
  ],
}
const fixed = step(poisoned, { kind: 'study' })
ok('a shared chord fails integrity and is fixed', fixed.said && fixed.memory.words.length === 1 && fixed.memory.fixes === 1 && fixed.memory.check.includes('fixed'))

const drifted = { ...freshMemory(), place: 'play', line: 'The feast is the world. Each phrase can become a dish I remember.' }
const cohere = step(drifted, { kind: 'study' })
ok('a line from another place fails coherence', cohere.said && !cohere.memory.line.includes('feast'))

console.log(fails ? `\n${fails} failure(s)` : 'alien fixtures: all ok')
process.exit(fails ? 1 : 0)
