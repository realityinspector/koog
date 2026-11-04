// The playable Koog instruments: one card each, with its generic type and a Play button.
import { EMULATORS } from './emu'

const KIND: Record<string, { icon: string; type: string }> = {
  airhands: { icon: '👋', type: 'Hands-in-the-air glide instrument' },
  ribbon: { icon: '🎀', type: 'Ring-and-ribbon glide instrument' },
  wheelhouse: { icon: '⛪', type: 'Drawbar organ with a spinning speaker' },
  tapechoir: { icon: '📼', type: 'Tape-style strings, flute and choir keyboard' },
  ladder: { icon: '🪜', type: 'Analog mono synth with a ladder-style filter' },
  patchbay: { icon: '🔌', type: 'Semi-modular synth with patch cords' },
  squelch: { icon: '🧪', type: 'Step-sequenced squelchy bass box' },
  five: { icon: '🖐️', type: 'Five-voice programmable polysynth' },
  shimmer: { icon: '🌈', type: 'Chorus polysynth for wide, lush pads' },
  bellfm: { icon: '🔔', type: 'Digital FM synth: bells and electric pianos' },
}

export function InstrumentsRack({ onPlay }: { onPlay: (id: string) => void }) {
  return (
    <div className="sh-rack">
      <p className="sh-hint">Ten instruments of our own. Pick one, turn the knobs, and play it with your keyboard.</p>
      <div className="sh-grid" role="list">
        {EMULATORS.map((e) => {
          const k = KIND[e.id] ?? { icon: '🎹', type: 'Synth' }
          return (
            <div key={e.id} role="listitem" className="sh-inst">
              <span className="sh-inst-icon" aria-hidden="true">{k.icon}</span>
              <div className="sh-inst-text">
                <h3>{e.name}</h3>
                <small>{k.type}</small>
              </div>
              <button className="sh-play" onClick={() => onPlay(e.id)} aria-label={`Play ${e.name}`}>▶ Play</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
