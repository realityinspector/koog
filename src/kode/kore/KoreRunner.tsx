// Runs one Kore app: loads its lazy component, gives it a Kore, and cleans everything up on unmount / HMR.
import { Suspense, lazy, useEffect, useMemo } from 'react'
import { acquireCallSigns, createKore } from './sdk'
import type { KodeApp } from './types'

export function KoreRunner({ app, onExit }: { app: KodeApp; onExit: () => void }) {
  const kore = useMemo(() => createKore(app.id, { exit: onExit }), [app.id, onExit])
  const Comp = useMemo(() => lazy(app.component ?? (async () => ({ default: () => null }))), [app])
  useEffect(() => { const rel = acquireCallSigns(); return () => { rel(); kore.dispose() } }, [kore])
  return <Suspense fallback={<p style={{ padding: 24 }}>Loading {app.name}...</p>}><Comp kore={kore} /></Suspense>
}
