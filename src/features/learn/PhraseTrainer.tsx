import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Song } from '../songs/songs'
import { RUNGS, type Phrase, type PhraseEvent, type Rung } from '../../music/phrases'
import {
  attempt, demo, describeMiss, isKnown, ladderOf, mastery, nextPhrase, partsOf, onPhraseEvent, passesNeeded, practiceRung, stopAll, usePhraseTick,
} from '../../music/phraseEngine'
import { clearScore } from '../../music/scoreStore'
import { setSheetLevel, useSheetLevel } from '../../music/sheetLevel'
import { celebrate } from '../celebrate/celebrate'
import { SCALES, noteName } from '../../music/theory'
import { flags, linkNote, report } from '../../links/bus'
import './learn.css'

const RUNG_INFO: Record<Rung, { icon: string; label: string; ask: string }> = {
  listen: { icon: '👂', label: 'Listen', ask: 'Listen and watch the keys light up.' },
  follow: { icon: '☝️', label: 'Follow', ask: 'Play the glowing key, one finger.' },
  echo: { icon: '🔁', label: 'Echo', ask: 'Watch once, then play it back.' },
  memory: { icon: '🧠', label: 'Memory', ask: 'No glow now. Play it from memory!' },
  timed: { icon: '⏱️', label: 'In time', ask: 'From memory, with the beat.' },
  blind: { icon: '🙈', label: 'No sheet', ask: 'Sheet music is hidden. Just your ears and hands.' },
  hands: { icon: '🙌', label: 'Both hands', ask: 'Add the left hand: a low chord note.' },
}
const stepOf = (m: number) => { const w = SCALES.major; const o = Math.floor(m / 12); const pcv = m % 12; let i = 0; for (let k = 0; k < 7; k++) if (w[k] <= pcv) i = k; return o * 7 + i }
type NState = 'idle' | 'ok' | 'bad'

export function PhraseTrainer({ song, onClose, start }: { song: Song; onClose: () => void; start?: { phrase?: number; rung?: number } }) {
  usePhraseTick((s) => s.v)
  const level = useSheetLevel((s) => s.level)
  const nbpb = song.beatsPerBar
  const all = useMemo(() => ladderOf(song.id, song.notes, nbpb), [song, nbpb])
  const tiny = all.filter((p) => p.size === 1)
  const chains = all.filter((p) => p.size > 1)

  const [cur, setCur] = useState<{ phrase: Phrase; rung: Rung } | null>(null)
  const [pinned, setPinned] = useState(false)
  const [states, setStates] = useState<NState[]>([])
  const [msg, setMsg] = useState('')
  const [tone, setTone] = useState<'' | 'good' | 'kind'>('')
  const [chainMsg, setChainMsg] = useState('')
  const [phase, setPhase] = useState<'hear' | 'play' | 'between'>('hear')
  const [run, setRun] = useState(0) // bumps to (re)start a pass
  const alive = useRef(true)
  const pinRef = useRef(false); pinRef.current = pinned
  const curRef = useRef(cur); curRef.current = cur

  // Opened from a link: begin at its phrase / rung, but wait for the first key or tap before any sound
  const startRef = useRef(start)
  const [waiting, setWaiting] = useState(!!start && !flags.gallery)
  useEffect(() => {
    if (!waiting) return
    const go = () => setWaiting(false)
    window.addEventListener('keydown', go, { once: true }); window.addEventListener('pointerdown', go, { once: true })
    return () => { window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go) }
  }, [waiting])
  const pick = useCallback(() => {
    const s0 = startRef.current // kept (not cleared): React StrictMode runs this effect twice on mount
    const next = nextPhrase(song.id, song.notes, nbpb)
    if (s0 && (s0.phrase || s0.rung)) {
      const ph = s0.phrase ? all.filter((p) => p.size === 1)[s0.phrase - 1] : undefined
      const rg = s0.rung ? RUNGS[s0.rung - 1] : undefined
      if ((s0.phrase && !ph) || (s0.rung && !rg)) linkNote("That link mentions a part of the song Koog doesn't have")
      if (ph) setPinned(true)
      if (ph || rg) { setCur({ phrase: ph ?? next.phrase, rung: rg ?? (ph ? practiceRung(ph) : next.rung) }); return }
    }
    setCur(next)
  }, [song, nbpb, all])
  useEffect(() => {
    const n = cur ? tiny.findIndex((p) => p.id === cur.phrase.id) + 1 : 0
    report({ learn: cur ? { phrase: n > 0 ? n : undefined, rung: RUNGS.indexOf(cur.rung) + 1 } : null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.phrase.id, cur?.rung])
  useEffect(() => () => report({ learn: null }), [])
  useEffect(() => { alive.current = true; pick(); return () => { alive.current = false; stopAll(); clearScore('phrase') } }, [pick])
  useEffect(() => onPhraseEvent((e) => {
    if (e.type !== 'chain' || e.to.songId !== song.id) return
    const nums = e.from.map((p) => tiny.findIndex((q) => q.id === p.id) + 1)
    setChainMsg(e.to.size === 2 && nums.every((x) => x > 0)
      ? `You know phrases ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}! Now play them together.`
      : e.to.size === 4 ? 'You know every part! Now play the whole song.' : 'You know these parts! Now play them together.')
  }), [song.id, tiny])

  // one pass: (hear it,) then play
  useEffect(() => {
    if (!cur || waiting) return
    const { phrase, rung } = cur
    let dead = false
    setStates(phrase.notes.map(() => 'idle')); setTone(''); setMsg(RUNG_INFO[rung].ask)
    const go = async () => {
      if (rung === 'echo') { setPhase('hear'); await demo(phrase); if (dead) return }
      setPhase('play')
      const a = attempt(phrase, rung, {
        onEvent: (e: PhraseEvent) => {
          if (e.type === 'note' && !dead) setStates((s) => s.map((x, i) => (i === e.index ? (e.result.ok ? 'ok' : 'bad') : x)))
          if (e.type === 'climb' && !dead) onClimb(phrase, e.to)
        },
      })
      cancelRef.current = a.cancel
      const r = await a.done
      if (dead || r.cancelled) return
      setPhase('between')
      if (r.clean) { setTone('good'); setMsg(rung === 'listen' ? 'Nice listening!' : ['Yes!', 'Clean!', 'Perfect!', 'Nailed it!'][Math.floor(Math.random() * 4)]) }
      else { setTone('kind'); setMsg(describeMiss(r) ?? 'Almost! Go again.') }
      setTimeout(() => {
        if (dead || !alive.current) return
        if (pinRef.current) { const m = mastery(phrase.id); setCur({ phrase, rung: m.mastered != null ? m.rung : practiceRung(phrase) }); setRun((x) => x + 1) }
        else { setCur(nextPhrase(song.id, song.notes, nbpb)); setRun((x) => x + 1) }
      }, r.clean ? 900 : 1700)
    }
    void go()
    return () => { dead = true; cancelRef.current?.(); cancelRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, cur?.phrase.id, cur?.rung, waiting])
  const cancelRef = useRef<(() => void) | null>(null)

  const onClimb = (p: Phrase, to: Rung) => {
    const big = RUNGS.indexOf(to) >= RUNGS.indexOf('memory')
    setChainMsg('')
    if (big) celebrate({ title: `${RUNG_INFO[to].label}!`, emoji: RUNG_INFO[to].icon, kind: 'badge' })
    else setMsg(`Level up! ${RUNG_INFO[to].icon} ${RUNG_INFO[to].label}`)
    void p
  }
  const tap = (p: Phrase) => { setPinned(true); setChainMsg(''); setCur({ phrase: p, rung: practiceRung(p) }); setRun((x) => x + 1) }
  const hearIt = async () => {
    if (!cur) return
    cancelRef.current?.(); setPhase('hear'); await demo(cur.phrase)
    setRun((x) => x + 1)
  }

  if (!cur) return null
  const { phrase, rung } = cur
  const m = mastery(phrase.id)
  const need = passesNeeded(rung)
  const parts = partsOf(phrase, song.notes, nbpb)
  const hidden = rung === 'blind'
  const idxs = phrase.notes.map((n) => stepOf(n.note))
  const lo = Math.min(...idxs), hi = Math.max(...idxs)
  const known = tiny.filter((p) => isKnown(mastery(p.id))).length

  return (
    <div className="pt">
      <div className="pt-top">
        <button className="btn-ghost" onClick={onClose}>← Back to {song.title}</button>
        <b className="pt-title">🧠 Learn it <span>{song.title}</span></b>
        <span className="pt-prog" title="phrases you know">{known}/{tiny.length} phrases</span>
      </div>

      {waiting && <div className="pt-chain" role="status">Press any key or tap to begin.</div>}
      {chainMsg && <div className="pt-chain" role="status">{chainMsg}</div>}

      <div className={'pt-card ' + tone}>
        <div className="pt-what">
          {phrase.size > 1 ? `Chain of ${parts.length || 2}: play them together` : `Phrase ${tiny.findIndex((p) => p.id === phrase.id) + 1} of ${tiny.length}`}
          {phase === 'hear' && ' · listen…'}
        </div>
        <div className="pt-notes" aria-label="Phrase notes">
          {phrase.notes.map((n, i) => {
            const y = hi === lo ? 0.5 : (hi - idxs[i]) / (hi - lo)
            return (
              <div key={i} className={'pt-n ' + (hidden ? 'hid' : states[i] ?? 'idle')} style={{ ['--y' as string]: y }}>
                <span className="head">{hidden ? '?' : noteName(n.note).replace(/\d/, '')}</span>
              </div>
            )
          })}
        </div>
        <div className={'pt-msg ' + tone} aria-live="polite">{msg}</div>
        <div className="pt-pass" aria-label="clean passes">
          clean passes {Math.min(m.streak, need)}/{need}
          {[...Array(need)].map((_, i) => <i key={i} className={i < m.streak ? 'on' : ''} />)}
        </div>
      </div>

      <div className="pt-ladder" role="list">
        {RUNGS.map((r, i) => (
          <div key={r} role="listitem" className={'rg' + (r === rung ? ' cur' : '') + (i < RUNGS.indexOf(m.rung) || m.mastered != null ? ' done' : '')}>
            <span>{RUNG_INFO[r].icon}</span><em>{RUNG_INFO[r].label}</em>
          </div>
        ))}
      </div>

      <div className="pt-btns">
        <button className="btn" onClick={() => void hearIt()}>🔊 Hear it</button>
        <button className="btn-ghost" onClick={() => setRun((x) => x + 1)}>↻ Try again</button>
        {pinned && <button className="btn-ghost" onClick={() => { setPinned(false); pick(); setRun((x) => x + 1) }}>➡ Suggest next</button>}
        {rung === 'hands' && level === 'single' && <button className="btn-ghost" onClick={() => setSheetLevel('easy')}>🎶 Show chords</button>}
      </div>

      <div className="pt-map" aria-label="Song map">
        <div className="pt-maprow">
          {tiny.map((p, i) => <Tile key={p.id} p={p} n={i + 1} on={p.id === phrase.id} onTap={tap} />)}
          {chains.length > 0 && <span className="pt-sep" />}
          {chains.map((p) => <Tile key={p.id} p={p} n={0} on={p.id === phrase.id} onTap={tap} locked={!tiny.filter((q) => q.start >= p.start && q.end <= p.end).every((q) => isKnown(mastery(q.id)))} />)}
        </div>
      </div>
    </div>
  )
}

function Tile({ p, n, on, onTap, locked }: { p: Phrase; n: number; on: boolean; onTap: (p: Phrase) => void; locked?: boolean }) {
  const m = mastery(p.id)
  const ri = RUNGS.indexOf(m.rung)
  return (
    <button className={'pt-tile r' + ri + (on ? ' on' : '') + (locked ? ' lock' : '') + (m.mastered != null ? ' star' : '')}
      title={`${p.size > 1 ? 'Chain' : 'Phrase ' + n}: ${RUNG_INFO[m.rung].label}`} aria-label={`${p.size > 1 ? 'Chain' : 'Phrase ' + n}, ${RUNG_INFO[m.rung].label}`}
      onClick={() => onTap(p)}>
      {p.size > 1 ? '🔗' : n}
    </button>
  )
}
