import { useEffect, useRef } from 'react'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL, type ScaleType } from '../../music/theory'

const SCALE_OPTS: ScaleType[] = ['major', 'minor', 'majorPentatonic', 'minorPentatonic', 'blues']

/** Key / scale picker, auto-detect and the Easy modes (every note sounds good). Opens from the KEY readout. */
export function KeyPopover({ onClose }: { onClose: () => void }) {
  const { key, autoDetect, setKey, setAutoDetect } = useHarmonyStore()
  const ref = useRef<HTMLDivElement>(null)
  // white keys are C major (F and B belong). Black keys are the five notes of F# major pentatonic.
  const isCant = (t: number) => t === 0 ? key.tonic === 0 && key.scale === 'major' : key.tonic === 6 && key.scale === 'majorPentatonic'
  const cant = (t: number) => { setAutoDetect(false); setKey(t === 0 ? { tonic: 0, scale: 'major' } : { tonic: 6, scale: 'majorPentatonic' }) }

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = ref.current
      if (el && !el.contains(e.target as Node) && !(e.target as Element).closest?.('[data-key-readout]')) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', down)
    window.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', esc, true) }
  }, [onClose])

  return (
    <div className="kp" ref={ref} role="dialog" aria-label="Key and scale">
      <div className="kp-row">
        <label className="kp-lbl" htmlFor="kp-tonic">Key</label>
        <select id="kp-tonic" value={key.tonic} onChange={(e) => { setAutoDetect(false); setKey({ ...key, tonic: +e.target.value }) }}>
          {PC_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
        <select aria-label="Scale" value={key.scale} onChange={(e) => { setAutoDetect(false); setKey({ ...key, scale: e.target.value as ScaleType }) }}>
          {SCALE_OPTS.map((s) => <option key={s} value={s}>{SCALE_LABEL[s]}</option>)}
        </select>
      </div>
      <button className={'kp-btn' + (autoDetect ? ' on' : '')} aria-pressed={autoDetect} onClick={() => setAutoDetect(!autoDetect)}
        title="Let the app listen and guess your key">
        <i className="kp-led" /> Auto-detect key
      </button>
      <div className="kp-lbl">Easy modes (every note sounds good)</div>
      <div className="kp-row">
        <button className={'kp-btn' + (isCant(0) ? ' on' : '')} aria-pressed={isCant(0)} onClick={() => cant(0)}>White keys only</button>
        <button className={'kp-btn' + (isCant(6) ? ' on' : '')} aria-pressed={isCant(6)} onClick={() => cant(6)}>Black keys only</button>
      </div>
      <p className="kp-note">Every note in these modes sounds good together.</p>
    </div>
  )
}
