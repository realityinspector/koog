// Pure: HIGH KOOGALIEN, the advanced register for reading books (docs/koogalien/HIGH_KOOGALIEN.md).
// It is expressive rendering ON TOP of the plain words: it never changes which word a chord means or how v1 matches chords.
// It sets the optional fields Builder A reserved on WordSlot (durationClass, dyn, arp, keyCenter, mode, register, tempo, mod),
// then lays the sentence out in time (breaths, rests, scene tempo, speed). Plain Koogalien is renderPlain(): v1 exactly, one voice.
// Tested by scripts/library-fixtures.ts
import { lexByEnglish } from '../data/lexicon'
import { translate, wordSlot } from '../engine/translate'
import { encode, dimsOf } from '../engine/encode'
import { VEL_OF_LOUD } from '../data/tone'
import { alienById } from '../data/aliens'
import { KOOGALIEN_VERSION } from '../data/types'
import type { ChordEvent, Dims, Ending, ModEvent, Score, Sentence, WordSlot } from '../data/types'
import { delivery } from './text'
import type { VoiceNo } from './types'
import { VOICE_IDS } from './types'

/* ---------- the rules, as data (the docs and the reader's "What is High?" card both read this) ---------- */
export const HIGH_RULES: readonly { id: string; dim: string; rule: string; means: string }[] = [
  { id: 'voice', dim: 'patch', rule: 'A quoted line is spoken by Pip, Dro or Zee; narration is the narrator.', means: 'who is speaking' },
  { id: 'key', dim: 'keyCenter', rule: 'Each chapter has its own key (C, G, D, A, E, B, F, B-flat, then around again).', means: 'where in the book we are' },
  { id: 'mode', dim: 'mode', rule: 'A dark scene is played in the minor mode: the 3rd, 6th and 7th notes are lowered.', means: 'the mood of the passage' },
  { id: 'tempo', dim: 'tempo', rule: 'Each scene has a tempo: calm 84, steady 96, joyful 108, action 124, dark 80.', means: 'narrative time: fast = action, slow = description' },
  { id: 'duration', dim: 'durationClass', rule: 'A plural, a past tense or the word after "very" is held twice as long.', means: 'plural, past, very' },
  { id: 'dynamics', dim: 'dyn', rule: 'Names, CAPITALS and _stressed_ words are loud; whispers and thoughts are soft.', means: 'emphasis, a name, a whisper' },
  { id: 'question', dim: 'mod', rule: 'A question lifts its last word a step and sweeps the filter closed.', means: 'a question' },
  { id: 'excited', dim: 'mod', rule: 'A shout (!) ends loud with a wobble.', means: 'excited' },
  { id: 'breath', dim: 'timing', rule: 'A comma is a short breath, a semicolon or colon a longer one, a paragraph a long rest, a chapter a very long one.', means: 'phrasing' },
  { id: 'arp', dim: 'arp', rule: 'Words that mean toward (come, give, bring) roll up; words that mean away (go, take, leave) roll down.', means: 'toward / away' },
  { id: 'register', dim: 'register', rule: 'A chapter title is spoken an octave low.', means: 'a heading voice' },
  { id: 'spell', dim: 'timing', rule: 'High spells at double speed (the hops are a quarter beat apart).', means: 'rare words stay short' },
]

export type Scene = 'steady' | 'calm' | 'action' | 'joy' | 'dark'
export const SCENES: Record<Scene, { tempo: number; mode: 'major' | 'minor'; label: string }> = {
  steady: { tempo: 96, mode: 'major', label: 'steady' },
  calm: { tempo: 84, mode: 'major', label: 'calm' },
  joy: { tempo: 108, mode: 'major', label: 'joyful' },
  action: { tempo: 124, mode: 'major', label: 'action' },
  dark: { tempo: 80, mode: 'minor', label: 'dark' },
}
const words = (s: string) => new Set(s.split(' '))
const ACTION = words('ran run running rushed rush dashed raced chased chase fled flew jumped jump leaped sprang seized grabbed struggled fell crashed bang suddenly quick quickly hurried darted bounded galloped escape escaped fire fight fought')
const DARK = words('dark darkness night shadow shadows ghost ghosts dead death died tears wept cold fear afraid terrible grave lonely storm gloomy mournful horrid cruel wicked sorrow cry crying')
const JOY = words('laughed laugh merry happy dance danced sing sang glad delight delighted bright sun spring play played joy fun wonderful lovely hurrah cheerful gay feast')
const count = (toks: string[], set: Set<string>) => toks.reduce((n, t) => n + (set.has(t) ? 1 : 0), 0)

/** the scene a paragraph reads as, from its words alone (no guessing about the plot) */
export function sceneOf(para: string): Scene {
  const toks = (para.toLowerCase().match(/[a-z']+/g) ?? [])
  if (toks.length < 4) return 'steady'
  const per = (n: number) => n / toks.length
  const a = per(count(toks, ACTION)) + per((para.match(/!/g) ?? []).length) * 0.5
  const d = per(count(toks, DARK)), j = per(count(toks, JOY))
  if (d >= 0.03 && d >= a && d >= j) return 'dark'
  if (a >= 0.03 && a >= j) return 'action'
  if (j >= 0.03) return 'joy'
  const sentences = Math.max(1, (para.match(/[.?!]+(\s|$)/g) ?? []).length)
  if (!/[“"]/.test(para) && toks.length / sentences >= 22) return 'calm'
  return 'steady'
}

/** semitones above C for chapter n: the circle of fifths folded into -5..+6 so every voice stays in range */
export const KEY_CYCLE = [0, 7, 2, 9, 4, 11, 5, 10] as const
export const KEY_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'B-flat'] as const
export const keyOfChapter = (n: number): { shift: number; name: string } => {
  const pc = KEY_CYCLE[((n % 8) + 8) % 8]
  return { shift: pc > 6 ? pc - 12 : pc, name: KEY_NAMES[((n % 8) + 8) % 8] }
}

/* ---------- annotate: plain words plus the reserved dimensions ---------- */
const TOWARD = words('come give bring here up')
const AWAY = words('go take leave away down out off')
const INTENS = words('very so too really quite ever extremely most')

export interface HighCtx {
  chapter: number
  scene: Scene
  voice: VoiceNo
  /** from the attribution ("whispered", "cried") */
  delivery?: 'soft' | 'loud' | 'plain'
  /** a chapter title line */
  title?: boolean
}
export interface Annotated { sentence: Sentence; /** beats of breath after the word at this index */ breaths: Record<number, number> }

/** stem candidates for a plural, a past tense or a possessive of a lexicon word */
export function stemsOf(w: string): string[] {
  const t = w.toLowerCase().replace(/’/g, "'")
  const out: string[] = []
  if (t.endsWith("'s")) out.push(t.slice(0, -2))
  if (t.endsWith('ies') && t.length > 4) out.push(t.slice(0, -3) + 'y')
  if (t.endsWith('es') && t.length > 3) out.push(t.slice(0, -2))
  if (t.endsWith('s') && !t.endsWith('ss') && t.length > 3) out.push(t.slice(0, -1))
  if (t.endsWith('ed') && t.length > 4) out.push(t.slice(0, -2), t.slice(0, -1))
  return out
}
function foldWord(s: WordSlot): WordSlot {
  if (s.kind !== 'spelled') return s
  for (const stem of stemsOf(s.en)) {
    const e = lexByEnglish(stem)
    if (e && e.kind !== 'closer' && e.kind !== 'control') {
      const base = wordSlot(e.id)
      if (base) return { ...base, en: s.en, durationClass: 'long' }
    }
  }
  return s
}

const CLAUSE = /[^,;:—–?!]+(?:[,;:—–]|[?!]+["”’')\]]*)?/g
const BREATH: Record<string, number> = { ',': 0.5, ';': 0.9, ':': 0.9, '—': 0.7, '–': 0.7 }

export function annotate(en0: string, ctx: HighCtx): Annotated {
  const en = en0.replace(/\s*--+\s*/g, ' — ')
  const emph = new Set<string>(), names = new Set<string>()
  for (const m of en.matchAll(/_([A-Za-z' ]+)_/g)) for (const t of m[1].toLowerCase().split(' ')) emph.add(t)
  if (!/^[^a-z]*$/.test(en)) for (const m of en.matchAll(/\b[A-Z]{2,}\b/g)) emph.add(m[0].toLowerCase())
  for (const m of en.matchAll(/(^|[.?!:“"‘'—]\s*)?\b([A-Z][a-z]{1,})\b/g)) if (!m[1] && m.index! > 0 && !/^\W*$/.test(en.slice(0, m.index!))) names.add(m[2].toLowerCase())
  const plainEnd = translate(en0).end
  const out: WordSlot[] = []
  const breaths: Record<number, number> = {}
  const km = keyOfChapter(ctx.chapter), sc = SCENES[ctx.scene]
  let prevIntens = false
  for (const m of en.matchAll(CLAUSE)) {
    const chunk = m[0]
    const delim = /([,;:—–]|[?!]+)["”’')\]]*$/.exec(chunk)?.[1] ?? ''
    const cs = translate(chunk.replace(/[_]/g, '')).words
    if (!cs.length) { if (out.length && BREATH[delim]) breaths[out.length - 1] = (breaths[out.length - 1] ?? 0) + BREATH[delim]; continue }
    cs.forEach((w0, k) => {
      let w = foldWord(w0)
      const low = w.en.toLowerCase()
      w = { ...w, tone: { loud: w.tone.loud, mods: [...w.tone.mods] } }
      if (prevIntens && !w.durationClass) w.durationClass = 'long'
      prevIntens = INTENS.has(low)
      if (w.kind === 'word' && w.id && TOWARD.has(low)) w.arp = 'up'
      else if (w.kind === 'word' && w.id && AWAY.has(low)) w.arp = 'down'
      const loud = emph.has(low) || (w.kind === 'spelled' && names.has(low))
      if (loud) { w.tone.loud = 'loud'; w.dyn = 'loud' }
      else if (ctx.delivery === 'soft') { w.tone.loud = 'soft'; w.dyn = 'soft' }
      else if (ctx.delivery === 'loud') { w.tone.loud = 'loud'; w.dyn = 'loud' }
      w.keyCenter = (km.shift + 12) % 12
      w.mode = sc.mode
      w.tempo = sc.tempo
      if (ctx.title) w.register = -1
      out.push(w)
      if (k === cs.length - 1) {
        const i = out.length - 1
        if (BREATH[delim]) breaths[i] = BREATH[delim]
        if (/\?/.test(delim)) {
          out[i] = { ...out[i], tone: { ...out[i].tone, mods: [...out[i].tone.mods, { name: 'filter', depth: 0.5 }] } }
          if (k === cs.length - 1 && m.index! + chunk.length < en.trimEnd().length) out[i].mod = 'rise' // an inner question; the final one is lifted by encode
        }
        if (/!/.test(delim)) {
          out[i] = { ...out[i], tone: { loud: 'loud', mods: [...out[i].tone.mods, { name: 'wobble', depth: 0.6 }] }, dyn: 'loud' }
        }
      }
    })
  }
  return { sentence: { v: KOOGALIEN_VERSION, words: out, end: plainEnd as Ending }, breaths }
}

/* ---------- layout and render ---------- */
export const SPEEDS = { 'story time': 1.25, 'read-aloud': 2, 'fast reader': 3.2 } as const
export type SpeedName = keyof typeof SPEEDS

export interface RenderOpts {
  /** time multiplier: 1 = the slow base, bigger = faster (SPEEDS) */
  speed: number
  /** beats of silence after the sentence (paragraph and chapter rests) before speed scaling */
  tail?: number
}
export interface Rendered { sentence: Sentence; score: Score; /** the voice patch to apply, or undefined for the narrator */ alien?: string; scene: Scene; high: boolean }

const MAX_MIDI = 96
const FLAT = new Set([3, 6, 7])
const home = (v: VoiceNo) => alienById(VOICE_IDS[v])?.centre ?? 60

function scaleScore(s: Score, f: number): Score {
  return {
    ...s, beats: s.beats * f, wordStarts: s.wordStarts.map((x) => x * f),
    chords: s.chords.map((c) => ({ ...c, at: c.at * f, dur: c.dur * f })),
    mods: s.mods.map((m) => ({ ...m, at: m.at * f, dur: m.dur * f })),
    ...(s.liftAt !== undefined ? { liftAt: s.liftAt * f } : {}),
  }
}

/** PLAIN Koogalien: exactly what v1 would say (one voice, no key, no dynamics beyond the sentence's own), only paced by `speed` */
export function renderPlain(en: string, voice: VoiceNo, o: RenderOpts, plainVoice = 'pip'): Rendered {
  void voice
  const sentence = translate(en.replace(/_/g, ''))
  const base = encode(sentence, { bpm: 100, alien: plainVoice })
  const f = 1 / Math.max(0.25, o.speed)
  const sc = scaleScore(base, f)
  sc.beats += (o.tail ?? 0) * f
  return { sentence, score: sc, alien: plainVoice, scene: 'steady', high: false }
}

/** HIGH Koogalien: the same words with the rules above applied */
export function renderHigh(en: string, ctx: HighCtx, o: RenderOpts): Rendered {
  const { sentence, breaths } = annotate(en, ctx)
  const voice = ctx.voice
  const alienId = voice === 0 ? undefined : VOICE_IDS[voice]
  const sc = SCENES[ctx.scene]
  const chordBeats = 0.6, gap = 0.55
  const base = encode(sentence, { bpm: 100, alien: alienId, homeC: home(voice), chordBeats, wordGapBeats: gap })
  const speed = Math.max(0.25, o.speed)
  const tempoF = sc.tempo / 100
  const n = sentence.words.length
  const chords: ChordEvent[] = [], mods: ModEvent[] = []
  const starts: number[] = []
  let cursor = 0
  for (let i = 0; i <= n; i++) {
    const w = sentence.words[i]
    const evs = base.chords.filter((e) => e.word === i)
    const ms = base.mods.filter((m) => m.word === i)
    const s0 = i < n ? base.wordStarts[i] : (evs[0]?.at ?? 0)
    const spelled = w?.kind === 'spelled'
    const long = w?.durationClass === 'long'
    const k = (spelled ? 0.5 : 1) / (tempoF * speed)
    const hold = long && !spelled ? 2 : 1
    starts.push(cursor)
    let span = 0
    const dims: Dims | undefined = dimsOf(w ?? sentence.words[n - 1] ?? ({} as WordSlot))
    const lowPc = dims?.keyCenter ?? 0
    const shift = lowPc > 6 ? lowPc - 12 : lowPc
    const minor = dims?.mode === 'minor'
    const reg = (dims?.register ?? 0) * 12
    for (const e of evs) {
      const local = (e.at - s0) * k
      const dur = e.dur * k * hold
      span = Math.max(span, local + dur)
      let midi = e.midi.map((m, j) => m + shift + reg - (minor && FLAT.has(e.degrees[j] ?? 0) ? 1 : 0))
      if (dims?.mod === 'rise') midi = midi.map((m) => m + 2)
      while (Math.max(...midi) > MAX_MIDI) midi = midi.map((m) => m - 12)
      const arp = e.degrees.length > 1 ? dims?.arp : undefined
      if (arp && arp !== 'none' && midi.length > 1) {
        const order = [...midi].sort((a, b) => (arp === 'up' ? a - b : b - a))
        order.forEach((m, j) => chords.push({ ...e, midi: [m], degrees: [e.degrees[j] ?? e.degrees[0]], at: cursor + local + j * 0.12 * k, dur: dur, vel: e.vel }))
        span = Math.max(span, local + dur + 0.12 * k * order.length)
      } else chords.push({ ...e, midi, at: cursor + local, dur })
    }
    for (const m of ms) mods.push({ ...m, at: cursor + (m.at - s0) * k, dur: Math.max(span, 0.25) })
    cursor += span + (i < n ? (gap + (breaths[i] ?? 0)) / (tempoF * speed) : 0)
  }
  const endAt = chords.reduce((m, c) => Math.max(m, c.at + c.dur), 0)
  const score: Score = { v: base.v, bpm: 100, beats: endAt + (o.tail ?? 0) / speed, chords, mods, wordStarts: starts.slice(0, n) }
  return { sentence, score, alien: alienId, scene: ctx.scene, high: true }
}
void VEL_OF_LOUD; void delivery
