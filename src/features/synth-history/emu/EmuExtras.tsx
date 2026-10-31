// Special playing surfaces: the pitch field (theremin / ribbon), the TB-303 step sequencer, the Mellotron tape timer.
import { useEffect, useRef, useState } from 'react'
import { ROWS, type SeqApi, type Voice303 } from './tb303'
import type { Engine } from './core'
import { onNote } from '../../../music/notes'
import { onSeqChange } from './bus'
import type { Params } from './types'

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
      <div className="emu-ledrow" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} className={(cur === i && seq.playing() ? 'on ' : '') + (i % 4 === 0 ? 'beat' : '')} />)}</div>
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
      <div className={'emu-tapewin' + (ts.length ? ' run' : '')}><b className="spool" /><u className="strip" /><b className="spool r" /></div>
      <div className="emu-reel"><i style={{ width: (1 - used) * 100 + '%' }} /></div>
      <span>{ts.length ? (used >= 1 ? 'Out of tape! Lift the key.' : `${Math.max(0, 8 - (now - Math.min(...ts)) / 1000).toFixed(1)} s left`) : '8 s per note'}</span>
    </div>
  )
}

/** Tiny oscilloscope fed by the engine's analyser (read-only). Draws only while the tab is visible; flat line in reduced motion is fine too. */
export function Scope({ engine }: { engine: Engine }) {
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = cv.current; if (!c) return
    const g = c.getContext('2d'); if (!g) return
    const buf = new Float32Array(1024)
    let raf = 0, last = 0
    const ac = getComputedStyle(c).getPropertyValue('--scope') || '#7fffc0'
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 33) return
      last = t
      const w = c.width, h = c.height
      g.clearRect(0, 0, w, h)
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke()
      const ok = engine.wave(buf)
      // trigger on a rising zero crossing so the picture holds still
      let s = 0
      if (ok) for (let i = 1; i < 512; i++) if (buf[i - 1] < 0 && buf[i] >= 0) { s = i; break }
      g.strokeStyle = ac.trim() || '#7fffc0'; g.lineWidth = 1.6; g.shadowColor = g.strokeStyle; g.shadowBlur = 5
      g.beginPath()
      for (let x = 0; x < w; x++) {
        const v = ok ? buf[s + Math.floor((x / w) * 512)] : 0
        const y = h / 2 - Math.max(-1, Math.min(1, v * 3.5)) * (h / 2 - 2)
        if (x) g.lineTo(x, y); else g.moveTo(x, y)
      }
      g.stroke(); g.shadowBlur = 0
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [engine])
  return <canvas ref={cv} className="emu-scope" width={132} height={36} aria-label="Live waveform" role="img" />
}

/** Key-press LEDs: a thin strip of dots, one per key from C2 to C7, lit while that note is held. */
export function KeyLeds() {
  const LO = 36, HI = 96
  const [on, setOn] = useState<Set<number>>(() => new Set())
  useEffect(() => onNote((e) => setOn((s) => { const n = new Set(s); if (e.on) n.add(e.note); else n.delete(e.note); return n })), [])
  return (
    <div className="emu-keyleds" aria-hidden="true">
      {Array.from({ length: HI - LO + 1 }, (_, i) => <i key={i} className={(on.has(LO + i) ? 'on ' : '') + ([1, 3, 6, 8, 10].includes((LO + i) % 12) ? 'blk' : '')} />)}
    </div>
  )
}

/** Hammond: the rotary speaker cabinet, its horn and drum visibly spinning at the chosen speed. */
export function Rotary({ speed }: { speed: number }) {
  const s = Math.round(speed)
  return (
    <div className={'emu-rotary sp' + s} aria-label={'Rotary speaker ' + ['off', 'slow', 'fast'][s]}>
      <div className="cab"><div className="horn"><i /><i /></div><div className="drum"><i /><i /></div></div>
      <small>{['Still', 'Chorale', 'Tremolo'][s]}</small>
    </div>
  )
}

/** ARP-style patch bay: the three mod destinations as jacks with a drawn cable when the amount is above zero. */
export function PatchBay({ vals }: { vals: Params }) {
  const dest = [['cPitch', 'Pitch', '#ff5a3a'], ['cFilt', 'Filter', '#ffd23a'], ['cAmp', 'Loud', '#4ad0ff']] as const
  return (
    <svg className="emu-patch" viewBox="0 0 300 64" aria-label="Patch cables">
      <rect x="1" y="1" width="298" height="62" rx="6" className="pb-bg" />
      <circle cx="26" cy="20" r="9" className="jack src" /><circle cx="26" cy="20" r="4" className="hole" />
      <text x="26" y="52" className="pb-t">MOD OUT</text>
      {dest.map(([k, name, col], i) => {
        const x = 110 + i * 70, amt = vals[k] ?? 0
        return (
          <g key={k}>
            <circle cx={x} cy="20" r="9" className="jack" /><circle cx={x} cy="20" r="4" className="hole" />
            <text x={x} y="52" className="pb-t">{name}</text>
            {amt > 0.01 && (
              <g>
                <path d={`M26 20 C ${40 + i * 6} ${60 + i * 2}, ${x - 30} ${60 + i * 2}, ${x} 20`} fill="none" stroke={col} strokeWidth={2 + amt * 3} strokeLinecap="round" opacity=".9" />
                <circle cx={x} cy="20" r="6" fill={col} /><circle cx={26} cy="20" r="6" fill={col} />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** DX-style LCD: algorithm and operator values as a small green-on-black readout with a block diagram. */
export function Lcd({ vals, ratios }: { vals: Params; ratios: number[] }) {
  const alg = Math.round(vals.alg ?? 0)
  const ops = [1, ratios[Math.round(vals.r2 ?? 1)], ratios[Math.round(vals.r3 ?? 1)], ratios[Math.round(vals.r4 ?? 1)]]
  const box = (x: number, y: number, n: number, car: boolean) => <g key={n}><rect x={x} y={y} width="22" height="14" className={car ? 'lcd-car' : 'lcd-mod'} /><text x={x + 11} y={y + 10.5} className="lcd-n">{n}</text></g>
  const lines = alg === 0 ? [[4, 3], [3, 2], [2, 1]] : alg === 1 ? [[2, 1], [4, 3]] : [[2, 1], [3, 1], [4, 1]]
  const pos: Record<number, [number, number]> = alg === 0 ? { 4: [4, 2], 3: [30, 2], 2: [56, 2], 1: [82, 2] } : alg === 1 ? { 2: [4, 2], 1: [30, 2], 4: [56, 2], 3: [82, 2] } : { 2: [4, 2], 3: [30, 2], 4: [56, 2], 1: [82, 2] }
  return (
    <div className="emu-lcd" aria-label="Algorithm display">
      <div className="lcd-row"><span>ALG {alg + 1}</span><span>{['STACK', 'PAIRS', 'TRIPLE'][alg]}</span></div>
      <svg viewBox="0 0 108 20" className="lcd-svg">
        {lines.map(([a, b]) => <line key={a + '-' + b} x1={pos[a][0] + 22} y1="9" x2={pos[b][0]} y2="9" className="lcd-l" />)}
        {[1, 2, 3, 4].map((n) => box(pos[n][0], pos[n][1], n, alg === 0 ? n === 1 : alg === 1 ? n === 1 || n === 3 : n === 1))}
      </svg>
      <div className="lcd-row"><span>R {ops.map((o) => o).join(' ')}</span><span>MD {(vals.depth ?? 0).toFixed(1)}</span></div>
    </div>
  )
}
