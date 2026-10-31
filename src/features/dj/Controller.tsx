import { useRef, useSyncExternalStore } from 'react'
import { dispatch, getVersion, getView, subscribe } from './engine'
import { keyFor, type CtrlBase } from './map'
import { labelOf } from './calibrate'

// A drawn Mixtrack-style controller (no logos): two jog wheels, transport buttons, pads, EQ knobs, faders, crossfader.
// Used by the teach screen (highlights the control being learned) and the knob check (every control animates live; clickable too).
type Shape = { k: 'btn' | 'pad' | 'jog' | 'vfader' | 'hfader' | 'knob'; x: number; y: number; w?: number; h?: number; r?: number; text: string }
const mirror = (x: number) => 640 - x
function layout(): Record<string, Shape> {
  const L: Record<string, Shape> = {}
  const deck = (d: 'A' | 'B') => {
    const f = d === 'A' ? (x: number) => x : mirror
    const put = (base: string, s: Shape) => { L[`${base}.${d}`] = { ...s, x: f(s.x) } }
    put('padmode', { k: 'btn', x: 44, y: 25, w: 44, h: 22, text: 'MODE' })
    ;[100, 140, 180, 220].forEach((x, i) => put(`pad${i + 1}`, { k: 'pad', x, y: 25, w: 34, h: 22, text: String(i + 1) }))
    put('jog', { k: 'jog', x: 130, y: 128, r: 58, text: d })
    put('jogtouch', { k: 'jog', x: 130, y: 128, r: 66, text: '' })
    put('tempo', { k: 'vfader', x: 34, y: 140, h: 140, text: 'TEMPO' })
    put('play', { k: 'btn', x: 70, y: 258, w: 44, h: 26, text: '▶' })
    put('cue', { k: 'btn', x: 130, y: 258, w: 44, h: 26, text: 'CUE' })
    put('sync', { k: 'btn', x: 190, y: 258, w: 44, h: 26, text: 'SYNC' })
    put('vol', { k: 'vfader', x: 236, y: 140, h: 150, text: 'VOL' })
    put('hi', { k: 'knob', x: 281, y: 62, r: 15, text: 'HI' })
    put('mid', { k: 'knob', x: 281, y: 112, r: 15, text: 'MID' })
    put('low', { k: 'knob', x: 281, y: 162, r: 15, text: 'LOW' })
  }
  deck('A'); deck('B')
  L.xfade = { k: 'hfader', x: 320, y: 252, w: 90, text: 'XFADE' }
  L.cuegain = { k: 'knob', x: 320, y: 112, r: 11, text: 'PHONES' }
  return L
}
const LAYOUT = layout()

interface Props {
  ctl: Record<string, { v: number; n: number }>
  target?: string | null
  interactive?: boolean
  showTested?: boolean
  noQ?: boolean
}
function valueOf(id: string, ctl: Props['ctl'], v: ReturnType<typeof getView>): number {
  if (ctl[id]) return ctl[id].v
  const [base, d] = id.split('.')
  if (base === 'xfade') return v.xf
  const dv = d === 'A' || d === 'B' ? v[d] : null
  if (!dv) return 0.5
  if (base === 'vol' || base === 'tempo' || base === 'hi' || base === 'mid' || base === 'low') return dv[base]
  if (base === 'play') return dv.playing && !dv.preview ? 1 : 0
  return 0
}

export function ControllerPic({ ctl, target, interactive, showTested, noQ }: Props) {
  useSyncExternalStore(subscribe, getVersion)
  const view = getView()
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; y0: number; v0: number; a0?: number } | null>(null)
  const send = (id: string, value: number) => {
    const [base, d] = id.split('.')
    dispatch({ id: base as CtrlBase, deck: d === 'A' || d === 'B' ? d : null, value })
  }
  const pt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 640, y: ((e.clientY - r.top) / r.height) * 290 }
  }
  const ids = Object.keys(LAYOUT)
  return (
    <svg ref={svg} className={'dj-pic' + (interactive ? ' live' : '')} viewBox="0 0 640 290" role="img" aria-label="A drawn DJ controller"
      onPointerMove={(e) => {
        const dr = drag.current
        if (!dr) return
        const s = LAYOUT[dr.id], p = pt(e)
        if (s.k === 'vfader') send(dr.id, Math.max(0, Math.min(1, 0.5 - (p.y - s.y) / (s.h ?? 100))))
        else if (s.k === 'hfader') send(dr.id, Math.max(0, Math.min(1, 0.5 + (p.x - s.x) / (s.w ?? 80))))
        else if (s.k === 'knob') send(dr.id, Math.max(0, Math.min(1, dr.v0 + (dr.y0 - p.y) / 90)))
        else if (s.k === 'jog') {
          const a = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI
          let d = a - (dr.a0 ?? a); if (d > 180) d -= 360; if (d < -180) d += 360
          if (Math.abs(d) >= 4) { dr.a0 = a; send(dr.id, d / 4) }
        }
      }}
      onPointerUp={() => { const dr = drag.current; if (dr && LAYOUT[dr.id].k !== 'vfader' && (LAYOUT[dr.id].k === 'btn' || LAYOUT[dr.id].k === 'pad')) send(dr.id, 0); drag.current = null }}
      onPointerLeave={() => { const dr = drag.current; if (dr && (LAYOUT[dr.id].k === 'btn' || LAYOUT[dr.id].k === 'pad')) send(dr.id, 0); drag.current = null }}>
      <rect x="4" y="4" width="632" height="282" rx="22" className="pic-body" />
      <text x="320" y="196" className="pic-lbl big" textAnchor="middle">DJ</text>
      {ids.map((id) => {
        if (id.startsWith('jogtouch')) return null
        const s = LAYOUT[id]
        const mapped = !!keyFor(id)
        const c = ctl[id]
        const tested = !!c
        const val = valueOf(id, ctl, view)
        const hot = target === id
        const cls = 'pic-c ' + s.k + (mapped ? '' : ' unmapped') + (tested && showTested ? ' tested' : '') + (showTested && !noQ && mapped && !tested ? ' untested' : '') + (hot ? ' target' : '')
        const down = (e: React.PointerEvent) => {
          if (!interactive) return
          e.preventDefault()
          const p = pt(e)
          drag.current = { id, y0: p.y, v0: val }
          if (s.k === 'btn' || s.k === 'pad') send(id, 1)
          else if (s.k === 'vfader') send(id, Math.max(0, Math.min(1, 0.5 - (p.y - s.y) / (s.h ?? 100))))
          else if (s.k === 'hfader') send(id, Math.max(0, Math.min(1, 0.5 + (p.x - s.x) / (s.w ?? 80))))
          else if (s.k === 'jog') drag.current.a0 = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI
        }
        let shape: React.ReactNode
        if (s.k === 'btn' || s.k === 'pad') {
          const on = c ? c.v >= 1 : id.startsWith('play') && val === 1
          shape = <><rect x={s.x - s.w! / 2} y={s.y - s.h! / 2} width={s.w} height={s.h} rx={s.k === 'pad' ? 6 : 8} className={'pic-shape' + (on ? ' on' : '')} /><text x={s.x} y={s.y + 4} textAnchor="middle" className="pic-lbl">{s.text}</text></>
        } else if (s.k === 'jog') {
          const ang = c ? c.v : 0
          const touch = ctl[id.replace('jog', 'jogtouch')]
          shape = <><circle cx={s.x} cy={s.y} r={s.r! + 8} className={'pic-touch' + (touch ? ' tested' : '') + (target === id.replace('jog', 'jogtouch') ? ' target' : '')} />
            <circle cx={s.x} cy={s.y} r={s.r} className="pic-shape" /><circle cx={s.x} cy={s.y} r={s.r! * 0.55} className="pic-hub" />
            <line x1={s.x} y1={s.y - s.r! + 4} x2={s.x} y2={s.y - s.r! * 0.6} className="pic-mark" transform={`rotate(${ang} ${s.x} ${s.y})`} />
            <text x={s.x} y={s.y + 5} textAnchor="middle" className="pic-lbl big">{s.text}</text></>
        } else if (s.k === 'vfader') {
          const y1 = s.y - s.h! / 2, y = y1 + (1 - val) * s.h!
          shape = <><rect x={s.x - 3} y={y1} width={6} height={s.h} rx={3} className="pic-track" /><rect x={s.x - 12} y={y - 7} width={24} height={14} rx={4} className="pic-shape handle" />
            <text x={s.x} y={y1 - 6} textAnchor="middle" className="pic-lbl">{s.text}</text></>
        } else if (s.k === 'hfader') {
          const x1 = s.x - s.w! / 2, x = x1 + val * s.w!
          shape = <><rect x={x1} y={s.y - 3} width={s.w} height={6} rx={3} className="pic-track" /><rect x={x - 7} y={s.y - 12} width={14} height={24} rx={4} className="pic-shape handle" />
            <text x={s.x} y={s.y + 26} textAnchor="middle" className="pic-lbl">{s.text}</text></>
        } else {
          const ang = -135 + val * 270
          shape = <><circle cx={s.x} cy={s.y} r={s.r} className="pic-shape" /><line x1={s.x} y1={s.y} x2={s.x} y2={s.y - s.r! + 3} className="pic-mark" transform={`rotate(${ang} ${s.x} ${s.y})`} />
            <text x={s.x} y={s.y + s.r! + 11} textAnchor="middle" className="pic-lbl">{s.text}</text></>
        }
        return (
          <g key={id} className={cls} onPointerDown={down} data-id={id}>
            <title>{labelOf(id)}</title>
            {shape}
            {hot && s.k !== 'jog' && <rect x={(s.x - (s.w ?? (s.r ?? 14) * 2) / 2) - 6} y={(s.y - (s.h ?? (s.r ?? 14) * 2) / 2) - 6} width={(s.w ?? (s.r ?? 14) * 2) + 12} height={(s.h ?? (s.r ?? 14) * 2) + 12} rx={10} className="pic-ring" />}
            {hot && s.k === 'jog' && <circle cx={s.x} cy={s.y} r={s.r! + 10} className="pic-ring" />}
            {showTested && !noQ && mapped && !tested && <text x={s.x + (s.w ?? (s.r ?? 14) * 2) / 2} y={s.y - (s.h ?? (s.r ?? 14) * 2) / 2 - 2} className="pic-q">?</text>}
          </g>
        )
      })}
      {target?.startsWith('jogtouch') && (() => { const s = LAYOUT[target]; return <circle cx={s.x} cy={s.y} r={s.r! + 8} className="pic-ring" /> })()}
    </svg>
  )
}
