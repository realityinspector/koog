import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PRESETS, pedalDef, type PedalDef } from './effects'
import { applyPreset, movePedal, octLabel, selectPedal, setKnob, setSync, stomp, togglePedal, useBoard } from './boardEngine'
import { setBoardOpen, useBoardOpen } from './boardOpen'
import { setExpression, setSoft, setSostenuto, setVolumePedal, usePianoPedals } from './pianoPedals'
import { setSustain } from '../../music/localNotes'
import { usePedal } from '../pedal/pedal'
import './pedalboard.css'

/** A round knob: drag up/down, use the arrow keys, or click-drag. 0..1. */
function Knob({ label, value, onChange, text }: { label: string; value: number; onChange: (v: number) => void; text?: string }) {
  const drag = useRef<{ y: number; v: number } | null>(null)
  const deg = -135 + value * 270
  return (
    <div className="pb-knob">
      <div className="pb-knob-dial" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
        style={{ ['--deg' as string]: deg + 'deg' }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value } }}
        onPointerMove={(e) => { if (drag.current) onChange(Math.min(1, Math.max(0, drag.current.v + (drag.current.y - e.clientY) / 120))) }}
        onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0
          if (d) { e.preventDefault(); onChange(Math.min(1, Math.max(0, value + d))) }
        }}><i /></div>
      <span>{label}</span>
      <em>{text ?? Math.round(value * 100)}</em>
    </div>
  )
}

function Stomp({ def, index, last }: { def: PedalDef; index: number; last: boolean }) {
  const on = useBoard((b) => !!b.on[def.id])
  const knobs = useBoard((b) => b.knobs[def.id]) ?? []
  const sync = useBoard((b) => b.sync)
  const selected = useBoard((b) => b.selected === def.id)
  const looper = def.kind === 'looper'
  return (
    <div className={'pb-pedal' + (on ? ' on' : '') + (selected ? ' sel' : '')} style={{ ['--pc' as string]: def.color }} data-pedal={def.id}
      draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', def.id); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && id !== def.id) movePedal(id, index) }}
      onPointerDown={() => selectPedal(def.id)}>
      <div className="pb-top">
        <button type="button" className="pb-mv" aria-label={`Move ${def.name} left`} disabled={index === 0} onClick={() => movePedal(def.id, index - 1)}>◀</button>
        <b>{def.icon} {def.name}</b>
        <button type="button" className="pb-mv" aria-label={`Move ${def.name} right`} disabled={last} onClick={() => movePedal(def.id, index + 1)}>▶</button>
      </div>
      <p className="pb-blurb">{def.blurb}</p>
      <div className="pb-knobs">
        {def.knobs.map((k, i) => (
          <Knob key={k.id} label={k.label} value={knobs[i] ?? k.def} onChange={(v) => setKnob(def.id, i, v)}
            text={def.id === 'octave' && i === 0 ? octLabel(knobs[0] ?? 0) : def.id === 'tremolo' && i === 2 ? ((knobs[2] ?? 0) > 0.66 ? 'Chop' : (knobs[2] ?? 0) > 0.33 ? 'Tri' : 'Smooth') : undefined} />
        ))}
        {def.id === 'echo' && <label className="pb-sync"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Beat sync</label>}
      </div>
      <button type="button" className="pb-foot" aria-pressed={looper ? undefined : on} aria-label={looper ? 'Looper footswitch: tap' : `${def.name} footswitch`}
        onClick={() => (looper ? stomp(def.id, usePedal.getState().loopStyle) : togglePedal(def.id))}>
        <span className={'pb-led' + (on ? ' on' : '')} aria-hidden />
        <span className="pb-cap" aria-hidden />
        <span className="pb-foot-t">{looper ? 'TAP' : on ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

function Hold({ label, hint, active, down, up }: { label: string; hint: string; active: boolean; down: () => void; up: () => void }) {
  return (
    <button type="button" className={'pb-hold' + (active ? ' on' : '')} title={hint} aria-pressed={active}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); down() }} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down() } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') up() }}>
      {label}
    </button>
  )
}

export function PedalboardPanel() {
  const order = useBoard((b) => b.order)
  const preset = useBoard((b) => b.preset)
  const pp = usePianoPedals()
  const [damp, setDamp] = useState(false)
  const presetDesc = PRESETS.find((p) => p.id === preset)?.blurb
  return (
    <div className="pb-panel" role="dialog" aria-label="Pedalboard">
      <div className="pb-head">
        <h3>🦶 Pedalboard</h3>
        <button type="button" className="pb-x" onClick={() => setBoardOpen(false)} aria-label="Close the pedalboard">✕ Close</button>
      </div>
      <p className="pb-intro">Stomp a pedal to change how your instrument sounds. The order matters: sound flows left to right. Drag pedals or use the arrows to re-order. A USB foot pedal can stomp the selected one (Devices menu).</p>
      <div className="pb-presets" role="group" aria-label="Presets">
        {PRESETS.map((p) => <button key={p.id} type="button" className={preset === p.id ? 'on' : ''} aria-pressed={preset === p.id} title={p.blurb} onClick={() => applyPreset(p.id)}>{p.name}</button>)}
        {preset === 'custom' && <span className="pb-custom">your own mix</span>}
      </div>
      {presetDesc && <p className="pb-note">{presetDesc}</p>}
      <div className="pb-piano" aria-label="Piano pedals">
        <h4>Piano pedals</h4>
        <div className="pb-hold-row">
          <Hold label="Damper (sustain)" hint="Hold: notes keep ringing, like the right pedal on a piano." active={damp} down={() => { setDamp(true); setSustain(true) }} up={() => { setDamp(false); setSustain(false) }} />
          <Hold label="Soft" hint="Hold: quieter and mellower, like the left pedal." active={pp.soft > 0.01} down={() => setSoft(1)} up={() => setSoft(0)} />
          <Hold label="Sostenuto" hint="Play notes, hold this, let go of the keys: only those notes keep ringing, like the middle pedal." active={pp.sostenuto} down={() => setSostenuto(true)} up={() => setSostenuto(false)} />
        </div>
        <label className="pb-sl">Expression swell <input type="range" min={0} max={100} value={Math.round(pp.expr * 100)} onChange={(e) => setExpression(+e.target.value / 100)} aria-label="Expression" /><em>{Math.round(pp.expr * pp.expr * 100)}%</em></label>
        <label className="pb-sl">Volume pedal <input type="range" min={0} max={100} value={Math.round(pp.vol * 100)} onChange={(e) => setVolumePedal(+e.target.value / 100)} aria-label="Volume pedal" /><em>{Math.round(pp.vol * pp.vol * 100)}%</em></label>
        <p className="pb-note">A keyboard pedal that sends the soft (67), sostenuto (66), expression (11) or volume (7) controls works with no setup. A half-pressed sustain pedal lets notes fade a little later.</p>
      </div>
      <div className="pb-board" aria-label="Effect pedals">
        {order.map((id, i) => { const d = pedalDef(id); return d ? <Stomp key={id} def={d} index={i} last={i === order.length - 1} /> : null })}
      </div>
    </div>
  )
}

/** Fixed over everything (kid and Boss mode). Opened from the Devices menu, ✨ Modes or the tour. */
export function PedalboardDock() {
  const open = useBoardOpen((s) => s.open)
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBoardOpen(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])
  if (!open) return null
  // a portal to <body>: the display's overlay layer is transformed, which would trap a fixed panel inside it
  return createPortal(<div className="pb-dock" data-testid="pedalboard"><PedalboardPanel /></div>, document.body)
}
