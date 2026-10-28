// Shared "what key are we in" state. Visualizer, HUD and challenges all read this.
// STABLE API: useHarmonyStore with { key, autoDetect, setKey, setAutoDetect }. Extend freely, don't rename.
import { create } from 'zustand'
import { detectKey, inKey, type Key } from './theory'
import { detectChord } from './chords'
import { onNote } from './notes'
import { onProfileChange, pload, psave } from '../profile/profile'

export type Judgement = 'tonic' | 'in' | 'out'

export interface HarmonyState {
  key: Key
  autoDetect: boolean
  lastJudgement: Judgement | null
  streak: number
  bestStreak: number
  accuracy: number // 0..1, in-key share of last 24 notes
  heldNotes: number[]
  chord: string | null
  setKey: (key: Key) => void
  setAutoDetect: (on: boolean) => void
}

// Saved per kid (see src/profile/profile.ts).
function load(): { key?: Key; autoDetect?: boolean; bestStreak?: number } {
  return pload('harmony', {})
}
function save(s: HarmonyState) {
  psave('harmony', { key: s.key, autoDetect: s.autoDetect, bestStreak: s.bestStreak })
}

function make() {
  const saved = load()
  return create<HarmonyState>()((set) => ({
    key: saved.key ?? { tonic: 0, scale: 'major' },
    autoDetect: saved.autoDetect ?? false,
    lastJudgement: null,
    streak: 0,
    bestStreak: saved.bestStreak ?? 0,
    accuracy: 1,
    heldNotes: [],
    chord: null,
    setKey: (key) => set({ key }),
    setAutoDetect: (autoDetect) => set({ autoDetect }),
  }))
}

export const useHarmonyStore = (import.meta.hot?.data.harmony as ReturnType<typeof make> | undefined) ?? make()

export function judge(note: number): Judgement {
  const { key } = useHarmonyStore.getState()
  if (((note - key.tonic) % 12 + 12) % 12 === 0) return 'tonic'
  return inKey(note, key) ? 'in' : 'out'
}

// ---- wiring (subscribes once; HMR swaps the listener) ----
const recent: boolean[] = []
const history: number[] = []
let candidate = ''
let candidateCount = 0

function handle(e: { note: number; velocity: number; on: boolean }) {
  const st = useHarmonyStore.getState()
  const held = new Set(st.heldNotes)
  if (!e.on) {
    held.delete(e.note)
    const heldNotes = [...held]
    useHarmonyStore.setState({ heldNotes, chord: detectChord(heldNotes) })
    return
  }
  held.add(e.note)
  const heldNotes = [...held]
  const j = judge(e.note)
  const good = j !== 'out'
  recent.push(good)
  if (recent.length > 24) recent.shift()
  const streak = good ? st.streak + 1 : 0
  const bestStreak = Math.max(st.bestStreak, streak)
  useHarmonyStore.setState({
    heldNotes, chord: detectChord(heldNotes), lastJudgement: j, streak, bestStreak,
    accuracy: recent.filter(Boolean).length / recent.length,
  })

  history.push(e.note)
  if (history.length > 32) history.shift()
  if (st.autoDetect && history.length >= 8) {
    const { key: k, confidence } = detectKey(history)
    const id = `${k.tonic}-${k.scale}`
    const cur = useHarmonyStore.getState().key
    if (id === `${cur.tonic}-${cur.scale}`) { candidate = ''; candidateCount = 0 }
    else if (confidence > 0.5) {
      if (id === candidate) candidateCount++
      else { candidate = id; candidateCount = 1 }
      if (candidateCount >= 4) { useHarmonyStore.getState().setKey(k); candidate = ''; candidateCount = 0 }
    }
  }
}

;(import.meta.hot?.data.harmonyOff as (() => void) | undefined)?.()
const off = onNote(handle)

// A different kid signed in: load their key, settings and best streak.
const offProfile = onProfileChange(() => {
  const saved = load()
  prev = { ...useHarmonyStore.getState(), key: saved.key ?? { tonic: 0, scale: 'major' }, autoDetect: saved.autoDetect ?? false, bestStreak: saved.bestStreak ?? 0 }
  useHarmonyStore.setState({ key: prev.key, autoDetect: prev.autoDetect, bestStreak: prev.bestStreak, streak: 0, accuracy: 1 })
})

let prev = useHarmonyStore.getState()
const unsub = useHarmonyStore.subscribe((s) => {
  if (s.key !== prev.key || s.autoDetect !== prev.autoDetect || s.bestStreak !== prev.bestStreak) save(s)
  prev = s
})

if (import.meta.hot) {
  import.meta.hot.data.harmony = useHarmonyStore
  import.meta.hot.data.harmonyOff = () => { off(); unsub(); offProfile() }
  import.meta.hot.accept()
}
