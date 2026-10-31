import { useEffect, useMemo, useRef, useState } from 'react'
import './loopstation.css'
import { ControllerPic } from '../dj/Controller'
import { BPM_MAX, BPM_MIN, setBpm, setLink, tapTempo, useMaster } from '../../music/masterClock'
import {
  INSTRUMENTS, LAYERS, LEN_CHOICES, clearAll, clearLayer, downloadMidi, instLabel, listSessions, loadSession, loopPos, padAction, pressLayer, redo, saveSession,
  select, setLayerInst, setLayerParam, setLayerVol, setLenBars, setOpt, stopAll, togglePlay, toggleMute, toggleSolo, undo, useLoop, type Layer,
} from './loopEngine'
import { LOOP_LABELS, currentPage, loopInput, setControllerPage, useLoopPage, useLoopView } from './loopSurface'
import { useSurface } from '../controller/surface'

const STATE_ICON: Record<Layer['state'], string> = { empty: '○', rec: '●', over: '◉', play: '▶', stop: '■' }
const STATE_TXT: Record<Layer['state'], string> = { empty: 'empty', rec: 'recording', over: 'overdubbing', play: 'playing', stop: 'stopped' }
const QUANTS: [number, string][] = [[0, 'Off'], [0.5, '1/8'], [0.25, '1/16']]

/** keeps --ls-pos (0..1 through the loop) up to date on the root; slower when the person prefers reduced motion */
function usePlayhead(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, h = 0
    const len = () => useLoop.getState().lenBeats
    const step = () => {
      const p = loopPos(), l = len()
      root.current?.style.setProperty('--ls-pos', p && !p.counting && l > 0 ? String(p.pos / l) : '0')
      root.current?.setAttribute('data-count', p?.counting ? String(p.bar) : '')
    }
    if (calm) h = window.setInterval(step, 250)
    else { const loop = () => { step(); raf = requestAnimationFrame(loop) }; raf = requestAnimationFrame(loop) }
    return () => { cancelAnimationFrame(raf); clearInterval(h) }
  }, [root])
}

function Roll({ layer, len }: { layer: Layer; len: number }) {
  const notes = useMemo(() => layer.takes.flatMap((t) => t.notes), [layer.takes])
  const lanes = useMemo(() => layer.takes.flatMap((t) => Object.entries(t.auto)), [layer.takes])
  const L = Math.max(len, 4)
  const lo = notes.length ? Math.min(...notes.map((n) => n.n)) - 1 : 55, hi = notes.length ? Math.max(...notes.map((n) => n.n)) + 1 : 79
  const span = Math.max(12, hi - lo)
  return (
    <div className="ls-roll" aria-hidden="true">
      <svg viewBox={`0 0 ${L * 10} 40`} preserveAspectRatio="none">
        {Array.from({ length: Math.floor(L / 4) }, (_, i) => <line key={i} x1={i * 40} x2={i * 40} y1={0} y2={40} className="ls-bar" />)}
        {notes.map((n, i) => <rect key={i} x={((n.t + layer.nudge + L) % L) * 10} y={36 - ((n.n - lo) / span) * 34} width={Math.max(2, n.d * 10)} height={3} rx={1} className="ls-note" opacity={0.4 + (n.v / 127) * 0.6} />)}
        {lanes.map(([k, pts], i) => {
          const vs = pts.map((p) => p.v), a = Math.min(...vs), b = Math.max(...vs)
          return <polyline key={k + i} className="ls-auto" fill="none" points={pts.map((p) => `${p.t * 10},${38 - (b === a ? 0.5 : (p.v - a) / (b - a)) * 10}`).join(' ')} />
        })}
      </svg>
      <i className="ls-head" />
    </div>
  )
}

function LaneRow({ i, layer, len, sel }: { i: number; layer: Layer; len: number; sel: boolean }) {
  const lanes = layer.takes.reduce((n, t) => n + Object.keys(t.auto).length, 0)
  return (
    <div className={'ls-lane s-' + layer.state + (sel ? ' sel' : '') + (layer.mute ? ' muted' : '')} onPointerDown={() => select(i)}>
      <button type="button" className="ls-pad" title={`Layer ${i + 1}: ${STATE_TXT[layer.state]}. Tap to ${layer.state === 'empty' ? 'record' : layer.state === 'rec' ? 'finish and play' : layer.state === 'play' ? 'overdub' : layer.state === 'over' ? 'stop overdubbing' : 'play'}.`}
        onClick={() => pressLayer(i)}><b>{i + 1}</b><span aria-hidden="true">{STATE_ICON[layer.state]}</span><span className="ls-sr">{STATE_TXT[layer.state]}</span></button>
      <select className="ls-inst" aria-label={`Layer ${i + 1} sound`} value={layer.inst} onChange={(e) => setLayerInst(i, e.target.value)}>
        {INSTRUMENTS().map((x) => <option key={x} value={x}>{instLabel(x)}</option>)}
        {!INSTRUMENTS().includes(layer.inst) && <option value={layer.inst}>{instLabel(layer.inst)}</option>}
      </select>
      <input className="ls-vol" type="range" min={0} max={1} step={0.01} value={layer.vol} aria-label={`Layer ${i + 1} volume`} onChange={(e) => setLayerVol(i, Number(e.target.value))} />
      <button type="button" className={'ls-b' + (layer.mute ? ' on' : '')} aria-pressed={layer.mute} title="Mute" onClick={() => toggleMute(i)}>M</button>
      <button type="button" className={'ls-b' + (layer.solo ? ' on' : '')} aria-pressed={layer.solo} title="Solo" onClick={() => toggleSolo(i)}>S</button>
      <button type="button" className="ls-b" title="Undo the last take" disabled={!layer.takes.length && layer.state !== 'rec' && layer.state !== 'over'} onClick={() => undo(i)}>↶</button>
      <button type="button" className="ls-b" title="Redo" disabled={!layer.redo.length} onClick={() => redo(i)}>↷</button>
      <button type="button" className="ls-b" title="Clear this layer" disabled={layer.state === 'empty'} onClick={() => clearLayer(i)}>✕</button>
      <Roll layer={layer} len={len} />
      {sel && layer.state !== 'empty' && (
        <div className="ls-params">
          <label>Transpose <input type="number" min={-24} max={24} value={layer.transpose} onChange={(e) => setLayerParam(i, 'transpose', Number(e.target.value))} /></label>
          <label>Gate <input type="number" min={0.2} max={2} step={0.05} value={layer.gate} onChange={(e) => setLayerParam(i, 'gate', Number(e.target.value))} /></label>
          <label>Nudge <input type="number" min={-1} max={1} step={0.03125} value={layer.nudge} onChange={(e) => setLayerParam(i, 'nudge', Number(e.target.value))} /></label>
          {lanes > 0 && <span className="ls-chip" title="Knob moves recorded on this layer">🎚️ {lanes} automation lane{lanes > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  )
}

function Position() {
  const lenBeats = useLoop((s) => s.lenBeats)
  return <div className="ls-pos" aria-hidden="true"><i /><span>{lenBeats ? `${lenBeats / 4} bar${lenBeats > 4 ? 's' : ''}` : 'length: first take'}</span></div>
}

function BpmBox() {
  const bpm = useMaster((s) => s.bpm), following = useMaster((s) => s.following)
  return (
    <span className="ls-bpm">
      <input type="number" min={BPM_MIN} max={BPM_MAX} step={1} value={Math.round(bpm * 10) / 10} aria-label="Tempo in beats per minute" onChange={(e) => setBpm(Number(e.target.value))} disabled={following} />
      <button type="button" className="ls-b" title="Tap tempo" onClick={() => tapTempo()}>TAP</button>
      {following && <span className="ls-chip" title="The DJ decks are playing, so the loop follows their tempo">🎧 follows DJ</span>}
    </span>
  )
}

export function LoopStation({ compact }: { compact?: boolean }) {
  const s = useLoop()
  const root = useRef<HTMLDivElement>(null)
  usePlayhead(root)
  const countLeft = s.countLeft
  const rec = s.layers.findIndex((l) => l.state === 'rec' || l.state === 'over')
  const playing = s.running

  if (compact) {
    return (
      <div className="ls ls-compact" ref={root} role="group" aria-label="Loop station">
        <button type="button" className={'ls-b big' + (playing ? ' on' : '')} aria-pressed={playing} title={playing ? 'Stop all layers' : 'Play all layers'} onClick={() => togglePlay()}>{playing ? '■' : '▶'}</button>
        <button type="button" className={'ls-b big rec' + (rec >= 0 ? ' on' : '')} title="Record / overdub the selected layer" onClick={() => padAction(s.sel)}>●</button>
        <BpmBox />
        <span className="ls-dots" role="group" aria-label="Layers">
          {s.layers.map((l, i) => <button key={i} type="button" className={'ls-dot s-' + l.state + (i === s.sel ? ' sel' : '')} aria-label={`Layer ${i + 1} ${STATE_TXT[l.state]}`} onClick={() => padAction(i)}>{i + 1}</button>)}
        </span>
        <span className="ls-count" aria-live="polite">{countLeft > 0 ? `count-in ${countLeft}` : ''}</span>
        <Position />
      </div>
    )
  }

  return (
    <div className="ls" ref={root} role="region" aria-label="Loop station">
      <div className="ls-head-row">
        <b className="ls-title">🔁 Loop Station</b>
        <button type="button" className={'ls-b big' + (playing ? ' on' : '')} aria-pressed={playing} onClick={() => togglePlay()} title="Start / stop all layers">{playing ? '■ Stop' : '▶ Play'}</button>
        <BpmBox />
        <label>Bars <select value={s.lenBars} onChange={(e) => setLenBars(Number(e.target.value))}><option value={0}>Auto (first take)</option>{LEN_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>Count-in <select value={s.countIn} onChange={(e) => setOpt('countIn', Number(e.target.value))}>{[0, 1, 2].map((n) => <option key={n} value={n}>{n} bar{n === 1 ? '' : 's'}</option>)}</select></label>
        <label>Quantise <select value={s.quant} onChange={(e) => setOpt('quant', Number(e.target.value))}>{QUANTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <span className="ls-count" aria-live="polite">{countLeft > 0 ? `Count-in: ${countLeft}` : ''}</span>
      </div>
      <div className="ls-opts">
        <label><input type="checkbox" checked={s.metro} onChange={(e) => setOpt('metro', e.target.checked)} /> Click</label>
        <label title="Also record DJ pad hits"><input type="checkbox" checked={s.recPads} onChange={(e) => setOpt('recPads', e.target.checked)} /> DJ pads</label>
        <label title="Show the selected layer on the sheet music while it plays"><input type="checkbox" checked={s.sheet} onChange={(e) => setOpt('sheet', e.target.checked)} /> Sheet</label>
        <LinkBox />
        <label>Main <input type="range" min={0} max={1} step={0.01} value={s.master} aria-label="Loop main volume" onChange={(e) => setOpt('master', Number(e.target.value))} /></label>
        <label title="Blend layers 1-4 against 5-8">1-4 ⇄ 5-8 <input type="range" min={0} max={1} step={0.01} value={s.xf} aria-label="Layer blend" onChange={(e) => setOpt('xf', Number(e.target.value))} /></label>
        <span className="ls-sp" />
        <Sessions />
        <button type="button" className="ls-b" onClick={() => downloadMidi(1)} disabled={!s.layers.some((l) => l.takes.length)} title="Download the loop as a Standard MIDI File">⬇ .mid</button>
        <button type="button" className="ls-b" onClick={() => stopAll()}>■ Stop</button>
        <button type="button" className="ls-b" onClick={() => clearAll()}>Clear all</button>
      </div>
      <div className="ls-lanes">
        {s.layers.map((l, i) => <LaneRow key={i} i={i} layer={l} len={s.lenBeats} sel={i === s.sel} />)}
      </div>
      <Position />
      <PadsPicture />
    </div>
  )
}

function LinkBox() {
  const link = useMaster((s) => s.link)
  return <label title="Make the beat machine follow this tempo"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> Link beats</label>
}

function Sessions() {
  const [slot, setSlot] = useState('1')
  const [, bump] = useState(0)
  const all = listSessions()
  return (
    <span className="ls-sess">
      <select aria-label="Save slot" value={slot} onChange={(e) => setSlot(e.target.value)}>{['1', '2', '3', '4'].map((k) => <option key={k} value={k}>Slot {k}{all[k] ? ' ●' : ''}</option>)}</select>
      <button type="button" className="ls-b" onClick={() => { saveSession(slot); bump((n) => n + 1) }}>Save</button>
      <button type="button" className="ls-b" disabled={!all[slot]} onClick={() => loadSession(slot)}>Load</button>
    </span>
  )
}

function PadsPicture() {
  const v = useLoopView()
  const synth = useSurface((s) => s.on)
  const page = currentPage(synth, v.on)
  const fn = useLoop((s) => s.fn)
  const now = performance.now()
  const labels = { ...LOOP_LABELS, 'padmode.A': fn.toUpperCase(), 'padmode.B': fn.toUpperCase() }
  const ctl = Object.fromEntries(Object.entries(v.values).map(([k, x]) => [k, { v: x, n: 1 }]))
  const hot = Object.fromEntries(Object.entries(v.touched).filter(([, t]) => now - t < 600).map(([k]) => [k, true]))
  return (
    <div className="ls-pic">
      <div className="ls-pic-head">
        <b>Controller</b>
        <button type="button" className={'ls-b' + (page === 'loop' ? ' on' : '')} aria-pressed={page === 'loop'} onClick={() => setControllerPage(page === 'loop' ? 'dj' : 'loop')}>
          {page === 'loop' ? '🔁 Controller is on the Loop page' : '🔁 Put the controller on the Loop page'}
        </button>
        <small>{v.last || 'Tap a numbered pad to record. PAD MODE: REC / MUTE / SOLO.'}</small>
      </div>
      <ControllerPic ctl={ctl} labels={labels} ghost={v.ghost} hot={hot} interactive title="LOOP" onSend={(id, val) => loopInput(id, val)} />
    </div>
  )
}
