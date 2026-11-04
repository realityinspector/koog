// The big "Cleared" toast the looper shows after the pedal's 2 s hold clears everything, with an Undo that lasts 5 s.
// The looper engine sets it; the looper screens (SimpleLooper / LoopStation) show it.
import { create } from 'zustand'

export interface ClearToast { n: number; /** something was cleared that can be brought back */ undo: boolean; until: number }
type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ t: ClearToast | null }>()(() => ({ t: null })) }
export const useClearToast = hot.store ?? make()
let seq = 0, timer = 0
export const showClearToast = (undo: boolean, ms: number) => {
  const n = ++seq
  useClearToast.setState({ t: { n, undo, until: Date.now() + ms } })
  clearTimeout(timer); timer = window.setTimeout(() => { if (useClearToast.getState().t?.n === n) hideClearToast() }, ms)
}
export function hideClearToast() { clearTimeout(timer); useClearToast.setState({ t: null }) }

if (import.meta.hot) { import.meta.hot.data.store = useClearToast; import.meta.hot.accept() }
