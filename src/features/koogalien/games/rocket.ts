// Pure: Word Rocket. Words fall like slow meteors in English; the kid plays the chord to zap each one. Difficulty adapts to the kid's
// spaced-repetition boxes and to how the round goes. Calm by default (chill); fast is optional. Nothing is lost when a meteor lands:
// it bounces off the shield, the word is shown and goes back into SRS as due. All times are injected ms.
// Tested by scripts/koogalien-games-fixtures.ts
import type { Chord, LexEntry } from '../../../koogalien/data/types'
import { judgeWord } from '../../../koogalien/learn/checks'
import type { Card } from '../../../koogalien/learn/srs'

export type RocketMode = 'chill' | 'fast'
export const ROCKET_TOTAL = 10
export const MAX_LEVEL = 6

/** starting level from the Leitner boxes of the words in play: new words (no card) count as box 1. Level 1..MAX_LEVEL. */
export function startLevel(pool: readonly LexEntry[], cards: readonly Card[]): number {
  if (!pool.length) return 1
  const box = new Map(cards.map((c) => [c.id, c.box]))
  const mean = pool.reduce((n, e) => n + (box.get(e.id) ?? 1), 0) / pool.length
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(mean + 0.5)))
}
/** how long a meteor takes to land. Chill is slow and long; fast is 0.6 of that. Never under 4 seconds in chill, 2.5 in fast. */
export function fallMs(level: number, mode: RocketMode): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, level))
  const chill = 17000 - l * 1500
  return Math.round(mode === 'fast' ? Math.max(2500, chill * 0.6) : Math.max(4000, chill))
}
/** the gap before the next meteor appears */
export function gapMs(level: number, mode: RocketMode): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, level))
  const chill = 5200 - l * 400
  return Math.round(mode === 'fast' ? chill * 0.65 : chill)
}
/** how many meteors may be falling at once */
export const maxActive = (level: number): number => (level <= 2 ? 1 : level <= 4 ? 2 : 3)

export interface Meteor { uid: number; id: string; spawn: number; fall: number; /** 0..1 across the sky */ x: number }
export interface RocketState {
  mode: RocketMode; level: number; meteors: Meteor[]; queue: string[]; uid: number; nextAt: number
  zapped: string[]; landed: string[]; streak: number; best: number; points: number; peak: number; total: number
}
export type RocketEvent = 'zap' | 'land' | 'spawn' | 'miss' | 'done' | 'none'

export function newRocket(pool: readonly LexEntry[], cards: readonly Card[], mode: RocketMode, now: number, total = ROCKET_TOTAL): RocketState {
  const level = startLevel(pool, cards)
  return { mode, level, meteors: [], queue: pool.slice(0, total).map((e) => e.id), uid: 1, nextAt: now + 800, zapped: [], landed: [], streak: 0, best: 0, points: 0, peak: level, total: Math.min(total, pool.length) }
}
export const rocketDone = (s: RocketState): boolean => s.queue.length === 0 && s.meteors.length === 0
/** 0..1 down the sky */
export const progressOf = (m: Meteor, now: number): number => Math.max(0, Math.min(1, (now - m.spawn) / m.fall))

/** move time forward: spawn the next meteor when it is time and there is room, land the ones that reached the shield */
export function tick(s: RocketState, now: number, rand: () => number = Math.random): { state: RocketState; events: { event: RocketEvent; id?: string }[] } {
  const events: { event: RocketEvent; id?: string }[] = []
  let st = s
  const landing = st.meteors.filter((m) => now - m.spawn >= m.fall)
  if (landing.length) {
    const ids = landing.map((m) => m.id)
    for (const id of ids) events.push({ event: 'land', id })
    st = { ...st, meteors: st.meteors.filter((m) => !landing.includes(m)), landed: [...st.landed, ...ids], streak: 0, level: Math.max(1, st.level - ids.length) }
    st = { ...st, nextAt: Math.max(st.nextAt, now + 1200) }
  }
  if (st.queue.length && st.meteors.length < maxActive(st.level) && now >= st.nextAt) {
    const [id, ...rest] = st.queue
    const x = 0.12 + 0.76 * rand()
    st = { ...st, queue: rest, meteors: [...st.meteors, { uid: st.uid, id, spawn: now, fall: fallMs(st.level, st.mode), x }], uid: st.uid + 1, nextAt: now + gapMs(st.level, st.mode) }
    events.push({ event: 'spawn', id })
  }
  if (rocketDone(st) && !rocketDone(s)) events.push({ event: 'done' })
  return { state: st, events }
}

/** the kid played a chord: zap the oldest falling word it matches */
export function zap(s: RocketState, chord: Chord, now: number, entryOf: (id: string) => LexEntry | undefined): { state: RocketState; event: RocketEvent; id?: string } {
  const order = [...s.meteors].sort((a, b) => a.spawn - b.spawn)
  for (const m of order) {
    const e = entryOf(m.id)
    if (!e || !judgeWord(chord, e).ok) continue
    const quick = progressOf(m, now) < 0.5
    const streak = s.streak + 1
    // adapt: three quick zaps in a row move up one level; one slow zap does not change anything
    const up = quick && streak % 3 === 0
    const level = up ? Math.min(MAX_LEVEL, s.level + 1) : s.level
    const n: RocketState = { ...s, meteors: s.meteors.filter((x) => x.uid !== m.uid), zapped: [...s.zapped, m.id], streak, best: Math.max(s.best, streak), points: s.points + (quick ? 15 : 10), level, peak: Math.max(s.peak, level) }
    return { state: n, event: rocketDone(n) ? 'done' : 'zap', id: m.id }
  }
  return { state: s, event: s.meteors.length ? 'miss' : 'none' }
}
/** the meteor closest to landing (the one the glow and Hear-it-again are about) */
export function lowest(s: RocketState): Meteor | null { return [...s.meteors].sort((a, b) => a.spawn + a.fall - (b.spawn + b.fall))[0] ?? null }
