import { useSurface } from './surface'
import { currentPage, setControllerPage, useLoopPage, type Page } from '../loopstation/loopSurface'
import { useDrumPage } from '../drumpads/drumSurface'

const PAGES: [Page, string, string][] = [
  ['dj', '🎧 DJ', 'The controller runs the DJ decks.'],
  ['synth', '🎛️ Synth', 'Use the DJ controller as knobs and faders for the synth (Controller Mode).'],
  ['loop', '🔁 Loop', 'Use the DJ controller as a loop station: pads are layers, PLAY starts everything.'],
  ['drums', '🥁 Drums', 'Use the DJ controller as a drum machine: the 8 pads are drums, PLAY starts the beat, CUE records.'],
]
/** The controller page switch (lives in the DUO strip): 🎧 DJ ⇄ 🎛️ Synth ⇄ 🔁 Loop ⇄ 🥁 Drums. */
export function SurfaceToggle() {
  const synth = useSurface((s) => s.on)
  const loop = useLoopPage((s) => s.on)
  const drums = useDrumPage((s) => s.on)
  const page = currentPage(synth, loop, drums)
  return (
    <span role="group" aria-label="Controller page" style={{ display: 'inline-flex', gap: 3 }}>
      {PAGES.map(([p, label, tip]) => (
        <button key={p} type="button" className={'dj-go dj-surf' + (page === p ? ' on' : '')} aria-pressed={page === p} title={tip} onClick={() => setControllerPage(p)}>{label}</button>
      ))}
    </span>
  )
}
