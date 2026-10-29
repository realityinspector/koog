import { useEffect, useRef, useState } from 'react'
import { useJudge } from '../../../music/judge'
import { Game } from './engine'
import { BELTS, RUNGS, LAST_RUNG, loadSave, type Snapshot } from './data'
import './jiujitsu.css'

function initialSnap(): Snapshot {
  const save = loadSave()
  return {
    phase: 'menu', belt: save.belt, stripes: save.stripes, practice: false, rung: 0, points: 0, partner: 0, banner: '', tip: '',
    ei: 0, len: 0, slips: 0, maxSlips: 5, lesson: '', promoTo: -1, stripeEarned: false, newBest: false, tapN: 0,
    songs: [], songIx: 0, flowPos: 0, flowTotal: 0, chain: 0, longest: 0, save,
  }
}

/** Jiu-Jitsu Flow: answer your partner's call with the same notes, on the beat, to climb from standing to a submission. */
export function JiuJitsu({ onExit }: { onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [snap, setSnap] = useState<Snapshot>(initialSnap)

  useEffect(() => {
    const g = new Game(canvasRef.current!, rootRef.current!, setSnap)
    gameRef.current = g
    return () => { g.destroy(); gameRef.current = null }
  }, [])
  const g = () => gameRef.current
  const playing = ['bow', 'call', 'echo', 'move', 'sub', 'flow'].includes(snap.phase)
  const flow = snap.phase === 'flow' || snap.phase === 'flowend'
  const beltName = BELTS[snap.belt].name

  return (
    <div className="bj-root" ref={rootRef} data-phase={snap.phase}>
      <canvas className="bj-canvas" ref={canvasRef} aria-label="Jiu-jitsu mat: you and your training partner" />
      {playing && (
        <div className="bj-hud">
          <div className="bj-left"><BeltBar belt={snap.belt} stripes={snap.stripes} /><span className="bj-beltname">{snap.practice ? 'Practice' : beltName + ' belt'}</span></div>
          <div className="bj-score" role="status" aria-label={`You ${snap.points} points, partner ${snap.partner} points`}>
            <div><small>YOU</small><b>{snap.points}</b></div>
            <i>POINTS</i>
            <div><small>PARTNER</small><b>{snap.partner}</b></div>
          </div>
          <div className="bj-right">
            <BoomMeter />
            <button className="bj-quit" onClick={() => g()?.toMenu()} aria-label="Quit to menu">✕</button>
          </div>
        </div>
      )}
      {playing && (
        <div className="bj-bottom">
          {!flow && (
            <div className="bj-ladder" aria-label="Position ladder">
              {RUNGS.map((r, i) => <span key={r} className={(i === snap.rung ? 'cur ' : '') + (i < snap.rung ? 'done' : '')}>{r}</span>)}
            </div>
          )}
          <div className="bj-banner" role="status">{snap.banner}</div>
          <div className="bj-row">
            {!flow && snap.len > 0 && (snap.phase === 'echo' || snap.phase === 'call') && (
              <>
                <span className="bj-dots" aria-label={`${snap.ei} of ${snap.len} notes`}>{Array.from({ length: snap.len }, (_, i) => <i key={i} className={i < snap.ei ? 'on' : ''} />)}</span>
                <button className="bj-btn small" onClick={() => g()?.hear()}>🔁 Hear it again</button>
              </>
            )}
            {flow && <span className="bj-chain">Flow x{snap.chain} <small>best {snap.longest}</small> <small>{snap.flowPos}/{snap.flowTotal}</small></span>}
            {snap.tip && <span className="bj-tip">{snap.tip}</span>}
          </div>
        </div>
      )}
      {snap.phase === 'menu' && (
        <div className="bj-panel">
          <div className="bj-card">
            <h2 className="bj-title">🥋 Jiu-Jitsu Flow</h2>
            <p className="bj-sub">Your partner makes a move with a few notes. Echo them on the beat to escape, then climb to the finish. Always bow, and always tap early.</p>
            <div className="bj-beltrow"><BeltBar belt={snap.save.belt} stripes={snap.save.stripes} big /><b>{BELTS[snap.save.belt].name} belt · stripe {snap.save.stripes + 1 > 4 ? 4 : snap.save.stripes + 1} of 4</b></div>
            {snap.save.belt > 0 && (
              <div className="bj-pick" role="group" aria-label="Train at belt">
                Train at
                {BELTS.slice(0, snap.save.belt + 1).map((b, i) => (
                  <button key={b.id} className="bj-chip" aria-pressed={snap.belt === i && !snap.practice ? true : snap.belt === i} onClick={() => g()?.setTrainBelt(i)}>{b.name}</button>
                ))}
              </div>
            )}
            {snap.save.best > 0 && <div className="bj-best">🏆 Best round: {snap.save.best} pts</div>}
            <div className="bj-row">
              <button className="bj-btn go" onClick={() => g()?.start()}>▶ Start rolling</button>
              {snap.songs.length > 0 && <button className="bj-btn" onClick={() => g()?.startFlow()}>🌊 Flow roll</button>}
              <button className="bj-btn ghost" onClick={onExit}>Back</button>
            </div>
            {snap.songs.length > 0 && (
              <div className="bj-pick">
                Flow song
                <button className="bj-chip" aria-label="Previous song" onClick={() => g()?.setSong(snap.songIx - 1)}>◀</button>
                <b className="bj-song">{snap.songs[snap.songIx].title}</b>
                <button className="bj-chip" aria-label="Next song" onClick={() => g()?.setSong(snap.songIx + 1)}>▶</button>
              </div>
            )}
          </div>
        </div>
      )}
      {snap.phase === 'lesson' && (
        <div className="bj-panel">
          <div className="bj-card">
            <h2 className="bj-title">🤝 {snap.rung === LAST_RUNG ? 'Round complete' : 'Nice roll'}</h2>
            <div className="bj-big">{snap.points} points{snap.newBest ? ' · new best!' : ''}</div>
            <p className="bj-lesson">{snap.lesson}</p>
            {snap.stripeEarned && snap.promoTo < 0 && <div className="bj-stripe">Stripe earned!<BeltBar belt={snap.save.belt} stripes={snap.save.stripes} big /></div>}
            {snap.promoTo >= 0 && <div className="bj-stripe">Fourth stripe earned! Something special is next…</div>}
            <div className="bj-row"><button className="bj-btn go" onClick={() => g()?.cont()}>Continue ▶</button><button className="bj-btn ghost" onClick={() => g()?.toMenu()}>Menu</button></div>
          </div>
        </div>
      )}
      {snap.phase === 'promo' && snap.promoTo >= 0 && (
        <div className="bj-panel">
          <div className="bj-card promo">
            <h2 className="bj-title">🎉 {BELTS[snap.promoTo].name} belt!</h2>
            <BeltBar belt={snap.promoTo} stripes={0} big />
            <p className="bj-lesson">Your coach ties the new belt around your waist. You bow, and your training partner bows back. The belt is not about winning: it shows how long you have kept learning, kindly and with respect.</p>
            <div className="bj-bow" aria-hidden>🙇 🙇</div>
            <div className="bj-row"><button className="bj-btn go" onClick={() => g()?.cont()}>Oss! Keep training ▶</button></div>
          </div>
        </div>
      )}
      {snap.phase === 'flowend' && (
        <div className="bj-panel">
          <div className="bj-card">
            <h2 className="bj-title">🌊 Flow complete</h2>
            <div className="bj-big">{snap.points} points{snap.newBest ? ' · new best!' : ''}</div>
            <p className="bj-lesson">Longest flow chain: {snap.longest}. Smooth and steady beats fast and sloppy, on the mat and on the keys.</p>
            <div className="bj-row"><button className="bj-btn go" onClick={() => g()?.startFlow()}>↻ Again</button><button className="bj-btn" onClick={() => g()?.toMenu()}>Menu</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function BeltBar({ belt, stripes, big }: { belt: number; stripes: number; big?: boolean }) {
  const b = BELTS[belt]
  return (
    <span className={'bj-belt' + (big ? ' big' : '')} style={{ background: b.color }} aria-label={`${b.name} belt, ${Math.min(4, stripes)} stripes`}>
      <span className="bj-tab" style={{ background: belt === 4 ? '#b3222e' : '#14141a' }}>
        {Array.from({ length: Math.min(4, stripes) }, (_, i) => <i key={i} />)}
      </span>
    </span>
  )
}

function BoomMeter() {
  const charge = useJudge((s) => s.charge)
  const full = charge >= 1
  return (
    <div className={'bj-boom' + (full ? ' full' : '')} role="meter" aria-label="BOOM charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(charge * 100)}>
      <span aria-hidden>⚡</span>
      <div className="bj-boom-bar"><i style={{ width: charge * 100 + '%' }} /></div>
      <span>{full ? 'BOOM READY!' : 'BOOM'}</span>
    </div>
  )
}
