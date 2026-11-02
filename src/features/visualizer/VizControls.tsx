import { useEffect, useRef, useState } from 'react'
import { THEMES, type Mode, type Theme } from './engine'
import { useVibes } from '../../music/vibes'
import './vizcontrols.css'

export const VISUALS: { id: Mode; icon: string; label: string }[] = [
  { id: 'fireworks', icon: '🎆', label: 'Fireworks' },
  { id: 'ripples', icon: '💧', label: 'Ripples' },
  { id: 'rise', icon: '📊', label: 'Rising bars' },
  { id: 'fire', icon: '🔥', label: 'Fire' },
  { id: 'ghost', icon: '👻', label: 'Ghosts' },
  { id: 'mail', icon: '💌', label: 'Mail' },
  { id: 'confetti', icon: '🎉', label: 'Confetti' },
  { id: 'zombie', icon: '🧟', label: 'Zombies' },
  { id: 'vibes', icon: '😀', label: 'Vibes' },
]

const SWATCH: Record<Theme, string> = {
  rainbow: 'linear-gradient(135deg,#7a2bd6,#2b8fd6)',
  candy: 'linear-gradient(135deg,#d62b9a,#8a2bd6)',
  ocean: 'linear-gradient(135deg,#0b8fb0,#1f3fb0)',
  sunset: 'linear-gradient(135deg,#e8581f,#c2185b)',
  night: 'linear-gradient(135deg,#1a1f4a,#0a0a1c)',
  galaxy: 'linear-gradient(135deg,#6a2bd6,#d62b9a,#2bd6c4)',
}

interface Props {
  mode: Mode; onMode: (m: Mode) => void
  theme: Theme; onTheme: (t: Theme) => void
  emoji: boolean; onEmoji: (v: boolean) => void
  sparkle: boolean; onSparkle: (v: boolean) => void
  patchOpen: boolean; onPatch: () => void
  onFullscreen: () => void
}

export function VizControls(p: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const sceneBox = useRef<HTMLDivElement>(null)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [toast, setToast] = useState<{ n: number; icon: string; label: string } | null>(null)
  const cur = VISUALS.find((v) => v.id === p.mode) ?? VISUALS[0]
  const pick = (m: Mode) => {
    const v = VISUALS.find((x) => x.id === m)!
    p.onMode(m); setSceneOpen(false)
    setToast({ n: Date.now(), icon: v.icon, label: v.label })
  }
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1500)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!sceneOpen) return
    const away = (e: PointerEvent) => { if (!sceneBox.current?.contains(e.target as Node)) setSceneOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSceneOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [sceneOpen])
  const chip = useVibes((s) => s.chip)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="viz-bar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="vb-scene" ref={sceneBox}>
        <button className={'vb-chip vb-visual' + (sceneOpen ? ' open' : '')} aria-expanded={sceneOpen} aria-haspopup="dialog" title="Pick a picture for your music"
          onClick={() => { setSceneOpen((o) => !o); setOpen(false) }}>
          <span aria-hidden>{cur.icon}</span><span className="vb-lab">VISUAL</span><span className="vb-cur">{cur.label}</span><span aria-hidden>▾</span>
        </button>
        {sceneOpen && (
          <div className="vb-pop vb-scenes" role="dialog" aria-label="Pick a visual">
            <div className="vb-poph">Pick a visual</div>
            <div className="vb-grid">
              {VISUALS.map((v) => (
                <button key={v.id} className={'vb-tile' + (v.id === p.mode ? ' on' : '')} aria-pressed={v.id === p.mode} onClick={() => pick(v.id)}>
                  <span className="vb-ti" aria-hidden>{v.icon}</span><span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {toast && <div className="vb-toast" key={toast.n} role="status">{toast.icon} {toast.label}</div>}
      </div>
      <div className="vb-style" ref={box}>
        <button className={'vb-chip vb-icon' + (open ? ' on' : '')} title="Style" aria-label="Style" aria-expanded={open} onClick={() => { setOpen((o) => !o); setSceneOpen(false) }}>🎨</button>
        {open && (
          <div className="vb-pop" role="dialog" aria-label="Style">
            <div className="vb-poph">Background</div>
            <div className="vb-themes">
              {THEMES.map((t) => (
                <button key={t.id} className={'vb-theme' + (t.id === p.theme ? ' on' : '')} aria-pressed={t.id === p.theme} onClick={() => p.onTheme(t.id)}>
                  <span className="vb-sw" style={{ background: SWATCH[t.id] }} />{t.label}
                </button>
              ))}
            </div>
            <div className="vb-toggles">
              <button className={'vb-tog' + (p.emoji ? ' on' : '')} aria-pressed={p.emoji} onClick={() => p.onEmoji(!p.emoji)}>Emoji 😜</button>
              <button className={'vb-tog' + (p.sparkle ? ' on' : '')} aria-pressed={p.sparkle} onClick={() => p.onSparkle(!p.sparkle)}>Sparkles ✨</button>
              <button className={'vb-tog' + (chip ? ' on' : '')} aria-pressed={chip} onClick={() => useVibes.getState().setChip(!chip)}>Mood 😀</button>
            </div>
          </div>
        )}
      </div>
      <button className={'vb-chip vb-patch' + (p.patchOpen ? ' on' : '')} onClick={p.onPatch} aria-expanded={p.patchOpen}>🎛️ Patch</button>
      <button className="vb-chip vb-icon" title="Fullscreen" aria-label="Fullscreen" onClick={p.onFullscreen}>⛶</button>
    </div>
  )
}
