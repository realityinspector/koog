import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './appstore.css'
import { useProfile } from '../../profile/profile'
import { panicAll } from '../../music/panic'
import { STORE_NAME as storeName, getApp as appById, listApps as apps, type KodeApp } from '../../kode/kore'
import { loadConcepts as conceptRecord } from '../../kode/kore/concepts'
import { CONCEPTS, INPUTS, conceptInfo } from './concepts'
import { AppPreview, SLIDES } from './AppPreview'
import { closeStore, getSnapshot, goView, launch, openStore, recents, subscribe, closeFrame, type View } from './storeState'

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const isSoon = (a: KodeApp) => a.status === 'soon'
const kindOf = (a: KodeApp) => (a.kind === 'learning' && /song/i.test(a.tagline) ? 'song' : /games/.test(a.route) ? 'game' : 'kode')
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }

function Chips({ app }: { app: KodeApp }) {
  return <ul className="as-chips" aria-label="What it teaches">{app.concepts.map((c) => <li key={c} className="as-chip" data-concept={c}>{conceptInfo(c).icon} {conceptInfo(c).name}</li>)}</ul>
}
function Meta({ app }: { app: KodeApp }) {
  return (
    <div className="as-meta">
      <span className="as-inputs" aria-label={'Works with ' + app.inputs.map((i) => INPUTS[i].name).join(', ')}>{app.inputs.map((i) => <span key={i} title={INPUTS[i].name} aria-hidden>{INPUTS[i].icon}</span>)}</span>
      <span>Ages {app.ages[0]}-{app.ages[1] >= 99 ? '99+' : app.ages[1]}</span><span>{app.minutes} min</span>
    </div>
  )
}
const Status = ({ app }: { app: KodeApp }) => app.status === 'ready' ? null : <span className={'as-status ' + app.status}>{app.status === 'soon' ? 'Coming soon' : 'Beta'}</span>

function OpenBtn({ app, label }: { app: KodeApp; label?: string }) {
  return <button className="as-open" disabled={isSoon(app)} onClick={() => launch(app)} aria-label={(label ?? 'Open') + ' ' + app.name}>{isSoon(app) ? 'Soon' : label ?? 'Open'}</button>
}

function Card({ app, extra }: { app: KodeApp; extra?: ReactNode }) {
  return (
    <article className={'as-card' + (isSoon(app) ? ' soon' : '')} data-app={app.id}>
      <button className="as-card-main" onClick={() => goView({ kind: 'app', id: app.id })} aria-label={`${app.name}: details`}>
        <span className="as-icon" aria-hidden>{app.icon}</span>
        <span className="as-card-tx"><b>{app.name}</b><em>{app.tagline}</em></span>
      </button>
      <Chips app={app} />
      <Meta app={app} />
      <div className="as-card-foot"><Status app={app} />{extra}<OpenBtn app={app} /></div>
    </article>
  )
}

function Shelf({ title, sub, list, id }: { title: string; sub: string; list: KodeApp[]; id: string }) {
  if (!list.length) return null
  return (
    <section className="as-shelf" aria-labelledby={'sh-' + id} data-shelf={id}>
      <h3 id={'sh-' + id}>{title} <span>{sub}</span></h3>
      <div className="as-row" role="list" tabIndex={0} aria-label={title + ', scroll sideways'}>{list.map((a) => <div role="listitem" key={a.id}><Card app={a} /></div>)}</div>
    </section>
  )
}

function Hero({ list }: { list: KodeApp[] }) {
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const calm = useMemo(reduced, [])
  useEffect(() => {
    if (calm || hold || list.length < 2) return
    const t = window.setInterval(() => setI((x) => (x + 1) % list.length), 8000)
    return () => clearInterval(t)
  }, [calm, hold, list.length])
  const app = list[i % Math.max(1, list.length)]
  if (!app) return null
  return (
    <section className="as-hero" aria-roledescription="carousel" aria-label="Featured app" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)} data-featured={app.id}>
      <div className="as-hero-art" aria-hidden><AppPreview app={app} slide={i % 3} /></div>
      <div className="as-hero-tx" aria-live={hold ? 'polite' : 'off'}>
        <small>Featured app</small>
        <h2><span aria-hidden>{app.icon}</span> {app.name}</h2>
        <p>{app.tagline}</p>
        <Chips app={app} />
        <div className="as-hero-act"><OpenBtn app={app} /><button className="as-ghost" onClick={() => goView({ kind: 'app', id: app.id })}>See details</button></div>
      </div>
      {list.length > 1 && <div className="as-dots" role="group" aria-label="Choose a featured app">{list.map((a, k) => <button key={a.id} className={k === i % list.length ? 'on' : ''} aria-label={'Show ' + a.name} aria-pressed={k === i % list.length} onClick={() => setI(k)} />)}</div>}
    </section>
  )
}

function Home({ list }: { list: KodeApp[] }) {
  const live = list.filter((a) => !isSoon(a))
  const featured = live.slice(0, 4)
  return (
    <>
      <Hero list={featured} />
      <Shelf id="kode" title="Kode apps" sub="coding with music" list={live} />
      <Shelf id="songs" title="Learn a song" sub="play it, then understand it" list={live.filter((a) => kindOf(a) === 'song')} />
      <Shelf id="games" title="Games" sub="play to win" list={live.filter((a) => kindOf(a) === 'game')} />
      <Shelf id="soon" title="Coming soon" sub="on the way" list={list.filter(isSoon)} />
    </>
  )
}

function Detail({ app }: { app: KodeApp }) {
  const rec = conceptRecord()
  const mine = recents().find((r) => r.id === app.id)
  const got = app.concepts.filter((c) => rec[c])
  return (
    <article className="as-detail" data-detail={app.id}>
      <button className="as-back" onClick={() => goView({ kind: 'home' })}>&larr; {storeName}</button>
      <header className="as-d-head">
        <span className="as-icon big" aria-hidden>{app.icon}</span>
        <div><h2>{app.name} <Status app={app} /></h2><p>{app.tagline}</p><Meta app={app} /></div>
        <div className="as-d-act"><OpenBtn app={app} label={mine ? 'Continue' : 'Open'} /></div>
      </header>
      <section aria-label="Screenshots"><div className="as-shots" role="list" tabIndex={0} aria-label="Screenshots, scroll sideways">{SLIDES.map((s, k) => <figure key={s} role="listitem"><AppPreview app={app} slide={k} /><figcaption>{s}</figcaption></figure>)}</div></section>
      <div className="as-d-grid">
        <section><h3>About</h3><p>{app.name} is a Koog Kode app for ages {app.ages[0]} to {app.ages[1] >= 99 ? '99+' : app.ages[1]}. A round takes about {app.minutes} minutes. {isSoon(app) ? 'It is not ready yet, but you can see what it will teach.' : 'It runs right here on the Koding Kore, so it uses the same sounds and keys as the rest of Koog.'}</p></section>
        <section><h3>Works with</h3><ul className="as-with">{app.inputs.map((i) => <li key={i}><span aria-hidden>{INPUTS[i].icon}</span> {INPUTS[i].name}</li>)}</ul></section>
        <section><h3>What you'll learn</h3><ul className="as-learn">{app.concepts.map((c) => { const ci = conceptInfo(c); return <li key={c} data-concept={c}><span aria-hidden>{ci.icon}</span><div><b>{ci.name}</b><em>{ci.kid}</em></div></li> })}</ul></section>
        <section className="as-prog" aria-label="Your progress"><h3>Your progress</h3>
          <p>{mine ? `Opened ${mine.n} time${mine.n === 1 ? '' : 's'}, last ${ago(mine.at)}.` : isSoon(app) ? 'Not out yet.' : 'You have not opened this one yet.'}</p>
          <p><b>{got.length} of {app.concepts.length}</b> coding powers earned here</p>
          <ul className="as-chips">{app.concepts.map((c) => <li key={c} className={'as-chip' + (rec[c] ? ' got' : ' lock')} data-got={rec[c] ? '1' : '0'}>{rec[c] ? conceptInfo(c).icon : '🔒'} {conceptInfo(c).name}</li>)}</ul>
        </section>
      </div>
    </article>
  )
}

function MyApps({ all }: { all: KodeApp[] }) {
  const r = recents().map((x) => ({ ...x, app: all.find((a) => a.id === x.id) })).filter((x) => x.app) as Array<{ id: string; at: number; n: number; app: KodeApp }>
  if (!r.length) return <p className="as-empty">Nothing here yet. Open an app from the Store and it shows up here, ready to continue.</p>
  const [last, ...rest] = r
  return (
    <div className="as-mine">
      <section className="as-cont" data-continue={last.id}>
        <small>Continue where you left off</small>
        <div><span className="as-icon big" aria-hidden>{last.app.icon}</span><div><h3>{last.app.name}</h3><p>Last opened {ago(last.at)} &middot; opened {last.n} time{last.n === 1 ? '' : 's'}</p></div><OpenBtn app={last.app} label="Continue" /></div>
      </section>
      {rest.length > 0 && <section className="as-shelf"><h3>Recently opened</h3><div className="as-row" role="list" tabIndex={0} aria-label="Recently opened, scroll sideways">{rest.map((x) => <div role="listitem" key={x.id}><Card app={x.app} extra={<span className="as-ago">{ago(x.at)}</span>} /></div>)}</div></section>}
    </div>
  )
}

function Badges({ all }: { all: KodeApp[] }) {
  const rec = conceptRecord()
  const n = CONCEPTS.filter((c) => rec[c.id]).length
  return (
    <div className="as-badges">
      <p className="as-count" aria-live="polite"><b>{n}</b> of {CONCEPTS.length} coding powers unlocked</p>
      <ul className="as-wall">
        {CONCEPTS.map((c) => {
          const on = !!rec[c.id]
          const teach = all.filter((a) => a.concepts.includes(c.id)).sort((a, b) => Number(isSoon(a)) - Number(isSoon(b)))
          return (
            <li key={c.id} className={'as-badge ' + (on ? 'on' : 'off')} data-badge={c.id} data-state={on ? 'unlocked' : 'locked'}>
              <span className="as-medal" aria-hidden>{on ? c.icon : '🔒'}</span>
              <b>{c.name}</b>
              <em>{on ? c.kid : c.hint}</em>
              {on ? <small>Unlocked{(rec[c.id]?.count ?? 0) > 1 ? ` · used ${rec[c.id]!.count} times, since ${rec[c.id]!.first}` : ''}</small>
                : <small>{teach.length ? <>Learn it in {teach.slice(0, 3).map((a, k) => <span key={a.id}>{k > 0 && ', '}<button className="as-link" onClick={() => goView({ kind: 'app', id: a.id })}>{a.icon} {a.name}</button></span>)}{teach.length > 3 ? ` and ${teach.length - 3} more` : ''}</> : 'Coming in a future app'}</small>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- running an app inside the Store ----------
class Guard extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false }
  static getDerivedStateFromError() { return { bad: true } }
  render() { return this.state.bad ? <div className="as-loading"><p>Oops, this app did not start. Press the X to go back to the Store.</p></div> : this.props.children }
}
const Runner = lazy(() => import('../../kode/kore/KoreRunner').then((m) => ({ default: m.KoreRunner })))
function Frame({ app }: { app: KodeApp }) {
  const x = useRef<HTMLButtonElement>(null)
  useEffect(() => { x.current?.focus(); return () => { try { panicAll() } catch { /* ignore */ } } }, [])
  return (
    <div className="as-frame" role="region" aria-label={app.name} data-frame={app.id}>
      <div className="as-frame-bar"><span className="as-icon" aria-hidden>{app.icon}</span><b>{app.name}</b><span className="as-sp" />
        <button ref={x} className="as-x" onClick={closeFrame} aria-label={'Close ' + app.name + ' and go back to ' + storeName}>&#10005;</button></div>
      <div className="as-frame-body">
        <Guard>
          <Suspense fallback={<div className="as-loading" role="status"><span className="as-note" aria-hidden>🎵</span><p>Getting {app.name} ready&hellip;</p></div>}>
            <Runner app={app} onExit={closeFrame} />
          </Suspense>
        </Guard>
      </div>
    </div>
  )
}

// ---------- the screen ----------
const TABS: Array<{ k: View['kind']; label: string }> = [{ k: 'home', label: 'Store' }, { k: 'mine', label: 'My apps' }, { k: 'badges', label: '🏅 My coding powers' }]

export function StoreHost() {
  const s = useSyncExternalStore(subscribe, getSnapshot)
  const player = useProfile((p) => p.active)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!s.open) return
    const key = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.preventDefault(); e.stopPropagation(); if (s.frame) closeFrame(); else if (s.view.kind !== 'home') goView({ kind: 'home' }); else closeStore() }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [s.open, s.frame, s.view.kind])
  useEffect(() => { if (s.open && !s.frame) root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }) }, [s.open, s.frame])
  if (!s.open) return null
  const all = apps()
  const app = s.frame ? appById(s.frame) : undefined
  const detail = s.view.kind === 'app' ? appById(s.view.id) : undefined
  return createPortal(
    <div className="as-root" ref={root} role="dialog" aria-label={storeName} key={player} data-view={s.view.kind}>
      {app ? <Frame app={app} key={app.id} /> : (
        <>
          <header className="as-head">
            <h1 data-autofocus tabIndex={-1}><span aria-hidden>🏪</span> {storeName}</h1>
            <nav className="as-tabs" aria-label={storeName + ' pages'}>
              {TABS.map((t) => <button key={t.k} className={s.view.kind === t.k || (t.k === 'home' && s.view.kind === 'app') ? 'on' : ''} aria-current={s.view.kind === t.k ? 'page' : undefined} onClick={() => goView({ kind: t.k } as View)}>{t.label}</button>)}
            </nav>
            <span className="as-who" title="Your progress is saved for this player">{player === 'guest' ? 'Guest' : player}</span>
            <button className="as-x" onClick={closeStore} aria-label={'Close ' + storeName}>&#10005;</button>
          </header>
          <main className="as-body">
            {s.view.kind === 'home' && <Home list={all} />}
            {s.view.kind === 'mine' && <MyApps all={all} />}
            {s.view.kind === 'badges' && <Badges all={all} />}
            {s.view.kind === 'app' && (detail ? <Detail app={detail} /> : <p className="as-empty">We could not find that app. <button className="as-link" onClick={() => goView({ kind: 'home' })}>Back to the Store</button></p>)}
          </main>
          <footer className="as-foot">Every app is free and built into Koog. Nothing to download, nothing to buy.</footer>
        </>
      )}
    </div>, document.body)
}

export function StoreButton() {
  return (
    <button className="kg-gal-btn as-entry" aria-label={storeName} title={storeName + ': find Kode apps, track your coding powers'} onClick={() => openStore()} data-tour="appstore">
      <span aria-hidden>🏪</span> <span className="kg-gal-t">Store</span>
    </button>
  )
}

/** Boss mode has no top strip button, so it gets a small floating entry plus its own copy of the Store screen. */
export function BossStoreEntry() {
  return <><button className="as-boss-entry" aria-label={storeName} title={storeName} onClick={() => openStore()}><span aria-hidden>🏪</span> {storeName}</button><StoreHost /></>
}
