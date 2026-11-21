// Eight big pads = the eight Koogalien notes (C D E F G A B C'). Pressing one plays that white key,
// so on-screen play goes through the same token path as a real keyboard. Multi-touch makes chords.
// `hint` pads glow (with a dot, so color is never the only cue) to show which keys a lesson wants.
import { playLocal } from '../../../music/localNotes'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import type { Degree } from '../../../koogalien/data/types'
import { NOTE_NAMES, SOLFEGE_NAMES, useNames } from './prefs'

const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7, 8]

export function PadStrip({ lit, hint = [], homeC = 60 }: { lit: readonly Degree[]; hint?: readonly Degree[]; homeC?: number }) {
  const name = useNames()
  const down = (d: Degree) => playLocal(midiOfDegree(d, homeC), 64, true)
  const up = (d: Degree) => playLocal(midiOfDegree(d, homeC), 0, false)
  return (
    <div className="kgx-pads" role="group" aria-label="Koogalien pads: eight notes, C to high C">
      {DEGREES.map((d, i) => {
        const on = lit.includes(d), want = hint.includes(d)
        return (
          <button
            key={d} type="button" className={'kgx-pad' + (on ? ' on' : '') + (want ? ' hint' : '')} data-degree={d} aria-pressed={on}
            aria-label={`Pad ${d}, note ${NOTE_NAMES[i]}, ${SOLFEGE_NAMES[i]}${want ? ', press this one' : ''}`}
            onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* synthetic pointer */ } down(d) }}
            onPointerUp={() => up(d)} onPointerCancel={() => up(d)}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); down(d) } }}
            onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') up(d) }}
          >
            <b>{name(d)}</b><small>{d}</small>{want ? <u aria-hidden="true">●</u> : null}
          </button>
        )
      })}
    </div>
  )
}
