// Whether the DUO deck strip is open. Shared by DuoDeck (the strip) and the Modes launcher (the switch).
// Persisted device-wide under the old key so existing players keep their choice. Self-accepting (docs/DEVELOPING.md).
import { create } from 'zustand'

const OPEN_KEY = 'koog.dj.open'
const load = () => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } }
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
