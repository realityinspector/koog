import { useState } from 'react'
import { Timeline } from './Timeline'
import { SynthPlayground } from './SynthPlayground'
import { EmulatorPanel } from './EmulatorPanel'
import './synth-history.css'

const TABS = ['Timeline', 'Playground'] as const

export function SynthHistoryPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Timeline')
  const [emu, setEmu] = useState<{ id: string; preset: number } | null>(null)
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
      {tab === 'Timeline' && <Timeline onPlay={(id, preset) => setEmu({ id, preset })} />}
      {tab === 'Playground' && <SynthPlayground />}
    </section>
  )
}
