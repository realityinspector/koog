import { useEffect, useRef, useState, type ReactNode } from 'react'
import './layout.css'

export type TabDef = { id: string; icon: string; label: string; dev?: boolean; node: ReactNode }

const KEY = 'koog.tab'
function loadTab(): string {
  try { return localStorage.getItem(KEY) || 'play' } catch { return 'play' }
}

/** Sticky header + tab bar + panels. All panels stay mounted; inactive ones are `hidden`. */
export function AppShell({ header, top, tabs }: { header: ReactNode; top: ReactNode; tabs: TabDef[] }) {
  const [saved, setSaved] = useState(loadTab)
  // If the saved tab is gone (e.g. Dev tab after leaving Dad mode), fall back to Play.
  const tab = tabs.some((t) => t.id === saved) ? saved : 'play'
  const [ideaOpen, setIdeaOpen] = useState(false)
  const first = useRef(true)
  const listRef = useRef<HTMLDivElement>(null)

  const select = (id: string) => {
    setSaved(id)
    try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  }

  // Canvases hidden with display:none need a nudge to re-measure when shown again.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const r = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(r)
  }, [tab])

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === tab)
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    select(tabs[n].id)
    ;(listRef.current?.querySelectorAll<HTMLElement>('[role=tab]')[n])?.focus()
  }

  return (
    <div className="ks-app">
      <header className="ks-header">
        <div className="ks-header-in">
          <span className="ks-logo">Koog</span>
          <div className="ks-hdr-mid">{header}</div>
          <button
            className={`ks-idea ${ideaOpen ? 'on' : ''}`}
            aria-expanded={ideaOpen}
            onClick={() => setIdeaOpen((v) => !v)}
          >
            💡 <span>Idea?</span>
          </button>
        </div>
        {/* stays mounted when closed so a half-typed idea isn't lost */}
        <div className="ks-idea-pop" hidden={!ideaOpen}>{top}</div>
        <div className="ks-tabs" role="tablist" aria-label="Sections" ref={listRef} onKeyDown={onKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={'ks-tab-' + t.id}
              aria-selected={tab === t.id}
              aria-controls={'ks-panel-' + t.id}
              tabIndex={tab === t.id ? 0 : -1}
              className={`ks-tab ${tab === t.id ? 'on' : ''}`}
              onClick={() => select(t.id)}
            >
              <span className="ks-tab-ic" aria-hidden="true">{t.icon}</span>
              <span className="ks-tab-lb">{t.label}</span>
            </button>
          ))}
        </div>
      </header>
      <main className="ks-main">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={'ks-panel-' + t.id}
            aria-labelledby={'ks-tab-' + t.id}
            hidden={tab !== t.id}
            className="ks-panel"
          >
            {t.node}
          </div>
        ))}
      </main>
    </div>
  )
}
