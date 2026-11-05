// The Koogalien App Store listing: a Kore app manifest. The Kore registry (src/kode/kore/apps.ts) imports KOOGALIEN_APP;
// registerKoogalien() is the same thing for anything that wants to register it by hand. Kept tiny so the Store loads fast.
import { createElement, type ComponentType } from 'react'
import { registerApp } from '../../kode/kore/registry'
import type { KodeApp, KoreAppProps } from '../../kode/kore/types'
import { KOOGALIEN_NAME, KOOGALIEN_TAGLINE } from './brand'

type Loader = () => Promise<Record<string, unknown>>
/** the app shell is built by another file; until it exists the listing opens a friendly "coming soon" card instead of breaking the build */
const shell = import.meta.glob('./KoogalienApp.tsx') as Record<string, Loader>

const component: NonNullable<KodeApp['component']> = async () => {
  const load = Object.values(shell)[0]
  if (load) {
    const m = await load()
    if (typeof m.default === 'function') return { default: m.default as ComponentType<KoreAppProps> }
  }
  return { default: () => createElement('p', { style: { padding: 24 } }, 'The Koogalien app is still being built. Check back soon!') }
}

export const KOOGALIEN_APP: KodeApp = {
  id: 'koogalien',
  name: KOOGALIEN_NAME,
  icon: '👽',
  tagline: KOOGALIEN_TAGLINE,
  concepts: ['sequence', 'event', 'variable'],
  inputs: ['keys', 'drums', 'dj', 'pedal', 'screen'],
  ages: [7, 99],
  minutes: 10,
  // the Store frame runs the component at #/apps/koogalien; a plain #/koogalien route is not mounted in App.tsx (yet)
  route: '#/apps/koogalien',
  status: 'beta',
  kind: 'kode',
  component,
}

export function registerKoogalien(): void { registerApp(KOOGALIEN_APP) }

if (import.meta.hot) import.meta.hot.accept()
