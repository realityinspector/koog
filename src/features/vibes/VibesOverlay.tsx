import { useVibes, MOODS } from '../../music/vibes'
import { useChallenge, targetLabel } from './challenge'
import './vibes.css'

/** Vibes mode extras: the "Make it..." challenge. The face itself is drawn on the canvas (vibesScene.ts). */
export function VibesOverlay() {
  const target = useChallenge((s) => s.target)
  const hint = useChallenge((s) => s.hint)
  const progress = useChallenge((s) => s.progress)
  const { start, stop, next } = useChallenge.getState()
  const won = progress >= 1
  return (
    <div className="vibes-ov" onPointerDown={(e) => e.stopPropagation()}>
      {!target ? (
        <button className="vibes-make" onClick={start} title="Play until the face feels the mood you are asked for">🎯 Make it…</button>
      ) : (
        <div className={'vibes-card' + (won ? ' won' : '')} role="status" aria-live="polite">
          <div className="vibes-q">
            <span className="vibes-qe" aria-hidden>{MOODS[target].emoji}</span>
            <span>Make it <b>{targetLabel(target)}</b>!</span>
            <button className="vibes-x" onClick={next} aria-label="Another one" title="Another one">↻</button>
            <button className="vibes-x" onClick={stop} aria-label="Stop challenge" title="Stop">✕</button>
          </div>
          <div className="vibes-hint">{won ? 'You did it! 🎉' : hint}</div>
          <div className="vibes-bar" role="meter" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress"><i style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}
    </div>
  )
}

/** Tiny always-on mood emoji for the other visual modes (toggle in the Style popover). */
export function VibesChip() {
  const mood = useVibes((s) => s.mood)
  const chip = useVibes((s) => s.chip)
  const active = useVibes((s) => s.activity > 0.05)
  if (!chip) return null
  const d = MOODS[mood]
  return (
    <div className={'vibes-chip' + (active ? ' on' : '')} title={`Mood: ${d.label}`} aria-label={`Mood: ${d.label}`} style={{ ['--vh' as string]: d.hue }}>
      <span className="vc-e" key={mood}>{d.emoji}</span>
    </div>
  )
}
