// ONE channel for everything that talks to the player: coach tips, Mentor, Vibes captions, motif/phrase labels.
// Speakers call say(); one display (CoachTips today) shows the winner, with one throttle and one per-kid "seen" counter,
// so features never pile captions on top of each other.
// STABLE API: say(line) -> id, onSay(fn), useCoach (current line), seenCount(topic), markSeen(topic).
import { create } from 'zustand'
import { pload, psave } from '../profile/profile'

export type CoachSource = 'coach' | 'mentor' | 'vibes' | 'phrase' | 'mimic' | 'game'
export interface CoachLine {
  source: CoachSource
  /** stable topic id for "seen" counting and de-duplication, e.g. 'cadence', 'quote:ode', 'mood:sad' */
  topic: string
  text: string
  /** 0..3: 3 = always show (BOOM, achievements), 2 = notable (quote, cadence), 1 = normal, 0 = filler */
  priority?: 0 | 1 | 2 | 3
  /** how long to show (ms); default 2500 */
  ms?: number
  /** optional tone for styling */
  tone?: 'praise' | 'tip' | 'info' | 'mood'
}
interface CoachState { line: (CoachLine & { id: number; at: number }) | null }
type Hot = { store?: ReturnType<typeof make>; fns?: Set<(l: CoachLine & { id: number }) => void>; st?: { id: number; lastAt: number; lastTopic: Map<string, number>; hide: ReturnType<typeof setTimeout> | null } }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<CoachState>()(() => ({ line: null })) }
export const useCoach = hot.store ?? make()
const fns = hot.fns ?? new Set<(l: CoachLine & { id: number }) => void>()
const st = hot.st ?? { id: 0, lastAt: 0, lastTopic: new Map<string, number>(), hide: null }

const MIN_GAP = 2500 // ms between normal lines
const SAME_TOPIC_GAP = 20000 // don't repeat a topic within 20 s

/** Ask to show a line. Returns its id, or 0 if it was throttled (lower priority than what's showing, too soon, or a repeat). */
export function say(line: CoachLine): number {
  const now = performance.now(), p = line.priority ?? 1
  const cur = useCoach.getState().line
  if (p < 3) {
    if (cur && (cur.priority ?? 1) > p && now - cur.at < (cur.ms ?? 2500)) return 0
    if (now - st.lastAt < MIN_GAP && p < 2) return 0
    const lt = st.lastTopic.get(line.topic)
    if (lt && now - lt < SAME_TOPIC_GAP) return 0
  }
  const id = ++st.id
  st.lastAt = now; st.lastTopic.set(line.topic, now)
  useCoach.setState({ line: { ...line, id, at: now } })
  if (st.hide) clearTimeout(st.hide)
  st.hide = setTimeout(() => { if (useCoach.getState().line?.id === id) useCoach.setState({ line: null }) }, line.ms ?? 2500)
  for (const f of [...fns]) { try { f({ ...line, id }) } catch (e) { console.error('[coach]', e) } }
  return id
}
export function onSay(fn: (l: CoachLine & { id: number }) => void) { fns.add(fn); return () => { fns.delete(fn) } }
/** per-kid "how many times has this kid seen topic X" (for 'full lesson the first few times') */
export function seenCount(topic: string): number { return pload<Record<string, number>>('coach.seen', {})[topic] ?? 0 }
export function markSeen(topic: string) { const s = pload<Record<string, number>>('coach.seen', {}); s[topic] = (s[topic] ?? 0) + 1; psave('coach.seen', s) }

if (import.meta.hot) {
  import.meta.hot.data.store = useCoach
  import.meta.hot.data.fns = fns
  import.meta.hot.data.st = st
  import.meta.hot.accept()
}
