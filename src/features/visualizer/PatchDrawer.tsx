import { useEffect, useState } from 'react'
import { onNote } from '../../music/notes'
import { isLocalNote } from '../../music/localNotes'
import { getSynth } from '../synth-history/engine'
import { PRESETS } from '../synth-history/presets'
import type { LfoShape, LfoTarget, SynthParams, Wave } from '../synth-history/params'
import { QuestsPanel } from './QuestsPanel'
import './patchdrawer.css'

type Id = 'VCO' | 'VCF' | 'VCA' | 'OUT' | 'ENV' | 'LFO'
interface Mod { id: Id; label: string; x: number; y: number; color: string; info: string }
const W = 68, H = 38
const MODS: Mod[] = [
  { id: 'VCO', label: 'VCO', x: 6, y: 104, color: '#ff5da2', info: 'VCO (voltage-controlled oscillator) is the voice that makes the raw buzz. It makes a wave that repeats really fast; faster = higher note.' },
  { id: 'VCF', label: 'VCF', x: 92, y: 104, color: '#7c5cff', info: 'VCF (voltage-controlled filter) is the filter that sculpts the tone. It cuts the bright, sharp parts, like turning a muffler up and down. Cutoff and resonance are its knobs.' },
  { id: 'VCA', label: 'VCA', x: 178, y: 104, color: '#4dd6a0', info: 'VCA (voltage-controlled amplifier) is the volume gate. It lets sound through, or not, and how loud.' },
  { id: 'OUT', label: 'OUT', x: 264, y: 104, color: '#ffcc4d', info: 'OUT is where the sound leaves the synth and goes to your speakers or headphones.' },
  { id: 'ENV', label: 'ENV', x: 178, y: 10, color: '#ff9f43', info: 'ENV (envelope) is the shape of a note over time: Attack (fade in), Decay (drop), Sustain (hold level), Release (fade out). Think ADSR!' },
  { id: 'LFO', label: 'LFO', x: 50, y: 10, color: '#4dc3ff', info: 'LFO (low-frequency oscillator) is a slow wobble. It is too slow to hear as a note, but it can make vibrato (pitch wobble) or tremolo (volume wobble).' },
]
const byId = (id: Id) => MODS.find((m) => m.id === id)!
const AUDIO: Id[] = ['VCO', 'VCF', 'VCA', 'OUT']
const outPt = (id: Id) => ({ x: byId(id).x + W, y: byId(id).y + H / 2 })
const inPt = (id: Id) => ({ x: byId(id).x, y: byId(id).y + H / 2 })
const topPt = (id: Id, dx: number) => ({ x: byId(id).x + W * dx, y: byId(id).y })
const botPt = (id: Id) => ({ x: byId(id).x + W / 2, y: byId(id).y + H })
type P = { x: number; y: number }
const vcable = (a: P, b: P) => `M${a.x},${a.y} C${a.x},${a.y + 26} ${b.x},${b.y - 26} ${b.x},${b.y}`
// LFO patch points: one input jack on top of each module the LFO can wiggle
const LFO_JACKS: { t: Exclude<LfoTarget, 'none'>; to: Id; dx: number; label: string; says: string }[] = [
  { t: 'pitch', to: 'VCO', dx: 0.35, label: 'pitch', says: 'vibrato, the wobbly singer voice' },
  { t: 'filter', to: 'VCF', dx: 0.3, label: 'cutoff', says: 'wah-wah, the classic dubstep / funk wobble' },
  { t: 'amp', to: 'VCA', dx: 0.2, label: 'volume', says: 'tremolo, the helicopter chop' },
]
const LFO_COLOR = '#4dc3ff'
const SHAPES: { s: LfoShape; label: string }[] = [{ s: 'sine', label: 'Sine' }, { s: 'triangle', label: 'Tri' }, { s: 'square', label: 'Square' }]
const MODCABLES: { from: Id; to: Id; dx: number; color: string }[] = [
  { from: 'ENV', to: 'VCF', dx: 0.75, color: '#ff9f43' },
  { from: 'ENV', to: 'VCA', dx: 0.5, color: '#ff9f43' },
]
const WAVES: { w: Wave; label: string }[] = [
  { w: 'sine', label: 'Sine' }, { w: 'triangle', label: 'Tri' }, { w: 'square', label: 'Square' }, { w: 'sawtooth', label: 'Saw' },
]
// cutoff slider is logarithmic (40..12000 Hz) so low notes of the dial matter as much as high ones
const cutToPos = (c: number) => Math.round((Math.log(c / 40) / Math.log(300)) * 100)
const posToCut = (p: number) => Math.round(40 * Math.pow(300, p / 100))

export function PatchDrawer({ onClose }: { onClose: () => void }) {
  const synth = getSynth()
  const [params, setParams] = useState<SynthParams>({ ...synth.params })
  const [hear, setHear] = useState(false)
  const [sel, setSel] = useState<Id | null>(null)
  const [tab, setTab] = useState<'sound' | 'quests'>('sound')
  const [game, setGame] = useState(false)
  const [from, setFrom] = useState<Id | null>(null)
  const [armed, setArmed] = useState(false)
  const [links, setLinks] = useState<string[]>([])
  const [msg, setMsg] = useState('Click an output jack, then the input jack it flows into.')

  useEffect(() => synth.onParams?.((p) => setParams({ ...p })), [synth])

  // keyboard -> synth, only while the toggle is ON
  useEffect(() => {
    if (!hear) return
    // on-screen/computer-key notes already sound by themselves (see music/localNotes.ts)
    const off = onNote((e) => { if (isLocalNote(e)) return; if (e.on) synth.noteOn(e.note, e.velocity); else synth.noteOff(e.note) })
    return () => { off(); synth.panic() }
  }, [hear, synth])
  useEffect(() => () => synth.panic(), [synth])

  const toggleHear = async () => {
    if (hear) { synth.panic(); setHear(false); return }
    await synth.unlock()
    setHear(true)
  }

  const set = (p: Partial<SynthParams>) => synth.setParams(p)
  const blur = (e: React.PointerEvent<HTMLInputElement>) => e.currentTarget.blur()
  const activePreset = PRESETS.find((p) => Object.entries(p.params).every(([k, v]) => params[k as keyof SynthParams] === v))

  const done = links.length === 3
  const clickJack = (kind: 'in' | 'out', id: Id) => {
    if (done) return
    if (kind === 'out') { setFrom(from === id ? null : id); setMsg(from === id ? 'Cancelled.' : `Picked ${id}. Now click an input jack.`); return }
    if (!from) { setMsg('Start with an output jack (right side of a module).'); return }
    if (AUDIO.indexOf(id) === AUDIO.indexOf(from) + 1) {
      const key = `${from}>${id}`
      const next = links.includes(key) ? links : [...links, key]
      setLinks(next)
      setMsg(next.length === 3 ? 'Patched! 🎉 Buzz, to tone, to volume, to speakers!' : `Nice, ${from} → ${id}. Keep going!`)
    } else setMsg(`Hmm, ${from} doesn't go straight into ${id}. Sound flows VCO → VCF → VCA → OUT.`)
    setFrom(null)
  }
  const resetGame = () => { setLinks([]); setFrom(null); setMsg('Reset! Click an output jack, then an input jack.') }

  const lfoT = params.lfoTarget ?? 'none'
  const lfoJack = LFO_JACKS.find((j) => j.t === lfoT)
  const unpatch = () => { set({ lfoTarget: 'none' }); setArmed(false) }
  const clickLfoOut = () => { if (lfoT !== 'none') unpatch(); else setArmed((a) => !a) }
  const clickLfoIn = (t: Exclude<LfoTarget, 'none'>) => {
    if (lfoT === t) { unpatch(); return }
    if (!armed && lfoT === 'none') return
    set({ lfoTarget: t, ...((params.lfoDepth ?? 0) < 0.05 ? { lfoDepth: 0.5 } : {}) })
    setArmed(false)
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <aside className="pd" onPointerDown={stop} aria-label="Patch drawer">
      <div className="pd-head">
        <b>🎛️ Patch</b>
        <button className="pd-x" onClick={onClose} aria-label="Close patch drawer">✕</button>
      </div>
      <div className="pd-tabs" role="group" aria-label="Drawer section">
        <button className={'pd-tab' + (tab === 'sound' ? ' on' : '')} aria-pressed={tab === 'sound'} onClick={() => setTab('sound')}>🎛️ Sound</button>
        <button className={'pd-tab' + (tab === 'quests' ? ' on' : '')} aria-pressed={tab === 'quests'} onClick={() => setTab('quests')}>🧩 Quests</button>
      </div>
      {tab === 'sound' ? (
        <>
      <p className="pd-sub">Change the sound and watch the sparks change too.</p>

      <svg className="pd-svg" viewBox="0 0 340 150" role="img" aria-label="Synth patch diagram">
        {MODCABLES.map((c) => (
          <path key={c.from + c.to} className="pd-mcable" stroke={c.color} d={vcable(botPt(c.from), topPt(c.to, c.dx))} />
        ))}
        {lfoJack && (() => {
          const a = botPt('LFO'), b = topPt(lfoJack.to, lfoJack.dx)
          const path = vcable(a, b)
          return (
            <g className="pd-lfo-patch" onClick={unpatch}>
              <path className="pd-lfocable" d={path} />
              <path d={path} className="pd-lfohit"><title>Click to unplug</title></path>
            </g>
          )
        })()}
        {AUDIO.slice(0, 3).map((id, i) => {
          const a = outPt(id), b = inPt(AUDIO[i + 1])
          return <path key={id} className={'pd-acable' + (game ? ' faint' : '')} d={`M${a.x},${a.y} L${b.x},${b.y}`} />
        })}
        {links.map((k) => {
          const [a, b] = k.split('>') as [Id, Id]
          const p1 = outPt(a), p2 = inPt(b)
          return <path key={k} className="pd-cable" stroke={byId(a).color} d={`M${p1.x},${p1.y} C${p1.x + 8},${p1.y + 20} ${p2.x - 8},${p2.y + 20} ${p2.x},${p2.y}`} />
        })}
        {MODS.map((m) => (
          <g key={m.id} className={'pd-mod' + (sel === m.id ? ' sel' : '')} onClick={() => setSel(m.id)}>
            <rect x={m.x} y={m.y} width={W} height={H} rx={8} />
            <rect className="pd-bar" x={m.x} y={m.y} width={W} height={4} rx={2} style={{ fill: m.color }} />
            <text x={m.x + W / 2} y={m.y + 25}>{m.label}</text>
          </g>
        ))}
        <g>
          <circle className={'pd-jack lfo' + (armed || lfoT !== 'none' ? ' on' : '')} cx={botPt('LFO').x} cy={botPt('LFO').y} r={6} role="button" aria-label="LFO output jack" onClick={clickLfoOut}><title>LFO out</title></circle>
          {LFO_JACKS.map((j) => {
            const pt = topPt(j.to, j.dx)
            return <circle key={j.t} className={'pd-jack lfo' + (armed ? ' ready' : '') + (lfoT === j.t ? ' on' : '')} cx={pt.x} cy={pt.y} r={6} role="button" aria-label={`LFO to ${j.label}`} onClick={() => clickLfoIn(j.t)}><title>{j.label}</title></circle>
          })}
        </g>
        {game && AUDIO.map((id) => (
          <g key={id}>
            {id !== 'OUT' && <circle className={'pd-jack' + (from === id ? ' on' : '')} cx={outPt(id).x} cy={outPt(id).y} r={7} onClick={() => clickJack('out', id)} />}
            {id !== 'VCO' && <circle className="pd-jack" cx={inPt(id).x} cy={inPt(id).y} r={7} onClick={() => clickJack('in', id)} />}
          </g>
        ))}
      </svg>
      <div className="pd-info" aria-live="polite">
        {sel ? <><b>{sel}:</b> {byId(sel).info}</> : 'Tap a module to learn what it does. Dashed cables = one module turning another one\'s knob.'}
      </div>

      <div className="pd-row">
        <button className={'pd-pill' + (game ? ' on' : '')} onClick={() => { setGame((g) => !g); resetGame() }}>🔌 Build the patch</button>
        {game && <button className="pd-pill ghost" onClick={resetGame}>Reset</button>}
      </div>
      {game && <div className={'pd-msg' + (done ? ' ok' : '')}>{msg}</div>}

      <h4>Sounds</h4>
      <div className="pd-presets">
        {PRESETS.map((p) => (
          <button key={p.id} className={'pd-preset' + (activePreset?.id === p.id ? ' on' : '')} title={p.blurb} onClick={() => set(p.params)}>
            <span>{p.emoji}</span> {p.name}
          </button>
        ))}
      </div>

        </>
      ) : <QuestsPanel params={params} />}

      <h4>Knobs</h4>
      <div className="pd-waves" role="group" aria-label="Wave shape">
        {WAVES.map((x) => (
          <button key={x.w} className={'pd-wave' + (params.wave === x.w ? ' on' : '')} onClick={() => set({ wave: x.w })}>{x.label}</button>
        ))}
      </div>
      <label className="pd-knob"><span>Cutoff <i>dark ↔ bright</i><b>{Math.round(params.cutoff)} Hz</b></span>
        <input type="range" min={0} max={100} step={1} value={cutToPos(params.cutoff)} onPointerUp={blur} onChange={(e) => set({ cutoff: posToCut(Number(e.target.value)) })} /></label>
      <label className="pd-knob"><span>Resonance <i>halo rings</i><b>{params.resonance.toFixed(1)}</b></span>
        <input type="range" min={0.1} max={20} step={0.1} value={params.resonance} onPointerUp={blur} onChange={(e) => set({ resonance: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Attack <i>bloom in</i><b>{params.attack.toFixed(2)} s</b></span>
        <input type="range" min={0.002} max={2} step={0.002} value={params.attack} onPointerUp={blur} onChange={(e) => set({ attack: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Decay <i>drop-off</i><b>{params.decay.toFixed(2)} s</b></span>
        <input type="range" min={0.01} max={2} step={0.01} value={params.decay} onPointerUp={blur} onChange={(e) => set({ decay: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Sustain <i>hold level</i><b>{Math.round(params.sustain * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.01} value={params.sustain} onPointerUp={blur} onChange={(e) => set({ sustain: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Release <i>linger</i><b>{params.release.toFixed(2)} s</b></span>
        <input type="range" min={0.01} max={3} step={0.01} value={params.release} onPointerUp={blur} onChange={(e) => set({ release: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Detune <i>ghost copy</i><b>{Math.round(params.detune)} ¢</b></span>
        <input type="range" min={-50} max={50} step={1} value={params.detune} onPointerUp={blur} onChange={(e) => set({ detune: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>Glide <i>streaks</i><b>{params.glide.toFixed(2)} s</b></span>
        <input type="range" min={0} max={0.5} step={0.01} value={params.glide} onPointerUp={blur} onChange={(e) => set({ glide: Number(e.target.value) })} /></label>

      <h4>LFO wobble</h4>
      <div className="pd-msg pd-lfomsg" aria-live="polite">
        {lfoJack ? <>🔌 Patched to <b>{lfoJack.label}</b>: {lfoJack.says}. Click the cable to unplug.</>
          : armed ? 'Now click a jack on top of VCO, VCF or VCA.' : 'Click the LFO jack (under the LFO box), then a jack on top of VCO, VCF or VCA.'}
      </div>
      <div className="pd-waves" role="group" aria-label="LFO shape">
        {SHAPES.map((x) => (
          <button key={x.s} className={'pd-wave' + (params.lfoShape === x.s ? ' on' : '')} onClick={() => set({ lfoShape: x.s })}>{x.label}</button>
        ))}
      </div>
      <label className="pd-knob"><span>LFO rate <i>wobble speed</i><b>{(params.lfoRate ?? 5).toFixed(1)} Hz</b></span>
        <input type="range" min={0.1} max={12} step={0.1} value={params.lfoRate ?? 5} onPointerUp={blur} onChange={(e) => set({ lfoRate: Number(e.target.value) })} /></label>
      <label className="pd-knob"><span>LFO depth <i>how much</i><b>{Math.round((params.lfoDepth ?? 0) * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.01} value={params.lfoDepth ?? 0} onPointerUp={blur} onChange={(e) => set({ lfoDepth: Number(e.target.value) })} /></label>


      <button className={'pd-hear' + (hear ? ' on' : '')} aria-pressed={hear} onClick={() => void toggleHear()}>
        🔊 Hear it through the synth: {hear ? 'ON' : 'OFF'}
      </button>
      <p className="pd-fine">{hear ? 'Your keyboard now plays through the synth.' : 'Off by default, since your keyboard may have its own speakers. The sparks change either way!'}</p>
    </aside>
  )
}
