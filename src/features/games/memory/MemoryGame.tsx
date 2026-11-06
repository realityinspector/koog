import { useEffect, useState } from 'react'
import { LEVELS, bestKey, fmtTime, levelDef, type Level, type Phr } from './data'
import { flip, replay, retry, setKode, start, startBonus, stop, toMenu, useMemory } from './engine'
import { KodePowerCard } from '../gamekode/KodePowerCard'
import { varLine } from '../gamekode/kodeLogic'
import './memory.css'

const DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const diat = (n: number) => Math.floor(n / 12) * 7 + DIATONIC[n % 12]
const BLACK = new Set([1, 3, 6, 8, 10])
const hue = (n: number) => (n % 12) * 30

/** A little staff picture of a phrase: heads sit higher for higher notes, spaced by when they sound, hollow when long. */
function Staff({ p }: { p: Phr }) {
  const ds = p.notes.map((n) => diat(n.note))
  const lo = Math.min(...ds), hi = Math.max(...ds), span = Math.max(4, hi - lo)
  const step = Math.min(4.2, 34 / span)
  const total = Math.max(1, ...p.notes.map((n) => n.beat + n.beats))
  const x = (b: number) => 12 + (b / total) * 76
  const y = (d: number) => 46 - (d - lo) * step - (span < 8 ? (8 - span) * step * 0.5 : 0)
  const pts = p.notes.map((n, i) => `${x(n.beat)},${y(ds[i])}`).join(' ')
  return (
    <svg className="pm-staff" viewBox="0 0 100 60" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="4" x2="96" y1={14 + i * 8} y2={14 + i * 8} />)}
      <polyline points={pts} className="pm-line" />
      {p.notes.map((n, i) => (
        <g key={i}>
          <ellipse cx={x(n.beat)} cy={y(ds[i])} rx="4.6" ry="3.6" fill={n.beats >= 2 ? 'none' : `hsl(${hue(n.note)} 80% 58%)`} stroke={`hsl(${hue(n.note)} 80% 58%)`} strokeWidth="2" />
          {BLACK.has(n.note % 12) && <text x={x(n.beat) - 11} y={y(ds[i]) + 3} className="pm-sharp">♯</text>}
        </g>
      ))}
    </svg>
  )
}

function Stars({ n }: { n: number }) {
  return <span className="pm-stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>
}

/** Phrase Match: a memory card game. Find the twin tune, then play it back to win the pair. */
export function MemoryGame({ onExit }: { onExit: () => void }) {
  const s = useMemory()
  const [, tick] = useState(0)
  useEffect(() => () => { toMenu() }, [])
  useEffect(() => {
    if (s.phase !== 'play') return
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [s.phase])
  const def = levelDef(s.level)
  const ms = s.startedAt ? (s.phase === 'done' ? s.endedAt : Date.now()) - s.startedAt : 0

  if (s.phase === 'menu') {
    return (
      <div className="pm-root" data-phase="menu">
        <div className="pm-menu">
          <h2>🃏 Phrase Match</h2>
          <p>Flip cards to hear short tunes. Find two cards with the same tune, then <b>play it back</b> on the keys to win the pair.</p>
          <EarToggle />
          <KodePowerCard game="memory" on={s.kode} onToggle={() => setKode(!s.kode)} status={s.kode && s.kodeWins ? `Expressions played: ${s.kodeWins}` : undefined}>
            <p>Win a pair and its tune gets a name. After the table is clear, a bonus asks you to play an expression like <code className="gk-code">b a b</code>.</p>
          </KodePowerCard>
          <div className="pm-levels">
            {LEVELS.map((l) => {
              const b = s.save.best[bestKey(l.id, s.ear)]
              return (
                <button key={l.id} className={'pm-level pm-' + l.id} onClick={() => start(l.id as Level, s.ear)}>
                  <b>{l.label}</b>
                  <span>{l.blurb}</span>
                  {b ? <span className="pm-best">Best: {b.flips} flips · {fmtTime(b.ms)} <Stars n={b.stars} /></span> : <span className="pm-best dim">No score yet</span>}
                </button>
              )
            })}
          </div>
          <button className="pm-btn ghost" onClick={onExit}>Back to games</button>
        </div>
      </div>
    )
  }

  const bestNow = s.save.best[bestKey(s.level, s.ear)]
  return (
    <div className="pm-root" data-phase={s.phase} data-stage={s.stage} data-level={s.level}>
      <div className="pm-top">
        <button className="pm-btn ghost" onClick={() => { toMenu() }}>‹ Menu</button>
        <b className="pm-title">🃏 {def.label}{s.ear ? ' · Ear only' : ''}</b>
        <span className="pm-stat" data-testid="flips">Flips {s.flips}</span>
        <span className="pm-stat">Pairs {s.matched}/{s.phrases.length}</span>
        <span className="pm-stat">⏱ {fmtTime(ms)}</span>
      </div>
      <div className="pm-msg" role="status">
        <span>{s.msg}</span>
        {s.stage === 'claim' && <button className="pm-btn" onClick={replay}>🔁 Hear it again</button>}
      </div>
      {s.kode && s.vars.length > 0 && <VarStrip />}
      <div className="pm-grid" style={{ ['--c' as string]: def.cols, ['--r' as string]: def.rows }}>
        {s.cards.map((c, i) => {
          const ph = s.phrases[c.pair]
          const open = c.up || c.done
          return (
            <button key={c.id} className={'pm-card' + (open ? ' up' : '') + (c.done ? ' done' : '') + (s.picks.includes(i) && s.stage === 'claim' ? ' claim' : '')}
              onClick={() => flip(i)} aria-label={open ? `Card ${i + 1}, ${ph.notes.length} notes${c.done ? ', won' : ''}` : `Card ${i + 1}, face down`} data-idx={i}>
              <span className="pm-in">
                <span className="pm-back"><span>🎵</span></span>
                <span className="pm-face">
                  {s.ear ? <span className="pm-ear">👂<small>{ph.notes.length} notes</small></span> : <Staff p={ph} />}
                  {c.done && <span className="pm-ok">✓</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {s.phase === 'done' && (
        <div className="pm-over" role="dialog" aria-label="You cleared the table">
          <div className="pm-confetti" aria-hidden>{['🎵', '⭐', '🎶', '🃏', '🎉', '🎵', '⭐', '🎶'].map((e, i) => <i key={i} style={{ ['--i' as string]: i }}>{e}</i>)}</div>
          <h3>Table cleared!</h3>
          <Stars n={s.stars} />
          <p>{s.flips} flips · {s.misses} missed play-backs · {fmtTime(ms)}</p>
          {s.kode && s.vars.length > 0 && <KodeBonus />}
          <p className="pm-bestline">{s.newBest ? 'New best for this level!' : bestNow ? `Best: ${bestNow.flips} flips in ${fmtTime(bestNow.ms)}` : ''}</p>
          <div className="pm-row">
            {s.level !== 'hard' && <button className="pm-btn go" onClick={() => start(s.level === 'easy' ? 'medium' : 'hard', s.ear)}>Next level</button>}
            <button className="pm-btn go" onClick={retry}>Retry</button>
            <button className="pm-btn" onClick={() => { toMenu() }}>Menu</button>
            <button className="pm-btn ghost" onClick={() => { stop(); toMenu(); onExit() }}>Games</button>
          </div>
        </div>
      )}
    </div>
  )
}

function EarToggle() {
  const ear = useMemory((s) => s.ear)
  return (
    <button className={'pm-btn pm-ear-opt' + (ear ? ' on' : '')} aria-pressed={ear} onClick={() => useMemory.setState({ ear: !ear })}>
      {ear ? '👂 Ear only: ON' : '👂 Ear only: off'} <small>(no pictures on the cards)</small>
    </button>
  )
}

/** Kode cards: the variables you have won so far, like a = "c e g" */
function VarStrip() {
  const vars = useMemory((s) => s.vars)
  return (
    <ul className="gk-list pm-vars" aria-label="Your variables" data-testid="vars">
      {vars.map((v) => <li key={v.name}><code className="gk-code">{varLine(v)}</code></li>)}
    </ul>
  )
}

function KodeBonus() {
  const vars = useMemory((s) => s.vars)
  const bonus = useMemory((s) => s.bonus)
  return (
    <div className="pm-kode" data-testid="kode-bonus">
      <VarStrip />
      {bonus.state === 'off' && vars.length >= 2 && <button className="pm-btn go" onClick={startBonus}>🧑‍💻 Bonus: play an expression</button>}
      {bonus.state === 'play' && <p>Play <code className="gk-code">{bonus.expr.join(' ')}</code> ({bonus.progress}/{bonus.want.length} notes)</p>}
      {bonus.state === 'won' && <p>✅ You ran <code className="gk-code">{bonus.expr.join(' ')}</code>! <button className="pm-btn" onClick={startBonus}>Another</button></p>}
    </div>
  )
}
