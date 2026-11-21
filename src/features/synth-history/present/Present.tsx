// 🎬 Present: walk through the history of synthesizers one slide at a time, then take a quiz.
// Kid view shows ONE simple line per slide. The 🔬 Technical toggle (key T) adds the chips, processors and numbers.
// Keys while this tab is open: ← → (or Space) change slide, T toggles technical, Esc leaves. They are taken before the typing piano hears them.
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePro } from '../../../profile/profile'
import { DECKS, parseDeck, type Deck } from './decks'
import { PICS, picUrl, type PicId } from './pics'
import { QuizRunner } from './QuizRunner'
import './present.css'

const SIZES = [0.85, 1, 1.25, 1.5, 1.8, 2.2]
const SIZE_KEY = 'koog.present.size'
const loadSize = () => { try { const v = Number(localStorage.getItem(SIZE_KEY)); const k = SIZES.indexOf(v); return k >= 0 ? k : 1 } catch { return 1 } }

function Photo({ id, small }: { id: PicId; small?: boolean }) {
  const p = PICS[id]
  return (
    <figure className={'pr-fig' + (small ? ' small' : '')}>
      <img src={picUrl(id)} alt={p.alt} loading="lazy" />
      <figcaption>Photo: {p.by} · <a href={p.page} target="_blank" rel="noreferrer noopener">{p.license}</a></figcaption>
    </figure>
  )
}

export function Present() {
  const pro = usePro()
  const [decks, setDecks] = useState<Deck[]>(DECKS)
  const [deckId, setDeckId] = useState<string | null>(null)
  const [i, setI] = useState(0)
  const [tech, setTech] = useState(pro) // grown-up mode starts with the detail on; kids start simple
  const [quiz, setQuiz] = useState(false)
  const [note, setNote] = useState('')
  const [sz, setSz] = useState(loadSize) // text size for presentation mode only, remembered
  const bump = useCallback((d: number) => setSz((k) => { const n = Math.max(0, Math.min(SIZES.length - 1, k + d)); try { localStorage.setItem(SIZE_KEY, String(SIZES[n])) } catch { /* ignore */ } return n }), [])
  const file = useRef<HTMLInputElement>(null)
  const deck = decks.find((d) => d.id === deckId) ?? null
  const n = deck?.slides.length ?? 0

  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return
      const k = e.key
      const mine = k === '+' || k === '=' || k === '-' || k === '_' || k === 'Escape' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 't' || k === 'T' || (deck && k === ' ' && !quiz)
      if (!mine) return
      if (!deck && !'tT+=-_'.includes(k)) return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      if (e.type !== 'keydown' || e.repeat) return
      if (k === '+' || k === '=') bump(1)
      else if (k === '-' || k === '_') bump(-1)
      else if (k === 't' || k === 'T') setTech((v) => !v)
      else if (quiz) { if (k === 'Escape') setQuiz(false) }
      else if (k === 'Escape') { setDeckId(null); setI(0) }
      else if (k === 'ArrowLeft') go(-1)
      else if (k === 'ArrowRight' || k === ' ') go(1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [deck, quiz, go, bump])

  const load = async (f: File | undefined) => {
    if (!f) return
    try {
      if (f.size > 200_000) throw new Error('big')
      const r = parseDeck(JSON.parse(await f.text()))
      if ('error' in r) { setNote(r.error); return }
      setDecks((d) => [...d.filter((x) => x.id !== r.deck.id), r.deck]); setDeckId(r.deck.id); setI(0); setNote('')
    } catch { setNote('Could not read that file. A deck is a small .json file with a title and slides.') }
    if (file.current) file.current.value = ''
  }

  const Toggle = (<>
    <span className="pr-size" role="group" aria-label="Text size">
      <button type="button" disabled={sz === 0} onClick={() => bump(-1)} aria-label="Smaller text" title="Smaller text (key -)">A−</button>
      <span aria-live="polite">{Math.round(SIZES[sz] * 100)}%</span>
      <button type="button" disabled={sz === SIZES.length - 1} onClick={() => bump(1)} aria-label="Bigger text" title="Bigger text (key +)">A+</button>
    </span>
    <button type="button" className={'pr-tech' + (tech ? ' on' : '')} aria-pressed={tech} onClick={() => setTech((v) => !v)} title="Show or hide the chips and numbers (key T)">
      {tech ? '🔬 Technical' : '🧒 Kid view'} <kbd>T</kbd>
    </button>
  </>)
  const vars = { '--prs': SIZES[sz] } as React.CSSProperties

  if (quiz) return <div className="pr" style={vars}><QuizRunner tech={tech} toggle={Toggle} onClose={() => setQuiz(false)} /></div>

  if (!deck) {
    return (
      <div className="pr" style={vars}>
        <div className="pr-bar"><b>🎬 Presentations</b>{Toggle}</div>
        {decks.filter((d) => d.featured).map((d) => (
          <button key={d.id} className="pr-featured" onClick={() => { setDeckId(d.id); setI(0) }}>
            <span className="pr-star">⭐ Featured presentation</span><b>{d.title}</b><span>{d.blurb}</span><small>{d.slides.length} slides · ▶ Start</small>
          </button>
        ))}
        <div className="pr-decks">
          {decks.filter((d) => !d.featured).map((d) => (
            <button key={d.id} className="pr-deck" onClick={() => { setDeckId(d.id); setI(0) }}>
              <b>{d.title}</b><span>{d.blurb}</span><small>{d.slides.length} slides · ▶ Start</small>
            </button>
          ))}
          <button className="pr-deck quiz" onClick={() => setQuiz(true)}><b>🧠 Quizzes</b><span>Chips and processors, Moog and Kurzweil, who came first.</span><small>3 quizzes · ▶ Start</small></button>
        </div>
        <div className="pr-load">
          <button type="button" className="btn-ghost sh-small" onClick={() => file.current?.click()}>📂 Load slides from a file</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void load(e.target.files?.[0])} />
          <span className="pr-note" role="status">{note || 'A deck is a small .json file: a title, and slides with a title, a one-line "kid" sentence and optional "tech" lines.'}</span>
        </div>
      </div>
    )
  }

  const s = deck.slides[i]
  return (
    <div className="pr" style={vars}>
      <div className="pr-bar">
        <button className="btn-ghost sh-small" onClick={() => { setDeckId(null); setI(0) }}>← All</button>
        <b className="pr-dtitle">{deck.title}</b>
        <div className="pr-nav">
          <button className="sh-play" disabled={i === 0} onClick={() => go(-1)} aria-label="Previous slide">◀</button>
          <span className="pr-count">{i + 1} / {n}</span>
          <button className="sh-play" disabled={i >= n - 1} onClick={() => go(1)} aria-label="Next slide">▶</button>
        </div>
        {Toggle}
        <button className={'btn-ghost sh-small' + (i >= n - 1 ? ' pr-pulse' : '')} onClick={() => setQuiz(true)}>🧠 Quiz</button>
      </div>
      <div className="pr-slide" key={i}>
        <div className="pr-text">
          <div className="pr-year">{s.year ?? ''} <span aria-hidden>{s.emoji}</span></div>
          <h2>{s.title}</h2>
          {s.cue && <p className="pr-cue">[{s.cue}]</p>}
          {s.read ? <p className="pr-read">{s.read}</p> : null}
          <p className={s.read ? 'pr-kidnote' : 'pr-kid'}>{s.kid}</p>
          {tech && s.tech.length > 0 && <ul className="pr-techlist" aria-label="Technical details">{s.tech.map((t, k) => <li key={k}>{t}</li>)}</ul>}
        </div>
        {(s.pic || s.pic2) && (
          <div className="pr-pics">
            {s.pic && <Photo id={s.pic} />}
            {s.pic2 && <Photo id={s.pic2} small />}
            {s.caption && <p className="pr-cap">{s.caption}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
