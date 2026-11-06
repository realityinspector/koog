// Hooks the four Koogalien games share: saved progress, a voice that speaks chords, the key-glow guide, and the pedal.
// One kind of export (non-component) per file, so React Fast Refresh stays happy.
import { useCallback, useEffect, useRef, useState } from 'react'
import { onToken, startKode } from '../../../kode/tokens'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import type { Chord, Degree, Sentence } from '../../../koogalien/data/types'
import { encode } from '../../../koogalien/engine/encode'
import { playScore } from '../play/playScore'
import type { KoogalienHost } from '../../../koogalien/ports'
import { PROGRESS_KEY, sanitize, type Progress } from '../../../koogalien/learn/progress'
import { GAMES_KEY, sanitizeSave, type GamesSave } from './core'
import { sayChords, sayLetter } from '../learn/say'
import type { PlayHandle } from '../play/playScore'

/** the shared Koogalien progress (words, cards, stars). Every game reads and writes this same object, so learning anywhere counts everywhere. */
export function useProgress(host: KoogalienHost) {
  const ref = useRef<Progress>(sanitize(host.progress.load(PROGRESS_KEY, null)))
  const [, bump] = useState(0)
  const commit = useCallback((fn: (p: Progress) => Progress) => {
    ref.current = fn(ref.current)
    host.progress.save(PROGRESS_KEY, ref.current)
    bump((n) => n + 1)
    return ref.current
  }, [host])
  return { prog: ref, commit }
}

/** the games' own small save: names for Spell Station, bests, the last game played */
export function useGamesSave(host: KoogalienHost) {
  const ref = useRef<GamesSave>(sanitizeSave(host.progress.load(GAMES_KEY, null)))
  const [, bump] = useState(0)
  const commit = useCallback((fn: (g: GamesSave) => GamesSave) => {
    ref.current = sanitizeSave(fn(ref.current))
    host.progress.save(GAMES_KEY, ref.current)
    bump((n) => n + 1)
    return ref.current
  }, [host])
  return { save: ref, commit }
}

/** timers, a voice, and the key-glow guide; everything is stopped when the game closes */
export function useStage(host: KoogalienHost) {
  const timers = useRef<number[]>([])
  const speaking = useRef<PlayHandle | null>(null)
  const [lit, setLit] = useState<readonly Degree[]>([])
  const later = useCallback((fn: () => void, ms: number) => { const t = window.setTimeout(fn, ms); timers.current.push(t); return t }, [])
  const clearTimers = useCallback(() => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }, [])
  const stopVoice = useCallback(() => { speaking.current?.stop(); speaking.current = null }, [])
  const say = useCallback((chords: readonly Chord[], voice: string) => { speaking.current?.stop(); speaking.current = sayChords(host, chords, voice) }, [host])
  const sayHop = useCallback((row: number, col: number, voice: string) => { speaking.current?.stop(); speaking.current = sayLetter(host, row, col, voice) }, [host])
  /** a whole Koogalien sentence in a voice (wobble mods play too); resolves when it has been said */
  const saySentence = useCallback((sen: Sentence, voice: string): Promise<void> => {
    speaking.current?.stop()
    const bpm = Math.round(host.sound.bpm()) || 100
    const h = playScore(encode({ ...sen, alien: voice }, { bpm, alien: voice }), host, { alien: voice })
    speaking.current = h
    return h.done
  }, [host])
  const unglow = useCallback(() => { setLit([]); host.guide.clear() }, [host])
  /** light the keys of a chord on the pads and on the keyboard guide; `fadeMs` lets the glow fade away */
  const glow = useCallback((chord: readonly Degree[], fadeMs?: number) => {
    setLit(chord); host.guide.show(chord.map((d) => midiOfDegree(d, 60)))
    if (fadeMs) later(() => { setLit([]); host.guide.clear() }, fadeMs)
  }, [host, later])
  useEffect(() => () => { clearTimers(); speaking.current?.stop(); host.guide.clear() }, [host, clearTimers])
  return { lit, later, clearTimers, say, sayHop, saySentence, stopVoice, glow, unglow }
}

/** the pedal (and Enter) means Next. The same press also works from the on-screen Next button. */
export function usePedalNext(onNext: () => void, enabled = true) {
  const cb = useRef(onNext)
  cb.current = onNext
  useEffect(() => {
    if (!enabled) return
    const stop = startKode()
    const off = onToken((t) => { if (t.src === 'pedal') cb.current() })
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) cb.current() }
    window.addEventListener('keydown', key)
    return () => { off(); stop(); window.removeEventListener('keydown', key) }
  }, [enabled])
}

/** DEV only: lets the test harness read a game's live state */
export function exposeForTest(name: string, get: () => unknown) {
  if (!import.meta.env?.DEV) return
  const w = window as unknown as { __kgg?: Record<string, () => unknown> }
  ;(w.__kgg ??= {})[name] = get
}
