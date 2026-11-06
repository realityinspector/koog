import { airplaneOn, useAirplane } from './airplane'

const TITLE = 'Airplane. Koog stays here. Sound, keys, and games keep working.'

/** Strip switch. The word on the pill is short so the row stays one line. */
export function AirplaneSwitch({ desk = false }: { desk?: boolean }) {
  const on = useAirplane((s) => s.on)
  const flip = () => useAirplane.getState().set(!airplaneOn())
  if (desk) {
    return (
      <button type="button" className={'bx-b' + (on ? ' on' : '')} aria-pressed={on} title={TITLE} onClick={flip}>
        {on ? 'Airplane on' : 'Airplane'}
      </button>
    )
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Airplane" className={'kg-audio-sw kg-air' + (on ? ' on' : '')} title={TITLE} onClick={flip}>
      <span className="kg-audio-track" aria-hidden="true"><span className="kg-audio-knob" /></span>
      <span className="kg-audio-label">Air <b>{on ? 'ON' : 'OFF'}</b></span>
    </button>
  )
}
