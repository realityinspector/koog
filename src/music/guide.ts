// Keys to light up on the on-screen keybed ("play THIS next"). Games and songs set it; PianoStrip draws it.
// STABLE API: useGuide with { targets, tone }, setGuide(targets, tone?), clearGuide().
import { create } from 'zustand'
import { createSlot } from './owners'

export type GuideTone = 'next' | 'danger' | 'gold' | 'good' | 'soon'
/** soon = upcoming notes, drawn dimmer than the targets */
export interface GuideState { targets: number[]; tone: GuideTone; soon: number[] }
function make() { return create<GuideState>()(() => ({ targets: [], tone: 'next' as GuideTone, soon: [] as number[] })) }
export const useGuide = (import.meta.hot?.data.guideStore as ReturnType<typeof make> | undefined) ?? make()
// Who lit the keys is remembered (last writer wins). setGuide / clearGuide keep working for everyone; a feature that has timers or a
// screen that can close under it uses setGuideFor / clearGuideFor, so a late "clear" from a feature that already left can never wipe
// the glow a newer one is showing (docs/STATE.md, finding on shared guide).
const slot = createSlot('keyGuide', () => useGuide.setState({ targets: [], soon: [] }))
export const setGuide = (targets: number[], tone: GuideTone = 'next', soon: number[] = [], owner = 'anon') => { slot.claim(owner); useGuide.setState({ targets, tone, soon }) }
/** clearGuide() = clear whatever is lit; clearGuide('racer') = clear only if the racer is still the one who lit it */
export const clearGuide = (owner?: unknown) => { if (typeof owner === 'string') slot.release(owner); else slot.force() }
export const setGuideFor = (owner: string, targets: number[], tone: GuideTone = 'next', soon: number[] = []) => setGuide(targets, tone, soon, owner)
export const clearGuideFor = (owner: string) => { slot.release(owner) }
export const guideOwner = () => slot.owner()

if (import.meta.hot) {
  import.meta.hot.data.guideStore = useGuide
  import.meta.hot.accept()
}
