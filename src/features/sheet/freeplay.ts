// Free play: writes down what the kid plays. Notes arrive via the judge; chords = notes within a few ms.
import { create } from 'zustand'
import { onJudge } from '../../music/judge'

export interface FreeGroup { t: number; midis: number[]; beats: number }
const BPM = 100
const MAX = 20
const CHORD_MS = 70
const hot = import.meta.hot?.data as Record<string, unknown> | undefined
export const useFree = (hot?.freeStore as ReturnType<typeof make> | undefined) ?? make()
function make() { return create<{ groups: FreeGroup[] }>()(() => ({ groups: [] })) }
export const clearFree = () => useFree.setState({ groups: [] })

function beatsFor(gapMs: number): number {
  const b = (gapMs / 1000) * (BPM / 60)
  if (b > 4.5) return 1 // a long pause: new phrase, don't pretend it was a whole note
  const opts = [0.25, 0.5, 1, 1.5, 2, 3, 4]
  return opts.reduce((a, o) => (Math.abs(o - b) < Math.abs(a - b) ? o : a), 1)
}

hot?.freeUnsub && (hot.freeUnsub as () => void)()
const unsub = onJudge((e) => {
  if (e.type !== 'note') return
  const { t, note } = e.g
  const gs = useFree.getState().groups
  const last = gs[gs.length - 1]
  if (last && t - last.t < CHORD_MS) {
    if (!last.midis.includes(note)) useFree.setState({ groups: [...gs.slice(0, -1), { ...last, midis: [...last.midis, note].sort((a, b) => a - b) }] })
    return
  }
  const next = last ? [...gs.slice(0, -1), { ...last, beats: beatsFor(t - last.t) }] : []
  next.push({ t, midis: [note], beats: 1 })
  useFree.setState({ groups: next.slice(-MAX) })
})
if (import.meta.hot) {
  import.meta.hot.data.freeStore = useFree
  import.meta.hot.data.freeUnsub = unsub
  import.meta.hot.accept()
}
