// Small pieces the four Koogalien games share: the input pads, voice badges, the UFO track and the results card.
import { useState, type ReactNode } from 'react'
import type { Chord, Degree } from '../../../koogalien/data/types'
import { alienById } from '../../../koogalien/data/aliens'
import { VOICE_LOOK } from '../brand'
import { MiniPads } from '../learn/MiniPads'
import { Mascot } from '../learn/Mascot'
import { PadStrip } from '../ui/PadStrip'

export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n))

export function VoiceBadge({ voice }: { voice: string }) {
  const look = VOICE_LOOK[voice], a = alienById(voice)
  return <span className="kgl-voice" style={{ borderColor: look?.color }} title={`${a?.name ?? voice} is speaking`}><span style={{ background: look?.color }} aria-hidden>{look?.mark}</span>{a?.name ?? voice}</span>
}

/** the on-screen way to answer: the eight pads (the same path as a real keyboard, pads or DJ pads), and a tap-to-build chord for one finger */
export function GameInput({ lit, onChord, label }: { lit: readonly Degree[]; onChord: (c: Chord) => void; label?: string }) {
  const [picked, setPicked] = useState<Degree[]>([])
  const toggle = (d: Degree) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))
  return (
    <div className="kgg-input">
      <PadStrip lit={lit} />
      <details className="kgg-build">
        <summary>{label ?? 'Tap to build a chord (one finger)'}</summary>
        <MiniPads big lit={lit} picked={picked} onToggle={toggle} label="Tap pads to build a chord, then press Play it" />
        <button type="button" className="kgl-btn pri" disabled={!picked.length} onClick={() => { if (picked.length) { onChord(picked as unknown as Chord); setPicked([]) } }}>Play it</button>
      </details>
    </div>
  )
}

/** a UFO that charges across the sky as the streak grows (steady, no flashing) */
export function UfoTrack({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="kgg-sky" role="img" aria-label={label}>
      <span className="kgg-ufo" style={{ left: `${Math.round(progress * 76)}%` }} aria-hidden>🛸</span>
      <span className="kgg-goal" aria-hidden>🌍</span>
    </div>
  )
}

/** every game ends here: results, then Next / Again / Back (no dead ends) */
export function Results({ title, pose, children, onNext, nextLabel, onAgain, onBack }: {
  title: string; pose: 'cheer' | 'teach'; children?: ReactNode; onNext?: () => void; nextLabel?: string; onAgain: () => void; onBack: () => void
}) {
  return (
    <div className="kgl-stage" data-testid="results">
      <Mascot pose={pose} size={150} />
      <div className="kgl-result">
        <h2>{title}</h2>
        {children}
        <div className="kgl-row">
          {onNext ? <button type="button" className="kgl-btn pri" onClick={onNext}>{nextLabel ?? 'Next'} ▶</button> : null}
          <button type="button" className={'kgl-btn' + (onNext ? '' : ' pri')} onClick={onAgain}>↻ Again</button>
          <button type="button" className="kgl-btn" onClick={onBack}>← Back to games</button>
        </div>
      </div>
    </div>
  )
}
