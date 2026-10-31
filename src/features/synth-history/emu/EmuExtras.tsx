// Special playing surfaces: the pitch field (theremin / ribbon), the TB-303 step sequencer, the Mellotron tape timer.
import { useEffect, useRef, useState } from 'react'
import { ROWS, type SeqApi, type Voice303 } from './tb303'
import type { Engine } from './core'
import { onNote } from '../../../music/notes'
import { onSeqChange } from './bus'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function FieldPad({ engine, range }: { engine: Engine; range: [number, number] }) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const r = el.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
    setPt({ x, y })
    void engine.unlock().then(() => engine.field(x, y))
  }
  const off = () => { setPt(null); engine.field(null) }
  useEffect(() => off, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [lo, hi] = range
  const marks: number[] = []
  for (let n = lo; n <= hi; n++) if (n % 12 === 0) marks.push(n)
  const note = pt ? Math.round(lo + pt.x * (hi - lo)) : null
  return (
    <div
      ref={el} className="emu-field" aria-label="Pitch field: left to right is pitch, bottom to top is loudness"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
      onPointerMove={(e) => { if (e.buttons || pt) move(e) }}
      onPointerUp={off} onPointerCancel={off} onPointerLeave={off}
    >
      {marks.map((n) => <span key={n} className="emu-fmark" style={{ left: ((n - lo) / (hi - lo)) * 100 + '%' }}>C{Math.floor(n / 12) - 1}</span>)}
      <em>{pt ? `${NAMES[note! % 12]}${Math.floor(note! / 12) - 1}` : 'Slide here: left-right = pitch, up-down = loudness'}</em>
      {pt && <i className="emu-fdot" style={{ left: pt.x * 100 + '%', bottom: pt.y * 100 + '%' }} />}
    </div>
  )
}

export function Seq303({ engine }: { engine: Engine }) {
  const v = engine.voice() as Voice303 | null
  const seq: SeqApi | undefined = v?.seq
  const [, tick] = useState(0)
  const [cur, setCur] = useState(-1)
  const [, setPlay] = useState(false)
  useEffect(() => {
    const s = engine.voice() as Voice303 | null
    return s?.seq.onStep(setCur)
  }, [engine, seq])
  useEffect(() => onSeqChange(() => tick((n) => n + 1)), []) // pads / buttons on the hardware edit the pattern
  useEffect(() => {
    if (seq) return
    const t = window.setInterval(() => { if (engine.voice()) tick((n) => n + 1) }, 250)
    return () => clearInterval(t)
  }, [engine, seq])
  if (!seq) {
    return <div className="emu-seq"><button className="emu-btn" onClick={() => { void engine.unlock().then(() => tick((n) => n + 1)) }}>Wake up the sequencer</button></div>
  }
  const re = () => tick((n) => n + 1)
  const toggleRow = (i: number, row: number) => {
    const s = seq.steps[i]
    if (s.on && ROWS[row] === s.deg) s.on = false
    else { s.on = true; s.deg = ROWS[row] }
    re()
  }
  return (
    <div className="emu-seq">
      <div className="emu-seq-top">
        <button className={'emu-btn big' + (seq.playing() ? ' on' : '')} onClick={() => { void engine.unlock().then(() => { if (seq.playing()) seq.stop(); else seq.start(); setPlay(seq.playing()); re() }) }}>
          {seq.playing() ? '■ Stop' : '▶ Play pattern'}
        </button>
        {seq.patterns.map((p, i) => <button key={p.name} className="emu-btn" onClick={() => { seq.load(i); re() }}>{p.name}</button>)}
        <button className="emu-btn" onClick={() => { seq.clear(); re() }}>Clear</button>
      </div>
      <div className="emu-grid">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className={'emu-col' + (cur === i ? ' now' : '') + (i % 4 === 0 ? ' beat' : '')}>
            {[...ROWS.keys()].reverse().map((r) => (
              <button key={r} aria-label={`step ${i + 1} row ${r}`} className={'emu-cell' + (seq.steps[i].on && seq.steps[i].deg === ROWS[r] ? ' on' : '')} onClick={() => toggleRow(i, r)} />
            ))}
            <button className={'emu-flag acc' + (seq.steps[i].accent ? ' on' : '')} title="Accent" onClick={() => { seq.steps[i].accent = !seq.steps[i].accent; re() }}>A</button>
            <button className={'emu-flag sl' + (seq.steps[i].slide ? ' on' : '')} title="Slide" onClick={() => { seq.steps[i].slide = !seq.steps[i].slide; re() }}>S</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mellotron: shows how much of the 8 second tape the held key has used. */
export function TapeBar() {
  const [held, setHeld] = useState<Record<number, number>>({})
  const [now, setNow] = useState(0)
  useEffect(() => {
    const off = onNote((e) => setHeld((h) => {
      const n = { ...h }
      if (e.on) n[e.note] = performance.now(); else delete n[e.note]
      return n
    }))
    return off
  }, [])
  useEffect(() => {
    if (!Object.keys(held).length) return
    const t = window.setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(t)
  }, [held])
  const ts = Object.values(held)
  const used = ts.length ? Math.min(1, (now - Math.min(...ts)) / 8000) : 0
  return (
    <div className="emu-tape" aria-label="Tape left on the longest held note">
      <span>TAPE</span>
      <div className="emu-reel"><i style={{ width: (1 - used) * 100 + '%' }} /></div>
      <span>{ts.length ? (used >= 1 ? 'Out of tape! Lift the key.' : `${Math.max(0, 8 - (now - Math.min(...ts)) / 1000).toFixed(1)} s left`) : '8 s per note'}</span>
    </div>
  )
}
