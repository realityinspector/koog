// "Sheet level": how much the play-along sheet music shows (and how much SONGS asks of the kid).
//   single = just the melody · easy = melody + chord symbols + a root note in the left hand · full = melody + a real left-hand pattern.
// Saved per kid. STABLE API: useSheetLevel, setSheetLevel, SHEET_LEVELS.
import { create } from 'zustand'
import { onProfileChange, pload, psave } from '../profile/profile'

export type SheetLevel = 'single' | 'easy' | 'full'
export const SHEET_LEVELS: { id: SheetLevel; icon: string; label: string; hint: string }[] = [
  { id: 'single', icon: '🎵', label: 'Single notes', hint: 'Only the tune' },
  { id: 'easy', icon: '🎶', label: 'Easy chords', hint: 'The tune, chord names, and one low note' },
  { id: 'full', icon: '🎼', label: 'Full', hint: 'The tune plus a full left-hand part' },
]
const KEY = 'sheetLevel'
const valid = (v: unknown): v is SheetLevel => v === 'single' || v === 'easy' || v === 'full'
const read = (): SheetLevel => { const v = pload<unknown>(KEY, 'single'); return valid(v) ? v : 'single' }

function make() { return create<{ level: SheetLevel }>()(() => ({ level: read() })) }
export const useSheetLevel = (import.meta.hot?.data.sheetLevelStore as ReturnType<typeof make> | undefined) ?? make()
export const getSheetLevel = () => useSheetLevel.getState().level
export const setSheetLevel = (level: SheetLevel) => { useSheetLevel.setState({ level }); psave(KEY, level) }

if (import.meta.hot) {
  import.meta.hot.data.sheetLevelStore = useSheetLevel
  const off = onProfileChange(() => useSheetLevel.setState({ level: read() }))
  import.meta.hot.dispose(() => off())
  import.meta.hot.accept()
}
