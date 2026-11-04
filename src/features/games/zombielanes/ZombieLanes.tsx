import { useEffect, useRef, useState } from 'react'
import { useJudge } from '../../../music/judge'
import { PhraseHud } from '../PhraseHud'
import { Game } from './engine'
import { LEVELS, MAX_LIVES, bossPieces, loadSave, type Mode, type Snapshot } from './data'
import { KodePowerCard } from '../gamekode/KodePowerCard'
import { kload, ksave } from '../gamekode/kodeStore'
import { expandPattern } from '../gamekode/kodeLogic'
import './zombielanes.css'

const bossTitle = (id: string) => bossPieces().find((p) => p.id === id)?.title ?? 'a tune'

function initialSnap(): Snapshot {
  const save = loadSave()
  return { phase: 'menu', mode: save.mode, wave: 1, score: 0, lives: MAX_LIVES, combo: 0, left: 0, jam: false, bossHp: 0, bossMax: 0, stars: 0, won: false, newBest: false, cleared: 0, save, bonusBrain: false, bossSong: save.boss }
}

/** Zombie Lanes: zombies march down lanes lined up with the real keys. Play the note on the sign to blast one. */
export function ZombieLanes({ onExit }: { onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [snap, setSnap] = useState<Snapshot>(initialSnap)
  const [startWave, setStartWave] = useState(1)

  useEffect(() => {
    const g = new Game(canvasRef.current!, rootRef.current!, setSnap)
    gameRef.current = g
    return () => { g.destroy(); gameRef.current = null }
  }, [])

  const g = () => gameRef.current
  const unlocked = snap.save.wave[snap.mode]
  const wave = Math.min(startWave, unlocked)
  const playing = snap.phase === 'play' || snap.phase === 'card'

  return (
    <div className="zl-root" ref={rootRef} data-phase={snap.phase}>
      <canvas className="zl-canvas" ref={canvasRef} aria-label="Zombie Lanes game field" />
      {playing && <Hud snap={snap} onQuit={() => g()?.toMenu()} />}
      {snap.phase === 'play' && snap.coach && (
        <div className={'zl-coach ' + snap.coach.kind} role="status">{snap.coach.text}</div>
      )}
      {snap.phase === 'play' && snap.jam && (
        <div className="zl-jam" role="status">JAMMED! Charge ⚡ BOOM by playing in key</div>
      )}
      {snap.phase === 'menu' && (
        <div className="zl-panel">
          <div className="zl-card">
            <h2 className="zl-title">🧟 Zombie Lanes</h2>
            <p className="zl-sub">Play the note on the zombie's sign to blast it before it eats your brains!</p>
            <div className="zl-modes" role="group" aria-label="Difficulty">
              <ModeBtn mode="easy" cur={snap.mode} title="Easy" sub="any octave counts" onPick={(m) => g()?.setMode(m)} />
              <ModeBtn mode="normal" cur={snap.mode} title="Normal" sub="the exact key" onPick={(m) => g()?.setMode(m)} />
            </div>
            {unlocked > 1 && (
              <div className="zl-picker" role="group" aria-label="Start at wave">
                Start at wave
                {LEVELS.map((l) => (
                  <button key={l.wave} className="zl-wv" aria-pressed={wave === l.wave} disabled={l.wave > unlocked} onClick={() => setStartWave(l.wave)} aria-label={`Wave ${l.wave}: ${l.title}`}>{l.wave}</button>
                ))}
              </div>
            )}
            <label className="zl-boss-pick">
              👑 Zombie King plays
              <select value={snap.bossSong} onChange={(e) => g()?.setBossSong(e.target.value)} aria-label="Zombie King's piece">
                {bossPieces().map((p) => <option key={p.id} value={p.id}>{p.id === 'ode' ? 'Ode to Joy (default)' : p.title}</option>)}
              </select>
            </label>
            <TurretKode />
            {snap.save.best[snap.mode] > 0 && <div className="zl-best">🏆 Best score: {snap.save.best[snap.mode].toLocaleString()}</div>}
            <div className="zl-row">
              <button className="zl-btn go" onClick={() => g()?.start(snap.mode, wave)}>▶ Start</button>
              <button className="zl-btn conga" onClick={() => g()?.startConga(snap.mode)} title="Memorize little tunes: a line of zombies carries each phrase">🪗 Conga lines</button>
              <button className="zl-btn ghost" onClick={onExit}>Back</button>
            </div>
          </div>
        </div>
      )}
      {snap.phase === 'card' && snap.conga && (
        <div className="zl-panel">
          <div className="zl-card">
            <h2 className="zl-wnum">🪗 Conga lines!</h2>
            <p className="zl-wname">Memorize little tunes</p>
            <p className="zl-lesson">A line of zombies marches in, one zombie for each note of a tune. The lead zombie sings it first. Then play it in order as each zombie reaches the strike line.</p>
            <p className="zl-tip">First with lit keys, then from memory, then right on the beat. Miss a note and the line speeds up and gains a zombie. Play it cleanly and the whole line falls like dominoes!</p>
            <div className="zl-row">
              <button className="zl-btn go" onClick={() => g()?.beginWave()}>Go! ▶</button>
              <span className="zl-hint">or play any key to start</span>
            </div>
          </div>
        </div>
      )}
      {snap.phase === 'card' && !snap.conga && (
        <div className="zl-panel">
          <div className="zl-card">
            <h2 className="zl-wnum">Wave {snap.wave}!</h2>
            <p className="zl-wname">{LEVELS[snap.wave - 1].title}</p>
            <p className="zl-lesson">{LEVELS[snap.wave - 1].boss && snap.bossSong !== 'ode' ? `Boss time! The King plays ${bossTitle(snap.bossSong)}. Play it one note at a time. Each right note hits the King.` : LEVELS[snap.wave - 1].lesson}</p>
            {snap.wave <= 3 && <MiniKeys octaves={snap.wave === 2 ? 2 : 1} names={snap.wave === 3 ? 'accidentals' : 'letters'} />}
            {LEVELS[snap.wave - 1].tip && !(LEVELS[snap.wave - 1].boss && snap.bossSong !== 'ode') && <p className="zl-tip">{LEVELS[snap.wave - 1].tip}</p>}
            {snap.bonusBrain && <p className="zl-tip">🧠 A brain grew back!</p>}
            <div className="zl-row">
              <button className="zl-btn go" onClick={() => g()?.beginWave()}>Go! ▶</button>
              <span className="zl-hint">or play any key to start</span>
            </div>
          </div>
        </div>
      )}
      {snap.phase === 'over' && (
        <div className="zl-panel">
          <div className="zl-card">
            <h2 className="zl-title">{snap.conga ? (snap.won ? '🪗 Conga cleared!' : 'Nice try!') : snap.won ? '👑 King defeated!' : 'Game over'}</h2>
            {snap.conga && <div className="zl-best">{snap.cleared} of 6 phrases played cleanly · best {snap.save.conga}</div>}
            <div className="zl-stars" aria-label={`${snap.stars} of 3 stars`}>
              {[0, 1, 2].map((i) => <span key={i} className={i < snap.stars ? 'on' : 'off'}>★</span>)}
            </div>
            <div className="zl-big">Score {snap.score.toLocaleString()}</div>
            {snap.conga ? null : snap.newBest ? <div className="zl-new">🎉 New best score!</div> : <div className="zl-best">🏆 Best: {snap.save.best[snap.mode].toLocaleString()}</div>}
            <div className="zl-row">
              <button className="zl-btn go" onClick={() => g()?.retry()}>↻ Retry</button>
              <button className="zl-btn" onClick={() => g()?.toMenu()}>Menu</button>
              <button className="zl-btn ghost" onClick={onExit}>Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACKS = [{ after: 0, s: 'C\u266F', f: 'D\u266D' }, { after: 1, s: 'D\u266F', f: 'E\u266D' }, { after: 3, s: 'F\u266F', f: 'G\u266D' }, { after: 4, s: 'G\u266F', f: 'A\u266D' }, { after: 5, s: 'A\u266F', f: 'B\u266D' }]

/** A tiny picture of the keys for the wave card: letters on the white keys, black keys in their real places. */
function MiniKeys({ octaves, names }: { octaves: 1 | 2; names: 'letters' | 'accidentals' }) {
  const n = 7 * octaves
  const bw = (100 / n) * 0.6
  return (
    <div className="zl-mini" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={'w' + (i >= 7 ? ' up' : '')}><b>{LETTERS[i % 7]}</b></i>
      ))}
      {Array.from({ length: octaves }, (_, o) => BLACKS.map((b) => (
        <i key={o + b.s} className="k" style={{ left: ((o * 7 + b.after + 1) / n) * 100 - bw / 2 + '%', width: bw + '%' }}>
          {names === 'accidentals' && (<><b>{b.s}</b><b>{b.f}</b></>)}
        </i>
      )))}
    </div>
  )
}

function ModeBtn({ mode, cur, title, sub, onPick }: { mode: Mode; cur: Mode; title: string; sub: string; onPick: (m: Mode) => void }) {
  return (
    <button className="zl-mode" aria-pressed={cur === mode} onClick={() => onPick(mode)}>
      <b>{title}</b>
      <span>{sub}</span>
    </button>
  )
}

function Hud({ snap, onQuit }: { snap: Snapshot; onQuit: () => void }) {
  const boss = snap.wave === LEVELS.length && snap.phase === 'play'
  return (
    <div className="zl-hud">
      <div>
        {snap.conga ? <span className="zl-wave">🪗 Conga</span> : <span className="zl-wave">Wave {snap.wave}/{LEVELS.length}</span>}
        {snap.conga && snap.ph && <PhraseHud i={snap.ph.i} n={snap.ph.n} rung={snap.ph.rung} />}
        {!boss && !snap.conga && snap.phase === 'play' && <span className="zl-left">{snap.left} left</span>}
        {boss && <span className="zl-score small">{snap.score.toLocaleString()}</span>}
      </div>
      {boss ? (
        <div className="zl-boss" role="progressbar" aria-label="Zombie King health" aria-valuenow={snap.bossHp} aria-valuemax={snap.bossMax}>
          <span>👑 King</span>
          <div className="zl-boss-bar"><i style={{ width: (snap.bossHp / snap.bossMax) * 100 + '%' }} /></div>
        </div>
      ) : (
        <div>
          <span className="zl-score">{snap.score.toLocaleString()}</span>
          {snap.combo >= 3 && <span className="zl-combo">x{snap.combo} combo</span>}
        </div>
      )}
      <div>
        <span className="zl-lives" aria-label={`${snap.lives} brains left`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => <span key={i} className={i < snap.lives ? '' : 'gone'}>🧠</span>)}
        </span>
        <BoomMeter />
        <button className="zl-quit" onClick={onQuit} aria-label="Quit to menu">✕</button>
      </div>
    </div>
  )
}

function BoomMeter() {
  const charge = useJudge((s) => s.charge)
  const full = charge >= 1
  return (
    <div className={'zl-boom' + (full ? ' full' : '')} role="meter" aria-label="BOOM charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(charge * 100)}>
      <span aria-hidden>⚡</span>
      <div className="zl-boom-bar"><i style={{ width: charge * 100 + '%' }} /></div>
      <span>{full ? 'BOOM READY!' : 'BOOM'}</span>
    </div>
  )
}

interface TurretSave { on: boolean; pattern: number[]; repeat: number; event: boolean }
const TURRET_DEFAULT: TurretSave = { on: false, pattern: [1, 3, 2, 4], repeat: 2, event: false }

/** Kode power: program a helper turret. Pick lanes in order (a sequence), say how many times to repeat (a loop), add an event rule. */
function TurretKode() {
  const [p, setP] = useState<TurretSave>(() => ({ ...TURRET_DEFAULT, ...kload<Partial<TurretSave>>('zombielanes', {}) }))
  const upd = (n: Partial<TurretSave>) => { const next = { ...p, ...n }; setP(next); ksave('zombielanes', next) }
  const steps = expandPattern(p.pattern, p.repeat)
  return (
    <KodePowerCard game="zombielanes" on={p.on} onToggle={() => upd({ on: !p.on })} status={p.on ? undefined : 'Off: the game plays exactly as before.'}>
      <div className="gk-row" role="group" aria-label="Add a lane to the turret pattern">
        <span>Lanes (left to right):</span>
        {[1, 2, 3, 4].map((l) => <button key={l} className="gk-btn" disabled={p.pattern.length >= 6} onClick={() => upd({ pattern: [...p.pattern, l] })} aria-label={`Add lane ${l}`}>{l}</button>)}
        <button className="gk-btn" onClick={() => upd({ pattern: p.pattern.slice(0, -1) })} aria-label="Remove the last lane">⌫</button>
      </div>
      <div className="gk-row" role="group" aria-label="Repeat">
        <span>Repeat:</span>
        {[1, 2, 3, 4].map((n) => <button key={n} className="gk-btn" aria-pressed={p.repeat === n} onClick={() => upd({ repeat: n })}>×{n}</button>)}
      </div>
      <label className="gk-row"><input type="checkbox" checked={p.event} onChange={(e) => upd({ event: e.target.checked })} /> Event rule: <i>when a zombie reaches the line, fire that lane</i> (3 shots a wave)</label>
      <div className="gk-row">Your program: <code className="gk-code" data-testid="turret-prog">repeat {p.repeat} {'{ fire ' + p.pattern.join(' ') + ' }'}</code> = {steps.join(' ') || 'nothing yet'}</div>
    </KodePowerCard>
  )
}
