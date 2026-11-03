import { useEffect, useRef } from 'react'
import { ROOMS, STOPS } from './stops.data'
import { again, exitGallery, jump, minutes, next, prev, startGallery, toggle, useGallery } from './runner'
import './gallery.css'

/** The gallery's face: title card, museum label, control bar, soft veil between stops. Sits over the display; the app underneath keeps running. */
export function Gallery() {
  const { phase, idx, veil } = useGallery()
  const root = useRef<HTMLDivElement>(null)

  // follow the display's rectangle (the display is part of a different layout in kid and Boss mode)
  useEffect(() => {
    if (phase === 'off') return
    let raf = 0
    const fit = () => {
      const d = document.querySelector('.kg-display'), r = root.current
      if (d && r) { const b = d.getBoundingClientRect(); r.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`; r.toggleAttribute('data-sheet', d.hasAttribute('data-sheet')) }
      raf = requestAnimationFrame(fit)
    }
    fit()
    return () => cancelAnimationFrame(raf)
  }, [phase])

  if (phase === 'off') return null
  const s = STOPS[idx]
  const roomN = ROOMS.indexOf(s.room) + 1
  const live = phase === 'run' || phase === 'paused' || phase === 'taken'
  return (
    <div ref={root} className="gl-root" data-phase={phase} role="region" aria-label="Koog gallery">
      <div className={'gl-veil' + (veil ? ' on' : '')} aria-hidden />

      {phase === 'title' && (
        <div className="gl-card gl-title">
          <small>Koog gallery</small>
          <h2>A self-playing tour of every feature</h2>
          <p>Sit back. Koog plays, and shows you around: about {minutes()} minutes, {ROOMS.length} rooms, {STOPS.length} stops.</p>
          <button className="gl-big" onClick={startGallery} autoFocus>Start the gallery</button>
          <button className="gl-link" onClick={() => exitGallery()}>Not now</button>
          {idx > 0 && <p className="gl-fine">It will begin at "{s.title}".</p>}
        </div>
      )}

      {phase === 'done' && (
        <div className="gl-card gl-title">
          <small>That was Koog</small>
          <h2>Now it is your turn</h2>
          <p>Every note you saw was played through the same keys you have. Pick any room and play it yourself.</p>
          <button className="gl-big" onClick={() => exitGallery('#/play')} autoFocus>Play it yourself</button>
          <button className="gl-link" onClick={again}>Watch again</button>
        </div>
      )}

      {live && (
        <>
          <aside className="gl-label" aria-live="polite">
            <div className="gl-room">{s.room} room</div>
            <h3>{s.title}</h3>
            <p>{s.says}</p>
            <p className="gl-learn"><b>You learn:</b> {s.learns}</p>
            {s.link && <p><a href={s.link.href} target="_blank" rel="noreferrer">{s.link.label}</a></p>}
            {phase !== 'run' && <p className="gl-hold" role="status">{phase === 'taken' ? "You're playing! Press Space to resume the gallery." : 'Paused. Press Space to resume.'}</p>}
            <div className="gl-count">Room {roomN} of {ROOMS.length} · stop {idx + 1} of {STOPS.length}</div>
          </aside>
          <div className="gl-bar" role="toolbar" aria-label="Gallery controls">
            <button onClick={prev} disabled={idx === 0} aria-label="Previous stop">Back</button>
            <button onClick={toggle} aria-label={phase === 'run' ? 'Pause' : 'Play'}>{phase === 'run' ? 'Pause' : 'Play'}</button>
            <button onClick={next} disabled={idx >= STOPS.length - 1} aria-label="Next stop">Next</button>
            <select aria-label="Jump to a stop" value={idx} onChange={(e) => jump(+e.target.value)}>
              {ROOMS.map((r) => (
                <optgroup key={r} label={r + ' room'}>
                  {STOPS.map((x, i) => x.room === r ? <option key={x.id} value={i}>{x.title}</option> : null)}
                </optgroup>
              ))}
            </select>
            <button onClick={() => exitGallery()} aria-label="Leave the gallery">Exit</button>
          </div>
          <div className="gl-line" aria-hidden><i style={{ width: ((idx + 1) / STOPS.length) * 100 + '%' }} /></div>
        </>
      )}
    </div>
  )
}
