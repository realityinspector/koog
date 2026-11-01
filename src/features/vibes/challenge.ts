// Vibe Challenge: "Make it SPOOKY!" The kid plays until the mood engine reads that mood and holds it for a moment.
// Teaches composition by feeling. State lives in a zustand store kept across HMR.
import { create } from 'zustand'
import { useVibes, MOODS, type MoodId } from '../../music/vibes'

export const CHALLENGES: { mood: MoodId; hint: string }[] = [
  { mood: 'happy', hint: 'Play a major chord (C E G)' },
  { mood: 'sad', hint: 'Play a minor chord (A C E) or slide notes down' },
  { mood: 'spooky', hint: 'Go low and slow, or try a diminished chord' },
  { mood: 'triumphant', hint: 'Play G7 then C: the "I did it!" move' },
  { mood: 'excited', hint: 'Run up the keys fast and high' },
  { mood: 'tense', hint: 'Diminished chord (B D F) or notes outside the key' },
  { mood: 'dreamy', hint: 'Major 7 chord (C E G B), soft and slow' },
  { mood: 'cool', hint: 'Dominant 7 chord (G B D F) or a minor 7' },
  { mood: 'angry', hint: 'Smash a bunch of keys together (silly, not scary!)' },
  { mood: 'bittersweet', hint: 'C chord then A minor: a memory' },
  { mood: 'epic', hint: 'Play a bare 5th (C and G), loud' },
  { mood: 'calm', hint: 'Play soft and slow, then rest' },
]
interface CState { target: MoodId | null; hint: string; progress: number; wins: number; start: () => void; stop: () => void; next: () => void }
type Hot = { store?: ReturnType<typeof make>; timer?: ReturnType<typeof setInterval> }
const hot = (import.meta.hot?.data ?? {}) as Hot
let idx = -1
const HOLD = 1100
let heldMs = 0
function make() {
  return create<CState>()((set, get) => ({
    target: null, hint: '', progress: 0, wins: 0,
    start: () => get().next(),
    stop: () => { heldMs = 0; set({ target: null, progress: 0, hint: '' }) },
    next: () => {
      let n = Math.floor(Math.random() * CHALLENGES.length)
      if (n === idx) n = (n + 1) % CHALLENGES.length
      idx = n; heldMs = 0
      set({ target: CHALLENGES[n].mood, hint: CHALLENGES[n].hint, progress: 0 })
    },
  }))
}
export const useChallenge = hot.store ?? make()
export const targetLabel = (m: MoodId) => MOODS[m].label.toUpperCase()

if (hot.timer) clearInterval(hot.timer)
const timer = setInterval(() => {
  const c = useChallenge.getState()
  if (!c.target) return
  const v = useVibes.getState()
  if (v.mood === c.target && v.activity > 0.15) heldMs += 100
  else heldMs = Math.max(0, heldMs - 150)
  const progress = Math.min(1, heldMs / HOLD)
  if (progress >= 1) {
    useChallenge.setState({ wins: c.wins + 1, progress: 1 })
    setTimeout(() => { if (useChallenge.getState().target) useChallenge.getState().next() }, 1800)
    heldMs = -1e6
  } else if (Math.abs(progress - c.progress) > 0.01) useChallenge.setState({ progress })
}, 100)

if (import.meta.hot) {
  import.meta.hot.data.store = useChallenge
  import.meta.hot.data.timer = timer
  import.meta.hot.accept()
}
