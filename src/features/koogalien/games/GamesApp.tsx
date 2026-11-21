// "Koogalien Games" as its own App Store entry (#/apps/koogalien-games): the same four games, outside the Koogalien app shell.
import { useEffect, useMemo } from 'react'
import { makeHost } from '../host'
import { appKey, kvLoad, kvSave } from '../../../kode/kore/kv'
import GamesHub from './GamesHub'

export default function GamesApp({ kore }: { kore: unknown }) {
  // progress is the Koogalien app's own, so a word learned here counts in the Echo Game and the Dictionary too
  const host = useMemo(() => ({ ...makeHost(kore), progress: { load: <T,>(k: string, f: T) => kvLoad(appKey('koogalien', k), f), save: <T,>(k: string, v: T) => kvSave(appKey('koogalien', k), v) } }), [kore])
  useEffect(() => () => { try { host.guide.clear() } catch { /* nothing lit */ } }, [host])
  return (
    <div className="kgx-app">
      <header className="kgx-head"><h1>Koogalien Games</h1><button type="button" className="kgx-exit" onClick={() => host.exit()} title="Close">Close</button></header>
      <GamesHub host={host} />
    </div>
  )
}
