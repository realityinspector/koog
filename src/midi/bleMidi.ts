// A keyboard connected straight over Bluetooth Low Energy (BLE MIDI).
// macOS only lists a BLE MIDI keyboard to Web MIDI after you connect it in Audio MIDI Setup. The desktop app can instead
// talk to it itself with Web Bluetooth, so one tap on "Connect Bluetooth keyboard" is enough.
// Notes then go through the same path as a USB keyboard (connection.ts routes them by role).
// If the keyboard is ALSO connected in Audio MIDI Setup it appears twice: pick one.
import { create } from 'zustand'
import { feedVirtualInput, setVirtualInput } from './connection'
import { parseBlePacket } from './bleParse'

export { parseBlePacket }

import { BLE_MIDI_CHAR, BLE_MIDI_SERVICE } from './bleParse'

// The few Web Bluetooth members used here (the DOM typings do not ship them).
interface GattChar extends EventTarget { value?: DataView; startNotifications(): Promise<unknown> }
interface GattDevice extends EventTarget { id: string; name?: string; gatt?: { connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<GattChar> }> }>; disconnect(): void } }
interface BluetoothApi { requestDevice(o: { filters: { services: string[] }[] }): Promise<GattDevice> }

interface BleState { status: 'idle' | 'connecting' | 'connected' | 'error'; name: string; error: string }
export const useBle = create<BleState>(() => ({ status: 'idle', name: '', error: '' }))
export const bleSupported = () => typeof navigator !== 'undefined' && !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth

let dev: GattDevice | null = null
let id = ''

export async function connectBle(): Promise<void> {
  const nav = navigator as Navigator & { bluetooth?: BluetoothApi }
  if (!nav.bluetooth) { useBle.setState({ status: 'error', error: 'This app cannot use Bluetooth here.' }); return }
  useBle.setState({ status: 'connecting', error: '' })
  try {
    const d = await nav.bluetooth.requestDevice({ filters: [{ services: [BLE_MIDI_SERVICE] }] })
    const server = await d.gatt!.connect()
    const svc = await server.getPrimaryService(BLE_MIDI_SERVICE)
    const ch = await svc.getCharacteristic(BLE_MIDI_CHAR)
    const name = d.name || 'Bluetooth keyboard'
    dev?.removeEventListener('gattserverdisconnected', onGone)
    dev = d; id = 'ble:' + d.id
    ch.addEventListener('characteristicvaluechanged', (e: Event) => {
      const v = (e.target as GattChar).value
      if (!v) return
      const t = performance.now()
      for (const m of parseBlePacket(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))) feedVirtualInput(id, name, m, t)
    })
    d.addEventListener('gattserverdisconnected', onGone)
    try { await ch.startNotifications() } catch {
      try { d.gatt?.disconnect() } catch { /* ignore */ }
      useBle.setState({ status: 'error', error: 'It connected but would not send notes to the app. Connect it in Audio MIDI Setup instead (Window, Show MIDI Studio, Bluetooth icon, Connect), then reopen Koog.' })
      return
    }
    setVirtualInput(id, name, true)
    useBle.setState({ status: 'connected', name, error: '' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // NotFoundError = the picker found nothing or was cancelled
    useBle.setState({ status: 'error', error: /not ?found|cancel/i.test(msg) ? 'No Bluetooth keyboard found. Switch it on, bring it close and try again.' : msg })
  }
}

function onGone() {
  if (id && dev) setVirtualInput(id, dev.name || 'Bluetooth keyboard', false)
  useBle.setState({ status: 'idle', error: '' })
}
export function disconnectBle() { try { dev?.gatt?.disconnect() } catch { /* already gone */ } }
