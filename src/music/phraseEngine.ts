// The phrase engine: cuts songs into tiny phrases, grades attempts against a scaffold ladder, remembers
// what each kid has learned, and decides what to practise next. Contract: src/music/phrases.ts.
// No React here. The trainer (src/features/learn) and the games read this and the stores it feeds
// (usePhraseView in phrases.ts, useGuide, useScore, usePhraseTick below).
import { create } from 'zustand'
import {
  CLEAN_TO_CLIMB, DEFAULT_WINDOW_MS, REVIEW_AFTER_MS, RUNGS, clearPhraseView, setPhraseView, usePhraseView,
  type Attempt, type NoteResult, type Phrase, type PhraseEngineApi, type PhraseEvent, type PhraseMastery, type Rung,
} from './phrases'
import type { SongNote } from '../features/songs/songs'
import { SONGS } from '../features/songs/songs'
import { onJudge } from './judge'
import { clearGuideFor, setGuideFor, type GuideTone } from './guide'
// owned key glow: a late timer from this feature can't wipe another feature's glow (docs/STATE.md)
const setGuide = (t: number[], tone?: GuideTone, soon?: number[]) => setGuideFor('phrase', t, tone, soon)
const clearGuide = () => clearGuideFor('phrase')
import { clearScore, setScore, setScorePos } from './scoreStore'
import { getSheetLevel } from './sheetLevel'
import { arrange, type ArrStyle } from './arrange'
import { LH_SPLIT, lhAdvance, lhNear, lhPress, makeLh } from '../features/songs/lhJudge'
import { getActiveInstrument } from './instrument'
import { onProfileChange, pload, psave } from '../profile/profile'
import { msPerBeat, noteName, pc, type Key } from './theory'

type Size = Phrase['size']
const SAVE_KEY = 'phrases.v1'
const rungIdx = (r: Rung) => RUNGS.indexOf(r)
const MEMORY = rungIdx('memory')
const ECHO = rungIdx('echo')

interface Meta { notes: SongNote[]; bpb: number; pickup: number; bpm: number; tonic: number | null; key?: Key; unit?: 4 | 8; style?: ArrStyle }
interface Eng {
  cache: Record<string, PhraseMastery> | null
  listeners: Set<(e: PhraseEvent) => void>
  active: { cancel(): void } | null
  metas: Map<string, Meta>
  segs: Map<string, Phrase[]>
  demoStop: (() => void) | null
  off?: () => void
}
const hot = import.meta.hot?.data as { phraseEng?: Eng } | undefined
const E: Eng = hot?.phraseEng ?? { cache: null, listeners: new Set(), active: null, metas: new Map(), segs: new Map(), demoStop: null }
E.metas ??= new Map(); E.segs ??= new Map()

/** bumps whenever any mastery changes (or the kid changes): subscribe to re-render progress */
export const usePhraseTick = (import.meta.hot?.data.phraseTick as ReturnType<typeof makeTick> | undefined) ?? makeTick()
function makeTick() { return create<{ v: number }>()(() => ({ v: 0 })) }
const bump = () => usePhraseTick.setState((s) => ({ v: s.v + 1 }))

// ---------------------------------------------------------------- mastery storage
const fresh = (): PhraseMastery => ({ rung: 'listen', streak: 0, last: 0, misses: 0 })
const valid = (m: unknown): m is PhraseMastery => !!m && typeof m === 'object' && RUNGS.includes((m as PhraseMastery).rung)
function load(): Record<string, PhraseMastery> {
  const raw = pload<Record<string, unknown>>(SAVE_KEY, {})
  const out: Record<string, PhraseMastery> = {}
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (valid(v)) out[k] = { ...fresh(), ...v }
  return out
}
const store = () => (E.cache ??= load())
function persist() { psave(SAVE_KEY, store()); bump() }

/** mastery for the active kid (a copy; unseen phrases start at 'listen') */
export function mastery(phraseId: string): PhraseMastery { return { ...(store()[phraseId] ?? fresh()) } }
/** overwrite one phrase's mastery (tests, dad tools) */
export function setMastery(phraseId: string, m: Partial<PhraseMastery>) { store()[phraseId] = { ...mastery(phraseId), ...m }; persist() }
/** forget everything for the active kid (or one song) */
export function resetMastery(songId?: string) {
  if (!songId) E.cache = {}
  else for (const k of Object.keys(store())) if (k.startsWith(songId + ':')) delete store()[k]
  persist()
}
/** re-read from storage (after the profile changed behind our back) */
export function reloadMastery() { E.cache = null; bump() }

/** this phrase is "known": it reached 'memory' or beyond */
export const isKnown = (m: PhraseMastery) => rungIdx(m.rung) >= MEMORY || m.mastered != null
/** finished the whole ladder */
export const isMastered = (m: PhraseMastery) => m.mastered != null
/** old enough that it should come back for a quick review */
export const isDue = (m: PhraseMastery, now = Date.now()) => rungIdx(m.rung) >= MEMORY && m.last > 0 && now - m.last > REVIEW_AFTER_MS
/** the lower rung a due phrase is reviewed at (two steps down, never below echo) */
export const reviewRung = (r: Rung): Rung => RUNGS[Math.max(ECHO, rungIdx(r) - 2)]
/** clean passes a rung needs before it climbs ('listen' just needs one hearing) */
export const passesNeeded = (r: Rung) => (r === 'listen' ? 1 : CLEAN_TO_CLIMB)

// ---------------------------------------------------------------- segmentation
function metaFor(songId: string, notes: SongNote[], beatsPerBar?: number): Meta {
  const song = SONGS.find((s) => s.id === songId)
  const snd = notes.filter((n) => n.note != null)
  const last = snd[snd.length - 1]?.note ?? null
  const m: Meta = {
    notes, bpb: beatsPerBar ?? song?.beatsPerBar ?? 4, pickup: song?.pickup ?? 0, bpm: song?.bpm ?? 100,
    tonic: song ? song.key.tonic : last != null ? pc(last) : null, key: song?.key, unit: song?.beatUnit, style: song?.style,
  }
  E.metas.set(songId, m)
  return m
}
const sig = (songId: string, notes: SongNote[], bpb: number) => songId + '|' + notes.length + '|' + bpb + '|' + notes.reduce((a, n) => a + (n.note ?? 0) * 3 + n.beats, 0)

interface Snd { i: number; note: number; beat: number; beats: number }
function sounding(notes: SongNote[]): Snd[] {
  const out: Snd[] = []; let t = 0
  notes.forEach((n, i) => { if (n.note != null) out.push({ i, note: n.note, beat: t, beats: n.beats }); t += n.beats })
  return out
}
function mk(songId: string, notes: SongNote[], snd: Snd[], a: number, b: number, size: Size): Phrase {
  const seg = snd.slice(a, b)
  const start = seg[0].i, end = seg[seg.length - 1].i + 1, b0 = seg[0].beat
  return { id: `${songId}:${start}-${end}`, songId, start, end, size, notes: seg.map((s) => ({ note: s.note, beat: Math.round((s.beat - b0) * 1000) / 1000, beats: s.beats })) }
}
const frac = (x: number) => Math.abs(x - Math.round(x)) < 1e-6 ? 0 : x - Math.floor(x)

/** cost of cutting the line between sounding notes a and b (lower = nicer place to stop) */
function cutCost(a: Snd, b: Snd, notes: SongNote[], meta: Meta): number {
  if (b.i - a.i > 1) return 0 // a rest sits between them
  if (a.beats >= 2) return 0 // a long note is a natural breath
  const pos = b.beat - meta.pickup
  const f = frac(b.beat)
  if (f !== 0) return Math.abs(f - 0.5) < 1e-6 ? 6 : 8 // mid-beat: avoid
  const inBar = ((pos % meta.bpb) + meta.bpb) % meta.bpb
  if (inBar < 1e-6) return 0.05
  if (meta.bpb % 2 === 0 && Math.abs(inBar - meta.bpb / 2) < 1e-6) return 0.2
  return 0.35
}
const LEN_COST = [0, 2.5, 0.5, 0, 3, 5, 7, 9, 11]

function size1(songId: string, notes: SongNote[], snd: Snd[], meta: Meta): Phrase[] {
  const n = snd.length
  const dp = new Array<number>(n + 1).fill(Infinity), from = new Array<number>(n + 1).fill(0)
  dp[0] = 0
  for (let j = 1; j <= n; j++) {
    const cut = j === n ? 0 : cutCost(snd[j - 1], snd[j], notes, meta)
    for (let L = 1; L <= Math.min(8, j); L++) {
      // a repeated-note run stays together a little more happily (a motif is one idea)
      const c = dp[j - L] + LEN_COST[L] + cut
      if (c < dp[j]) { dp[j] = c; from[j] = j - L }
    }
  }
  const cuts: number[] = []
  for (let j = n; j > 0; j = from[j]) cuts.push(j)
  cuts.reverse()
  const out: Phrase[] = []; let a = 0
  for (const j of cuts) { out.push(mk(songId, notes, snd, a, j, 1)); a = j }
  return out
}

function size2(songId: string, notes: SongNote[], snd: Snd[], s1: Phrase[]): Phrase[] {
  const out: Phrase[] = []
  const idxOf = (p: Phrase) => snd.findIndex((x) => x.i === p.start)
  let k = 0
  while (k < s1.length) {
    const rest = s1.length - k
    const take = rest === 3 ? 3 : Math.min(2, rest) // an odd leftover joins the last chain
    const last = k + take - 1
    out.push(mk(songId, notes, snd, idxOf(s1[k]), idxOf(s1[last]) + s1[last].notes.length, 2))
    k += take
  }
  return out
}

function size3(songId: string, notes: SongNote[], snd: Snd[], meta: Meta): Phrase[] {
  const barOf = (s: Snd) => Math.max(0, Math.floor((s.beat - meta.pickup + 1e-6) / meta.bpb))
  const lastBar = barOf(snd[snd.length - 1])
  const nBars = lastBar + 1
  if (nBars <= 5) return [mk(songId, notes, snd, 0, snd.length, 3)]
  // end of bar k -> index of the last sounding note in that bar (or earlier)
  const lastIn: number[] = []; // exclusive end index into snd for bars 0..k
  for (let k = 0; k <= lastBar; k++) { let e = 0; snd.forEach((s, x) => { if (barOf(s) <= k) e = x + 1 }); lastIn.push(e) }
  const endCost = (k: number) => {
    const e = lastIn[k]; const lastN = snd[e - 1]; const next = snd[e]
    let c = 0
    if (e === snd.length) return -3 // the song's end
    if (pc(lastN.note) === meta.tonic) c -= 3
    if (lastN.beats >= 2 || (next && next.i - lastN.i > 1)) c -= 1
    return c
  }
  const LCOST: Record<number, number> = { 1: 4, 2: 0.8, 3: 0.4, 4: 0, 5: 1.2 }
  const dp = new Array<number>(nBars).fill(Infinity), from = new Array<number>(nBars).fill(-1)
  for (let k = 0; k < nBars; k++) {
    for (let L = 1; L <= 5; L++) {
      const prev = k - L
      if (prev < -1) break
      const base = prev === -1 ? 0 : dp[prev]
      const c = base + LCOST[L] + endCost(k)
      if (c < dp[k]) { dp[k] = c; from[k] = prev }
    }
  }
  const ends: number[] = []
  for (let k = nBars - 1; k >= 0; k = from[k]) ends.push(k)
  ends.reverse()
  const out: Phrase[] = []; let a = 0
  for (const k of ends) { out.push(mk(songId, notes, snd, a, lastIn[k], 3)); a = lastIn[k] }
  return out
}

/** cut a song into phrases of a size (see PhraseEngineApi.segment). Results are cached; ids are stable. */
export function segment(songId: string, notes: SongNote[], size: Size, beatsPerBar?: number): Phrase[] {
  const meta = metaFor(songId, notes, beatsPerBar)
  const key = sig(songId, notes, meta.bpb) + '|' + size
  const hit = E.segs.get(key)
  if (hit) return hit
  const snd = sounding(notes)
  let out: Phrase[] = []
  if (snd.length) {
    if (size === 4) out = [mk(songId, notes, snd, 0, snd.length, 4)]
    else {
      const s1 = size1(songId, notes, snd, meta)
      out = size === 1 ? s1 : size === 2 ? size2(songId, notes, snd, s1) : size3(songId, notes, snd, meta)
    }
  }
  if (E.segs.size > 400) E.segs.clear()
  E.segs.set(key, out)
  return out
}

// ---------------------------------------------------------------- the ladder: what to practise next
/** every distinct phrase of a song, small to big. A chain with the same notes as a smaller phrase is skipped. */
export function ladderOf(songId: string, notes: SongNote[], beatsPerBar?: number): Phrase[] {
  const byId = new Map<string, Phrase>()
  for (const sz of [1, 2, 3, 4] as Size[]) for (const p of segment(songId, notes, sz, beatsPerBar)) byId.set(p.id, p) // same notes at a bigger size: the bigger label wins
  return [...byId.values()]
}
const inside = (q: Phrase, p: Phrase) => q.start >= p.start && q.end <= p.end && q.id !== p.id
/** the smaller phrases inside a chain, in order (empty for size 1) */
export function partsOf(p: Phrase, songNotes: SongNote[], beatsPerBar?: number): Phrase[] {
  if (p.size === 1) return []
  const lower = ladderOf(p.songId, songNotes, beatsPerBar).filter((q) => q.size < p.size && inside(q, p))
  const nextSize = Math.max(...lower.map((q) => q.size), 0)
  return lower.filter((q) => q.size === nextSize).sort((a, b) => a.start - b.start)
}
/** a chain opens when every tiny phrase inside it is known */
const unlocked = (p: Phrase, songNotes: SongNote[], bpb?: number) => p.size === 1 || segment(p.songId, songNotes, 1, bpb).filter((q) => inside(q, p)).every((q) => isKnown(mastery(q.id)))
/** the rung to practise a phrase at right now (a due phrase is reviewed lower) */
export const practiceRung = (p: Phrase): Rung => { const m = mastery(p.id); return isDue(m) ? reviewRung(m.rung) : m.rung }

/** the next phrase to practise: reviews first, then chains that just became possible, then the lowest unlearned tiny phrase */
export function nextPhrase(songId: string, notes: SongNote[], beatsPerBar?: number): { phrase: Phrase; rung: Rung } {
  const all = ladderOf(songId, notes, beatsPerBar)
  const now = Date.now()
  // 1. spaced review: one quick pass at a lower rung
  const due = all.filter((p) => isDue(mastery(p.id), now)).sort((a, b) => mastery(a.id).last - mastery(b.id).last || a.size - b.size)
  if (due[0]) return { phrase: due[0], rung: reviewRung(mastery(due[0].id).rung) }
  // 2. a chain whose parts are all known and which is not itself known yet
  for (const p of all) {
    if (p.size === 1) continue
    let m = mastery(p.id)
    if (isKnown(m) || !unlocked(p, notes, beatsPerBar)) continue
    if (m.last === 0) { // first time offered: start the chain at 'echo' (its parts are already known) and announce it
      setMastery(p.id, { rung: 'echo', streak: 0, misses: 0, last: now })
      m = mastery(p.id)
      emit({ type: 'chain', from: partsOf(p, notes, beatsPerBar), to: p })
    }
    return { phrase: p, rung: m.rung }
  }
  // 3. the lowest unlearned tiny phrase, left to right
  for (const p of all) if (p.size === 1 && !isKnown(mastery(p.id))) return { phrase: p, rung: mastery(p.id).rung }
  // 4. everything is known: keep climbing the unlocked phrase with the lowest rung (bigger ones first on ties)
  const open = all.filter((p) => !isMastered(mastery(p.id)) && unlocked(p, notes, beatsPerBar))
    .sort((a, b) => rungIdx(mastery(a.id).rung) - rungIdx(mastery(b.id).rung) || b.size - a.size)
  if (open[0]) return { phrase: open[0], rung: mastery(open[0].id).rung }
  const whole = all[all.length - 1]
  return { phrase: whole, rung: 'hands' }
}

/** how far along a song is: tiny phrases at 'memory' or above */
export function songProgress(songId: string, notes: SongNote[], beatsPerBar?: number): { total: number; known: number; pct: number } {
  const s1 = segment(songId, notes, 1, beatsPerBar)
  const known = s1.filter((p) => isKnown(mastery(p.id))).length
  return { total: s1.length, known, pct: s1.length ? Math.round((known / s1.length) * 100) : 0 }
}

// ---------------------------------------------------------------- events
function emit(e: PhraseEvent) { for (const fn of [...E.listeners]) { try { fn(e) } catch (err) { console.error('[phrase] listener failed', err) } } }
export function onPhraseEvent(fn: (e: PhraseEvent) => void): () => void { E.listeners.add(fn); return () => { E.listeners.delete(fn) } }

// ---------------------------------------------------------------- recording an attempt
export interface Recorded { climbed?: { from: Rung; to: Rung }; demoted?: { from: Rung; to: Rung }; mastered?: boolean; review?: boolean }
function record(phrase: Phrase, rung: Rung, clean: boolean, reviewDue: boolean): Recorded {
  const m = mastery(phrase.id), now = Date.now(), out: Recorded = {}
  const ri = rungIdx(rung), mi = rungIdx(m.rung)
  if (ri < mi) { // a lower rung than where this phrase stands: a review or an easy warm-up
    if (clean) m.last = now
    else if (reviewDue) { m.rung = rung; m.streak = 0; m.misses = 0; m.last = now; out.demoted = { from: RUNGS[mi], to: rung } } // forgot it a bit: rebuild from here
    out.review = reviewDue
    if (!clean && !reviewDue) m.misses++
  } else if (ri === mi) {
    m.last = now
    if (clean) {
      m.streak++
      if (m.streak >= passesNeeded(m.rung)) {
        m.streak = 0; m.misses = 0
        if (mi < RUNGS.length - 1) { m.rung = RUNGS[mi + 1]; out.climbed = { from: RUNGS[mi], to: m.rung } }
        else if (m.mastered == null) { m.mastered = now; out.mastered = true }
      }
    } else {
      m.streak = 0; m.misses++
      // a few misses in a row: step back one rung, but never below echo
      if (m.misses >= 3 && mi > ECHO) { m.rung = RUNGS[mi - 1]; m.misses = 0; out.demoted = { from: RUNGS[mi], to: m.rung } }
    }
  } else return out // played above its rung: practice, no record
  store()[phrase.id] = m
  persist()
  return out
}

// ---------------------------------------------------------------- attempts
const songSlice = (p: Phrase): SongNote[] => {
  const n = E.metas.get(p.songId)?.notes
  if (n && n.length >= p.end) return n.slice(p.start, p.end)
  const out: SongNote[] = []; let t = 0
  for (const x of p.notes) { if (x.beat > t + 1e-6) out.push({ note: null, beats: x.beat - t }); out.push({ note: x.note, beats: x.beats }); t = x.beat + x.beats }
  return out
}
const bpmOf = (p: Phrase) => E.metas.get(p.songId)?.bpm ?? SONGS.find((s) => s.id === p.songId)?.bpm ?? 100

export const ordinal = (n: number) => (['1st', '2nd', '3rd'][n - 1] ?? n + 'th')
/** one kind sentence about how an attempt went (null if clean) */
export function describeMiss(a: Attempt): string | null {
  const i = a.results.findIndex((r) => !r.ok)
  if (i < 0) return null
  const r = a.results[i]
  if (r.why === 'wrong') return `That was ${r.played != null ? noteName(r.played).replace(/\d/, '') : 'a different note'}, try ${noteName(r.expected).replace(/\d/, '')}.`
  if (r.why === 'early') return `A little early on the ${ordinal(i + 1)} note. Wait for the beat.`
  if (r.why === 'late') return `A little late on the ${ordinal(i + 1)} note. Get ready a touch sooner.`
  if (r.why === 'missing') return `We lost it at the ${ordinal(i + 1)} note. Take a breath and go again.`
  return 'Almost! Go again.'
}

function stopDemo() { E.demoStop?.(); E.demoStop = null }

/** play the phrase for the kid to hear (current instrument), lighting the keys. Does NOT feed the judge or the games. */
export function demo(phrase: Phrase, bpm?: number): Promise<void> {
  stopDemo()
  const spb = msPerBeat(bpm ?? bpmOf(phrase))
  let stopped = false
  const timers: ReturnType<typeof setTimeout>[] = []
  return new Promise<void>((resolve) => {
    let target: { on(n: number): void; off(n: number): void; all(): void } | null = null
    const finish = () => {
      for (const t of timers) clearTimeout(t)
      try { target?.all() } catch { /* ignore */ }
      clearGuide(); setPhraseView({ index: 0 })
      if (E.demoStop === stop) E.demoStop = null
      resolve()
    }
    const stop = () => { if (stopped) return; stopped = true; finish() }
    E.demoStop = stop
    void (async () => {
      try {
        const inst = getActiveInstrument()
        if (inst) { target = { on: (n) => inst.noteOn(n, 90), off: (n) => inst.noteOff(n), all: () => inst.allOff?.() } }
        else {
          const { getSynth } = await import('../features/synth-history/engine')
          const sy = getSynth()
          void sy.unlock?.()
          target = { on: (n) => sy.noteOn(n, 90), off: (n) => sy.noteOff(n), all: () => { for (const x of phrase.notes) sy.noteOff(x.note) } }
        }
      } catch { /* no audio: still run the lights */ }
      if (stopped) return
      phrase.notes.forEach((n, i) => {
        timers.push(setTimeout(() => { setGuide([n.note], 'next'); setPhraseView({ index: i }); try { target?.on(n.note) } catch { /* ignore */ } }, n.beat * spb))
        timers.push(setTimeout(() => { try { target?.off(n.note) } catch { /* ignore */ } }, (n.beat + Math.max(0.1, n.beats * 0.9)) * spb))
      })
      const last = phrase.notes[phrase.notes.length - 1]
      timers.push(setTimeout(stop, (last.beat + last.beats) * spb + 120))
    })()
  })
}

export interface AttemptOpts { bpm?: number; startAt?: number; timingWindowMs?: number; onEvent?: (e: PhraseEvent) => void; idleMs?: number }
const ECHO_GUIDE_MS = 800

export function attempt(phrase: Phrase, rung: Rung, opts: AttemptOpts = {}): { cancel(): void; done: Promise<Attempt> } {
  E.active?.cancel()
  stopDemo()
  const bpm = opts.bpm ?? bpmOf(phrase)
  const beatMs = msPerBeat(bpm)
  const win = opts.timingWindowMs ?? DEFAULT_WINDOW_MS
  const n = phrase.notes.length
  const m0 = mastery(phrase.id)
  const reviewDue = rungIdx(rung) < rungIdx(m0.rung) && isDue(m0)
  const emitAll = (e: PhraseEvent) => { opts.onEvent?.(e); emit(e) }

  const slice = songSlice(phrase)
  const map: number[] = []; slice.forEach((s, i) => { if (s.note != null) map.push(i) })
  const meta = E.metas.get(phrase.songId)
  // bar lines on the sheet line up with the real bars: pickup = beats until the next bar line
  const sBeat = (E.metas.get(phrase.songId)?.notes ?? []).slice(0, phrase.start).reduce((a, x) => a + x.beats, 0)
  const bpb = meta?.bpb ?? 4, p0 = meta?.pickup ?? 0
  const pickup = sBeat < p0 ? p0 - sBeat : (() => { const o = (((sBeat - p0) % bpb) + bpb) % bpb; return o < 1e-6 ? 0 : bpb - o })()
  const song = SONGS.find((s) => s.id === phrase.songId)
  setScore({ owner: 'phrase', title: song?.title ?? 'Phrase', notes: slice, key: meta?.key, bpm, beatsPerBar: bpb, pickup, beatUnit: meta?.unit, style: meta?.style }, map[0] ?? 0)
  setPhraseView({ phrase, rung, index: 0, hideSheet: rung === 'blind' })

  // left hand (hands rung): chord tones judged with the same bookkeeping SONGS uses
  let lh = null as ReturnType<typeof makeLh> | null
  if (rung === 'hands') {
    const lvl = getSheetLevel() === 'single' ? 'easy' : getSheetLevel()
    try { lh = makeLh(arrange({ notes: slice, key: meta?.key, beatsPerBar: bpb, beatUnit: meta?.unit, pickup: 0, title: song?.title ?? 'Phrase', style: meta?.style }, lvl)) } catch { lh = null }
  }

  const results: (NoteResult | null)[] = new Array(n).fill(null)
  let idx = 0, t0 = opts.startAt ?? 0, hadWrong = false, finished = false, lhHits = 0
  const timers: ReturnType<typeof setTimeout>[] = []
  let idleT: ReturnType<typeof setTimeout> | null = null, guideT: ReturnType<typeof setTimeout> | null = null
  let unsub: (() => void) | null = null
  let resolveDone!: (a: Attempt) => void
  const doneP = new Promise<Attempt>((r) => { resolveDone = r })
  const dispose = () => {
    finished = true; unsub?.(); for (const t of timers) clearTimeout(t); if (idleT) clearTimeout(idleT); if (guideT) clearTimeout(guideT)
    if (E.active === handle) E.active = null
    clearGuide(); clearPhraseView()
  }
  const finish = (cancelled = false) => {
    if (finished) return
    const peeked = usePhraseView.getState().peekUsed === true // the keybed hinted the next key: not a clean memory pass
    dispose()
    for (let i = 0; i < n; i++) if (!results[i]) results[i] = { expected: phrase.notes[i].note, played: null, timingMs: null, ok: false, why: 'missing' }
    const rs = results as NoteResult[]
    let clean = rs.every((r) => r.ok) && !hadWrong && !peeked
    if (lh && clean && lh.total > 0) { lhAdvance(lh, 1e9, true); clean = lhHits >= Math.max(1, Math.ceil(lh.total / 2)) }
    const att: Attempt & { cancelled?: boolean } = { phraseId: phrase.id, rung, results: rs, clean }
    if (cancelled) { att.cancelled = true; att.clean = false } else {
      const rec = record(phrase, rung, clean, reviewDue)
      if (rec.climbed) emitAll({ type: 'climb', phrase, from: rec.climbed.from, to: rec.climbed.to })
    }
    if (!cancelled) emitAll({ type: 'done', attempt: att })
    resolveDone(att)
  }
  const handle = { cancel: () => { if (rung === 'listen') stopDemo(); finish(true) } }
  E.active = handle

  emitAll({ type: 'start', phrase, rung })

  const showNext = () => { if (rung === 'follow' && idx < n) setGuide([phrase.notes[idx].note], 'next') }
  const bumpIdle = () => {
    if (rung === 'listen' || rung === 'follow') return
    if (idleT) clearTimeout(idleT)
    idleT = setTimeout(() => finish(), opts.idleMs ?? 9000)
  }
  const advance = (res: NoteResult) => {
    const rec = (results[idx] ??= res) // a note that needed a retry stays unclean
    emitAll({ type: 'note', phrase, index: idx, result: res })
    const next = idx + 1
    setScorePos(next < n ? map[next] : slice.length, rec.ok ? 'hit' : 'miss')
    idx = next
    setPhraseView({ index: idx })
    if (idx >= n) { if (rung === 'hands') timers.push(setTimeout(() => finish(), 350)); else finish(); return }
    showNext(); bumpIdle()
  }

  if (rung === 'listen') {
    void demo(phrase, bpm).then(() => { if (!finished) { for (let i = 0; i < n; i++) results[i] = { expected: phrase.notes[i].note, played: phrase.notes[i].note, timingMs: null, ok: true }; finish() } })
    return { cancel: handle.cancel, done: doneP }
  }
  if (rung === 'follow') showNext()
  if (rung === 'echo') {
    setGuide([...new Set(phrase.notes.map((x) => x.note))], 'next')
    guideT = setTimeout(clearGuide, ECHO_GUIDE_MS)
  }

  unsub = onJudge((e) => {
    if (finished || e.type !== 'note') return
    const g = e.g
    if (g.cluster) return
    if (idx >= n) {
      // hands: extra notes after the melody still earn left-hand credit
      if (lh && lhPress(lh, g.note, (g.t - t0) / beatMs)) lhHits++
      return
    }
    const exp = phrase.notes[idx]
    if (g.note !== exp.note) {
      if (lh) { // not the melody key: maybe a left-hand chord tone (never wrong)
        const p = t0 ? (g.t - t0) / beatMs : 0
        if (g.note < LH_SPLIT && lhPress(lh, g.note, p)) { lhHits++; return }
        if (g.note < LH_SPLIT && lhNear(lh, g.note, p)) return
      }
      const res: NoteResult = { expected: exp.note, played: g.note, timingMs: null, ok: false, why: 'wrong' }
      hadWrong = true
      if (rung === 'follow') { results[idx] = results[idx] ?? res; emitAll({ type: 'note', phrase, index: idx, result: res }); setScorePos(map[idx], undefined); return }
      advance(res); return
    }
    // right pitch
    if (idx === 0 && !t0) t0 = g.t
    let res: NoteResult = { expected: exp.note, played: g.note, timingMs: null, ok: true }
    if (rung === 'timed' || rung === 'blind' || rung === 'hands') {
      const delta = g.t - (t0 + exp.beat * beatMs)
      res = { ...res, timingMs: Math.round(delta) }
      if (rung !== 'hands' && Math.abs(delta) > win) { res.ok = false; res.why = delta < 0 ? 'early' : 'late' }
      else if (rung === 'hands' && Math.abs(delta) > win * 2.5) { res.ok = false; res.why = delta < 0 ? 'early' : 'late' }
    }
    advance(res)
  })
  return { cancel: handle.cancel, done: doneP }
}

/** stop whatever is playing/grading (leaving the trainer) */
export function stopAll() { E.active?.cancel(); stopDemo(); clearScore('phrase'); clearGuide(); clearPhraseView() }

export const phraseEngine: PhraseEngineApi & {
  nextPhrase: typeof nextPhrase; songProgress: typeof songProgress; ladderOf: typeof ladderOf; partsOf: typeof partsOf
  describeMiss: typeof describeMiss; stopAll: typeof stopAll
} = { segment, mastery, nextPhrase, attempt, demo, onPhraseEvent, songProgress, ladderOf, partsOf, describeMiss, stopAll }

;(import.meta.hot?.data.phraseOff as (() => void) | undefined)?.()
const offProfile = onProfileChange(() => { E.cache = null; bump() })

if (import.meta.hot) {
  import.meta.hot.data.phraseEng = E
  import.meta.hot.data.phraseTick = usePhraseTick
  import.meta.hot.data.phraseOff = () => offProfile()
  import.meta.hot.dispose(() => { E.active?.cancel(); stopDemo() })
  import.meta.hot.accept()
}
