// The Judge. It grades every note for HARMONY, RHYTHM and STYLE, and spots the musical moments:
//   - tension -> release (an out-of-key note that steps into the key)
//   - cadence (a phrase that ends on the home note, then a pause)
//   - motif (a pattern of jumps you repeat, even starting on a different note)
//   - tone cluster (forearm or elbow on the keys). It fizzles, unless BOOM is charged.
// Visuals and games listen to this rather than to raw notes, so "playing well" means the same thing
// everywhere. Each rule is short and readable on purpose (see docs/GAME_DESIGN.md).
// STABLE API: onJudge(fn) -> unsubscribe, useJudge (meters), types below. Extend freely, don't rename.
import { create } from 'zustand'
import { onNote } from './notes'
import { useHarmonyStore } from './harmonyStore'
import { inKey, pc } from './theory'

export type GradeKind = 'tonic' | 'in' | 'spicy'
export type ClusterKind = 'fizzle' | 'boom'
export interface NoteGrade {
  id: number; note: number; velocity: number; t: number
  kind: GradeKind
  /** this note released the tension of an out-of-key note just before it */
  resolved: boolean
  /** part of a forearm cluster: fizzle (BOOM wasn't charged) or boom */
  cluster: ClusterKind | null
  /** started together with another note (a chord), so it has no rhythm of its own */
  chordMember: boolean
  /** 0..1, how close the gap since the last note is to a simple rhythm (same, half, double, ...). null = nothing to compare */
  rhythm: number | null
  /** semitones from the previous melody note (null for the first note of a phrase or a chord member) */
  step: number | null
  /** 0..1 overall quality of this note */
  score: number
}
export type JudgeEvent =
  | { type: 'note'; g: NoteGrade }
  | { type: 'off'; note: number }
  | { type: 'cluster'; notes: number[]; boom: boolean }
  | { type: 'resolve'; from: number; to: number }
  | { type: 'cadence'; note: number; length: number }
  | { type: 'motif'; notes: number[] }
  | { type: 'charged' }
export type JudgeListener = (e: JudgeEvent) => void

export interface JudgeState {
  /** 0..1 moving averages */
  harmony: number; rhythm: number; style: number; power: number
  /** 0..1 BOOM charge. Full = the next cluster is a BOOM instead of a fizzle. */
  charge: number
  booms: number; fizzles: number; cadences: number; motifs: number; resolves: number
}

const INIT: JudgeState = { harmony: 0.7, rhythm: 0.7, style: 0.7, power: 0.7, charge: 0, booms: 0, fizzles: 0, cadences: 0, motifs: 0, resolves: 0 }
const hot = import.meta.hot?.data as Record<string, unknown> | undefined
export const useJudge = (hot?.judgeStore as ReturnType<typeof make> | undefined) ?? make()
function make() { return create<JudgeState>()(() => ({ ...INIT })) }
// One listener set for the whole session, so subscribers survive edits to this file.
const listeners: Set<JudgeListener> = (hot?.judgeListeners as Set<JudgeListener> | undefined) ?? new Set()

export function onJudge(fn: JudgeListener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
function emit(e: JudgeEvent) {
  for (const fn of [...listeners]) {
    try { fn(e) } catch (err) { console.error('[judge] listener failed', err) }
  }
}

// ---- tunables ----
const CLUSTER_WINDOW = 90 // ms: notes that start this close together count as one "slam"
const CHORD_WINDOW = 50 // ms: notes this close are one chord
const PHRASE_GAP = 2000 // ms: a longer gap starts a new phrase (no rhythm comparison)
const CADENCE_PAUSE = 700 // ms of silence that ends a phrase
const EMA = 0.12
// simple duration ratios (log2): 1/4, 1/3, 1/2, 2/3, 1, 3/2, 2, 3, 4
const RATIOS = [-2, -1.585, -1, -0.585, 0, 0.585, 1, 1.585, 2]

// ---- per-session working state (fine to lose on an edit) ----
let win: { note: number; t: number }[] = []
let burst: { until: number; kind: ClusterKind } | null = null
let lastGroupT = -1e9
let prevIoi: number | null = null
let lastGroup: number[] = []
let prevMelody: { note: number; kind: GradeKind; t: number } | null = null
let phraseLen = 0
let intervals: number[] = []
let recentMelody: number[] = []
let lastMotifT = 0
let cadenceTimer: ReturnType<typeof setTimeout> | null = null

function closePairs(ns: number[]) {
  const u = [...new Set(ns)].sort((a, b) => a - b)
  let c = 0
  for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] <= 2) c++
  return c
}
// Forearm test: 4+ notes at once, packed shoulder-to-shoulder (3+ neighbours a step apart), or 7+ notes at all.
// Real chords are spread out (C E G = gaps of 4 and 3), so they never trip it.
const isCluster = (ns: number[]) => (ns.length >= 4 && closePairs(ns) >= 3) || ns.length >= 7

function rhythmScore(ioi: number, prev: number) {
  const r = Math.log2(ioi / prev)
  let d = Infinity
  for (const x of RATIOS) d = Math.min(d, Math.abs(r - x))
  return Math.max(0, Math.min(1, 1 - d / 0.2))
}
const styleOf = (step: number | null) => {
  if (step == null) return null
  const a = Math.abs(step)
  return a === 0 ? 0.7 : a <= 2 ? 1 : a <= 5 ? 0.85 : a <= 7 ? 0.65 : 0.4
}
const ema = (cur: number, x: number) => cur + (x - cur) * EMA
const powerOf = (s: Pick<JudgeState, 'harmony' | 'rhythm' | 'style'>) => s.harmony * 0.45 + s.rhythm * 0.3 + s.style * 0.25

function addCharge(st: JudgeState, amt: number): number {
  if (st.charge >= 1) return 1
  const c = Math.min(1, st.charge + amt)
  if (c >= 1) queueMicrotask(() => emit({ type: 'charged' }))
  return c
}

function scheduleCadence() {
  if (cadenceTimer) clearTimeout(cadenceTimer)
  cadenceTimer = setTimeout(() => {
    cadenceTimer = null
    const tonic = useHarmonyStore.getState().key.tonic
    const home = lastGroup.find((n) => pc(n) === tonic)
    if (phraseLen >= 4 && home != null) {
      useJudge.setState((s) => {
        const style = s.style + (1 - s.style) * 0.4
        return { style, power: powerOf({ ...s, style }), cadences: s.cadences + 1 }
      })
      emit({ type: 'cadence', note: home, length: phraseLen })
    }
    phraseLen = 0
    prevMelody = null
    prevIoi = null
  }, CADENCE_PAUSE)
}

function noteOn(id: number, note: number, velocity: number, t: number) {
  const key = useHarmonyStore.getState().key
  const kind: GradeKind = pc(note) === key.tonic ? 'tonic' : inKey(note, key) ? 'in' : 'spicy'

  // 1. clusters
  win = win.filter((w) => t - w.t < CLUSTER_WINDOW)
  win.push({ note, t })
  let cluster: ClusterKind | null = null
  let newCluster = false
  if (burst && t < burst.until) {
    cluster = burst.kind
    burst.until = t + 150
  } else if (isCluster(win.map((w) => w.note))) {
    const boom = useJudge.getState().charge >= 1
    cluster = boom ? 'boom' : 'fizzle'
    burst = { until: t + 150, kind: cluster }
    newCluster = true
  }

  // 2. chords and rhythm
  const chordMember = t - lastGroupT < CHORD_WINDOW
  let rhythm: number | null = null
  if (!chordMember) {
    const ioi = t - lastGroupT
    if (ioi > PHRASE_GAP) prevIoi = null
    else {
      if (prevIoi != null) rhythm = rhythmScore(ioi, prevIoi)
      prevIoi = ioi
    }
    lastGroupT = t
    lastGroup = [note]
  } else lastGroup.push(note)

  // 3. melody: step, tension -> release, motifs
  let step: number | null = null
  let resolved = false
  if (!chordMember && !cluster) {
    if (prevMelody && t - prevMelody.t < PHRASE_GAP) {
      step = note - prevMelody.note
      if (prevMelody.kind === 'spicy' && kind !== 'spicy' && Math.abs(step) <= 2 && t - prevMelody.t < 1500) resolved = true
      intervals.push(step)
      if (intervals.length > 24) intervals.shift()
    } else intervals = []
    recentMelody.push(note)
    if (recentMelody.length > 8) recentMelody.shift()
    prevMelody = { note, kind, t }
  }

  // 4. score + meters
  const harmonyIn = cluster ? 0 : resolved ? 1 : kind === 'tonic' ? 1 : kind === 'in' ? 0.9 : 0.25
  const styleIn = styleOf(step)
  const score = cluster === 'fizzle' ? 0 : cluster === 'boom' ? 1 : harmonyIn * 0.55 + (rhythm ?? 0.7) * 0.25 + (styleIn ?? 0.75) * 0.2
  const grade: NoteGrade = { id, note, velocity, t, kind, resolved, cluster, chordMember, rhythm, step, score }

  useJudge.setState((s) => {
    const harmony = cluster === 'boom' ? s.harmony : ema(s.harmony, harmonyIn)
    const rhythmM = rhythm == null ? s.rhythm : ema(s.rhythm, rhythm)
    const style = styleIn == null ? s.style : ema(s.style, styleIn)
    let charge = s.charge
    if (newCluster && cluster === 'boom') charge = 0
    else if (!cluster) charge = addCharge(s, (kind === 'tonic' ? 0.09 : kind === 'in' ? 0.065 : 0) + (resolved ? 0.1 : 0) + ((rhythm ?? 0) >= 0.7 ? 0.02 : 0))
    return {
      harmony, rhythm: rhythmM, style, charge, power: powerOf({ harmony, rhythm: rhythmM, style }),
      booms: s.booms + (newCluster && cluster === 'boom' ? 1 : 0),
      fizzles: s.fizzles + (newCluster && cluster === 'fizzle' ? 1 : 0),
      resolves: s.resolves + (resolved ? 1 : 0),
    }
  })

  emit({ type: 'note', g: grade })
  if (newCluster) {
    emit({ type: 'cluster', notes: win.map((w) => w.note), boom: cluster === 'boom' })
    phraseLen = 0
    intervals = []
    prevMelody = null
  } else if (!cluster) phraseLen++
  if (resolved) emit({ type: 'resolve', from: note - (step ?? 0), to: note })

  // motif: the last 3 jumps match 3 earlier jumps (not overlapping), and the pattern is interesting
  // (it changes direction or leaps). Plain scales don't count.
  if (step != null && intervals.length >= 6 && t - lastMotifT > 3000) {
    const n = intervals.length
    const pat = intervals.slice(n - 3)
    const interesting = pat.some((x) => Math.abs(x) >= 3) || (pat.some((x) => x > 0) && pat.some((x) => x < 0))
    if (interesting && pat.some((x) => x !== 0)) {
      for (let i = 0; i + 3 <= n - 3; i++) {
        if (intervals[i] === pat[0] && intervals[i + 1] === pat[1] && intervals[i + 2] === pat[2]) {
          lastMotifT = t
          useJudge.setState((s) => {
            const style = s.style + (1 - s.style) * 0.3
            return { style, power: powerOf({ ...s, style }), motifs: s.motifs + 1 }
          })
          emit({ type: 'motif', notes: recentMelody.slice(-4) })
          break
        }
      }
    }
  }
  if (!cluster) scheduleCadence()
}

;(hot?.judgeOff as (() => void) | undefined)?.()
const off = onNote((e) => {
  if (e.on) noteOn(e.id, e.note, e.velocity, performance.now())
  else emit({ type: 'off', note: e.note })
})

/** For tests and the dev rig: feed a fake note through the judge without touching the keyboard state. */
export function judgeFake(note: number, velocity = 100, on = true) {
  if (on) noteOn(-1e9 - Math.floor(Math.random() * 1e6), note, velocity, performance.now())
  else emit({ type: 'off', note })
}

if (import.meta.hot) {
  import.meta.hot.data.judgeStore = useJudge
  import.meta.hot.data.judgeListeners = listeners
  import.meta.hot.data.judgeOff = () => { off(); if (cadenceTimer) clearTimeout(cadenceTimer) }
  import.meta.hot.accept()
}
