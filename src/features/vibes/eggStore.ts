// Which easter eggs this player has found (saved per player), plus a tiny read-only debug view for tests.
import { create } from 'zustand'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { celebrate } from '../celebrate/celebrate'
import { eggInfo, type EggId } from './eggs'

const KEY = 'dancer.eggs'
const read = (): EggId[] => { const v = pload<unknown>(KEY, []); return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as EggId[]) : [] }

interface EggState { found: EggId[]; last: EggId | null; lastN: number }
const make = () => create<EggState>()(() => ({ found: read(), last: null, lastN: 0 }))
export const useEggs: ReturnType<typeof make> = (import.meta.hot?.data.eggs as ReturnType<typeof make> | undefined) ?? make()
const off = onProfileChange(() => useEggs.setState({ found: read() }))

/** the dancer calls this when an egg fires. Returns true the first time this player finds it. */
export function foundEgg(id: EggId): boolean {
  const st = useEggs.getState()
  const fresh = !st.found.includes(id)
  const found = fresh ? [...st.found, id] : st.found
  if (fresh) {
    psave(KEY, found)
    const e = eggInfo(id)
    celebrate({ title: `New egg found! ${e.name}`, emoji: e.emoji, kind: 'badge' })
  }
  useEggs.setState({ found, last: id, lastN: st.lastN + 1 })
  return fresh
}

/** read-only view for tests: window.__dancerEggs() */
export interface EggDebug { active: EggId | null; fired: EggId[]; k: number }
// (kept on window so a second copy of this module, such as a test's dynamic import, shares the same view)
const W = (typeof window !== 'undefined' ? window : {}) as unknown as { __eggDbg?: EggDebug; __dancerEggs?: () => EggDebug }
export const eggDebug: EggDebug = (W.__eggDbg ??= { active: null, fired: [], k: -1 })
W.__dancerEggs = () => ({ active: eggDebug.active, fired: [...eggDebug.fired], k: eggDebug.k })

if (import.meta.hot) {
  import.meta.hot.data.eggs = useEggs
  import.meta.hot.dispose(() => off())
  import.meta.hot.accept()
}
