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
  const [open, setOpen] = useState(true)

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
          <h2>{active.def.emoji} {active.def.title} <small>{active.def.levels[active.level]}</small></h2>
          <div className="ch-actions">
            {['echo', 'detective', 'majmin', 'boss', 'daily'].includes(active.def.id) ? (
              <label className="ch-toggle"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> soft beeps</label>
            ) : null}
            <button className="ch-btn ghost" onClick={quit}>Stop</button>
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
          <button className="ch-btn" onClick={() => start(result.defId, result.level)}>Go again</button>
          <button className="ch-btn ghost" onClick={quit}>Pick another</button>
        </div>
      </section>
    )
  }

  // ---------- picker ----------
  return (
    <section className="ch">
      <div className="ch-head">
        <h2>Challenges <small>{earned}/{CHALLENGES.length} badges</small></h2>
        <button className="ch-btn ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <>
          <div className="ch-grid">
            {CHALLENGES.map((c) => {
              const b = bests[`${c.id}:${lvl(c.id)}`]
              return (
                <div className="ch-card" key={c.id}>
                  <div className="ch-card-top">
                    <span className="ch-emoji">{c.emoji}</span>
                    <span className="ch-diff" title="Difficulty">{stars(c.difficulty)}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                  {c.levels.length > 1 && (
                    <div className="ch-levels">
                      {c.levels.map((l, i) => (
                        <button key={l} className={'ch-chip' + (i === lvl(c.id) ? ' on' : '')} onClick={() => setLevels({ ...levels, [c.id]: i })}>{l}</button>
                      ))}
                    </div>
                  )}
                  <div className="ch-card-foot">
                    <button className="ch-btn" onClick={() => start(c.id, lvl(c.id))}>Start</button>
                    {b !== undefined && <span className="ch-best">Best {b}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="ch-shelf">
            <span className="ch-shelf-t">Badges</span>
            {CHALLENGES.map((c) => (
              <span key={c.id} className={'ch-badge' + (badges[c.id] ? ' got' : '') + (badges[c.id] === 2 ? ' gold' : '')} title={`${c.badge}${badges[c.id] ? '' : ' (finish ' + c.title + ')'}`}>
                {c.emoji}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
