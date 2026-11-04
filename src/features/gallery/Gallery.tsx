import { useEffect, useRef } from 'react'
import { ROOMS, STOPS } from './stops.data'
import { SONGS } from '../songs/songs'
import { again, exitGallery, jump, minutes, next, prev, startArt, startGallery, toggle, tourInstead, useGallery } from './runner'
import './gallery.css'

/** The gallery's face: title card, museum label, control bar, soft veil between stops. Sits over the display; the app underneath keeps running. */
export function Gallery() {
  const { phase, idx, veil, art } = useGallery()
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
  if (art && phase !== 'title') return <ArtFrame />
  const s = STOPS[idx]
  const roomN = ROOMS.indexOf(s.room) + 1
  const live = phase === 'run' || phase === 'paused' || phase === 'taken'
  return (
    <div ref={root} className="gl-root" data-phase={phase} role="region" aria-label="Koog gallery">
      <div className={'gl-veil' + (veil ? ' on' : '')} aria-hidden />

      {phase === 'title' && art && (
        <div className="gl-card gl-title gl-art-card">
          <small>Koog</small>
          <h2>Art Gallery mode</h2>
          <p>A slow, full-screen piece of moving art. Koog plays calm old songs and its pictures drift by, over and over, for as long as you like.</p>
          <button className="gl-big" onClick={startArt} autoFocus>Start Art Gallery mode</button>
          <p className="gl-fine">Space pauses. Any other key or a click hands the keys back. Nothing you have saved changes.</p>
          <button className="gl-link" onClick={tourInstead}>Take the guided tour instead</button>
          <button className="gl-link" onClick={() => exitGallery()}>Not now</button>
        </div>
      )}

      {phase === 'title' && !art && (
        <div className="gl-card gl-title">
          <small>Koog gallery</small>
          <h2>A self-playing tour of every feature</h2>
          <p>Sit back. Koog plays, and shows you around: about {minutes()} minutes, {ROOMS.length} rooms, {STOPS.length} stops.</p>
          <button className="gl-big" onClick={startGallery} autoFocus>Start the gallery</button>
          <button className="gl-art-btn" onClick={startArt}>Art Gallery mode <span>full screen, calm music, loops forever</span></button>
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

const credit = (id?: string) => {
  const s = id ? SONGS.find((x) => x.id === id) : undefined
  return s ? `${s.title.replace(/\s*\((opening|theme|waltz theme)\)$/i, '')} · ${s.origin}, ${s.year}` : null
}

/** Art Gallery mode: the whole screen is the picture. A wall label fades in and out, a hairline shows the piece's time. */
function ArtFrame() {
  const { phase, veil, piece, pieceMs, pieceAt } = useGallery()
  const music = piece?.perf?.k === 'song' ? credit(piece.perf.id) : null
  return (
    <div className="gl-root gl-art" data-phase={phase} data-sheet={piece?.state?.sheet ? '' : undefined} role="region" aria-label="Koog Art Gallery mode">
      <div className="gl-art-vignette" aria-hidden />
      <div className="gl-art-grain" aria-hidden />
      <div className={'gl-veil' + (veil ? ' on' : '')} aria-hidden />
      {piece && (
        <figure key={pieceAt} className="gl-wall" aria-live="polite" style={{ ['--gl-hold' as string]: Math.max(9, Math.min(16, pieceMs / 1000 - 4)) + 's' }}>
          <div className="gl-wall-room">{piece.room} room</div>
          <h3>{piece.title}</h3>
          <p>{piece.line}</p>
          {music && <p className="gl-wall-credit">{music}</p>}
        </figure>
      )}
      {piece && <div className="gl-art-line" aria-hidden><i key={pieceAt} style={{ animationDuration: pieceMs + 'ms' }} /></div>}
      {phase === 'paused' && <div className="gl-art-paused" role="status">Paused <span>Space to continue · any other key to play yourself</span></div>}
      <div className="gl-art-hint" aria-hidden>Art Gallery mode · Space pauses · any key or click hands you the keys</div>
    </div>
  )
}
