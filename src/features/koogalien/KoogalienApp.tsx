// The Koogalien app shell: Write | Dictionary | Learn. Dictionary and Learn are Builder D's; they load by glob,
// so this compiles (and shows "coming soon") whether or not they exist yet.
import { Suspense, lazy, useEffect, useMemo, type ComponentType } from 'react'
import { makeHost } from './host'
import { Writer } from './Writer'
import { useKoogalien, koogalienActions } from './store'
import { KOOGALIEN_NAME } from './brand'
import { fromShare } from '../../koogalien/lang/share'
import { print } from '../../koogalien/lang/print'
import type { KoogalienHost } from '../../koogalien/ports'
import './koogalien.css'

type Tabbed = ComponentType<{ host: KoogalienHost }>
const dict = import.meta.glob('./dictionary/Dictionary.tsx') as Record<string, () => Promise<{ default: Tabbed }>>
const learn = import.meta.glob('./learn/EchoGame.tsx') as Record<string, () => Promise<{ default: Tabbed }>>
const Soon: Tabbed = () => <p className="kgx-soon">Coming soon!</p>
const pick = (g: Record<string, () => Promise<{ default: Tabbed }>>) => { const l = Object.values(g)[0]; return l ? lazy(l) : Soon }
const Dictionary = pick(dict)
const Learn = pick(learn)

export default function KoogalienApp({ kore }: { kore: unknown }) {
  const host = useMemo(() => makeHost(kore), [kore])
  const tab = useKoogalien((s) => s.tab)
  useEffect(() => {
    const m = /[?&]m=([^&]+)/.exec(location.hash)
    if (!m) return
    try { const p = fromShare(decodeURIComponent(m[1])); if (p.sentence) koogalienActions.setCode(print(p.sentence)) } catch { /* a bad link just opens empty */ }
  }, [])
  const tabs: { k: 'write' | 'dictionary' | 'learn'; label: string }[] = [{ k: 'write', label: 'Write' }, { k: 'dictionary', label: 'Dictionary' }, { k: 'learn', label: 'Learn' }]
  return (
    <div className="kgx-app">
      <header className="kgx-head">
        <h1>{KOOGALIEN_NAME}</h1>
        <nav role="tablist" aria-label={KOOGALIEN_NAME + ' sections'}>
          {tabs.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => koogalienActions.setTab(t.k)}>{t.label}</button>)}
        </nav>
        <button type="button" className="kgx-exit" onClick={() => host.exit()} title="Close">Close</button>
      </header>
      <Suspense fallback={<p className="kgx-soon">Loading...</p>}>
        {tab === 'write' ? <Writer host={host} /> : tab === 'dictionary' ? <Dictionary host={host} /> : <Learn host={host} />}
      </Suspense>
    </div>
  )
}
