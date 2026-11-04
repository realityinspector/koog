// Koog Kode sound: hands each planned sound to the audio clock with its exact start time (like the looper), through capped channels.
//   piano  -> the Koog synth ('keys' channel)          ladder, bell, ... -> a headless emulator on the 'kode' channel (EMU_CAP)
//   drums  -> the drum voices on the 'kode-drums' channel (DRUM_CAP), through a per-run gain that stop() fades out
// One "session" per run; stop() fades and releases everything it started (including sounds handed out up to 100 ms ahead).
import { createChannel, getCtx, getNoise, unlockHost } from '../../audio/host'
import { audioAt, sampleAudioOffset } from '../loopstation/audioClock'
import { createEngine, EMU_CAP, type Engine } from '../synth-history/emu/core'
import { getEmu } from '../synth-history/emu'
import { SOUNDS } from '../devices/soundChoice'
import { getSynth, silenceNote } from '../synth-history/engine'
import { KITS, playVoice } from '../drumpads/drumKit'
import { DRUM_CAP, useDrums } from '../drumpads/drumEngine'
import { defaultTweak } from '../drumpads/drumCore'
import { wClear, wTimeout } from '../../audio/workerTimer'
import type { PlanEvent } from '../../kode/lang/types'
import type { Sink } from '../../kode/lang/scheduler'

export interface SinkLog { sound: string; kind: 'note' | 'drum'; value: number; vel: number; when: number | null; atMs: number; durMs: number; layer: number }
export interface KodeSink extends Sink { log: SinkLog[]; logOn: boolean; count: () => number; warm: (sounds: string[]) => void }

interface Session { engines: Map<string, Engine>; bus: GainNode | null; busCtx: BaseAudioContext | null; timers: Set<number>; synthNotes: Set<number>; ended: boolean }
const newSession = (): Session => ({ engines: new Map(), bus: null, busCtx: null, timers: new Set(), synthNotes: new Set(), ended: false })

const SOUND_EMU: Record<string, { emu: string; preset?: string }> = {}
for (const s of SOUNDS) if (s.emu) SOUND_EMU[s.id] = { emu: s.emu, preset: s.preset }
/** a Koog instrument id -> its emulator (headless) */
const emuFor = (sound: string): { emu: string; preset?: string } | null => SOUND_EMU[sound] ?? (getEmu(sound) ? { emu: sound } : null)

export function createKodeSink(): KodeSink {
  let S = newSession()
  let n = 0
  const sink: KodeSink = {
    log: [], logOn: false, count: () => n,
    warm(sounds) {
      void unlockHost()
      for (const s of new Set(sounds)) if (s === 'piano') void getSynth().unlock().catch(() => {}); else void engineFor(s)?.unlock().catch(() => {})
      drumBus()
    },
    event(ev: PlanEvent, atMs: number, durMs: number) {
      sampleAudioOffset()
      const ctx = getCtx()
      const now = performance.now()
      const when = audioAt(atMs) ?? (ctx.state === 'running' ? ctx.currentTime + Math.max(0, atMs - now) / 1000 : null)
      if (this.logOn && this.log.length < 2000) this.log.push({ sound: ev.sound, kind: ev.kind, value: ev.value, vel: ev.vel, when, atMs, durMs, layer: ev.layer })
      if (when == null || S.ended) return
      const at = Math.max(when, ctx.currentTime)
      n++
      try {
        if (ev.kind === 'drum') {
          const bus = drumBus(); if (!bus) return
          const d = useDrums.getState()
          playVoice(ctx, bus, getNoise(ctx), d.kit, ev.value, at, ev.vel, d.tweak[ev.value] ?? defaultTweak())
          return
        }
        const v = Math.max(1, Math.min(127, Math.round(ev.vel * 127)))
        const len = Math.max(0.05, (durMs * 0.9) / 1000)
        if (ev.sound === 'piano') {
          const syn = getSynth()
          if (!syn.ready) { void syn.unlock().catch(() => {}); return }
          syn.noteOn(ev.value, v, at); syn.noteOff(ev.value, at + len)
          S.synthNotes.add(ev.value)
          return
        }
        const eng = engineFor(ev.sound)
        if (!eng) return
        eng.noteOn(ev.value, v, at)
        const t = wTimeout(() => { S.timers.delete(t); try { eng.noteOff(ev.value) } catch { /* ignore */ } }, Math.max(30, atMs - now + durMs * 0.9))
        S.timers.add(t)
      } catch (e) { console.error('[kode sound]', e) }
    },
    stop() {
      const old = S
      S = newSession()
      old.ended = true
      for (const t of old.timers) wClear(t)
      for (const m of old.synthNotes) { try { silenceNote(m) } catch { /* ignore */ } }
      for (const e of old.engines.values()) { try { e.allOff() } catch { /* ignore */ } }
      if (old.bus && old.busCtx) { try { old.bus.gain.cancelScheduledValues(0); old.bus.gain.setTargetAtTime(0, old.busCtx.currentTime, 0.012) } catch { /* ignore */ } }
      window.setTimeout(() => {
        for (const e of old.engines.values()) { try { e.allOff(); e.dispose() } catch { /* ignore */ } }
        try { old.bus?.disconnect() } catch { /* ignore */ }
      }, 600)
    },
  }
  function engineFor(sound: string): Engine | null {
    const have = S.engines.get(sound)
    if (have) return have
    const m = emuFor(sound), spec = m ? getEmu(m.emu) : undefined
    if (!m || !spec) return null
    const eng = createEngine(spec, { channel: createChannel('kode', { cap: EMU_CAP, label: 'KODE' }) })
    const p = spec.presets.find((x) => x.name === m.preset) ?? spec.presets[0]
    if (p) for (const c of spec.ctls) eng.set(c.key, p.values[c.key] ?? c.def)
    S.engines.set(sound, eng)
    return eng
  }
  function drumBus(): GainNode | null {
    try {
      const c = getCtx()
      if (S.bus && S.busCtx === c) return S.bus
      const ch = createChannel('kode-drums', { cap: DRUM_CAP, label: 'KODE DRUMS' })
      const bus = c.createGain(); bus.gain.value = 1
      bus.connect(ch.input)
      S.bus = bus; S.busCtx = c
      return bus
    } catch { return null }
  }
  void KITS
  return sink
}
