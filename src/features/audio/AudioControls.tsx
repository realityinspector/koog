import { useEffect, useRef, useState } from 'react'
import { useAudioSettings, setVolume, setMuted, setComputerSound } from '../../music/audioSettings'
import { unlockAudio } from '../../music/localNotes'
import './audio.css'

const WIDE = '(min-width: 1100px)'

/** Top-strip sound controls: mute, volume (inline when wide, popover otherwise), SYNTHESIZER ON/OFF switch. */
export function AudioControls() {
  const volume = useAudioSettings((s) => s.volume)
  const muted = useAudioSettings((s) => s.muted)
  const computer = useAudioSettings((s) => s.computerSound)
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches)
  const [pop, setPop] = useState(false)
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
  const icon = level === 0 ? '🔇' : '🔊'
  const pct = Math.round(volume * 100)
  const slider = (
    <input className="kg-vol" type="range" min={0} max={100} step={1} value={pct} aria-label="Volume"
      style={{ '--p': pct + '%' } as React.CSSProperties}
      onChange={(e) => { const v = Number(e.target.value) / 100; setVolume(v); if (muted && v > 0) setMuted(false) }}
      onPointerUp={(e) => e.currentTarget.blur()} />
  )
  const speaker = () => {
    if (wide) { setMuted(!muted); if (muted) void unlockAudio() } else setPop((p) => !p)
  }

  return (
    <div className="kg-audio" ref={root}>
      <div className="kg-audio-vol">
        <button type="button" className={'kg-audio-btn' + (muted ? ' off' : '')} onClick={speaker}
          aria-label={wide ? (muted ? 'Unmute' : 'Mute') : 'Volume'} aria-pressed={wide ? muted : undefined}
          aria-expanded={wide ? undefined : pop} title={wide ? (muted ? 'Unmute' : 'Mute') : 'Volume'}>
          {icon}
        </button>
        {wide && slider}
        {!wide && pop && (
          <div className="kg-audio-pop" role="group" aria-label="Volume">
            {slider}
            <button type="button" className="kg-audio-mute" aria-pressed={muted} onClick={() => { setMuted(!muted); if (muted) void unlockAudio() }}>
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
        )}
      </div>
      <button type="button" role="switch" aria-checked={computer} className={'kg-audio-sw' + (computer ? ' on' : '')}
        title="SYNTHESIZER ON: the MIDI keyboard also plays through the computer's speakers (the Koog synth, or the emulator you have open)"
        onClick={() => { const next = !computer; if (next) void unlockAudio(); setComputerSound(next) }}>
        <span className="kg-audio-track" aria-hidden="true"><span className="kg-audio-knob" /></span>
        <span className="kg-audio-label">SYNTHESIZER <b>{computer ? 'ON' : 'OFF'}</b></span>
      </button>
    </div>
  )
}
