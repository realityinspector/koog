import { useState } from 'react'
import './harmony.css'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL } from '../../music/theory'
import { KeyPopover } from './KeyPopover'

function mult(streak: number) {
  if (streak >= 32) return 'ON FIRE'
  if (streak >= 16) return 'x3'
  if (streak >= 8) return 'x2'
  return ''
}

/** LCD-style smart readouts for the top-left of the display. */
export function SmartReadout() {
  const { key, autoDetect, streak, bestStreak, accuracy, chord, lastJudgement } = useHarmonyStore()
  const [open, setOpen] = useState(false)
  const pct = Math.round(accuracy * 100)
  const keyText = `${PC_NAMES[key.tonic]} ${SCALE_LABEL[key.scale]}`
  const m = mult(streak)
  return (
    <div className="sr">
      <div className="sr-cell sr-keywrap">
        <button className="sr-key" data-key-readout aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
          title="Change key, scale or Can't-miss mode">
          <span className="sr-lbl">KEY <i className={'sr-led' + (autoDetect ? ' on' : '')} aria-hidden /><span className="sr-auto">{autoDetect ? 'AUTO' : 'SET'}</span></span>
          <b className="sr-val" key={keyText}>{keyText}</b>
        </button>
        {open && <KeyPopover onClose={() => setOpen(false)} />}
      </div>
      <div className="sr-cell">
        <span className="sr-lbl">CHORD</span>
        <b className="sr-val sr-chord" key={chord ?? 'none'} aria-live="polite">{chord ?? '—'}</b>
      </div>
      <div className="sr-cell" title="Share of your last 24 notes that fit the key">
        <span className="sr-lbl">IN KEY</span>
        <span className="sr-meter" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="In key"><i style={{ width: `${pct}%` }} /></span>
        <b className="sr-small">{pct}%</b>
      </div>
      <div className="sr-cell">
        <span className="sr-lbl">STREAK{m && <span className="sr-mult">{m}</span>}</span>
        <b className="sr-val sr-streak" key={streak}>{streak}</b>
        <span className="sr-best">BEST {bestStreak}{lastJudgement === 'out' ? ' · spicy!' : ''}</span>
      </div>
    </div>
  )
}
