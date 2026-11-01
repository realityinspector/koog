import type { Rung } from '../../music/phrases'
import './phraseHud.css'

/** Small shared "which phrase am I on, and how hard is it" chip for the phrase games. */
export function PhraseHud({ i, n, rung, note }: { i: number; n: number; rung: Rung; note?: string }) {
  return (
    <span className="ph-chip" role="status" aria-label={`Phrase ${i} of ${n}, rung ${rung}`} title={note}>
      <span aria-hidden>🧠</span> phrase {i}/{n} <i aria-hidden>·</i> rung: <b>{rung}</b>
    </span>
  )
}
