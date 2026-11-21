// Pure: the Agentic Koog Alien decides what to learn and what to say.
// The notebook stays with one player. Nothing here uses the network.
// A new English word gets a free Koogalien chord: a set the core lexicon does not use.
// Tested by scripts/alien-fixtures.ts
import { LEXICON, lexByEnglish } from '../../koogalien/data/lexicon'
import type { Chord, Degree, Sentence, WordSlot } from '../../koogalien/data/types'
import { chordKey, midiOfDegree } from '../../koogalien/data/degrees'
import { chordDistance } from '../../koogalien/engine/match'
import { gloss } from '../../koogalien/engine/gloss'
import { translate } from '../../koogalien/engine/translate'
import { print } from '../../koogalien/lang/print'

export type AlienPose = 'wave' | 'cheer' | 'think' | 'sing' | 'dance' | 'sleep' | 'listen' | 'oops'
export type AlienMood = 'happy' | 'excited' | 'curious' | 'proud' | 'sad'

export interface LearnedWord {
  en: string
  id: string
  chord: number[]
  why: string
}
export interface KeptSong {
  id: string
  title: string
  from: 'book' | 'you'
  notes: number[]
}
export interface AlienMemory {
  v: 1
  words: LearnedWord[]
  songs: KeptSong[]
  heard: number
  line: string
  pose: AlienPose
  mood: AlienMood
  place: string
  /** notes from the last phrase, so a background try can hear them again */
  recent: number[]
  /** background tries, including the ones he let go */
  tries: number
  /** tries he kept */
  kept: number
  /** times a check repaired the notebook */
  fixes: number
  /** last self-check, in his words */
  check: string
}
export interface TuneRef { id: string; title: string; notes: number[] }
export interface Obs {
  kind: 'place' | 'notes' | 'ask' | 'forget-word' | 'forget-song' | 'fresh' | 'study'
  place?: string
  game?: string | null
  notes?: number[]
  /** look up a book song in these notes */
  book?: boolean
  /** when the book has no match, keep an original tune */
  yours?: boolean
  /** count these notes in the notebook */
  count?: boolean
  text?: string
  id?: string
}
export interface StepOut {
  memory: AlienMemory
  sentence: Sentence | null
  code: string
  said: boolean
}

const MAX_WORDS = 40
const MAX_SONGS = 24
const POSES = new Set<AlienPose>(['wave', 'cheer', 'think', 'sing', 'dance', 'sleep', 'listen', 'oops'])
const MOODS = new Set<AlienMood>(['happy', 'excited', 'curious', 'proud', 'sad'])
const SOL = ['', 'do', 're', 'mi', 'fa', 'sol', 'la', 'ti', "do'"]
const CHROMA = ['do', 'ra', 're', 'me', 'mi', 'fa', 'fi', 'sol', 'le', 'la', 'te', 'ti']
const HOME = 60

const INTRO = 'I am the Agentic Koog Alien. I bring Koogalien, and I take care of the KOOG.'
/** He checks integrity, then coherence, then integrity again. */
export const CHECK_HOLD = 'I checked my integrity and my coherence. I checked my integrity again. They hold.'
const CHECK_START = 'I am learning in the background.'
const CHECK_KEPT = 'I tried something new. It held together, so I kept it.'
const CHECK_DROP = 'I tried something new. It did not hold, so I let it go.'
const CHECK_FIX = 'I checked my notebook and fixed what no longer agreed.'
/** Words he may study on his own. Lexicon words are skipped. */
const CURIOSITY = ['sparkle', 'giggle', 'comet', 'brave', 'twirl', 'wonder', 'kindly', 'galaxy', 'moonbeam', 'daydream']

const SCREEN_LINE: Record<string, string> = {
  play: 'I am here with the keys. Play, and I will keep what I hear.',
  songs: 'The songs are out. Play one and I will remember it.',
  games: 'The games are here. Pick one and I will learn its music.',
  challenges: 'A challenge is up. I will keep the notes that get you there.',
  beats: 'The beat is the world right now. I am tapping along.',
  synth: 'The synth is awake. I am learning how this sound speaks.',
  log: 'The build log is open. I keep watch while you read.',
  dj: 'The decks are the world. I am listening to the mix.',
  loops: 'The loops are spinning. I will keep a tune that stays.',
  drums: 'The drums are the world. I am learning the pattern.',
  scenes: 'A scene is up. I am learning the look of this place.',
}
const GAME_LINE: Record<string, string> = {
  zombies: 'Zombie Lanes is the world. I listen for the note that stops each one.',
  jiujitsu: 'The mats are out. I am learning the calls and the answers.',
  fashion: 'The runway is the world. I keep the era and the walk.',
  memory: 'Phrase Match is open. I keep the tunes on the cards.',
  feast: 'The feast is the world. Each phrase can become a dish I remember.',
  tree: 'The tree is the world. I am learning the songs that light it.',
  racer: 'The road is a tune. I keep what the car drives.',
  bachdoom: 'The cathedral is the world. I am listening for the real piece.',
}

const CANDIDATES: Chord[] = (() => {
  const ds: Degree[] = [1, 2, 3, 4, 5, 6, 7, 8]
  const out: Chord[] = []
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) out.push([ds[i], ds[j]])
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) for (let k = j + 1; k < ds.length; k++) out.push([ds[i], ds[j], ds[k]])
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) for (let k = j + 1; k < ds.length; k++) for (let n = k + 1; n < ds.length; n++) out.push([ds[i], ds[j], ds[k], ds[n]])
  return out
})()

const quiet = (memory: AlienMemory, sentence: Sentence | null = null): StepOut => ({ memory, sentence, code: sentence ? print(sentence) : '', said: false })

export function freshMemory(): AlienMemory {
  return { v: 1, words: [], songs: [], heard: 0, line: INTRO, pose: 'wave', mood: 'curious', place: '', recent: [], tries: 0, kept: 0, fixes: 0, check: CHECK_START }
}

export function chordWords(chord: readonly number[]): string {
  return chord.map((d) => SOL[d] ?? String(d)).join(' ')
}

function asDegrees(xs: readonly number[]): Degree[] | null {
  const out: Degree[] = []
  for (const n of xs) {
    if (!Number.isInteger(n) || n < 1 || n > 8) return null
    if (!out.includes(n as Degree)) out.push(n as Degree)
  }
  out.sort((a, b) => a - b)
  return out.length >= 2 && out.length <= 4 ? out : null
}

function blockedChords(words: readonly LearnedWord[]): Chord[] {
  const out: Chord[] = LEXICON.map((e) => e.chord)
  for (const w of words) {
    const c = asDegrees(w.chord)
    if (c) out.push(c)
  }
  return out
}

/** a free chord the core lexicon does not use. Shorter sets go first, so a new word stays easy to play. */
export function pickChord(words: readonly LearnedWord[]): Chord | null {
  const blocked = blockedChords(words)
  const used = new Set(blocked.map(chordKey))
  for (const len of [2, 3, 4]) {
    let best: { c: Chord; d: number; k: string } | null = null
    for (const c of CANDIDATES) {
      if (c.length !== len) continue
      const k = chordKey(c)
      if (used.has(k)) continue
      let min = 1
      for (const b of blocked) {
        const d = chordDistance(c, b)
        if (d < min) min = d
      }
      if (!best || min > best.d || (min === best.d && k < best.k)) best = { c, d: min, k }
    }
    if (best) return best.c
  }
  return null
}

function wordSlot(w: LearnedWord): WordSlot {
  const chord = asDegrees(w.chord) ?? []
  return { kind: 'word', id: w.id, en: w.en, chords: [chord], tone: { loud: 'normal', mods: [] }, confidence: 1, status: 'ok' }
}

function learnWords(mem: AlienMemory, sentence: Sentence): { memory: AlienMemory; sentence: Sentence; fresh: LearnedWord[] } {
  let words = mem.words.slice()
  const fresh: LearnedWord[] = []
  const next = sentence.words.map((slot) => {
    if (slot.kind !== 'spelled') return slot
    const en = slot.en.toLowerCase()
    if (!/^[a-z][a-z']{1,15}$/.test(en)) return slot
    if (lexByEnglish(en)) return slot
    const have = words.find((w) => w.en === en)
    if (have) return have.chord.length ? wordSlot(have) : slot
    const chord = pickChord(words)
    const made: LearnedWord = chord
      ? { en, id: 'learn-' + en.replace(/'/g, ''), chord: [...chord], why: 'You said it, so these notes mean it now.' }
      : { en, id: 'learn-' + en.replace(/'/g, ''), chord: [], why: 'Koogalien spells this one, one letter at a time.' }
    words = [...words, made]
    fresh.push(made)
    return chord ? wordSlot(made) : slot
  })
  if (words.length > MAX_WORDS) words = words.slice(words.length - MAX_WORDS)
  return { memory: { ...mem, words }, sentence: { ...sentence, words: next }, fresh }
}

function intervals(ns: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < ns.length; i++) out.push(ns[i] - ns[i - 1])
  return out
}
function sameInts(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** longest book tune whose opening intervals sit at the end of what was just played */
export function findTune(played: readonly number[], tunes: readonly TuneRef[]): TuneRef | null {
  if (played.length < 4) return null
  const tail = played.slice(-12)
  let best: { t: TuneRef; n: number } | null = null
  for (const t of tunes) {
    if (t.notes.length < 4) continue
    const want = Math.min(8, t.notes.length, tail.length)
    for (let n = want; n >= 4; n--) {
      if (!sameInts(intervals(tail.slice(-n)), intervals(t.notes.slice(0, n)))) continue
      if (!best || n > best.n || (n === best.n && t.id < best.t.id)) best = { t, n }
      break
    }
  }
  return best ? best.t : null
}

function tuneName(notes: readonly number[]): string {
  const base = notes[0]
  const bits = notes.slice(0, 4).map((n) => CHROMA[((n - base) % 12 + 12) % 12])
  return bits.join(' ') + ' tune'
}

function pushSong(songs: readonly KeptSong[], song: KeptSong): KeptSong[] {
  const next = [...songs, song]
  if (next.length <= MAX_SONGS) return next
  const drop = next.findIndex((s) => s.from === 'you' && s.id !== song.id)
  if (drop >= 0) next.splice(drop, 1)
  else next.shift()
  return next
}

function placeLine(place: string, game?: string | null): string {
  if (place === 'games' && game && GAME_LINE[game]) return GAME_LINE[game]
  return SCREEN_LINE[place] ?? 'The world changed. I am learning this place.'
}

function hearNotes(mem: AlienMemory, obs: Obs, tunes: readonly TuneRef[]): StepOut {
  const notes = (obs.notes ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 127)
  if (!notes.length) return quiet(mem)
  const recent = notes.slice(-16)
  let memory: AlienMemory = obs.count
    ? { ...mem, heard: mem.heard + notes.length, pose: 'listen', recent }
    : { ...mem, pose: 'listen', recent }
  if (obs.book) {
    const tune = findTune(notes, tunes)
    if (tune) {
      if (memory.songs.some((s) => s.id === tune.id)) return quiet(memory)
      const song: KeptSong = { id: tune.id, title: tune.title, from: 'book', notes: tune.notes.slice(0, 8) }
      memory = { ...memory, songs: pushSong(memory.songs, song), pose: 'cheer', mood: 'proud', line: `That is ${tune.title}. I will keep it.` }
      return { memory, sentence: null, code: '', said: true }
    }
  }
  if (obs.yours && notes.length >= 6) {
    const slice = notes.slice(-8)
    if (new Set(slice.map((n) => ((n % 12) + 12) % 12)).size >= 3) {
      const id = 'you-' + intervals(slice).join(',')
      if (!memory.songs.some((s) => s.id === id)) {
        const title = tuneName(slice)
        memory = { ...memory, songs: pushSong(memory.songs, { id, title, from: 'you', notes: slice }), pose: 'sing', mood: 'excited', line: `I kept a tune you played. I call it ${title}.` }
        return { memory, sentence: null, code: '', said: true }
      }
    }
  }
  return quiet(memory)
}

function countOf(n: unknown, max: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(max, Math.floor(n)) : 0
}

function youId(notes: readonly number[]): string {
  return 'you-' + intervals(notes).join(',')
}

/** integrity: the notebook's records are true. coherence: they still agree with the language and the book. */
export function audit(mem: AlienMemory, tunes: readonly TuneRef[] = []): { integrity: boolean; coherence: boolean; problems: string[] } {
  const problems: string[] = []
  const seen = new Set<string>()
  const chords = new Set<string>()
  const lexicon = new Set(LEXICON.map((e) => chordKey(e.chord)))
  for (const w of mem.words) {
    if (seen.has(w.en)) problems.push('duplicate word')
    seen.add(w.en)
    if (w.id !== 'learn-' + w.en.replace(/'/g, '')) problems.push('word id drifted')
    if (lexByEnglish(w.en)) problems.push('word already in the language')
    if (w.chord.length) {
      const key = chordKey(w.chord as Chord)
      if (lexicon.has(key) || chords.has(key)) problems.push('chord already means something else')
      chords.add(key)
    }
    const back = learnWords(mem, translate(w.en))
    const slot = back.sentence.words.find((s) => s.en.toLowerCase() === w.en)
    if (!slot) problems.push('word does not translate back')
    else if (w.chord.length) {
      const got = slot.chords[0] ? [...slot.chords[0]] : []
      if (slot.kind !== 'word' || chordKey(got as Chord) !== chordKey(w.chord as Chord)) problems.push('word does not agree with its notes')
    } else if (slot.kind !== 'spelled') problems.push('spelled word grew a chord')
  }
  const songIds = new Set<string>()
  for (const s of mem.songs) {
    if (songIds.has(s.id)) problems.push('duplicate song')
    songIds.add(s.id)
    if (s.from === 'you' && s.id !== youId(s.notes)) problems.push('tune id drifted')
    if (s.from === 'book') {
      const book = tunes.find((t) => t.id === s.id)
      if (tunes.length && !book) problems.push('book song left the book')
      else if (book && book.title !== s.title) problems.push('book song title drifted')
      else if (book && !sameInts(intervals(s.notes.slice(0, Math.min(s.notes.length, book.notes.length))), intervals(book.notes.slice(0, Math.min(s.notes.length, book.notes.length))))) problems.push('book song notes drifted')
    }
  }
  if (mem.place) {
    const [screen, game] = mem.place.split('/')
    const mine = placeLine(screen, game || null)
    const foreign = [...Object.values(SCREEN_LINE), ...Object.values(GAME_LINE)].filter((s) => s !== mine)
    if (foreign.includes(mem.line)) problems.push('line belongs to another place')
  }
  const integrity = !problems.some((p) => p !== 'word does not translate back' && p !== 'word does not agree with its notes' && p !== 'spelled word grew a chord' && p !== 'line belongs to another place' && p !== 'book song title drifted')
  const coherence = !problems.some((p) => p === 'word does not translate back' || p === 'word does not agree with its notes' || p === 'spelled word grew a chord' || p === 'line belongs to another place' || p === 'book song title drifted' || p === 'book song notes drifted')
  return { integrity, coherence, problems }
}

function repair(mem: AlienMemory, tunes: readonly TuneRef[]): { memory: AlienMemory; fixes: number } {
  let fixes = 0
  const words: LearnedWord[] = []
  const seen = new Set<string>()
  const chords = new Set(LEXICON.map((e) => chordKey(e.chord)))
  for (const w of mem.words) {
    if (seen.has(w.en) || lexByEnglish(w.en)) { fixes++; continue }
    if (w.id !== 'learn-' + w.en.replace(/'/g, '')) { fixes++; continue }
    if (w.chord.length) {
      const key = chordKey(w.chord as Chord)
      if (chords.has(key)) { fixes++; continue }
      chords.add(key)
    }
    const back = learnWords(mem, translate(w.en))
    const slot = back.sentence.words.find((s) => s.en.toLowerCase() === w.en)
    const agree = !!slot && (w.chord.length
      ? slot.kind === 'word' && chordKey((slot.chords[0] ? [...slot.chords[0]] : []) as Chord) === chordKey(w.chord as Chord)
      : slot.kind === 'spelled')
    if (!agree) { fixes++; continue }
    seen.add(w.en)
    words.push(w)
  }
  const songs: KeptSong[] = []
  const songIds = new Set<string>()
  for (const s of mem.songs) {
    if (songIds.has(s.id)) { fixes++; continue }
    if (s.from === 'you') {
      if (s.id !== youId(s.notes)) { fixes++; continue }
      songIds.add(s.id)
      songs.push(s)
      continue
    }
    const book = tunes.find((t) => t.id === s.id)
    if (tunes.length && !book) { fixes++; continue }
    if (book && !sameInts(intervals(s.notes.slice(0, Math.min(8, book.notes.length))), intervals(book.notes.slice(0, Math.min(8, s.notes.length))))) { fixes++; continue }
    const title = book?.title ?? s.title
    if (title !== s.title) fixes++
    songIds.add(s.id)
    songs.push({ ...s, title })
  }
  let line = mem.line
  if (mem.place) {
    const [screen, game] = mem.place.split('/')
    const mine = placeLine(screen, game || null)
    const foreign = [...Object.values(SCREEN_LINE), ...Object.values(GAME_LINE)].filter((s) => s !== mine)
    if (foreign.includes(line)) { line = mine; fixes++ }
  }
  return { memory: { ...mem, words, songs, line }, fixes }
}

function candidateWord(mem: AlienMemory): string | null {
  const have = new Set(mem.words.map((w) => w.en))
  const pool: string[] = []
  const add = (en: string) => {
    const w = en.toLowerCase()
    if (!/^[a-z][a-z']{2,15}$/.test(w) || have.has(w) || lexByEnglish(w) || pool.includes(w)) return
    pool.push(w)
  }
  for (const s of mem.songs) for (const part of s.title.toLowerCase().split(/[^a-z']+/)) add(part)
  for (const w of CURIOSITY) add(w)
  return pool.length ? pool[mem.tries % pool.length] : null
}

/** One background pass. Repair first (integrity). Then one new try. Then integrity, coherence, and integrity again. A try that fails is dropped. */
function study(mem: AlienMemory, obs: Obs, tunes: readonly TuneRef[]): StepOut {
  const repaired = repair(mem, tunes)
  if (repaired.fixes) {
    const memory: AlienMemory = { ...repaired.memory, tries: mem.tries + 1, fixes: mem.fixes + repaired.fixes, pose: 'think', mood: 'curious', line: CHECK_FIX, check: CHECK_FIX }
    return { memory, sentence: null, code: '', said: true }
  }
  let memory = repaired.memory
  const notes = (obs.notes?.length ? obs.notes : memory.recent).filter((n) => Number.isInteger(n) && n >= 0 && n <= 127)
  let learned = false
  if (memory.tries % 3 === 0) {
    const word = candidateWord(memory)
    if (word) {
      const next = learnWords(memory, translate(word))
      if (next.fresh.length) {
        memory = { ...next.memory, pose: 'think', mood: 'curious', line: `I tried a new word on my own. I learned ${next.fresh[0].en}.` }
        learned = true
      }
    }
  } else if (memory.tries % 3 === 1 && notes.length >= 4) {
    const heard = hearNotes(memory, { kind: 'notes', notes, book: true, yours: notes.length >= 6 }, tunes)
    if (heard.said) {
      memory = { ...heard.memory, line: `I tried the notes again. ${heard.memory.line}` }
      learned = true
    }
  } else if (memory.words.length) {
    const word = memory.words[memory.tries % memory.words.length]
    const back = learnWords(memory, translate(word.en))
    const slot = back.sentence.words.find((s) => s.en.toLowerCase() === word.en)
    const agree = !!slot && (word.chord.length
      ? slot.kind === 'word' && chordKey((slot.chords[0] ? [...slot.chords[0]] : []) as Chord) === chordKey(word.chord as Chord)
      : slot.kind === 'spelled')
    if (!agree) {
      memory = { ...memory, words: memory.words.filter((w) => w.en !== word.en), pose: 'think', line: CHECK_FIX, check: CHECK_FIX }
      learned = false
      const memoryFixed: AlienMemory = { ...memory, tries: mem.tries + 1, fixes: mem.fixes + 1 }
      return { memory: memoryFixed, sentence: null, code: '', said: true }
    }
  }
  const first = audit(memory, tunes)
  const second = audit(memory, tunes)
  const held = first.integrity && first.coherence && second.integrity
  if (!held) {
    const check = CHECK_DROP
    const say = mem.check !== check
    memory = { ...repaired.memory, tries: mem.tries + 1, check, line: say ? check : repaired.memory.line, pose: 'think' }
    return { memory, sentence: null, code: '', said: say }
  }
  memory = { ...memory, tries: mem.tries + 1, kept: mem.kept + (learned ? 1 : 0) }
  if (learned) return { memory: { ...memory, check: CHECK_KEPT }, sentence: null, code: '', said: true }
  const pose = mem.pose === 'listen' ? 'listen' : memory.pose
  return { memory: { ...memory, pose, check: CHECK_HOLD }, sentence: null, code: '', said: false }
}

/** one decision. The same memory and the same observation always give the same next notebook. */
export function step(mem: AlienMemory, obs: Obs, tunes: readonly TuneRef[] = []): StepOut {
  if (obs.kind === 'study') return study(mem, obs, tunes)
  if (obs.kind === 'fresh') {
    const memory = freshMemory()
    return { memory, sentence: null, code: '', said: true }
  }
  if (obs.kind === 'place') {
    const place = (obs.place || 'play').slice(0, 40)
    const key = place + (obs.game ? '/' + obs.game : '')
    if (mem.place === key) return quiet(mem)
    const memory: AlienMemory = { ...mem, place: key, pose: 'wave', mood: 'curious', line: placeLine(place, obs.game) }
    return { memory, sentence: null, code: '', said: true }
  }
  if (obs.kind === 'notes') return hearNotes(mem, obs, tunes)
  if (obs.kind === 'forget-word') {
    const words = mem.words.filter((w) => w.id !== obs.id)
    if (words.length === mem.words.length) return quiet(mem)
    return { memory: { ...mem, words, pose: 'think', mood: 'curious', line: 'I let that word go. I can learn it again.' }, sentence: null, code: '', said: true }
  }
  if (obs.kind === 'forget-song') {
    const songs = mem.songs.filter((s) => s.id !== obs.id)
    if (songs.length === mem.songs.length) return quiet(mem)
    return { memory: { ...mem, songs, pose: 'think', mood: 'curious', line: 'I let that song go. Play it and I can keep it again.' }, sentence: null, code: '', said: true }
  }
  const text = (obs.text ?? '').trim()
  if (!text) {
    return { memory: { ...mem, pose: 'think', mood: 'curious', line: 'Type a word and I will turn it into Koogalien.' }, sentence: null, code: '', said: true }
  }
  const learned = learnWords(mem, translate(text))
  const sentence = learned.sentence
  const code = print(sentence)
  const named = (w: LearnedWord) => w.chord.length ? `${w.en}, ${chordWords(w.chord)}` : `${w.en}, spelled one letter at a time`
  let line: string
  if (!sentence.words.length) line = 'I could not find words in that.'
  else if (learned.fresh.length === 1) line = learned.fresh[0].chord.length
    ? `I learned ${learned.fresh[0].en}. Its notes are ${chordWords(learned.fresh[0].chord)}.`
    : `I learned ${learned.fresh[0].en}. Koogalien spells it, one letter at a time.`
  else if (learned.fresh.length > 1) line = `I learned ${learned.fresh.length} words. The first is ${named(learned.fresh[0])}.`
  else line = `In Koogalien that is ${gloss(sentence)}.`
  const memory: AlienMemory = { ...learned.memory, pose: learned.fresh.length ? 'think' : 'sing', mood: learned.fresh.length ? 'curious' : 'happy', line }
  return { memory, sentence, code, said: true }
}

/** chords of a sentence as MIDI, home C, so the alien can say it */
export function chordsToMidi(sentence: Sentence): number[][] {
  const out: number[][] = []
  for (const w of sentence.words) for (const c of w.chords) out.push(c.map((d) => midiOfDegree(d, HOME)))
  return out.slice(0, 24)
}

function cleanWord(raw: unknown): LearnedWord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as LearnedWord
  if (typeof o.en !== 'string' || !/^[a-z][a-z']{1,15}$/.test(o.en)) return null
  if (lexByEnglish(o.en)) return null
  const chord = Array.isArray(o.chord) && o.chord.length === 0 ? [] : asDegrees(Array.isArray(o.chord) ? o.chord : [])
  if (!chord) return null
  const id = 'learn-' + o.en.replace(/'/g, '')
  const why = typeof o.why === 'string' && o.why.trim() ? o.why.slice(0, 120) : 'You said it, so these notes mean it now.'
  return { en: o.en, id, chord: [...chord], why }
}

function cleanSong(raw: unknown): KeptSong | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as KeptSong
  if (typeof o.id !== 'string' || !o.id || o.id.length > 80) return null
  if (typeof o.title !== 'string' || !o.title.trim()) return null
  if (o.from !== 'book' && o.from !== 'you') return null
  if (!Array.isArray(o.notes) || o.notes.length < 4 || o.notes.length > 16) return null
  if (!o.notes.every((n) => Number.isInteger(n) && n >= 0 && n <= 127)) return null
  return { id: o.id, title: o.title.slice(0, 80), from: o.from, notes: o.notes.slice() }
}

/** drop a broken notebook back to a fresh one, and drop words whose chord the core lexicon already uses */
export function sanitizeMemory(raw: unknown): AlienMemory {
  if (!raw || typeof raw !== 'object') return freshMemory()
  const o = raw as Partial<AlienMemory>
  if (o.v !== 1) return freshMemory()
  const words: LearnedWord[] = []
  const seen = new Set<string>()
  const used = new Set(LEXICON.map((e) => chordKey(e.chord)))
  for (const w of Array.isArray(o.words) ? o.words : []) {
    const c = cleanWord(w)
    if (!c || seen.has(c.en)) continue
    if (c.chord.length) {
      const key = chordKey(c.chord as Chord)
      if (used.has(key)) continue
      used.add(key)
    }
    seen.add(c.en)
    words.push(c)
    if (words.length >= MAX_WORDS) break
  }
  const songs: KeptSong[] = []
  const songIds = new Set<string>()
  for (const s of Array.isArray(o.songs) ? o.songs : []) {
    const c = cleanSong(s)
    if (!c || songIds.has(c.id)) continue
    songIds.add(c.id)
    songs.push(c)
    if (songs.length >= MAX_SONGS) break
  }
  const pose = POSES.has(o.pose as AlienPose) ? o.pose as AlienPose : 'wave'
  const mood = MOODS.has(o.mood as AlienMood) ? o.mood as AlienMood : 'curious'
  const line = typeof o.line === 'string' && o.line.trim() ? o.line.slice(0, 280) : INTRO
  const place = typeof o.place === 'string' ? o.place.slice(0, 48) : ''
  const heard = typeof o.heard === 'number' && Number.isFinite(o.heard) && o.heard > 0 ? Math.min(1_000_000, Math.floor(o.heard)) : 0
  const recent = Array.isArray(o.recent) ? o.recent.filter((n) => Number.isInteger(n) && n >= 0 && n <= 127).slice(-16) : []
  const check = typeof o.check === 'string' && o.check.trim() ? o.check.slice(0, 280) : CHECK_START
  return { v: 1, words, songs, heard, line, pose, mood, place, recent, tries: countOf(o.tries, 1_000_000), kept: countOf(o.kept, 1_000_000), fixes: countOf(o.fixes, 1_000_000), check }
}
