// The built-in apps. Components load lazily, and apps still being built are found with import.meta.glob (a missing file is a
// 'not ready yet' card instead of a broken build). To add an app: register it here (or call registerApp from your own module).
import { createElement, type ComponentType } from 'react'
import { registerApp } from './registry'
import type { KodeApp, KoreAppProps } from './types'

type Mod = Record<string, unknown>
type Loader = () => Promise<Mod>
/** first loader whose module exposes a component (default export, or the named one) */
function lazyOf(globbed: Record<string, Loader>, named?: string): KodeApp['component'] {
  return async () => {
    const keys = Object.keys(globbed)
    for (const k of keys) {
      const m = await globbed[k]()
      const C = (named && m[named]) || m.default || Object.values(m).find((v) => typeof v === 'function')
      if (typeof C === 'function') {
        const Comp = C as ComponentType<Record<string, unknown>>
        const Wrapped = ({ kore }: KoreAppProps) => createElement(Comp, { kore, onExit: kore.exit, onClose: kore.exit })
        return { default: Wrapped }
      }
    }
    const Soon = () => createElement('p', { style: { padding: 24 } }, 'This app is still being built. Check back soon!')
    return { default: Soon }
  }
}

const racer = import.meta.glob('/src/features/games/racer/RacerGame.tsx') as Record<string, Loader>
const editor = import.meta.glob('/src/features/kode/KodePanel.tsx') as Record<string, Loader>
const choreo = import.meta.glob(['/src/features/kodeapps/choreographer/index.tsx', '/src/features/kodeapps/choreographer/Choreographer.tsx']) as Record<string, Loader>
const motifsUi = import.meta.glob('/src/features/kodeapps/motifs/MyMotifs.tsx') as Record<string, Loader>

export const BUILT_IN: KodeApp[] = [
  { id: 'phrase-racer', name: 'Koogalien Racer', icon: '🏎️', tagline: 'Play a phrase and it becomes the road. Steer with the notes.', concepts: ['sequence', 'event', 'debug'], inputs: ['keys', 'drums', 'dj', 'pedal'], ages: [6, 14], minutes: 8, route: '#/games/racer', status: 'beta', kind: 'kode', component: lazyOf(racer, 'RacerGame') },
  { id: 'koog-kode', name: 'Koog Kode', icon: '⌨️', tagline: 'Type a pattern and it plays. Change a word, hear it change.', concepts: ['sequence', 'loop', 'variable', 'parallel', 'random'], inputs: ['keys', 'screen'], ages: [8, 16], minutes: 10, route: '#/kode', status: 'beta', kind: 'kode', component: lazyOf(editor, 'KodePanel') },
  { id: 'choreographer', name: 'Koreographer', icon: '💃', tagline: 'Play phrases to choreograph a dancer. Every phrase is a move.', concepts: ['sequence', 'loop', 'function', 'event'], inputs: ['keys', 'drums', 'pedal'], ages: [6, 14], minutes: 8, route: '#/apps/choreographer', status: 'beta', kind: 'kode', component: lazyOf(choreo) },
  { id: 'my-motifs', name: 'My Motifs', icon: '🧩', tagline: 'Save a phrase as a function. Play its call sign to run it, higher, faster or louder.', concepts: ['function', 'parameter', 'recursion', 'event'], inputs: ['keys', 'drums', 'dj', 'pedal', 'screen'], ages: [7, 16], minutes: 6, route: '#/apps/my-motifs', status: 'ready', kind: 'kode', component: lazyOf(motifsUi) },
  { id: 'phrase-match', name: 'Phrase Match', icon: '🃏', tagline: 'Flip cards, find the twin tunes, play them back.', concepts: ['sequence', 'condition'], inputs: ['keys'], ages: [5, 12], minutes: 6, route: '#/games/memory', status: 'ready', kind: 'learning' },
  { id: 'light-the-tree', name: 'Light the Tree', icon: '🎄', tagline: 'Learn a holiday song rung by rung; each phrase hangs an ornament.', concepts: ['sequence', 'loop', 'debug'], inputs: ['keys'], ages: [5, 12], minutes: 10, route: '#/games/tree', status: 'ready', kind: 'learning' },
  { id: 'harvest-feast', name: 'Harvest Feast', icon: '🦃', tagline: 'Learn a harvest song rung by rung; each phrase fills the table.', concepts: ['sequence', 'loop', 'debug'], inputs: ['keys'], ages: [5, 12], minutes: 10, route: '#/games/feast', status: 'ready', kind: 'learning' },
]
for (const a of BUILT_IN) registerApp(a)

if (import.meta.hot) import.meta.hot.accept()
