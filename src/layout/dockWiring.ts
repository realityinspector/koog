// Registers every real dock / overlay with the dock manager (docks.ts), once, from App.tsx.
// Exclusive group 'bottom': Looper, Koog Kode and Drum pads all dock over the same part of the PLAY display, so opening one closes
// the others, whoever opened it (Modes launcher, #/kode link, DevicesControl, a controller, the gallery...). Before this, only the
// Modes launcher and the Kode panel did it by hand, and the other routes could show two docks on top of each other.
// Everything else is registered for the record (window.__koogState) but is not exclusive: DUO strip, Pedalboard, Game pads, sheet, Store.
import { registerDock } from './docks'
import { useLoopsDock, setLoopsDock } from '../features/loopstation/LoopsDock'
import { useKodeDock, setKodeDock } from '../features/kode/kodeDock'
import { useDrumPage } from '../features/drumpads/drumSurface'
import { setControllerPage } from '../features/loopstation/loopSurface'
import { useDuoOpen } from '../features/dj/duoOpen'
import { useBoardOpen, setBoardOpen } from '../features/pedalboard/boardOpen'
import { usePadPlay, setGamePads } from '../features/padplay/padplay'
import { useSheet, setSheetOn } from '../music/scoreStore'
import { getSnapshot as storeSnap, subscribe as storeSub, closeFrame } from '../features/appstore/storeState'

type Hot = { offs?: (() => void)[] }
const hot = (import.meta.hot?.data ?? {}) as Hot
hot.offs?.forEach((f) => f())

const offs = [
  registerDock({ id: 'looper', group: 'bottom', isOpen: () => useLoopsDock.getState().open, close: () => setLoopsDock(false), subscribe: (f) => useLoopsDock.subscribe(f) }),
  registerDock({ id: 'kode', group: 'bottom', isOpen: () => useKodeDock.getState().open, close: () => setKodeDock(false), subscribe: (f) => useKodeDock.subscribe(f) }),
  registerDock({ id: 'drums', group: 'bottom', isOpen: () => useDrumPage.getState().on, close: () => setControllerPage('dj'), subscribe: (f) => useDrumPage.subscribe(f) }),
  registerDock({ id: 'duo', isOpen: () => useDuoOpen.getState().open, close: () => useDuoOpen.getState().setOpen(false), subscribe: (f) => useDuoOpen.subscribe(f) }),
  registerDock({ id: 'pedalboard', isOpen: () => useBoardOpen.getState().open, close: () => setBoardOpen(false), subscribe: (f) => useBoardOpen.subscribe(f) }),
  registerDock({ id: 'gamepads', isOpen: () => usePadPlay.getState().on, close: () => setGamePads(false), subscribe: (f) => usePadPlay.subscribe(f) }),
  registerDock({ id: 'sheet', isOpen: () => useSheet.getState().on, close: () => setSheetOn(false), subscribe: (f) => useSheet.subscribe(f) }),
  registerDock({ id: 'store', isOpen: () => storeSnap().open, close: () => closeFrame(), subscribe: (f) => storeSub(f) }),
]

if (import.meta.hot) {
  import.meta.hot.data.offs = offs
  import.meta.hot.dispose(() => { offs.forEach((f) => f()) })
  import.meta.hot.accept()
}
