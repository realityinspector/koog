// Play / Drums / Synth / Pro map for the wireless controller.
// The words stay free of controller brand names.

import { CONTROLS, FUNCS, activeMap, type Fn, type PadRole } from './padAssign'
import { setPadBinding, setPadRole, usePadRole } from './padRole'

const ROLES: { id: PadRole; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'drums', label: 'Drums' },
  { id: 'synth', label: 'Synth' },
  { id: 'custom', label: 'Pro map' },
]

const HINT: Record<PadRole, string> = {
  play: 'Directions and the four face buttons play the 8 notes. Shoulders change the octave. Triggers play quieter and louder. Stick clicks are a kick and a snare. The sticks shape the sound. The center button plays a chord. The touch pad changes the picture. Start begins. Back lets go.',
  drums: 'Left shoulder is the kick. Left trigger is the snare. Right shoulder is the hat. Right trigger is the open hat. A harder trigger is a louder hit. Directions play the clap, the low tom, the high tom, and the rim. The left stick sweeps the filter. The right stick bends the pitch and adds wobble. Square holds notes. Cross plays a chord. Circle changes the picture. Triangle taps the tempo. Back lets go of notes and leaves the loop station playing. Start begins. Stick clicks, the center button, and the touch pad are off.',
  synth: 'Directions and the face buttons play the 8 notes. Shoulders change the octave. Triggers play quieter and louder. The left stick is a wobble wheel: push it up for more wobble, and it rests at none. The right stick is a pitch wheel: up bends sharp, down bends flat, and it springs home. Press the left stick in for a saw wave and the right stick in for a square wave. The center button is a smooth wave. The touch pad changes the picture. Back lets go. Start begins.',
  custom: 'Each control does the job you pick. It starts as the Play jobs. The list is every job it can do.',
}

export function PadSetup({ connected }: { connected: boolean }) {
  const role = usePadRole((s) => s.role)
  const stored = usePadRole((s) => s.map)
  const map = activeMap(role, stored)
  return (
    <>
      <div className="kg-pad-roles" role="group" aria-label="Wireless controller jobs" data-pad-role={role}>
        {ROLES.map((r) => (
          <button key={r.id} type="button" className={role === r.id ? 'on' : ''} aria-pressed={role === r.id} onClick={() => setPadRole(r.id)}>{r.label}</button>
        ))}
      </div>
      <p className="kg-dev-hint">{HINT[role]}</p>
      {!connected && <p className="kg-dev-note">Pick a job now. It is ready when the controller connects.</p>}
      {role === 'custom' && (
        <div className="kg-pad-map">
          {CONTROLS.map((c) => (
            <label key={c.id} className="kg-pad-row">
              <span>{c.label}</span>
              <select aria-label={c.label} value={map[c.id]} onChange={(e) => setPadBinding(c.id, e.target.value as Fn)}>
                {FUNCS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </>
  )
}
