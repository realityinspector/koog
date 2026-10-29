import { useEffect, useRef, useState } from 'react'
import { useAppStore, type NoteEvent } from '../../store/appStore'
import { onNote } from '../../music/notes'
import { onJudge } from '../../music/judge'
import { useScreen } from '../../layout/screenStore'
import { createEngine, type Engine, type Mode, type Theme } from './engine'
import { getSynth } from '../synth-history/engine'
import { PatchDrawer } from './PatchDrawer'
import { VizControls, VISUALS } from './VizControls'
import './visualizer.css'

export function Visualizer() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const m = localStorage.getItem('koog.viz.mode')
      if (m && VISUALS.some((x) => x.id === m)) return m as Mode
    } catch { /* storage blocked: fine */ }
    return 'fireworks'
  })
  const [emoji, setEmoji] = useState(false)
  const [sparkle, setSparkle] = useState(() => {
    try { return localStorage.getItem('koog.viz.sparkle') !== '0' } catch { return true }
  })
  const [theme, setTheme] = useState<Theme>('rainbow')
  const [patchOpen, setPatchOpen] = useState(() => {
    try { return localStorage.getItem('koog.viz.patch') === '1' } catch { return false }
  })
  const [played, setPlayed] = useState(false)
  useEffect(() => onNote((n) => { if (n.on) setPlayed(true) }), [])
  const connected = useAppStore((s) => s.midiConnected)

  useEffect(() => {
    const eng = createEngine(canvas.current!)
    engine.current = eng
    eng.setMode(mode)
    eng.setEmoji(emoji)
    eng.setTheme(theme)
    eng.setSparkle(sparkle)
    const synth = getSynth()
    eng.setPatch(synth.params)
    const offParams = synth.onParams?.((p) => eng.setPatch(p))
    // The judge grades every note first (kind, score, rhythm, slams), so the visuals agree with the games.
    const unsub = onJudge((ev) => {
      if (ev.type === 'note') eng.noteOn(ev.g.note, ev.g.velocity, ev.g)
      else if (ev.type === 'off') eng.noteOff(ev.note)
      else eng.react(ev)
    })
    // A full-screen game owns the display: stop drawing so it gets the CPU.
    const syncPause = () => eng.setPaused(useScreen.getState().game !== null)
    syncPause()
    const unScreen = useScreen.subscribe(syncPause)
    return () => {
      unsub()
      unScreen()
      offParams?.()
      eng.destroy()
    }
    // createEngine is a dep on purpose: when engine.ts is edited, HMR gives a new
    // function, so the old engine is torn down and the new code actually runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createEngine])

  useEffect(() => {
    engine.current?.setMode(mode)
    try { localStorage.setItem('koog.viz.mode', mode) } catch { /* ignore */ }
  }, [mode])
  useEffect(() => engine.current?.setEmoji(emoji), [emoji])
  useEffect(() => engine.current?.setTheme(theme), [theme])
  useEffect(() => {
    engine.current?.setSparkle(sparkle)
    try { localStorage.setItem('koog.viz.sparkle', sparkle ? '1' : '0') } catch { /* ignore */ }
  }, [sparkle])
  useEffect(() => {
    try { localStorage.setItem('koog.viz.patch', patchOpen ? '1' : '0') } catch { /* ignore */ }
  }, [patchOpen])

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void wrap.current?.requestFullscreen()
  }

  return (
    <div className="viz" ref={wrap}>
      <canvas ref={canvas} className="viz-canvas" />
      <VizControls mode={mode} onMode={setMode} theme={theme} onTheme={setTheme} emoji={emoji} onEmoji={setEmoji}
        sparkle={sparkle} onSparkle={setSparkle} patchOpen={patchOpen} onPatch={() => setPatchOpen((o) => !o)} onFullscreen={fullscreen} />
      {patchOpen && <PatchDrawer onClose={() => setPatchOpen(false)} />}
      <div className={'viz-hint' + (played ? ' gone' : '')} aria-hidden={played}>
        {connected ? 'Keyboard connected. Play anything! Try chords.' : 'No MIDI yet? Play on your computer: Z S X D C V and Q 2 W 3 E R keys (← → change octave)'}
      </div>
    </div>
  )
}
