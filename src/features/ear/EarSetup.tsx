// Devices menu: hear a real piano, guitar, or voice and play Koog with it.
import { EAR_RANGE, type EarKind } from '../../audio/ear/pitch'
import { noteName } from '../../music/theory'
import { setEarKind, setEarOn, useEar } from './ear'

const KINDS: EarKind[] = ['piano', 'guitar', 'voice']

export function EarSetup() {
  const on = useEar((s) => s.on)
  const kind = useEar((s) => s.kind)
  const note = useEar((s) => s.note)
  const level = useEar((s) => s.level)
  const error = useEar((s) => s.error)
  return (
    <div className="kg-ear" data-ear data-ear-on={on ? '1' : '0'} data-ear-kind={kind}>
      <h4>Hear a real instrument</h4>
      <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => void setEarOn(!on)}>
        🎤 Hear {on ? 'ON' : 'OFF'}
      </button>
      <div className="kg-ear-kinds" role="group" aria-label="What Koog is hearing">
        {KINDS.map((k) => (
          <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setEarKind(k)}>{EAR_RANGE[k].label}</button>
        ))}
      </div>
      <div className="kg-ear-meter" aria-hidden><span style={{ width: Math.round(level * 100) + '%' }} /></div>
      <p className="kg-ear-now" data-ear-note={note ?? ''} role="status">
        {error ? error : note != null ? `Hearing ${noteName(note)}` : on ? 'Listening for a note.' : 'Off. Press Hear, then play one note.'}
      </p>
      <p className="kg-dev-note">One note at a time. Games, songs, and the judge follow it the same way they follow a keyboard. When Audio is ON, wear headphones so the microphone hears the instrument. The sound stays on this computer.</p>
    </div>
  )
}
