// Keys to light up on the on-screen keybed ("play THIS next"). Games and songs set it; PianoStrip draws it.
// STABLE API: useGuide with { targets, tone }, setGuide(targets, tone?), clearGuide().
import { create } from 'zustand'

export type GuideTone = 'next' | 'danger' | 'gold'
export interface GuideState { targets: number[]; tone: GuideTone }
function make() { return create<GuideState>()(() => ({ targets: [], tone: 'next' as GuideTone })) }
export const useGuide = (import.meta.hot?.data.guideStore as ReturnType<typeof make> | undefined) ?? make()
export const setGuide = (targets: number[], tone: GuideTone = 'next') => useGuide.setState({ targets, tone })
export const clearGuide = () => useGuide.setState({ targets: [] })

if (import.meta.hot) {
  import.meta.hot.data.guideStore = useGuide
  import.meta.hot.accept()
}
