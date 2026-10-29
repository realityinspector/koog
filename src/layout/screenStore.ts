// Which instrument screen is open ('play', 'songs', 'games', ...), and whether a full-display game is running.
// The visualizer pauses while a game owns the display, so they don't fight over the CPU.
// STABLE API: useScreen with { screen, game }.
import { create } from 'zustand'

export interface ScreenState { screen: string; game: string | null }
function make() { return create<ScreenState>()(() => ({ screen: 'play', game: null })) }
export const useScreen = (import.meta.hot?.data.screenStore as ReturnType<typeof make> | undefined) ?? make()

if (import.meta.hot) {
  import.meta.hot.data.screenStore = useScreen
  import.meta.hot.accept()
}
