import { PEDAL_ACTIONS, forgetPedal, learnPedal, pedalKeyLabel, setPedalAction, usePedal, type PedalAction } from './pedal'

/** Devices popover section: learn the USB foot pedal's key (a MIDI sustain pedal needs no setup) and pick its one job. */
export function PedalSetup() {
  const { code, action, learning, down, midi } = usePedal()
  const desc = PEDAL_ACTIONS.find(([a]) => a === action)?.[2]
  const jobs = (
    <>
      <label className="kg-pedal-job">What it does
        <select value={action} onChange={(e) => setPedalAction(e.target.value as PedalAction)} aria-label="What the foot pedal does">
          {PEDAL_ACTIONS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
        </select>
      </label>
      {desc && <p className="kg-dev-note">{desc}</p>}
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
