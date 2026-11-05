// Pure: tokens -> Sentence reducer. step(state, input) -> {state, out[]}; no timers, no audio, no DOM, plain-data state, deterministic.
// A chord is the notes that start within chordMs of the first one (or, in chord-builder mode, until a 'commit'). A chord is a word, a lone note is a digit,
// closers end the sentence, `spell` starts spell mode (row note, then column note = a letter; lone 8 = backspace; 5+8 ends spelling).
// Pedal / screen buttons = word boundary (closes the open chord); two with no music between = end of sentence. A rest of sentenceGapBeats ends a sentence by itself ('.').
// Tested by scripts/koogalien-fixtures.ts
import type { KodeToken } from '../../kode/kodeCore'
import { SPELL_END, glyphByPair } from '../data/alphabet'
import { degreeOf } from '../data/degrees'
import { lexById } from '../data/lexicon'
import { loudnessOfVel } from '../data/tone'
import { DEFAULT_DECODE, KOOGALIEN_VERSION, LIMITS } from '../data/types'
import type { Chord, DecodeOpts, Degree, Dims, Ending, ModName, ModSample, Sentence, Tone, WordSlot } from '../data/types'
import { MAYBE_AT, OK_AT, matchChord } from './match'

export type RecInput =
  | { type: 'token'; token: KodeToken & { dims?: Dims } }
  | { type: 'mod'; sample: ModSample }
  | { type: 'commit'; t: number }          // chord-builder commit (pedal tap or OK pad)
  | { type: 'boundary'; t: number }        // on-screen Space: a word break
  | { type: 'end'; t: number; ending?: Ending }   // on-screen End: close the sentence now
  | { type: 'tick'; t: number }
export interface RecState { readonly _: unknown }   // opaque, plain data
export type RecOut =
  | { type: 'chord'; chord: Chord }                              // a chord closed (live feedback)
  | { type: 'letter'; ch: string }                               // spell mode: a letter completed ('\b' = a letter was rubbed out)
  | { type: 'word'; word: WordSlot; index: number }
  | { type: 'sentence'; sentence: Sentence }

interface Note { d: Degree; vel: number; pitch?: number }
interface S {
  o: DecodeOpts
  cur: { first: number; notes: Note[]; dims?: Dims } | null
  words: WordSlot[]
  spell: { letters: string[]; chords: Chord[]; half: Degree | null; tone: Tone } | null
  /** onset time of the latest musical input, for rests */
  lastT: number | null
  /** the spell-mode timeout already fired once */
  pedalAt: number | null
  mods: { name: ModName; since: number; value: number }[]
  /** wheel/slider samples that were held above threshold: the level seen during the word */
  wobble: { since: number | null; held: boolean }
  modLevel: number
  wordMod: number
  end: Ending | null
}

const A = (s: RecState) => s as unknown as S
const W = (s: S) => s as unknown as RecState
const beatMs = (o: DecodeOpts) => 60000 / o.bpm
export function newRecState(o?: Partial<DecodeOpts>): RecState {
  const s: S = { o: { ...DEFAULT_DECODE, ...o }, cur: null, words: [], spell: null, lastT: null, pedalAt: null, mods: [], wobble: { since: null, held: false }, modLevel: 0, wordMod: 0, end: null }
  return W(s)
}

const CLOSERS: { key: string; end: Ending }[] = [
  { key: '5+8', end: '.' }, { key: '2+5', end: '?' }, { key: '1+3+5+8', end: '!' },
]
const keyOf = (c: readonly number[]) => c.join('+')

function clone(s: S): S {
  return { ...s, o: s.o, cur: s.cur ? { ...s.cur, notes: [...s.cur.notes] } : null, words: [...s.words], spell: s.spell ? { letters: [...s.spell.letters], chords: [...s.spell.chords], half: s.spell.half, tone: s.spell.tone } : null, mods: [], wobble: { ...s.wobble } }
}

const toneOf = (notes: Note[], wobbled: boolean, depth: number): Tone => {
  const vel = notes.length ? notes.reduce((a, n) => a + n.vel, 0) / notes.length : 0.5
  return { loud: loudnessOfVel(vel), mods: wobbled ? [{ name: 'wobble', depth: Math.round(depth * 100) / 100 }] : [] }
}

/** the pitch-like degree of a token, or null (black key, button) */
function degreeOfToken(t: KodeToken, o: DecodeOpts): Degree | null {
  if (t.lane != null) return (Math.min(7, Math.max(0, t.lane)) + 1) as Degree
  if (t.pitch != null) return degreeOf(t.pitch, o.homeC)
  return null
}

function closeChord(s: S, out: RecOut[], forceNoSpell = false): void {
  const cur = s.cur
  if (!cur) return
  s.cur = null
  const set = Array.from(new Set(cur.notes.map(n => n.d))).sort((a, b) => a - b) as Degree[]
  if (!set.length) return
  const chord: Chord = set
  out.push({ type: 'chord', chord })
  const pitched = cur.notes.map(n => n.pitch).filter((p): p is number => p != null)
  const base = (): Partial<WordSlot> => {
    const r: Partial<WordSlot> = { ...(cur.dims ?? {}) }
    if (pitched.length) r.bass = Math.min(...pitched)   // raw lowest note kept even though matching folds to degrees
    return r
  }
  const wobbled = s.wordMod >= s.o.modThreshold
  const tone = toneOf(cur.notes, wobbled, s.wordMod)
  s.wordMod = 0

  if (s.spell && !forceNoSpell) {
    const sp = s.spell
    const k = keyOf(chord)
    if (chord.length === 1) {
      const d = chord[0]
      if (sp.half == null) {
        if (d === 8) {   // backspace
          if (sp.letters.length) { sp.letters.pop(); sp.chords.pop(); sp.chords.pop(); out.push({ type: 'letter', ch: '\b' }) }
        } else sp.half = d
      } else if (d === 8) sp.half = null   // oops: drop the half letter
      else if (d <= 4) {
        const g = glyphByPair(sp.half, d)
        if (g && sp.letters.length < LIMITS.lettersPerSpell) { sp.letters.push(g.ch); sp.chords.push([sp.half], [d]); out.push({ type: 'letter', ch: g.ch }) }
        sp.half = null
      } else sp.half = d <= 7 ? d : null   // not a column: treat as a fresh row pick
      return
    }
    if (k === keyOf(SPELL_END)) { finishSpell(s, out, tone); return }
    const cl = CLOSERS.find(c => c.key === k)
    if (cl) { finishSpell(s, out, tone); endSentence(s, out, cl.end); return }
    return   // other chords inside spell mode are ignored
  }

  if (chord.length === 1) {
    const d = chord[0]
    push(s, out, { kind: 'digit', id: null, en: String(d), chords: [chord], tone, confidence: 1, status: 'ok', ...base() })
    return
  }
  const k = keyOf(chord)
  const cl = CLOSERS.find(c => c.key === k)
  if (cl) { endSentence(s, out, cl.end); return }
  if (k === '1+2') { s.spell = { letters: [], chords: [chord], half: null, tone }; return }
  const alts = matchChord(chord, s.o.known)
  const best = alts[0]
  if (best && best.confidence >= MAYBE_AT && chord.length <= 4) {   // words are 1..4 keys; more is a smash, not a word
    const e = lexById(best.id)!
    const maybe = best.confidence < OK_AT
    push(s, out, {
      kind: 'word', id: e.id, en: e.en, chords: [chord], tone, confidence: best.confidence,
      status: maybe && !s.o.autoAccept ? 'maybe' : 'ok', ...(maybe ? { alts } : {}), ...base(),
    })
    return
  }
  push(s, out, { kind: 'unknown', id: null, en: chord.join('+'), chords: [chord], tone, confidence: best ? best.confidence : 0, status: 'unknown', ...(alts.length ? { alts } : {}), ...base() })
}

function push(s: S, out: RecOut[], w: WordSlot): void {
  if (s.words.length >= LIMITS.wordsPerSentence) return
  s.words.push(w)
  out.push({ type: 'word', word: w, index: s.words.length - 1 })
}

function finishSpell(s: S, out: RecOut[], tone: Tone): void {
  const sp = s.spell
  s.spell = null
  if (!sp || !sp.letters.length) return
  push(s, out, { kind: 'spelled', id: null, en: sp.letters.join(''), chords: [...sp.chords, SPELL_END], tone: { loud: sp.tone.loud, mods: sp.tone.mods }, confidence: 1, status: 'ok' })
}

function endSentence(s: S, out: RecOut[], end: Ending): void {
  const sentence: Sentence = { v: KOOGALIEN_VERSION, words: s.words, end }
  s.words = []
  s.spell = null
  s.pedalAt = null
  out.push({ type: 'sentence', sentence })
}

export function step(state: RecState, i: RecInput): { state: RecState; out: RecOut[] } {
  const s = clone(A(state))
  const out: RecOut[] = []
  const o = s.o
  const bMs = beatMs(o)

  const closeIfStale = (t: number) => {
    if (s.cur && !o.chordBuilder && t - s.cur.first > o.chordMs) closeChord(s, out)
  }
  const rest = (t: number) => {   // rests since the last musical input
    if (s.lastT == null) return
    const gap = t - s.lastT
    const long = o.sentenceGapBeats * bMs
    if (s.spell && gap >= long) {   // a long rest ends spelling first (a half letter is dropped)
      closeChord(s, out)
      finishSpell(s, out, { loud: 'normal', mods: [] })
      s.lastT = t - (gap - long)   // the sentence rest starts counting after the spell timeout
      return
    }
    if (!s.spell && s.words.length && gap >= long) {
      closeChord(s, out)
      endSentence(s, out, '.')
      s.lastT = null
    }
  }

  switch (i.type) {
    case 'token': {
      const tk = i.token
      const isBtn = tk.pitch == null && tk.lane == null
      if (isBtn) {   // pedal / screen button
        closeChord(s, out)
        if (o.chordBuilder) break
        if (s.spell && s.pedalAt == null) { s.pedalAt = tk.t; finishSpell(s, out, { loud: 'normal', mods: [] }); break }
        if (s.pedalAt != null && tk.t - s.pedalAt <= o.sentenceGapBeats * bMs) { if (s.words.length) endSentence(s, out, '.'); s.pedalAt = null; s.lastT = null; break }
        s.pedalAt = tk.t
        break
      }
      rest(tk.t)
      closeIfStale(tk.t)
      const d = degreeOfToken(tk, o)
      if (d == null) break   // black keys are ignored
      s.pedalAt = null
      s.lastT = tk.t
      const n: Note = { d, vel: tk.vel, ...(tk.pitch != null ? { pitch: tk.pitch } : {}) }
      if (!s.cur) s.cur = { first: tk.t, notes: [n], ...(tk.dims ? { dims: tk.dims } : {}) }
      else { s.cur.notes.push(n); if (tk.dims && !s.cur.dims) s.cur.dims = tk.dims }
      break
    }
    case 'mod': {
      const m = i.sample
      const v = m.kind === 'bend' ? Math.abs(m.value) : m.value
      if (v >= o.modThreshold) {
        if (s.wobble.since == null) s.wobble.since = m.t
        if (m.t - s.wobble.since >= o.modHoldMs) { s.wobble.held = true; s.wordMod = Math.max(s.wordMod, v) }
      } else { s.wobble.since = null; s.wobble.held = false }
      // a wheel already held up when the word is played keeps counting for the next word too
      if (s.wobble.held) s.wordMod = Math.max(s.wordMod, v)
      break
    }
    case 'commit': {
      if (s.cur) { closeChord(s, out); s.pedalAt = null } else if (s.spell) finishSpell(s, out, { loud: 'normal', mods: [] })
      break
    }
    case 'boundary': { closeChord(s, out); break }
    case 'end': {
      closeChord(s, out)
      if (s.spell) finishSpell(s, out, { loud: 'normal', mods: [] })
      if (s.words.length) endSentence(s, out, i.ending ?? '.')
      s.lastT = null
      break
    }
    case 'tick': {
      closeIfStale(i.t)
      rest(i.t)
      break
    }
  }
  return { state: W(s), out }
}

export function pending(state: RecState): { chords: Chord[]; words: WordSlot[]; spelling: boolean; half: Degree | null } {
  const s = A(state)
  const chords: Chord[] = []
  if (s.cur) chords.push(Array.from(new Set(s.cur.notes.map(n => n.d))).sort((a, b) => a - b) as Degree[])
  return { chords, words: s.words, spelling: s.spell != null, half: s.spell?.half ?? null }
}

/** run a whole recording; a final 'end' closes anything left. Pure. */
export function decodeAll(tokens: readonly KodeToken[], mods: readonly ModSample[] = [], o?: Partial<DecodeOpts>): Sentence {
  let st = newRecState(o)
  const evs: { t: number; i: RecInput }[] = [
    ...tokens.map((token, k) => ({ t: token.t, k, i: { type: 'token', token } as RecInput })),
    ...mods.map((sample, k) => ({ t: sample.t, k: 1e6 + k, i: { type: 'mod', sample } as RecInput })),
  ].sort((a, b) => a.t - b.t || (a as { k: number }).k - (b as { k: number }).k)
  const words: WordSlot[] = []
  let end: Ending = '.'
  let ended = false
  const take = (out: RecOut[]) => { for (const x of out) if (x.type === 'sentence') { words.push(...x.sentence.words); end = x.sentence.end; ended = true } }
  for (const e of evs) { const r = step(st, e.i); st = r.state; take(r.out) }
  const last = evs.length ? evs[evs.length - 1].t : 0
  if (!ended || pending(st).words.length || pending(st).chords.length || pending(st).spelling) {
    const r = step(st, { type: 'end', t: last + 1 }); st = r.state; take(r.out)
  }
  return { v: KOOGALIEN_VERSION, words, end }
}
