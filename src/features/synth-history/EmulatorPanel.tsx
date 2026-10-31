// A playable emulator: faceplate with knobs, presets, "why it mattered", and a Learn-a-piece helper.
// While open it registers as the app's active instrument so on-screen keys, typed keys and MIDI play it.
import { useEffect, useState } from 'react'
import { setActiveInstrument } from '../../music/instrument'
import { createEngine, type Engine } from './emu/core'
import { onEmuSet } from './emu/bus'
import { getEmu } from './emu'
import { ControlRow } from './emu/EmuControls'
import { FieldPad, Seq303, TapeBar } from './emu/EmuExtras'
import { EmuLearn } from './emu/EmuLearn'
import { SONGS } from '../songs/songs'
import './emu/emu.css'

export function EmulatorPanel({ id, preset = 0, onBack }: { id: string; preset?: number; onBack: () => void }) {
  const spec = getEmu(id)!
  const [engine, setEngine] = useState<Engine | null>(null)
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(spec.ctls.map((c) => [c.key, c.def])))
  const [pre, setPre] = useState(-1)
  const [pop, setPop] = useState<'why' | 'learn' | null>(null)

  const change = (k: string, v: number) => { engine?.set(k, v); setVals((s) => ({ ...s, [k]: v })); setPre(-1) }
  const applyPreset = (i: number, e: Engine | null = engine) => {
    const p = spec.presets[i]; if (!p) return
    const next: Record<string, number> = {}
    for (const c of spec.ctls) next[c.key] = p.values[c.key] ?? c.def
    for (const [k, v] of Object.entries(next)) e?.set(k, v)
    setVals(next); setPre(i)
  }
  useEffect(() => {
    const engine = createEngine(spec)
    setEngine(engine)
    applyPreset(preset, engine)
    setActiveInstrument({
      id: spec.id, name: spec.name,
      noteOn: (n, v) => engine.noteOn(n, v), noteOff: (n) => engine.noteOff(n),
      allOff: () => engine.allOff(), unlock: () => engine.unlock(),
    })
    // Controller Mode (a knob on the hardware) changes engine params from outside: keep the faceplate in step
    const offSet = onEmuSet((e, k, v) => { if (e === engine) setVals((s) => (s[k] === v ? s : { ...s, [k]: v })) })
    const w = window as unknown as { __emuPeak?: () => number; __emu?: Engine }
    w.__emuPeak = () => engine.peak(); w.__emu = engine
    return () => {
      offSet()
      setActiveInstrument(null)
      engine.allOff(); engine.dispose()
      delete w.__emuPeak; delete w.__emu
    }
  }, [spec]) // eslint-disable-line react-hooks/exhaustive-deps

  const songIds = spec.songs.filter((s) => SONGS.some((x) => x.id === s))
  return (
    <div className={'emu ' + spec.skin} onPointerDown={() => { void engine?.unlock() }}>
      <div className="emu-top">
        <button className="btn-ghost emu-back" aria-label="Back to timeline" onClick={onBack}>◀ Timeline</button>
        <div className="emu-title"><h3>{spec.name}</h3><span>{spec.year}</span></div>
        <div className="emu-presets" role="group" aria-label="Presets">
          {spec.presets.map((p, i) => <button key={p.name} className={pre === i ? 'on' : ''} onClick={() => applyPreset(i)}>{p.name}</button>)}
        </div>
      </div>
      <div className="emu-tabs">
        <span className="emu-legal">Educational emulation. Not affiliated with or endorsed by the makers. Names are trademarks of their owners.</span>
        <button className={pop === 'why' ? 'on' : ''} onClick={() => setPop(pop === 'why' ? null : 'why')}>ℹ️ Why it mattered</button>
        <button className={pop === 'learn' ? 'on' : ''} onClick={() => setPop(pop === 'learn' ? null : 'learn')}>🎼 Learn a piece</button>
      </div>
      <div className="emu-pop emu-why" hidden={pop !== 'why'}><h4>Why it mattered</h4><p>{spec.blurb}</p>{spec.note && <p className="emu-warn">{spec.note}</p>}</div>
      <EmuLearn ids={songIds} why={spec.songWhy} open={pop === 'learn'} />
      <div className="emu-plate">
        <ControlRow ctls={spec.ctls} values={vals} onChange={change} />
        {engine && spec.extra === 'field' && spec.fieldRange && <FieldPad engine={engine} range={spec.fieldRange} />}
        {engine && spec.extra === 'seq303' && <Seq303 engine={engine} />}
        {spec.extra === 'tape' && <TapeBar />}
      </div>
    </div>
  )
}
