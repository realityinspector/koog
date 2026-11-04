// Whether the 🧑‍💻 Kode panel is docked over the PLAY display (✨ Modes > Koog Kode, or the link #/kode).
import { create } from 'zustand'

type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ open: boolean }>()(() => ({ open: false })) }
export const useKodeDock = hot.store ?? make()
export const setKodeDock = (open: boolean) => useKodeDock.setState({ open })

if (import.meta.hot) {
  import.meta.hot.data.store = useKodeDock
  import.meta.hot.accept()
}
