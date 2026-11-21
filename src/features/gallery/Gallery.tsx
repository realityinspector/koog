import { useEffect, useRef, useState } from 'react'
import { ROOMS, STOPS } from './stops.data'
import { again, exitGallery, jump, minutes, next, pick, pieceVoice, piecesFor, prev, startArt, startGallery, stopVoice, toggle, tourInstead, useGallery } from './runner'
import { findSong, SEASONS } from './holiday'
import { SeasonCanvas } from './Season'
import { SOUNDS } from '../devices/soundChoice'
import { PRESETS } from '../synth-history/presets'
import './gallery.css'

/** Kid-facing line for the picture's synth: the type, then the setting. */
function voiceCaption(v: { sound: string; preset?: string } | null): string | null {
  if (!v) return null
  const s = SOUNDS.find((x) => x.id === v.sound)
  const type = s?.label ?? 'Koog synth'
  const setting = v.sound === 'koog'
    ? (v.preset && v.preset !== 'classic' ? PRESETS.find((p) => p.id === v.preset)?.name ?? 'Classic' : 'Classic')
    : (v.preset ?? s?.preset ?? null)
  return setting ? `${type} · ${setting}` : type
}

/** The gallery's face: title card, museum label, control bar, soft veil between stops. Sits over the display; the app underneath keeps running. */
export function Gallery() {
  const { phase, idx, veil, art, kind } = useGallery()
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
  const heard = voiceCaption(stopVoice(s))
  const live = phase === 'run' || phase === 'paused' || phase === 'taken'
  return (
    <div ref={root} className="gl-root" data-phase={phase} role="region" aria-label="Koog gallery">
      <div className={'gl-veil' + (veil ? ' on' : '')} aria-hidden />

      {phase === 'title' && art && (
        <div className="gl-card gl-title gl-art-card">
          <small>Koog</small>
          <h2>{kind === 'art' ? 'Art Gallery mode' : SEASONS[kind].title}</h2>
          <p>{kind === 'art' ? 'A slow, full-screen piece of moving art. Koog plays calm old songs and its pictures drift by, over and over, for as long as you like.' : SEASONS[kind].blurb}</p>
          <button className="gl-big" onClick={startArt} autoFocus>{kind === 'art' ? 'Start Art Gallery mode' : 'Start the ' + SEASONS[kind].button + ' show'}</button>
          <p className="gl-fine">Play any key, any time: the art answers and the music makes room. Space pauses, the right arrow skips, Esc leaves. Nothing you have saved changes.</p>
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
          <div className="gl-art-row">
            <button className="gl-art-btn" onClick={() => { location.hash = SEASONS.thanksgiving.hash }}>🍂 Thanksgiving <span>art gallery</span></button>
            <button className="gl-art-btn" onClick={() => { location.hash = SEASONS.christmas.hash }}>🎄 Christmas <span>art gallery</span></button>
          </div>
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
            {heard && <p className="gl-sound"><b>Sound:</b> {heard}</p>}
            <p className="gl-learn"><b>You learn:</b> {s.learns}</p>
            {s.link && <p><a href={s.link.href} target="_blank" rel="noreferrer">{s.link.label}</a></p>}
            {phase !== 'run' && <p className="gl-hold" role="status">{phase === 'taken' ? "You're playing! Press Space to resume the gallery." : 'Paused. Press Space to resume.'}</p>}
            <div className="gl-count">Room {roomN} of {ROOMS.length} · stop {idx + 1} of {STOPS.length}</div>
          </aside>
          <div className="gl-bar" role="toolbar" aria-label="Gallery controls">
            <button onClick={prev} disabled={idx === 0} aria-label="Previous stop">Back</button>
            <button onClick={toggle} aria-label={phase === 'run' ? 'Pause' : 'Play'}>{phase === 'run' ? 'Pause' : 'Play'}</button>
            <button onClick={next} disabled={idx >= STOPS.length - 1} aria-label="Skip to the next stop" title="Skip to the next stop (right arrow)">Skip ▸</button>
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
  const s = id ? findSong(id) : undefined
  return s ? `${s.title.replace(/\s*\((opening|theme|waltz theme)\)$/i, '')} · ${s.origin}, ${s.year}` : null
}

/** Art Gallery mode: the whole screen is the picture. A wall label fades in and out, a hairline shows the piece's time. Controls fade when idle. */
function ArtFrame() {
  const { phase, veil, piece, pieceMs, pieceAt, kind, ducked } = useGallery()
  const music = piece?.perf?.k === 'song' ? credit(piece.perf.id) : null
  const heard = voiceCaption(piece ? pieceVoice(piece) : null)
  const [keys, setKeys] = useState(false)
  useEffect(() => { document.documentElement.toggleAttribute('data-art-keys', keys); return () => document.documentElement.removeAttribute('data-art-keys') }, [keys])
  const list = piecesFor(kind)
  const blur = (e: { currentTarget: HTMLElement }) => e.currentTarget.blur()
  return (
    <div className="gl-root gl-art" data-phase={phase} data-kind={kind} data-ducked={ducked ? '' : undefined} data-sheet={piece?.state?.sheet ? '' : undefined} role="region" aria-label={kind === 'art' ? 'Koog Art Gallery mode' : SEASONS[kind].title}>
      {kind !== 'art' && <div className="gl-tint" aria-hidden />}
      <div className="gl-art-vignette" aria-hidden />
      <div className="gl-art-grain" aria-hidden />
      <div className={'gl-veil' + (veil ? ' on' : '')} aria-hidden />
      {kind !== 'art' && <SeasonCanvas kind={kind} />}
      {piece && (
        <figure key={pieceAt} className="gl-wall" aria-live="polite" style={{ ['--gl-hold' as string]: Math.max(9, Math.min(16, pieceMs / 1000 - 4)) + 's' }}>
          <div className="gl-wall-room">{piece.season ? SEASONS[piece.season].button : piece.room + ' room'}</div>
          <h3>{piece.title}</h3>
          <p>{piece.line}</p>
          {heard && <p className="gl-sound">Sound: {heard}</p>}
          {music && <p className="gl-wall-credit">{music}</p>}
        </figure>
      )}
      {piece && <div className="gl-art-line" aria-hidden><i key={pieceAt} style={{ animationDuration: pieceMs + 'ms' }} /></div>}
      {phase === 'paused' && <div className="gl-art-paused" role="status">Paused <span>Space to continue · play anything and it still answers</span></div>}
      {ducked && <div className="gl-art-duck" role="status">You are playing: the gallery music is resting</div>}
      <div className="gl-art-hint" aria-hidden>Play anything · Space pauses · → skips · Esc leaves</div>
      <div className="gl-art-bar" role="toolbar" aria-label="Art Gallery controls">
        <button onClick={(e) => { prev(); blur(e) }} aria-label="Previous piece" title="Previous piece (left arrow)">◂</button>
        <button onClick={(e) => { toggle(); blur(e) }} aria-label={phase === 'paused' ? 'Play' : 'Pause'} title="Pause or play (Space)">{phase === 'paused' ? '▶' : '⏸'}</button>
        <button className="gl-skip" onClick={(e) => { next(); blur(e) }} aria-label="Skip to the next piece" title="Skip to the next piece (right arrow)">Skip ▸</button>
        <select aria-label="Pick a piece" value={piece?.id ?? ''} onChange={(e) => { pick(e.target.value); blur(e) }}>
          {piece && !list.some((p) => p.id === piece.id) && <option value={piece.id}>{piece.title}</option>}
          {kind === 'art'
            ? [...new Set(list.map((p) => p.room))].map((r) => <optgroup key={r} label={r + ' room'}>{list.filter((p) => p.room === r).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>)
            : list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button className={keys ? 'on' : ''} onClick={(e) => { setKeys((v) => !v); blur(e) }} aria-pressed={keys} aria-label="Show piano keys" title="Show the piano keys to tap">🎹</button>
        <button onClick={() => exitGallery()} aria-label="Exit Art Gallery mode" title="Exit (Esc)">Exit</button>
      </div>
    </div>
  )
}
