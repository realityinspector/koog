// Vibes: the live wiring for the mood engine in vibesCore.ts.
// Listens to the judge (notes, slams, cadences...) and the harmony key, ticks the engine ~10x a second,
// and publishes { valence, arousal, mood, intensity, reasons } in `useVibes`.
// STABLE API: useVibes, onMoodChange(fn), vibeEventsSince(seq), noteEmoji(), MOODS (re-exported).
// Captions ("Minor chord -> a bit sad") go through the shared coach bus (src/coach/coachBus.ts).
// Other features (the mentor) may read useVibes.getState().mood / valence / arousal.
import { create } from 'zustand'
import { onJudge } from './judge'
import { useHarmonyStore } from './harmonyStore'
import { say } from '../coach/coachBus'
import { VibeCore, MOODS, type ChordInfo, type MoodId, type VibeEv } from './vibesCore'
import { inKey, pc, type Key } from './theory'

export { MOODS, MOOD_IDS, classifyChord, CHORD_EMOJI } from './vibesCore'
export type { MoodId, ChordInfo, ChordQuality, MoodDef } from './vibesCore'

export interface VibeState {
  valence: number; arousal: number; mood: MoodId; intensity: number; reasons: string[]
  chord: ChordInfo | null; activity: number
  /** show the little mood emoji next to the readouts (kid PLAY) */
  chip: boolean
  setChip: (on: boolean) => void
}
type Hot = { store?: ReturnType<typeof make>; core?: VibeCore; ring?: Ring; moodFns?: Set<MoodFn>; off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot

function chipSaved() { try { return localStorage.getItem('koog.vibes.chip') !== '0' } catch { return true } }
function make() {
  return create<VibeState>()((set) => ({
    valence: 0, arousal: -0.5, mood: 'calm', intensity: 0.2, reasons: [], chord: null, activity: 0,
    chip: chipSaved(),
    setChip: (chip) => { try { localStorage.setItem('koog.vibes.chip', chip ? '1' : '0') } catch { /* ignore */ } set({ chip }) },
  }))
}
export const useVibes = hot.store ?? make()
const core = hot.core ?? new VibeCore()

// ---- events for scenes (polled, so there is nothing to unsubscribe) ----
export type VibeEvent = (VibeEv | { type: 'mood'; mood: MoodId; prev: MoodId }) & { seq: number; t: number }
interface Ring { seq: number; list: VibeEvent[] }
const ring: Ring = hot.ring ?? { seq: 0, list: [] }
function push(e: VibeEv | { type: 'mood'; mood: MoodId; prev: MoodId }) {
  ring.list.push({ ...e, seq: ++ring.seq, t: performance.now() } as VibeEvent)
  if (ring.list.length > 40) ring.list.shift()
}
export const vibeSeq = () => ring.seq
/** events newer than `seq` (use vibeSeq() as the starting point) */
export function vibeEventsSince(seq: number): VibeEvent[] { return ring.list.filter((e) => e.seq > seq) }

type MoodFn = (mood: MoodId, prev: MoodId) => void
const moodFns: Set<MoodFn> = hot.moodFns ?? new Set()
export function onMoodChange(fn: MoodFn): () => void { moodFns.add(fn); return () => { moodFns.delete(fn) } }

/** A cartoon reaction for one note, matching the local vibe: major/minor key, tonic, out of key, high, low. */
export function noteEmoji(note: number, key: Key, rnd: () => number = Math.random): string {
  const pick = (a: string[]) => a[Math.floor(rnd() * a.length)]
  const minor = key.scale === 'minor' || key.scale === 'minorPentatonic'
  if (!inKey(note, key)) return pick(['😬', '🤪', '😵‍💫', '🙃'])
  if (note >= 84 && rnd() < 0.6) return pick(['✨', '🤩', '⭐'])
  if (note <= 45 && rnd() < 0.6) return pick(['👻', '😠', '🐻'])
  if (pc(note) === key.tonic) return minor ? '😌' : '🥰'
  return minor ? pick(['😔', '😢', '😞']) : pick(['😊', '😄', '🙂'])
}

// ---- captions through the shared bus ----
function caption(mood: MoodId, why: string | undefined) {
  if (!why) return
  say({ source: 'vibes', topic: 'mood:' + mood, text: why, priority: 1, ms: 3200, tone: 'mood' })
}

// ---- wiring ----
let lastPub = { v: 9, a: 9, m: '' as string, r: '', i: 9, c: '' }
function tick() {
  const now = performance.now()
  core.key = useHarmonyStore.getState().key
  const prevMood = core.mood
  const s = core.update(now)
  for (const e of core.out.splice(0)) push(e)
  if (s.mood !== prevMood) {
    push({ type: 'mood', mood: s.mood, prev: prevMood })
    for (const f of [...moodFns]) { try { f(s.mood, prevMood) } catch (e) { console.error('[vibes]', e) } }
    if (s.activity > 0.5) caption(s.mood, s.reasons[0])
  }
  const cname = s.chord?.name ?? ''
  if (Math.abs(s.valence - lastPub.v) > 0.01 || Math.abs(s.arousal - lastPub.a) > 0.01 || s.mood !== lastPub.m || s.reasons[0] !== lastPub.r
    || Math.abs(s.intensity - lastPub.i) > 0.02 || cname !== lastPub.c) {
    lastPub = { v: s.valence, a: s.arousal, m: s.mood, r: s.reasons[0] ?? '', i: s.intensity, c: cname }
    useVibes.setState({ valence: s.valence, arousal: s.arousal, mood: s.mood, intensity: s.intensity, reasons: s.reasons, chord: s.chord, activity: s.activity })
  }
}

;(hot.off as (() => void) | undefined)?.()
const offJudge = onJudge((e) => {
  const t = performance.now()
  switch (e.type) {
    case 'note': core.noteOn(e.g.note, e.g.velocity, t); break
    case 'off': core.noteOff(e.note, t); break
    case 'cluster': core.judge(e.boom ? 'boom' : 'fizzle', t); break
    case 'resolve': core.judge('resolve', t); break
    case 'cadence': core.judge('cadence', t); break
    case 'motif': core.judge('motif', t); break
  }
})
const timer = setInterval(tick, 100)

if (import.meta.hot) {
  import.meta.hot.data.store = useVibes
  import.meta.hot.data.core = core
  import.meta.hot.data.ring = ring
  import.meta.hot.data.moodFns = moodFns
  import.meta.hot.data.off = () => { offJudge(); clearInterval(timer) }
  import.meta.hot.accept()
}
export const moodLabel = (m: MoodId) => MOODS[m].label
