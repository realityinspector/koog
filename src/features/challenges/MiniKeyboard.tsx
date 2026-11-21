import { useEffect } from 'react'
import { clearGuideFor, setGuideFor, type GuideTone } from '../../music/guide'
// owned key glow: a late timer from this feature can't wipe another feature's glow (docs/STATE.md)
const setGuide = (t: number[], tone?: GuideTone, soon?: number[]) => setGuideFor('miniKeyboard', t, tone, soon)
const clearGuide = () => clearGuideFor('miniKeyboard')
import type { View } from './defs'

// The CHALLENGE screen no longer draws its own keyboard: the targets light up on the main keybed via the shared guide.
// Pitch classes expand across the keybed range; exact targets (targetMidi) win when the challenge gives them.
export function MiniKeyboard({ v }: { v: View }) {
  const key = v.targetMidi.length ? 'm' + v.targetMidi.join(',') : 'p' + v.targets.join(',')
  useEffect(() => {
    let notes = v.targetMidi
    if (!notes.length) {
      notes = []
      for (let n = 36; n <= 96; n++) if (v.targets.includes(n % 12)) notes.push(n)
    }
    setGuide(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => clearGuide(), [])
  return null
}
