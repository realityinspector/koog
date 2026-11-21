// Small saved preferences for the Koogalien screens (one place, so the pads, the dictionary and the lessons agree).
// Note names (C D E ...) are the default, like the rest of Koog; do-re-mi names are a toggle.
import { create } from 'zustand'
import type { KoogalienHost } from '../../../koogalien/ports'

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"] as const
export const SOLFEGE_NAMES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', "do'"] as const
export const UI_KEY = 'koogalien-ui'
export interface UiPrefs { solfege: boolean; introDone: boolean }

type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<UiPrefs>()(() => ({ solfege: false, introDone: false })) }
export const useUiPrefs = hot.store ?? make()

/** the name of pad 1..8 in the chosen style */
export const padName = (d: number, solfege: boolean): string => (solfege ? SOLFEGE_NAMES : NOTE_NAMES)[d - 1] ?? String(d)
/** a function version for components: `const name = useNames()` then `name(3)` */
export function useNames(): (d: number) => string {
  const solfege = useUiPrefs((s) => s.solfege)
  return (d) => padName(d, solfege)
}

export function loadPrefs(host: KoogalienHost): UiPrefs {
  const raw = host.progress.load<Partial<UiPrefs>>(UI_KEY, {})
  const p = { solfege: !!raw?.solfege, introDone: !!raw?.introDone }
  useUiPrefs.setState(p)
  return p
}
export function savePrefs(host: KoogalienHost, patch: Partial<UiPrefs>) {
  useUiPrefs.setState(patch)
  const { solfege, introDone } = useUiPrefs.getState()
  try { host.progress.save(UI_KEY, { solfege, introDone }) } catch { /* ignore */ }
}

if (import.meta.hot) {
  import.meta.hot.data.store = useUiPrefs
  import.meta.hot.accept()
}
