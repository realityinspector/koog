import { useSurface } from './surface'
import { currentPage, setControllerPage, useLoopPage, type Page } from '../loopstation/loopSurface'

const PAGES: [Page, string, string][] = [
  ['dj', '🎧 DJ', 'The controller runs the DJ decks.'],
  ['synth', '🎛️ Synth', 'Use the DJ controller as knobs and faders for the synth (Controller Mode).'],
  ['loop', '🔁 Loop', 'Use the DJ controller as a loop station: pads are layers, PLAY starts everything.'],
]
/** The controller page switch (lives in the DUO strip): 🎧 DJ ⇄ 🎛️ Synth ⇄ 🔁 Loop. */
export function SurfaceToggle() {
  const synth = useSurface((s) => s.on)
  const loop = useLoopPage((s) => s.on)
  const page = currentPage(synth, loop)
  return (
    <span role="group" aria-label="Controller page" style={{ display: 'inline-flex', gap: 3 }}>
      {PAGES.map(([p, label, tip]) => (
        <button key={p} type="button" className={'dj-go dj-surf' + (page === p ? ' on' : '')} aria-pressed={page === p} title={tip} onClick={() => setControllerPage(p)}>{label}</button>
      ))}
    </span>
  )
}
