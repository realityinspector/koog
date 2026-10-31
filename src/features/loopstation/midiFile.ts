// A tiny Standard MIDI File (format 1) writer, plus a small parser used by the tests. No dependencies.
// Track 0 = tempo + time signature + name; then one track per layer (channel = layer index, GM program per sound).
export const PPQ = 480
export interface MidiNote { t: number; d: number; n: number; v: number } // t, d in beats
export interface MidiTrack { name: string; channel: number; program?: number; notes: MidiNote[] }

const vlq = (v: number): number[] => {
  let x = Math.max(0, Math.round(v))
  const out = [x & 0x7f]
  while ((x >>= 7) > 0) out.unshift((x & 0x7f) | 0x80)
  return out
}
const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
const u16 = (v: number) => [(v >>> 8) & 255, v & 255]
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0) & 127)
const chunk = (id: string, body: number[]) => [...ascii(id), ...u32(body.length), ...body]
const meta = (dt: number, type: number, data: number[]) => [...vlq(dt), 0xff, type, ...vlq(data.length), ...data]

/** `passes` repeats the loop that many times back to back. `lenBeats` is the loop length. */
export function writeMidi(tracks: MidiTrack[], bpm: number, lenBeats: number, passes = 1, beatsPerBar = 4): Uint8Array {
  const tempo = Math.round(60000000 / Math.max(1, bpm))
  const t0 = [
    ...meta(0, 0x03, ascii('Koog Loop Station')),
    ...meta(0, 0x51, [(tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]),
    ...meta(0, 0x58, [beatsPerBar, 2, 24, 8]),
    ...meta(Math.round(lenBeats * passes * PPQ), 0x2f, []),
  ]
  const chunks = [chunk('MTrk', t0)]
  for (const tr of tracks) {
    const ev: { at: number; order: number; bytes: number[] }[] = []
    const ch = tr.channel & 15
    for (let p = 0; p < passes; p++) {
      for (const n of tr.notes) {
        const on = Math.round((p * lenBeats + n.t) * PPQ)
        const off = Math.max(on + 1, Math.round((p * lenBeats + n.t + n.d) * PPQ))
        const note = Math.max(0, Math.min(127, Math.round(n.n))), vel = Math.max(1, Math.min(127, Math.round(n.v)))
        ev.push({ at: on, order: 1, bytes: [0x90 | ch, note, vel] })
        ev.push({ at: off, order: 0, bytes: [0x80 | ch, note, 0] }) // offs sort before ons at the same tick
      }
    }
    ev.sort((a, b) => a.at - b.at || a.order - b.order)
    const body: number[] = [...meta(0, 0x03, ascii(tr.name.slice(0, 40)))]
    if (tr.program != null && ch !== 9) body.push(0, 0xc0 | ch, tr.program & 127)
    let last = 0
    for (const e of ev) { body.push(...vlq(e.at - last), ...e.bytes); last = e.at }
    body.push(...meta(Math.max(0, Math.round(lenBeats * passes * PPQ) - last), 0x2f, []))
    chunks.push(chunk('MTrk', body))
  }
  return new Uint8Array([...chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]), ...chunks.flat()])
}

export interface ParsedMidi { format: number; tracks: number; ppq: number; bpm: number | null; timeSig: number[] | null; notes: { track: number; ch: number; note: number; vel: number; at: number; len: number }[]; names: string[] }
/** Strict-enough parser for what writeMidi emits (throws on a malformed file). */
export function parseMidi(b: Uint8Array): ParsedMidi {
  let p = 0
  const rd32 = () => ((b[p++] << 24) | (b[p++] << 16) | (b[p++] << 8) | b[p++]) >>> 0
  const rd16 = () => (b[p++] << 8) | b[p++]
  const id = () => String.fromCharCode(b[p++], b[p++], b[p++], b[p++])
  if (id() !== 'MThd' || rd32() !== 6) throw new Error('bad header')
  const format = rd16(), ntrk = rd16(), ppq = rd16()
  const out: ParsedMidi = { format, tracks: ntrk, ppq, bpm: null, timeSig: null, notes: [], names: [] }
  for (let t = 0; t < ntrk; t++) {
    if (id() !== 'MTrk') throw new Error('bad track ' + t)
    const len = rd32(), end = p + len
    let at = 0, run = 0
    const open = new Map<string, { at: number; vel: number }>()
    const vl = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f) } while (c & 0x80); return v }
    let sawEnd = false
    while (p < end) {
      at += vl()
      let st = b[p]
      if (st === 0xff) {
        p++; const type = b[p++], l = vl(), d = b.slice(p, p + l); p += l
        if (type === 0x51) out.bpm = 60000000 / ((d[0] << 16) | (d[1] << 8) | d[2])
        else if (type === 0x58) out.timeSig = [...d]
        else if (type === 0x03) out.names.push(String.fromCharCode(...d))
        else if (type === 0x2f) sawEnd = true
        continue
      }
      if (st & 0x80) { run = st; p++ } else st = run
      const kind = st & 0xf0, ch = st & 15
      if (kind === 0xc0 || kind === 0xd0) { p++; continue }
      const d1 = b[p++], d2 = b[p++]
      if (kind === 0x90 && d2 > 0) open.set(ch + ':' + d1, { at, vel: d2 })
      else if (kind === 0x80 || kind === 0x90) {
        const o = open.get(ch + ':' + d1)
        if (o) { out.notes.push({ track: t, ch, note: d1, vel: o.vel, at: o.at, len: at - o.at }); open.delete(ch + ':' + d1) }
      }
    }
    if (p !== end || !sawEnd) throw new Error('track ' + t + ' not terminated')
    if (open.size) throw new Error('track ' + t + ' has hanging notes')
  }
  if (p !== b.length) throw new Error('trailing bytes')
  return out
}

if (import.meta.hot) import.meta.hot.accept()
