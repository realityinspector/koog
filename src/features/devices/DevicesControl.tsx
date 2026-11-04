import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../../profile/profile'
import { useDevices, setRole, type DeviceRole } from '../../music/devices'
import { SOUNDS, chooseSound, useSound } from './soundChoice'
import { unlockAudio } from '../../music/localNotes'
import { setScreenMode, useSurface } from '../controller/surface'
import { PedalSetup } from '../pedal/PedalSetup'
import { usePedal } from '../pedal/pedal'
import './devices.css'
import { Icon } from '../../ui/Icon'
import { useOnePop } from '../../ui/onePop'

const ROLES: [DeviceRole, string][] = [['piano', '🎹 Piano'], ['dj', '🎧 DJ'], ['surface', '🎛️ Synth'], ['loop', '🔁 Loop'], ['off', 'Off']]

/** Top-strip chip: connected MIDI devices + their roles, and the piano's sound ("change instruments"). */
export function DevicesControl() {
  const devices = useDevices((s) => s.devices)
  const sound = useSound((s) => s.id)
  const mode = useProfile((s) => s.mode)
  const [open, setOpen] = useState(false)
  useOnePop('devices', open, () => setOpen(false))
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const live = devices.filter((d) => d.connected)
  const hasDj = live.some((d) => d.role === 'dj' || d.role === 'surface' || d.role === 'loop')
  const surfaceOn = useSurface((s) => s.on)
  const cur = SOUNDS.find((s) => s.id === sound) ?? SOUNDS[0]
  const n = live.length
  const pedalOn = usePedal((p) => (!!p.code || p.midi) && p.action !== 'off')
  const pedalDown = usePedal((p) => p.down)
  return (
    <div className="kg-dev" ref={root}>
      <button type="button" className={'kg-dev-chip' + (open ? ' open' : '')} aria-expanded={open} aria-haspopup="dialog"
        title={`MIDI devices and piano sound (now: ${cur.label})`} onClick={() => setOpen((o) => !o)}>
        <Icon name="plug" />
        <span className="kg-dev-txt">{n} {n === 1 ? 'device' : 'devices'}</span>
        {pedalOn && <span className={'kg-pedal-led' + (pedalDown ? ' on' : '')} title="Foot pedal" aria-hidden />}
      </button>
      {open && (
        <div className="kg-dev-pop" role="dialog" aria-label="Devices and sound">
          <h4>MIDI devices</h4>
          {devices.length === 0 && <p className="kg-dev-none">No MIDI devices found. Plug one in!</p>}
          {devices.map((d) => (
            <div className="kg-dev-row" key={d.id}>
              <span className={'kg-dev-dot' + (d.connected ? ' on' : '')} title={d.connected ? 'Connected' : 'Unplugged'} />
              <span className="kg-dev-name" title={d.name}>{d.name}</span>
              <div className="kg-dev-roles" role="group" aria-label={'Role for ' + d.name}>
                {ROLES.map(([r, l]) => <button key={r} type="button" className={d.role === r ? 'on' : ''} aria-pressed={d.role === r} title={r === 'surface' ? 'Synth controller: its knobs and faders shape the synth sound' : r === 'loop' ? 'Loop station: pads are layers, PLAY starts everything' : undefined} onClick={() => setRole(d.name, r)}>{l}</button>)}
              </div>
            </div>
          ))}
          {hasDj && <p className="kg-dev-hint">Quit Serato if it's open: it grabs the controller.</p>}
          {live.length === 0 && (
            <button type="button" className={surfaceOn ? 'on' : ''} aria-pressed={surfaceOn} onClick={() => setScreenMode(!surfaceOn)}>🎛️ On-screen synth controller {surfaceOn ? 'ON' : 'OFF'}</button>
          )}
          {/* Boss mode has the full sound rack and split/layers in STUDIO, so the popover keeps only devices + pedal there */}
          {mode === 'kid' && <>
            <h4>Sound (what the piano plays)</h4>
            <div className="kg-dev-sounds">
              {SOUNDS.map((s) => (
                <button key={s.id} type="button" className={sound === s.id ? 'on' : ''} aria-pressed={sound === s.id}
                  onClick={() => { chooseSound(s.id); void unlockAudio() }}>{s.icon} {s.label}</button>
              ))}
            </div>
            <p className="kg-dev-note">Turn Computer sound ON to hear it through the computer.</p>
          </>}
          <PedalSetup />
        </div>
      )}
    </div>
  )
}
