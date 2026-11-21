// Family Band open state. Session only: no new device-wide key. Seat checkboxes reset when the page reloads.
import { create } from 'zustand'

export interface FamilyState {
  open: boolean
  sing: boolean
  songId: string
  playing: boolean
  beat: number
  beatFloor: number
  noteIdx: number
  midi: boolean
  piano: boolean
  guitar: boolean
  pedalTaps: number
}

const fresh = (): FamilyState => ({
  open: false,
  sing: true,
  songId: 'twinkle',
  playing: false,
  beat: 0,
  beatFloor: 0,
  noteIdx: -1,
  midi: true,
  piano: true,
  guitar: true,
  pedalTaps: 0,
})

type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<FamilyState>()(() => fresh()) }
export const useFamily = hot.store ?? make()

export function setFamilyOpen(open: boolean) {
  useFamily.setState(open ? { open: true } : { open: false, playing: false })
}

if (import.meta.hot) {
  import.meta.hot.data.store = useFamily
  import.meta.hot.accept()
}
