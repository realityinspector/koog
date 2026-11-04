import { useEffect, useRef, useState } from 'react'
import './drumpads.css'
import { ControllerPic } from '../dj/Controller'
import { setBpm, tapTempo, useMaster } from '../../music/masterClock'
import { useProfile } from '../../profile/profile'
import { useScreen } from '../../layout/screenStore'
import { currentPage, setControllerPage, useLoopPage } from '../loopstation/loopSurface'
import { useSurface } from '../controller/surface'
import { REPEAT_NAMES, STARTERS, VOICES } from './drumCore'
import { KITS } from './drumKit'
import {
  clearPattern, clearVoiceRow, currentStep, loadStarter, onDrumHit, previewVoice, setBars, setKit, setPatVol, setRepeat, setSwing, setTweak, setVol, toggleRec, togglePlay, toggleStep,
  undoPass, unlockDrums, useDrums,
} from './drumEngine'
import { drumInput, drumLabels, useDrumPage, useDrumView, voicePad } from './drumSurface'

// The drum machine panel: 8 big pads (2 rows of 4, like the controller), a 16-step grid, and the basics (PLAY, REC, tempo, swing, kit).
// Pads on screen use the same input path as the controller's pads (drumInput), so hold-to-clear and note repeat work the same.

function Pad({ v, reg }: { v: number; reg: (el: HTMLButtonElement | null) => void }) {
  const def = VOICES[v], id = voicePad(v)
  const held = useDrums((s) => s.held[v])
  const down = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); unlockDrums(); drumInput(id, 1) }
  const up = () => drumInput(id, 0)
  const kd = (e: React.KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); drumInput(id, 1) } }
  const ku = (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drumInput(id, 0) } }
  return (
    <button type="button" ref={reg} className={'dp-pad' + (held ? ' down' : '')} style={{ ['--h' as string]: def.hue }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onKeyDown={kd} onKeyUp={ku} onBlur={up} aria-label={`${def.label} pad`} title={`${def.label}. Hold 1 second while stopped to clear its row.`}>
      <span className="dp-pad-e" aria-hidden>{def.emoji}</span>
      <span className="dp-pad-l">{def.label}</span>
    </button>
  )
}

function Pads() {
  const els = useRef<(HTMLButtonElement | null)[]>([])
  // a pad glows briefly when its drum sounds (from a pad or from the pattern); at most about 3 times a second per pad, and not at all for reduced motion
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const last = VOICES.map(() => -1e9), timers: number[] = []
    const off = onDrumHit((h) => {
      if (h.at - last[h.voice] < 340) return
      last[h.voice] = h.at
      const t = window.setTimeout(() => { const el = els.current[h.voice]; el?.classList.add('hit'); timers.push(window.setTimeout(() => el?.classList.remove('hit'), 140)) }, Math.max(0, h.at - performance.now()))
      timers.push(t)
    })
    return () => { off(); timers.forEach(clearTimeout) }
  }, [])
  return (
    <div className="dp-pads" role="group" aria-label="Drum pads">
      {VOICES.map((_, v) => <Pad key={v} v={v} reg={(el) => { els.current[v] = el }} />)}
    </div>
  )
}

function StepGrid() {
  const pat = useDrums((s) => s.pat)
  const running = useDrums((s) => s.running)
  const [bar, setBar] = useState(0)
  const [step, setStep] = useState(-1)
  useEffect(() => {
    if (!running) { setStep(-1); return }
    let last = -2
    const h = window.setInterval(() => { const s = currentStep(); if (s !== last) { last = s; setStep(s) } }, 40)
    return () => clearInterval(h)
  }, [running])
  const two = pat.len === 32
  const b = two ? bar : 0
  const cols = Array.from({ length: 16 }, (_, i) => b * 16 + i)
  return (
    <div className="dp-seq" role="group" aria-label="Step pattern">
      {two && (
        <div className="dp-bars" role="tablist" aria-label="Which bar to edit">
          {[0, 1].map((n) => <button key={n} type="button" role="tab" aria-selected={bar === n} className={'dp-chip' + (bar === n ? ' on' : '') + (running && step >= 0 && Math.floor(step / 16) === n ? ' now' : '')} onClick={() => setBar(n)}>Bar {n + 1}</button>)}
        </div>
      )}
      {VOICES.map((def, v) => (
        <div className="dp-row" key={def.id} style={{ ['--h' as string]: def.hue }}>
          <button type="button" className="dp-rl" onClick={() => previewVoice(v)} title={`Hear ${def.label}`}><span aria-hidden>{def.emoji}</span><b>{def.label}</b></button>
          {cols.map((s) => (
            <button key={s} type="button" aria-pressed={pat.rows[v][s] > 0} aria-label={`${def.label} step ${s + 1}`}
              className={'dp-cell' + (pat.rows[v][s] > 0 ? ' on' : '') + (pat.rows[v][s] > 0 && pat.rows[v][s] < 0.8 ? ' soft' : '') + (s % 4 === 0 ? ' beat' : '') + (s === step ? ' now' : '')} onClick={() => toggleStep(v, s)} />
          ))}
          <button type="button" className="dp-rx" onClick={() => clearVoiceRow(v)} aria-label={`Clear ${def.label} row`} title={`Clear the ${def.label} row`}>✕</button>
        </div>
      ))}
    </div>
  )
}

function Chip({ on, children, ...r }: { on?: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={'dp-chip' + (on ? ' on' : '')} aria-pressed={on} {...r}>{children}</button>
}

function Main() {
  const D = useDrums()
  const bpm = useMaster((s) => s.bpm)
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const h = window.setTimeout(() => setSure(false), 3000); return () => clearTimeout(h) }, [sure])
  return (
    <div className="dp-main">
        <button type="button" className={'dp-big play' + (D.running ? ' on' : '')} aria-pressed={D.running} onClick={() => { unlockDrums(); togglePlay() }} title="Start / stop the beat">{D.running ? '■ STOP' : '▶ PLAY'}</button>
        <button type="button" className={'dp-big rec' + (D.rec ? ' on' : '')} aria-pressed={D.rec} onClick={() => { unlockDrums(); toggleRec() }} title="Record: while the beat plays, pads you hit are added to the pattern">● REC</button>
        <Chip onClick={undoPass} disabled={!D.canUndo} title="Undo the last recording or clear">↶ Undo</Chip>
        {sure ? <><Chip onClick={() => { clearPattern(); setSure(false) }} title="Yes, clear everything">Clear all?</Chip><Chip onClick={() => setSure(false)}>No</Chip></> : <Chip onClick={() => setSure(true)} title="Clear every drum">Clear all</Chip>}
        <span className="dp-bpm" role="group" aria-label="Tempo">
          <button type="button" className="dp-chip" onClick={() => setBpm(bpm - 1)} aria-label="Slower">−</button>
          <b aria-live="off">{Math.round(bpm)}</b><small>bpm</small>
          <button type="button" className="dp-chip" onClick={() => setBpm(bpm + 1)} aria-label="Faster">+</button>
          <Chip onClick={() => tapTempo()} title="Tap this in time to set the tempo">TAP</Chip>
        </span>
      </div>
  )
}

function Opts() {
  const D = useDrums()
  const tw = D.tweak[D.lastVoice]
  return (
    <div className="dp-ctl">
      <div className="dp-opts">
        <label className="dp-sl" title="Swing: push every second 16th note late for a bouncy feel">Swing <input type="range" min={0} max={60} step={1} value={Math.round(D.swing * 100)} onChange={(e) => setSwing(Number(e.target.value) / 100)} /><i>{Math.round(D.swing * 100)}%</i></label>
        <label className="dp-sl" title="Drum volume">Volume <input type="range" min={0} max={100} value={Math.round(D.vol * 100)} onChange={(e) => setVol(Number(e.target.value) / 100)} /></label>
        <label className="dp-sl" title="How loud the beat plays compared with the pads you hit">Beat <input type="range" min={0} max={100} value={Math.round(D.patVol * 100)} onChange={(e) => setPatVol(Number(e.target.value) / 100)} /></label>
      </div>
      <div className="dp-opts">
        <span className="dp-grp" role="group" aria-label="Drum kit">Kit {KITS.map((k, i) => <Chip key={k.id} on={D.kit === i} title={k.blurb} onClick={() => { unlockDrums(); setKit(i); previewVoice(0) }}>{k.name}</Chip>)}</span>
        <span className="dp-grp" role="group" aria-label="Pattern length">Length <Chip on={D.pat.len === 16} onClick={() => setBars(1)}>1 bar</Chip><Chip on={D.pat.len === 32} onClick={() => setBars(2)}>2 bars</Chip></span>
        <span className="dp-grp" role="group" aria-label="Note repeat">Roll {REPEAT_NAMES.map((n, i) => <Chip key={n} on={D.repeat === i} title="Hold a pad and it keeps hitting in time" onClick={() => setRepeat(i)}>{n}</Chip>)}</span>
      </div>
      <div className="dp-opts">
        <span className="dp-grp" role="group" aria-label="Starter beats">Start with {STARTERS.map((s) => <Chip key={s.id} onClick={() => { unlockDrums(); loadStarter(s.id) }} title={`${s.name}, ${s.bpm} bpm`}>{s.name}</Chip>)}</span>
      </div>
      <details className="dp-more">
        <summary>Shape the {VOICES[D.lastVoice].label.toLowerCase()} sound</summary>
        <div className="dp-opts">
          <label className="dp-sl">Pitch <input type="range" min={-100} max={100} value={Math.round(tw.pitch * 100)} onChange={(e) => setTweak(D.lastVoice, { pitch: Number(e.target.value) / 100 })} /></label>
          <label className="dp-sl">Decay <input type="range" min={0} max={100} value={Math.round(tw.decay * 100)} onChange={(e) => setTweak(D.lastVoice, { decay: Number(e.target.value) / 100 })} /></label>
          <label className="dp-sl">Tone <input type="range" min={0} max={100} value={Math.round(tw.tone * 100)} onChange={(e) => setTweak(D.lastVoice, { tone: Number(e.target.value) / 100 })} /></label>
          <small>Hit a pad first, then shape it.</small>
        </div>
      </details>
    </div>
  )
}

function DrumPicture() {
  const v = useDrumView()
  const synth = useSurface((s) => s.on)
  const loop = useLoopPage((s) => s.on)
  const page = currentPage(synth, loop, v.on)
  const now = performance.now()
  const note = useDrums((s) => s.note)
  const ctl = Object.fromEntries(Object.entries(v.values).map(([k, x]) => [k, { v: x, n: 1 }]))
  const hot = Object.fromEntries(Object.entries(v.touched).filter(([, t]) => now - t < 600).map(([k]) => [k, true]))
  return (
    <div className="dp-pic">
      <div className="dp-pic-head">
        <Chip on={page === 'drums'} onClick={() => setControllerPage(page === 'drums' ? 'dj' : 'drums')}>{page === 'drums' ? '🥁 Controller is on the Drums page' : '🥁 Put the controller on the Drums page'}</Chip>
        <small>{note || 'Tap the pads. PLAY starts the beat, REC records what you tap.'}</small>
      </div>
      <ControllerPic ctl={ctl} labels={drumLabels()} ghost={v.ghost} hot={hot} interactive title="DRUMS" onSend={(id, val) => drumInput(id, val)} />
    </div>
  )
}

/** the whole drum machine */
export function DrumPads({ onClose }: { onClose?: () => void }) {
  const [pic, setPic] = useState(false)
  const note = useDrums((s) => s.note)
  return (
    <div className="dp" role="region" aria-label="Drum pads">
      <header className="dp-head">
        <h3>🥁 Drum pads</h3>
        <small className="dp-note" aria-live="polite">{note || 'Tap a pad to hear it. PLAY starts a beat, REC adds what you tap.'}</small>
        <Chip on={pic} onClick={() => setPic(!pic)} title="Show the drawn DJ controller">controller</Chip>
        {onClose && <button type="button" className="dp-chip" onClick={onClose} title="Back to the piano">✕ Close</button>}
      </header>
      <div className="dp-body">
        <div className="dp-left"><Pads /><Main /></div>
        <StepGrid />
      </div>
      <Opts />
      {pic && <DrumPicture />}
    </div>
  )
}

/** Kid-mode mount: docked over the piano visuals while the Drums page is on (Boss mode has a DRUMS screen instead). */
export function DrumsDock() {
  const on = useDrumPage((s) => s.on)
  const screen = useScreen((s) => s.screen)
  const mode = useProfile((s) => s.mode)
  if (!on || screen !== 'play' || mode === 'dad') return null
  return <div className="dp-dock"><DrumPads onClose={() => setControllerPage('dj')} /></div>
}

/** Boss-mode rail screen */
export function DrumsScreen() { return <div className="bx-screen"><DrumPads /></div> }
