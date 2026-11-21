// Turns a stream of pitch frames into note on / note off, the way a keyboard does.
// Pure and timed in milliseconds so a test can step it without a microphone.
// One held note. Vibrato stays on that note. A real move to another pitch lets the old one go and starts the new one.
// A new strike of the same pitch (the sound falls, then jumps) is a new note too, so a tune can repeat a note.

export interface EarFrame { t: number; midi: number | null; clarity: number; rms: number }
export interface EarEvent { t: number; on: boolean; note: number; velocity: number }

const ON_RMS = 0.012
const OFF_RMS = 0.007
const MIN_CLARITY = 0.85
const STABLE_MS = 32 // the mic is read about this often; one frame is not a note, the next one can be
const OFF_MS = 70
const JUMP = 0.85
const REATTACK_MS = 55 // long enough that two onsets stay separate notes (the dancer groups anything inside 45 ms)
const DIP_RATIO = 0.82
const RISE_RATIO = 1.8
const RISE_ABS = 0.028

/** MIDI velocity 1..127 from a microphone level. A gentle note stays gentle. A strong note reaches the top. */
export function velocityOf(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-6))
  // -38 dB sits on the gate and stays soft (a slow quiet tune can still feel quiet). -18 dB is strong.
  const t = Math.max(0, Math.min(1, (db + 38) / 20))
  return Math.max(1, Math.min(127, Math.round(18 + 109 * t)))
}

export interface EarGate { step(f: EarFrame): EarEvent[]; flush(t: number): EarEvent[]; held(): number | null }

export function createEarGate(): EarGate {
  let held: number | null = null
  let candidate: { midi: number; since: number } | null = null
  let quietSince: number | null = null
  // body follows the note's loudness. A dip under it, then a sudden jump, is a new strike.
  let body = 0
  let prevRms = 0
  let onsetT = -1e9

  const onEv = (t: number, note: number, rms: number): EarEvent => ({ t, on: true, note, velocity: velocityOf(rms) })
  const offEv = (t: number, note: number): EarEvent => ({ t, on: false, note, velocity: 0 })
  const arm = (t: number, rms: number) => { onsetT = t; body = rms; prevRms = rms }
  const follow = (rms: number) => { body += (rms - body) * (rms < body ? 0.45 : 0.08); prevRms = rms }

  function begin(t: number, midi: number, rms: number, out: EarEvent[]) {
    const note = Math.round(midi)
    if (held === note) { candidate = null; return }
    if (held != null) out.push(offEv(t, held))
    held = note
    candidate = null
    quietSince = null
    arm(t, rms)
    out.push(onEv(t, note, rms))
  }

  /** a hammer or pluck on the pitch that is already held. Vibrato is too smooth to count. */
  function restruck(f: EarFrame, out: EarEvent[]): boolean {
    const jump = f.rms - prevRms
    const prevWasDip = prevRms <= body * DIP_RATIO
    if (f.t - onsetT < REATTACK_MS || !prevWasDip || jump < RISE_ABS || prevRms <= 0 || f.rms < prevRms * RISE_RATIO || f.rms < ON_RMS) {
      follow(f.rms)
      return false
    }
    const note = held as number
    out.push(offEv(f.t, note))
    arm(f.t, f.rms)
    out.push(onEv(f.t, note, f.rms))
    return true
  }

  return {
    held: () => held,
    flush(t) {
      const out: EarEvent[] = []
      if (held != null) { out.push(offEv(t, held)); held = null }
      candidate = null
      quietSince = null
      return out
    },
    step(f) {
      const out: EarEvent[] = []
      const loud = f.rms >= (held != null ? OFF_RMS : ON_RMS)
      const pitched = loud && f.midi != null && f.clarity >= MIN_CLARITY
      if (!pitched) {
        candidate = null
        if (held != null) {
          if (quietSince == null) quietSince = f.t
          if (f.t - quietSince >= OFF_MS) { out.push(offEv(f.t, held)); held = null; quietSince = null }
          else follow(f.rms) // a short hole can be the dip before the same note is struck again
        }
        return out
      }
      quietSince = null
      const midi = f.midi as number
      if (held == null) {
        if (!candidate || Math.abs(candidate.midi - midi) > 0.6) candidate = { midi, since: f.t }
        else if (f.t - candidate.since >= STABLE_MS) begin(f.t, candidate.midi, f.rms, out)
        return out
      }
      if (Math.abs(midi - held) < JUMP) { candidate = null; restruck(f, out); return out }
      if (!candidate || Math.abs(candidate.midi - midi) > 0.5) candidate = { midi, since: f.t }
      else if (f.t - candidate.since >= STABLE_MS) begin(f.t, candidate.midi, f.rms, out)
      return out
    },
  }
}
