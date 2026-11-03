import { useEffect, useState, useSyncExternalStore } from 'react'
import './mimic.css'
import { STYLES, NOTICE, styleById, type StyleDef } from '../../music/styles'
import { seenCount, markSeen } from '../../coach/coachBus'
import { finishTrial, getState, getVersion, playQuote, demo, setBacking, setFilter, setOn, setStyle, setVolume, startTrial, subscribe, toggle, type Shown } from './engine'
import { useOnePop } from '../../ui/onePop'

const hue = (i: number) => (i * 23 + 200) % 360

function Icon({ st, size = 30 }: { st: StyleDef; size?: number }) {
  const i = STYLES.indexOf(st)
  return (
    <svg className="mm-ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={`hsl(${hue(i)} 90% 72%)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={st.icon} />
    </svg>
  )
}

/** a tiny piano-roll of the answer: pitch up, time right; the notes already played light up */
function Ribbon({ a }: { a: Shown }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    let raf = 0, last = 0
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const step = (ts: number) => {
      if (ts - last > (reduce ? 120 : 33)) { last = ts; setNow(performance.now()) }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [a])
  const sec = 60 / a.bpm
  const dur = Math.max(1, a.beats)
  const elapsed = (now - a.startMs) / 1000 / sec
  const all = a.events.filter((e) => e.kind !== 'bass' && e.kind !== 'chord')
  const lo = Math.min(...all.map((e) => e.note), ...a.call) - 1, hi = Math.max(...all.map((e) => e.note), ...a.call) + 1
  const y = (n: number) => 4 + (1 - (n - lo) / Math.max(1, hi - lo)) * 36
  const W = 236, cw = a.call.length ? 56 : 0
  const x = (t: number) => cw + 6 + (t / dur) * (W - cw - 10)
  return (
    <svg className="mm-ribbon" viewBox={`0 0 ${W} 44`} role="img" aria-label="The answer as a note picture">
      {a.call.map((n, i) => <circle key={i} cx={8 + (i / Math.max(1, a.call.length - 1)) * (cw - 18)} cy={y(n)} r="3" className="mm-dot you" />)}
      {a.call.length > 0 && <text x="2" y="43" className="mm-rt">you</text>}
      {all.map((e, i) => {
        const played = elapsed >= e.t, now2 = elapsed >= e.t && elapsed < e.t + e.dur
        return <rect key={i} x={x(e.t)} y={y(e.note) - 2.5} width={Math.max(2.5, (e.dur / dur) * (W - cw - 10))} height="5" rx="2.5"
          className={'mm-bar' + (played ? ' on' : '') + (now2 ? ' now' : '') + (e.kind === 'quote' ? ' q' : '')} />
      })}
      <text x={cw + 6} y="43" className="mm-rt">Koog</text>
    </svg>
  )
}

function Card({ st }: { st: StyleDef }) {
  useSyncExternalStore(subscribe, getVersion)
  const S = getState()
  const t = S.trial
  const first = seenCount('mimic:card:' + st.id) === 0
  useEffect(() => { markSeen('mimic:card:' + st.id) }, [st.id])
  const res = t.result
  return (
    <div className="mm-card">
      <div className="mm-card-h"><Icon st={st} size={34} /><div><b>{st.name}</b><span>{st.era} · {st.kind === 'pd' ? 'classic (public domain)' : 'style traits only'}</span></div></div>
      <p className="mm-blurb">{st.blurb}</p>
      <ol className="mm-traits">
        {st.traits.map((tr, i) => {
          const r = res?.find((x) => x.id === tr.id)
          return <li key={tr.id} className={r ? (r.ok ? 'ok' : 'no') : ''} title={tr.hint}><i aria-hidden>{r ? (r.ok ? '✓' : '·') : i + 1}</i><span><b>{tr.label}</b>{((first && !r) || (r && !r.ok)) && <em>{tr.hint}</em>}</span></li>
        })}
      </ol>
      <div className="mm-try">
        {!t.active
          ? <button className="mm-btn pri" onClick={startTrial}>🎯 Try it</button>
          : <button className="mm-btn pri live" onClick={finishTrial}>⏹ Done ({t.notes.length} notes)</button>}
        {t.active && <span className="mm-small">Play in this style, then press Done.</span>}
        {!t.active && res && <span className="mm-small">{res.filter((x) => x.ok).length} of 3 traits found</span>}
      </div>
    </div>
  )
}

/** 🎭 Mimic: small chip (top-right of the display) opening the style picker. Easy to move into the Modes launcher later. */
export function MimicChip({ launcher = false }: { launcher?: boolean } = {}) {
  useSyncExternalStore(subscribe, getVersion)
  const S = getState()
  const [open, setOpen] = useState(false)
  useOnePop('mimic', open, () => setOpen(false))
  const [credit, setCredit] = useState('')
  const st = styleById(S.styleId)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  const status = !S.on ? 'off' : S.answer ? 'answering' : S.listening ? 'listening' : 'ready'
  // with the Modes launcher the entry lives there; this chip is only the answering status (and style picker) while Mimic is on
  if (launcher && !S.on) return null
  return (
    <div className="mm-wrap" data-mimic-chip>
      <button className={'mm-chip' + (S.on ? ' on' : '')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        title="Mimic: Koog plays and teaches in famous styles">
        <span className="mm-chip-ic" aria-hidden>🎭</span>
        <span className="mm-chip-t"><b>MIMIC</b><i>{S.on ? st.emoji + ' ' + status : 'styles'}</i></span>
        <i className={'mm-led' + (S.on ? ' on' : '') + (status === 'listening' ? ' live' : '')} aria-hidden />
      </button>
      {open && (
        <div className="mm-pop" role="dialog" aria-label="Mimic styles">
          <div className="mm-head">
            <button className={'mm-btn sw' + (S.on ? ' on' : '')} aria-pressed={S.on} onClick={() => void toggle()}>🎭 Answer me: {S.on ? 'ON' : 'OFF'}</button>
            <div className="mm-acts">
            <button className="mm-btn" onClick={() => void demo()} title="Hear a sample answer in this style">▶ Hear it</button>
            <button className={'mm-btn' + (S.filter ? ' on' : '')} aria-pressed={S.filter} onClick={() => void setFilter(!S.filter)} title="Add this style around your own notes (your notes are never delayed)">✨ Restyle me</button>
            <button className={'mm-btn' + (S.backing ? ' on' : '')} aria-pressed={S.backing} onClick={() => void setBacking(!S.backing)} title="A bass and chord backing in this style">🥁 Backing</button>
            {st.kind === 'pd' && st.quotes && st.quotes.length > 0 && <button className="mm-btn" onClick={() => void playQuote().then((c) => setCredit(c ?? ''))} title="A real phrase from a public-domain piece">🎼 A real phrase</button>}</div>
            <button className="mm-btn" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="mm-body">
            <div className="mm-tiles" role="listbox" aria-label="Pick a style">
              {STYLES.map((s) => (
                <button key={s.id} role="option" aria-selected={s.id === S.styleId} className={'mm-tile' + (s.id === S.styleId ? ' on' : '')} onClick={() => setStyle(s.id)} title={s.name}>
                  <Icon st={s} size={24} /><span>{s.name.replace(/ \(.*\)/, '')}</span>
                </button>
              ))}
            </div>
            <div className="mm-side">
              <Card st={st} key={st.id} />
              {S.answer ? <Ribbon a={S.answer} /> : <div className="mm-ribbon mm-empty">{S.on ? 'Play 2 or more notes, then pause: Koog answers.' : 'Switch “Answer me” on, then play a short phrase.'}</div>}
              {credit && S.answer?.credit && <div className="mm-small">🎼 {S.answer.credit}</div>}
              <label className="mm-vol"><span>Volume</span><input type="range" min={0} max={100} value={Math.round(S.volume * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label="Mimic volume" /></label>
            </div>
          </div>
          <p className="mm-notice">{NOTICE}</p>
        </div>
      )}
    </div>
  )
}
