// The Koogalien Library: a shelf of public-domain classics, and a reader that plays a book as music with the three-row ribbon.
// Text is always rendered as React text (the books are data, never HTML). No network at runtime: editions are this app's own files.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chord, Degree } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { HIGH_RULES, SPEEDS, SCENES, keyOfChapter, type SpeedName } from '../../../koogalien/library/high'
import type { Edition } from '../../../koogalien/library/types'
import { VOICE_IDS, VOICE_NAMES } from '../../../koogalien/library/types'
import { VOICE_LOOK } from '../brand'
import { MiniPads } from '../learn/MiniPads'
import { useChordInput } from '../learn/useChordInput'
import { SentenceRibbon } from '../ribbon/SentenceRibbon'
import { BOOKS, loadEdition, type BookMeta } from './catalog'
import { Cover } from './Cover'
import { attach, bookKey, closeBook, detach, jumpChapter, jumpPara, loadSavedPos, openBook, pause, play, seek, setAlong, setMode, setSpeed, skipTarget, stripNo, submitChord, toggle, useReader, type BookProgress } from './reader'
import '../koogalien.css'
import '../learn/learn.css'
import './library.css'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SPEED_NAMES = Object.keys(SPEEDS) as SpeedName[]
const SPEED_HELP: Record<SpeedName, string> = { 'story time': 'slow and cosy', 'read-aloud': 'like a parent reading', 'fast reader': 'quick, for good readers' }

export default function Library({ host }: { host: KoogalienHost }) {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => { attach(host); return () => detach() }, [host])
  return (
    <div className="kgx-app kgl-lib">
      {id ? <Reader id={id} onBack={() => { closeBook(); setId(null) }} /> : <Shelf host={host} onPick={setId} />}
    </div>
  )
}

function progressOf(host: KoogalienHost, b: BookMeta): { frac: number; where: string } {
  const raw = host.progress.load<Partial<BookProgress> | null>(bookKey(b.id), null)
  if (!raw) return { frac: 0, where: 'Not started' }
  const done = Array.isArray(raw.done) ? raw.done.length : 0
  const ch = Math.max(0, Math.floor(Number(raw.ch) || 0))
  const frac = Math.min(1, (done + ((Number(raw.p) || 0) >= 0 ? 0.3 : 0)) / Math.max(1, b.chapters))
  return { frac, where: done >= b.chapters ? 'Finished!' : `Chapter ${ch + 1} of ${b.chapters}` }
}

function Shelf({ host, onPick }: { host: KoogalienHost; onPick: (id: string) => void }) {
  return (
    <>
      <header className="kgx-head"><h1>📚 The Koogalien Library</h1><button type="button" className="kgx-exit" onClick={() => host.exit()}>Close</button></header>
      <p className="kgl-intro">Classic stories, played as Koogalien music. Pick a book, press play, and watch the notes, the code and the English scroll by like a karaoke audiobook. Every word the lexicon knows is a chord; every other word is spelled out in notes.</p>
      <ul className="kgl-shelf" aria-label="Books">
        {BOOKS.map((b) => {
          const p = progressOf(host, b)
          return (
            <li key={b.id}>
              <button type="button" className="kgl-book" onClick={() => onPick(b.id)} aria-label={`${b.title} by ${b.author}. ${p.where}`}>
                <Cover className="kgl-cover" {...b.cover} title={b.title} />
                <span className="kgl-btitle">{b.title}</span>
                <span className="kgl-bauthor">{b.author}</span>
                <span className="kgl-bmeta">{p.where}{b.partial ? ` · first ${b.chapters} of ${b.totalChapters} chapters` : ''}</span>
                <span className="kgl-prog" aria-hidden="true"><i style={{ width: Math.round(p.frac * 100) + '%' }} /></span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="kgl-credit">Every book here is in the public domain. Text from a public-domain edition; original publication years are on each book's page.</p>
    </>
  )
}

function Reader({ id, onBack }: { id: string; onBack: () => void }) {
  const meta = BOOKS.find((b) => b.id === id)!
  const [err, setErr] = useState('')
  const s = useReader()
  const ed = s.edition
  useEffect(() => {
    let live = true
    loadEdition(id).then((e) => { if (!live) return; if (e) openBook(e); else setErr('This book is missing from the shelf.') }).catch(() => live && setErr('Could not open this book.'))
    return () => { live = false; pause() }
  }, [id])
  const { feed } = useChordInput((c: Chord) => { submitChord(c) }, s.playing && s.along)
  void feed
  const ribbonBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ribbonBox.current?.querySelector('.kgx-ribbon') as HTMLElement | null
    if (!box || s.playingWord === null) return
    const li = box.querySelector(`[data-word="${s.playingWord}"]`) as HTMLElement | null
    if (li) box.scrollTo({ left: Math.max(0, li.offsetLeft - box.clientWidth / 2 + li.clientWidth / 2), behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [s.playingWord, s.rendered])
  const curRef = useRef<HTMLSpanElement>(null)
  const textBox = useRef<HTMLElement>(null)
  useEffect(() => {
    // scroll only the text box (never the page) so the sentence being read stays in view
    const box = textBox.current, el = curRef.current
    if (!box || !el) return
    const top = el.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [s.pos.ch, s.pos.p, s.pos.s])

  if (err) return <><button type="button" onClick={onBack}>← Shelf</button><p className="kgx-soon">{err}</p></>
  if (!ed) return <p className="kgx-soon">Opening the book…</p>
  const ch = ed.chapters[s.pos.ch]
  const key = keyOfChapter(s.pos.ch)
  return (
    <>
      <header className="kgl-bar">
        <button type="button" onClick={onBack}>← Shelf</button>
        <div className="kgl-bt"><h1>{ed.title}</h1><small>{ed.author}</small></div>
        <button type="button" className="kgx-exit" onClick={onBack}>Close</button>
      </header>
      <Controls ed={ed} />
      <Legend ed={ed} />
      <div ref={ribbonBox} className="kgl-ribbon">
        <SentenceRibbon sentence={s.rendered?.sentence ?? null} playing={s.playingWord} compact />
      </div>
      <p className="kgl-status" role="status" aria-live="polite">
        {s.mode === 'high' ? `High Koogalien · key of ${key.name} · ${SCENES[s.scene].label} scene` : 'Plain Koogalien · one voice'}
        {s.target ? ` · your turn: play ${s.rendered?.sentence.words[s.target.word]?.en ?? 'the word'}` : ''}
      </p>
      {s.along && s.playing && s.target ? <AlongPanel /> : null}
      <section ref={textBox} className="kgl-text" aria-label={'Text of ' + (ch?.t ?? '')}>
        <h2>{ch?.t}</h2>
        {ch?.ps.map((para, pi) => (Math.abs(pi - s.pos.p) <= 3 || (s.pos.p < 0 && pi < 4)) ? (
          <p key={pi} className={pi === s.pos.p ? 'kgl-cp' : ''}>
            {para.map((l, si) => {
              const cur = pi === s.pos.p && si === s.pos.s
              return <span key={si}><span ref={cur ? curRef : undefined} role="button" tabIndex={0} className={'kgl-sent v' + l[2] + (cur ? ' kgl-cur' : '')} onClick={() => seek({ ch: s.pos.ch, p: pi, s: si })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seek({ ch: s.pos.ch, p: pi, s: si }) } }}>{l[0].replace(/_/g, '')}</span>{' '}</span>
            })}
          </p>
        ) : null)}
      </section>
      <details className="kgl-high">
        <summary>What is High Koogalien?</summary>
        <p>Plain Koogalien says each word as itself. High Koogalien adds music on top, so a whole book sounds like a story. The words and chords never change; the music around them does.</p>
        <ul>{HIGH_RULES.map((r) => <li key={r.id}><b>{r.means}</b>: {r.rule}</li>)}</ul>
      </details>
      <p className="kgl-credit">{ed.credit} {ed.partial ? `This shelf copy has the first ${ed.chapters.length} of ${ed.totalChapters} chapters.` : ''}</p>
    </>
  )
}

function Controls({ ed }: { ed: Edition }) {
  const s = useReader()
  return (
    <div className="kgl-controls">
      <div className="kgl-row">
        <button type="button" className="kgl-play" onClick={toggle} aria-pressed={s.playing}>{s.playing ? '⏸ Pause' : s.ended ? '↻ Again' : '▶ Play'}</button>
        <button type="button" onClick={() => jumpPara(-1)} aria-label="Previous paragraph">⏮ ¶</button>
        <button type="button" onClick={() => jumpPara(1)} aria-label="Next paragraph">¶ ⏭</button>
        <label className="kgl-sel">Chapter
          <select value={s.pos.ch} onChange={(e) => jumpChapter(Number(e.target.value))}>
            {ed.chapters.map((c, i) => <option key={i} value={i}>{c.t}</option>)}
          </select>
        </label>
      </div>
      <div className="kgl-row">
        <span className="kgl-seg" role="group" aria-label="Speed">
          {SPEED_NAMES.map((n) => <button key={n} type="button" aria-pressed={s.speed === n} title={SPEED_HELP[n]} onClick={() => setSpeed(n)}>{n}</button>)}
        </span>
        <span className="kgl-seg" role="group" aria-label="Register">
          <button type="button" aria-pressed={s.mode === 'plain'} onClick={() => setMode('plain')} title="Every word as itself, one voice">Plain</button>
          <button type="button" aria-pressed={s.mode === 'high'} onClick={() => setMode('high')} title="Voices, keys, tempo and feeling on top of the words">High</button>
        </span>
        <label className="kgx-check"><input type="checkbox" checked={s.along} onChange={(e) => setAlong(e.target.checked)} /> Play along</label>
      </div>
    </div>
  )
}

function Legend({ ed }: { ed: Edition }) {
  const s = useReader()
  const cast = ed.chapters[s.pos.ch]?.cast ?? []
  const names = (v: number) => cast.filter(([, no]) => no === v).map(([n]) => n.replace(/^./, (c) => c.toUpperCase())).join(', ')
  if (s.mode === 'plain') return <p className="kgl-legend" aria-label="Voice legend"><span className="kgl-badge v1"><b>P</b> Pip</span> says every word in plain Koogalien. Switch to High to hear the characters.</p>
  return (
    <ul className="kgl-legend" aria-label="Voice legend">
      <li className="kgl-badge v0"><b>N</b> Narrator</li>
      {[1, 2, 3].map((v) => {
        const look = VOICE_LOOK[VOICE_IDS[v]]
        return <li key={v} className={'kgl-badge v' + v} style={{ ['--kc' as string]: look.color }}><b>{look.mark}</b> {VOICE_NAMES[v]}{names(v) ? <small> ({names(v)})</small> : null}</li>
      })}
    </ul>
  )
}

function AlongPanel() {
  const s = useReader()
  const [picked, setPicked] = useState<Degree[]>([])
  const t = s.target
  useEffect(() => { setPicked([]) }, [t?.word])
  if (!t) return null
  const w = s.rendered?.sentence.words[t.word]
  return (
    <section className="kgl-along" aria-label="Play along">
      <p><b>Your turn!</b> Play <span className="kgl-want">{w?.en ?? '…'}</span> on the keys{t.misses > 0 ? ` (not quite, try again: ${t.misses}/3)` : ''}.</p>
      <MiniPads lit={t.chord as readonly Degree[]} picked={picked} big onToggle={(d) => setPicked((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b))} label="Pads to press" />
      <div className="kgl-row">
        <button type="button" disabled={!picked.length} onClick={() => { submitChord(picked); setPicked([]) }}>Play it</button>
        <button type="button" onClick={() => skipTarget()}>Skip this word</button>
        <span aria-live="polite">{s.hits} words played so far</span>
      </div>
    </section>
  )
}
void stripNo; void loadSavedPos; void play; void useMemo
