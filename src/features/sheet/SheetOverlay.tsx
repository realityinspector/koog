import { useEffect, useMemo, useRef, useState } from 'react'
import { setSheetOn, useScore, useSheet } from '../../music/scoreStore'
import { useScreen } from '../../layout/screenStore'
import { layoutSheet, VH } from './layout'
import { arrange } from '../../music/arrange'
import { SHEET_LEVELS, setSheetLevel, useSheetLevel } from '../../music/sheetLevel'
import type { Layout, Shape } from './layout'
import { useFree } from './freeplay'
import './sheet.css'

const NAMES_KEY = 'koog.sheet.names'
const loadNames = () => { try { return localStorage.getItem(NAMES_KEY) === '1' } catch { return false } }

function draw(s: Shape, k: number) {
  switch (s.k) {
    case 'e': {
      const rx = s.rx ?? 0.64
      const ry = rx === 0.64 ? 0.45 : rx * 0.7
      const rot = rx < 0.4 ? 0 : -20
      return s.open
        ? <ellipse key={k} cx={s.x} cy={s.y} rx={rx} ry={ry} transform={`rotate(${rot} ${s.x} ${s.y})`} fill="none" stroke="currentColor" strokeWidth={rx > 0.7 ? 0.24 : 0.2} />
        : <ellipse key={k} cx={s.x} cy={s.y} rx={rx} ry={ry} transform={`rotate(${rot} ${s.x} ${s.y})`} fill="currentColor" />
    }
    case 'l': return <line key={k} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="currentColor" strokeWidth={s.w} />
    case 'p': return <path key={k} d={s.d} fill={s.fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
    case 't': return <text key={k} x={s.x} y={s.y} fontSize={s.size} textAnchor="middle" fontWeight={700} fontFamily="Georgia, 'Times New Roman', serif" fill="currentColor">{s.s}</text>
  }
}

const LINES = [2.5, 3.5, 4.5, 5.5, 6.5, 8.5, 9.5, 10.5, 11.5, 12.5]
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const CLEF_FONT = "'Noto Music', 'Bravura', 'Apple Symbols', 'Segoe UI Symbol', 'Symbola', serif"

function Sheet({ lay, pos, results, free, title }: { lay: Layout; pos: number; results: Record<number, 'hit' | 'miss'>; free: boolean; title: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const scroll = useRef<SVGGElement>(null)
  const hl = useRef<SVGRectElement>(null)
  const [size, setSize] = useState({ w: 1000, h: 120 })
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1000, h: el.clientHeight || 120 }))
    ro.observe(el); setSize({ w: el.clientWidth || 1000, h: el.clientHeight || 120 })
    return () => ro.disconnect()
  }, [])
  const k = size.h / VH
  const W = size.w / k
  const focus = free ? W * 0.62 : W * 0.25
  const xs = lay.xs
  const px = free ? (xs.length ? xs[xs.length - 1] : lay.headerW) : pos >= xs.length ? lay.endX : xs[Math.max(0, pos)] ?? lay.headerW

  const cur = useRef(0)
  const target = useRef(0)
  const raf = useRef(0)
  target.current = focus - px
  useEffect(() => {
    const apply = () => scroll.current?.setAttribute('transform', `translate(${cur.current} 0)`)
    cancelAnimationFrame(raf.current)
    if (reduced()) { cur.current = target.current; apply(); return }
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const diff = target.current - cur.current
      if (Math.abs(diff) < 0.02) { cur.current = target.current; apply(); return }
      cur.current += diff * Math.min(1, dt * 9)
      apply(); raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [focus, px, lay])

  // hit/miss colours: toggle classes on the existing nodes, never re-render the staff
  useEffect(() => {
    const root = scroll.current; if (!root) return
    root.querySelectorAll<SVGGElement>('g[data-i]').forEach((g) => {
      const r = results[Number(g.dataset.i)]
      g.setAttribute('class', 'sh-g' + (g.dataset.lh ? ' lh' : '') + (r ? ' ' + r : ''))
    })
  }, [results, lay])
  useEffect(() => {
    const x = xs[pos]
    if (!hl.current) return
    if (free || x === undefined) hl.current.setAttribute('opacity', '0')
    else { hl.current.setAttribute('opacity', '1'); hl.current.setAttribute('x', String(x - 1.5)) }
  }, [pos, lay, free, xs])

  const body = useMemo(() => (
    <>
      {lay.bars.map((x, i) => <line key={'b' + i} x1={x} y1={2.5} x2={x} y2={12.5} stroke="currentColor" strokeWidth={0.12} />)}
      {lay.groups.map((g) => <g key={g.i} data-i={g.i} data-lh={g.lh ? '1' : undefined} className={'sh-g' + (g.lh ? ' lh' : '')}>{g.shapes.map(draw)}</g>)}
      {lay.marks.length > 0 && <g className="sh-chords">{lay.marks.map(draw)}</g>}
      {lay.names.map((n, i) => draw(n, i))}
    </>
  ), [lay])

  return (
    <div ref={wrap} className="sh-svgwrap" style={{ position: 'absolute', inset: 0 }}>
      <svg className="sh-svg" role="img" aria-label={`Sheet music: ${title}`} width={size.w} height={size.h}>
        <g transform={`scale(${k})`}>
          {LINES.map((y) => <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="currentColor" strokeWidth={0.1} />)}
          <defs><clipPath id="sh-clip"><rect x={lay.headerW} y={0} width={Math.max(0, W - lay.headerW)} height={VH} /></clipPath></defs>
          <g clipPath="url(#sh-clip)">
            {/* the next-note highlight scrolls WITH the notes, so it lives inside the scroll group */}
            <g ref={scroll}><rect ref={hl} x={0} y={1} width={3} height={13} rx={0.8} fill="#ffc83d" fillOpacity={0.4} opacity={0} />{body}</g>
            {!free && <line x1={focus} y1={1} x2={focus} y2={14} stroke="#b8860b" strokeWidth={0.08} strokeDasharray="0.3 0.3" opacity={0.6} />}
          </g>
          <g className="sh-head">
            <rect x={0} y={0} width={lay.headerW} height={VH} style={{ fill: 'var(--sh-paper)' }} />
            {LINES.map((y) => <line key={y} x1={0} y1={y} x2={lay.headerW} y2={y} stroke="currentColor" strokeWidth={0.1} />)}
            <line x1={0.5} y1={2.5} x2={0.5} y2={12.5} stroke="currentColor" strokeWidth={0.18} />
            <path d="M0.2 2.5 C-1.2 4 -1.2 5.2 -0.4 7.5 C0.2 9 0.2 11 0.2 12.5" transform="translate(1.8 0)" fill="none" stroke="currentColor" strokeWidth={0.28} />
            <text x={3.1} y={7.3} fontSize={10} textAnchor="middle" fill="currentColor" fontFamily={CLEF_FONT}>𝄞</text>
            <text x={3.1} y={11.4} fontSize={6.2} textAnchor="middle" fill="currentColor" fontFamily={CLEF_FONT}>𝄢</text>
            {lay.header.map(draw)}
          </g>
        </g>
      </svg>
    </div>
  )
}

/** Sheet music strip along the bottom of the display (grand staff). Nothing is rendered while it is off. */
export function SheetOverlay() {
  const on = useSheet((s) => s.on)
  const screen = useScreen((s) => s.screen)
  const score = useScore((s) => s.score)
  const pos = useScore((s) => s.pos)
  const results = useScore((s) => s.results)
  const groups = useFree((s) => s.groups)
  const [names, setNames] = useState(loadNames)
  const toggleNames = () => setNames((v) => { try { localStorage.setItem(NAMES_KEY, v ? '0' : '1') } catch { /* ignore */ } return !v })

  const level = useSheetLevel((s) => s.level)
  // The arrangement follows the sheet level: single = the tune, easy = + chord names and a root note, full = + a left-hand pattern.
  const arr = useMemo(() => (score && level !== 'single'
    ? arrange({ notes: score.notes, key: score.key, beatsPerBar: score.beatsPerBar, pickup: score.pickup, title: score.title, style: score.style, harmony: score.harmony }, level)
    : null), [score, level])
  const lay = useMemo(() => {
    if (score && arr) return layoutSheet(arr.rh.map((n) => ({ note: n.note, midis: n.midis, beats: n.beats })), arr.key, arr.bpb, { lh: arr.lh, marks: arr.marks, pickup: arr.pickup })
    if (score) return layoutSheet(score.notes.map((n) => ({ note: n.note, beats: n.beats })), score.key, score.beatsPerBar, undefined, score.pickup)
    return layoutSheet(groups.map((g) => ({ note: g.midis[0] ?? null, midis: g.midis, beats: g.beats })), undefined, 4)
  }, [score, groups, arr])
  // Only take space when there's something to read: a published piece, or free play on the PLAY screen.
  if (!on || (!score && screen !== 'play')) return null
  const free = !score
  return (
    <div className="sh-overlay" data-names={names ? '1' : undefined} data-level={arr ? level : 'single'} role="group" aria-label="Sheet music">
      <Sheet lay={names ? lay : { ...lay, names: [] }} pos={pos} results={results} free={free} title={score?.title ?? 'free play'} />
      {free && groups.length === 0 && <div className="sh-empty">Play something and we will write it down.</div>}
      <div className="sh-bar">
        <span className="sh-pill">{free ? 'free play: we are writing down what you play' : arr?.title ?? score.title}</span>
        <span className="sh-seg" role="group" aria-label="Sheet level">
          {SHEET_LEVELS.map((l) => (
            <button key={l.id} className={'sh-lv' + (level === l.id ? ' on' : '')} aria-pressed={level === l.id} title={l.label + ': ' + l.hint} aria-label={l.label} onClick={() => setSheetLevel(l.id)}>{l.icon}</button>
          ))}
        </span>
        <button className={'sh-btn' + (names ? ' on' : '')} aria-pressed={names} title="Show note names under the notes" onClick={toggleNames}>Aa</button>
        <button className="sh-btn" aria-label="Turn sheet music off" title="Hide the sheet music" onClick={() => { setSheetOn(false)}}>✕</button>
      </div>
    </div>
  )
}
