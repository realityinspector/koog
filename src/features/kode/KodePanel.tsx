import { useEffect, useRef, useState } from 'react'
import './kode.css'
import { useKode, run, stop, setText, writeForMe, finishListening, cancelListening, useMyLoop, runner } from './kodeEngine'
import { setKodeDock, useKodeDock } from './kodeDock'
import { KodeEditor, type Span } from './KodeEditor'
import { EXAMPLES } from '../../kode/lang/examples'
import { describe, LIMITS } from '../../kode/lang/types'
import { DRUM_NAMES, SOUND_NAMES } from '../../kode/lang/names'
import { useScreen } from '../../layout/screenStore'
import { useProfile } from '../../profile/profile'
import { useMaster } from '../../music/masterClock'
import { setLoopsDock } from '../loopstation/LoopsDock'
import { setControllerPage } from '../loopstation/loopSurface'

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** the step(s) sounding right now, polled a few times a frame (hidden when the code box no longer matches what plays) */
function useActive(): Span[] {
  const [act, setAct] = useState<Span[]>([])
  const key = useRef('')
  useEffect(() => {
    let raf = 0, last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (reduced() && t - last < 350) return
      last = t
      const r = runner()
      const text = useKode.getState().text
      const marks = r.activeSource() === text ? r.activeMarks(performance.now()) : []
      const k = marks.map((m) => m.s + ':' + m.e).join(',')
      if (k !== key.current) { key.current = k; setAct(marks.map((m) => ({ s: m.s, e: m.e }))) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return act
}

export function KodePanel({ onClose }: { onClose?: () => void }) {
  const s = useKode()
  const bpm = useMaster((m) => m.bpm)
  const act = useActive()
  const [menu, setMenu] = useState(false)
  const [why, setWhy] = useState('')
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [menu])
  const err = s.errors[0]
  const waiting = s.running && s.waitingBar !== null && s.playingText !== null
  return (
    <div className="kd" ref={wrap} data-kode-panel>
      <div className="kd-head">
        <h3>🧑‍💻 Koog Kode</h3>
        <span className={'kd-chip ' + (s.running ? 'on' : '')} role="status">{s.running ? (waiting ? '▶ playing · change waits for the bar line' : '▶ playing') : '■ stopped'} · {Math.round(bpm)} bpm</span>
        {onClose && <button type="button" className="kd-btn x" onClick={onClose} title="Close the Kode panel (the music keeps playing until you press Stop)">✕ Close</button>}
      </div>
      <div className="kd-bar">
        <button type="button" className="kd-btn go" onClick={() => run()} title="Run the code. If music is already playing, the change lands at the next bar line, so nothing clicks. (Ctrl or Cmd + Enter)">▶ Run</button>
        <button type="button" className="kd-btn stop" onClick={() => stop()} disabled={!s.running} title="Stop all the code music">■ Stop</button>
        <button type="button" className={'kd-btn' + (s.listening ? ' hot' : '')} aria-pressed={s.listening} onClick={() => (s.listening ? finishListening() : writeForMe())}
          title="Play a phrase on ANY instrument (keys, drum pads, DJ controller, foot pedal) and Koog writes the code for it">
          {s.listening ? `⏺ Listening (${s.heard})... tap when done` : '📼 Write it for me'}
        </button>
        {s.listening && <button type="button" className="kd-btn" onClick={cancelListening} title="Stop listening without writing">Cancel</button>}
        <button type="button" className="kd-btn" onClick={() => useMyLoop()} title="Turn your Looper layers and Drum pad beat into lines of code">🔁 Use my loop</button>
        <button type="button" className="kd-btn" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)} title="Starter snippets, from simple to clever">📚 Examples ▾</button>
      </div>
      {menu && (
        <div className="kd-pop" role="menu">
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" role="menuitem" className="kd-ex" onClick={() => { setText(ex.code); setWhy(ex.why); setMenu(false) }}>
              <b>{ex.title}</b><em>{ex.why}</em>
            </button>
          ))}
        </div>
      )}
      <KodeEditor value={s.text} onChange={setText} onRun={() => run()} active={act} errors={s.errors} label="Koog Kode code box" />
      <div className={'kd-msg' + (err ? ' bad' : '')} role="status" aria-live="polite">
        {err ? describe(err) : s.note || 'Type some code, then press Run (or Ctrl+Enter). Every line is its own layer.'}
        {err && s.errors.length > 1 && <span className="kd-more"> (+{s.errors.length - 1} more)</span>}
      </div>
      {why && !err && <div className="kd-why">💡 {why}</div>}
      <details className="kd-cheat">
        <summary title="A tiny guide to the language">How to write Kode</summary>
        <div className="kd-cheat-body">
          <p><code>notes "c e g e"</code> each word is a step; the steps share one bar. <code>~</code> is a rest. <code>c4</code>, <code>f#3</code>, <code>bb</code> pick octave and sharps/flats.</p>
          <p><code>[c e]</code> squeeze into one step · <code>[c,e,g]</code> play together · <code>&lt;c d&gt;</code> a new one each bar · <code>c*2</code> repeat.</p>
          <p><code>drums "kick ~ snare ~"</code> drums: {DRUM_NAMES.join(', ')}.</p>
          <p><code>tempo 100</code> · <code>loud 0.8</code> · <code>sound "ladder"</code> (sounds: {SOUND_NAMES.join(', ')}). A line with only <code>sound</code> or <code>loud</code> sets it for the layers below.</p>
          <p><code># comment</code> · up to {LIMITS.layers} layers, {LIMITS.lines} lines. It can only make music: it cannot run any other code.</p>
        </div>
      </details>
    </div>
  )
}

/** Kid-mode mount: docked over the PLAY display (✨ Modes > Koog Kode, or the link #/kode). */
export function KodeDock() {
  const open = useKodeDock((d) => d.open)
  const screen = useScreen((x) => x.screen)
  const mode = useProfile((x) => x.mode)
  useEffect(() => {
    if (!open) return
    setLoopsDock(false); setControllerPage('dj') // the looper and the drum pads dock in the same place: one at a time
  }, [open])
  if (!open || screen !== 'play' || mode === 'dad') return null
  return <div className="dp-dock kd-dock" role="region" aria-label="Koog Kode"><KodePanel onClose={() => setKodeDock(false)} /></div>
}
