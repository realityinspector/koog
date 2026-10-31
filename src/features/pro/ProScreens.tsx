// Rail screens for Boss mode: DJ, LOOPS, SYNTHS, SCENES.
import { useState, useSyncExternalStore } from 'react'
import { LoopStation } from '../loopstation/LoopStation'
import { EmulatorPanel } from '../synth-history/EmulatorPanel'
import { EMULATORS } from '../synth-history/emu'
import { MODES, dispatch, ensure, fx, getVersion, getView, subscribe } from '../dj/engine'
import { SurfaceToggle } from '../controller/SurfaceToggle'
import { useSurface, setScreenMode } from '../controller/surface'
import { ScenesPanel, Panel } from './ProParts'
import type { DeckId } from '../dj/map'
import './pro.css'

export function LoopsScreen() { return <div className="bx-screen"><LoopStation /></div> }
export function ScenesScreen() { return <div className="bx-screen"><ScenesPanel big /></div> }

export function SynthsScreen() {
  const [id, setId] = useState<string | null>(null)
  if (id) return <div className="bx-screen"><EmulatorPanel key={id} id={id} onBack={() => setId(null)} /></div>
  return (
    <div className="bx-screen">
      <Panel title="Emulator rack">
        <div className="bx-emus">
          {EMULATORS.map((e) => <button key={e.id} className="bx-emu" onClick={() => setId(e.id)}><b>{e.name}</b><small>{e.year}</small><span>{e.blurb}</span></button>)}
        </div>
      </Panel>
    </div>
  )
}

function Deck({ d }: { d: DeckId }) {
  const v = getView()[d]
  const press = (id: 'play' | 'cue' | 'sync' | 'padmode') => { void ensure(); dispatch({ id, deck: d, value: 1 } as never); if (id === 'cue') setTimeout(() => dispatch({ id, deck: d, value: 0 } as never), 120) }
  const slide = (id: string, val: number) => { void ensure(); dispatch({ id, deck: d, value: val } as never) }
  return (
    <div className="bx-deck">
      <h4>Deck {d} <small>{v.trackName}</small></h4>
      <div className="bx-lcdrow"><span className="bx-lcdt">{v.bpm.toFixed(1)} bpm</span><span className="bx-lcdt">{v.key.tonic >= 0 ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][v.key.tonic] : ''}</span><span className="bx-lcdt">{MODES[v.mode]}</span></div>
      <div className="bx-seg">
        <button className={v.playing ? 'on' : ''} onClick={() => press('play')}>{v.playing ? '■ PLAY' : '▶ PLAY'}</button>
        <button onClick={() => press('cue')}>CUE</button><button className={v.synced ? 'on' : ''} onClick={() => press('sync')}>SYNC</button><button onClick={() => press('padmode')}>PADS</button>
      </div>
      {(['vol', 'tempo', 'hi', 'mid', 'low'] as const).map((k) => (
        <label className="bx-k" key={k}><span>{k.toUpperCase()}</span><input type="range" min={0} max={1000} value={Math.round(v[k] * 1000)} aria-label={`Deck ${d} ${k}`} onChange={(e) => slide(k, +e.target.value / 1000)} /></label>
      ))}
    </div>
  )
}
/** Minimal on-screen DJ for Boss mode (the full controller works as usual via DUO). */
export function DjScreen() {
  useSyncExternalStore(subscribe, getVersion)
  const v = getView()
  const surf = useSurface((s) => s.on)
  return (
    <div className="bx-screen">
      <Panel title="DJ decks" right={<><SurfaceToggle /><button className={'bx-b' + (surf ? ' on' : '')} onClick={() => setScreenMode(!surf)} title="On-screen synth controller">ON-SCREEN CTRL</button></>}>
        <div className="bx-decks">
          <Deck d="A" />
          <div className="bx-xf">
            <label className="bx-k"><span>X-FADE</span><input type="range" min={0} max={1000} value={Math.round(v.xf * 1000)} aria-label="Crossfader" onChange={(e) => { void ensure(); dispatch({ id: 'xfade', deck: null, value: +e.target.value / 1000 }) }} /></label>
            <div className="bx-seg">{(['echo', 'sweep', 'riser'] as const).map((k) => <button key={k} className={v.fx === k ? 'on' : ''} onClick={() => { void ensure(); fx(k) }}>{k.toUpperCase()}</button>)}</div>
            <p className="bx-dim">The tempo of the lead deck drives the master clock (STUDIO header).</p>
          </div>
          <Deck d="B" />
        </div>
      </Panel>
    </div>
  )
}
