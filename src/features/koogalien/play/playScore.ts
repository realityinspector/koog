// Hear it back: schedules a whole Score up front through the SoundPort (no setTimeout chains), caps velocity and polyphony,
// applies a voice patch and restores it, drives wobble spans through the ModPort. Tested by scripts/koogalien-play-fixtures.ts
import type { KoogalienHost } from '../../../koogalien/ports'
import type { ModSpec, Score } from '../../../koogalien/data/types'

export interface PlayHandle { stop(): void; done: Promise<void> }
export const VEL_CAP = 0.85
export const MAX_POLY = 6
/** beats of lead so the first note is scheduled in the future on the audio clock */
export const LEAD_BEATS = 0.1

export function playScore(
  score: Score,
  host: Pick<KoogalienHost, 'sound' | 'mods' | 'now'>,
  o: { alien?: string; onWord?: (i: number) => void; lookaheadMs?: number } = {},
): PlayHandle {
  const { sound, mods } = host
  const bpm = Math.max(30, Math.min(300, sound.bpm() || score.bpm || 100))
  const msPerBeat = 60000 / bpm
  const base = sound.nowBeat() + LEAD_BEATS
  const t0 = host.now() + LEAD_BEATS * msPerBeat
  const lookahead = o.lookaheadMs ?? 40

  let finished = false
  let resolve!: () => void
  const done = new Promise<void>((r) => { resolve = r })
  let timer: ReturnType<typeof setInterval> | null = null
  let patched = false
  const pendingMods: { mod: ModSpec; endBeat: number }[] = []

  const finish = () => {
    if (finished) return
    finished = true
    if (timer !== null) { clearInterval(timer); timer = null }
    if (patched) { patched = false; try { mods.patch(null) } catch { /* ignore */ } }
    resolve()
  }

  if (o.alien) { try { mods.patch(o.alien); patched = true } catch { /* ignore */ } }

  // chords: sorted, last word lifted on '?', velocity capped, polyphony capped
  // encode() sets liftApplied when it already raised the last word, so we must not lift twice
  const lift = (score as Score & { liftApplied?: boolean }).liftApplied === true ? undefined : score.liftAt
  const active: number[] = []
  let endBeat = score.beats || 0
  const chords = [...score.chords].sort((a, b) => a.at - b.at)
  for (const c of chords) {
    for (let k = active.length - 1; k >= 0; k--) if (active[k] <= c.at + 1e-9) active.splice(k, 1)
    const vel = Math.max(0, Math.min(VEL_CAP, c.vel))
    const lifted = lift !== undefined && c.at >= lift - 1e-9 ? 2 : 0
    for (const m of c.midi) {
      if (active.length >= MAX_POLY) break
      active.push(c.at + c.dur)
      sound.note(m + lifted, vel, base + c.at, c.dur)
    }
    endBeat = Math.max(endBeat, c.at + c.dur)
  }

  // modulation spans (v1: wobble)
  for (const e of score.mods) {
    const mod: ModSpec = { name: e.mod.name, depth: Math.max(0, Math.min(0.6, e.mod.depth)) }
    mods.apply(mod, base + e.at)
    mods.release(mod, base + e.at + e.dur)
    pendingMods.push({ mod, endBeat: base + e.at + e.dur })
    endBeat = Math.max(endBeat, e.at + e.dur)
  }

  // highlight feed + end detection from the injectable clock
  let nextWord = 0
  const starts = score.wordStarts
  const endMs = t0 + endBeat * msPerBeat
  const tick = () => {
    if (finished) return
    const now = host.now()
    while (nextWord < starts.length && now >= t0 + starts[nextWord] * msPerBeat - lookahead) {
      const i = nextWord++
      try { o.onWord?.(i) } catch (e) { console.error('[koogalien play]', e) }
    }
    if (now >= endMs) finish()
  }
  timer = setInterval(tick, 25)
  tick()

  return {
    done,
    stop() {
      if (finished) return
      try { sound.stopAll() } catch { /* ignore */ }
      const nb = sound.nowBeat()
      for (const m of pendingMods) { try { mods.release(m.mod, nb) } catch { /* ignore */ } }
      finish()
    },
  }
}
