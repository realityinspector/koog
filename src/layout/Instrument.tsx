import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Celebration } from '../features/celebrate/Celebration'
import './instrument.css'

export type ModeDef = { id: string; icon: string; label: string; title: string; dev?: boolean; badge?: string | number; node?: ReactNode }

const KEY = 'koog.mode.screen'
function loadMode(): string {
  try { return localStorage.getItem(KEY) || 'play' } catch { return 'play' }
}

/** The Koog instrument: strip, display (hero), control rail of modes, keybed. Modes with a node open as screens over the display. */
export function Instrument({ strip, idea, display, overlay, keybed, modes }: {
  strip: ReactNode; idea: ReactNode; display: ReactNode; overlay: ReactNode; keybed: ReactNode; modes: ModeDef[]
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

  const screens = modes.filter((m) => m.node != null)
  return (
    <div className="kg-app">
      <div className="kg-chassis">
        <div className="kg-cheek kg-cheek-l" aria-hidden />
        <div className="kg-panel">
          <header className="kg-strip">
            <span className="kg-badge" aria-label="Koog smart synthesizer"><span className="kg-logo">Koog</span><span className="kg-sub">smart synth</span></span>
            <div className="kg-strip-mid">{strip}</div>
            <button className={'kg-idea' + (ideaOpen ? ' on' : '')} aria-expanded={ideaOpen} onClick={() => setIdeaOpen((v) => !v)}>
              <span aria-hidden>💡</span> <span className="kg-idea-t">Idea?</span>
            </button>
            {/* stays mounted when closed so a half-typed idea isn't lost */}
            <div className="kg-idea-pop" hidden={!ideaOpen}>{idea}</div>
          </header>

          <div className="kg-bezel">
            <div className="kg-display" data-screen={mode !== 'play' ? '1' : undefined}>
              {display}
              <div className="kg-overlay">{overlay}</div>
              {screens.map((m) => (
                <div key={m.id} data-id={m.id} id={'kg-screen-' + m.id} role="region" aria-label={m.title} hidden={mode !== m.id} className="kg-screen">
                  <div className="kg-screen-head">
                    <h2>{m.icon} {m.title}</h2>
                    <button className="kg-close" onClick={() => select('play')}>✕ <span>Back to PLAY</span></button>
                  </div>
                  <div className="kg-screen-body">{m.node}</div>
                </div>
              ))}
              <div className="kg-glass" aria-hidden />
            </div>
          </div>

          <nav className="kg-rail" aria-label="Modes">
            {modes.map((m) => (
              <button key={m.id} className={'kg-mode' + (mode === m.id ? ' on' : '') + (m.dev ? ' dev' : '')} aria-pressed={mode === m.id} onClick={() => select(m.id)}>
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
      <Celebration />
    </div>
  )
}
