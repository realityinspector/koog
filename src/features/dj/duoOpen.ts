// Whether the DUO deck strip is open. Shared by DuoDeck (the strip) and the Modes launcher (the switch).
// Persisted device-wide under the old key so existing players keep their choice. Self-accepting (docs/DEVELOPING.md).
import { create } from 'zustand'

const OPEN_KEY = 'koog.dj.open'
/** null = the player has never chosen; false = they closed it; true = they opened it. Closing must stay closed. */
export function duoChoice(): boolean | null {
  try {
    const v = localStorage.getItem(OPEN_KEY)
    if (v === '1') return true
    if (v === '0') return false
    return null
  } catch { return null }
}
const load = () => duoChoice() === true
const hot = (import.meta.hot?.data ?? {}) as { store?: ReturnType<typeof make> }
function make() {
  return create<{ open: boolean; setOpen: (v: boolean) => void }>()((set) => ({
    open: load(),
    setOpen: (open) => { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0') } catch { /* ignore */ } set({ open }) },
  }))
}
export const useDuoOpen = hot.store ?? make()
export const loadDuoOpen = load

if (import.meta.hot) {
  import.meta.hot.data.store = useDuoOpen
  import.meta.hot.accept()
}
