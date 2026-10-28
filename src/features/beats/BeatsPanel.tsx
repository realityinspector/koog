import { useEffect, useRef, useSyncExternalStore } from 'react'
import { keyName } from '../../music/theory'
import { GROOVES } from './grooves'
import {
  subscribe, getVersion, getState, start, stop, setGroove, setBpmAdj, setGain, setLayer, setPent,
  bpm, jamKey, safeNotes, currentStep, pocketPct, MAX_GAIN,
} from './engine'
import './beats.css'

const RANKS = ['Warming up', 'Finding it', 'Locked in', 'In the pocket', 'Certified groove goblin']

export function BeatsPanel() {
  useSyncExternalStore(subscribe, getVersion)
  const S = getState()
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  const fill = useRef<HTMLDivElement>(null)
  const rank = useRef<HTMLSpanElement>(null)
  const combo = useRef<HTMLSpanElement>(null)

  // Direct-DOM animation loop: no React renders per beat.
  useEffect(() => {
    if (!S.playing) {
      dots.current.forEach((d) => d?.classList.remove('bt-on'))
      return
    }
    let raf = 0, last = -2, lastPct = -1, lastCombo = -1
    const loop = () => {
      const s = currentStep()
      if (s !== last) {
        last = s
        dots.current.forEach((d, i) => d?.classList.toggle('bt-on', i === s))
      }
      const st = getState()
      const pct = Math.round(pocketPct() * 100)
      if (pct !== lastPct && fill.current && rank.current) {
        lastPct = pct
        fill.current.style.width = pct + '%'
        const r = st.recent.length < 3 ? 0 : Math.min(4, Math.floor(pct / 22))
        rank.current.textContent = RANKS[r]
      }
      if (st.combo !== lastCombo && combo.current) {
        lastCombo = st.combo
        combo.current.textContent = st.combo > 1 ? `${st.combo} in a row` : ''
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [S.playing])

  // Stop sound if the panel unmounts.
  useEffect(() => () => stop(), [])

  const g = S.groove
  const key = jamKey()
  const safe = safeNotes(key)

  return (
    <section className="bt-panel" aria-label="Beat machine">
      <div className="bt-grooves" role="radiogroup" aria-label="Grooves">
        {GROOVES.map((x) => (
          <button key={x.id} role="radio" aria-checked={x.id === g.id} title={x.blurb}
            className={'bt-chip' + (x.id === g.id ? ' bt-sel' : '')} onClick={() => setGroove(x.id)}>
            {x.name}
          </button>
        ))}
      </div>

      <div className="bt-xport">
        {S.playing
          ? <button className="bt-stop" onClick={stop}>■ STOP</button>
          : <button className="bt-play" onClick={start}>▶ Play</button>}
        <div className="bt-steps" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} ref={(el) => { dots.current[i] = el }} className={'bt-dot' + (i % 4 === 0 ? ' bt-beat' : '')} />
          ))}
        </div>
        <label className="bt-ctl">
          <span>Tempo <b>{bpm()}</b></span>
          <input type="range" min={-20} max={20} value={S.bpmAdj} onChange={(e) => setBpmAdj(+e.target.value)} />
        </label>
        <label className="bt-ctl">
          <span>Volume <b>{Math.round((S.gain / MAX_GAIN) * 100)}%</b></span>
          <input type="range" min={0} max={MAX_GAIN} step={0.005} value={S.gain} onChange={(e) => setGain(+e.target.value)} />
        </label>
        <div className="bt-toggles">
          <label><input type="checkbox" checked={S.bass} onChange={(e) => setLayer('bass', e.target.checked)} /> Bass</label>
          <label><input type="checkbox" checked={S.chords} onChange={(e) => setLayer('chords', e.target.checked)} /> Chords</label>
          <label title="Five notes only. Every one sounds good."><input type="checkbox" checked={S.pent} onChange={(e) => setPent(e.target.checked)} /> Can't-miss</label>
        </div>
      </div>

      <div className="bt-score">
        <span className="bt-lbl">Jam score</span>
        <div className="bt-bar"><div ref={fill} className="bt-fill" /></div>
        <span ref={rank} className="bt-rank">{S.playing ? RANKS[0] : 'Press play, then hit in-key notes on the beat'}</span>
        <span ref={combo} className="bt-combo" />
        <span className="bt-key">Key <b>{keyName(key)}</b> · safe notes <b>{safe.join(' ')}</b></span>
      </div>
    </section>
  )
}
