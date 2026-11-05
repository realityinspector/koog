// The Echo Game: the Koog Alien and a Koogalien voice say a word (or a short sentence), and you play it back.
// Each word climbs the ladder (Hunt & Peck, Follow, Echo, Memory); spaced repetition picks which words come back.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KoogalienHost } from '../../../koogalien/ports'
import type { Chord, Degree, LexEntry } from '../../../koogalien/data/types'
import { alienById } from '../../../koogalien/data/aliens'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import { nearest, pickRound } from '../../../koogalien/learn/checks'
import { current, dismissReveal, isDone, newRound, onPeek, onPlayed, perfect, roundStars, target, type RoundState } from '../../../koogalien/learn/echoRound'
import { itemById, unitTitle } from '../../../koogalien/learn/items'
import { currentUnit } from '../../../koogalien/learn/ladder'
import { PROGRESS_KEY, recordWord, sanitize, type Progress } from '../../../koogalien/learn/progress'
import { VOICES_BY_UNIT } from '../../../koogalien/learn/speak'
import { VOICE_LOOK } from '../brand'
import { MiniPads } from './MiniPads'
import { Mascot } from './Mascot'
import { rungInfo } from './rungInfo'
import { sayChords } from './say'
import { useChordInput } from './useChordInput'
import './learn.css'

const ROUND = 5
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n))

export default function EchoGame({ host }: { host: KoogalienHost }) {
  const progRef = useRef<Progress>(sanitize(host.progress.load(PROGRESS_KEY, null)))
  const [unit, setUnit] = useState(() => currentUnit(progRef.current.words))
  const [round, setRound] = useState<RoundState | null>(null)
  const [voice, setVoice] = useState('pip')
  const [fb, setFb] = useState<{ text: string; good: boolean } | null>(null)
  const [lit, setLit] = useState<readonly Degree[]>([])
  const [picked, setPicked] = useState<Degree[]>([])
  const roundRef = useRef<RoundState | null>(null)
  const seedRef = useRef(1)
  const speaking = useRef<{ stop(): void } | null>(null)
  const timers = useRef<number[]>([])
  const celebrated = useRef(false)

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
  useEffect(() => () => { clearTimers(); speaking.current?.stop(); host.guide.clear() }, [host])

  const save = (p: Progress) => { progRef.current = p; host.progress.save(PROGRESS_KEY, p) }
  const set = (r: RoundState | null) => { roundRef.current = r; setRound(r) }

  /** show the right hint for the step: Hunt keeps the keys lit, Follow lights then fades, Echo just says it */
  const beginStep = useCallback((r: RoundState, v: string) => {
    clearTimers(); host.guide.clear(); setLit([]); setPicked([]); setFb(null)
    const st = current(r), want = target(r)
    if (!st || !want) return
    const chordsAll: Chord[] = st.want.map((id) => itemById(id)!.chord)
    const light = (c: Chord) => { setLit(c as readonly Degree[]); host.guide.show(c.map((d) => midiOfDegree(d as Degree, 60))) }
    if (st.rung === 'hunt') { light(want.chord); later(() => { speaking.current?.stop(); speaking.current = sayChords(host, [want.chord], v) }, 150) }
    else if (st.rung === 'follow') { light(want.chord); later(() => { setLit([]); host.guide.clear() }, 1400); later(() => { speaking.current = sayChords(host, [want.chord], v) }, 150) }
    else if (st.rung === 'echo') { later(() => { speaking.current?.stop(); speaking.current = sayChords(host, st.want.length > 1 ? chordsAll : [want.chord], v) }, 200) }
  }, [host])

  const start = (u: number) => {
    const seed = (seedRef.current += 1) + Math.floor(host.now() / 1000)
    const entries: LexEntry[] = pickRound(u, progRef.current.cards, Date.now(), ROUND, seed)
    const v = VOICES_BY_UNIT(u)
    setUnit(u); setVoice(v); celebrated.current = false
    const r = newRound(entries, progRef.current.words)
    set(r); beginStep(r, v)
  }

  const apply = (res: { state: RoundState; event: string }, wantId: string | null) => {
    const prev = roundRef.current!
    set(res.state)
    const last = res.state.results[res.state.results.length - 1]
    if (res.event === 'right') { host.concepts.mark('event'); setFb({ text: 'Yes! Now the next word.', good: true }); host.guide.clear(); return }
    if (res.event === 'wrong') {
      const w = res.state.lastWrong ? itemById(res.state.lastWrong) : null
      setFb({ text: w ? `That one says "${w.en}". Listen and try again.` : 'Not that one yet. Listen and try again.', good: false })
      if (prev.steps[prev.i]?.rung !== 'hunt') later(() => { const t = target(res.state); if (t) speaking.current = sayChords(host, [t.chord], voice) }, 500)
      return
    }
    if (res.event === 'gave-up') {
      const t = target(res.state)
      setFb({ text: t ? `It is "${t.en}". Watch the keys, then press Next.` : 'Let me show you.', good: false })
      if (t) { setLit(t.chord as readonly Degree[]); host.guide.show(t.chord.map((d) => midiOfDegree(d as Degree, 60))); speaking.current = sayChords(host, [t.chord], voice) }
      return
    }
    if (res.event === 'word-done' || res.event === 'round-done') {
      host.concepts.mark('event')
      if (last) {
        let p = progRef.current
        if (last.sentence) p = { ...p, sentences: p.sentences + 1 }
        else p = recordWord(p, last.id, last.passed, last.stars, Date.now())
        save(p)
      }
      host.guide.clear(); setLit([])
      if (res.event === 'round-done') {
        if (perfect(res.state) && !celebrated.current) { celebrated.current = true; host.celebrate('perfect') }
        setFb(null)
      } else {
        setFb({ text: wantId ? `${stars(last?.stars ?? 0)} You said "${itemById(wantId)?.en ?? ''}"!` : 'Yes!', good: true })
        later(() => beginStep(res.state, voice), 900)
      }
    }
  }

  const play = (chord: Chord) => {
    const r = roundRef.current
    if (!r || isDone(r) || r.revealed) return
    const want = target(r)
    const near = nearest(chord, 1)[0]
    apply(onPlayed(r, chord, near && near.confidence >= 0.5 ? near.entry.id : null), want?.id ?? null)
  }
  const { feed } = useChordInput(play, !!round && !isDone(round))
  void feed
  const togglePad = (d: Degree) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)))
  const commit = () => { if (picked.length) { play(picked as unknown as Chord); setPicked([]) } }
  const hearAgain = () => { const r = roundRef.current, st = r && current(r); if (!r || !st) return; speaking.current?.stop(); speaking.current = sayChords(host, st.want.map((id) => itemById(id)!.chord), voice) }
  const peek = () => {
    const r = roundRef.current, t = r && target(r); if (!r || !t) return
    set(onPeek(r)); setLit(t.chord as readonly Degree[]); host.guide.show(t.chord.map((d) => midiOfDegree(d as Degree, 60)))
    later(() => { setLit([]); host.guide.clear() }, 1800)
  }
  const next = () => { const r = roundRef.current!; const res = dismissReveal(r); set(res.state); host.guide.clear(); setLit([]); if (res.event === 'word-done') { save(recordWord(progRef.current, current(r)!.id, false, 0, Date.now())); setFb(null); beginStep(res.state, voice) } else if (res.event === 'round-done') { save(recordWord(progRef.current, current(r)!.id, false, 0, Date.now())); setFb(null) } }

  const look = VOICE_LOOK[voice]
  const st = round ? current(round) : null
  const want = round ? target(round) : null
  const info = st ? rungInfo(st.rung) : null
  const units = useMemo(() => [1, 2, 3], [])

  if (!round) {
    return (
      <section className="kgl" aria-label="Echo Game">
        <h2>Echo Game</h2>
        <p className="kgl-sub">I say a word in Koogalien. You play it back. The words you find hard come back sooner.</p>
        <div className="kgl-stage" style={{ marginTop: 14 }}>
          <Mascot pose="wave" size={150} say="Ready to echo? Listen, then play the chord you hear." />
          <div className="kgl-prompt">
            <p className="kgl-coach">Unit {unit}: {unitTitle(unit)}. {progRef.current.stars} stars so far.</p>
            <div className="kgl-row" role="group" aria-label="Choose a unit">{units.map((u) => <button key={u} type="button" className={'kgl-btn' + (u === unit ? ' on' : '')} onClick={() => setUnit(u)}>Unit {u}</button>)}</div>
            <button type="button" className="kgl-btn pri" onClick={() => start(unit)}>▶ Start a round</button>
          </div>
        </div>
      </section>
    )
  }

  if (isDone(round)) {
    const s = roundStars(round)
    return (
      <section className="kgl" aria-label="Echo Game result">
        <div className="kgl-stage"><Mascot pose={perfect(round) ? 'cheer' : 'teach'} size={150} /><div className="kgl-result">
          <h2>{perfect(round) ? 'Perfect round!' : 'Round done'}</h2>
          <div className="kgl-stars" aria-label={`${s} stars`}>{'★'.repeat(Math.min(s, 15))}</div>
          <ul className="kgl-list">{round.results.map((r, i) => <li key={i}>{r.passed ? '✓' : '–'} {r.id.split('+').map((id) => itemById(id)?.en ?? id).join(' ')} {r.passed ? stars(r.stars) : 'again soon'}</li>)}</ul>
          <div className="kgl-row"><button type="button" className="kgl-btn pri" onClick={() => start(currentUnit(progRef.current.words))}>▶ Another round</button><button type="button" className="kgl-btn" onClick={() => set(null)}>Done</button></div>
        </div></div>
      </section>
    )
  }

  return (
    <section className="kgl" aria-label="Echo Game">
      <div className="kgl-top">
        <h2 style={{ margin: 0 }}>Echo Game</h2>
        <span className="kgl-voice" style={{ borderColor: look?.color }} title={`${alienById(voice)?.name ?? voice} is speaking`}><span style={{ background: look?.color }} aria-hidden>{look?.mark}</span>{alienById(voice)?.name ?? voice}</span>
        <div className="kgl-dots" role="img" aria-label={`Word ${round.i + 1} of ${round.steps.length}`}>
          {round.steps.map((s, i) => { const r = round.results[i]; return <span key={s.id} className={'kgl-dot ' + (r ? (r.passed ? 'ok' : 'no') : i === round.i ? 'now' : '')} aria-hidden>{r ? (r.passed ? '✓' : '·') : ''}</span> })}
        </div>
      </div>
      <div className="kgl-stage">
        <Mascot pose={round.revealed ? 'puzzled' : fb?.good ? 'cheer' : st?.rung === 'echo' ? 'listen' : 'teach'} size={150} />
        <div className="kgl-prompt">
          <span className="kgl-rung">{info?.icon} {info?.name}{st?.sentence ? ' · short sentence' : ''}</span>
          {st?.rung === 'echo' && !round.revealed && !fb?.good
            ? <div className="kgl-word"><span className="e" aria-hidden>🔊</span><span>Listen, then play it back</span></div>
            : <div className="kgl-word"><span className="e" aria-hidden>{want?.emoji}</span><span>{st?.sentence ? st.want.map((id) => itemById(id)?.en).join(' ') : want?.en}</span></div>}
          <p className="kgl-coach">{round.revealed ? 'No worries. Watch where the keys are.' : st?.rung === 'memory' ? 'Play it from memory. A peek costs a star.' : info?.coach}</p>
          <MiniPads big lit={lit} picked={picked} onToggle={togglePad} label="Tap pads to build a chord, or play your keys, pads or controller" />
          <div className="kgl-row">
            <button type="button" className="kgl-btn pri" onClick={commit} disabled={!picked.length}>Play it</button>
            {round.revealed ? <button type="button" className="kgl-btn pri" onClick={next}>Next</button> : null}
            <button type="button" className="kgl-btn" onClick={hearAgain}>🔊 Hear again</button>
            {st && (st.rung === 'memory' || st.rung === 'echo') && !round.revealed ? <button type="button" className="kgl-btn" onClick={peek}>👀 Peek (-1 star)</button> : null}
          </div>
          <p className={'kgl-fb ' + (fb ? (fb.good ? 'good' : 'bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>
        </div>
      </div>
    </section>
  )
}
