// Fixtures for the BLE-MIDI packet parser (src/midi/bleParse.ts). Run: npm run check:ble
import { parseBlePacket } from '../src/midi/bleParse'
let fails = 0, passes = 0
const eq = (name: string, got: unknown, want: unknown) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) passes++; else { fails++; console.log('FAIL', name, 'got', g, 'want', w) } }
const P = (...b: number[]) => parseBlePacket(Uint8Array.from(b)).map((m) => [...m])
eq('note on', P(0x80, 0x80, 0x90, 60, 100), [[0x90, 60, 100]])
eq('note off', P(0x80, 0x81, 0x80, 60, 0), [[0x80, 60, 0]])
eq('two messages, each with a timestamp', P(0x80, 0x80, 0x90, 60, 100, 0x81, 0x90, 64, 90), [[0x90, 60, 100], [0x90, 64, 90]])
eq('running status', P(0x80, 0x80, 0x90, 60, 100, 0x81, 64, 90), [[0x90, 60, 100], [0x90, 64, 90]])
eq('program change is one data byte', P(0x80, 0x80, 0xc0, 5, 0x81, 0x90, 60, 100), [[0xc0, 5], [0x90, 60, 100]])
eq('control change (sustain pedal)', P(0x80, 0x80, 0xb0, 64, 127), [[0xb0, 64, 127]])
eq('pitch bend', P(0x80, 0x80, 0xe0, 0, 64), [[0xe0, 0, 64]])
eq('realtime clock passes through', P(0x80, 0x80, 0xf8, 0x81, 0x90, 60, 100), [[0xf8], [0x90, 60, 100]])
eq('sysex is skipped, notes after it kept', P(0x80, 0x80, 0xf0, 1, 2, 3, 0x81, 0xf7, 0x82, 0x90, 60, 100), [[0x90, 60, 100]])
eq('a packet with no header bit is ignored', P(0x10, 0x80, 0x90, 60, 100), [])
eq('too short is ignored', P(0x80, 0x80), [])
eq('a cut-off message is dropped, not guessed', P(0x80, 0x80, 0x90, 60), [])
eq('a stray data byte with no status is dropped', P(0x80, 0x80, 60, 100), [])
console.log(`ble fixtures: ${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
