import { useAirplane } from './airplane'
import './airplane.css'

/** While Airplane is on, one line stays up so the switch has a result the player can see. */
export function AirplaneNote() {
  const on = useAirplane((s) => s.on)
  if (!on) return null
  return <div className="kg-air-note" data-air-note="1" role="status">Staying on this computer.</div>
}
