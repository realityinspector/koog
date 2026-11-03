import { useEffect, useState } from 'react'
import './harmony.css'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL } from '../../music/theory'
import { KeyPopover } from './KeyPopover'
import { useJudge } from '../../music/judge'
import { useOnePop } from '../../ui/onePop'

type TipId = 'key' | 'power' | 'boom'
const TIPS: Record<TipId, { title: string; text: string }> = {
  key: { title: 'KEY', text: 'The key is the home team of notes your song plays for. Notes from the key sound great together. Tap the key to change it.' },
  power: { title: 'MUSIC POWER', text: 'How strong your playing is right now: notes that fit the key, a steady beat, and tunes that flow. Keep it full!' },
  boom: { title: 'BOOM', text: 'Play notes that fit the key to charge the lightning bar. When it says BOOM READY, slam your forearm on the keys for a big BOOM!' },
}

/** a small "?" that asks the readout to show this tip (tap again to hide) */
function Help({ id, tip, onTip }: { id: TipId; tip: TipId | null; onTip: (t: TipId | null) => void }) {
  return (
    <button className={'sr-help' + (tip === id ? ' on' : '')} aria-label={'What is ' + TIPS[id].title + '?'} aria-expanded={tip === id}
      onClick={(e) => { e.stopPropagation(); onTip(tip === id ? null : id) }}>?</button>
  )
}

/** Music power: the judge's three meters (src/music/judge.ts) shown as one compact bar. */
function PowerCell({ tip, onTip }: { tip: TipId | null; onTip: (t: TipId | null) => void }) {
  const harmony = useJudge((s) => s.harmony)
  const rhythm = useJudge((s) => s.rhythm)
  const style = useJudge((s) => s.style)
  const pct = Math.round(((harmony + rhythm + style) / 3) * 100)
  return (
    <div className="sr-cell sr-power" data-power-readout title={`Notes in key ${Math.round(harmony * 100)}% · steady beat ${Math.round(rhythm * 100)}% · smooth style ${Math.round(style * 100)}%`}>
      <span className="sr-lbl">MUSIC POWER <Help id="power" tip={tip} onTip={onTip} /></span>
      <span className="sr-meter" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Music power"><i style={{ width: `${pct}%` }} /></span>
    </div>
  )
}

function BoomMeter({ tip, onTip }: { tip: TipId | null; onTip: (t: TipId | null) => void }) {
  const charge = useJudge((s) => s.charge)
  const full = charge >= 1
  return (
    <span className={'sr-boom' + (full ? ' full' : '')} >
      ⚡<span className="sr-meter sr-meter-s"><i style={{ width: `${Math.round(charge * 100)}%` }} /></span>{full ? 'BOOM READY' : 'BOOM'}<Help id="boom" tip={tip} onTip={onTip} />
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
  useOnePop('key', open, () => setOpen(false))
  const [tip, setTip] = useState<TipId | null>(null)
  const keyText = `${PC_NAMES[key.tonic]} ${SCALE_LABEL[key.scale]}`
  const m = mult(streak)
  // keep the chord on screen a moment after it ends so it fades instead of popping
  const [shownChord, setShownChord] = useState<string | null>(chord)
  useEffect(() => {
    if (chord) { setShownChord(chord); return }
    const t = window.setTimeout(() => setShownChord(null), 600)
    return () => window.clearTimeout(t)
  }, [chord])
  return (
    <div className="sr">
      <div className="sr-cell sr-keywrap">
        <button className="sr-key" data-key-readout aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
          title="Change key, scale or Easy mode">
          <span className="sr-lbl">KEY <i className={'sr-led' + (autoDetect ? ' on' : '')} aria-hidden /><span className="sr-auto">{autoDetect ? 'AUTO' : 'SET'}</span><span className="sr-help-gap" aria-hidden /></span>
          <b className="sr-val" key={keyText}>{keyText}</b>
        </button>
        <Help id="key" tip={tip} onTip={setTip} />
        {open && <KeyPopover onClose={() => setOpen(false)} />}
      </div>
      <PowerCell tip={tip} onTip={setTip} />
      <div className="sr-cell">
        <span className="sr-lbl">STREAK{m && <span className="sr-mult">{m}</span>}</span>
        <b className="sr-val sr-streak" key={streak}>{streak}</b>
        <span className="sr-best">BEST {bestStreak}{lastJudgement === 'out' ? ' · spicy!' : ''}</span>
        <BoomMeter tip={tip} onTip={setTip} />
      </div>
      {shownChord && <div className={'sr-cell sr-chordcell' + (chord ? ' on' : ' fade')} aria-live="polite"><span className="sr-lbl">CHORD</span><b className="sr-val sr-chord sr-chord-big" key={shownChord}>{shownChord}</b></div>}
      {tip && <div className="sr-tip" role="status" onClick={() => setTip(null)}><b>{TIPS[tip].title}</b> {TIPS[tip].text}</div>}
    </div>
  )
}
