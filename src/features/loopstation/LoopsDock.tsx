// Kid-mode way into the loop station: ✨ Modes > 🔁 Looper docks the looper over the PLAY display (Boss mode has its LOOPS tab).
import { create } from 'zustand'
import { useScreen } from '../../layout/screenStore'
import { useProfile } from '../../profile/profile'
import { LoopStation } from './LoopStation'

type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ open: boolean }>()(() => ({ open: false })) }
export const useLoopsDock = hot.store ?? make()
export const setLoopsDock = (open: boolean) => useLoopsDock.setState({ open })

export function LoopsDock() {
  const open = useLoopsDock((s) => s.open)
  const screen = useScreen((s) => s.screen)
  const mode = useProfile((s) => s.mode)
  if (!open || screen !== 'play' || mode === 'dad') return null
  return (
    <div className="dp-dock lps-dock" role="region" aria-label="Looper">
      <button type="button" className="lp-chip big lps-dock-x" onClick={() => setLoopsDock(false)} title="Close the looper (your loops keep playing until you stop them)">✕ Close</button>
      <LoopStation />
    </div>
  )
}

if (import.meta.hot) {
  import.meta.hot.data.store = useLoopsDock
  import.meta.hot.accept()
}
