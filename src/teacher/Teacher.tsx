import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, SCREEN, CABLE_D, ANCHORS } from './Stage'
import { GITHUB_URL, isWebDemo } from '../web/webDemo'
import { PC_NAMES } from '../music/theory'
import { Icon } from '../ui/Icon'

type Lit = 'in' | 'out' | 'tonic'
interface LastNote { note: number; name: string; velocity: number }
interface Harm { keyName: string; chord: string | null; accuracy: number; streak: number }
type Concept = 'notes' | 'keys' | 'chords' | 'scales' | 'spicy'
const CONCEPTS: [Concept, string][] = [['notes', 'Notes'], ['keys', 'Keys'], ['chords', 'Chords'], ['scales', 'Scales'], ['spicy', 'Spicy notes']]

const W = 1600, H = 900
const FRAME_W = 1280, FRAME_H = 800
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Where each callout card sits (viewBox units) and which edge point its leader line starts from.
const CARDS = {
  1: { x: 40, y: 330, w: 540 },
  2: { x: 690, y: 800, w: 400 },
  3: { x: 1110, y: 800, w: 450 },
  4: { x: 40, y: 40, w: 600 },
} as const
// The "press these keys" strip under the laptop: the bottom letter row plays C D E F G A B C (octave 3).
const STRIP = { x: 820, y: 706, w: 680, h: 76 }
const CAPS: [string, string, number][] = [['Z', 'C', 48], ['X', 'D', 50], ['C', 'E', 52], ['V', 'F', 53], ['B', 'G', 55], ['N', 'A', 57], ['M', 'B', 59], [',', 'C', 60]]

const isFull = () => !!document.fullscreenElement

export function Teacher() {
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [lit, setLit] = useState<Lit | null>(null)
  const [last, setLast] = useState<LastNote | null>(null)
  const [harm, setHarm] = useState<Harm>({ keyName: 'C major', chord: null, accuracy: 1, streak: 0 })
  const [seen, setSeen] = useState<ReadonlySet<Concept>>(new Set())
  const [dots, setDots] = useState<number[]>([])
  const [pulse, setPulse] = useState(false)
  const [intro, setIntro] = useState(true)
  const [full, setFull] = useState(isFull)
  const [u, setU] = useState(0.6) // px per viewBox unit
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const lastDot = useRef(0)
  const dotId = useRef(0)
  const lastJ = useRef<Lit | null>(null)

  const see = useCallback((c: Concept) => setSeen((s) => (s.has(c) ? s : new Set(s).add(c))), [])

  useEffect(() => {
    const on = () => setFull(isFull())
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toFrame = (msg: unknown) => frame.current?.contentWindow?.postMessage(msg, location.origin)
  const toggleFull = () => { if (isFull()) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => {}) }
  const start = (fs: boolean) => {
    setIntro(false)
    toFrame({ type: 'koog:unlock' }) // this click counts as the "turn on sound" gesture
    if (fs && !isFull()) void document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const playKey = useCallback((note: number, on: boolean) => toFrame({ type: 'koog:play', note, on, velocity: 96 }), [])

  // contain-fit 16:9 stage
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => setU(el.clientWidth / W))
    ro.observe(el); setU(el.clientWidth / W)
    return () => ro.disconnect()
  }, [])

  // messages from the embedded Koog
  useEffect(() => {
    const fire = () => {
      const now = performance.now()
      if (now - lastDot.current < 340) return
      lastDot.current = now
      setPulse(true); setTimeout(() => setPulse(false), 500)
      if (reduced) return
      const id = ++dotId.current
      setDots((d) => [...d, id])
      setTimeout(() => setDots((d) => d.filter((x) => x !== id)), 500)
    }
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data
      if (!d || typeof d.type !== 'string') return
      if (d.type === 'koog:note') {
        setHeld((h) => { const n = new Set(h); if (d.on) n.add(d.note); else n.delete(d.note); return n })
        if (d.on) {
          setLast({ note: d.note, name: d.name, velocity: d.velocity })
          const j = d.judgement as Lit | null
          lastJ.current = j; setLit(j)
          see('notes')
          if (j === 'out') see('spicy'); else if (j) see('keys')
          fire()
        }
      } else if (d.type === 'koog:harmony') {
        setHarm({ keyName: d.keyName, chord: d.chord, accuracy: d.accuracy, streak: d.streak })
        if (d.chord) see('chords')
        if (d.streak >= 8) see('scales')
      }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [see])

  // forward computer keys typed on the outer page into the iframe
  useEffect(() => {
    const fwd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const w = frame.current?.contentWindow; if (!w) return
      w.postMessage({ type: 'koog:key', kind: e.type, code: e.code, key: e.key, repeat: e.repeat }, location.origin)
      e.preventDefault()
    }
    window.addEventListener('keydown', fwd); window.addEventListener('keyup', fwd)
    return () => { window.removeEventListener('keydown', fwd); window.removeEventListener('keyup', fwd) }
  }, [])

  // lessons
  const lessons = useMemo(() => {
    const out: { h: string; t: string }[] = []
    const heldNames = [...held].sort((a, b) => a - b).map((n) => PC_NAMES[n % 12])
    const keyRoot = harm.keyName.split(' ')[0]
    if (harm.chord && held.size >= 3) out.push({ h: 'Chords', t: `${[...new Set(heldNames)].join(', ')} together make ${harm.chord}.` })
    if (last && lastJ.current === 'out') out.push({ h: 'Spicy notes', t: `${PC_NAMES[last.note % 12]} is outside ${harm.keyName}. It adds tension.` })
    else if (last && lastJ.current === 'tonic') out.push({ h: 'Home note', t: `${keyRoot} is home in ${harm.keyName}.` })
    if (harm.streak >= 8) out.push({ h: 'Scales', t: `Staying inside the key of ${harm.keyName}. Streak ${harm.streak}.` })
    return out.slice(0, 2)
  }, [held, last, harm])

  const px = (n: number) => `${(n / W) * 100}%`
  const py = (n: number) => `${(n / H) * 100}%`
  const vel = last?.velocity ?? 0
  const acc = Math.round(harm.accuracy * 100)

  // leader lines: from card edge midpoint to the anchor
  const lead = (c: { x: number; y: number; w: number }, hApprox: number, a: { x: number; y: number }) => {
    const sx = Math.min(Math.max(a.x, c.x), c.x + c.w), sy = a.y < c.y ? c.y : a.y > c.y + hApprox ? c.y + hApprox : c.y + hApprox / 2
    return <g key={`${c.x}-${c.y}`}><line x1={sx} y1={sy} x2={a.x} y2={a.y} className="t-lead" /><circle cx={a.x} cy={a.y} r="7" className="t-lead-dot" /></g>
  }

  return (
    <div className="t-page">
      <header className="t-bar">
        <div className="t-brand"><b>KOOG</b><span>Teacher demo</span></div>
        <div className="t-hint">Press <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd>… on the computer keyboard, or click the keys on the red keyboard{isWebDemo() ? '' : ' (or play a USB keyboard)'}</div>
        <nav className="t-links">
          <button type="button" className="t-link" onClick={() => setIntro(true)}>How it works</button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">GitHub</a>
          <a href="../">Home</a>
          <button type="button" className="t-full" onClick={toggleFull}><Icon name={full ? 'close' : 'expand'} size={16} />{full ? 'Exit full screen' : 'Full screen'}</button>
        </nav>
      </header>
      <main className="t-main">
        <div className="t-fit">
          <div className="t-stage" ref={wrap} style={{ ['--u' as string]: `${u}px` }}
            onPointerDown={() => frame.current?.focus()}>
            <Stage held={held} lit={lit} onKey={playKey}>
              <path id="koog-cable" d={CABLE_D} fill="none" stroke="none" />
              {lead(CARDS[1], 110, ANCHORS.keys)}
              {lead(CARDS[2], 110, ANCHORS.cable)}
              {lead(CARDS[3], 110, { x: SCREEN.x + SCREEN.w - 20, y: SCREEN.y + SCREEN.h })}
              {lead(CARDS[4], 260, ANCHORS.student)}
              {dots.map((id) => (
                <circle key={id} r="11" className="t-dot">
                  <animateMotion dur="0.35s" fill="freeze" begin="0s"><mpath href="#koog-cable" /></animateMotion>
                </circle>
              ))}
            </Stage>
            <iframe ref={frame} className="t-frame" title="Koog, live" src="../?embed&play" allow="autoplay; midi"
              style={{ left: px(SCREEN.x), top: py(SCREEN.y), width: FRAME_W, height: FRAME_H,
                transform: `scale(${(SCREEN.w * u) / FRAME_W})` }} />
            <div className="t-keys" style={{ left: px(STRIP.x), top: py(STRIP.y), width: px(STRIP.w), height: py(STRIP.h) }}>
              <p><b>Try it!</b> Press these keys</p>
              <div className="t-caps">{CAPS.map(([k, n, note]) => <span key={k} className={held.has(note) ? 'on' : ''}><b>{k}</b><em>{n}</em></span>)}</div>
            </div>

            <div className="t-card" style={{ left: px(CARDS[1].x), top: py(CARDS[1].y), width: px(CARDS[1].w) }}>
              <i>1</i><h3>Student presses a key</h3>
              <p>{last ? <>{last.name} · how hard: {vel}</> : 'Waiting for a key…'}</p>
              <div className="t-bar-v"><span style={{ width: `${Math.round((vel / 127) * 100)}%` }} /></div>
            </div>
            <div className={'t-card' + (pulse ? ' hot' : '')} style={{ left: px(CARDS[2].x), top: py(CARDS[2].y), width: px(CARDS[2].w) }}>
              <i>2</i><h3>The cable carries a MIDI message</h3>
              <p>{last ? `Note On ${last.note} · velocity ${vel}` : 'No message yet'}</p>
            </div>
            <div className="t-card" style={{ left: px(CARDS[3].x), top: py(CARDS[3].y), width: px(CARDS[3].w) }}>
              <i>3</i><h3>Koog listens and responds</h3>
              <p>Key: {harm.keyName} · Chord: {harm.chord ?? 'none'} · {acc}% in key</p>
            </div>
            <div className="t-card t-learn" style={{ left: px(CARDS[4].x), top: py(CARDS[4].y), width: px(CARDS[4].w) }}>
              <i>4</i><h3>What the student is learning</h3>
              {lessons.length ? lessons.map((l) => <p key={l.h}><b>{l.h}:</b> {l.t}</p>) : <p className="idle">Press a few keys to start.</p>}
              <div className="t-chips">{CONCEPTS.map(([c, label]) => <span key={c} className={seen.has(c) ? 'on' : ''}>{label}</span>)}</div>
            </div>
            {intro && (
              <div className="t-intro" role="dialog" aria-label="How the teacher demo works">
                <div className="t-intro-card">
                  <h2>Teacher demo</h2>
                  <p>A student plays a small keyboard plugged into a laptop. The laptop screen is the real Koog, running live.</p>
                  <ol>
                    <li><b>Press keys on the computer keyboard.</b> <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd> <kbd>B</kbd> <kbd>N</kbd> <kbd>M</kbd> play C D E F G A B. Try <kbd>Z</kbd> <kbd>C</kbd> <kbd>B</kbd> together for a chord.</li>
                    <li><b>Or click the white and black keys</b> on the red keyboard in the drawing.</li>
                    <li><b>Watch the numbered labels.</b> They show what just happened, and what the student is learning.</li>
                  </ol>
                  <div className="t-intro-go">
                    <button type="button" className="t-go" autoFocus onClick={() => start(true)}><Icon name="expand" size={18} /> Start full screen</button>
                    <button type="button" className="t-go2" onClick={() => start(false)}>Start in this window</button>
                  </div>
                  <p className="t-intro-small">Best on a projector. Press Esc to leave full screen.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
