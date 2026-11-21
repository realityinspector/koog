// "Shift+M anytime, anywhere": Shift+M flips the metronome (the looper's click on the master clock) from any screen, with a small toast.
//   * ALWAYS Shift+M. Plain M is only the piano note B (src/music/typing.ts) and never touches the metronome, so one key never does two jobs.
//   * Not while typing in a text box, and never with Ctrl / Cmd / Alt (src/ui/shortcuts.ts keeps those manners for every shortcut).
import { registerShortcut } from '../../ui/shortcuts'
import { toggleMetronome } from './loopEngine'
import { isMetronomeKey } from './loopCore'
export { isMetronomeKey }

type Hot = { off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot

hot.off?.()
const off = registerShortcut({ id: 'metronome', key: 'KeyM', shift: true, owner: 'metroKey (Shift+M)', run: () => { toggleMetronome() } })
if (import.meta.hot) {
  import.meta.hot.data.off = off
  import.meta.hot.dispose(() => { off() })
  import.meta.hot.accept()
}
