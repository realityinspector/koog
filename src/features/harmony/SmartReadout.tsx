import { useState } from 'react'
import './harmony.css'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL } from '../../music/theory'
import { KeyPopover } from './KeyPopover'
import { SmartBandChip } from '../smartband/SmartBandChip'
import { useJudge } from '../../music/judge'

function Bar({ label, v, tip }: { label: string; v: number; tip: string }) {
  const pct = Math.round(v * 100)
  return (
    <span className="sr-pw" title={tip}>
      <span className="sr-pwl">{label}</span>
      <span className="sr-meter sr-meter-s" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${pct}%` }} /></span>
    </span>
  )
}

/** Music power: the judge's three meters (src/music/judge.ts). */
function PowerCell() {
  const harmony = useJudge((s) => s.harmony)
  const rhythm = useJudge((s) => s.rhythm)
  const style = useJudge((s) => s.style)
  return (
    <div className="sr-cell sr-power" data-power-readout>
      <span className="sr-lbl">MUSIC POWER</span>
      <Bar label="KEY" v={harmony} tip="Notes that fit the key. Out-of-key notes are fine if you step back in (tension → release)!" />
      <Bar label="BEAT" v={rhythm} tip="Steady rhythm: gaps between notes that match (same, half or double)" />
      <Bar label="STYLE" v={style} tip="Smooth melodies, repeated patterns (motifs) and endings on the home note (cadences)" />
    </div>
  )
}

function BoomMeter() {
  const charge = useJudge((s) => s.charge)
  const full = charge >= 1
  return (
    <span className={'sr-boom' + (full ? ' full' : '')} title="⚡ BOOM: play in key to charge it. When it's full, a forearm slam becomes a BOOM instead of a fizzle.">
      ⚡<span className="sr-meter sr-meter-s"><i style={{ width: `${Math.round(charge * 100)}%` }} /></span>{full ? 'BOOM READY' : 'BOOM'}
    </span>
  )
}

function mult(streak: number) {
  if (streak >= 32) return 'ON FIRE'
  if (streak >= 16) return 'x3'
  if (streak >= 8) return 'x2'
  return ''
}

/** LCD-style smart readouts for the top-left of the display. */
export function SmartReadout() {
  const { key, autoDetect, streak, bestStreak, chord, lastJudgement } = useHarmonyStore()
  const [open, setOpen] = useState(false)
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
      <PowerCell />
      <div className="sr-cell">
        <span className="sr-lbl">STREAK{m && <span className="sr-mult">{m}</span>}</span>
        <b className="sr-val sr-streak" key={streak}>{streak}</b>
        <span className="sr-best">BEST {bestStreak}{lastJudgement === 'out' ? ' · spicy!' : ''}</span>
        <BoomMeter />
      </div>
      <SmartBandChip />
    </div>
  )
}
