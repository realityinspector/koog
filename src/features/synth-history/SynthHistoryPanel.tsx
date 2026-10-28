import { useState } from 'react'
import { Timeline } from './Timeline'
import { SynthPlayground } from './SynthPlayground'
import './synth-history.css'

const TABS = ['Timeline', 'Playground'] as const

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
      <div className="sh-hint" style={{ fontSize: 15, opacity: 1, margin: '8px 0', padding: '10px 14px', borderRadius: 12, background: 'rgba(124,92,255,.16)', border: '1px dashed #7c5cff' }}>
        🎛️ The Patch Lab now lives on the Play tab: open the visualizer's Patch drawer!
      </div>
      {tab === 'Timeline' && <Timeline />}
      {tab === 'Playground' && <SynthPlayground />}
    </section>
  )
}
