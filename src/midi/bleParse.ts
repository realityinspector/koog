// The BLE-MIDI packet format (pure, no browser): so a fixture can test it without a keyboard. Used by bleMidi.ts.
export const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700'
export const BLE_MIDI_CHAR = '7772e5db-3868-4112-a1a9-f2669d106bf3'

/** the MIDI messages inside one BLE-MIDI packet (header, then timestamp + status/data runs). SysEx is skipped. Pure, so it is tested without a keyboard. */
export function parseBlePacket(d: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  if (d.length < 3 || !(d[0] & 0x80)) return out // header byte has the top bit set
  let i = 1, status = 0
  while (i < d.length) {
    let b = d[i]
    if (b & 0x80) { i++; if (i >= d.length) break; b = d[i] } // a timestamp byte comes first in each message
    if (b & 0x80) {
      status = b; i++
      if (status >= 0xf8) { out.push(Uint8Array.of(status)); status = 0; continue } // realtime
      if (status === 0xf0) { while (i < d.length && d[i] !== 0xf7) i++; i++; status = 0; continue } // SysEx: not used here
    }
    if (!status) { i++; continue } // a data byte with no status: drop it
    const hi = status & 0xf0
    const len = hi === 0xc0 || hi === 0xd0 ? 1 : 2
    if (i + len > d.length) break
    const m = new Uint8Array(1 + len); m[0] = status
    for (let k = 0; k < len; k++) m[1 + k] = d[i + k]
    out.push(m); i += len
  }
  return out
}
