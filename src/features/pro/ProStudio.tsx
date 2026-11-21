// BOSS STUDIO: the display of Boss (Dad) mode. No visualizer here: the display is the studio workspace itself.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EmulatorPanel } from '../synth-history/EmulatorPanel'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL } from '../../music/theory'
import { useMaster, startMaster, stopMaster, tapTempo, isRunning } from '../../music/masterClock'
import { stopAll as stopLoops } from '../loopstation/loopEngine'
import { setGuide } from '../loopstation/guide'
import { useProfile } from '../../profile/profile'
import { setSheetOn, useSheet } from '../../music/scoreStore'
import { MixerPanel, MonitorPanel, RackPanel, RoutingPanel, SessionHeader, Lcd } from './ProParts'
import { setDiag, setStage, startLoadProbe, useBoss } from './bossStore'
import { mixerClose } from './mixer'
import { startMonitor, stopMonitor } from './monitor'
import { panicAll } from './panic'
import { useScenes, recallScene } from './scenes'
import { CHANNELS } from './mixer'
import { AirplaneSwitch } from '../../offline/AirplaneSwitch'
import { peak as djPeak, getView } from '../dj/engine'
import './pro.css'

/** Everything Boss mode switches on while it is showing, and puts back when it closes. */
function useBossSession() {
  useEffect(() => {
    startMonitor()
    const stopProbe = startLoadProbe()
    const prevSheet = useSheet.getState().on
    setSheetOn(false) // sheet music is optional in Boss mode: off until asked for
    document.body.classList.add('bx-on')
    return () => {
      stopMonitor(); stopProbe(); mixerClose(); setStage(false); setDiag(false)
      setSheetOn(prevSheet)
      document.body.classList.remove('bx-on', 'bx-stage')
      // really leaving Boss mode (not a hot-reload or a kid switch): nothing of the studio may keep sounding in kid mode
      if (useProfile.getState().mode !== 'dad') {
        try { stopLoops(); setGuide({ on: false }); if (isRunning()) stopMaster() } catch { /* keep going */ }
      }
    }
  }, [])
}

function MasterMeter({ big }: { big?: boolean }) {
  const [v, setV] = useState(0)
  const hold = useRef(0)
  useEffect(() => {
    const keys = CHANNELS.find((c) => c.id === 'keys')!
    const h = window.setInterval(() => {
      const p = Math.min(1, Math.max(keys.peak?.() ?? 0, getView().ready ? djPeak() : 0) * 2.2)
      hold.current = Math.max(p, hold.current * 0.88); setV(hold.current)
    }, 90)
    return () => clearInterval(h)
  }, [])
  return <div className={'bx-hmeter' + (big ? ' big' : '')} role="meter" aria-label="Output level" aria-valuenow={Math.round(v * 100)}><i style={{ width: Math.round(v * 100) + '%' }} /></div>
}

/** Performance view: only the essentials, big and clean. The keybed and the controller dock stay (they are outside the display). */
function Stage() {
  const m = useMaster()
  const key = useHarmonyStore((s) => s.key)
  const chord = useHarmonyStore((s) => s.chord)
  const scenes = useScenes((s) => s.scenes)
  useEffect(() => {
    document.body.classList.add('bx-stage')
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setStage(false) } }
    window.addEventListener('keydown', esc)
    return () => { document.body.classList.remove('bx-stage'); window.removeEventListener('keydown', esc) }
  }, [])
  return (
    <div className="bx-stage-v" role="region" aria-label="Performance view">
      <div className="bx-big">
        <Lcd label="KEY">{PC_NAMES[key.tonic]} <small>{SCALE_LABEL[key.scale]}</small></Lcd>
        <Lcd label="CHORD" wide>{chord ?? '–'}</Lcd>
        <Lcd label="BPM">{Math.round(m.bpm)}</Lcd>
      </div>
      <MasterMeter big />
      <div className="bx-scenechips">{scenes.map((s, i) => s && <button key={i} className="bx-chip" onClick={() => recallScene(i)}>{i + 1} {s.name}</button>)}</div>
      <div className="bx-transport">
        <button className={'bx-b' + (m.running ? ' on' : '')} onClick={() => (m.running ? stopMaster() : startMaster())}>{m.running ? '■ STOP' : '▶ START'}</button>
        <button className="bx-b" onClick={() => tapTempo()}>TAP</button>
        <button className="bx-b bx-panic" onClick={panicAll}>PANIC</button>
        <AirplaneSwitch desk />
        <button className="bx-b" onClick={() => setStage(false)}>EXIT STAGE (Esc)</button>
      </div>
    </div>
  )
}

/** The STUDIO workspace. `diag` is the old DEV tool set, tucked behind "⋯ diag". */
export function ProStudio({ diag }: { diag: ReactNode }) {
  useBossSession()
  const stage = useBoss((s) => s.stage)
  const showDiag = useBoss((s) => s.diag)
  const [emu, setEmu] = useState<string | null>(null)
  return (
    <div className="bx-ws" data-boss>
      {stage ? <Stage /> : (
        <>
          <SessionHeader onDiag={() => setDiag(!showDiag)} />
          <div className="bx-grid">
            <MixerPanel />
            <RackPanel openEmu={setEmu} />
            <RoutingPanel />
          </div>
        </>
      )}
      {emu && <div className="bx-over"><EmulatorPanel key={emu} id={emu} onBack={() => setEmu(null)} /></div>}
      {showDiag && !stage && <div className="bx-over bx-diag"><div className="bx-ph"><h3>⋯ Diagnostics</h3><button className="bx-b" onClick={() => setDiag(false)}>CLOSE</button></div><div className="bx-diag-body"><MonitorPanel />{diag}</div></div>}
    </div>
  )
}
