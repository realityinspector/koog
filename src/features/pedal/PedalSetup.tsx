import { PEDAL_ACTIONS, forgetPedal, learnPedal, pedalKeyLabel, setPedalAction, usePedal } from './pedal'

/** Devices popover section: learn the USB foot pedal's key and pick its one job. */
export function PedalSetup() {
  const { code, action, learning, down } = usePedal()
  const desc = PEDAL_ACTIONS.find(([a]) => a === action)?.[2]
  return (
    <div className="kg-pedal">
      <h4>Foot pedal <span className="kg-pedal-opt">optional</span></h4>
      {learning ? (
        <div className="kg-pedal-row" role="status">
          <span className="kg-pedal-led on" aria-hidden />
          <span className="kg-pedal-wait">Press your foot pedal now…</span>
          <button type="button" onClick={() => learnPedal(false)}>Cancel</button>
        </div>
      ) : code ? (
        <>
          <div className="kg-pedal-row">
            <span className={'kg-pedal-led' + (down ? ' on' : '')} aria-hidden />
            <span>Pedal key: <b>{pedalKeyLabel(code)}</b></span>
            <button type="button" onClick={() => learnPedal()}>Change</button>
            <button type="button" onClick={forgetPedal}>Forget</button>
          </div>
          <div className="kg-pedal-acts" role="group" aria-label="What the pedal does">
            {PEDAL_ACTIONS.map(([a, l]) => <button key={a} type="button" className={action === a ? 'on' : ''} aria-pressed={action === a} onClick={() => setPedalAction(a)}>{l}</button>)}
          </div>
          {desc && <p className="kg-dev-note">{desc}</p>}
        </>
      ) : (
        <>
          <button type="button" className="kg-pedal-setup" onClick={() => learnPedal()}>Set up a USB foot pedal</button>
          <p className="kg-dev-note">Plug in a USB foot switch, tap this, then press the pedal once. It can hold notes (sustain), run the loop station, or start the beat.</p>
        </>
      )}
    </div>
  )
}
