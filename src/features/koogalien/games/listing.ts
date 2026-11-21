// The Koogalien Games App Store listing: a Kore app manifest (src/kode/kore/apps.ts adds it with one line).
import type { KodeApp } from '../../../kode/kore/types'

export const KOOGALIEN_GAMES_APP: KodeApp = {
  id: 'koogalien-games',
  name: 'Koogalien Games',
  icon: '🛸',
  tagline: 'Four games for learning Koogalien: Alien Says, Spell Station, Chat and Word Rocket.',
  concepts: ['sequence', 'event', 'variable', 'condition'],
  inputs: ['keys', 'drums', 'dj', 'pedal', 'screen'],
  ages: [7, 99],
  minutes: 10,
  route: '#/apps/koogalien-games',
  status: 'beta',
  kind: 'kode',
  component: () => import('./GamesApp'),
}
if (import.meta.hot) import.meta.hot.accept()
