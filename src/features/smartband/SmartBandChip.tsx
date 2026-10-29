import { useEffect, useState, useSyncExternalStore } from 'react'
import './smartband.css'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { STYLES, getState, getVersion, panic, setStyle, setVolume, subscribe, toggle, MASTER_CAP, type BandStyle } from './engine'

interface Saved { style?: BandStyle; volume?: number }

function applySaved() {
  const s = pload<Saved>('smartband', {})
  if (s.style && STYLES.some((x) => x.id === s.style)) setStyle(s.style)
  if (typeof s.volume === 'number') setVolume(s.volume)
}

/** LCD-style Smart Band readout: click to switch on/off, ▾ for style and volume. */
export function SmartBandChip() {
  useSyncExternalStore(subscribe, getVersion)
  const S = getState()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    applySaved()
    const off = onProfileChange(applySaved)
    return () => { off(); panic() }
  }, [])

  const save = () => { const s = getState(); psave('smartband', { style: s.style, volume: s.volume }) }
  const style = STYLES.find((x) => x.id === S.style) ?? STYLES[1]
  const vol = Math.round(S.volume * 100)
  const status = S.on ? (S.idle ? 'listening…' : S.chord?.name ?? '—') : '—'

  return (
    <div className="sr-cell sb">
      <div className="sb-row">
        <button className="sb-main" onClick={toggle} aria-pressed={S.on} title="Smart Band: a backing band that listens and follows you">
          <span className="sr-lbl">🤖 BAND <i className={'sr-led sb-led' + (S.on ? ' on' : '') + (S.on && !S.idle ? ' live' : '')} aria-hidden /></span>
          <b className="sr-val sr-chord sb-chord" key={status} aria-live="polite">{status}</b>
          <span className="sr-best">{S.on ? `${S.bpm} BPM · ` : ''}{style.label.toUpperCase()}</span>
        </button>
        <button className="sb-more" aria-expanded={open} aria-label="Band style and volume" onClick={() => setOpen((o) => !o)}>▾</button>
      </div>
      {open && (
        <div className="sb-pop" role="dialog" aria-label="Band settings">
          <span className="kp-lbl">🎚️ Style</span>
          <div className="sb-styles">
            {STYLES.map((x) => (
              <button key={x.id} className={'kp-btn' + (x.id === S.style ? ' on' : '')} title={x.hint}
                onClick={() => { setStyle(x.id); save() }}>{x.label}</button>
            ))}
          </div>
          <p className="kp-note">{style.hint}</p>
          <label className="sb-vol">
            <span className="kp-lbl">Volume {vol}%</span>
            <input type="range" min={0} max={100} value={vol} onChange={(e) => setVolume(Number(e.target.value) / 100)}
              onPointerUp={save} onKeyUp={save} aria-label={`Band volume, up to ${Math.round(MASTER_CAP * 100)} percent master`} />
          </label>
        </div>
      )}
    </div>
  )
}
