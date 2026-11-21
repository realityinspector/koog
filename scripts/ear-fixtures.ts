// Live ear: pitch from a buffer, and the note on / note off gate. No microphone, no AudioContext.
import { detectPitch, frameRms } from '../src/audio/ear/pitch.ts'
import { createEarGate, velocityOf } from '../src/audio/ear/gate.ts'

let passed = 0
let failed = 0
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; return }
  failed++
  console.error('FAIL', name, extra ?? '')
}
const near = (name: string, got: number, want: number, tol: number) => ok(name, Math.abs(got - want) <= tol, { got, want, tol })

function tone(hz: number, sr: number, n: number, harm = 0): Float32Array {
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w = 2 * Math.PI * hz * i / sr
    x[i] = Math.sin(w) + harm * Math.sin(2 * w)
  }
  return x
}

const sr = 48000
const n = 2048
const a4 = detectPitch(tone(440, sr, n), sr, 50, 2100)
ok('A4 is found', !!a4)
if (a4) { near('A4 midi', a4.midi, 69, 0.2); ok('A4 is clear', a4.clarity > 0.9) }
const c4 = detectPitch(tone(261.63, sr, n), sr, 50, 2100)
ok('C4 is found', !!c4)
if (c4) near('C4 midi', c4.midi, 60, 0.25)
const e2 = detectPitch(tone(82.41, sr, n), sr, 50, 2100)
ok('guitar low E is found', !!e2)
if (e2) near('E2 midi', e2.midi, 40, 0.4)
const harm = detectPitch(tone(440, sr, n, 0.45), sr, 50, 2100)
ok('a harmonic does not steal the fundamental', !!harm && Math.abs(harm.midi - 69) < 0.35, harm)
ok('silence is not a note', detectPitch(new Float32Array(n), sr, 50, 2100) == null)
ok('a note above the voice range is ignored', detectPitch(tone(2000, sr, n), sr, 80, 1100) == null)
ok('a full sine is loud', frameRms(tone(440, sr, n)) > 0.5)
ok('silence rms is 0', frameRms(new Float32Array(n)) === 0)
ok('a quiet frame is a small velocity', velocityOf(0.02) < velocityOf(0.15))
ok('velocity stays in 1..127', velocityOf(0.001) >= 1 && velocityOf(2) <= 127)
ok('a gentle note stays soft', velocityOf(0.018) <= 48 && velocityOf(0.018) / 127 <= 0.38)
ok('a clear note is not soft', velocityOf(0.05) >= 70 && velocityOf(0.05) / 127 > 0.38)
ok('a strong note reaches the top', velocityOf(0.1) >= 100)

const g = createEarGate()
const quiet = { t: 0, midi: null, clarity: 0, rms: 0 }
ok('silence holds nothing', g.step(quiet).length === 0 && g.held() == null)
ok('one loud frame is not yet a note', g.step({ t: 10, midi: 60, clarity: 0.95, rms: 0.05 }).length === 0)
const started = g.step({ t: 70, midi: 60.1, clarity: 0.96, rms: 0.08 })
ok('a steady pitch starts one note', started.length === 1 && started[0].on && started[0].note === 60, started)
ok('the same pitch does not retrigger', g.step({ t: 120, midi: 60.3, clarity: 0.95, rms: 0.08 }).length === 0 && g.held() === 60)
ok('vibrato stays on the note', g.step({ t: 160, midi: 60.4, clarity: 0.95, rms: 0.07 }).length === 0)
const hop1 = g.step({ t: 200, midi: 64, clarity: 0.95, rms: 0.09 })
ok('a leap waits to be sure', hop1.length === 0 && g.held() === 60)
const hop2 = g.step({ t: 260, midi: 64.1, clarity: 0.96, rms: 0.09 })
ok('a settled leap lets go and starts the new note', hop2.length === 2 && !hop2[0].on && hop2[0].note === 60 && hop2[1].on && hop2[1].note === 64, hop2)
ok('a short gap keeps the note', g.step({ t: 300, midi: null, clarity: 0, rms: 0.001 }).length === 0 && g.held() === 64)
const up = g.step({ t: 380, midi: null, clarity: 0, rms: 0 })
ok('a quiet stretch lets the note go', up.length === 1 && !up[0].on && up[0].note === 64 && g.held() == null, up)
g.step({ t: 400, midi: 67, clarity: 0.97, rms: 0.1 })
g.step({ t: 460, midi: 67, clarity: 0.97, rms: 0.1 })
const flushed = g.flush(500)
ok('flush lets go of a held note', flushed.length === 1 && !flushed[0].on && flushed[0].note === 67 && g.held() == null, flushed)

// a tune repeats notes. vibrato must not, a real second strike must.
const rep = createEarGate()
rep.step({ t: 0, midi: 60, clarity: 0.95, rms: 0.08 })
const repOn = rep.step({ t: 40, midi: 60, clarity: 0.95, rms: 0.08 })
ok('the repeated-note gate has started', repOn.length === 1 && repOn[0].on && repOn[0].note === 60, repOn)
rep.step({ t: 200, midi: 60.2, clarity: 0.95, rms: 0.07 })
const dip = rep.step({ t: 360, midi: 60.1, clarity: 0.95, rms: 0.02 })
ok('a dip is not a new note', dip.length === 0 && rep.held() === 60, dip)
const again = rep.step({ t: 400, midi: 60.2, clarity: 0.96, rms: 0.09 })
ok('a new strike of the same pitch is a new note', again.length === 2 && !again[0].on && again[0].note === 60 && again[1].on && again[1].note === 60, again)
let wobble = 0
const vib = createEarGate()
vib.step({ t: 0, midi: 60, clarity: 0.95, rms: 0.07 })
vib.step({ t: 40, midi: 60, clarity: 0.95, rms: 0.07 })
for (let i = 0; i < 16; i++) {
  const rms = 0.07 + 0.016 * Math.sin(i * 1.15)
  wobble += vib.step({ t: 80 + i * 32, midi: 60 + 0.25 * Math.sin(i * 0.9), clarity: 0.95, rms }).length
}
ok('vibrato wobble is not a new note', wobble === 0, wobble)

console.log(failed ? `${failed} failed, ${passed} passed` : `${passed} passed`)
if (failed) process.exit(1)
