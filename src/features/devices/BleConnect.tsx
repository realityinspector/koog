// "Connect Bluetooth keyboard": talks to a Bluetooth Low Energy MIDI keyboard straight from the app.
// Without Web Bluetooth (a plain browser) it falls back to the old advice: pair it in the computer's MIDI settings.
import { bleSupported, connectBle, disconnectBle, useBle } from '../../midi/bleMidi'

export function BleConnect() {
  const { status, name, error } = useBle()
  if (!bleSupported()) return <p className="kg-dev-hint">Bluetooth keyboard? Pair it in the computer's MIDI settings, then reload this page. A USB cable is quicker.</p>
  return (
    <div className="kg-dev-ble">
      {status === 'connected'
        ? <button type="button" className="on" onClick={disconnectBle} title="Disconnect this keyboard">🔵 {name} connected · Disconnect</button>
        : <button type="button" disabled={status === 'connecting'} onClick={() => void connectBle()} title="Switch the keyboard on and hold it close">🔵 {status === 'connecting' ? 'Looking for your keyboard…' : 'Connect Bluetooth keyboard'}</button>}
      {error && <p className="kg-dev-none" role="alert">{error}</p>}
    </div>
  )
}
