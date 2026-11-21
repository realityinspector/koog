// Pure: Chat with a Koogalien. A tiny hand-written dialogue tree (no AI, no network): the Koogalien says something, the kid answers by playing
// a sentence, the Koogalien replies. Dialogues unlock as the kid meets more words. Tested by scripts/koogalien-games-fixtures.ts
import type { Chord, Ending, Sentence, Tone, WordSlot } from '../../../koogalien/data/types'
import { lexById } from '../../../koogalien/data/lexicon'
import { matchChord, OK_AT } from '../../../koogalien/engine/match'
import { print } from '../../../koogalien/lang/print'
import { slotOf } from '../../../koogalien/learn/speak'
import { itemById } from '../../../koogalien/learn/items'
import { currentUnit, type WordProg } from '../../../koogalien/learn/ladder'

export interface Say { words: string[]; end: Ending }
export interface Branch {
  /** answers that lead here: each is a list of word ids; the answer must contain it in order */
  any: string[][]
  reply: Say
  /** a happier reply when the kid answered with wobble (excited) and has unlocked it */
  excited?: Say
  goto: string | null
}
export interface Node { say: Say; branches: Branch[]; /** said when nothing matched */ retry: Say; /** words to hint when the kid is stuck */ hint: string[] }
export interface Dialogue { id: string; emoji: string; title: string; voice: 'pip' | 'dro' | 'zee'; /** words the kid should have met first */ requires: string[]; start: string; nodes: Record<string, Node> }

const S = (end: Ending, ...words: string[]): Say => ({ words, end })

export const DIALOGUES: readonly Dialogue[] = [
  { id: 'hello', emoji: '👋', title: 'Say hello', voice: 'pip', requires: [], start: 'a', nodes: {
    a: { say: S('.', 'hello'), hint: ['hello'], retry: S('?', 'hello'), branches: [{ any: [['hello'], ['friend']], reply: S('.', 'hello', 'friend'), goto: 'b' }] },
    b: { say: S('?', 'you', 'happy'), hint: ['i', 'happy'], retry: S('?', 'you', 'happy'), branches: [
      { any: [['i', 'not', 'happy'], ['no']], reply: S('.', 'i', 'love', 'you'), goto: null },
      { any: [['i', 'happy'], ['happy'], ['yes']], reply: S('!', 'friend', 'happy'), excited: S('!', 'happy'), goto: null },
    ] } } },
  { id: 'feelings', emoji: '💛', title: 'How are you?', voice: 'dro', requires: ['i', 'you', 'happy', 'yes', 'no'], start: 'a', nodes: {
    a: { say: S('?', 'you', 'happy'), hint: ['i', 'happy'], retry: S('?', 'you', 'happy'), branches: [
      { any: [['i', 'not', 'happy'], ['no']], reply: S('.', 'friend', 'sad'), goto: 'b' },
      { any: [['i', 'happy'], ['happy'], ['yes']], reply: S('!', 'friend', 'happy'), excited: S('!', 'happy'), goto: 'c' },
    ] },
    b: { say: S('?', 'you', 'want', 'music'), hint: ['yes'], retry: S('?', 'you', 'want', 'music'), branches: [
      { any: [['yes'], ['want', 'music'], ['i', 'want']], reply: S('!', 'we', 'play', 'music'), goto: null },
      { any: [['no']], reply: S('.', 'friend', 'love', 'you'), goto: null },
    ] },
    c: { say: S('?', 'you', 'love', 'music'), hint: ['yes'], retry: S('?', 'you', 'love', 'music'), branches: [
      { any: [['yes'], ['i', 'love', 'music'], ['love', 'music']], reply: S('!', 'we', 'love', 'music'), excited: S('!', 'we', 'love', 'music'), goto: null },
      { any: [['no'], ['i', 'not', 'love', 'music']], reply: S('.', 'music', 'good'), goto: null },
    ] } } },
  { id: 'music', emoji: '🎵', title: 'Music talk', voice: 'pip', requires: ['music', 'love', 'you', 'yes'], start: 'a', nodes: {
    a: { say: S('?', 'you', 'love', 'music'), hint: ['i', 'love', 'music'], retry: S('?', 'you', 'love', 'music'), branches: [
      { any: [['no'], ['i', 'not', 'love', 'music']], reply: S('.', 'friend', 'sad'), goto: null },
      { any: [['yes'], ['i', 'love', 'music'], ['love', 'music']], reply: S('!', 'we', 'love', 'music'), excited: S('!', 'we', 'love', 'music'), goto: 'b' },
    ] },
    b: { say: S('?', 'you', 'want', 'play'), hint: ['yes'], retry: S('?', 'you', 'want', 'play'), branches: [
      { any: [['yes'], ['i', 'want', 'play'], ['play']], reply: S('!', 'play', 'music'), goto: null },
      { any: [['no'], ['not', 'now']], reply: S('.', 'friend', 'good'), goto: null },
    ] } } },
  { id: 'pets', emoji: '🐾', title: 'Cats and dogs', voice: 'dro', requires: ['cat', 'dog', 'yes', 'no', 'love'], start: 'a', nodes: {
    a: { say: S('?', 'you', 'cat'), hint: ['yes'], retry: S('?', 'you', 'cat'), branches: [
      { any: [['yes'], ['i', 'cat']], reply: S('!', 'we', 'love', 'cat'), goto: null },
      { any: [['no']], reply: S('?', 'you', 'dog'), goto: 'b' },
    ] },
    b: { say: S('?', 'you', 'dog'), hint: ['yes'], retry: S('?', 'you', 'dog'), branches: [
      { any: [['yes'], ['i', 'dog']], reply: S('!', 'we', 'love', 'dog'), goto: null },
      { any: [['no']], reply: S('.', 'i', 'sad'), goto: null },
    ] } } },
  { id: 'sky', emoji: '🌙', title: 'Look at the sky', voice: 'zee', requires: ['star', 'moon', 'see', 'look', 'yes'], start: 'a', nodes: {
    a: { say: S('?', 'you', 'see', 'star'), hint: ['yes'], retry: S('?', 'you', 'see', 'star'), branches: [
      { any: [['yes'], ['i', 'see', 'star'], ['see', 'star']], reply: S('!', 'look', 'moon'), goto: 'b' },
      { any: [['no'], ['i', 'not', 'see']], reply: S('!', 'look', 'up'), goto: null },
    ] },
    b: { say: S('?', 'you', 'see', 'moon'), hint: ['yes'], retry: S('?', 'you', 'see', 'moon'), branches: [
      { any: [['yes'], ['i', 'see', 'moon'], ['see', 'moon']], reply: S('!', 'we', 'see', 'star', 'moon'), excited: S('!', 'we', 'see', 'star', 'moon'), goto: null },
      { any: [['no']], reply: S('.', 'look', 'up'), goto: null },
    ] } } },
]

export const dialogueById = (id: string): Dialogue | undefined => DIALOGUES.find((d) => d.id === id)

/** a dialogue is open when the kid has met all the words it asks for (a word is met once it has any rung, or its unit has been reached) */
export function met(id: string, words: Record<string, WordProg>): boolean {
  return words[id]?.rung != null
}
export function availableDialogues(words: Record<string, WordProg>): Dialogue[] {
  return DIALOGUES.filter((d) => d.requires.every((w) => met(w, words)))
}
/** the words a locked dialogue is still waiting for */
export const missingFor = (d: Dialogue, words: Record<string, WordProg>): string[] => d.requires.filter((w) => !met(w, words))
/** wobble (excited) is unlocked with unit 5, where feelings arrive */
export const wobbleUnlocked = (words: Record<string, WordProg>): boolean => currentUnit(words) >= 5

// ---- the kid's answer
export const CLOSERS: Record<string, Ending> = { '5+8': '.', '2+5': '?', '1+3+5+8': '!' }
export const closerOf = (c: Chord): Ending | null => CLOSERS[c.join('+')] ?? null

/** a played chord as a word id, or null if it is not clearly a word */
export function wordOfChord(c: Chord): string | null {
  if (c.length < 2) return null
  const top = matchChord(c)[0]
  return top && top.confidence >= OK_AT ? top.id : null
}

/** the best branch for what was played: an answer matches a branch when it holds one of its answers in order. "no" words must agree:
 *  an answer with no/not never matches a branch that has none. The longest matching answer wins. */
export function matchBranch(node: Node, played: readonly string[]): Branch | null {
  const neg = played.some((w) => w === 'no' || w === 'not')
  let best: { b: Branch; len: number } | null = null
  for (const b of node.branches) for (const a of b.any) {
    const aneg = a.some((w) => w === 'no' || w === 'not')
    if (neg !== aneg) continue
    let k = 0
    for (const w of played) if (w === a[k]) k++
    if (k === a.length && (!best || a.length > best.len)) best = { b, len: a.length }
  }
  return best ? best.b : null
}

export interface ChatState { dialogue: string; node: string; turns: number; done: boolean; lastReply: Say | null; heard: string[] }
export const newChat = (d: Dialogue): ChatState => ({ dialogue: d.id, node: d.start, turns: 0, done: false, lastReply: null, heard: [] })
export type ChatEvent = 'reply' | 'retry' | 'finished' | 'none'

/** the kid answered with these word ids. Returns the next state; `say` is what the Koogalien says now. */
export function answer(st: ChatState, played: readonly string[], excited = false, canWobble = false): { state: ChatState; event: ChatEvent; say: Say | null; wobble: boolean } {
  const d = dialogueById(st.dialogue), node = d?.nodes[st.node]
  if (!d || !node || st.done) return { state: st, event: 'none', say: null, wobble: false }
  const b = matchBranch(node, played)
  if (!b) return { state: { ...st, heard: [...played] }, event: 'retry', say: node.retry, wobble: false }
  const wob = excited && canWobble && !!b.excited
  const reply = wob ? b.excited! : b.reply
  const done = b.goto === null
  return { state: { ...st, node: b.goto ?? st.node, turns: st.turns + 1, done, lastReply: reply, heard: [...played] }, event: done ? 'finished' : 'reply', say: reply, wobble: wob }
}
/** the Koogalien's next line: the reply plus the new question, if the chat goes on */
export function nextLine(st: ChatState): Say | null {
  const d = dialogueById(st.dialogue)
  return st.done || !d ? null : d.nodes[st.node]?.say ?? null
}

// ---- turning a Say into a Sentence (for the ribbon, the code line and playback)
export function sentenceOfSay(s: Say, wobble = false, voice?: string): Sentence {
  const tone: Tone = { loud: 'normal', mods: wobble ? [{ name: 'wobble', depth: 0.6 }] : [] }
  const words: WordSlot[] = s.words.map((id) => ({ ...slotOf(itemById(id) ?? lexById(id)!), tone }))
  return { v: 1, words, end: s.end, alien: voice }
}
export const codeOfSay = (s: Say, wobble = false): string => print(sentenceOfSay(s, wobble))
export const englishOfSay = (s: Say): string => s.words.map((id) => lexById(id)?.en ?? id).join(' ') + s.end
export function chordsOfSay(s: Say): Chord[] { return s.words.map((id) => lexById(id)!.chord) }
export const allDialogueWords = (): string[] => [...new Set(DIALOGUES.flatMap((d) => [...d.requires, ...Object.values(d.nodes).flatMap((n) => [...n.say.words, ...n.retry.words, ...n.hint, ...n.branches.flatMap((b) => [...b.reply.words, ...(b.excited?.words ?? []), ...b.any.flat()])])]))]

/** the kid is stuck: the Koogalien takes the model answer for this question (the hint words) so the chat never dead-ends */
export function skipTurn(st: ChatState): ReturnType<typeof answer> {
  const node = dialogueById(st.dialogue)?.nodes[st.node]
  return answer(st, node ? node.hint : [])
}
