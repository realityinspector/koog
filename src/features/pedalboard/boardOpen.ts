// Open/closed state of the Pedalboard panel (any screen, Kid and Boss mode).
import { create } from 'zustand'
type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ open: boolean }>()(() => ({ open: false })) }
export const useBoardOpen = hot.store ?? make()
export const setBoardOpen = (open: boolean) => useBoardOpen.setState({ open })
if (import.meta.hot) {
  import.meta.hot.data.store = useBoardOpen
  import.meta.hot.accept()
}
