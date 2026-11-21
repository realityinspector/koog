// Alien Says (units 1 to 3, listening): a Koogalien says a word. Pick its meaning from 3 emoji cards, then play the word back.
// A clean streak charges a little UFO across the sky. Missed words go back into spaced repetition as due.
import { useEffect, useRef, useState } from 'react'
import type { Chord } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { nearest, pickRound } from '../../../koogalien/learn/checks'
import { itemById } from '../../../koogalien/learn/items'
import { currentUnit } from '../../../koogalien/learn/ladder'
import { Mascot } from '../learn/Mascot'
import { useChordInput } from '../learn/useChordInput'
import { credit, helpFor } from './core'
import { exposeForTest, useGamesSave, usePedalNext, useProgress, useStage } from './hooks'
import { GameInput, Results, UfoTrack, VoiceBadge, stars } from './Shared'
import { UFO_GOAL, dismiss, newSays, pickChoice, playChord, saysDone, saysItem, saysPerfect, ufoProgress, SAYS_ROUND, type SaysState } from './says'

const VOICE = 'pip'

export default function AlienSays({ host, onBack }: { host: KoogalienHost; onBack: () => void }) {
  const { prog, commit } = useProgress(host)
  const { save, commit: commitSave } = useGamesSave(host)
  const stage = useStage(host)
  const [st, setSt] = useState<SaysState | null>(null)
  const ref = useRef<SaysState | null>(null)
  const ids = useRef<string[]>([])
  const seed = useRef(1)
  const charged = useRef(false)
  const [fb, setFb] = useState<{ text: string; good: boolean } | null>(null)
  const set = (s: SaysState | null) => { ref.current = s; setSt(s) }
  exposeForTest('says', () => ({ state: ref.current, fb, progress: prog.current }))

  const speak = (id: string) => { const e = itemById(id); if (e) stage.say([e.chord], VOICE) }
  /** the help ladder: glow on early tries, a fading glow later, none once it is learned. A hear-again is always free. */
  const help = (id: string, misses: number) => {
    const e = itemById(id); if (!e) return
    const h = helpFor(prog.current.words[id], misses)
    stage.unglow()
    if (h === 'glow') stage.glow(e.chord as never)
    else if (h === 'fade') stage.glow(e.chord as never, 1500)
  }
  const enter = (s: SaysState) => {
    const it = saysItem(s); if (!it) return
    stage.clearTimers(); stage.unglow(); setFb(null)
    stage.later(() => speak(it.id), 250)
  }
  const begin = (list?: string[]) => {
    const unit = Math.min(3, currentUnit(prog.current.words))
    const entries = list ? list.map((i) => itemById(i)!).filter(Boolean) : pickRound(unit, prog.current.cards, Date.now(), SAYS_ROUND, (seed.current += 1) + Math.floor(host.now() / 1000))
    ids.current = entries.map((e) => e.id)
    charged.current = false
    const s = newSays(entries, seed.current + 5)
    set(s); enter(s)
  }
  useEffect(() => { commitSave((g) => ({ ...g, last: 'says' })) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  /** an item just finished (or was given up on): put it in the shared progress, mark the concept */
  const settle = (before: SaysState, after: SaysState) => {
    const r = after.results[after.results.length - 1]
    if (!r) return
    commit((p) => credit(p, r.id, r.passed, r.stars, Date.now(), 'echo'))
    host.concepts.mark('event')
    if (after.streak >= UFO_GOAL && !charged.current) { charged.current = true; host.celebrate('UFO charged!') }
    if (after.best > save.current.bestStreak) commitSave((g) => ({ ...g, bestStreak: after.best }))
    void before
  }
  const afterEvent = (before: SaysState, res: { state: SaysState; event: string }) => {
    set(res.state)
    if (res.event === 'next' || res.event === 'round-done') {
      settle(before, res.state)
      stage.unglow()
      if (res.event === 'round-done') { if (saysPerfect(res.state)) host.celebrate('Perfect round!'); setFb(null); return }
      setFb({ text: 'Yes! Next word.', good: true })
      stage.later(() => enter(res.state), 900)
    }
  }
  const pick = (id: string) => {
    const s = ref.current; if (!s) return
    const res = pickChoice(s, id)
    set(res.state)
    const it = saysItem(res.state)
    if (res.event === 'pick-right' && it) { setFb({ text: 'That is it! Now play it back.', good: true }); help(it.id, 0); stage.later(() => speak(it.id), 200) }
    else if (res.event === 'pick-wrong') {
      const w = itemById(id), cur = saysItem(s)
      setFb({ text: `That one is "${w?.en ?? ''}". Listen again.`, good: false })
      if (cur) stage.later(() => speak(cur.id), 400)
    }
  }
  const play = (chord: Chord) => {
    const s = ref.current; if (!s || saysDone(s)) return
    const it = saysItem(s); if (!it || it.stage !== 'play') return
    const res = playChord(s, chord)
    if (res.event === 'none') return
    if (res.event === 'wrong' || res.event === 'gave-up') {
      const near = nearest(chord, 1)[0]
      const want = itemById(it.id)
      set(res.state)
      if (res.event === 'gave-up') { setFb({ text: `It is "${want?.en}". Watch the keys, then press Next.`, good: false }); stage.glow(want!.chord as never); speak(it.id); return }
      setFb({ text: near && near.confidence >= 0.5 ? `That one says "${near.entry.en}". Listen and try again.` : 'Not that one yet. Listen and try again.', good: false })
      help(it.id, it.playMiss + 1)
      stage.later(() => speak(it.id), 500)
      return
    }
    afterEvent(s, res)
  }
  const next = () => {
    const s = ref.current; if (!s) return
    const it = saysItem(s)
    if (it?.revealed) { const res = dismiss(s); afterEvent(s, res); if (res.event === 'next') { setFb(null); stage.later(() => enter(res.state), 200) } }
  }
  usePedalNext(next, !!st && !saysDone(st))
  useChordInput(play, !!st && !saysDone(st))

  if (!st) {
    return (
      <section className="kgl kgg" aria-label="Alien Says">
        <div className="kgl-stage"><Mascot pose="wave" size={150} say="A Koogalien will say a word. Pick what it means, then play it back!" />
          <div className="kgl-prompt">
            <h2>🛸 Alien Says</h2>
            <p className="kgl-sub">Listen to the word, tap its picture, then play the chord. Five clean words in a row charge the UFO. Words you miss come back soon.</p>
            <p className="kgl-coach">Best streak: {save.current.bestStreak}. {prog.current.stars} stars so far.</p>
            <div className="kgl-row"><button type="button" className="kgl-btn pri" onClick={() => begin()}>▶ Start</button><button type="button" className="kgl-btn" onClick={onBack}>← Back to games</button></div>
          </div></div>
      </section>
    )
  }
  if (saysDone(st)) {
    const total = st.results.reduce((n, r) => n + r.stars, 0)
    return (
      <section className="kgl kgg" aria-label="Alien Says results">
        <Results title={saysPerfect(st) ? 'Perfect! The UFO made it!' : 'Round done'} pose={saysPerfect(st) ? 'cheer' : 'teach'} onNext={() => begin()} nextLabel="Next round" onAgain={() => begin(ids.current)} onBack={onBack}>
          <UfoTrack progress={ufoProgress(st.best)} label={`Best streak ${st.best} of ${UFO_GOAL}`} />
          <div className="kgl-stars" aria-label={`${total} stars`}>{'★'.repeat(Math.min(total, 15))}</div>
          <ul className="kgl-list">{st.results.map((r, i) => <li key={i}>{r.passed ? '✓' : '–'} {itemById(r.id)?.emoji} {itemById(r.id)?.en} {r.passed ? stars(r.stars) : 'again soon'}</li>)}</ul>
        </Results>
      </section>
    )
  }
  const it = saysItem(st)!
  const want = itemById(it.id)!
  return (
    <section className="kgl kgg" aria-label="Alien Says">
      <div className="kgl-top">
        <h2 style={{ margin: 0 }}>🛸 Alien Says</h2><VoiceBadge voice={VOICE} />
        <div className="kgl-dots" role="img" aria-label={`Word ${st.i + 1} of ${st.items.length}`}>
          {st.items.map((x, i) => { const r = st.results[i]; return <span key={i} className={'kgl-dot ' + (r ? (r.passed ? 'ok' : 'no') : i === st.i ? 'now' : '')} aria-hidden>{r ? (r.passed ? '✓' : '·') : ''}</span> })}
        </div>
      </div>
      <UfoTrack progress={ufoProgress(st.streak)} label={`Streak ${st.streak} of ${UFO_GOAL}`} />
      <div className="kgl-stage">
        <Mascot pose={it.revealed ? 'puzzled' : fb?.good ? 'cheer' : 'listen'} size={140} />
        <div className="kgl-prompt">
          {it.stage === 'pick'
            ? <>
              <p className="kgl-coach">Listen. What did the alien say?</p>
              <div className="kgg-cards" role="group" aria-label="Pick the meaning">
                {it.choices.map((c) => { const e = itemById(c)!; return <button key={c} type="button" className="kgg-card" onClick={() => pick(c)}><span className="e" aria-hidden>{e.emoji}</span><span>{e.en}</span></button> })}
              </div>
            </>
            : <>
              <div className="kgl-word"><span className="e" aria-hidden>{want.emoji}</span><span>{want.en}</span></div>
              <p className="kgl-coach">{it.revealed ? 'No worries. Watch where the keys are.' : 'Now play it back!'}</p>
              <GameInput lit={stage.lit} onChord={play} />
            </>}
          <div className="kgl-row">
            <button type="button" className="kgl-btn" onClick={() => speak(it.id)}>🔊 Hear it again</button>
            {it.stage === 'play' && !it.revealed ? <button type="button" className="kgl-btn" onClick={() => stage.glow(want.chord as never, 1800)}>👀 Show the keys</button> : null}
            {it.revealed ? <button type="button" className="kgl-btn pri" onClick={next}>Next</button> : null}
            <button type="button" className="kgl-btn" onClick={onBack}>← Back</button>
          </div>
          <p className={'kgl-fb ' + (fb ? (fb.good ? 'good' : 'bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>
        </div>
      </div>
    </section>
  )
}
