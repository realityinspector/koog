import { useEffect, useState } from 'react'
import { CHALLENGES } from './defs'
import { useScreen } from '../../layout/screenStore'
import { useChallengeStore } from './store'
import { MiniKeyboard } from './MiniKeyboard'
import './challenges.css'

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
const TIERS: { id: string; label: string; hint: string; test: (c: (typeof CHALLENGES)[number]) => boolean }[] = [
  { id: 'warm', label: 'Warm-up', hint: 'Easy and fun', test: (c) => c.difficulty === 1 && c.id !== 'boss' },
  { id: 'skills', label: 'Skills', hint: 'Build real chops', test: (c) => c.difficulty === 2 && c.id !== 'boss' },
  { id: 'boss', label: 'Boss', hint: 'Bring your A-game', test: (c) => c.difficulty >= 3 || c.id === 'boss' },
]

export function ChallengesPanel() {
  const active = useChallengeStore((s) => s.active)
  const result = useChallengeStore((s) => s.result)
  useChallengeStore((s) => s.rev)
  const bests = useChallengeStore((s) => s.bests)
  const badges = useChallengeStore((s) => s.badges)
  const sound = useChallengeStore((s) => s.sound)
  const { start, quit, setSound, tick } = useChallengeStore.getState()
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [pick, setPick] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => useChallengeStore.getState().tick(), 120)
    return () => clearInterval(id)
  }, [active])
  void tick
  // The screen stays mounted (hidden) when the kid goes to PLAY, so stop a run on leaving:
  // the key it forced (and auto-detect) go back, and it cannot finish unseen. Also on unmount (profile switch).
  const screen = useScreen((s) => s.screen)
  useEffect(() => { if (screen !== 'challenges') useChallengeStore.getState().quit() }, [screen])
  useEffect(() => () => { useChallengeStore.getState().quit() }, [])

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
  // "Next up": the easiest challenge with no badge yet (everything earned: the daily one)
  const next = [...CHALLENGES].sort((a, b) => a.difficulty - b.difficulty).find((c) => !badges[c.id] && c.id !== 'daily') ?? CHALLENGES.find((c) => c.id === 'daily') ?? CHALLENGES[0]
  const sel = CHALLENGES.find((c) => c.id === pick) ?? next
  const selBest = bests[`${sel.id}:${lvl(sel.id)}`]
  const tile = (c: (typeof CHALLENGES)[number]) => {
    const bd = badges[c.id]
    return (
      <button
        key={c.id}
        role="listitem"
        aria-pressed={c.id === sel.id}
        className={'ch-tile' + (c.id === sel.id ? ' on' : '') + (bd ? ' got' : '') + (bd === 2 ? ' gold' : '') + (c.id === next.id ? ' next' : '')}
        onClick={() => setPick(c.id)}
        title={c.badge}
      >
        <span className="ch-tile-em">{c.emoji}</span>
        <span className="ch-tile-t">{c.title}</span>
        <span className="ch-tile-s">{bd ? (bd === 2 ? '★ gold' : '✓ badge') : stars(c.difficulty)}</span>
      </button>
    )
  }
  return (
    <section className="ch ch-pick">
      <div className="ch-detail">
        <span className="ch-detail-em" aria-hidden>{sel.emoji}</span>
        <div className="ch-detail-txt">
          {sel.id === next.id && <em className="ch-next-tag">Next up</em>}
          <b>{sel.title} <i>{stars(sel.difficulty)}</i></b>
          <span>{sel.desc}</span>
        </div>
        {sel.levels.length > 1 && (
          <div className="ch-levels">
            {sel.levels.map((l, i) => (
              <button key={l} aria-pressed={i === lvl(sel.id)} className={'ch-chip' + (i === lvl(sel.id) ? ' on' : '')} onClick={() => setLevels({ ...levels, [sel.id]: i })}>{l}</button>
            ))}
          </div>
        )}
        <div className="ch-detail-go">
          {selBest !== undefined && <span className="ch-best">Best {selBest}</span>}
          <button className="btn" onClick={() => start(sel.id, lvl(sel.id))}>▶ Start</button>
        </div>
      </div>
      <div className="ch-tiers">
        {TIERS.map((t) => (
          <div key={t.id} className={'ch-tier ch-tier-' + t.id}>
            <div className="ch-tier-h"><b>{t.label}</b><span>{t.hint}</span></div>
            <div className="ch-grid" role="list">{CHALLENGES.filter(t.test).map(tile)}</div>
          </div>
        ))}
      </div>
      <div className="ch-case" aria-label="Trophy case">
        <span className="ch-case-t">Trophy case <b>{earned}/{CHALLENGES.length}</b></span>
        <div className="ch-case-row">
          {CHALLENGES.map((c) => (
            <span key={c.id} className={'ch-trophy' + (badges[c.id] ? ' got' : '') + (badges[c.id] === 2 ? ' gold' : '')} title={badges[c.id] ? c.badge : `Locked: ${c.title}`}>{badges[c.id] ? c.emoji : ''}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
