import { useState } from 'react'
import { Timeline } from './Timeline'
import { SynthPlayground } from './SynthPlayground'
import { PatchLab } from './PatchLab'
import './synth-history.css'

const TABS = ['Timeline', 'Playground', 'Patch Lab'] as const

export function SynthHistoryPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Timeline')
  return (
    <section className="sh">
      <div className="sh-head">
        <h2>🎛️ Synth History</h2>
        <div className="sh-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={'sh-tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'Timeline' && <Timeline />}
      {tab === 'Playground' && <SynthPlayground />}
      {tab === 'Patch Lab' && <PatchLab />}
    </section>
  )
}
