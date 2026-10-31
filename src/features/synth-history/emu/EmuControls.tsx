// Faceplate controls: Knob (drag / wheel / arrow keys), Drawbar (vertical slider), Pick (stepped buttons).
import { useRef } from 'react'
import { useEffect, useState } from 'react'
import type { Ctl } from './types'
import { glowState, onGlow } from './bus'

const fmt = (c: Ctl, v: number) => {
  if (c.kind === 'pick') return c.opts?.[Math.round(v)] ?? String(v)
  const a = Math.abs(v)
  return a >= 100 ? String(Math.round(v)) : a >= 10 ? v.toFixed(1) : a >= 0.1 || a === 0 ? v.toFixed(2) : v.toFixed(3)
}
/** knob position 0..1, with an exponential feel for wide positive ranges (Hz, seconds) */
const toPos = (c: Ctl, v: number) => {
  const span = c.max - c.min
  if (c.min > 0 && c.max / c.min > 20) return Math.log(v / c.min) / Math.log(c.max / c.min)
  return span === 0 ? 0 : (v - c.min) / span
}
const fromPos = (c: Ctl, p: number) => {
  const q = Math.min(1, Math.max(0, p))
  let v = c.min > 0 && c.max / c.min > 20 ? c.min * Math.pow(c.max / c.min, q) : c.min + (c.max - c.min) * q
  if (c.step) v = Math.round(v / c.step) * c.step
  return Math.min(c.max, Math.max(c.min, v))
}

/** the key of the control the hardware touched in the last 0.7 s (it glows), else '' */
function useGlowKey() {
  const [k, setK] = useState('')
  useEffect(() => {
    let h = 0
    const on = () => { setK(glowState().key); clearTimeout(h); h = window.setTimeout(() => setK(''), 700) }
    const off = onGlow(on)
    return () => { off(); clearTimeout(h) }
  }, [])
  return k
}

export function Knob({ c, value, onChange, glow }: { c: Ctl; value: number; onChange: (v: number) => void; glow?: boolean }) {
  const drag = useRef<{ y: number; p: number } | null>(null)
  const pos = toPos(c, value)
  const angle = -135 + pos * 270
  return (
    <div className={'emu-ctl' + (glow ? ' glow' : '')}>
      <div
        className="emu-knob"
        role="slider" tabIndex={0} aria-label={c.label} aria-valuemin={c.min} aria-valuemax={c.max} aria-valuenow={value}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, p: pos } }}
        onPointerMove={(e) => { if (drag.current) onChange(fromPos(c, drag.current.p + (drag.current.y - e.clientY) / 140)) }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onWheel={(e) => { onChange(fromPos(c, pos - Math.sign(e.deltaY) * 0.04)) }}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0
          if (d) { e.preventDefault(); e.stopPropagation(); onChange(fromPos(c, pos + d)) }
        }}
        style={{ ['--ang' as string]: angle + 'deg' }}
      >
        <i />
      </div>
      <b>{c.label}</b>
      <small>{fmt(c, value)}</small>
    </div>
  )
}

export function Drawbar({ c, value, onChange, idx, glow }: { c: Ctl; value: number; onChange: (v: number) => void; idx: number; glow?: boolean }) {
  return (
    <div className={'emu-ctl emu-bar bar-' + (idx % 9) + (glow ? ' glow' : '')}>
      <input
        type="range" className="emu-vrange" min={c.min} max={c.max} step={c.step ?? 1} value={value} aria-label={c.label}
        onChange={(e) => onChange(+e.target.value)}
        onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}
      />
      <b>{c.label}</b>
      <small>{Math.round(value)}</small>
    </div>
  )
}

export function Pick({ c, value, onChange, glow }: { c: Ctl; value: number; onChange: (v: number) => void; glow?: boolean }) {
  return (
    <div className={'emu-ctl emu-pick' + (glow ? ' glow' : '')}>
      <b>{c.label}</b>
      <div role="radiogroup" aria-label={c.label}>
        {(c.opts ?? []).map((o, i) => (
          <button key={o} role="radio" aria-checked={Math.round(value) === i} className={Math.round(value) === i ? 'on' : ''} onClick={() => onChange(i)}>{o}</button>
        ))}
      </div>
    </div>
  )
}

export function ControlRow({ ctls, values, onChange }: { ctls: Ctl[]; values: Record<string, number>; onChange: (k: string, v: number) => void }) {
  // split into groups at each ctl that has a `group`
  const groups: { name: string; items: Ctl[] }[] = []
  for (const c of ctls) {
    if (c.group || !groups.length) groups.push({ name: c.group ?? '', items: [] })
    groups[groups.length - 1].items.push(c)
  }
  let bar = 0
  const glow = useGlowKey()
  return (
    <div className="emu-groups">
      {groups.map((g, gi) => (
        <div key={gi} className="emu-group">
          {g.name && <h4>{g.name}</h4>}
          <div className="emu-group-row">
            {g.items.map((c) =>
              c.kind === 'pick' ? <Pick key={c.key} glow={glow === c.key} c={c} value={values[c.key]} onChange={(v) => onChange(c.key, v)} />
              : c.kind === 'slider' ? <Drawbar key={c.key} glow={glow === c.key} c={c} idx={bar++} value={values[c.key]} onChange={(v) => onChange(c.key, v)} />
              : <Knob key={c.key} glow={glow === c.key} c={c} value={values[c.key]} onChange={(v) => onChange(c.key, v)} />,
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
