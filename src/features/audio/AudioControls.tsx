import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAudioSettings, setVolume, setMuted, setComputerSound, setBoost } from '../../music/audioSettings'
import { unlockAudio } from '../../music/localNotes'
import './audio.css'
import { Icon } from '../../ui/Icon'
import { useOnePop } from '../../ui/onePop'
import { isWebDemo } from '../../web/webDemo'

const WIDE = '(min-width: 1100px)'

/** the second, explicit warning before Boost turns on */
function BoostConfirm({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const no = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    no.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onNo() } }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onNo])
  return createPortal(
    <div className="kg-boost-veil" role="presentation">
      <div className="kg-boost-dlg" role="alertdialog" aria-modal="true" aria-labelledby="kg-boost-msg">
        <p id="kg-boost-msg">Boost makes Koog louder for quiet laptop speakers. Not for headphones! Turn the volume down first.</p>
        <div className="kg-boost-btns">
          <button type="button" ref={no} onClick={onNo}>Cancel</button>
          <button type="button" className="yes" onClick={onYes}>Yes, boost</button>
        </div>
      </div>
    </div>, document.body)
}

/** Top-strip sound controls: mute, volume (inline when wide, popover otherwise), Audio ON/OFF switch. */
export function AudioControls() {
  const volume = useAudioSettings((s) => s.volume)
  const muted = useAudioSettings((s) => s.muted)
  const computer = useAudioSettings((s) => s.computerSound)
  const boost = useAudioSettings((s) => s.boost)
  const [ask, setAsk] = useState(false)
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches)
  const [pop, setPop] = useState(false)
  useOnePop('volume', pop, () => setPop(false))
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = matchMedia(WIDE)
    const f = () => setWide(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  useEffect(() => {
    if (!pop) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setPop(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [pop])

  const level = muted ? 0 : volume
  const icon = <Icon name={level === 0 ? 'mute' : 'speaker'} />
  const pct = Math.round(volume * 100)
  const slider = (
    <input className="kg-vol" type="range" min={0} max={100} step={1} value={pct} aria-label="Volume"
      style={{ '--p': pct + '%' } as React.CSSProperties}
      onChange={(e) => { const v = Number(e.target.value) / 100; setVolume(v); if (muted && v > 0) setMuted(false) }}
      onPointerUp={(e) => e.currentTarget.blur()} />
  )
  const boostBtn = (
    <button type="button" className={'kg-boost-btn' + (boost ? ' on' : '')} aria-pressed={boost} onClick={() => { if (boost) setBoost(false); else setAsk(true) }}
      title="Boost: +6 dB for quiet laptop speakers. Not for headphones! It turns itself off after an hour, and whenever you reload, press panic or switch player.">
      <span aria-hidden>🔊</span> Boost
    </button>
  )
  const badge = boost ? <span className="kg-boost-badge" role="status">BOOST</span> : null
  const speaker = () => {
    if (wide) { setMuted(!muted); if (muted) void unlockAudio() } else setPop((p) => !p)
  }

  return (
    <div className="kg-audio" ref={root}>
      {ask && <BoostConfirm onYes={() => { setAsk(false); setBoost(true) }} onNo={() => setAsk(false)} />}
      <div className="kg-audio-vol">
        <button type="button" className={'kg-audio-btn' + (muted ? ' off' : '')} onClick={speaker}
          aria-label={wide ? (muted ? 'Unmute' : 'Mute') : 'Volume'} aria-pressed={wide ? muted : undefined}
          aria-expanded={wide ? undefined : pop} title={wide ? (muted ? 'Unmute' : 'Mute') : 'Volume'}>
          {icon}
        </button>
        {wide && slider}
        {wide && badge}
        {wide && boostBtn}
        {!wide && boost && !pop && badge}
        {!wide && pop && (
          <div className="kg-audio-pop" role="group" aria-label="Volume">
            {slider}
            {badge}
            {boostBtn}
            <button type="button" className="kg-audio-mute" aria-pressed={muted} onClick={() => { setMuted(!muted); if (muted) void unlockAudio() }}>
              <span aria-hidden>{muted ? '🔇' : '🔊'}</span> {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        )}
      </div>
      {/* the web demo has no USB keyboards, so this switch would do nothing there */}
      {!isWebDemo() && <button type="button" role="switch" aria-checked={computer} className={'kg-audio-sw' + (computer ? ' on' : '')}
        title="Play your keyboard through the speakers. On: the notes you play come out of the speakers. Off: only your keyboard's own sound."
        onClick={() => { const next = !computer; if (next) void unlockAudio(); setComputerSound(next) }}>
        <span className="kg-audio-track" aria-hidden="true"><span className="kg-audio-knob" /></span>
        <span className="kg-audio-label">Audio <b>{computer ? 'ON' : 'OFF'}</b></span>
      </button>}
    </div>
  )
}
