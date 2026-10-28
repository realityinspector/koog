import { create } from 'zustand'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onNote } from '../../music/notes'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { CHALLENGES, type ChallengeDef, type Engine, type Finish } from './defs'

export interface Result extends Finish { defId: string; level: number; best: number; isBest: boolean; newBadge: string | null }
interface Active { def: ChallengeDef; level: number; engine: Engine; prevKey: ReturnType<typeof useHarmonyStore.getState>['key']; prevAuto: boolean }
interface S {
  active: Active | null
  result: Result | null
  rev: number
  sound: boolean
  bests: Record<string, number>
  badges: Record<string, 1 | 2>
  start: (id: string, level: number) => void
  quit: () => void
  tick: () => void
  setSound: (on: boolean) => void
}

// Saved per kid (see src/profile/profile.ts).
const load = pload
const save = psave

let ac: AudioContext | null = null
function beep(note: number, gain = 0.08) {
  if (!ac) return
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime
    o.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (note - 69) / 12)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.55)
  } catch { /* ignore */ }
}

function make() {
  return create<S>()((set, get) => {
    const restoreKey = () => {
      const a = get().active; if (!a) return
      const h = useHarmonyStore.getState(); h.setKey(a.prevKey); h.setAutoDetect(a.prevAuto)
    }
    const afterStep = () => {
      const a = get().active; if (!a) return
      const en = a.engine
      if (en.beep != null) { if (get().sound) beep(en.beep); en.beep = null }
      if (en.beepChord) { if (get().sound) en.beepChord.forEach((n) => beep(n, 0.03)); en.beepChord = undefined }
      if (en.done) {
        const f = en.done, bk = `${a.def.id}:${a.level}`
        const prev = get().bests[bk]
        const isBest = prev === undefined || f.score > prev
        const bests = isBest ? { ...get().bests, [bk]: f.score } : get().bests
        const badges = { ...get().badges }
        const want: 1 | 2 = f.perfect ? 2 : 1
        const had = badges[a.def.id] ?? 0
        let newBadge: string | null = null
        if (want > had) { badges[a.def.id] = want; newBadge = want === 2 ? `${a.def.badge} (gold)` : a.def.badge }
        save('challenges.bests', bests); save('challenges.badges', badges)
        restoreKey()
        set({ active: null, bests, badges, rev: get().rev + 1,
          result: { ...f, defId: a.def.id, level: a.level, best: isBest ? f.score : prev, isBest: isBest && prev !== undefined, newBadge } })
      } else set({ rev: get().rev + 1 })
    }
    return {
      active: null, result: null, rev: 0, sound: false,
      bests: load('challenges.bests', {}), badges: load('challenges.badges', {}),
      start(id, level) {
        const def = CHALLENGES.find((c) => c.id === id); if (!def) return
        if (get().active) restoreKey()
        const h = useHarmonyStore.getState()
        const engine = def.create(level, { key: h.key })
        const prevKey = h.key, prevAuto = h.autoDetect
        if (engine.keyToSet) { h.setAutoDetect(false); h.setKey(engine.keyToSet) }
        set({ active: { def, level, engine, prevKey, prevAuto }, result: null, rev: get().rev + 1 })
        afterStep()
      },
      quit() { restoreKey(); set({ active: null, result: null, rev: get().rev + 1 }) },
      tick() { const a = get().active; if (!a) return; a.engine.tick(performance.now()); afterStep() },
      setSound(on) {
        if (on && !ac) { try { ac = new AudioContext() } catch { /* ignore */ } }
        if (on) void ac?.resume()
        set({ sound: on })
      },
    }
  })
}

export const useChallengeStore = (import.meta.hot?.data.chStore as ReturnType<typeof make> | undefined) ?? make()

// single note subscription, re-created on HMR
const g = (import.meta.hot?.data ?? {}) as { chOff?: () => void }
g.chOff?.()
const offProfile = onProfileChange(() => {
  useChallengeStore.getState().quit()
  useChallengeStore.setState({ bests: load('challenges.bests', {}), badges: load('challenges.badges', {}), result: null })
})
const offNote = onNote((e) => {
  const st = useChallengeStore.getState(), a = st.active
  if (!a) return
  a.engine.note({ note: e.note, velocity: e.velocity, on: e.on }, performance.now())
  a.engine.tick(performance.now())
  useChallengeStore.setState({ rev: st.rev + 1 })
  useChallengeStore.getState().tick()
})

if (import.meta.hot) {
  import.meta.hot.data.chStore = useChallengeStore
  import.meta.hot.data.chOff = () => { offNote(); offProfile() }
  import.meta.hot.accept()
}
