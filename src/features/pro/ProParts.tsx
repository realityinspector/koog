// Boss mode building blocks: LCD readout, session header, mixer, instrument rack, routing, MIDI monitor, quick scenes.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL, type ScaleType } from '../../music/theory'
import { BPM_MAX, BPM_MIN, setBpm, setLink, startMaster, stopMaster, tapTempo, useMaster } from '../../music/masterClock'
import { useDevices, setRole, type DeviceRole } from '../../music/devices'
import { SOUNDS, chooseSound, useSound } from '../devices/soundChoice'
import { unlockAudio } from '../../music/localNotes'
import { getSynth } from '../synth-history/engine'
import { useSyncParams } from './useSyncParams'
import { EMULATORS } from '../synth-history/emu'
import { PRESETS } from '../synth-history/presets'
import { subscribe as beatsSub, getVersion as beatsVer, getState as beatsState, start as beatsStart, stop as beatsStop } from '../beats/engine'
import { subscribe as bandSub, getVersion as bandVer, getState as bandState, toggle as bandToggle } from '../smartband/engine'
import { SurfaceToggle } from '../controller/SurfaceToggle'
import { useSurface } from '../controller/surface'
import { SplitControl } from '../split/SplitControl'
import { CHANNELS, mixerOpen, setFader, toggleMute, toggleSolo, useMixer } from './mixer'
import { clearMonitor, monitorMessages, setMonitor, useMonitor } from './monitor'
import { panicAll } from './panic'
import { setStage, useBoss } from './bossStore'
import { SLOTS, recallScene, saveScene, useScenes } from './scenes'
import './pro.css'

export function Panel({ title, right, children, cls }: { title: string; right?: React.ReactNode; children: React.ReactNode; cls?: string }) {
  return (
    <section className={'bx-panel ' + (cls ?? '')}>
      <header className="bx-ph"><h3>{title}</h3>{right}</header>
      <div className="bx-pb">{children}</div>
    </section>
  )
}
export const Lcd = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={'bx-lcd' + (wide ? ' wide' : '')}><small>{label}</small><b>{children}</b></div>
)

/** Session header: tempo (master clock), key, chord, computer-sound state, load, panic, stage. */
export function SessionHeader({ onDiag }: { onDiag: () => void }) {
  const m = useMaster()
  const key = useHarmonyStore((s) => s.key)
  const auto = useHarmonyStore((s) => s.autoDetect)
  const chord = useHarmonyStore((s) => s.chord)
  const load = useBoss((s) => s.load)
  const [bpmText, setBpmText] = useState<string | null>(null)
  return (
    <div className="bx-head">
      <div className="bx-grp">
        <Lcd label="BPM"><input className="bx-in" aria-label="Master BPM" value={bpmText ?? String(Math.round(m.bpm * 10) / 10)} inputMode="decimal"
          onFocus={(e) => e.currentTarget.select()} onChange={(e) => setBpmText(e.target.value)}
          onBlur={() => { if (bpmText != null) { const v = parseFloat(bpmText); if (v) setBpm(v); setBpmText(null) } }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /></Lcd>
        <button className="bx-b" onClick={() => setBpm(m.bpm - 1)} aria-label="Slower">−</button>
        <button className="bx-b" onClick={() => setBpm(m.bpm + 1)} aria-label="Faster">+</button>
        <button className="bx-b" onClick={() => tapTempo()} title="Tap tempo">TAP</button>
        <button className={'bx-b' + (m.running ? ' on' : '')} aria-pressed={m.running} onClick={() => (m.running ? stopMaster() : startMaster())} title="Start / stop the shared clock">{m.running ? '■' : '▶'}</button>
        <button className={'bx-b bx-opt' + (m.link ? ' on' : '')} aria-pressed={m.link} onClick={() => setLink(!m.link)} title="Link: the beat machine follows this tempo (the DJ decks already drive it)">LINK</button>
        {m.following && <span className="bx-tag bx-opt" title="Following the DJ deck">DJ SYNC</span>}
      </div>
      <div className="bx-grp bx-keygrp">
        <Lcd label="KEY">
          <select aria-label="Key" className="bx-sel" value={key.tonic} onChange={(e) => useHarmonyStore.getState().setKey({ ...key, tonic: +e.target.value })}>{PC_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
          <select aria-label="Scale" className="bx-sel" value={key.scale} onChange={(e) => useHarmonyStore.getState().setKey({ ...key, scale: e.target.value as ScaleType })}>
            {(Object.keys(SCALE_LABEL) as ScaleType[]).map((s) => <option key={s} value={s}>{SCALE_LABEL[s]}</option>)}</select>
        </Lcd>
        <button className={'bx-b bx-opt' + (auto ? ' on' : '')} aria-pressed={auto} onClick={() => useHarmonyStore.getState().setAutoDetect(!auto)} title="Detect the key from what is played">AUTO</button>
        <Lcd label="CHORD">{chord ?? '–'}</Lcd>
      </div>
      <div className="bx-grp bx-right">
        <Lcd label="LOAD"><span className={load > 40 ? 'hot' : ''}>{load}%</span></Lcd>
        <button className="bx-b bx-panic" onClick={panicAll} title="All notes off, everywhere">PANIC</button>
        <button className="bx-b" onClick={() => setStage(true)} title="Performance view">STAGE</button>
        <button className="bx-b" onClick={onDiag} title="MIDI, pre-flight and test tools">⋯ diag</button>
      </div>
    </div>
  )
}

function useMeter(get?: () => number, active = true) {
  const [v, setV] = useState(0)
  const hold = useRef(0)
  useEffect(() => {
    if (!get || !active) return
    const h = window.setInterval(() => { const p = Math.min(1, get()); hold.current = Math.max(p, hold.current * 0.85); setV(hold.current) }, 90)
    return () => clearInterval(h)
  }, [get, active])
  return v
}
function Strip({ id }: { id: string }) {
  const c = CHANNELS.find((x) => x.id === id)!
  const fader = useMixer((s) => s.fader[id] ?? c.get())
  const muted = useMixer((s) => !!s.muted[id])
  const solo = useMixer((s) => s.solo === id)
  const dim = useMixer((s) => !!s.solo && s.solo !== id)
  const beats = useSyncExternalStore(beatsSub, beatsVer), band = useSyncExternalStore(bandSub, bandVer)
  void beats; void band
  const playing = id === 'beats' ? beatsState().playing : id === 'band' ? bandState().on : null
  const peak = useMeter(c.peak)
  const pct = Math.round(fader * 100)
  return (
    <div className={'bx-strip' + (muted || dim ? ' off' : '')} title={c.note}>
      <div className="bx-meter" aria-hidden><i style={{ height: Math.round(Math.min(1, peak * 2.2) * 100) + '%' }} /></div>
      <input className="bx-fader" type="range" min={0} max={100} value={pct} aria-label={c.label + ' level'} onChange={(e) => setFader(id, +e.target.value / 100)} />
      <output className="bx-val">{pct}</output>
      <div className="bx-sm">
        <button className={muted ? 'on mute' : ''} aria-pressed={muted} onClick={() => toggleMute(id)} aria-label={'Mute ' + c.label}>M</button>
        <button className={solo ? 'on solo' : ''} aria-pressed={solo} onClick={() => toggleSolo(id)} aria-label={'Solo ' + c.label}>S</button>
      </div>
      {playing !== null && <button className={'bx-run' + (playing ? ' on' : '')} aria-pressed={playing} onClick={() => (id === 'beats' ? (playing ? beatsStop() : beatsStart()) : bandToggle())}>{playing ? '■' : '▶'}</button>}
      <span className="bx-ch">{c.icon}<small>{c.label}</small></span>
    </div>
  )
}
export function MixerPanel() {
  useEffect(() => { mixerOpen() }, [])
  return <Panel title="Mixer" cls="bx-mixer"><div className="bx-strips">{CHANNELS.map((c) => <Strip key={c.id} id={c.id} />)}</div></Panel>
}

const KNOBS: { k: 'cutoff' | 'resonance' | 'filterEnv' | 'attack' | 'release'; l: string; min: number; max: number; log?: boolean }[] = [
  { k: 'cutoff', l: 'CUTOFF', min: 40, max: 12000, log: true }, { k: 'resonance', l: 'RES', min: 0.1, max: 20 }, { k: 'filterEnv', l: 'ENV', min: 0, max: 8000 },
  { k: 'attack', l: 'ATK', min: 0.002, max: 2 }, { k: 'release', l: 'REL', min: 0.01, max: 4 },
]
/** Current patch + quick access to every emulator + the Koog patch parameters. */
export function RackPanel({ openEmu }: { openEmu?: (id: string) => void }) {
  const sound = useSound((s) => s.id)
  const p = useSyncParams()
  return (
    <Panel title="Sound" cls="bx-rack">
      <div className="bx-chips" role="group" aria-label="Piano sound">
        {SOUNDS.map((s) => <button key={s.id} className={'bx-chip' + (sound === s.id ? ' on' : '')} aria-pressed={sound === s.id} onClick={() => { chooseSound(s.id); void unlockAudio() }}>{s.icon} {s.label}</button>)}
      </div>
      <h4>Koog patch</h4>
      <div className="bx-knobs">
        <label className="bx-k"><span>WAVE</span><select className="bx-sel" value={p.wave} onChange={(e) => getSynth().setParams({ wave: e.target.value as typeof p.wave })}>{['sawtooth', 'square', 'triangle', 'sine'].map((w) => <option key={w}>{w}</option>)}</select></label>
        {KNOBS.map((k) => {
          const v = p[k.k] as number
          const pos = k.log ? Math.log(v / k.min) / Math.log(k.max / k.min) : (v - k.min) / (k.max - k.min)
          return <label className="bx-k" key={k.k}><span>{k.l}</span>
            <input type="range" min={0} max={1000} value={Math.round(Math.max(0, Math.min(1, pos)) * 1000)} aria-label={k.l}
              onChange={(e) => { const t = +e.target.value / 1000; getSynth().setParams({ [k.k]: k.log ? k.min * Math.pow(k.max / k.min, t) : k.min + t * (k.max - k.min) }) }} /></label>
        })}
      </div>
      <div className="bx-chips">{PRESETS.slice(0, 8).map((pr) => <button key={pr.id} className="bx-chip sm" title={pr.blurb} onClick={() => getSynth().setParams(pr.params)}>{pr.name}</button>)}</div>
      <h4>Emulators</h4>
      <div className="bx-chips">
        {EMULATORS.map((e) => <button key={e.id} className="bx-chip sm" title={`${e.name} (${e.year}): open its panel`} onClick={() => { openEmu?.(e.id) }}>{e.name.replace(/ \(.*/, '')}</button>)}
      </div>
    </Panel>
  )
}

const ROLES: [DeviceRole, string][] = [['piano', 'Piano'], ['dj', 'DJ'], ['surface', 'Synth'], ['off', 'Off']]
export function RoutingPanel() {
  const devices = useDevices((s) => s.devices)
  const surf = useSurface((s) => s.on)
  return (
    <Panel title="Routing" cls="bx-route" right={<SurfaceToggle />}>
      {devices.length === 0 && <p className="bx-dim">No MIDI devices. Plug one in, or use the on-screen controller.</p>}
      {devices.map((d) => (
        <div className="bx-dev" key={d.id}>
          <i className={d.connected ? 'on' : ''} /><span title={d.name}>{d.name}</span>
          <div className="bx-seg" role="group" aria-label={'Role for ' + d.name}>{ROLES.map(([r, l]) => <button key={r} className={d.role === r ? 'on' : ''} aria-pressed={d.role === r} onClick={() => setRole(d.name, r)}>{l}</button>)}</div>
        </div>
      ))}
      <p className="bx-dim">Controller Mode: {surf ? 'ON, the controller runs the synth' : 'off (decks)'}</p>
      <h4>Keyboard split and layers</h4>
      <SplitControl />
    </Panel>
  )
}

const KINDS = ['note', 'cc', 'bend', 'pc', 'at', 'sys', 'other']
export function MonitorPanel() {
  useEffect(() => { void 0 }, [])
  useMonitor((s) => s.rev)
  const { paused, filter, kinds } = useMonitor()
  const msgs = monitorMessages().filter((m) => (kinds[m.kind] !== false) && (!filter || (m.text + m.hex + m.src).toLowerCase().includes(filter.toLowerCase()))).slice(0, 60)
  return (
    <Panel title="MIDI monitor" cls="bx-mon" right={<span className="bx-seg">
      <button className={paused ? 'on' : ''} aria-pressed={paused} onClick={() => setMonitor({ paused: !paused })}>{paused ? 'PAUSED' : 'PAUSE'}</button>
      <button onClick={clearMonitor}>CLEAR</button></span>}>
      <div className="bx-filter">
        <input className="bx-in sm" placeholder="filter…" aria-label="Filter MIDI messages" value={filter} onChange={(e) => setMonitor({ filter: e.target.value })} />
        {KINDS.slice(0, 4).map((k) => <button key={k} className={'bx-chip sm' + (kinds[k] === false ? '' : ' on')} aria-pressed={kinds[k] !== false} onClick={() => setMonitor({ kinds: { ...kinds, [k]: kinds[k] === false } })}>{k}</button>)}
      </div>
      <ul className="bx-log" aria-live="off" data-testid="midi-monitor">
        {msgs.length === 0 && <li className="bx-dim">Waiting for MIDI…</li>}
        {msgs.map((m) => <li key={m.n}><em className={'s-' + m.src}>{m.src}</em><code>{m.hex}</code><span>{m.text}</span>{m.ch ? <small>ch{m.ch}</small> : null}</li>)}
      </ul>
    </Panel>
  )
}

export function ScenesPanel({ big }: { big?: boolean }) {
  const { scenes, last } = useScenes()
  const [edit, setEdit] = useState(false)
  const slots = Array.from({ length: SLOTS }, (_, i) => i)
  return (
    <Panel title="Scenes" cls={big ? 'bx-scenes big' : 'bx-scenes'} right={<button className={'bx-b' + (edit ? ' on' : '')} aria-pressed={edit} onClick={() => setEdit(!edit)}>{edit ? 'SAVE MODE' : 'RECALL'}</button>}>
      <div className="bx-slots">
        {slots.map((i) => {
          const s = scenes[i]
          return <button key={i} className={'bx-slot' + (s ? ' full' : '') + (last === i ? ' cur' : '') + (edit ? ' edit' : '')} title={s ? `${s.name}: ${s.bpm} bpm, ${s.sound}` : 'empty'}
            onClick={() => { if (edit || !s) { const nm = !s ? window.prompt('Scene name', 'Scene ' + (i + 1)) : s.name; if (nm !== null) saveScene(i, nm || undefined) } else recallScene(i) }}>
            <b>{i + 1}</b><span>{s ? s.name : edit ? 'save here' : 'empty'}</span></button>
        })}
      </div>
      <p className="bx-dim">{edit ? 'Click a slot to save the current setup into it.' : 'Click a filled slot to recall. Empty slots save the current setup. Sound, patch, controller layout, split, mixer, bpm, key and sheet level are stored.'}</p>
    </Panel>
  )
}

