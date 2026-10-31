import { toggleControllerMode, useSurface } from './surface'

/** The quick "🎧 DJ ⇄ 🎛️ Synth" switch (lives in the DUO strip): flips the DJ controller between running the decks and the synth. */
export function SurfaceToggle() {
  const on = useSurface((s) => s.on)
  return (
    <button type="button" className={'dj-go dj-surf' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggleControllerMode()}
      title={on ? 'The controller is running the synth. Click to give it back to the DJ decks.' : 'Use the DJ controller as knobs and faders for the synth (Controller Mode).'}>
      {on ? '🎛️ Synth' : '🎧 DJ'} ⇄ {on ? '🎧 DJ' : '🎛️ Synth'}
    </button>
  )
}
