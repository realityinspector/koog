// Shared glue for the phrase-memorization games (Zombie Lanes conga lines, Jiu-Jitsu belts, Runway phrase walk).
// Mastery lives in src/music/phraseEngine.ts (the core agent's engine), so a phrase climbed in a game counts in SONGS too.
// This file only adds what games need on top: the engine lookup, per-rung game rules, song phrases and kind coaching text.
// If the engine file is not there yet the games still run: phrases are cut by a plain fallback and nothing is recorded.
import { RUNGS, type Attempt, type Phrase, type PhraseEngineApi, type PhraseEvent, type PhraseMastery, type Rung } from '../../music/phrases'
import { PC_NAMES, pc } from '../../music/theory'
import { playLocal } from '../../music/localNotes'
import { clearScore } from '../../music/scoreStore'
import { clearGuide } from '../../music/guide'
import { SONGS, type Song } from '../songs/songs'
import { GameLh } from '../songs/gameLh'

// ---------- the engine (optional until it lands) ----------
const found = import.meta.glob('../../music/phraseEngine.ts', { eager: true }) as Record<string, Record<string, unknown>>
const isApi = (c: unknown): c is PhraseEngineApi => !!c && typeof (c as PhraseEngineApi).attempt === 'function' && typeof (c as PhraseEngineApi).segment === 'function'
/** the shared phrase engine, or null when it is not installed */
export function engine(): PhraseEngineApi | null {
  const m = Object.values(found)[0]
  if (!m) return null
  for (const c of [m, m.phraseEngine, m.engine, m.default]) if (isApi(c)) return c
  return null
}

// ---------- rungs as game rules ----------
export const rungIx = (r: Rung) => RUNGS.indexOf(r)
export const clampRung = (r: Rung, lo: Rung = 'follow', hi: Rung = 'timed'): Rung => RUNGS[Math.min(rungIx(hi), Math.max(rungIx(lo), rungIx(r)))]
export const harder = (r: Rung, by = 1, hi: Rung = 'timed'): Rung => clampRung(RUNGS[Math.min(RUNGS.length - 1, rungIx(r) + by)], 'follow', hi)
export const easier = (r: Rung, by = 1): Rung => clampRung(RUNGS[Math.max(0, rungIx(r) - by)], 'follow')

export interface RungRule {
  /** 'next' = the next key stays lit while you play; 'demo' = lit only while the phrase is sung; 'none' = never */
  guide: 'next' | 'demo' | 'none'
  /** note names are written on signs and bubbles */
  names: boolean
  /** +/- ms around the beat that counts as in time; null = order only (rhythm is not judged) */
  windowMs: number | null
  /** how long the game waits for a note after its beat before it counts as missed */
  graceMs: number
  /** the sheet music may show the phrase */
  sheet: boolean
  /** tempo of the walk: beats per minute, kept gentle on purpose */
  bpm: number
  blurb: string
}
const base = { guide: 'none', names: false, windowMs: null, graceMs: 900, sheet: true, bpm: 72 } as const
export const RULES: Record<Rung, RungRule> = {
  listen: { ...base, guide: 'next', names: true, graceMs: 1800, bpm: 60, blurb: 'Listen and watch the lit keys.' },
  follow: { ...base, guide: 'next', names: true, graceMs: 1600, bpm: 60, blurb: 'Follow the lit key, one note at a time.' },
  echo: { ...base, guide: 'demo', names: true, graceMs: 1200, bpm: 66, blurb: 'Hear it, watch the keys once, then play it back.' },
  memory: { ...base, graceMs: 1000, bpm: 72, blurb: 'No lights. Play it from memory!' },
  timed: { ...base, windowMs: 260, graceMs: 260, bpm: 80, blurb: 'From memory AND on the beat.' },
  blind: { ...base, windowMs: 220, graceMs: 220, sheet: false, bpm: 84, blurb: 'Memory, rhythm, and no sheet music.' },
  hands: { ...base, windowMs: 220, graceMs: 220, sheet: false, bpm: 84, blurb: 'Memory, rhythm, and the left hand too.' },
}

// ---------- phrases from songs ----------
export const songById = (id: string): Song | undefined => SONGS.find((s) => s.id === id)
export const phraseSongId = (p: Phrase) => p.songId || p.id.split(':')[0]

/** cut a song into phrases: the shared engine when installed, a plain cut otherwise */
export function songPhrases(songId: string, size: Phrase['size']): Phrase[] {
  const s = songById(songId)
  if (!s) return []
  const e = engine()
  if (e) { try { return e.segment(s.id, s.notes, size, s.beatsPerBar) } catch { /* fall through */ } }
  const per = size === 1 ? 3 : size === 2 ? 6 : size === 3 ? 12 : 99
  const out: Phrase[] = []
  let cur: Phrase | null = null, t = 0, startT = 0
  s.notes.forEach((n, i) => {
    if (n.note != null) {
      if (!cur) { cur = { id: '', songId: s.id, start: i, end: i + 1, notes: [], size }; startT = t }
      cur.notes.push({ note: n.note, beat: t - startT, beats: n.beats }); cur.end = i + 1
      if (cur.notes.length >= per) { cur.id = `${s.id}:${cur.start}-${cur.end}`; out.push(cur); cur = null }
    }
    t += n.beats
  })
  const tail = cur as Phrase | null
  if (tail && tail.notes.length >= 2) { tail.id = `${s.id}:${tail.start}-${tail.end}`; out.push(tail) }
  return out
}

export const masteryOf = (id: string): PhraseMastery => {
  const e = engine()
  try { if (e) return e.mastery(id) } catch { /* default */ }
  return { rung: 'follow', streak: 0, last: 0, misses: 0 }
}

/** score-note index (into song.notes) of each sounding note of a phrase, for the left-hand judge */
export function scoreIdxs(p: Phrase): number[] {
  const s = songById(phraseSongId(p))
  const out: number[] = []
  if (!s) return out
  for (let i = p.start; i < p.end && i < s.notes.length; i++) if (s.notes[i].note != null) out.push(i)
  return out
}

/** a left-hand judge for a song (Easy/Full sheet level). `press` is only ever a bonus, never a wrong note. */
export function lhFor(songId: string, owner: string): GameLh | null {
  const s = songById(songId)
  if (!s) return null
  return new GameLh({ owner, title: s.title, notes: s.notes, key: s.key, bpm: s.bpm, beatsPerBar: s.beatsPerBar ?? 4, pickup: s.pickup, beatUnit: s.beatUnit, style: s.style, harmony: s.harmony })
}

// ---------- attempts and demos (recorded by the engine) ----------
export interface AttemptOpts { bpm?: number; startAt?: number; timingWindowMs?: number; onEvent?: (e: PhraseEvent) => void; idleMs?: number }
export interface AttemptHandle { cancel(): void; done: Promise<Attempt | null>; /** the engine is really running this attempt (and owns the sheet music while it does) */ live: boolean }
/**
 * The rung to RECORD an attempt at. The engine counts a clean pass only at the phrase's own rung (above it is "practice, no
 * record"; below it is a warm-up). null = practice only, because recording would not be honest:
 *  - the phrase is below the game's rung and the engine's rung would give MORE help than the game does (lit keys at follow/echo), or
 *  - the game judges the beat but the engine's rung for this phrase would not, so a pass the game failed could look clean to the engine.
 */
export function recordRung(phrase: Phrase, gameRung: Rung): Rung | null {
  const m = masteryOf(phrase.id).rung, mi = rungIx(m), ri = rungIx(gameRung)
  if (mi >= ri) return gameRung
  if (mi <= rungIx('echo')) return null
  if (RULES[gameRung].windowMs != null && RULES[m].windowMs == null) return null
  return m
}

/** how far along a phrase is, as a game rung (a brand-new phrase counts as follow: it is sung first, which records the listen) */
export const levelOf = (phrase: Phrase): Rung => clampRung(masteryOf(phrase.id).rung, 'follow', 'hands')

/** stop any running attempt/demo and take our sheet and lights down (leaving a game) */
export function stopPhrase() {
  const e = engine() as (PhraseEngineApi & { stopAll?: () => void }) | null
  try { e?.stopAll?.() } catch { /* ignore */ }
  clearScore('phrase'); clearGuide()
}

/** start a recorded attempt. The engine listens to the Judge itself and updates the kid's mastery when the phrase ends. */
export function startAttempt(phrase: Phrase, rung: Rung | null, opts: AttemptOpts = {}): AttemptHandle {
  const e = engine()
  if (e && rung) {
    try {
      const a = e.attempt(phrase, rung, opts as Parameters<PhraseEngineApi['attempt']>[2])
      return { cancel: () => { try { a.cancel() } catch { /* already over */ } }, done: a.done.catch(() => null), live: true }
    } catch (err) { console.warn('[phraseKit] attempt failed', err) }
  }
  return { cancel() { /* nothing to cancel */ }, done: Promise.resolve(null), live: false }
}

/** sing the phrase through the current instrument. Fallback (no engine): the same notes through the app's own player. */
export function demo(phrase: Phrase, bpm: number): Promise<void> {
  const e = engine()
  if (e) { try { return e.demo(phrase, bpm).catch(() => {}) } catch { /* fall through */ } }
  const beat = 60000 / bpm
  return new Promise((res) => {
    phrase.notes.forEach((n) => {
      window.setTimeout(() => playLocal(n.note, 84, true), n.beat * beat)
      window.setTimeout(() => playLocal(n.note, 0, false), (n.beat + Math.min(n.beats, 1.2) * 0.85) * beat)
    })
    const last = phrase.notes[phrase.notes.length - 1]
    window.setTimeout(res, ((last?.beat ?? 0) + (last?.beats ?? 1)) * beat)
  })
}

// ---------- kind coaching text ----------
export const pcName = (n: number) => PC_NAMES[pc(n)].replace('#', '♯')
export const ord = (n: number) => ['', '1st', '2nd', '3rd'][n] ?? `${n}th`

/** "the 2nd note: G, not A" style coaching for a wrong note. i is 0-based. */
export function wrongNote(i: number, expected: number, played: number): { short: string; long: string } {
  const e = pcName(expected), p = pcName(played)
  if (pc(expected) === pc(played)) {
    const up = played < expected
    return { short: `Right letter, wrong octave`, long: `Right letter (${e}), but play it a little ${up ? 'higher' : 'lower'}.` }
  }
  return { short: `That was ${p}`, long: `The ${ord(i + 1)} note is ${e}, not ${p}.` }
}

if (import.meta.hot) import.meta.hot.accept()
