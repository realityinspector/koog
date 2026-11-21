// The Library's App Store listing (a Kore app manifest). src/kode/kore/apps.ts pushes KOOGALIEN_LIBRARY_APP. Kept tiny so the Store loads fast.
import { createElement, type ComponentType } from 'react'
import type { KodeApp, KoreAppProps } from '../../../kode/kore/types'

const component: NonNullable<KodeApp['component']> = async () => {
  const m = await import('./LibraryApp')
  return { default: m.default as ComponentType<KoreAppProps> }
}
export const KOOGALIEN_LIBRARY_APP: KodeApp = {
  id: 'koogalien-library', name: 'Koogalien Library', icon: '📚',
  tagline: 'Hear classic storybooks as Koogalien music and play along.',
  concepts: ['sequence', 'event', 'variable'], inputs: ['keys', 'drums', 'dj', 'pedal', 'screen'],
  ages: [6, 99], minutes: 15, route: '#/apps/koogalien-library', status: 'beta', kind: 'kode', component,
}
void createElement
