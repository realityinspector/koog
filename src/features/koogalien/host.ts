// The only file that touches the Kore: wraps it into the small KoogalienHost the rest of Koogalien uses.
// If no Kore is given (a test, or a bare mount) it makes its own, so the app still works.
import { createKore } from '../../kode/kore/sdk'
import type { Kore } from '../../kode/kore/types'
import { getSynth } from '../synth-history/engine'
import type { SynthParams } from '../synth-history/params'
import { alienById } from '../../koogalien/data/aliens'
import type { KoogalienHost } from '../../koogalien/ports'

const WOBBLE = { rate: 5.5, maxDepth: 0.6 }

export function makeHost(korePassed: unknown | null): KoogalienHost {
  const own = korePassed ? null : createKore('koogalien')
  const kore = (korePassed ?? own) as Kore
  // synth params we change and must put back (voice patch, wobble)
  let saved: Partial<SynthParams> | null = null
  let savedLfo: Partial<SynthParams> | null = null
  const synthSet = (p: Partial<SynthParams>) => { try { getSynth().setParams(p) } catch { /* audio not ready yet */ } }
  const cur = () => { try { return getSynth().params } catch { return null } }
  const timers: (() => void)[] = []
  kore.onCleanup(() => {
    for (const t of timers.splice(0)) t()
    if (saved) synthSet(saved)
    if (savedLfo) synthSet(savedLfo)
    saved = null; savedLfo = null
    own?.dispose()
  })
  return {
    sound: {
      bpm: () => kore.clock.bpm(),
      nowBeat: () => kore.clock.beat(),
      note: (midi, vel, whenBeat, durBeats) => kore.sound.note(midi, Math.min(0.85, vel), whenBeat, durBeats),
      drum: (lane, vel, whenBeat) => kore.sound.drum(lane, Math.min(0.85, vel), whenBeat),
      stopAll: () => kore.sound.stop(),
    },
    mods: {
      apply(mod, whenBeat) {
        if (mod.name !== 'wobble') return
        const go = () => {
          const p = cur(); if (!p) return
          savedLfo ??= { lfoTarget: p.lfoTarget, lfoRate: p.lfoRate, lfoDepth: p.lfoDepth }
          synthSet({ lfoTarget: 'pitch', lfoRate: WOBBLE.rate, lfoDepth: Math.min(WOBBLE.maxDepth, Math.max(0.1, mod.depth * WOBBLE.maxDepth)) })
        }
        timers.push(kore.clock.atBeat(whenBeat, go))
      },
      release(mod, whenBeat) {
        if (mod.name !== 'wobble') return
        timers.push(kore.clock.atBeat(whenBeat, () => { if (savedLfo) { synthSet(savedLfo); savedLfo = null } }))
      },
      patch(alienId) {
        if (alienId == null) { if (saved) { synthSet(saved); saved = null } ; return }
        const a = alienById(alienId); if (!a) return
        const p = cur(); if (!p) return
        if (!saved) { saved = {}; for (const k of Object.keys(a.patch)) (saved as Record<string, unknown>)[k] = (p as unknown as Record<string, unknown>)[k] }
        synthSet(a.patch as Partial<SynthParams>)
      },
    },
    progress: { load: (k, f) => kore.progress.load(k, f), save: (k, v) => kore.progress.save(k, v) },
    concepts: { mark: (id) => { kore.concepts.mark(id) } },
    guide: { show: (notes) => kore.guide.show(notes), clear: () => kore.guide.clear() },
    celebrate: (kind) => kore.celebrate({ title: kind ?? 'Nice!', emoji: '👽', kind: 'badge' }),
    now: () => performance.now(),
    exit: () => kore.exit(),
  }
}

if (import.meta.hot) import.meta.hot.accept()
