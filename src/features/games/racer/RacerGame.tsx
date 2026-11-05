import { useEffect, useRef } from 'react'
import { emitScreen } from '../../../kode/tokens'
import { padLabel } from '../../../kode/kodeCore'
import { newCamera, drawFrame } from './draw'
import { TRACKS, WORLDS } from './tracks'
import { VEHICLES, keyName, vehicleById } from './vehicles'
import { chooseVehicle, closeGame, freeReplay, hearAgain, isUnlocked, nextTrack, openGame, openTrack, retry, setDraw, setMode, toGarage, toMap, totalStars, useRacer } from './engine'
import './racer.css'

const Stars = ({ n, big }: { n: number; big?: boolean }) => (
  <span className={'rc-stars' + (big ? ' big' : '')} aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>
)

/** Koogalien Racer: the track is a timeline. Hear the phrase, play it back on the beat, and watch the car drive what you played. */
export function RacerGame({ onExit }: { onExit: () => void }) {
  const s = useRacer()
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    openGame()
    const c = cv.current!, ctx = c.getContext('2d')!, cam = newCamera()
    let w = 0, h = 0, dpr = 1
    const size = () => {
      const r = wrap.current!.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(1, r.width); h = Math.max(1, r.height)
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(wrap.current!)
    setDraw((v, st, now) => drawFrame(ctx, cam, w, h, dpr, v, st, now))
    return () => { setDraw(null); ro.disconnect(); closeGame() }
  }, [])

  const veh = vehicleById(s.vehicle)
  const def = TRACKS[s.trackIx]
  const world = WORLDS[def.world]
  const pads = s.mode === 'pads'
  const inRound = s.phase === 'listen' || s.phase === 'turn' || s.phase === 'race' || s.phase === 'result'

  return (
    <div className={'rc-root rc-w' + (inRound ? def.world : 'x')} ref={wrap} data-phase={s.phase}>
      <canvas ref={cv} className="rc-canvas" aria-label="Koogalien Racer track" />
      <div className="rc-top">
        <button className="rc-btn ghost" onClick={() => (inRound ? toMap() : onExit())}>{inRound ? '← Tracks' : '← Games'}</button>
        <b className="rc-title">🏁 <span className="rc-long">Koogalien Racer</span>{inRound && <span> {world.emoji} {def.name}</span>}</b>
        <span className="rc-chip" title="Stars earned">★ {totalStars(s.save)}/{TRACKS.length * 3}</span>
        {s.phase !== 'garage' && <button className="rc-btn ghost" onClick={toGarage} title="Pick your vehicle">{veh.emoji} Garage</button>}
      </div>

      {s.phase === 'garage' && (
        <div className="rc-panel" role="region" aria-label="Garage">
          <h2>🔧 The Garage</h2>
          <p className="rc-sub small">Koogalien is the musical language of the Koog Aliens: here your tune is the road, and the car reads it.</p>
          <p className="rc-sub">Pick a vehicle by playing its key <b>four times</b>{pads ? ' (tap its pad four times)' : ''}, or just tap it.</p>
          <div className="rc-mode" role="group" aria-label="What are you playing">
            <button className={'rc-btn' + (!pads ? ' on' : '')} onClick={() => setMode('keys')}>🎹 Keys</button>
            <button className={'rc-btn' + (pads ? ' on' : '')} onClick={() => setMode('pads')}>🥁 Pads</button>
            <span className="rc-sub small">Piano, drum pads or a DJ controller: Koog hears them all.</span>
          </div>
          <div className="rc-garage">
            {VEHICLES.map((v) => (
              <button key={v.id} className={'rc-veh' + (s.vehicle === v.id ? ' sel' : '') + (s.picked === v.id ? ' pop' : '')} onClick={() => chooseVehicle(v.id)} aria-pressed={s.vehicle === v.id}>
                <span className="rc-vem" aria-hidden>{v.emoji}</span>
                <b>{v.name}</b>
                <span className="rc-vkey">{pads ? `Tap ${padLabel(v.lane)} 4x` : `Play ${keyName(v)} 4x`}</span>
                <span className="rc-vbl">{v.blurb}</span>
              </button>
            ))}
          </div>
          <p className="rc-coach" role="status">{s.coach || (s.vehicle ? `You drive the ${veh.name}.` : 'Try it: play C four times for the Bee Buggy.')}</p>
          <button className="rc-btn go" disabled={!s.vehicle} onClick={() => { toMap() }}>Let's race →</button>
        </div>
      )}

      {s.phase === 'map' && (
        <div className="rc-panel" role="region" aria-label="Tracks">
          <h2>🗺️ Pick a track</h2>
          <p className="rc-sub">Each road is a tune: up bends right, down bends left, the same note goes straight. Finish a track to open the next. Streak: {s.save.streak} clean lap{s.save.streak === 1 ? '' : 's'}.</p>
          <div className="rc-mode" role="group" aria-label="What are you playing">
            <button className={'rc-btn' + (!pads ? ' on' : '')} onClick={() => setMode('keys')}>🎹 Keys</button>
            <button className={'rc-btn' + (pads ? ' on' : '')} onClick={() => setMode('pads')}>🥁 Pads</button>
          </div>
          {WORLDS.map((w, wi) => (
            <section key={w.id} className="rc-world" style={{ background: w.sky, color: wi === 3 ? '#fff' : '#1c2b3a' }}>
              <h3>{w.emoji} {w.name} <small>{w.blurb}</small></h3>
              <div className="rc-tracks">
                {TRACKS.map((t, ix) => t.world !== wi ? null : (
                  <button key={t.id} className="rc-trk" disabled={!isUnlocked(ix, s.save)} onClick={() => openTrack(ix)}>
                    <b>{isUnlocked(ix, s.save) ? t.name : '🔒 ' + t.name}</b>
                    <span>{t.blurb}</span>
                    <Stars n={s.save.stars[t.id] ?? 0} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {s.phase === 'listen' && (
        <div className="rc-banner" role="status"><span className="rc-step">1 · LISTEN</span><b>{s.coach}</b></div>
      )}

      {s.phase === 'turn' && (
        <>
          <div className="rc-banner" role="status"><span className="rc-step">2 · YOUR TURN</span><b>{s.count > 0 ? 'Get ready...' : s.coach}</b></div>
          {s.count > 0 ? <div className="rc-count" aria-live="assertive">{s.count}</div> : null}
          {s.count === 0 && (
            <div className="rc-dock">
              <button className="rc-btn go big" onClick={() => emitScreen(1)}>GO!</button>
              <div className="rc-timer" aria-hidden><i style={{ width: `${Math.round(s.autoLeft * 100)}%` }} /></div>
              <button className="rc-btn ghost" onClick={hearAgain}>🔁 Hear it again{freeReplay() ? '' : ' (costs a star)'}</button>
            </div>
          )}
          {s.count === 0 && <p className="rc-hint">Foot pedal, the GO button, or wait a moment. {pads ? 'Tap the pads' : 'Play the keys'} in time with the click.</p>}
        </>
      )}

      {s.phase === 'race' && (
        <>
          <div className="rc-banner" role="status"><span className="rc-step">3 · RACE</span><b>The car drives what you played</b></div>
          {s.mishapNote && <div className={'rc-oops k-' + s.mishapKind} role="status" aria-live="polite"><b>Oops!</b> {s.mishapNote}</div>}
        </>
      )}

      {s.phase === 'result' && s.result && (
        <div className="rc-result" role="dialog" aria-label="Results">
          <h2>{s.result.stars === 3 ? '🏆 Perfect lap!' : s.result.stars > 0 ? '🏁 Finished!' : 'Hmm, no notes heard'}</h2>
          <Stars n={s.result.stars} big />
          <p className="rc-stats">Time {s.result.seconds.toFixed(1)} s{s.result.best ? ' · new best!' : ''} · {s.result.mishaps} mishap{s.result.mishaps === 1 ? '' : 's'} · clean-lap streak {s.result.streak}</p>
          <ul className="rc-lines">{s.result.lines.slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}</ul>
          <div className="rc-actions">
            {s.result.passed && s.trackIx + 1 < TRACKS.length && <button className="rc-btn go" onClick={nextTrack}>Next track →</button>}
            <button className="rc-btn" onClick={retry}>↻ Retry</button>
            <button className="rc-btn" onClick={hearAgain}>🔁 Hear it again</button>
            <button className="rc-btn ghost" onClick={toMap}>🗺️ Tracks</button>
          </div>
          <p className="rc-hint">Foot pedal: next track, or retry.</p>
        </div>
      )}
    </div>
  )
}
