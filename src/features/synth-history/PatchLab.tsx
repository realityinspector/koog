import { useEffect, useRef, useState } from 'react'
import { getSynth } from './engine'
import { PRESETS } from './presets'
import './patchlab.css'

type Id = 'VCO' | 'VCF' | 'VCA' | 'OUT' | 'ENV' | 'LFO'

interface Mod { id: Id; label: string; sub: string; x: number; y: number; color: string; info: string }
const W = 130, H = 64
const MODS: Mod[] = [
  { id: 'VCO', label: 'VCO', sub: 'oscillator', x: 20, y: 150, color: '#ff5da2', info: 'VCO (voltage-controlled oscillator) is the voice that makes the raw buzz. It makes a wave that repeats really fast; faster = higher note.' },
  { id: 'VCF', label: 'VCF', sub: 'filter', x: 200, y: 150, color: '#7c5cff', info: 'VCF (voltage-controlled filter) is the filter that sculpts the tone. It cuts the bright, sharp parts, like turning a muffler up and down. Cutoff and resonance are its knobs.' },
  { id: 'VCA', label: 'VCA', sub: 'amplifier', x: 380, y: 150, color: '#4dd6a0', info: 'VCA (voltage-controlled amplifier) is the volume gate. It lets sound through, or not, and how loud.' },
  { id: 'OUT', label: 'OUT', sub: 'speakers', x: 560, y: 150, color: '#ffcc4d', info: 'OUT is where the sound leaves the synth and goes to your speakers or headphones.' },
  { id: 'ENV', label: 'ENV', sub: 'envelope (ADSR)', x: 290, y: 15, color: '#ff9f43', info: 'ENV (envelope) is the shape of a note over time: Attack (fade in), Decay (drop), Sustain (hold level), Release (fade out). Think ADSR!' },
  { id: 'LFO', label: 'LFO', sub: 'slow wobble', x: 110, y: 15, color: '#4dc3ff', info: 'LFO (low-frequency oscillator) is a slow wobble. It is too slow to hear as a note, but it can make vibrato (pitch wobble) or tremolo (volume wobble).' },
]
const byId = (id: Id) => MODS.find(m => m.id === id)!
const AUDIO: Id[] = ['VCO', 'VCF', 'VCA', 'OUT']
const outPt = (id: Id) => { const m = byId(id); return { x: m.x + W, y: m.y + H / 2 } }
const inPt = (id: Id) => { const m = byId(id); return { x: m.x, y: m.y + H / 2 } }
const topPt = (id: Id, dx = 0.5) => { const m = byId(id); return { x: m.x + W * dx, y: m.y } }
const botPt = (id: Id) => { const m = byId(id); return { x: m.x + W / 2, y: m.y + H } }

type P = { x: number; y: number }
const vcable = (a: P, b: P) =>
  `M${a.x},${a.y} C${a.x},${a.y + 60} ${b.x},${b.y - 60} ${b.x},${b.y}`

const MODCABLES: { from: Id; to: Id; dx: number; color: string }[] = [
  { from: 'LFO', to: 'VCO', dx: 0.3, color: '#4dc3ff' },
  { from: 'LFO', to: 'VCF', dx: 0.3, color: '#4dc3ff' },
  { from: 'ENV', to: 'VCF', dx: 0.7, color: '#ff9f43' },
  { from: 'ENV', to: 'VCA', dx: 0.5, color: '#ff9f43' },
]
const HINTS = [
  'Tip: the dashed cables are "voltage control": one module turning another module\'s knob automatically.',
]
const DEMO: [number, number][] = [[48, 0], [55, 280], [60, 560], [64, 840], [60, 1120], [55, 1400]]

export function PatchLab() {
  const [sel, setSel] = useState<Id | null>(null)
  const [from, setFrom] = useState<Id | null>(null)
  const [links, setLinks] = useState<string[]>([])
  const [msg, setMsg] = useState('Game: click an output jack (right side), then the input jack (left side) it should go to.')
  const [active, setActive] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => {
    timers.current.forEach(t => window.clearTimeout(t))
    try { getSynth().panic() } catch { /* ignore */ }
  }, [])

  const done = links.length === 3

  const clickJack = (kind: 'in' | 'out', id: Id) => {
    if (done) return
    if (kind === 'out') {
      setFrom(from === id ? null : id)
      setMsg(from === id ? 'Cancelled.' : `Picked ${id} output. Now click an input jack.`)
      return
    }
    if (!from) { setMsg('Start by clicking an output jack (right side of a module).'); return }
    if (from === id) { setFrom(null); return }
    const i = AUDIO.indexOf(from), j = AUDIO.indexOf(id)
    if (j === i + 1) {
      const key = `${from}>${id}`
      const next = links.includes(key) ? links : [...links, key]
      setLinks(next)
      setMsg(next.length === 3 ? 'Patched! 🎉 VCO → VCF → VCA → OUT. Sound flows from buzz, to tone, to volume, to speakers!' : `Nice, ${from} → ${id} connected. Keep going!`)
    } else {
      setMsg(`Hmm, ${from} doesn't go straight into ${id}. Sound flows VCO → VCF → VCA → OUT.`)
    }
    setFrom(null)
  }

  const reset = () => { setLinks([]); setFrom(null); setMsg('Reset! Click an output jack, then an input jack.') }

  const loadPreset = (id: string) => {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    const s = getSynth()
    void s.unlock()
    s.setParams(p.params)
    setActive(id)
  }

  const hear = () => {
    const s = getSynth()
    void s.unlock()
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    s.panic()
    DEMO.forEach(([n, t]) => {
      timers.current.push(window.setTimeout(() => s.noteOn(n, 0.8), t))
      timers.current.push(window.setTimeout(() => s.noteOff(n), t + 240))
    })
  }

  const activePreset = PRESETS.find(p => p.id === active)

  return (
    <section className="pl">
      <h2>🔌 Patch Lab</h2>
      <p className="pl-sub">Sound flows through modules, connected with patch cables. Click a module to learn what it does.</p>

      <svg className="pl-svg" viewBox="0 0 720 260" role="img" aria-label="Synth patch diagram">
        {MODCABLES.map(c => {
          const a = botPt(c.from)
          const b = topPt(c.to, c.dx)
          return <path key={c.from + c.to} className="pl-mcable" stroke={c.color} d={vcable(a, b)} />
        })}
        {links.map(k => {
          const [a, b] = k.split('>') as [Id, Id]
          const p1 = outPt(a), p2 = inPt(b)
          return <path key={k} className="pl-cable" stroke={byId(a).color} d={`M${p1.x},${p1.y} C${p1.x + 25},${p1.y + 55} ${p2.x - 25},${p2.y + 55} ${p2.x},${p2.y}`} />
        })}
        {MODS.map(m => (
          <g key={m.id} className={'pl-mod' + (sel === m.id ? ' sel' : '')} onClick={() => setSel(m.id)}>
            <rect x={m.x} y={m.y} width={W} height={H} rx={10} style={{ fill: '#1f2026' }} />
            <rect x={m.x} y={m.y} width={W} height={5} rx={2} style={{ fill: m.color, stroke: 'none' }} />
            <text x={m.x + W / 2} y={m.y + 30}>{m.label}</text>
            <text className="pl-sm" x={m.x + W / 2} y={m.y + 48}>{m.sub}</text>
          </g>
        ))}
        {AUDIO.map(id => (
          <g key={id}>
            {id !== 'OUT' && (
              <circle className={'pl-jack' + (from === id ? ' on' : '')} cx={outPt(id).x} cy={outPt(id).y} r={9}
                onClick={() => clickJack('out', id)}><title>{id} output</title></circle>
            )}
            {id !== 'VCO' && (
              <circle className="pl-jack" cx={inPt(id).x} cy={inPt(id).y} r={9}
                onClick={() => clickJack('in', id)}><title>{id} input</title></circle>
            )}
          </g>
        ))}
        <text x={360} y={250} fill="#9a9aab" fontSize={11} textAnchor="middle">dashed cables = voltage control (ENV and LFO turning knobs for you)</text>
      </svg>

      <div className={'pl-msg' + (done ? ' ok' : '')} aria-live="polite">{msg}</div>
      <div className="pl-info">
        {sel ? <><b>{sel}:</b> {byId(sel).info}</> : <>Click a module above. {HINTS[0]}</>}
      </div>
      <div className="pl-row">
        <button className="pl-btn ghost" onClick={reset}>Reset cables</button>
        <button className="pl-btn ghost" onClick={() => setSel(null)}>Voltage control?</button>
      </div>

      <h3>Famous sound types</h3>
      <p className="pl-sub">Load a sound, then press Hear it. The same knobs build very different sounds.</p>
      <div className="pl-grid">
        {PRESETS.map(p => (
          <button key={p.id} className={'pl-card' + (active === p.id ? ' on' : '')} onClick={() => loadPreset(p.id)}>
            <b>{p.emoji} {p.name}</b>
            <span>{p.blurb}</span>
          </button>
        ))}
      </div>
      <div className="pl-row">
        <button className="pl-btn" onClick={hear}>▶ Hear it</button>
        {activePreset && <span className="pl-sub">Loaded: {activePreset.name}</span>}
      </div>

      <div className="pl-soon">
        <h3>🚧 Coming soon: real modular patching</h3>
        <p>Soon you will drag your own cables between modules, plugging an LFO into a filter or an envelope into a volume gate, and build sounds from scratch.</p>
      </div>
    </section>
  )
}
