import { create } from 'zustand'

export type CelebrateKind = 'badge' | 'gold' | 'best'
export interface CelebrateOpts { title: string; emoji?: string; kind?: CelebrateKind }
export interface CelebrateEvent { id: number; title: string; emoji: string; kind: CelebrateKind }

interface State { event: CelebrateEvent | null }

const make = () => create<State>(() => ({ event: null }))

export const useCelebrateStore: ReturnType<typeof make> =
  (import.meta.hot?.data.celebrateStore as ReturnType<typeof make> | undefined) ?? make()
if (import.meta.hot) import.meta.hot.data.celebrateStore = useCelebrateStore

let nextId = (import.meta.hot?.data.celebrateId as number | undefined) ?? 1

export function celebrate(opts: CelebrateOpts) {
  const kind = opts.kind ?? 'badge'
  const emoji = opts.emoji ?? (kind === 'gold' ? '🥇' : kind === 'best' ? '⭐' : '🏅')
  if (import.meta.hot) import.meta.hot.data.celebrateId = nextId + 1
  useCelebrateStore.setState({ event: { id: nextId++, title: opts.title, emoji, kind } })
}

if (import.meta.hot) { import.meta.hot.accept() }
