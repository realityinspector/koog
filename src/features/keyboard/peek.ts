// Memory "peek": at the memory rung and above the keys are NOT lit. If the kid hesitates for 2 s, a faint dot
// shows on the NEXT key. Using it sets usePhraseView.peekUsed so the engine can withhold the clean pass.
import { useEffect, useState } from 'react'
import { setPhraseView, usePhraseView } from '../../music/phrases'

export const PEEK_MS = 2000

export function usePeekNote(): number | null {
  const phrase = usePhraseView((s) => s.phrase)
  const rung = usePhraseView((s) => s.rung)
  const index = usePhraseView((s) => s.index)
  const [peek, setPeek] = useState<number | null>(null)
  useEffect(() => { if (phrase) setPhraseView({ peekUsed: false }) }, [phrase, rung])
  useEffect(() => {
    setPeek(null)
    if (!phrase || !rung || !['memory', 'timed', 'blind', 'hands'].includes(rung)) return
    const next = phrase.notes[index]?.note
    if (next == null) return
    const t = setTimeout(() => { setPeek(next); setPhraseView({ peekUsed: true }) }, PEEK_MS)
    return () => clearTimeout(t)
  }, [phrase, rung, index])
  return peek
}
if (import.meta.hot) import.meta.hot.accept()
