import { useEffect, useState } from 'react'
import { consume, linkNote, report, useLinkIn } from '../../links/bus'
import { getEmu } from './emu'
import { Timeline } from './Timeline'
import { InstrumentsRack } from './InstrumentsRack'
import { SynthPlayground } from './SynthPlayground'
import { EmulatorPanel } from './EmulatorPanel'
import './synth-history.css'

const TABS = ['🎹 Instruments', '🕰 Timeline', 'Playground'] as const

export function SynthHistoryPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('🎹 Instruments')
  const [emu, setEmu] = useState<{ id: string; preset: number } | null>(null)
  // Links: open a playable emulator from a canonical link; report which one is open
  const req = useLinkIn((s) => s.emu)
  useEffect(() => {
    if (req === undefined) return
    consume('emu')
    // #/synth = the instruments, #/synth/timeline = the history, #/synth/<instrument> = one instrument open
    if (req === 'timeline') { setTab('🕰 Timeline'); setEmu(null); return }
    if (!req) { setTab('🎹 Instruments'); setEmu(null); return }
    if (req && !getEmu(req)) linkNote("That link mentions a synth Koog doesn't have")
    setEmu(req && getEmu(req) ? { id: req, preset: 0 } : null)
  }, [req])
  useEffect(() => { report({ emu: emu?.id ?? (tab === '🕰 Timeline' ? 'timeline' : null) }) }, [emu?.id, tab])
  useEffect(() => () => report({ emu: null }), [])
  if (emu) return <section className="sh"><EmulatorPanel key={emu.id + emu.preset} id={emu.id} preset={emu.preset} onBack={() => setEmu(null)} /></section>
  return (
    <section className="sh">
      <div className="sh-head">
        <div className="sh-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={'sh-tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <span className="sh-chip" title="Open PLAY, then the visualizer's 🎛️ Patch button">🎛️ Patch Lab lives in PLAY → Patch</span>
      </div>
      {tab === '🎹 Instruments' && <InstrumentsRack onPlay={(id) => setEmu({ id, preset: 0 })} />}
      {tab === '🕰 Timeline' && <Timeline onPlay={(id, preset) => setEmu({ id, preset })} />}
      {tab === 'Playground' && <SynthPlayground />}
    </section>
  )
}
