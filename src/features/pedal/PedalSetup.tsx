import { useEffect } from 'react'
import { PEDALS, pedalDef } from '../pedalboard/effects'
import { selectPedal, useBoard } from '../pedalboard/boardEngine'
import { LOOP_STYLES, PEDAL_ACTIONS, forgetPedal, learnPedal, pedalKeyLabel, setLoopAlways, setLoopStyle, setPedalAction, usePedal, type LoopStyle, type PedalAction } from './pedal'

/** Devices popover section: learn the USB foot pedal's key (a MIDI sustain pedal needs no setup) and pick its one job. */
export function PedalSetup() {
  const { code, action, learning, down, midi, loopStyle, loopAlways } = usePedal()
  const styleDesc = LOOP_STYLES.find(([k]) => k === loopStyle)?.[2]
  const sel = useBoard((b) => b.selected)
  // closing the devices menu unmounts this section; a half-finished learn would swallow the next key
  useEffect(() => () => { if (usePedal.getState().learning) learnPedal(false) }, [])
  const desc = PEDAL_ACTIONS.find(([a]) => a === action)?.[2]
  const jobs = (
    <>
      <label className="kg-pedal-job">What it does
        <select value={action} onChange={(e) => setPedalAction(e.target.value as PedalAction)} aria-label="What the foot pedal does">
          {PEDAL_ACTIONS.map(([a, l]) => <option key={a} value={a}>{a === 'stomp' ? `Foot pedal stomps: ${pedalDef(sel)?.name ?? 'a pedal'}` : l}</option>)}
        </select>
      </label>
      {desc && <p className="kg-dev-note">{desc}</p>}
      {action === 'stomp' && (
        <label className="kg-pedal-job">Which pedal
          <select value={sel} onChange={(e) => selectPedal(e.target.value)} aria-label="Which pedalboard pedal the foot pedal stomps">
            {PEDALS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
          </select>
        </label>
      )}
      {(action === 'loop' || action === 'auto') && (
        <>
          <label className="kg-pedal-job">Looper style
            <select value={loopStyle} onChange={(e) => setLoopStyle(e.target.value as LoopStyle)} aria-label="How the foot pedal runs the looper">
              {LOOP_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {styleDesc && <p className="kg-dev-note" data-testid="pedal-style-note">{styleDesc}</p>}
          <label className="kg-pedal-job" title="Off (the default): the pedal only runs the looper while the looper is on screen, so a tap in a game or a song never records a loop.">
            <input type="checkbox" checked={!!loopAlways} onChange={(e) => setLoopAlways(e.target.checked)} aria-label="Pedal always runs the looper" /> Pedal always runs the looper (even when it is closed)
          </label>
        </>
      )}
    </>
  )
  return (
    <div className="kg-pedal">
      <h4>Foot pedal <span className="kg-pedal-opt">optional</span></h4>
      {midi && <div className="kg-pedal-row"><span className={'kg-pedal-led' + (down ? ' on' : '')} aria-hidden /><span>Keyboard pedal found</span></div>}
      {learning ? (
        <div className="kg-pedal-row" role="status">
          <span className="kg-pedal-led on" aria-hidden />
          <span className="kg-pedal-wait">Press your foot pedal now…</span>
          <button type="button" onClick={() => learnPedal(false)}>Cancel</button>
        </div>
      ) : code ? (
        <div className="kg-pedal-row">
          <span className={'kg-pedal-led' + (down ? ' on' : '')} aria-hidden />
          <span>Pedal key: <b>{pedalKeyLabel(code)}</b></span>
          <button type="button" onClick={() => learnPedal()}>Change</button>
          <button type="button" onClick={forgetPedal}>Forget</button>
        </div>
      ) : (
        <>
          <button type="button" className="kg-pedal-setup" onClick={() => learnPedal()}>Set up a USB foot pedal</button>
          {!midi && <p className="kg-dev-note">Plug in a USB foot switch, tap this, then press the pedal once. A sustain pedal plugged into your MIDI keyboard works without setup.</p>}
        </>
      )}
      {!learning && jobs}
    </div>
  )
}
