// Guide melody for Family Band. Same shared audio path as Songs listen: one fx bus, triangle notes, app volume and mute.
// A four-beat count-in gives the foot pedal a tempo to catch. Analog piano and guitar make no sound here.
import { fxBus, type FxBus } from '../../audio/fxContext'
import type { Song } from '../songs/songs'

const LEAD = 4

export interface Guide {
  /** Beats from the downbeat. Negative during the count-in. */
  beatNow: () => number
  stop: () => void
}

function blip(ctx: AudioContext, bus: FxBus, when: number, freq: number, dur: number, peak: number) {
  const o = ctx.createOscillator()
  const e = ctx.createGain()
  o.type = 'triangle'
  o.frequency.value = freq
  e.gain.setValueAtTime(0.0001, when)
  e.gain.exponentialRampToValueAtTime(peak, when + 0.012)
  e.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, dur))
  o.connect(e)
  e.connect(bus.input)
  o.start(when)
  o.stop(when + dur + 0.03)
}

/** Schedule the tune. Returns null if the audio host cannot start. */
export function startGuide(song: Song): Guide | null {
  const bus = fxBus(0.1)
  if (!bus) return null
  const ctx = bus.ctx
  const spb = 60 / song.bpm
  const t0 = ctx.currentTime + 0.15 + LEAD * spb
  for (let i = 0; i < LEAD; i++) blip(ctx, bus, t0 - (LEAD - i) * spb, i === LEAD - 1 ? 880 : 660, 0.06, 0.35)
  let t = 0
  for (const n of song.notes) {
    if (n.note != null) {
      const when = t0 + t * spb
      const dur = Math.max(0.08, n.beats * spb * 0.92)
      blip(ctx, bus, when, 440 * Math.pow(2, (n.note - 69) / 12), dur, 0.85)
    }
    t += n.beats
  }
  return { beatNow: () => (ctx.currentTime - t0) / spb, stop: () => bus.dispose() }
}

let clickBus: FxBus | null = null

/** A short tick when the foot pedal marks the beat. */
export function tapClick() {
  if (!clickBus) clickBus = fxBus(0.05)
  if (!clickBus) return
  const ctx = clickBus.ctx
  blip(ctx, clickBus, ctx.currentTime, 180, 0.05, 0.6)
}

export function stopClicks() {
  clickBus?.dispose()
  clickBus = null
}
