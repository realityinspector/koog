// Mentor mode: "the greatest audience member ever". Listens (listen.ts), decides what is worth saying, and speaks
// through the shared coach bus (src/coach/coachBus.ts, source 'mentor'). The persona (Mentor.tsx) just draws this state.
// - labels: small floating tags in the visualizer area for every recognised move
// - speech: the best pending move, at most one bubble every 4-6 s. Honest: real problems compete with praise on
//   score (select.ts), no same praise twice in a row, no praise that contradicts a critique just said
// - highlights reel: top 3 moments after 10 s of quiet (or on demand)
// - memory: per kid (pload/psave 'mentor.v1') so it can praise growth ("first cadence today")
// Non-component module: state in import.meta.hot.data, self-accepting (docs/DEVELOPING.md).
import { create } from 'zustand'
import { onJudge } from '../../music/judge'
import { useJudge } from '../../music/judge'
import { useHarmonyStore } from '../../music/harmonyStore'
import { useScreen } from '../../layout/screenStore'
import { useScore } from '../../music/scoreStore'
import { usePhraseView } from '../../music/phrases'
import { SONGS } from '../songs/songs'
import { buildIndex, shortTitle, songSources, type AllusionIndex, type AllusionSource } from '../../music/allusion'
import { isKnown, mastery, segment, usePhraseTick } from '../../music/phraseEngine'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { markSeen, seenCount, say, useCoach } from '../../coach/coachBus'
import { createListener, type Listener, type Move } from './listen'
import type { MoveKind } from './lines'
import { choose, contradicts, type SelState } from './select'

export type Mood = 'idle' | 'applaud' | 'lean' | 'gasp' | 'nod' | 'think'
export interface FloatLabel { id: number; text: string; kind: MoveKind }
export interface ReelItem { t: string; text: string }
interface Mem { counts: Record<string, number>; jams: number; bestVariety: number; day: string; today: string[] }
export interface MentorState {
  on: boolean
  /** Boss mode audience: more technical words */
  tech: boolean
  mood: Mood
  moodN: number
  labels: FloatLabel[]
  reel: { items: ReelItem[]; note: string | null } | null
  setOn(v: boolean): void
}

const hot = (import.meta.hot?.data ?? {}) as { store?: ReturnType<typeof make>; w?: W; off?: () => void }
interface W {
  L: Listener | null; jam: { move: Move; at: number }[]; jamStart: number; lastNote: number
  pending: { m: Move; at: number; tries?: number }[]; nextAt: number; praiseSince: number; recent: string[]
  lastPraise?: { kind: MoveKind; topic: string } | null; lastCrit?: { kind: MoveKind; at: number } | null; critStreak?: number
  labelId: number; labelAt: Record<string, number>; mem: Mem | null; timer: ReturnType<typeof setInterval> | null
  index: AllusionIndex | null; indexTick: number; songSrc: AllusionSource[] | null; moodTimer: ReturnType<typeof setTimeout> | null
}
const W: W = hot.w ?? { L: null, jam: [], jamStart: 0, lastNote: 0, pending: [], nextAt: 0, praiseSince: 2, recent: [], labelId: 0, labelAt: {}, mem: null, timer: null, index: null, indexTick: -1, songSrc: null, moodTimer: null }

function make() {
  return create<MentorState>()((set) => ({
    on: pload<boolean>('mentor.on', false), tech: false, mood: 'idle', moodN: 0, labels: [], reel: null,
    setOn: (on) => { psave('mentor.on', on); set({ on, reel: null, labels: [] }); if (on) hello(); else stop() },
  }))
}
export const useMentor = hot.store ?? make()
const S = () => useMentor.getState()

// ---- memory ----
const today = () => new Date().toISOString().slice(0, 10)
function mem(): Mem {
  if (!W.mem) {
    const m = pload<Mem>('mentor.v1', { counts: {}, jams: 0, bestVariety: 0, day: '', today: [] })
    if (m.day !== today()) { m.day = today(); m.today = [] }
    W.mem = m
  }
  return W.mem
}
const saveMem = () => { if (W.mem) psave('mentor.v1', W.mem) }

// ---- what the listener checks against: songs + this kid's learned phrases (rebuilt only when mastery changes) ----
function index(): AllusionIndex {
  const tick = usePhraseTick.getState().v
  if (W.index && W.indexTick === tick) return W.index
  W.songSrc ??= songSources()
  const learned: AllusionSource[] = []
  try {
    for (const s of SONGS) {
      if (s.mine) continue
      for (const size of [2, 3] as const) {
        for (const p of segment(s.id, s.notes, size, s.beatsPerBar)) {
          if (p.notes.length >= 4 && isKnown(mastery(p.id))) learned.push({ id: p.id, title: shortTitle(s.title), kind: 'phrase', key: s.key, notes: p.notes.map((n) => n.note), beats: p.notes.map((n) => n.beats) })
        }
      }
    }
  } catch (e) { console.warn('[mentor] learned phrases unavailable', e) }
  W.indexTick = tick
  return (W.index = buildIndex([...W.songSrc, ...learned]))
}

// ---- listening ----
const active = () => S().on && useScreen.getState().screen === 'play' && !useScore.getState().score && !usePhraseView.getState().phrase
function listener(): Listener {
  return (W.L ??= createListener({
    key: () => useHarmonyStore.getState().key,
    index,
    meters: () => ({ rhythm: useJudge.getState().rhythm }),
  }, onMove))
}
const hello = () => {
  W.nextAt = performance.now() + 1500
  if (seenCount('mentor:hello') < 3) { markSeen('mentor:hello'); say({ source: 'mentor', topic: 'mentor:hello', text: S().tech ? 'Audience mode on. Play, I\'m taking notes.' : 'Hi, I\'m your audience. Play anything. I\'m listening.', priority: 2, ms: 3500, tone: 'info' }) }
}
function stop() { W.pending = []; W.jam = []; W.L?.reset(); useMentor.setState({ labels: [], reel: null, mood: 'idle' }) }

const REEL: Partial<Record<MoveKind, string>> = {
  sequence: 'you climbed a sequence', inversion: 'you flipped a motif upside down', retrograde: 'you played an idea backwards', 'call-response': 'you built a call and response',
  motif: 'you repeated a motif', repetition: 'you repeated an idea', variation: 'you varied an idea', 'rhythm-motif': 'you reused a rhythm', 'cadence-authentic': 'you finished with a strong cadence',
  'cadence-half': 'you left a half cadence hanging', 'cadence-deceptive': 'you pulled a deceptive cadence', cadence: 'you came home', progression: 'you played a chord progression', modulation: 'you changed key',
  crescendo: 'you built a crescendo', decrescendo: 'you faded away', range: 'you used the whole keyboard', space: 'you left space', tension: 'you made tension and release', cluster: 'you hit a tone cluster',
  arpeggio: 'you rolled an arpeggio', 'walking-bass': 'you walked a bass line', callback: 'you brought an idea back', flow: 'you kept a long line going', steady: 'you kept a steady beat',
  'style-bach': 'you played a running figure like Bach', 'style-satie': 'you made slow, spacious music like Satie', 'style-beethoven': 'you hit a Beethoven-style punch',
  'style-mozart': 'you played an Alberti bass like Mozart', 'style-chopin': 'you swept the left hand like Chopin', 'style-debussy': 'you found a Debussy color', 'style-joplin': 'you played ragtime like Joplin',
}
const NOUN: Partial<Record<MoveKind, string>> = { sequence: 'sequence', inversion: 'inversion', retrograde: 'retrograde', 'call-response': 'call and response', variation: 'variation', 'rhythm-motif': 'rhythm motif', 'cadence-authentic': 'cadence', 'cadence-half': 'half cadence', 'cadence-deceptive': 'deceptive cadence', cadence: 'cadence', progression: 'chord progression', modulation: 'key change', crescendo: 'crescendo', range: 'wide range', space: 'rest', arpeggio: 'arpeggio', 'walking-bass': 'walking bass', callback: 'callback', motif: 'motif', tension: 'tension and release', cluster: 'tone cluster' }
const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
const reelText = (m: Move) => m.kind === 'quote' ? `you quoted ${m.data.who ? m.data.who + (String(m.data.who).endsWith('s') ? '\' ' : '\'s ') : ''}${m.data.title}${m.data.key ? ' in ' + m.data.key : ''}!` : (REEL[m.kind] ?? m.label) + (m.kind === 'progression' ? ` (${m.data.name})` : m.kind === 'modulation' ? ` to ${m.data.to}` : '')

function setMood(m: Mood) {
  useMentor.setState((s) => ({ mood: m, moodN: s.moodN + 1 }))
  if (W.moodTimer) clearTimeout(W.moodTimer)
  W.moodTimer = setTimeout(() => useMentor.setState({ mood: 'idle' }), 2600)
}

function onMove(m: Move) {
  if (!active()) return
  const now = performance.now()
  if (!m.critique) {
    W.jam.push({ move: m, at: now })
    if (W.jam.length > 60) W.jam.shift()
    // float a label (same kind at most every 2.5 s)
    const k = m.kind + (m.kind === 'quote' ? String(m.data.title) : '')
    if (m.label && now - (W.labelAt[k] ?? -1e9) > 2500) {
      W.labelAt[k] = now
      const id = ++W.labelId
      useMentor.setState((s) => ({ labels: [...s.labels.slice(-2), { id, text: m.label, kind: m.kind }] }))
      setTimeout(() => useMentor.setState((s) => ({ labels: s.labels.filter((l) => l.id !== id) })), 3200)
    }
    setMood(m.mood)
  }
  W.pending.push({ m, at: now })
  pump()
}

/** Pick the most interesting fresh candidate and say it, if enough quiet has passed. */
function pump() {
  const now = performance.now()
  W.pending = W.pending.filter((p) => now - p.at < 9000)
  if (now < W.nextAt || !W.pending.length || !active()) return
  const mm = mem()
  const lc = W.lastCrit ?? null
  const st: SelState = {
    everSeen: (k) => !!mm.counts[k], seenToday: (k) => mm.today.includes(k),
    recentKinds: W.recent.filter((x): x is MoveKind => !x.includes(' ')) as MoveKind[],
    lastPraise: W.lastPraise ?? null, lastCritique: lc,
    critStreak: lc && now - lc.at > 20000 ? 0 : (W.critStreak ?? 0),
  }
  // praise that contradicts the critique we just said is dropped, not delayed
  W.pending = W.pending.filter((p) => !contradicts(p.m, st, now))
  const i = choose(W.pending.map((p) => p.m), st, now)
  const pick = i >= 0 ? W.pending[i] : undefined
  if (!pick) return
  const m = pick.m, tech = S().tech
  const firstEver = !m.critique && !mm.counts[m.kind], firstToday = !m.critique && !firstEver && !mm.today.includes(m.kind)
  const noun = NOUN[m.kind] ?? ''
  let text = tech ? m.tech : m.kid[Math.floor(Math.random() * m.kid.length)]
  // never the same line twice in a row of recents
  for (const alt of m.kid) if (!tech && W.recent.includes(alt)) continue; else if (!tech && W.recent.includes(text)) text = alt
  if (!tech && !m.critique && m.kind !== 'quote' && !W.recent.slice(-4).some((r) => r.startsWith('First'))) {
    if (firstEver && noun) text = `First time I've seen you use ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}! ${text}`
    else if (firstToday && noun) text = `First ${noun} today. ${text}`
  }
  const id = say({ source: 'mentor', topic: m.topic, text, priority: m.kind === 'quote' || m.kind === 'modulation' || m.kind.startsWith('style-') ? 2 : 1, ms: m.kind === 'quote' && m.data.fact ? 5600 : 4200, tone: m.critique ? 'tip' : 'praise' })
  if (!id) { // the bus said no (something more important is showing, or a repeat): retry soon, give up after a few tries
    pick.tries = (pick.tries ?? 0) + 1
    if (pick.tries >= 4) W.pending = W.pending.filter((p) => p !== pick)
    W.nextAt = now + 900
    return
  }
  W.pending = W.pending.filter((p) => p !== pick)
  W.nextAt = now + 4000 + Math.random() * 2000
  W.recent = [...W.recent.slice(-9), text, m.kind]
  if (m.critique) {
    W.praiseSince = 0; W.critStreak = st.critStreak + 1; W.lastCrit = { kind: m.kind, at: now }; setMood('think')
    W.pending = W.pending.filter((p) => !contradicts(p.m, { ...st, lastCritique: W.lastCrit ?? null }, now))
  } else { W.praiseSince++; W.critStreak = 0; W.lastPraise = { kind: m.kind, topic: m.topic }; markSeen(m.topic); setMood(m.mood) }
  if (!m.critique) { mm.counts[m.kind] = (mm.counts[m.kind] ?? 0) + 1; if (!mm.today.includes(m.kind)) mm.today.push(m.kind); saveMem() }
}

// ---- highlights reel ----
export function showReel(manual = false) {
  const jam = W.jam
  if (!jam.length) { if (manual) say({ source: 'mentor', topic: 'mentor:empty', text: S().tech ? 'Nothing to review yet.' : 'Play me something first, then I\'ll show you the highlights.', priority: 2, ms: 3000, tone: 'info' }); return }
  const seen = new Set<string>(), top: typeof jam = []
  for (const j of [...jam].sort((a, b) => b.move.score - a.move.score)) {
    const k = j.move.kind + String(j.move.data.title ?? '')
    if (seen.has(k)) continue
    seen.add(k); top.push(j)
    if (top.length === 3) break
  }
  top.sort((a, b) => a.at - b.at)
  const items = top.map((j) => ({ t: mmss(j.at - W.jamStart), text: reelText(j.move) }))
  const mm = mem(), variety = new Set(jam.map((j) => j.move.kind)).size
  let note: string | null = null
  if (variety > mm.bestVariety && mm.jams > 0) note = `New personal best: ${variety} different moves in one jam!`
  else if (mm.jams === 0) note = `First jam on record: ${variety} different move${variety === 1 ? '' : 's'}.`
  mm.jams++; mm.bestVariety = Math.max(mm.bestVariety, variety); saveMem()
  useMentor.setState({ reel: { items, note } })
  W.jam = []
  setMood('applaud')
}
export const closeReel = () => useMentor.setState({ reel: null })

// ---- wiring ----
function tickLoop() {
  const now = performance.now()
  if (!S().on) return
  if (W.L) W.L.advance(now)
  pump()
  // after 10 s of quiet at the end of a jam with 2+ moments, show the highlights
  if (W.jam.length >= 2 && W.lastNote && now - W.lastNote > 10000 && !S().reel && active()) showReel()
}
function start() {
  hot.off?.()
  const offJ = onJudge((e) => {
    if (!S().on || !active()) return
    const now = performance.now()
    if (e.type === 'note') {
      if (now - W.lastNote > 10000) { W.jamStart = now; if (S().reel) closeReel() }
      W.lastNote = now
      listener().push(e.g.note, e.g.velocity, e.g.t)
    } else if (e.type === 'resolve') listener().resolve(now)
  })
  const offP = onProfileChange(() => { W.mem = null; W.L?.reset(); W.index = null; W.pending = []; W.jam = []; useMentor.setState({ on: pload<boolean>('mentor.on', false), reel: null, labels: [] }) })
  if (W.timer) clearInterval(W.timer)
  W.timer = setInterval(tickLoop, 120)
  hot.off = () => { offJ(); offP() }
  return () => { offJ(); offP(); if (W.timer) clearInterval(W.timer) }
}
const cleanup = start()

/** dev: peek at the speech queue (used by the live tests) */
export const mentorDebug = () => ({ pending: W.pending.map((p) => p.m.kind), nextIn: Math.round(W.nextAt - performance.now()), praiseSince: W.praiseSince, jam: W.jam.length, labelId: W.labelId, recent: W.recent })

/** the persona and the label layer ask: is the mentor currently shown a line? (bubble text comes from the coach bus) */
export const useMentorLine = () => useCoach((s) => (s.line?.source === 'mentor' ? s.line : null))

if (import.meta.hot) {
  import.meta.hot.data.store = useMentor
  import.meta.hot.data.w = W
  import.meta.hot.dispose(() => { cleanup(); W.L = null })
  import.meta.hot.accept()
}
