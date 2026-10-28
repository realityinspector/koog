import { useCallback, useEffect, useRef, useState } from 'react'
import { onNote } from '../../music/notes'
import { getSynth } from './engine'
import type { SynthParams, Wave } from './params'
import './playground.css'

const KEYS_FIRST = 48 // C3, 2 octaves = 25 keys through C5
const KEY_COUNT = 25
const BLACK = new Set([1, 3, 6, 8, 10])

interface KnobDef { key: keyof SynthParams; label: string; min: number; max: number; step: number; unit?: string }
interface Group { title: string; tip: string; wave?: boolean; knobs: KnobDef[] }

const GROUPS: Group[] = [
  { title: 'OSCILLATORS', tip: 'Oscillators make the raw buzz. Wave is its shape; detune slides a second one slightly off-pitch for a fat sound.', wave: true,
    knobs: [{ key: 'detune', label: 'Detune', min: -50, max: 50, step: 1, unit: ' cents' }] },
  { title: 'FILTER', tip: 'Cutoff: the filter is a door. Open it = bright, close it = dark and muffled. Resonance rings at the edge; Env amount swings the door open on each note.',
    knobs: [
      { key: 'cutoff', label: 'Cutoff', min: 40, max: 12000, step: 10, unit: ' Hz' },
      { key: 'resonance', label: 'Resonance', min: 0.1, max: 20, step: 0.1 },
      { key: 'filterEnv', label: 'Env amount', min: 0, max: 8000, step: 50, unit: ' Hz' }] },
  { title: 'ENVELOPE', tip: 'The shape of a note: Attack (fade in), Decay (settle), Sustain (held level), Release (fade out after you let go).',
    knobs: [
      { key: 'attack', label: 'Attack', min: 0.002, max: 2, step: 0.002, unit: ' s' },
      { key: 'decay', label: 'Decay', min: 0.01, max: 2, step: 0.01, unit: ' s' },
      { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01 },
      { key: 'release', label: 'Release', min: 0.01, max: 3, step: 0.01, unit: ' s' }] },
  { title: 'GLIDE', tip: 'Glide: notes slide into each other like a trombone. Above zero, the synth plays one note at a time.',
    knobs: [{ key: 'glide', label: 'Glide', min: 0, max: 0.5, step: 0.01, unit: ' s' }] },
  { title: 'VOLUME', tip: 'Volume: how loud. It has a safety limit built in, so it can never get painfully loud.',
    knobs: [{ key: 'level', label: 'Volume', min: 0, max: 1, step: 0.01 }] },
]

export function SynthPlayground() {
  const synth = getSynth()
  const [params, setParams] = useState<SynthParams>({ ...synth.params })
  const [ready, setReady] = useState(synth.ready)
  const [listen, setListen] = useState(false)
  const [down, setDown] = useState<Set<number>>(new Set())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerNote = useRef<Map<number, number>>(new Map())

  const change = useCallback((p: Partial<SynthParams>) => {
    synth.setParams(p)
    setParams({ ...synth.params })
  }, [synth])

  useEffect(() => synth.onParams?.(() => setParams({ ...synth.params })), [synth])

  const turnOn = async () => { await synth.unlock(); setReady(synth.ready) }

  const press = useCallback((n: number, vel = 100) => { synth.noteOn(n, vel); setDown(d => new Set(d).add(n)) }, [synth])
  const lift = useCallback((n: number) => {
    synth.noteOff(n)
    setDown(d => { const x = new Set(d); x.delete(n); return x })
  }, [synth])

  // MIDI keyboard -> synth, only while toggle on
  useEffect(() => {
    if (!listen) return
    const off = onNote(e => { if (e.on) press(e.note, e.velocity); else lift(e.note) })
    return () => { off(); synth.panic(); setDown(new Set()) }
  }, [listen, press, lift, synth])

  useEffect(() => () => synth.panic(), [synth])

  // oscilloscope
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const g = cv.getContext('2d')
    if (!g) return
    let raf = 0
    const buf = new Uint8Array(1024)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const w = cv.width, h = cv.height
      g.fillStyle = '#06130a'; g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(80,255,140,0.15)'; g.lineWidth = 1
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke()
      const an = synth.analyser()
      g.strokeStyle = '#4dff8f'; g.lineWidth = 2; g.beginPath()
      if (!an) { g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); return }
      an.getByteTimeDomainData(buf)
      // trigger on rising zero-cross for a steady picture
      let s = 0
      for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { s = i; break }
      const n = buf.length / 2
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w, y = h / 2 + ((buf[s + i] - 128) / 128) * (h / 2) * 1.6 * -1
        if (i) g.lineTo(x, y); else g.moveTo(x, y)
      }
      g.stroke()
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [synth])

  const fmt = (k: KnobDef) => {
    const v = params[k.key] as number
    const d = k.step >= 1 ? 0 : k.step >= 0.1 ? 1 : 2
    return v.toFixed(d) + (k.unit ?? '')
  }

  const keys = Array.from({ length: KEY_COUNT }, (_, i) => KEYS_FIRST + i)
  const whites = keys.filter(n => !BLACK.has(n % 12))

  const keyEl = (n: number, style: React.CSSProperties, black: boolean) => (
    <div key={n} className={`sp-key ${black ? 'sp-black' : 'sp-white'}${down.has(n) ? ' sp-down' : ''}`} style={style}
      onPointerDown={e => {
        if (!ready) return
        e.currentTarget.setPointerCapture(e.pointerId)
        pointerNote.current.set(e.pointerId, n); press(n)
      }}
      onPointerUp={e => { const m = pointerNote.current.get(e.pointerId); pointerNote.current.delete(e.pointerId); if (m !== undefined) lift(m) }}
      onPointerCancel={e => { const m = pointerNote.current.get(e.pointerId); pointerNote.current.delete(e.pointerId); if (m !== undefined) lift(m) }}
    />
  )

  return (
    <div className="sp-root">
      {!ready && <button className="sp-power" onClick={turnOn}>🔊 Turn on synth</button>}
      <div className="sp-scope-wrap">
        <canvas ref={canvasRef} className="sp-scope" width={640} height={140} />
        <label className="sp-listen">
          <input type="checkbox" checked={listen} onChange={e => { setListen(e.target.checked); if (!e.target.checked) { synth.panic(); setDown(new Set()) } }} disabled={!ready} />
          <span>Play my keyboard through this synth</span>
        </label>
      </div>
      <div className="sp-panel">
        {GROUPS.map(gr => (
          <section key={gr.title} className="sp-group">
            <h4>{gr.title}</h4>
            <p className="sp-tip">{gr.tip}</p>
            {gr.wave && (
              <div className="sp-waves" role="group" aria-label="Wave shape">
                {(['sawtooth', 'square', 'triangle', 'sine'] as Wave[]).map(w => (
                  <button key={w} className={`sp-wave${params.wave === w ? ' sp-on' : ''}`} onClick={() => change({ wave: w })}>
                    {w === 'sawtooth' ? 'Saw' : w[0].toUpperCase() + w.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {gr.knobs.map(k => (
              <label key={k.key} className="sp-knob">
                <span className="sp-lab">{k.label}<b>{fmt(k)}</b></span>
                <input type="range" min={k.min} max={k.max} step={k.step} value={params[k.key] as number}
                  onChange={e => change({ [k.key]: Number(e.target.value) } as Partial<SynthParams>)} />
              </label>
            ))}
          </section>
        ))}
      </div>
      <div className="sp-keys" style={{ ['--n' as string]: whites.length }}>
        {keys.map(n => {
          if (BLACK.has(n % 12)) {
            const wi = whites.filter(w => w < n).length
            return keyEl(n, { left: `calc(${wi} * 100% / ${whites.length} - 2.2%)` }, true)
          }
          return keyEl(n, {}, false)
        })}
      </div>
      {!ready && <p className="sp-hint">Press the button above to wake the synth up.</p>}
    </div>
  )
}
