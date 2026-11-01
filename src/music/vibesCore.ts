// The Vibes mood engine, pure part (no stores, no DOM, no timers) so it can be unit-checked on scripted sequences.
// It estimates VALENCE (sad -> happy) and AROUSAL (calm -> excited) plus a discrete MOOD from many small cues.
// Every cue is one short rule: { w: weight, f(ctx) -> { s: strength 0..1, v, a, m: mood affinities, why } }.
// Mood score = sum(w * s * affinity) + a little pull from where (valence, arousal) sits on the "circumplex" map.
// Everything is smoothed (EMA) so the face never flickers. src/music/vibes.ts wires this to the real note/judge feeds.
import { PC_NAMES, SCALES, pc, type Key } from './theory'

export type MoodId =
  | 'happy' | 'joyful' | 'excited' | 'sad' | 'tender' | 'calm' | 'dreamy' | 'cool' | 'sassy' | 'spooky'
  | 'tense' | 'angry' | 'surprised' | 'triumphant' | 'bittersweet' | 'goofy' | 'mysterious' | 'groovy'
  | 'epic' | 'wondering' | 'content'

export interface MoodDef {
  id: MoodId; label: string
  /** primary face emoji + accents for particles */
  emoji: string; accents: string[]
  /** background wash hue */
  hue: number
  /** (valence, arousal) prototype on the circumplex map */
  proto: [number, number]
}
const M = (id: MoodId, label: string, emoji: string, accents: string[], hue: number, v: number, a: number): MoodDef => ({ id, label, emoji, accents, hue, proto: [v, a] })
export const MOODS: Record<MoodId, MoodDef> = {
  happy: M('happy', 'Happy', '😄', ['😊', '🌞', '🙂'], 44, 0.6, 0.25),
  joyful: M('joyful', 'Joyful', '🤩', ['🥳', '🎉', '✨'], 36, 0.85, 0.8),
  excited: M('excited', 'Excited', '🤩', ['⭐', '🚀', '😆'], 22, 0.5, 0.85),
  sad: M('sad', 'Sad', '😢', ['😭', '💧', '😔'], 222, -0.6, -0.4),
  tender: M('tender', 'Tender', '🥰', ['💗', '🌸', '😊'], 335, 0.45, -0.5),
  calm: M('calm', 'Calm', '😌', ['🍃', '🌊', '☁️'], 190, 0.2, -0.75),
  dreamy: M('dreamy', 'Dreamy', '🥹', ['🌙', '☁️', '💫'], 268, 0.3, -0.35),
  cool: M('cool', 'Cool', '😎', ['🕶️', '🧊', '🎷'], 196, 0.3, 0.0),
  sassy: M('sassy', 'Sassy', '😏', ['💅', '😎', '🎷'], 315, 0.3, 0.2),
  spooky: M('spooky', 'Spooky', '👻', ['🎃', '🦇', '🕸️'], 276, -0.5, -0.1),
  tense: M('tense', 'Tense', '😬', ['😰', '😱', '💦'], 105, -0.5, 0.6),
  angry: M('angry', 'Chaotic', '😤', ['💥', '🤯', '😠'], 6, -0.7, 0.85),
  surprised: M('surprised', 'Surprised', '😲', ['😮', '⁉️', '🎈'], 56, 0.1, 0.7),
  triumphant: M('triumphant', 'Triumphant', '😁', ['🏆', '👑', '🎺'], 46, 0.8, 0.55),
  bittersweet: M('bittersweet', 'Nostalgic', '🥲', ['🍂', '📷', '💭'], 26, -0.1, -0.25),
  goofy: M('goofy', 'Goofy', '🤪', ['🤡', '🙃', '🍌'], 112, 0.3, 0.5),
  mysterious: M('mysterious', 'Mysterious', '🧐', ['🔮', '🌌', '🤫'], 262, -0.2, -0.1),
  groovy: M('groovy', 'Groovy', '🕺', ['🎶', '🪩', '😎'], 302, 0.55, 0.45),
  epic: M('epic', 'Epic', '😤', ['💪', '🔥', '🤘'], 14, 0.1, 0.7),
  wondering: M('wondering', 'Wondering', '🤔', ['❓', '☁️', '✨'], 236, 0.1, -0.2),
  content: M('content', 'Satisfied', '😌', ['💛', '🙏', '☺️'], 150, 0.5, -0.4),
}
export const MOOD_IDS = Object.keys(MOODS) as MoodId[]

// ---------------- chords ----------------
export type ChordQuality = 'major' | 'minor' | 'dim' | 'aug' | 'sus' | 'dom7' | 'maj7' | 'm7' | 'power' | 'cluster'
export interface ChordInfo { root: number; quality: ChordQuality; name: string }
const TPL: [ChordQuality, string, number[]][] = [
  ['dom7', '7', [0, 4, 7, 10]], ['maj7', 'maj7', [0, 4, 7, 11]], ['m7', 'm7', [0, 3, 7, 10]],
  ['dim', 'dim7', [0, 3, 6, 9]], ['dim', 'm7b5', [0, 3, 6, 10]],
  ['major', '', [0, 4, 7]], ['minor', 'm', [0, 3, 7]], ['dim', 'dim', [0, 3, 6]], ['aug', 'aug', [0, 4, 8]],
  ['sus', 'sus4', [0, 5, 7]], ['sus', 'sus2', [0, 2, 7]],
]
function closePairs(ns: number[]) {
  const u = [...new Set(ns)].sort((a, b) => a - b)
  let c = 0
  for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] <= 2) c++
  return c
}
/** Name the quality of held MIDI notes. Power chords (a bare 5th) and clusters count too. null = not a chord. */
export function classifyChord(notes: number[]): ChordInfo | null {
  const sorted = [...new Set(notes)].sort((a, b) => a - b)
  if (sorted.length < 2) return null
  if ((sorted.length >= 4 && closePairs(sorted) >= 3) || sorted.length >= 7) return { root: pc(sorted[0]), quality: 'cluster', name: 'cluster' }
  const pcs = [...new Set(sorted.map(pc))]
  const bass = pc(sorted[0])
  if (pcs.length === 2) {
    const d = pc(pcs[1] - pcs[0])
    if (d === 7) return { root: pcs[0], quality: 'power', name: PC_NAMES[pcs[0]] + '5' }
    if (d === 5) return { root: pcs[1], quality: 'power', name: PC_NAMES[pcs[1]] + '5' }
    return null
  }
  let best: { score: number; info: ChordInfo } | null = null
  for (const root of pcs) {
    const set = new Set(pcs.map((p) => pc(p - root)))
    for (const [q, suf, tpl] of TPL) {
      if (!tpl.every((t) => set.has(t))) continue
      const extras = set.size - tpl.length
      if (extras > 2) continue
      const score = tpl.length - extras * 0.7 + (root === bass ? 2 : 0)
      if (!best || score > best.score) best = { score, info: { root, quality: q, name: PC_NAMES[root] + suf } }
    }
  }
  return best?.info ?? null
}

export const CHORD_EMOJI: Record<ChordQuality, string[]> = {
  major: ['😄', '😊', '🌞'], minor: ['😢', '😭', '💧'], dim: ['😱', '😰', '👻'], aug: ['😲', '🤪', '🛸'],
  sus: ['🤔', '☁️', '✨'], dom7: ['😎', '😏', '🎷'], maj7: ['🥰', '☁️', '🌙'], m7: ['😌', '😎', '🌊'],
  power: ['💪', '🤘', '🔥'], cluster: ['😤', '🤯', '💥'],
}
const QNAME: Record<ChordQuality, string> = {
  major: 'Major chord → happy 😄', minor: 'Minor chord → a bit sad 😢', dim: 'Diminished chord → spooky and tense 😱',
  aug: 'Augmented chord → weird and surprising 😲', sus: 'Sus chord → floaty, like a question 🤔', dom7: 'Dominant 7 chord → cool and sassy 😎',
  maj7: 'Major 7 chord → dreamy 🥰', m7: 'Minor 7 chord → chill 😌', power: 'Power chord (just a 5th) → tough and epic 💪', cluster: 'Lots of notes smashed together → chaos! 🤯',
}
const QCUE: Record<ChordQuality, { v: number; a: number; m: Partial<Record<MoodId, number>> }> = {
  major: { v: 0.65, a: 0.1, m: { happy: 1, joyful: 0.25 } },
  minor: { v: -0.65, a: -0.15, m: { sad: 1, tender: 0.2 } },
  dim: { v: -0.5, a: 0.45, m: { tense: 1, spooky: 0.5 } },
  aug: { v: 0, a: 0.25, m: { surprised: 1, mysterious: 0.4 } },
  sus: { v: 0.1, a: -0.1, m: { wondering: 1, dreamy: 0.5 } },
  dom7: { v: 0.25, a: 0.1, m: { sassy: 1, cool: 0.7, groovy: 0.3 } },
  maj7: { v: 0.4, a: -0.25, m: { dreamy: 1, tender: 0.4 } },
  m7: { v: -0.1, a: -0.3, m: { cool: 0.8, calm: 0.7, dreamy: 0.2 } },
  power: { v: 0.1, a: 0.55, m: { epic: 1, angry: 0.2 } },
  cluster: { v: -0.55, a: 0.85, m: { angry: 1, goofy: 0.3 } },
}

// ---------------- the engine ----------------
export interface VibeSnapshot { valence: number; arousal: number; mood: MoodId; intensity: number; reasons: string[]; chord: ChordInfo | null; activity: number }
export type VibeEv =
  | { type: 'chord'; quality: ChordQuality; name: string; emojis: string[] }
  | { type: 'judge'; kind: JudgeKind }
export type JudgeKind = 'cadence' | 'resolve' | 'boom' | 'fizzle' | 'motif'

interface Out { s: number; v: number; a: number; m: Partial<Record<MoodId, number>>; why: string }
interface Cue { id: string; w: number; f(c: Ctx): Out | null }
interface Ctx {
  t: number; key: Key; activity: number
  chord: { info: ChordInfo; s: number } | null
  rate: number | null; onsetsN: number
  avgPitch: number | null; avgVel: number | null
  melody: number[]; ioi: number[]
  outFrac: number | null
  modal: string | null
  prog: { kind: string; t: number } | null
  since: Record<JudgeKind, number>
  silence: number; suspense: boolean
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x))
const RATIOS = [-2, -1.585, -1, -0.585, 0, 0.585, 1, 1.585, 2]
function rhythmScore(ioi: number, prev: number) {
  const r = Math.log2(ioi / prev)
  let d = Infinity
  for (const x of RATIOS) d = Math.min(d, Math.abs(r - x))
  return clamp(1 - d / 0.2)
}
const decay = (since: number, tau: number) => (since < 0 ? 0 : Math.exp(-since / tau))

export const CUES: Cue[] = [
  { id: 'chord', w: 3, f: (c) => {
    if (!c.chord) return null
    const q = QCUE[c.chord.info.quality]
    return { s: c.chord.s, v: q.v, a: q.a, m: q.m, why: QNAME[c.chord.info.quality] }
  } },
  { id: 'progression', w: 6.5, f: (c) => {
    if (!c.prog) return null
    const s = decay(c.t - c.prog.t, 3500)
    if (s < 0.05) return null
    const P: Record<string, Out> = {
      V_I: { s, v: 0.75, a: 0.45, m: { triumphant: 1, joyful: 0.3, content: 0.3 }, why: 'V → I (the "I made it!" move) → triumphant 🏆' },
      V_i: { s, v: 0.1, a: 0.5, m: { epic: 1, triumphant: 0.6 }, why: 'V → i in a minor key → epic and dramatic 🔥' },
      I_vi: { s, v: -0.15, a: -0.25, m: { bittersweet: 1, tender: 0.4, sad: 0.2 }, why: 'I → vi → nostalgic, like a memory 🥲' },
      iv_major: { s, v: -0.1, a: -0.2, m: { bittersweet: 1, tender: 0.3 }, why: 'A minor iv chord in a major key → bittersweet 🥲' },
      V_vi: { s, v: 0.1, a: 0.5, m: { surprised: 1 }, why: 'Surprise ending (V → vi)! → whoa 😮' },
      IV_I: { s, v: 0.5, a: -0.3, m: { content: 1, tender: 0.5 }, why: 'IV → I (the "amen") → peaceful and satisfied 🙏' },
      ii_V: { s, v: 0.3, a: 0.1, m: { cool: 1, sassy: 0.4 }, why: 'ii → V → smooth and jazzy 😎' },
    }
    const o = P[c.prog.kind]
    return o ?? null
  } },
  { id: 'keymode', w: 0.8, f: (c) => {
    const s = 0.3 + 0.7 * c.activity
    const k = c.key.scale
    if (k === 'major') return { s, v: 0.35, a: 0, m: { happy: 0.5 }, why: 'Major key → bright and happy 😊' }
    if (k === 'minor') return { s, v: -0.35, a: 0, m: { sad: 0.5, mysterious: 0.2 }, why: 'Minor key → a little sad 😔' }
    if (k === 'minorPentatonic') return { s, v: -0.1, a: 0, m: { cool: 0.5, sad: 0.2 }, why: 'Minor pentatonic → bluesy and cool 😎' }
    if (k === 'blues') return { s, v: 0, a: 0.05, m: { cool: 1, sassy: 0.5 }, why: 'Blues scale → cool and sassy 😎' }
    if (k === 'majorPentatonic') return { s, v: 0.3, a: 0, m: { happy: 0.5, calm: 0.2 }, why: 'Pentatonic → sunny and easy ☀️' }
    return null
  } },
  { id: 'modal', w: 1.3, f: (c) => {
    if (!c.modal) return null
    const M2: Record<string, Out> = {
      lydian: { s: 1, v: 0.4, a: 0, m: { dreamy: 0.8, wondering: 0.6, joyful: 0.2 }, why: 'Lydian colour (a raised 4th) → magical ✨' },
      dorian: { s: 1, v: 0, a: 0, m: { cool: 1, groovy: 0.3 }, why: 'Dorian colour (minor with a bright 6th) → cool 😎' },
      mixolydian: { s: 1, v: 0.2, a: 0.05, m: { sassy: 0.7, cool: 0.6 }, why: 'Mixolydian colour (flat 7th) → sassy 😏' },
      phrygian: { s: 1, v: -0.3, a: 0, m: { spooky: 0.8, mysterious: 0.5 }, why: 'Phrygian colour (flat 2nd) → spooky 👻' },
    }
    const o = M2[c.modal]
    return o ? { ...o, s: c.activity } : null
  } },
  // melody contour
  { id: 'rising', w: 1.4, f: (c) => {
    const d = mel(c); if (!d || d.mean < 1) return null
    return { s: clamp(d.mean / 3) * c.activity, v: 0.4, a: 0.35, m: { excited: 0.6, happy: 0.4, joyful: 0.3 }, why: 'Notes climbing up → hopeful and excited 🌟' }
  } },
  { id: 'falling', w: 1.6, f: (c) => {
    const d = mel(c); if (!d || d.mean > -1) return null
    return { s: clamp(-d.mean / 3) * c.activity, v: -0.5, a: -0.3, m: { sad: 1, tender: 0.3, bittersweet: 0.3 }, why: 'Notes sliding down → a sad sigh 😔' }
  } },
  { id: 'leaps', w: 1.3, f: (c) => {
    const d = mel(c); if (!d || d.abs < 5) return null
    return { s: clamp((d.abs - 4) / 5) * c.activity, v: 0.05, a: 0.4, m: { surprised: 0.5, epic: 0.4, goofy: 0.3, triumphant: 0.2 }, why: 'Big jumps → dramatic! 🎭' }
  } },
  { id: 'steps', w: 1.0, f: (c) => {
    const d = mel(c); if (!d || d.n < 4 || d.abs > 2.5 || Math.abs(d.mean) >= 1) return null
    return { s: 0.6 * c.activity, v: 0.2, a: -0.2, m: { tender: 0.6, calm: 0.5 }, why: 'Small smooth steps → gentle 🌸' }
  } },
  // register
  { id: 'high', w: 1.0, f: (c) => {
    if (c.avgPitch == null) return null
    const r = clamp((c.avgPitch - 74) / 12)
    if (r < 0.15) return null
    return { s: r * c.activity, v: 0.3, a: 0.3, m: { excited: 0.3, joyful: 0.4, dreamy: 0.3, happy: 0.3 }, why: 'High notes → bright and sparkly ✨' }
  } },
  { id: 'low', w: 1.1, f: (c) => {
    if (c.avgPitch == null) return null
    const r = clamp((55 - c.avgPitch) / 10)
    if (r < 0.15) return null
    return { s: r * c.activity, v: -0.25, a: -0.1, m: { spooky: 0.8, sad: 0.4, epic: 0.2, mysterious: 0.3 }, why: 'Low notes → grumpy and spooky 👻' }
  } },
  // tempo
  { id: 'fast', w: 1.6, f: (c) => {
    if (c.rate == null || c.rate < 3.2) return null
    const hi = c.avgPitch != null && c.avgPitch >= 72
    return { s: clamp((c.rate - 3) / 3) * c.activity, v: 0.2, a: 0.8, m: { excited: 1, joyful: 0.3 }, why: hi ? 'Fast and high → excited! 🤩' : 'Fast notes → excited! 🤩' }
  } },
  { id: 'slow', w: 1.2, f: (c) => {
    if (c.rate == null || c.rate > 1.3 || c.onsetsN < 2) return null
    return { s: clamp((1.3 - c.rate) / 1) * 0.8 * c.activity, v: 0, a: -0.5, m: { calm: 0.8, tender: 0.3, sad: 0.25 }, why: 'Slow notes → calm 😌' }
  } },
  // rhythm
  { id: 'groove', w: 1.3, f: (c) => {
    if (c.ioi.length < 4 || c.rate == null || c.rate < 1.3 || c.rate > 5.5) return null
    const mean = c.ioi.reduce((x, y) => x + y, 0) / c.ioi.length
    const sd = Math.sqrt(c.ioi.reduce((x, y) => x + (y - mean) ** 2, 0) / c.ioi.length)
    const cv = sd / mean
    let r = 0
    for (let i = 1; i < c.ioi.length; i++) r += rhythmScore(c.ioi[i], c.ioi[i - 1])
    r /= c.ioi.length - 1
    if (r < 0.65) return null
    const sync = cv > 0.2 && cv < 0.7
    return { s: (sync ? 1 : 0.7) * r * c.activity, v: 0.4, a: 0.3, m: { groovy: 1, cool: 0.3 }, why: sync ? 'Syncopated groove → groovy 🕺' : 'Steady beat → groovy 🕺' }
  } },
  { id: 'nervous', w: 1.1, f: (c) => {
    if (c.ioi.length < 5) return null
    const mean = c.ioi.reduce((x, y) => x + y, 0) / c.ioi.length
    const sd = Math.sqrt(c.ioi.reduce((x, y) => x + (y - mean) ** 2, 0) / c.ioi.length)
    let r = 0
    for (let i = 1; i < c.ioi.length; i++) r += rhythmScore(c.ioi[i], c.ioi[i - 1])
    r /= c.ioi.length - 1
    if (r > 0.4 || sd / mean < 0.5) return null
    return { s: (1 - r) * c.activity, v: -0.2, a: 0.4, m: { tense: 0.6, goofy: 0.3, surprised: 0.2 }, why: 'Bumpy, uneven rhythm → nervous 😬' }
  } },
  // dynamics
  { id: 'loud', w: 1.0, f: (c) => {
    if (c.avgVel == null || c.avgVel < 100) return null
    return { s: clamp((c.avgVel - 95) / 30) * c.activity, v: -0.05, a: 0.5, m: { epic: 0.5, excited: 0.3, angry: 0.2, tense: 0.2 }, why: 'Playing loud → intense 💥' }
  } },
  { id: 'soft', w: 1.0, f: (c) => {
    if (c.avgVel == null || c.avgVel > 68) return null
    return { s: clamp((72 - c.avgVel) / 30) * c.activity, v: 0.1, a: -0.4, m: { tender: 1, calm: 0.6 }, why: 'Playing softly → tender 🥰' }
  } },
  // dissonance and resolution
  { id: 'outkey', w: 1.4, f: (c) => {
    if (c.outFrac == null || c.outFrac < 0.2) return null
    return { s: clamp((c.outFrac - 0.15) / 0.5) * c.activity, v: -0.4, a: 0.4, m: { tense: 1, spooky: 0.3, mysterious: 0.2 }, why: 'Notes outside the key → tense 😬' }
  } },
  { id: 'resolve', w: 2.4, f: (c) => {
    const s = decay(c.since.resolve, 2500)
    return s < 0.1 ? null : { s, v: 0.5, a: -0.3, m: { content: 1, happy: 0.3, tender: 0.2 }, why: 'Tension melts into the key → relief 😮‍💨' }
  } },
  { id: 'cadence', w: 2.4, f: (c) => {
    const s = decay(c.since.cadence, 3500)
    return s < 0.1 ? null : { s, v: 0.55, a: -0.1, m: { content: 1, happy: 0.4, triumphant: 0.3 }, why: 'Phrase ended on the home note → satisfied 😌' }
  } },
  { id: 'boom', w: 6, f: (c) => {
    const s = decay(c.since.boom, 3500)
    return s < 0.1 ? null : { s, v: 0.85, a: 0.85, m: { joyful: 1, excited: 0.6 }, why: 'BOOM! → ecstatic! 🤩' }
  } },
  { id: 'fizzle', w: 2.6, f: (c) => {
    const s = decay(c.since.fizzle, 3000)
    return s < 0.1 ? null : { s, v: 0, a: 0.25, m: { goofy: 1 }, why: 'Fizzle → goofy 🤪' }
  } },
  { id: 'motif', w: 1.2, f: (c) => {
    const s = decay(c.since.motif, 3000)
    return s < 0.1 ? null : { s, v: 0.4, a: 0.2, m: { groovy: 0.7, happy: 0.4 }, why: 'You repeated a pattern → groovy 🔁' }
  } },
  { id: 'silence', w: 1.8, f: (c) => {
    if (c.silence <= 0) return null
    return c.suspense
      ? { s: c.silence, v: -0.1, a: -0.5, m: { mysterious: 1, spooky: 0.3 }, why: 'Quiet after tense music → suspense 🤫' }
      : { s: c.silence, v: 0.05, a: -0.8, m: { calm: 1, dreamy: 0.3 }, why: 'Quiet → calm 😌' }
  } },
]

function mel(c: Ctx) {
  const m = c.melody
  if (m.length < 3) return null
  const n = m.length
  let abs = 0
  for (let i = 1; i < n; i++) abs += Math.abs(m[i] - m[i - 1])
  return { n, mean: (m[n - 1] - m[0]) / (n - 1), abs: abs / (n - 1) }
}

interface NoteRec { t: number; note: number; vel: number }
interface Hist { t: number; rel: number; q: ChordQuality }

export class VibeCore {
  key: Key = { tonic: 0, scale: 'major' }
  /** events for the outside world (chord bursts, judge echoes); the wrapper drains this */
  out: VibeEv[] = []
  valence = 0; arousal = -0.5; mood: MoodId = 'calm'; intensity = 0.2
  reasons: string[] = []
  scores: Record<MoodId, number> = Object.fromEntries(MOOD_IDS.map((m) => [m, 0])) as Record<MoodId, number>
  private held = new Map<number, number>()
  private notes: NoteRec[] = []
  private onsets: number[] = []
  private melody: { t: number; note: number }[] = []
  private hist: Hist[] = []
  private prog: { kind: string; t: number } | null = null
  private pendingAt = -1
  private lastActive = -1e9
  private lastOnset = -1e9
  private lastChord: ChordInfo | null = null
  private chordRel = -1e9
  private preV = 0; private preA = -0.5
  private at: Record<JudgeKind, number> = { cadence: -1e9, resolve: -1e9, boom: -1e9, fizzle: -1e9, motif: -1e9 }
  private lastT = 0
  private moodSince = 0

  noteOn(note: number, vel: number, t: number) {
    this.held.set(note, vel)
    this.notes.push({ t, note, vel })
    if (this.notes.length > 64) this.notes.shift()
    if (t - this.lastOnset >= 50) {
      this.onsets.push(t)
      if (this.onsets.length > 24) this.onsets.shift()
      if (this.held.size <= 1) {
        this.melody.push({ t, note })
        if (this.melody.length > 8) this.melody.shift()
      }
    }
    this.lastOnset = t
    this.lastActive = t
    this.pendingAt = t + 60
  }
  noteOff(note: number, t: number) {
    this.held.delete(note)
    this.lastActive = t
  }
  judge(kind: JudgeKind, t: number) {
    this.at[kind] = t
    this.out.push({ type: 'judge', kind })
  }
  reset() {
    this.held.clear(); this.notes = []; this.onsets = []; this.melody = []; this.hist = []; this.prog = null
    this.lastChord = null; this.lastActive = -1e9; this.pendingAt = -1
  }

  private settle(t: number) {
    this.pendingAt = -1
    const info = this.held.size >= 2 ? classifyChord([...this.held.keys()]) : null
    if (!info) return
    const rel = pc(info.root - this.key.tonic)
    const last = this.hist[this.hist.length - 1]
    if (!last || last.rel !== rel || last.q !== info.quality || t - last.t > 1200) {
      if (info.quality !== 'cluster' && info.quality !== 'power') {
        this.detectProg(last && t - last.t < 8000 ? last : null, { t, rel, q: info.quality })
        this.hist.push({ t, rel, q: info.quality })
        if (this.hist.length > 8) this.hist.shift()
      }
      this.out.push({ type: 'chord', quality: info.quality, name: info.name, emojis: CHORD_EMOJI[info.quality] })
    }
  }
  private detectProg(prev: Hist | null, cur: Hist) {
    const major = this.key.scale === 'major' || this.key.scale === 'majorPentatonic'
    const isMaj = (q: ChordQuality) => q === 'major' || q === 'maj7' || q === 'dom7'
    const isMin = (q: ChordQuality) => q === 'minor' || q === 'm7'
    let kind: string | null = null
    if (prev) {
      if (prev.rel === 7 && cur.rel === 0 && (isMaj(prev.q) || prev.q === 'sus')) kind = isMaj(cur.q) ? 'V_I' : isMin(cur.q) ? 'V_i' : null
      else if (prev.rel === 0 && isMaj(prev.q) && cur.rel === 9 && isMin(cur.q) && major) kind = 'I_vi'
      else if (prev.rel === 7 && cur.rel === 9 && isMin(cur.q) && major) kind = 'V_vi'
      else if (prev.rel === 5 && isMaj(prev.q) && cur.rel === 0 && isMaj(cur.q)) kind = 'IV_I'
      else if (prev.rel === 2 && isMin(prev.q) && cur.rel === 7 && (isMaj(cur.q))) kind = 'ii_V'
    }
    if (!kind && major && cur.rel === 5 && isMin(cur.q)) kind = 'iv_major'
    if (kind) this.prog = { kind, t: cur.t }
  }

  update(t: number): VibeSnapshot {
    const dt = clamp(t - this.lastT, 0, 1000)
    this.lastT = t
    if (this.pendingAt >= 0 && t >= this.pendingAt) this.settle(t)
    // forget old stuff
    while (this.notes.length && t - this.notes[0].t > 8000) this.notes.shift()
    while (this.onsets.length && t - this.onsets[0] > 6000) this.onsets.shift()
    while (this.melody.length && t - this.melody[0].t > 3500) this.melody.shift()
    // chord (held, lingering after release, or spelled out as an arpeggio)
    let chord: { info: ChordInfo; s: number } | null = null
    const held = this.held.size >= 2 ? classifyChord([...this.held.keys()]) : null
    if (held) { this.lastChord = held; this.chordRel = t; chord = { info: held, s: 1 } }
    else if (this.lastChord && this.held.size < 2) {
      const s = decay(t - this.chordRel, 2500)
      if (s > 0.12) chord = { info: this.lastChord, s: s * 0.9 }
    }
    if (!chord || chord.s < 0.8) {
      const rn = this.notes.filter((n) => t - n.t < 1300).slice(-4)
      if (rn.length >= 3 && this.held.size < 2) {
        const pcs = [...new Set(rn.map((n) => pc(n.note)))]
        if (pcs.length === rn.length) {
          const ai = classifyChord(rn.map((n) => n.note))
          if (ai && ai.quality !== 'cluster' && ai.quality !== 'power' && (!chord || chord.s < 0.55)) chord = { info: ai, s: 0.55 * decay(t - rn[rn.length - 1].t, 1500) }
        }
      }
    }
    // windows
    const activity = this.held.size > 0 ? 1 : decay(t - this.lastActive, 3000)
    const rn = this.notes.filter((n) => t - n.t < 3500)
    const avgPitch = rn.length ? rn.reduce((s, n) => s + n.note, 0) / rn.length : null
    const avgVel = rn.length ? rn.reduce((s, n) => s + n.vel, 0) / rn.length : null
    const on = this.onsets.filter((o) => t - o < 2500)
    let rate: number | null = null
    if (on.length >= 2) {
      const span = on[on.length - 1] - on[0]
      if (span > 150) rate = (on.length - 1) / (span / 1000)
    }
    const ioi: number[] = []
    const on5 = this.onsets.filter((o) => t - o < 5000)
    for (let i = 1; i < on5.length; i++) ioi.push(on5[i] - on5[i - 1])
    const r8 = this.notes.filter((n) => t - n.t < 5000).slice(-8)
    const sc = SCALES[this.key.scale]
    const outFrac = r8.length >= 3 ? r8.filter((n) => !sc.includes(pc(n.note - this.key.tonic))).length / r8.length : null
    const since = {} as Record<JudgeKind, number>
    for (const k of Object.keys(this.at) as JudgeKind[]) since[k] = t - this.at[k]
    // modal colour
    let modal: string | null = null
    const m8 = this.notes.filter((n) => t - n.t < 9000)
    if (m8.length >= 6) {
      const cnt = new Array(12).fill(0)
      for (const n of m8) cnt[pc(n.note - this.key.tonic)]++
      const has = (i: number, k = 1) => cnt[i] >= k
      if (has(4) && has(6, 2) && !has(5)) modal = 'lydian'
      else if (has(3) && has(9, 2) && !has(8)) modal = 'dorian'
      else if (has(4) && has(10, 2) && !has(11)) modal = 'mixolydian'
      else if (has(3) && has(1, 2) && has(0, 1)) modal = 'phrygian'
    }
    // silence / suspense
    const gap = this.held.size ? 0 : t - this.lastActive
    if (gap < 400) { this.preV = this.valence; this.preA = this.arousal }
    const silence = clamp((gap - 2000) / 3000)
    const suspense = this.preV < -0.15 || this.preA > 0.45
    const ctx: Ctx = {
      t, key: this.key, activity, chord, rate, onsetsN: on.length, avgPitch, avgVel,
      melody: this.melody.map((m) => m.note), ioi, outFrac, modal, prog: this.prog, since, silence, suspense,
    }
    // run the cues
    let sumW = 0, tv = 0, ta = 0
    const raw = Object.fromEntries(MOOD_IDS.map((m) => [m, 0])) as Record<MoodId, number>
    const act: { o: Out; w: number }[] = []
    for (const c of CUES) {
      const o = c.f(ctx)
      if (!o || o.s <= 0.02) continue
      const w = c.w * o.s
      act.push({ o, w })
      sumW += w; tv += w * o.v; ta += w * o.a
      for (const k in o.m) raw[k as MoodId] += w * (o.m[k as MoodId] ?? 0)
    }
    const den = Math.max(2, sumW)
    const tgtV = clamp(tv / den, -1, 1)
    const tgtA = clamp(ta / den - (sumW < 0.5 ? 0.45 : 0), -1, 1)
    // smooth valence / arousal and the scores
    const ka = 1 - Math.exp(-dt / 700)
    this.valence += (tgtV - this.valence) * ka
    this.arousal += (tgtA - this.arousal) * ka
    const ks = 1 - Math.exp(-dt / 450)
    for (const m of MOOD_IDS) {
      const [pv, pa] = MOODS[m].proto
      const d2 = (this.valence - pv) ** 2 + (this.arousal - pa) ** 2
      const target = raw[m] + 1.2 * Math.exp(-d2 / 0.3)
      this.scores[m] += (target - this.scores[m]) * ks
    }
    // pick the mood with hysteresis
    let best = this.mood
    for (const m of MOOD_IDS) if (this.scores[m] > this.scores[best]) best = m
    if (best !== this.mood && t - this.moodSince > 600 && this.scores[best] > this.scores[this.mood] * 1.2 + 0.15) {
      this.mood = best
      this.moodSince = t
    }
    // reasons: which active cues pushed hardest toward the winning mood
    const ranked = act
      .map(({ o, w }) => ({ why: o.why, c: w * ((o.m[this.mood] ?? 0) + 0.12) }))
      .sort((a, b) => b.c - a.c)
    this.reasons = ranked.filter((r) => r.c > 0.2).slice(0, 3).map((r) => r.why)
    if (!this.reasons.length && act.length) this.reasons = [act.sort((a, b) => b.w - a.w)[0].o.why]
    this.intensity = clamp((0.3 + 0.7 * clamp(Math.hypot(this.valence, this.arousal))) * (0.35 + 0.65 * activity))
    return { valence: this.valence, arousal: this.arousal, mood: this.mood, intensity: this.intensity, reasons: this.reasons, chord: chord?.info ?? null, activity }
  }
}
