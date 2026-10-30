// DUO: how the DJ and the piano player make music TOGETHER. No React, no audio of its own.
//   DJ sets the band   the playing deck's track key becomes the song key (restored when the decks stop); Smart Band pauses meanwhile.
//   Piano -> DJ        in-key streaks open a filter sweep, cadences / resolutions / motifs throw an echo, a BOOM is a riser into a thump.
//   DJ -> piano        a pad hit lights matching keys on the keybed ("play along" hints, in the DJ's key) for a moment.
//   Beat meter         piano notes that land on the DJ's beat build an ON-BEAT combo; "8 BARS" turns it into a Duo Challenge.
// All long-lived state is in import.meta.hot.data; listeners are swapped on edit.
import { create } from 'zustand'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onJudge } from '../../music/judge'
import { useGuide, setGuide } from '../../music/guide'
import { useScreen } from '../../layout/screenStore'
import { SCALES, type Key } from '../../music/theory'
import { start as bandStart, panic as bandPanic, getState as bandState } from '../smartband/engine'
import { fx, getView, onPad, subscribe } from './engine'
import { beatOffsetMs, getBeat, onBeat } from './clock'
import { TRACKS } from './synth'

export interface Challenge { state: 'idle' | 'wait' | 'run' | 'done'; beats: number; hits: number; stars: number }
export interface DuoState {
  /** the key the DJ set (null when the decks aren't driving the key) */
  djKey: Key | null
  bandPaused: boolean
  combo: number; bestCombo: number
  challenge: Challenge
}
const IDLE: Challenge = { state: 'idle', beats: 0, hits: 0, stars: 0 }
const BARS = 8, CH_BEATS = BARS * 4
const ON_BEAT_MS = 90

type Held = { key: Key; auto: boolean }
interface Shared { store: ReturnType<typeof makeStore>; held: Held | null; set: Key | null; bandWas: boolean; run: number; hitSet: Set<number>; lastTargets: number[] | null; timers: Set<ReturnType<typeof setTimeout>> }
function makeStore() { return create<DuoState>()(() => ({ djKey: null, bandPaused: false, combo: 0, bestCombo: 0, challenge: IDLE })) }
const hot = import.meta.hot?.data as { duo?: Shared } | undefined
const D: Shared = hot?.duo ?? { store: makeStore(), held: null, set: null, bandWas: false, run: 0, hitSet: new Set(), lastTargets: null, timers: new Set() }
if (import.meta.hot) import.meta.hot.data.duo = D
export const useDuo = D.store
const patch = (p: Partial<DuoState>) => useDuo.setState(p)
const sameKey = (a: Key, b: Key) => a.tonic === b.tonic && a.scale === b.scale
const later = (fn: () => void, ms: number) => { const h = setTimeout(() => { D.timers.delete(h); fn() }, ms); D.timers.add(h); return h }

// ---------- DJ sets the band ----------
let pending: ReturnType<typeof setTimeout> | null = null
let pendingKey: Key | null = null
function followKey() {
  const v = getView()
  const lead = v.lead
  if (lead) {
    const target = TRACKS[lead].key
    if (pendingKey && sameKey(pendingKey, target)) return
    if (D.set && sameKey(D.set, target)) { if (pending) { clearTimeout(pending); pending = null; pendingKey = null } return }
    if (pending) clearTimeout(pending)
    pendingKey = target
    // a crossfade sweeping past the middle must not flip the key back and forth: the new lead has to hold for a moment
    pending = setTimeout(() => { pending = null; pendingKey = null; takeKey(target) }, D.set ? 450 : 0)
    pauseBand()
  } else {
    if (pending) { clearTimeout(pending); pending = null; pendingKey = null }
    if (D.held) later(releaseKey, 700)
  }
}
function takeKey(k: Key) {
  const h = useHarmonyStore.getState()
  if (!getView().lead) return
  if (!D.held) D.held = { key: h.key, auto: h.autoDetect } // remember what it was
  else if (D.set && !sameKey(h.key, D.set)) { D.held.key = h.key } // the player changed it themselves meanwhile: that is the new "before"
  if (h.autoDetect) h.setAutoDetect(false) // the DJ is the key detector now
  if (!sameKey(h.key, k)) h.setKey(k)
  D.set = k
  patch({ djKey: k })
}
function releaseKey() {
  if (getView().lead || !D.held) return
  const h = useHarmonyStore.getState()
  // only put it back if nobody changed it since the DJ set it
  if (D.set && sameKey(h.key, D.set)) h.setKey(D.held.key)
  if (D.held.auto) h.setAutoDetect(true)
  D.held = null; D.set = null
  patch({ djKey: null })
  resumeBand()
}
/** best-effort restore when the page goes away */
export const restoreKeyNow = () => { if (D.held) { const h = useHarmonyStore.getState(); if (D.set && sameKey(h.key, D.set)) h.setKey(D.held.key); D.held = null; D.set = null } }

// ---------- Smart Band steps aside ----------
function pauseBand() {
  try { if (bandState().on) { D.bandWas = true; bandPanic() } } catch { /* ignore */ }
  if (D.bandWas) patch({ bandPaused: true })
}
function resumeBand() {
  if (D.bandWas) { D.bandWas = false; try { bandStart() } catch { /* ignore */ } }
  patch({ bandPaused: false })
}

// ---------- DJ -> piano: pad hits become play-along hints ----------
const DEG = [0, 2, 4, 6] // root, third, fifth, seventh of the scale
function hintNotes(key: Key, pad: number): number[] {
  const sc = SCALES[key.scale], n = sc.length
  const root = 60 + key.tonic
  const one = (d: number) => root + sc[d % n] + 12 * Math.floor(d / n)
  const d = DEG[pad]
  return [one(d), one(d) + 12 > 83 ? one(d) : one(d) + 12]
}
function onPadHit(e: { deck: 'A' | 'B'; n: number }) {
  const sc = useScreen.getState()
  if (sc.screen !== 'play' || sc.game) return
  const cur = useGuide.getState().targets
  if (cur.length && cur !== D.lastTargets) return // a game or song owns the keybed
  const v = getView()
  const key = v[e.deck].playing ? TRACKS[e.deck].key : useHarmonyStore.getState().key
  const t = hintNotes(key, e.n)
  D.lastTargets = t
  setGuide(t, 'next')
  later(() => { if (useGuide.getState().targets === t) { setGuide([], 'next'); D.lastTargets = null } }, 1500)
}

// ---------- piano -> DJ ----------
function onJudged(e: Parameters<Parameters<typeof onJudge>[0]>[0]) {
  if (!getView().anyPlaying) { patch({ combo: 0 }); return }
  if (e.type === 'cluster') { if (e.boom) fx('riser'); return }
  if (e.type === 'cadence' || e.type === 'resolve' || e.type === 'motif') { fx('echo'); return }
  if (e.type !== 'note') return
  const g = e.g
  if (g.cluster || g.kind === 'spicy') { D.run = 0; if (g.kind === 'spicy') patch({ combo: 0 }); return }
  if (g.chordMember) return
  if (++D.run % 8 === 0) fx('sweep') // eight in-key notes in a row opens the filter
  // beat meter: within a hair of the DJ's beat or half-beat
  const off = beatOffsetMs(2)
  if (off != null && Math.abs(off) <= ON_BEAT_MS) {
    const c = useDuo.getState().combo + 1
    patch({ combo: c, bestCombo: Math.max(useDuo.getState().bestCombo, c) })
    const ch = useDuo.getState().challenge
    if (ch.state === 'run') {
      const b = getBeat()
      const idx = ch.beats - 1 + (b.phase > 0.75 ? 1 : 0)
      if (!D.hitSet.has(idx) && idx >= 0 && idx < CH_BEATS) { D.hitSet.add(idx); patch({ challenge: { ...ch, hits: D.hitSet.size } }) }
    }
  } else if (off != null) patch({ combo: 0 })
}

// ---------- Duo Challenge: 8 bars, the player must land in-key notes on the DJ's beat ----------
export function startChallenge() {
  if (!getView().anyPlaying) return
  D.hitSet = new Set()
  patch({ challenge: { state: 'wait', beats: 0, hits: 0, stars: 0 } })
}
export const cancelChallenge = () => patch({ challenge: IDLE })
function onBeatTick(b: { beat: number; bar: number }) {
  const ch = useDuo.getState().challenge
  if (ch.state === 'wait' && b.beat === 0) { patch({ challenge: { ...ch, state: 'run', beats: 1 } }); return }
  if (ch.state !== 'run') return
  const beats = ch.beats + 1
  if (beats > CH_BEATS) {
    const hits = D.hitSet.size
    const stars = hits >= 24 ? 3 : hits >= 16 ? 2 : hits >= 8 ? 1 : 0
    patch({ challenge: { state: 'done', beats: CH_BEATS, hits, stars } })
    later(() => { if (useDuo.getState().challenge.state === 'done') patch({ challenge: IDLE }) }, 9000)
  } else patch({ challenge: { ...ch, beats } })
}

// ---------- wiring ----------
const offs = [
  subscribe(() => {
    followKey()
    const ch = useDuo.getState().challenge
    if ((ch.state === 'run' || ch.state === 'wait') && !getView().anyPlaying) patch({ challenge: IDLE })
    if (!getView().anyPlaying && useDuo.getState().combo) patch({ combo: 0 })
  }),
  onPad(onPadHit),
  onJudge(onJudged),
  onBeat(onBeatTick),
]
const onHide = () => restoreKeyNow()
window.addEventListener('pagehide', onHide)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    offs.forEach((f) => f())
    window.removeEventListener('pagehide', onHide)
    if (pending) clearTimeout(pending)
  })
  import.meta.hot.accept()
}
