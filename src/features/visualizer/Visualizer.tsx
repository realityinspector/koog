import { useEffect, useRef, useState } from 'react'
import { useAppStore, type NoteEvent } from '../../store/appStore'
import { onNote } from '../../music/notes'
import { createEngine, THEMES, type Engine, type Mode, type Theme } from './engine'
import './visualizer.css'

// Computer-keyboard fallback so it works even before MIDI is allowed.
const KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'"]
let fakeId = 0

function push(ev: Omit<NoteEvent, 'id' | 'name'>) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const full: NoteEvent = { ...ev, id: -(++fakeId), name: names[ev.note % 12] + (Math.floor(ev.note / 12) - 1) }
  useAppStore.setState((s) => ({ recentNotes: [full, ...s.recentNotes].slice(0, 12) }))
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'fireworks', label: 'Fireworks' },
  { id: 'ripples', label: 'Ripples' },
  { id: 'rise', label: 'Rising bars' },
]

export function Visualizer() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const [mode, setMode] = useState<Mode>('fireworks')
  const [octave, setOctave] = useState(0)
  const [emoji, setEmoji] = useState(false)
  const [theme, setTheme] = useState<Theme>('rainbow')
  const connected = useAppStore((s) => s.midiConnected)

  useEffect(() => {
    const eng = createEngine(canvas.current!)
    engine.current = eng
    eng.setMode(mode)
    eng.setEmoji(emoji)
    eng.setTheme(theme)
    const unsub = onNote((n) => (n.on ? eng.noteOn(n.note, n.velocity) : eng.noteOff(n.note)))
    return () => {
      unsub()
      eng.destroy()
    }
    // createEngine is a dep on purpose: when engine.ts is edited, HMR gives a new
    // function, so the old engine is torn down and the new code actually runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createEngine])

  useEffect(() => engine.current?.setMode(mode), [mode])
  useEffect(() => engine.current?.setEmoji(emoji), [emoji])
  useEffect(() => engine.current?.setTheme(theme), [theme])
  const nextTheme = () => setTheme((t) => THEMES[(THEMES.findIndex((x) => x.id === t) + 1) % THEMES.length].id)

  useEffect(() => {
    const down = new Set<string>()
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest?.('input, textarea, select')
    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.repeat || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'z') return setOctave((o) => Math.max(-2, o - 1))
      if (k === 'x') return setOctave((o) => Math.min(2, o + 1))
      const i = KEYS.indexOf(k)
      if (i < 0 || down.has(k)) return
      down.add(k)
      push({ note: 60 + octave * 12 + i, velocity: 70 + Math.round(Math.random() * 40), on: true })
    }
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const i = KEYS.indexOf(k)
      if (i < 0 || !down.has(k)) return
      down.delete(k)
      push({ note: 60 + octave * 12 + i, velocity: 0, on: false })
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [octave])

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void wrap.current?.requestFullscreen()
  }

  return (
    <div className="viz" ref={wrap}>
      <canvas ref={canvas} className="viz-canvas" />
      <div className="viz-bar">
        {MODES.map((m) => (
          <button key={m.id} className={m.id === mode ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
        <button className={emoji ? 'on' : ''} onClick={() => setEmoji((e) => !e)}>Emoji 😜</button>
        <button onClick={nextTheme} title="Change background">{THEMES.find((x) => x.id === theme)?.label}</button>
        <button onClick={fullscreen}>Fullscreen</button>
      </div>
      <div className="viz-hint">
        {connected ? 'Keyboard connected. Play anything! Try chords.' : 'No MIDI yet? Play on your computer: A W S E D F T G Y H U J K (Z / X change octave)'}
      </div>
    </div>
  )
}
