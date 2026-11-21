// The Koogalien Dictionary: every word, digit and letter, grouped by unit. Search by English, or play a chord to look it up.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KoogalienHost } from '../../../koogalien/ports'
import type { Chord, Degree, LexEntry } from '../../../koogalien/data/types'
import { ALPHABET } from '../../../koogalien/data/alphabet'
import { LEXICON } from '../../../koogalien/data/lexicon'
import { print } from '../../../koogalien/lang/print'
import { nearest } from '../../../koogalien/learn/checks'
import { DIGITS, unitTitle } from '../../../koogalien/learn/items'
import { isLearned, unitUnlocked, type WordProg } from '../../../koogalien/learn/ladder'
import { PROGRESS_KEY, sanitize } from '../../../koogalien/learn/progress'
import { sentenceOf, VOICES_BY_UNIT } from '../../../koogalien/learn/speak'
import { WHY } from '../../../koogalien/learn/whys'
import { MiniPads } from '../learn/MiniPads'
import { rungInfo } from '../learn/rungInfo'
import { sayChords, sayLetter } from '../learn/say'
import { useChordInput } from '../learn/useChordInput'
import { useNames } from '../ui/prefs'
import '../learn/learn.css'

const ALL: readonly LexEntry[] = [...DIGITS, ...LEXICON]
const matches = (e: LexEntry, q: string) => !q || e.en.toLowerCase().includes(q) || e.id.includes(q) || !!e.alt?.some((a) => a.toLowerCase().includes(q)) || e.kind.includes(q)
const code = (e: LexEntry) => { try { return print(sentenceOf([e])) } catch { return `say ${e.en}.` } }

function Badge({ p, locked }: { p: WordProg | undefined; locked: boolean }) {
  if (p?.rung) { const r = rungInfo(p.rung); return <span className="rung" title={`Passed ${r.name}`}>{r.icon} {r.name} {'★'.repeat(p.stars)}</span> }
  return <span className="rung" title={locked ? 'Its unit is still locked, but you can look and listen any time' : 'Not practised yet'}>{locked ? '🔒 locked' : 'new'}</span>
}

export default function Dictionary({ host }: { host: KoogalienHost }) {
  const solfege = useNames()
  const [q, setQ] = useState('')
  const [listen, setListen] = useState(false)
  const [found, setFound] = useState<{ chord: Chord; hits: { entry: LexEntry; confidence: number }[] } | null>(null)
  const [hit, setHit] = useState<string | null>(null)
  const prog = useMemo(() => sanitize(host.progress.load(PROGRESS_KEY, null)), [host])
  const handle = useRef<{ stop(): void } | null>(null)
  useEffect(() => () => handle.current?.stop(), [])

  useChordInput((chord) => {
    const hits = nearest(chord, 3)
    setFound({ chord, hits })
    setHit(hits[0]?.entry.id ?? null)
    if (hits[0]) document.getElementById('kgl-card-' + hits[0].entry.id)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, listen)

  const hear = (e: LexEntry) => { handle.current?.stop(); handle.current = sayChords(host, [e.chord], VOICES_BY_UNIT(e.unit)) }
  const ql = q.trim().toLowerCase()
  const units = [...new Set(ALL.map((e) => e.unit))].sort((a, b) => a - b)
  const letters = ALPHABET.filter((g) => !ql || g.ch.toLowerCase() === ql || ('letter ' + g.ch).toLowerCase().includes(ql))
  const shown = ALL.filter((e) => matches(e, ql)).length + letters.length

  return (
    <section className="kgl" aria-label="Koogalien Word book">
      <h2>📚 Word book</h2>
      <p className="kgl-sub">Every word is a chord: keys pressed together. Search for a word, or play keys to see which word they make.</p>
      <div className="kgl-tools">
        <input className="kgl-search" type="search" placeholder="Search for a word, like hello or happy" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the word book" />
        <button type="button" className={'kgl-btn' + (listen ? ' on' : '')} aria-pressed={listen} onClick={() => { setListen((v) => !v); setFound(null) }}>
          {listen ? '👂 Listening: play a chord' : '🎹 Play to look up'}
        </button>
      </div>
      <div aria-live="polite">
        {listen && !found ? <div className="kgl-look"><p>Play keys or pads together, and the nearest words show up here.</p></div> : null}
        {found ? (
          <div className="kgl-look">
            <p><b>You played</b> <MiniPads lit={found.chord as readonly Degree[]} label={`you played pads ${found.chord.join(' and ')}`} /> {found.hits.length ? '' : 'Nothing close to that yet.'}</p>
            {found.hits.length ? (
              <ol>{found.hits.map(({ entry, confidence }, i) => (
                <li key={entry.id} className={i === 0 ? 'best' : ''}>
                  <button type="button" onClick={() => { setHit(entry.id); hear(entry); document.getElementById('kgl-card-' + entry.id)?.scrollIntoView?.({ block: 'center' }) }}>
                    <span style={{ fontSize: 22 }}>{entry.emoji}</span> <b>{entry.en}</b> <span>{Math.round(confidence * 100)}%{confidence >= 0.85 ? ' match' : confidence >= 0.5 ? ' maybe' : ' far'}</span>
                  </button>
                </li>))}
              </ol>) : null}
          </div>) : null}
      </div>
      {shown === 0 ? <p className="kgl-sub" style={{ marginTop: 24 }}>No word like "{q}" yet. Koogalien is still growing.</p> : null}
      {units.map((u) => {
        const list = ALL.filter((e) => e.unit === u && matches(e, ql))
        if (!list.length) return null
        const open = unitUnlocked(u, prog.words)
        return (
          <div key={u}>
            <div className="kgl-unit"><h3>Unit {u}: {unitTitle(u)}</h3>{open ? null : <span className="kgl-lock">🔒 opens after you learn unit {u - 1}. You can still look and listen.</span>}</div>
            <div className="kgl-grid">
              {list.map((e) => (
                <article key={e.id} id={'kgl-card-' + e.id} className={'kgl-card' + (hit === e.id ? ' hit' : '') + (open ? '' : ' locked')} aria-label={`${e.en}: ${e.chord.map(solfege).join(' ')}`}>
                  <div className="kgl-card-h"><span className="e" aria-hidden>{e.emoji}</span><b>{e.en}</b><Badge p={prog.words[e.id]} locked={!open} /></div>
                  <div className="kgl-row"><MiniPads lit={e.chord as readonly Degree[]} label={`pads ${e.chord.join(' and ')}`} /><span className="kgl-sub">{e.chord.map(solfege).join(' ')}</span></div>
                  <code className="kgl-code">{code(e)}</code>
                  <p className="kgl-why">{e.kind === 'number' && e.id.startsWith('digit-') ? 'A lone note is a number: this is note ' + e.en + ' of 8.' : (WHY[e.en.toLowerCase()] ?? WHY[e.id] ?? 'Arbitrary: your Koogalien will tell you a story for this one.')}</p>
                  <div className="kgl-row"><button type="button" className="kgl-btn" onClick={() => hear(e)}>🔊 Hear it</button>{isLearned(prog.words[e.id]) ? <span className="kgl-sub">learned</span> : null}</div>
                </article>))}
            </div>
          </div>)
      })}
      {letters.length ? (
        <div>
          <div className="kgl-unit"><h3>Letters: spell any word</h3><span className="kgl-sub">Play the spell chord (C + D), then a row note and a column note for each letter.</span></div>
          <div className="kgl-grid">
            {letters.map((g) => (
              <article key={g.ch} className="kgl-card" aria-label={`letter ${g.ch}: row ${g.row}, column ${g.col}`}>
                <div className="kgl-card-h"><b style={{ fontSize: 26 }}>{g.ch.toUpperCase()}</b><span className="rung">row {g.row}, column {g.col}</span></div>
                <div className="kgl-row"><MiniPads lit={[g.row as Degree]} label={`row pad ${g.row}`} /><span aria-hidden>then</span><MiniPads lit={[g.col as Degree]} label={`column pad ${g.col}`} /></div>
                <div className="kgl-row"><button type="button" className="kgl-btn" onClick={() => { handle.current?.stop(); handle.current = sayLetter(host, g.row, g.col, VOICES_BY_UNIT(g.unit)) }}>🔊 Hear it</button></div>
              </article>))}
          </div>
        </div>) : null}
    </section>
  )
}

