// The foot pedal as a kick drum. pedal.ts calls these when its job is 'kick'; 'auto' picks kick while the drum page is on.
// The drum page is "on" when a DJ controller has the drums role / the Drums page is chosen (useDrumPage.on), or the on-screen drum pads are open.
// No debounce and no timers: the key-down / CC-down goes straight to the engine with full velocity, so it records into the pattern (when REC is on)
// exactly like a pad hit and lights the KICK pad. Holding the pedal never clears the kick row (it is not a held pad).
import { liveHit } from './drumEngine'
import { useDrumPage } from './drumSurface'

const hot = (import.meta.hot?.data ?? {}) as { open?: { n: number } }
const O = hot.open ?? { n: 0 }
/** DrumPads calls this with +1 on mount and -1 on unmount */
export const drumsOpen = (d: number) => { O.n = Math.max(0, O.n + d) }
export const drumPageActive = (): boolean => O.n > 0 || !!useDrumPage.getState().on
export function kickDown() { liveHit(0, 1) }
export function kickUp() { /* a drum hit has no release */ }

if (import.meta.hot) { import.meta.hot.data.open = O; import.meta.hot.accept() }
