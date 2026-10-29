import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, type NoteEvent } from '../../store/appStore'
import { useHarmonyStore, judge } from '../../music/harmonyStore'
import { onNote } from '../../music/notes'
import { playLocal } from '../../music/localNotes'
import { buildLayout, noteHue, snapRange, type KeyShape } from './layout'
import './keyboard.css'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Clicked keys go through the shared local-note path: shared ids + they make sound.
const push = (ev: { note: number; velocity: number; on: boolean }) => playLocal(ev.note, ev.velocity, ev.on)

function loadRange(): [number, number] {
  try {
    const r = JSON.parse(localStorage.getItem('koog.kb.range') || 'null')
    if (Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1])) return snapRange(Math.min(r[0], 48), Math.max(r[1], 84))
  } catch { /* ignore */ }
  return [48, 84]
}
function loadNames(): boolean {
  try { return localStorage.getItem('koog.kb.names') === '1' } catch { return false }
}

interface KeyProps {
  k: KeyShape
  held: boolean
  flash: boolean
  status: 'tonic' | 'in' | 'out'
  showName: boolean
  down: (n: number, e: React.PointerEvent) => void
  up: (n: number) => void
}

const Key = memo(function Key({ k, held, flash, status, showName, down, up }: KeyProps) {
  const style = {
    left: k.left + '%',
    width: k.width + '%',
    ...(held ? { '--h': noteHue(k.note) } : {}),
  } as React.CSSProperties
  const cls = 'kb-key ' + (k.black ? 'black' : 'white') + (held ? ' held' : '') + (flash ? ' spicy' : '')
  const label = k.black ? null : k.label && (showName || k.label.length > 1) ? k.label : null
  return (
    <div
      className={cls}
      style={style}
      onPointerDown={(e) => down(k.note, e)}
      onPointerUp={() => up(k.note)}
      onPointerLeave={() => up(k.note)}
      onPointerCancel={() => up(k.note)}
    >
      {status === 'tonic' ? <span className="kb-home">🏠</span> : status === 'in' ? <span className="kb-dot" /> : null}
      {label && <span className="kb-label">{label}</span>}
    </div>
  )
})

export function PianoStrip() {
  const [range, setRange] = useState<[number, number]>(loadRange)
  const [names, setNames] = useState(loadNames)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [flash, setFlash] = useState<ReadonlySet<number>>(new Set())
  const key = useHarmonyStore((s) => s.key)
  const chord = useHarmonyStore((s) => s.chord)
  const lastFlash = useRef(0)
  const timers = useRef<number[]>([])
  const ptr = useRef(new Map<number, number>()) // pointerId -> note
  const [shownChord, setShownChord] = useState<string | null>(chord)

  useEffect(() => {
    if (chord) { setShownChord(chord); return }
    const t = window.setTimeout(() => setShownChord(null), 500)
    return () => window.clearTimeout(t)
  }, [chord])

  const layout = useMemo(() => buildLayout(range[0], range[1]), [range])
  const status = useMemo(() => layout.map((k) => judge(k.note)), [layout, key])

  useEffect(() => {
    const off = onNote((e) => {
      if (e.on) {
        setHeld((h) => (h.has(e.note) ? h : new Set(h).add(e.note)))
        setRange((r) => {
          if (e.note >= r[0] && e.note <= r[1]) return r
          const nr = snapRange(Math.min(r[0], e.note), Math.max(r[1], e.note))
          try { localStorage.setItem('koog.kb.range', JSON.stringify(nr)) } catch { /* ignore */ }
          return nr
        })
        const now = performance.now()
        if (judge(e.note) === 'out' && now - lastFlash.current >= 334) {
          lastFlash.current = now
          setFlash((f) => new Set(f).add(e.note))
          const t = window.setTimeout(() => setFlash((f) => { const n = new Set(f); n.delete(e.note); return n }), 450)
          timers.current.push(t)
        }
      } else {
        setHeld((h) => { if (!h.has(e.note)) return h; const n = new Set(h); n.delete(e.note); return n })
      }
    })
    const ts = timers.current
    return () => { off(); ts.forEach(clearTimeout) }
  }, [])

  const down = useCallback((note: number, e: React.PointerEvent) => {
    e.preventDefault()
    ptr.current.set(e.pointerId, note)
    push({ note, velocity: 90, on: true })
  }, [])
  const up = useCallback((note: number) => {
    for (const [id, n] of ptr.current) {
      if (n === note) { ptr.current.delete(id); push({ note, velocity: 0, on: false }) }
    }
  }, [])

  const toggleNames = () => {
    setNames((v) => {
      try { localStorage.setItem('koog.kb.names', v ? '0' : '1') } catch { /* ignore */ }
      return !v
    })
  }

  return (
    <section className="kb">
      <div className="kb-top">
        <div className={'kb-chord' + (chord ? ' on' : '')} aria-live="polite">{shownChord ?? ' '}</div>
        <label className="kb-toggle">
          <input type="checkbox" checked={names} onChange={toggleNames} /> Show note names
        </label>
      </div>
      <div className="kb-strip">
        {layout.map((k, i) => (
          <Key key={k.note} k={k} held={held.has(k.note)} flash={flash.has(k.note)} status={status[i]} showName={names} down={down} up={up} />
        ))}
      </div>
    </section>
  )
}
