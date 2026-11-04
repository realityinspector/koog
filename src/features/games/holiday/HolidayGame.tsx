import { useEffect, useMemo, useRef, useState } from 'react'
import { Feast, Tree } from './Scenes'
import { backToLadder, backToSongs, begin, hear, leave, openGame, peek, pickSong, startLevel, useHoliday } from './engine'
import { LEVELS, NLEV, goalFor, loadProg, nextUp, phrasesOf, progressPct, songsFor, type HolidayGame as Kind } from './data'
import { usePedal } from '../../pedal/pedal'
import './holiday.css'

const THEME: Record<Kind, { icon: string; title: string; blurb: string; unit: string; units: string; done: string }> = {
  feast: { icon: '🦃', title: 'Harvest Feast', blurb: 'Learn a Thanksgiving song in six steps. Every phrase you nail lands a dish on the table. Finish the song to serve the turkey.', unit: 'dish', units: 'dishes', done: 'turkey' },
  tree: { icon: '🎄', title: 'Light the Tree', blurb: 'Learn a Christmas song in six steps. Every phrase you nail flies an ornament onto the tree. Finish the song to put the star on top.', unit: 'ornament', units: 'ornaments', done: 'star' },
}
const Stars = ({ n, of = 3, big }: { n: number; of?: number; big?: boolean }) => (
  <span className={'hg-stars' + (big ? ' big' : '')} role="img" aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>
)

/** Harvest Feast (Thanksgiving) and Light the Tree (Christmas): memorize a holiday song, one rung at a time, up to the whole song. */
export function HolidayGame({ kind, onExit }: { kind: Kind; onExit: () => void }) {
  const s = useHoliday()
  const [help, setHelp] = useState(false)
  useEffect(() => { openGame(kind); return () => leave() }, [kind])
  // a foot pedal press starts a level, or moves on after one (if the pedal is plugged in)
  const phaseRef = useRef(s.phase); phaseRef.current = s.phase
  useEffect(() => usePedal.subscribe((p, prev) => {
    if (!p.down || prev.down) return
    const st = useHoliday.getState()
    if (st.phase === 'intro') begin()
    else if (st.phase === 'result' && st.result?.passed && st.result.level < NLEV) startLevel(st.result.level + 1)
  }), [])
  const th = THEME[kind]
  const songs = useMemo(() => songsFor(kind), [kind])
  const song = songs.find((x) => x.id === s.songId)
  const cur = s.game === kind ? s : null
  const Scene = kind === 'feast' ? Feast : Tree
  if (!cur) return <div className={'hg-root hg-' + kind} />
  const lvl = LEVELS[Math.max(0, cur.level - 1)]
  const whole = lvl.id === 'full' || lvl.id === 'master'
  const inRun = cur.phase === 'play' || cur.phase === 'count' || cur.phase === 'intro'
  const nPhr = song ? phrasesOf(song.id).length : 0
  const allGot = song ? Array.from({ length: nPhr }, (_, i) => i) : []
  const sceneGot = cur.phase === 'ladder' ? (cur.prog.done[0] ? allGot : []) : cur.phase === 'result' ? allGot : cur.phase === 'intro' ? (cur.prog.done[0] ? allGot : cur.got) : cur.got
  const frac = cur.phase === 'play' ? (whole ? cur.mIdx / Math.max(1, cur.mTotal) : cur.got.length / Math.max(1, cur.phraseCount)) : 0
  const nextLevel = Math.max(1, Math.min(NLEV, cur.prog.done.indexOf(false) + 1 || NLEV))
  const backTo = cur.phase === 'pick' ? onExit : cur.phase === 'ladder' ? backToSongs : backToLadder
  const backLabel = cur.phase === 'pick' ? 'Games' : cur.phase === 'ladder' ? 'Songs' : 'Rungs'

  return (
    <div className={'hg-root hg-' + kind + (cur.sheetUp ? ' hg-sheet' : '')} data-phase={cur.phase}>
      <header className="hg-top">
        <button className="hg-btn ghost" onClick={backTo} title={cur.phase === 'pick' ? 'Back to the games menu' : cur.phase === 'ladder' ? 'Pick a different song' : 'Back to the ladder of levels'}>‹ {backLabel}</button>
        <h2><span aria-hidden>{th.icon}</span> {th.title}{song ? <small> · {song.title}</small> : null}</h2>
        <button className={'hg-btn ghost hg-helpbtn' + (help ? ' on' : '')} onClick={() => setHelp(!help)} aria-pressed={help} title="How to play">❓ How to play</button>
      </header>

      {help && (
        <aside className="hg-help" role="note">
          <b>How to play</b>
          <ol>
            <li>Pick a song, then climb the six rungs. Each one takes a hint away: <i>Hunt &amp; Peck</i> shows the key and the notes, <i>Follow</i> fades them, <i>Echo</i> makes you listen, <i>Memory</i> hides everything, <i>Play full</i> is the whole song from memory, <i>Master</i> adds the beat.</li>
            <li>Press <b>Start</b>. After the 3-2-1, play the keys on your keyboard, the computer keys, or by tapping the on-screen keys.</li>
            <li>Green means right. Red means a slip, and the right key shows blue (when hints are on).</li>
            <li>🔁 plays the phrase again (free until Memory). 👀 Peek shows the notes. In Memory and Play full each one costs a star.</li>
            <li>{kind === 'feast' ? 'Every phrase puts a dish on the table.' : 'Every phrase hangs an ornament.'} Your progress is saved for you and this song.</li>
          </ol>
          <button className="hg-btn" onClick={() => setHelp(false)}>Got it</button>
        </aside>
      )}

      {cur.phase === 'pick' && (
        <section className="hg-pick">
          <p className="hg-blurb">{th.blurb}</p>
          {(() => {
            const going = songs.map((x) => ({ x, p: loadProg(x.id) })).filter((r) => r.p.done.some(Boolean) && r.p.done.includes(false))[0]
            return going ? <button className="hg-btn hg-continue" onClick={() => pickSong(going.x.id)} title="Pick up where you left off">▶ Continue: {going.x.title} <small>{nextUp(going.p)}</small></button> : null
          })()}
          <div className="hg-songs">
            {songs.map((x) => {
              const p = loadProg(x.id), pct = progressPct(p)
              return (
                <button key={x.id} data-song={x.id} className="hg-song" onClick={() => pickSong(x.id)} title={`Learn ${x.title}`}>
                  <b>{x.title}</b>
                  <span className="hg-sub">{x.origin.replace(/ \(.*\)$/, '')}, {x.year}</span>
                  <span className="hg-prog" aria-label={`${p.done.filter(Boolean).length} of ${NLEV} rungs done`}>
                    {LEVELS.map((l) => <i key={l.n} className={p.done[l.n - 1] ? 'on' : p.unlocked >= l.n ? 'open' : ''} title={l.name}>{l.icon}</i>)}
                  </span>
                  <span className="hg-bar" role="img" aria-label={`${pct}% learned`}><i style={{ width: pct + '%' }} /></span>
                  <span className="hg-sub"><b>{pct}%</b> learned · {nextUp(p)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {cur.phase !== 'pick' && song && (
        <section className="hg-main">
          <ol className="hg-rail" aria-label="The ladder">
            {LEVELS.map((l) => {
              const open = cur.prog.unlocked >= l.n, done = cur.prog.done[l.n - 1], here = inRun || cur.phase === 'result' ? cur.level === l.n : false
              return (
                <li key={l.n}>
                  <button data-rung={l.n} className={'hg-rung' + (done ? ' done' : '') + (here ? ' here' : '')} disabled={!open} onClick={() => startLevel(l.n)} aria-current={here ? 'step' : undefined}
                    title={open ? `${l.name}: ${l.rule}` : `Locked. Finish ${LEVELS[l.n - 2]?.name} first.`}>
                    <span className="hg-lic" aria-hidden>{open ? l.icon : '🔒'}</span>
                    <span className="hg-lt"><b>{l.n}. {l.name}</b><span className="hg-lr">{open ? l.rule : 'Locked'}</span></span>
                    <Stars n={cur.prog.stars[l.n - 1]} />
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="hg-scene">
            <Scene count={nPhr} got={sceneGot} done={cur.prog.done} pulse={cur.pulse} lastGot={cur.phase === 'play' || cur.phase === 'result' ? cur.lastGot : -1} frac={frac} />
            {(cur.phase === 'count' || (cur.phase === 'play' && cur.count > 0)) && <div className="hg-count" aria-live="assertive">{cur.count || 1}</div>}
            <p className="hg-cap">{th.icon} {cur.prog.done.filter(Boolean).length} of {NLEV} rungs done · {progressPct(cur.prog)}% learned{cur.prog.done[4] ? ` · the ${th.done} is up!` : ''}</p>
          </div>

          <div className="hg-side">
            {cur.phase === 'ladder' && (
              <div className="hg-card">
                <h3>{progressPct(cur.prog)}% learned</h3>
                <p>{nextUp(cur.prog)}</p>
                <p className="hg-dim">Pick a rung on the left, or just keep going.</p>
                <button className="hg-btn big" onClick={() => startLevel(Math.min(cur.prog.unlocked, nextLevel))} title="Open the next rung">▶ {cur.prog.done.some(Boolean) ? 'Continue' : 'Start'}: {LEVELS[Math.min(cur.prog.unlocked, nextLevel) - 1].name}</button>
                {cur.prog.master > 0 && <p className="hg-dim">Best Master score: {cur.prog.master}%</p>}
              </div>
            )}

            {cur.phase === 'intro' && (
              <div className="hg-card">
                <span className="hg-chip">{lvl.icon} Rung {lvl.n} of {NLEV} · {lvl.name}</span>
                <h3 className="hg-goal">{goalFor(lvl, kind, nPhr, cur.mTotal)}</h3>
                <ul className="hg-tips">
                  <li>{lvl.keys ? '💡 The keys on the keyboard glow.' : lvl.id === 'echo' ? '👂 You hear it first. Keys light while it plays.' : '💡 No glowing keys.'}</li>
                  <li>{lvl.sheet ? '🎼 The sheet music shows the notes.' : '🎼 No sheet music.'}</li>
                  {!whole && <li>🔁 Hear it again any time{lvl.id === 'memory' ? ' (costs a star)' : ' (free)'}.</li>}
                  {lvl.id === 'full' && <li>A slip never restarts the song. It waits for the right note. 🔁 and 👀 cost a star.</li>}
                  {lvl.id === 'master' && <li>🥁 A gentle beat plays. Hit at least 80% of the notes on the beat.</li>}
                </ul>
                <button data-act="start" className="hg-btn big" onClick={begin} title="Start with a 3-2-1 count-in" autoFocus>▶ Start</button>
              </div>
            )}

            {cur.phase === 'count' && <div className="hg-card"><h3 className="hg-goal">Get ready...</h3><p className="hg-dim">{goalFor(lvl, kind, nPhr, cur.mTotal)}</p></div>}

            {cur.phase === 'play' && (
              <div className="hg-card hg-hud">
                <span className="hg-chip">{lvl.icon} {lvl.name}</span>
                {whole ? (
                  <>
                    <div className="hg-wbar" role="progressbar" aria-valuemin={0} aria-valuemax={cur.mTotal} aria-valuenow={cur.mIdx} aria-label="Song progress"><i style={{ width: `${Math.round((cur.mIdx / Math.max(1, cur.mTotal)) * 100)}%` }} /></div>
                    <span className="hg-chip" role="status">{cur.count > 0 ? `Count in: ${cur.count}` : `Note ${Math.min(cur.mIdx + 1, cur.mTotal)} of ${cur.mTotal}`}{lvl.id === 'full' ? ` · ${cur.slips} slip${cur.slips === 1 ? '' : 's'}` : ` · ${cur.mHits} on the beat`}</span>
                  </>
                ) : null}
                <div className="hg-segs" role="progressbar" aria-valuemin={0} aria-valuemax={cur.phraseCount} aria-valuenow={cur.got.length} aria-label={`Phrase ${Math.min(cur.phraseIdx + 1, cur.phraseCount)} of ${cur.phraseCount}`}>
                  {Array.from({ length: cur.phraseCount }, (_, i) => <i key={i} className={cur.got.includes(i) ? 'on' : !whole && i === cur.phraseIdx ? 'now' : ''} />)}
                </div>
                {!whole && <span className="hg-chip" role="status">Phrase {Math.min(cur.got.length + 1, cur.phraseCount)} of {cur.phraseCount} · {cur.got.length} {cur.got.length === 1 ? th.unit : th.units}</span>}
                {(lvl.id === 'memory' || lvl.id === 'full') && <span className="hg-chip" title="Peeks and replays cost a star">Stars <Stars n={Math.max(1, 3 - cur.peeks)} /></span>}
                <p key={cur.fb.id} className={'hg-msg ' + cur.msgKind + (cur.msg ? '' : ' idle')} data-fb={cur.fb.id ? cur.fb.kind : undefined} aria-live="polite">{cur.listening ? '🔊 Listen...' : cur.msg || lvl.coach}</p>
                <div className="hg-actions">
                  {lvl.id !== 'master' && <button data-act="hear" className="hg-btn" onClick={hear} disabled={cur.listening}
                    title={lvl.id === 'memory' || lvl.id === 'full' ? 'Hear the phrase again. Costs a star.' : 'Hear the phrase again. Free!'}>🔁 Hear it again{lvl.id === 'memory' || lvl.id === 'full' ? ' (−1★)' : ''}</button>}
                  {(lvl.id === 'memory' || lvl.id === 'full') && <button data-act="peek" className="hg-btn" onClick={peek} disabled={cur.listening} title="Show the notes for this phrase. Costs a star.">👀 Peek (−1★)</button>}
                  <button className="hg-btn ghost" onClick={() => startLevel(lvl.n)} title="Stop and start this rung over">↺ Restart</button>
                </div>
              </div>
            )}

            {cur.phase === 'result' && cur.result && (
              <div className="hg-card hg-res">
                <h3>{cur.result.passed ? (lvl.id === 'master' ? 'Master! You nailed it in time.' : lvl.id === 'full' ? `You know it by heart! ${kind === 'tree' ? 'The star is on the tree.' : 'The turkey is served.'}` : `${lvl.name} complete!`) : 'So close! You need 80% on the beat.'}</h3>
                {cur.result.passed && <Stars n={cur.result.stars} big />}
                {cur.result.acc != null && <p>{Math.round(cur.result.acc * 100)}% of the notes on the beat.</p>}
                {cur.result.passed && (lvl.id === 'full' || lvl.id === 'memory') && <p className="hg-dim">{cur.result.slips ? `${cur.result.slips} slip${cur.result.slips === 1 ? '' : 's'}` : 'No slips'}{cur.result.peeks ? `, ${cur.result.peeks} peek${cur.result.peeks === 1 ? '' : 's'}` : ''}.</p>}
                {cur.result.unlockedNext && <p className="hg-unlock">Unlocked: {LEVELS[cur.result.level].icon} {LEVELS[cur.result.level].name}</p>}
                <p className="hg-dim">{cur.result.next}</p>
                <div className="hg-actions">
                  {cur.result.passed && cur.result.level < NLEV && <button className="hg-btn big" onClick={() => startLevel(cur.result!.level + 1)} title="Go to the next rung">Next level ›</button>}
                  <button className="hg-btn" onClick={() => startLevel(cur.result!.level)} title="Play this rung again">↺ Again</button>
                  <button className="hg-btn ghost" onClick={backToSongs} title="Choose another song">Pick another song</button>
                  <button className="hg-btn ghost" onClick={backToLadder} title="See all the rungs">Rungs</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
