// Controller Mode overlay: the drawn controller with every control labelled by the parameter it drives for the instrument
// that is playing, live values, the touched control lit, soft-takeover ghosts, the signal-flow caption and MIDI learn.
// Docked at the bottom of the display, above the DUO strip and the sheet music, so it works in PLAY and over the SYNTH panels.
import { useEffect, useMemo, useRef, useState } from 'react'
import './controller.css'
import { ControllerPic } from '../dj/Controller'
import { cancelLearn, resetLayout, setPickupMode, startLearn, surfaceInput, toggleControllerMode, unassign, useSurface } from './surface'
import { CLASS_OF, physName } from './catalog'
import { useScreen } from '../../layout/screenStore'

// the full overlay opens in PLAY; over the SYNTH panels it starts as a slim bar so the faceplate (and its glowing knobs) stay visible
const minKey = (screen: boolean) => 'koog.ctl.min.' + (screen ? 'screen' : 'play')
const loadMin = (screen: boolean) => { try { const v = localStorage.getItem(minKey(screen)); return v == null ? screen : v === '1' } catch { return screen } }
const KIND_ICON: Record<string, string> = { cont: '🎚️', pick: '🔘', action: '🟦', bend: '🎡' }

export function ControllerOverlay() {
  const s = useSurface()
  const screenId = useScreen((x) => x.screen)
  const inScreen = screenId !== 'play'
  const [mins, setMins] = useState({ play: loadMin(false), screen: loadMin(true) })
  const min = inScreen ? mins.screen : mins.play
  const [learnOpen, setLearnOpen] = useState(false)
  const [, force] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const open = s.on && (screenId === 'play' || screenId === 'synth')

  useEffect(() => {
    const d = root.current?.closest('.kg-display')
    if (!d || !open) return
    d.setAttribute('data-surface', min ? 'min' : 'open')
    return () => d.removeAttribute('data-surface')
  }, [open, min])
  // re-draw while something was touched in the last second (the lit control fades)
  useEffect(() => {
    if (!open) return
    const h = window.setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(h)
  }, [open])

  const now = performance.now()
  const hot = useMemo(() => Object.fromEntries(Object.entries(s.touched).filter(([, t]) => now - t < 700).map(([k]) => [k, true])), [s.touched, now])
  const ctl = useMemo(() => Object.fromEntries(Object.keys(s.labels).map((k) => [k, { v: s.values[k] ?? 0, n: 1 }])), [s.labels, s.values])
  const ghost = useMemo(() => Object.fromEntries(Object.entries(s.locked).filter(([, l]) => l).map(([k]) => [k, s.ghost[k]]).filter(([, g]) => g != null)), [s.locked, s.ghost])
  const lockedRows = s.rows.filter((r) => s.locked[r.phys])

  const toggleMin = () => { const n = !min; try { localStorage.setItem(minKey(inScreen), n ? '1' : '0') } catch { /* ignore */ } setMins((m) => ({ ...m, [inScreen ? 'screen' : 'play']: n })) }
  const statusLine = s.learn ? <span className="ctl-learn">🎓 {s.learnMsg}</span>
    : lockedRows.length ? <span className="ctl-wait">🧲 {physName(lockedRows[0].phys)} waits: move it to the dotted marker to pick up {lockedRows[0].short}{lockedRows.length > 1 ? ` (+${lockedRows.length - 1} more)` : ''}.</span>
    : s.last ? <span className="ctl-last">{physName(s.last.phys)} → {s.last.text}</span>
    : <span className="ctl-hint">Move a knob, fader or the crossfader. Each label shows what it controls.</span>
  if (!open) return <div ref={root} hidden />
  const learnParam = s.params.find((p) => p.id === s.learn)

  return (
    <div className={'ctl-dock' + (min ? ' min' : '')} ref={root} role="region" aria-label="Controller Mode: the synth control surface">
      <div className="ctl-head">
        <b>🎛️ Synth controller</b>
        <span className="ctl-inst" title={s.instName}>{s.instName}</span>
        {min ? <span className="ctl-status ctl-slim" aria-live="polite">{statusLine}</span> : <span className="ctl-spacer" />}
        {!min && <>
          <button type="button" className={'ctl-b' + (s.pickupMode === 'pickup' ? ' on' : '')} aria-pressed={s.pickupMode === 'pickup'}
            title="Pickup: a knob waits until it reaches the sound's current setting (no sudden jumps). Jump: it takes over right away."
            onClick={() => setPickupMode(s.pickupMode === 'pickup' ? 'jump' : 'pickup')}>{s.pickupMode === 'pickup' ? '🧲 Pickup' : '⚡ Jump'}</button>
          <button type="button" className={'ctl-b' + (learnOpen ? ' on' : '')} aria-pressed={learnOpen} onClick={() => { setLearnOpen((o) => !o); cancelLearn() }}
            title="MIDI learn: pick a setting, then move a control to give it that job">🎓 Learn</button>
          <button type="button" className="ctl-b" onClick={() => resetLayout()} title="Put every control back to its default job">↺ Reset</button>
        </>}
        <button type="button" className="ctl-b" onClick={() => toggleControllerMode()} title="Switch the controller back to the DJ decks">🎧 DJ</button>
        <button type="button" className="ctl-b" aria-label={min ? 'Show the controller' : 'Hide the controller'} aria-expanded={!min} onClick={toggleMin}>{min ? '▲' : '▼'}</button>
      </div>
      {!min && (
        <div className="ctl-body">
          <div className="ctl-pic">
            <ControllerPic ctl={ctl} labels={s.labels} ghost={ghost} hot={hot} interactive onSend={surfaceInput} noQ />
          </div>
          <div className="ctl-side">
            <p className="ctl-cap">{s.caption}</p>
            <div className="ctl-flow" aria-label="Signal flow">
              {s.stages.map((st, i) => (
                <div className="ctl-stage" key={st.name + i}>
                  {i % 2 === 1 && <span className="ctl-arrow" aria-hidden>→</span>}
                  <div className="ctl-stage-box">
                    <b>{st.name}</b>{st.hint && <small>{st.hint}</small>}
                    {st.params.map((p) => <span className="ctl-chip" key={p.id}>{p.short}<i>{p.phys}</i></span>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="ctl-status" aria-live="polite">
              {statusLine}
              {!s.learn && s.learnMsg && <span className="ctl-note"> {s.learnMsg}</span>}
            </div>
            {learnOpen && (
              <div className="ctl-learnbox">
                <small>Tap a setting, then move the control that should run it:</small>
                <div className="ctl-params">
                  {s.params.map((p) => <button key={p.id} type="button" className={'ctl-p' + (s.learn === p.id ? ' on' : '')} onClick={() => (s.learn === p.id ? cancelLearn() : startLearn(p.id))}>{KIND_ICON[p.kind]} {p.label}</button>)}
                </div>
                {learnParam && <button type="button" className="ctl-b" onClick={cancelLearn}>Cancel</button>}
                <div className="ctl-free">
                  {s.rows.filter((r) => CLASS_OF[r.phys] !== 'pad').slice(0, 0).map((r) => <button key={r.phys} type="button" onClick={() => unassign(r.phys)}>{r.phys}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
