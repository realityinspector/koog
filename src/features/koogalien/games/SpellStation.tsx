// Spell Station (unit 6, spell mode): the Koog Alien needs a name spelled to dock its ship. KOOG first, then the kid's own name,
// then pets and friends. Each letter is two notes (row, then column). The letter grid shows at first and fades with mastery.
import { useEffect, useRef, useState } from 'react'
import { ALPHABET, SPELL_EXTRAS, SPELL_ROWS } from '../../../koogalien/data/alphabet'
import type { Chord, Degree } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { Mascot } from '../learn/Mascot'
import { useChordInput } from '../learn/useChordInput'
import { cleanName, credit, helpFor } from './core'
import { exposeForTest, useGamesSave, usePedalNext, useProgress, useStage } from './hooks'
import { GameInput, Results, VoiceBadge, stars } from './Shared'
import { KOOG_WORD, SPELL_CHORD, gridMode, letterId, missesNow, newSpell, rowName, shipsFor, spellClean, spellCoach, spellPlay, spellResults, spellable, targetGlyph, type SpellState } from './spell'
import { SPELL_END } from '../../../koogalien/data/alphabet'

const VOICE = 'dro'
const CELLS = [...ALPHABET, ...SPELL_EXTRAS]

export default function SpellStation({ host, onBack }: { host: KoogalienHost; onBack: () => void }) {
  const { prog, commit } = useProgress(host)
  const { save, commit: commitSave } = useGamesSave(host)
  const stage = useStage(host)
  const [sp, setSp] = useState<SpellState | null>(null)
  const ref = useRef<SpellState | null>(null)
  const [fb, setFb] = useState<{ text: string; good: boolean } | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const [draft, setDraft] = useState('')
  const [shipIx, setShipIx] = useState(0)
  const set = (s: SpellState | null) => { ref.current = s; setSp(s) }
  exposeForTest('spell', () => ({ state: ref.current, fb, progress: prog.current, save: save.current }))
  useEffect(() => { commitSave((g) => ({ ...g, last: 'spell' })) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const ships = shipsFor(save.current.names)

  /** light what to play next, by the help ladder: the letter's own progress decides glow, fading glow or none */
  const help = (s: SpellState) => {
    stage.unglow()
    if (s.phase === 'docked') return
    if (s.phase === 'start') { stage.glow(SPELL_CHORD as readonly Degree[], prog.current.words.spell?.rung ? 1800 : undefined); return }
    if (s.phase === 'end') { stage.glow(SPELL_END as readonly Degree[], 1800); return }
    const g = targetGlyph(s); if (!g) return
    const h = helpFor(prog.current.words[letterId(s.word[s.pos])], missesNow(s))
    const note = (s.phase === 'row' ? g.row : g.col) as Degree
    if (h === 'glow') stage.glow([note]); else if (h === 'fade') stage.glow([note], 1500)
  }
  const hear = (s: SpellState | null = ref.current) => {
    if (!s) return
    const g = targetGlyph(s)
    if (s.phase === 'start') stage.say([SPELL_CHORD], VOICE)
    else if (s.phase === 'end') stage.say([SPELL_END], VOICE)
    else if (g) stage.sayHop(g.row, g.col, VOICE)
  }
  const start = (word: string) => {
    const s = newSpell(word)
    stage.clearTimers(); set(s); setFb(null); setShowGrid(false); help(s)
    stage.later(() => hear(s), 300)
  }

  const dock = (s: SpellState) => {
    const res = spellResults(s)
    commit((p) => {
      let q = p
      for (const r of res) q = credit(q, letterId(r.ch), r.passed, r.stars, Date.now(), 'memory')
      return credit(q, 'spell', true, spellClean(s) ? 3 : 2, Date.now(), 'memory')
    })
    host.concepts.mark('event'); host.concepts.mark('sequence')
    if (s.word !== KOOG_WORD) host.concepts.mark('variable')
    commitSave((g) => ({ ...g, docked: [...new Set([...g.docked, s.word])] }))
    host.celebrate(`${s.word.toUpperCase()} docked!`)
  }

  const play = (chord: Chord) => {
    const s = ref.current; if (!s || s.phase === 'docked') return
    const g = targetGlyph(s)
    const res = spellPlay(s, chord)
    if (res.event === 'none') return
    set(res.state)
    const L = (s.word[s.pos] ?? '').toUpperCase()
    switch (res.event) {
      case 'started': setFb({ text: 'Spell mode is on!', good: true }); host.concepts.mark('event'); break
      case 'wrong-start': setFb({ text: 'Press do and re together first. That is the word "spell".', good: false }); break
      case 'row-ok': setFb({ text: `Row ${g?.row} (${g ? rowName(g.row) : ''}). Now the column.`, good: true }); break
      case 'letter-done': setFb({ text: `${L === ' ' ? 'Space' : L} ✓`, good: true }); break
      case 'row-wrong': setFb({ text: `${L} lives in row ${g?.row} (${g ? rowName(g.row) : ''}). Try note ${g?.row}.`, good: false }); break
      case 'col-wrong': setFb({ text: `${L} is number ${g?.col} in its row. Try note ${g?.col}.`, good: false }); break
      case 'back': setFb({ text: 'Took one back.', good: true }); break
      case 'early-end': setFb({ text: 'Not all the letters are in yet.', good: false }); break
      case 'docked': setFb(null); dock(res.state); stage.unglow(); return
    }
    help(res.state)
    if (res.event === 'row-wrong' || res.event === 'col-wrong') stage.later(() => hear(res.state), 500)
    else if (res.event === 'letter-done' || res.event === 'started' || res.event === 'back') stage.later(() => hear(res.state), 450)
  }
  useChordInput(play, !!sp && sp.phase !== 'docked')
  const nextShip = () => { const ix = (shipIx + 1) % ships.length; setShipIx(ix); start(ships[ix]) }
  usePedalNext(() => { if (sp?.phase === 'docked') nextShip() }, !!sp)

  const addName = (raw: string) => {
    const n = cleanName(raw)
    if (!n || !spellable(n) || n === KOOG_WORD) { setFb({ text: 'Use letters, an apostrophe or a space (up to 12).', good: false }); return }
    commitSave((g) => ({ ...g, names: [...g.names.filter((x) => x !== n), n] }))
    setDraft(''); setFb(null)
  }

  if (!sp) {
    return (
      <section className="kgl kgg" aria-label="Spell Station">
        <div className="kgl-stage"><Mascot pose="wave" size={150} say="My ship needs a name spelled to dock. Can you spell it in Koogalien?" />
          <div className="kgl-prompt">
            <h2>🔤 Spell Station</h2>
            <p className="kgl-sub">Press do + re for "spell". Then each letter is two notes: its row, then its column. Finish with sol + high do.</p>
            <div className="kgg-ships" role="group" aria-label="Pick a name to spell">
              {ships.map((n, i) => (
                <button key={n} type="button" className="kgl-btn pri" onClick={() => { setShipIx(i); start(n) }}>
                  🛸 {n === KOOG_WORD ? 'KOOG (the ship)' : n.toUpperCase()}{save.current.docked.includes(n) ? ' ✓' : ''}
                </button>
              ))}
            </div>
            <form className="kgl-row" onSubmit={(e) => { e.preventDefault(); addName(draft) }}>
              <label className="kgg-label">Add your name, a pet or a friend
                <input className="kgl-search" value={draft} maxLength={12} placeholder="for example: maya" onChange={(e) => setDraft(e.target.value)} aria-label="A name to spell" />
              </label>
              <button type="submit" className="kgl-btn">Add</button>
            </form>
            {save.current.names.length ? <div className="kgl-row" aria-label="Saved names">{save.current.names.map((n) => <span key={n} className="kgg-chip">{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => commitSave((g) => ({ ...g, names: g.names.filter((x) => x !== n) }))}>×</button></span>)}</div> : <p className="kgl-coach">Tip: add your own name to give the ship a friend!</p>}
            <p className={'kgl-fb ' + (fb ? 'bad' : '')} aria-live="polite">{fb?.text ?? ''}</p>
            <button type="button" className="kgl-btn" onClick={onBack}>← Back to games</button>
          </div></div>
      </section>
    )
  }
  if (sp.phase === 'docked') {
    const res = spellResults(sp)
    const total = res.reduce((n, r) => n + r.stars, 0)
    const clean = spellClean(sp)
    return (
      <section className="kgl kgg" aria-label="Spell Station results">
        <Results title={clean ? `${sp.word.toUpperCase()} docked, clean!` : `${sp.word.toUpperCase()} docked!`} pose={clean ? 'cheer' : 'teach'} onNext={ships.length > 1 ? nextShip : undefined} nextLabel={`Next: ${(ships[(shipIx + 1) % ships.length] ?? '').toUpperCase()}`} onAgain={() => start(sp.word)} onBack={onBack}>
          <div className="kgl-stars" aria-label={`${total} stars`}>{'★'.repeat(Math.min(total, 15))}</div>
          <ul className="kgl-list">{res.map((r) => <li key={r.ch}>{r.passed ? '✓' : '–'} {r.ch === "'" ? "'" : r.ch.toUpperCase()} {r.passed ? stars(r.stars) : 'again soon'}</li>)}</ul>
        </Results>
      </section>
    )
  }

  const g = targetGlyph(sp)
  const ch = sp.word[sp.pos]
  const mode = showGrid ? 'full' : ch && (sp.phase === 'row' || sp.phase === 'col') ? gridMode(prog.current.words[letterId(ch)], missesNow(sp)) : 'full'
  return (
    <section className="kgl kgg" aria-label="Spell Station">
      <div className="kgl-top"><h2 style={{ margin: 0 }}>🔤 Spell Station</h2><VoiceBadge voice={VOICE} /></div>
      <div className="kgl-stage">
        <Mascot pose={fb?.good ? 'cheer' : 'listen'} size={130} />
        <div className="kgl-prompt">
          <div className="kgg-slots" role="img" aria-label={`Spelling ${sp.word}, ${sp.pos} of ${sp.word.length} letters`}>
            {[...sp.word].map((c, i) => <span key={i} className={'kgg-slot' + (i < sp.pos ? ' done' : i === sp.pos && sp.phase !== 'end' ? ' now' : '')}>{i < sp.pos ? (c === ' ' ? '␣' : c.toUpperCase()) : i === sp.pos && sp.phase !== 'start' && sp.phase !== 'end' ? '?' : ''}</span>)}
          </div>
          <p className="kgl-coach" aria-live="polite">{spellCoach(sp)}</p>
          <Grid mode={mode} row={sp.phase === 'row' || sp.phase === 'col' ? g?.row : undefined} col={sp.phase === 'col' ? g?.col : undefined} target={mode === 'full' && sp.phase !== 'start' && sp.phase !== 'end' ? ch : undefined} />
          <GameInput lit={stage.lit} onChord={play} />
          <div className="kgl-row">
            <button type="button" className="kgl-btn" onClick={() => hear()}>🔊 Hear it again</button>
            <button type="button" className="kgl-btn" onClick={() => setShowGrid((v) => !v)} aria-pressed={showGrid}>{showGrid ? 'Hide' : 'Show'} the letter grid</button>
            <button type="button" className="kgl-btn" onClick={() => play([8] as unknown as Chord)}>⌫ Take one back (high do)</button>
            <button type="button" className="kgl-btn" onClick={() => { stage.stopVoice(); stage.unglow(); set(null); setFb(null) }}>← Names</button>
          </div>
          <p className={'kgl-fb ' + (fb ? (fb.good ? 'good' : 'bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>
        </div>
      </div>
    </section>
  )
}

/** the 7 x 4 letter grid. full = every letter with the target lit, rows = only the row names, hidden = a note that it faded */
function Grid({ mode, row, col, target }: { mode: 'full' | 'rows' | 'hidden'; row?: number; col?: number; target?: string }) {
  if (mode === 'hidden') return <p className="kgg-faded">The letter grid faded away: you know these! Use "Show the letter grid" if you need it.</p>
  return (
    <table className="kgg-grid" aria-label="Letter grid: row note then column note">
      <thead><tr><th scope="col">row</th>{[1, 2, 3, 4].map((c) => <th key={c} scope="col" className={col === c ? 'hot' : ''}>{mode === 'full' ? `note ${c}` : ''}</th>)}</tr></thead>
      <tbody>
        {SPELL_ROWS.map((letters, ri) => (
          <tr key={ri} className={row === ri + 1 ? 'hot' : ''}>
            <th scope="row">{ri + 1}</th>
            {mode === 'full'
              ? [1, 2, 3, 4].map((c) => { const cell = CELLS.find((x) => x.row === ri + 1 && x.col === c); return <td key={c} className={(cell && target && cell.ch === target ? 'target ' : '') + (row === ri + 1 && col === c ? 'hot' : '')}>{cell ? (cell.ch === ' ' ? '␣' : cell.ch.toUpperCase()) : ''}</td> })
              : <td colSpan={4}>{letters.toUpperCase()}{ri === 6 ? " ' ␣" : ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
