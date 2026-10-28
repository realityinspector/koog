import { useEffect, useState } from 'react'
import { CHALLENGES } from './defs'
import { useChallengeStore } from './store'
import { MiniKeyboard } from './MiniKeyboard'
import './challenges.css'

const stars = (n: number) => '●'.repeat(n) + '○'.repeat(3 - n)

export function ChallengesPanel() {
  const active = useChallengeStore((s) => s.active)
  const result = useChallengeStore((s) => s.result)
  useChallengeStore((s) => s.rev)
  const bests = useChallengeStore((s) => s.bests)
  const badges = useChallengeStore((s) => s.badges)
  const sound = useChallengeStore((s) => s.sound)
  const { start, quit, setSound, tick } = useChallengeStore.getState()
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [pick, setPick] = useState<string>(CHALLENGES[0].id)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => useChallengeStore.getState().tick(), 120)
    return () => clearInterval(id)
  }, [active])
  void tick

  const lvl = (id: string) => levels[id] ?? 0
  const earned = CHALLENGES.filter((c) => badges[c.id]).length

  // ---------- running ----------
  if (active) {
    const v = active.engine.view(performance.now())
    return (
      <section className="ch ch-run">
        <div className="ch-head">
          <div className="ch-run-t">{active.def.emoji} {active.def.title} <small>{active.def.levels[active.level]}</small></div>
          <div className="ch-actions">
            {['echo', 'detective', 'majmin', 'boss', 'daily'].includes(active.def.id) ? (
              <label className="ch-toggle"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> soft beeps</label>
            ) : null}
            <button className="btn-ghost" onClick={quit}>Stop</button>
          </div>
        </div>
        <div className="ch-big">{v.status}</div>
        {v.sub && <div className="ch-sub">{v.sub}</div>}
        <div className="ch-bar"><i style={{ width: `${Math.round(v.progress * 100)}%` }} /></div>
        <div className="ch-stats">
          {v.timeLeft !== undefined && <span><b>{v.timeLeft.toFixed(1)}s</b> left</span>}
          {v.stats.map(([k, val]) => <span key={k}>{k}: <b>{val}</b></span>)}
        </div>
        <MiniKeyboard v={v} />
      </section>
    )
  }

  // ---------- finish ----------
  if (result) {
    const def = CHALLENGES.find((c) => c.id === result.defId)!
    return (
      <section className="ch ch-finish">
        <div className="ch-emoji-big">{result.perfect ? '🌟' : '🎉'}</div>
        <h2>{result.headline}</h2>
        <div className="ch-score">{result.score}<small> {result.unit}</small></div>
        <p className="ch-sub">{result.detail}</p>
        <p className="ch-sub">
          {result.isBest ? <b className="ch-pb">New personal best!</b> : <>Personal best: <b>{result.best}</b></>}
          {result.newBadge && <> · Badge earned: <b className="ch-pb">{def.emoji} {result.newBadge}</b></>}
        </p>
        <div className="ch-actions">
          <button className="btn" onClick={() => start(result.defId, result.level)}>Go again</button>
          <button className="btn-ghost" onClick={quit}>Pick another</button>
        </div>
      </section>
    )
  }

  // ---------- picker ----------
  const sel = CHALLENGES.find((c) => c.id === pick) ?? CHALLENGES[0]
  const selBest = bests[`${sel.id}:${lvl(sel.id)}`]
  return (
    <section className="ch ch-pick">
      <div className="ch-grid" role="list">
        {CHALLENGES.map((c) => {
          const bd = badges[c.id]
          return (
            <button
              key={c.id}
              role="listitem"
              className={'ch-tile' + (c.id === sel.id ? ' on' : '') + (bd ? ' got' : '') + (bd === 2 ? ' gold' : '')}
              onClick={() => setPick(c.id)}
              title={c.badge}
            >
              <span className="ch-tile-em">{c.emoji}</span>
              <span className="ch-tile-t">{c.title}</span>
              <span className="ch-tile-s">{bd ? (bd === 2 ? '★ gold' : '✓ badge') : stars(c.difficulty)}</span>
            </button>
          )
        })}
      </div>
      <div className="ch-detail">
        <span className="ch-detail-em">{sel.emoji}</span>
        <div className="ch-detail-txt">
          <b>{sel.title} <i>{stars(sel.difficulty)}</i></b>
          <span>{sel.desc}</span>
        </div>
        {sel.levels.length > 1 && (
          <div className="ch-levels">
            {sel.levels.map((l, i) => (
              <button key={l} className={'ch-chip' + (i === lvl(sel.id) ? ' on' : '')} onClick={() => setLevels({ ...levels, [sel.id]: i })}>{l}</button>
            ))}
          </div>
        )}
        <div className="ch-detail-go">
          {selBest !== undefined && <span className="ch-best">Best {selBest}</span>}
          <button className="btn" onClick={() => start(sel.id, lvl(sel.id))}>▶ Start</button>
        </div>
      </div>
      <div className="ch-count">{earned}/{CHALLENGES.length} badges</div>
    </section>
  )
}
