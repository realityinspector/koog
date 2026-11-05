// Eight big pads = the eight Koogalien notes (do re mi fa sol la si do'). Pressing one plays that white key,
// so on-screen play goes through the same token path as a real keyboard. Multi-touch makes chords.
import { playLocal } from '../../../music/localNotes'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import type { Degree } from '../../../koogalien/data/types'

const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"]
const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', "do'"]
const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7, 8]

export function PadStrip({ lit, homeC = 60 }: { lit: readonly Degree[]; homeC?: number }) {
  const down = (d: Degree) => playLocal(midiOfDegree(d, homeC), 64, true)
  const up = (d: Degree) => playLocal(midiOfDegree(d, homeC), 0, false)
  return (
    <div className="kgx-pads" role="group" aria-label="Koogalien pads: eight notes, C to high C">
      {DEGREES.map((d, i) => (
        <button
          key={d} type="button" className={'kgx-pad' + (lit.includes(d) ? ' on' : '')} data-degree={d} aria-pressed={lit.includes(d)}
          aria-label={`Pad ${d}, ${SOLFEGE[i]}, note ${NAMES[i]}`}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); down(d) }}
          onPointerUp={() => up(d)} onPointerCancel={() => up(d)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); down(d) } }}
          onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') up(d) }}
        >
          <b>{d}</b><span>{SOLFEGE[i]}</span><small>{NAMES[i]}</small>
        </button>
      ))}
    </div>
  )
}
