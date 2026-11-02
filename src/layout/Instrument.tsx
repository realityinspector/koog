import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StackLayout } from './StackLayout'
import { Celebration } from '../features/celebrate/Celebration'
import { useScreen } from './screenStore'
import { useScore, useSheet } from '../music/scoreStore'
import './instrument.css'
import koogLogo from '../assets/koog-logo.svg'

export type ModeDef = { id: string; icon: string; label: string; title: string; dev?: boolean; badge?: string | number; node?: ReactNode }

const KEY = 'koog.mode.screen'
function loadMode(): string {
  try { return localStorage.getItem(KEY) || 'play' } catch { return 'play' }
}

/** The Koog instrument: strip, display (hero), control rail of modes, keybed. Modes with a node open as screens over the display. */
export function Instrument({ strip, idea, display, overlay, keybed, modes, sheet, lean }: {
  strip: ReactNode; idea: ReactNode; display: ReactNode; overlay: ReactNode; keybed: ReactNode; modes: ModeDef[]
  /** sheet-music strip along the bottom of the display, above every screen and game */
  sheet?: ReactNode
  /** Boss mode: no 💡 Idea button and no kid celebrations */
  lean?: boolean
}) {
  const [saved, setSaved] = useState(loadMode)
  // Saved mode may be gone (e.g. DEV after leaving Dad mode): fall back to PLAY.
  const mode = modes.some((m) => m.id === saved) ? saved : 'play'
  const [ideaOpen, setIdeaOpen] = useState(false)
  const first = useRef(true)

  const select = (id: string) => {
    setSaved(id)
    try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  }

  useEffect(() => { useScreen.setState({ screen: mode }) }, [mode])

  // Focus: opening a screen moves focus to its heading; closing returns it to the rail button that opened it.
  const rail = useRef<HTMLElement>(null)
  const vizLayer = useRef<HTMLDivElement>(null)
  const prevMode = useRef(mode)
  useEffect(() => {
    const prev = prevMode.current
    prevMode.current = mode
    if (prev === mode) return
    if (mode !== 'play') {
      const scr = document.getElementById('kg-screen-' + mode)
      const h = scr?.querySelector<HTMLElement>('.kg-screen-head h2')
      h?.focus({ preventScroll: true })
      if (document.activeElement !== h) { scr?.setAttribute('tabindex', '-1'); scr?.focus({ preventScroll: true }) }
    } else {
      rail.current?.querySelector<HTMLElement>(`[data-mode="${prev}"]`)?.focus({ preventScroll: true })
    }
  }, [mode])

  // The visualizer canvas is decoration: hide it from assistive tech (Visualizer.tsx is not ours to edit).
  useEffect(() => {
    vizLayer.current?.querySelectorAll('canvas').forEach((c) => c.setAttribute('aria-hidden', 'true'))
  })

  // Canvases hidden with display:none need a nudge to re-measure when shown again.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const r = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(r)
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (ideaOpen) { setIdeaOpen(false); return }
      if (mode !== 'play') select('play')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const homeLabel = modes.find((m) => m.id === 'play')?.label ?? modes[0]?.label ?? 'PLAY'
  const screens = modes.filter((m) => m.node != null)
  const hasScore = useScore((s) => s.score != null)
  // same rule as SheetOverlay: reserve room only when the sheet has something to show
  const sheetOn = useSheet((s) => s.on) && (hasScore || mode === 'play')
  return (
    <main className="kg-app">
      <h1 className="kg-sr-only">Koog</h1>
      <div className="kg-chassis">
        <div className="kg-cheek kg-cheek-l" aria-hidden />
        <div className="kg-panel">
          <header className="kg-strip">
            <span className="kg-badge" aria-label="Koog smart synthesizer"><img className="kg-logo-img" src={koogLogo} alt="" width="104" height="33" /><span className="kg-sub">smart synth</span></span>
            <div className="kg-strip-mid">{strip}</div>
            {!lean && <button className={'kg-idea' + (ideaOpen ? ' on' : '')} aria-expanded={ideaOpen} onClick={() => setIdeaOpen((v) => !v)}>
              <span aria-hidden>💡</span> <span className="kg-idea-t">Idea?</span>
            </button>}
            {/* stays mounted when closed so a half-typed idea isn't lost */}
            {!lean && <div className="kg-idea-pop" hidden={!ideaOpen}>{idea}</div>}
          </header>

          <div className="kg-bezel">
            <div className="kg-display" data-screen={mode !== 'play' ? '1' : undefined} data-sheet={sheetOn ? '1' : undefined}>
              {/* inert while a screen covers it, so hidden viz-bar buttons leave the tab order */}
              <div ref={vizLayer} className="kg-viz-layer" inert={mode !== 'play'}>{display}</div>
              <div className="kg-overlay">{overlay}</div>
              {screens.map((m) => (
                <div key={m.id} data-id={m.id} id={'kg-screen-' + m.id} role="region" aria-label={m.title} hidden={mode !== m.id} className="kg-screen">
                  <div className="kg-screen-head">
                    <h2 tabIndex={-1}>{m.icon} {m.title}</h2>
                    <button className="kg-close" onClick={() => select('play')}>✕ <span>Back to {homeLabel}</span></button>
                  </div>
                  <div className="kg-screen-body">{m.node}</div>
                </div>
              ))}
              {sheet}
              <StackLayout />
              <div className="kg-glass" aria-hidden />
            </div>
          </div>

          <nav className="kg-rail" aria-label="Modes" ref={rail}>
            {modes.map((m) => (
              <button key={m.id} data-mode={m.id} className={'kg-mode' + (mode === m.id ? ' on' : '') + (m.dev ? ' dev' : '')} aria-pressed={mode === m.id} onClick={() => select(m.id)}>
                <i className="kg-led" aria-hidden />
                <span className="kg-mode-ic" aria-hidden>{m.icon}</span>
                <span className="kg-mode-lb">{m.label}</span>
                {m.badge != null && m.badge !== 0 && <span className="kg-mode-badge" aria-label={`${m.badge} earned`}>{m.badge}</span>}
              </button>
            ))}
          </nav>

          <div className="kg-keybed">{keybed}</div>
        </div>
        <div className="kg-cheek kg-cheek-r" aria-hidden />
      </div>
      {!lean && <Celebration />}
    </main>
  )
}
