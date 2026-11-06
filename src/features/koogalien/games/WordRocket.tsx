// Word Rocket (speed and fluency, review): words fall like slow meteors, in English. Play the chord to zap each one before it lands.
// Calm by default (chill); fast is optional. The difficulty follows the kid's spaced-repetition boxes and how the round goes.
// A meteor that lands just bounces off the shield: the word is shown and goes back into SRS as due. No lives, no game over.
import { useEffect, useRef, useState } from 'react'
import type { Chord, Degree } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { pickRound } from '../../../koogalien/learn/checks'
import { itemById } from '../../../koogalien/learn/items'
import { currentUnit } from '../../../koogalien/learn/ladder'
import { Mascot } from '../learn/Mascot'
import { useChordInput } from '../learn/useChordInput'
import { credit, helpFor } from './core'
import { exposeForTest, useGamesSave, usePedalNext, useProgress, useStage } from './hooks'
import { GameInput, Results } from './Shared'
import { ROCKET_TOTAL, lowest, newRocket, progressOf, rocketDone, tick, zap, type RocketMode, type RocketState } from './rocket'

const VOICE = 'zee'
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function WordRocket({ host, onBack }: { host: KoogalienHost; onBack: () => void }) {
  const { prog, commit } = useProgress(host)
  const { save, commit: commitSave } = useGamesSave(host)
  const stage = useStage(host)
  const [mode, setMode] = useState<RocketMode>(save.current.rocketFast ? 'fast' : 'chill')
  const [st, setSt] = useState<RocketState | null>(null)
  const [vt, setVt] = useState(0)
  const [paused, setPaused] = useState(false)
  const [fb, setFb] = useState<{ text: string; good: boolean } | null>(null)
  const [finished, setFinished] = useState(false)
  const ref = useRef<RocketState | null>(null)
  const clock = useRef({ t: 0, last: 0 })
  const ids = useRef<string[]>([])
  const seed = useRef(1)
  const helped = useRef<{ uid: number; late: boolean }>({ uid: 0, late: false })
  const pausedRef = useRef(false)
  const small = reduced()
  const set = (s: RocketState | null) => { ref.current = s; setSt(s) }
  exposeForTest('rocket', () => ({ state: ref.current, vt: clock.current.t, finished, progress: prog.current, save: save.current }))
  exposeForTest('rocketTick', () => (ms: number) => { clock.current.t += ms; step(0) })
  useEffect(() => { commitSave((g) => ({ ...g, last: 'rocket' })) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const speakId = (id: string) => { const e = itemById(id); if (e) stage.say([e.chord], VOICE) }

  const begin = (list?: string[], m: RocketMode = mode) => {
    const entries = list ? list.map((i) => itemById(i)!).filter(Boolean) : pickRound(currentUnit(prog.current.words), prog.current.cards, Date.now(), ROCKET_TOTAL, (seed.current += 1) + Math.floor(host.now() / 1000))
    ids.current = entries.map((e) => e.id)
    clock.current = { t: 0, last: host.now() }
    helped.current = { uid: 0, late: false }
    pausedRef.current = false; setPaused(false); setFinished(false); setFb(null); stage.unglow()
    set(newRocket(entries, prog.current.cards, m, 0)); setVt(0)
  }

  /** advance the sky by the real time since the last step (never more than a quarter second: a hidden tab does not rush the kid) */
  const step = (dtOverride?: number) => {
    const s = ref.current; if (!s || finished) return
    const now = host.now()
    const dt = dtOverride === 0 ? 0 : pausedRef.current ? 0 : Math.min(250, now - clock.current.last)
    clock.current.last = now
    clock.current.t += dt
    const t = clock.current.t
    const res = tick(s, t)
    let cur = res.state
    for (const e of res.events) {
      if (e.event === 'land' && e.id) {
        const w = itemById(e.id)
        commit((p) => credit(p, e.id!, false, 0, Date.now(), 'memory'))
        setFb({ text: `"${w?.en}" bounced off the shield. It will come back soon.`, good: false })
        speakId(e.id)
      }
    }
    set(cur); setVt(t)
    // the ladder of help for the word closest to landing
    const low = lowest(cur)
    if (low) {
      const h = helpFor(prog.current.words[low.id])
      const e = itemById(low.id)!
      if (helped.current.uid !== low.uid) {
        helped.current = { uid: low.uid, late: false }
        if (h === 'glow') stage.glow(e.chord as readonly Degree[])
        else stage.unglow()
      } else if (h === 'fade' && !helped.current.late && progressOf(low, t) > 0.55) { helped.current.late = true; stage.glow(e.chord as readonly Degree[], 1800) }
    } else stage.unglow()
    if (rocketDone(cur)) finish(cur)
  }
  const finish = (s: RocketState) => {
    setFinished(true); stage.unglow()
    if (s.points > save.current.rocketBest) commitSave((g) => ({ ...g, rocketBest: s.points }))
    host.concepts.mark('event')
    if (s.zapped.length >= Math.ceil(s.total * 0.8)) host.celebrate('Rocket ace!')
  }
  useEffect(() => {
    if (!st || finished || paused) return
    const iv = window.setInterval(() => step(), small ? 400 : 100)
    return () => window.clearInterval(iv)
  })  // eslint-disable-line react-hooks/exhaustive-deps

  const play = (chord: Chord) => {
    const s = ref.current; if (!s || finished || pausedRef.current) return
    const res = zap(s, chord, clock.current.t, itemById)
    if (res.event === 'miss') { setFb({ text: 'Not one of the falling words. Listen and try again!', good: false }); return }
    if (!res.id) return
    set(res.state)
    commit((p) => credit(p, res.id!, true, 2, Date.now(), 'memory'))
    setFb({ text: `Zap! ${itemById(res.id)?.en}`, good: true })
    if (rocketDone(res.state)) finish(res.state)
  }
  useChordInput(play, !!st && !finished && !paused)
  usePedalNext(() => { if (finished) begin() }, !!st && finished)
  const togglePause = () => { pausedRef.current = !pausedRef.current; clock.current.last = host.now(); setPaused(pausedRef.current) }
  const pickMode = (m: RocketMode) => { setMode(m); commitSave((g) => ({ ...g, rocketFast: m === 'fast' })) }

  if (!st) {
    return (
      <section className="kgl kgg" aria-label="Word Rocket">
        <div className="kgl-stage"><Mascot pose="wave" size={150} say="Words are falling! Play each word's chord to zap it." />
          <div className="kgl-prompt">
            <h2>🚀 Word Rocket</h2>
            <p className="kgl-sub">Words fall slowly in English. Play the Koogalien chord to zap each one. If one lands, it just bounces off the shield and comes back to practise later.</p>
            <div className="kgl-row" role="group" aria-label="Speed">
              <button type="button" className={'kgl-btn' + (mode === 'chill' ? ' on' : '')} aria-pressed={mode === 'chill'} onClick={() => pickMode('chill')}>🌙 Chill</button>
              <button type="button" className={'kgl-btn' + (mode === 'fast' ? ' on' : '')} aria-pressed={mode === 'fast'} onClick={() => pickMode('fast')}>⚡ Fast</button>
            </div>
            <p className="kgl-coach">Best score: {save.current.rocketBest}.</p>
            <div className="kgl-row"><button type="button" className="kgl-btn pri" onClick={() => begin()}>▶ Launch</button><button type="button" className="kgl-btn" onClick={onBack}>← Back to games</button></div>
          </div></div>
      </section>
    )
  }
  if (finished) {
    return (
      <section className="kgl kgg" aria-label="Word Rocket results">
        <Results title={st.landed.length === 0 ? 'Every word zapped!' : 'Round done'} pose={st.landed.length === 0 ? 'cheer' : 'teach'} onNext={() => begin()} nextLabel="Next round" onAgain={() => begin(ids.current)} onBack={onBack}>
          <p className="kgl-coach">{st.points} points · best streak {st.best} · level {st.peak} · {mode === 'fast' ? 'fast' : 'chill'} mode</p>
          <ul className="kgl-list">
            {st.zapped.map((id, i) => <li key={'z' + i}>✓ {itemById(id)?.emoji} {itemById(id)?.en}</li>)}
            {st.landed.map((id, i) => <li key={'l' + i}>– {itemById(id)?.emoji} {itemById(id)?.en} · again soon</li>)}
          </ul>
        </Results>
      </section>
    )
  }
  const low = lowest(st)
  return (
    <section className="kgl kgg" aria-label="Word Rocket">
      <div className="kgl-top">
        <h2 style={{ margin: 0 }}>🚀 Word Rocket</h2>
        <span className="kgl-rung">{mode === 'fast' ? '⚡ fast' : '🌙 chill'} · level {st.level}</span>
        <span className="kgl-rung" aria-label={`${st.zapped.length} zapped of ${st.total}`}>⭐ {st.zapped.length}/{st.total}</span>
      </div>
      <div className={'kgg-space' + (small ? ' still' : '')} role="group" aria-label="Falling words">
        {st.meteors.map((m) => {
          const e = itemById(m.id)!
          return <div key={m.uid} className={'kgg-meteor' + (low?.uid === m.uid ? ' low' : '')} data-id={m.id} style={{ top: `${Math.round(progressOf(m, vt) * 78)}%`, left: `${Math.round(m.x * 72)}%` }}><span aria-hidden>☄️</span> {e.emoji} <b>{e.en}</b></div>
        })}
        {paused ? <p className="kgg-paused">Paused. Take your time.</p> : null}
        <div className="kgg-shield" aria-hidden>🛡️ 🚀 🛡️</div>
      </div>
      <div className="kgl-stage" style={{ marginTop: 10 }}>
        <Mascot pose={fb?.good ? 'cheer' : 'listen'} size={110} />
        <div className="kgl-prompt">
          <GameInput lit={stage.lit} onChord={play} />
          <div className="kgl-row">
            <button type="button" className="kgl-btn" onClick={() => low && speakId(low.id)} disabled={!low}>🔊 Hear the lowest word</button>
            <button type="button" className="kgl-btn" onClick={() => { const e = low && itemById(low.id); if (e) stage.glow(e.chord as readonly Degree[], 1800) }} disabled={!low}>👀 Show the keys</button>
            <button type="button" className="kgl-btn" onClick={togglePause}>{paused ? '▶ Go on' : '⏸ Pause'}</button>
            <button type="button" className="kgl-btn" onClick={onBack}>← Back</button>
          </div>
          <p className={'kgl-fb ' + (fb ? (fb.good ? 'good' : 'bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>
        </div>
      </div>
    </section>
  )
}
