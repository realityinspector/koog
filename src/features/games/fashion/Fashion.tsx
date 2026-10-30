import { useEffect, useRef, useState } from 'react'
import { useJudge } from '../../../music/judge'
import { Game, type Snapshot } from './engine'
import { CATS, CAT_INFO, ERAS, MODELS, eraById, loadSave, type Look, type SavedLook } from './data'
import { JUDGE_LOOKS, drawJudge, drawStill } from './sprites'
import './fashion.css'

function initialSnap(): Snapshot {
  const save = loadSave()
  return {
    phase: 'eras', eraId: 'baroque', items: [0, 0, 0, 0, 0], itemNames: ['', '', '', '', ''], itemCounts: [4, 4, 4, 4, 4], pal: { root: 0, q: 'major' }, palName: 'C major', mood: 'bright',
    caption: '', model: MODELS[save.model].name, pieces: [], pieceIdx: 0, bpm: 100, done: 0, total: 0, confidence: 0, nextName: '', started: false, toast: null, says: null, scores: null,
    stars: 0, saved: false, save, newUnlock: null, reduced: false, zoneHit: -1,
  }
}

/** Runway Remix: style a model for a musical era by playing, then play the era's piece so they strut the runway. */
export function Fashion({ onExit }: { onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [s, setS] = useState<Snapshot>(initialSnap)

  useEffect(() => {
    const g = new Game(canvasRef.current!, rootRef.current!, setS)
    gameRef.current = g
    return () => { g.destroy(); gameRef.current = null }
  }, [])
  const g = () => gameRef.current
  const era = eraById(s.eraId)

  return (
    <div className="fr-root" ref={rootRef} data-phase={s.phase}>
      <canvas className="fr-canvas" ref={canvasRef} aria-label="Runway Remix stage" />
      {s.phase === 'eras' && <Eras s={s} onPick={(id) => g()?.pickEra(id)} onBook={() => g()?.toLookbook()} onExit={onExit} />}
      {s.phase === 'style' && <Style s={s} onCycle={(i, d) => g()?.cycle(CATS[i], d)} onModel={() => g()?.nextModel()} onSong={() => g()?.setPiece(s.pieceIdx + 1)} />}
      {s.phase === 'style' && (
        <div className="fr-top">
          <button className="fr-btn ghost" onClick={() => g()?.toEras()}>‹ Eras</button>
          <div className="fr-title"><b>{era.icon} {era.name}</b> <span>{era.years}</span></div>
          <div className="fr-grp">
            <button className="fr-btn ghost" onClick={() => g()?.toLookbook()}>📖 Lookbook</button>
            <button className="fr-btn go" onClick={() => g()?.startRunway()} disabled={!s.pieces.length}>Runway ▶</button>
          </div>
        </div>
      )}
      {s.phase === 'runway' && <RunHud s={s} onQuit={() => g()?.toStyle()} />}
      {s.phase === 'results' && <Results s={s} onSave={() => g()?.saveLook()} onAgain={() => g()?.retryRunway()} onRestyle={() => g()?.toStyle()} onEras={() => g()?.toEras()} />}
      {s.phase === 'lookbook' && <Lookbook s={s} onBack={() => g()?.toEras()} onDelete={(id) => g()?.deleteLook(id)} onTry={(id) => g()?.tryOn(id)} />}
      {s.toast && <div key={s.toast.id} className={'fr-toast ' + s.toast.kind + (s.phase === 'runway' ? ' run' : '')} role="status">{s.toast.text}</div>}
    </div>
  )
}

const Stars = ({ n }: { n: number }) => <span className="fr-stars" aria-label={`${n} of 5 stars`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>

function Eras({ s, onPick, onBook, onExit }: { s: Snapshot; onPick: (id: string) => void; onBook: () => void; onExit: () => void }) {
  return (
    <div className="fr-panel">
      <div className="fr-head">
        <h2>👗 Runway Remix</h2>
        <p>Pick an era. Style a model, then play its music to strut the runway!</p>
        <div className="fr-grp">
          <button className="fr-btn ghost" onClick={onBook}>📖 Lookbook ({s.save.looks.length})</button>
          <button className="fr-btn ghost" onClick={onExit}>Back</button>
        </div>
      </div>
      <div className="fr-eras">
        {ERAS.map((e, i) => {
          const open = s.save.unlocked.includes(e.id)
          return (
            <button key={e.id} className="fr-era" disabled={!open} onClick={() => onPick(e.id)} style={{ background: `linear-gradient(160deg, ${e.bg[1]}, ${e.bg[0]})`, borderColor: e.glow }}
              aria-label={open ? `${e.name}, ${e.years}` : `${e.name} is locked. Finish a runway in ${ERAS[i - 1]?.name}`}>
              <span className="ic">{open ? e.icon : '🔒'}</span>
              <b>{e.name}</b>
              <span className="yr">{e.years}</span>
              <span className="fs">{open ? e.fashion : `Finish a runway in ${ERAS[i - 1]?.name} to unlock`}</span>
              {open && s.save.best[e.id] ? <Stars n={s.save.best[e.id]} /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Style({ s, onCycle, onModel, onSong }: { s: Snapshot; onCycle: (i: number, d: 1 | -1) => void; onModel: () => void; onSong: () => void }) {
  const era = eraById(s.eraId)
  return (
    <>
      <div className="fr-fact">💡 {era.fact}</div>
      <div className="fr-caption"><b>🎨 {s.palName}: {s.mood}</b>{s.caption}<em>Play a chord (3 keys together) to change colours, or tap the wheel.</em></div>
      <div className="fr-wardrobe" role="group" aria-label="Wardrobe">
        {CATS.map((c, i) => (
          <div key={c} className={'fr-row' + (s.zoneHit === i ? ' hit' : '')}>
            <button onClick={() => onCycle(i, -1)} aria-label={`Previous ${CAT_INFO[c].label}`}>‹</button>
            <span><small>{CAT_INFO[c].icon} {CAT_INFO[c].label}</small>{s.itemNames[i]}</span>
            <button onClick={() => onCycle(i, 1)} aria-label={`Next ${CAT_INFO[c].label}`}>›</button>
          </div>
        ))}
        <div className="fr-row">
          <span><small>🎵 RUNWAY SONG</small>{s.pieces[s.pieceIdx]?.title ?? 'none yet'}</span>
        </div>
      </div>
      <div className="fr-ctl">
        <button className="fr-btn ghost" onClick={onModel}>🧑‍🎤 Model: {s.model}</button>
        {s.pieces.length > 1 && <button className="fr-btn ghost" onClick={onSong}>🎵 Next song</button>}
      </div>
    </>
  )
}
function RunHud({ s, onQuit }: { s: Snapshot; onQuit: () => void }) {
  const charge = useJudge((j) => j.charge)
  const pct = s.total ? (s.done / s.total) * 100 : 0
  return (
    <div className="fr-top run">
      <div className="fr-title"><b>{s.pieces[s.pieceIdx]?.title}</b> <span>{eraById(s.eraId).name}</span></div>
      <div className="fr-prog" role="progressbar" aria-valuenow={s.done} aria-valuemax={s.total}><i style={{ width: pct + '%' }} /><span>{s.done}/{s.total}</span></div>
      <div className="fr-grp">
        <div className="fr-conf" title="Strut confidence"><span>💃</span><div><i style={{ width: s.confidence * 100 + '%' }} /></div></div>
        <div className={'fr-boom' + (charge >= 1 ? ' full' : '')} role="meter" aria-label="BOOM charge" aria-valuenow={Math.round(charge * 100)}><span>⚡</span><div><i style={{ width: charge * 100 + '%' }} /></div></div>
        <button className="fr-btn ghost" onClick={onQuit} aria-label="Back to styling">✕</button>
      </div>
      <div className="fr-hint" style={{ ['--beat' as string]: 60 / s.bpm + 's' }}>
        <span className="pulse" aria-hidden />
        {s.started ? `Next note: ${s.nextName || 'done!'}` : `Play the glowing key (${s.nextName}) to start the walk!`}
      </div>
    </div>
  )
}

function Portrait({ idx }: { idx: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawJudge(ref.current, idx) }, [idx])
  return <canvas ref={ref} width={96} height={96} className="fr-portrait" style={{ ['--jc' as string]: JUDGE_LOOKS[idx].accent }} aria-hidden />
}

function Results({ s, onSave, onAgain, onRestyle, onEras }: { s: Snapshot; onSave: () => void; onAgain: () => void; onRestyle: () => void; onEras: () => void }) {
  return (
    <div className="fr-results">
      <div className="fr-judges">
        {s.says?.map((j, i) => (
          <div key={j.who} className="fr-judge">
            <div className="jh"><Portrait idx={i} /><div><b>{j.who}</b><small>{j.name}</small><Stars n={j.stars} /></div></div>
            <p>{j.say}</p>
            <p className="tip">💡 {j.tip}</p>
          </div>
        ))}
      </div>
      <div className="fr-final">
        <span>Final look <Stars n={s.stars} /></span>
        {s.newUnlock && <span className="unlock">🔓 {s.newUnlock} unlocked!</span>}
        <div className="fr-grp">
          <button className="fr-btn go" onClick={onSave} disabled={s.saved}>{s.saved ? '✓ Saved' : '📖 Save to Lookbook'}</button>
          <button className="fr-btn" onClick={onAgain}>↻ Walk again</button>
          <button className="fr-btn" onClick={onRestyle}>👗 Restyle</button>
          <button className="fr-btn ghost" onClick={onEras}>Eras</button>
        </div>
      </div>
    </div>
  )
}

function Thumb({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawStill(ref.current, look) }, [look])
  return <canvas ref={ref} width={110} height={150} className="fr-thumb" aria-hidden />
}

function Lookbook({ s, onBack, onDelete, onTry }: { s: Snapshot; onBack: () => void; onDelete: (id: number) => void; onTry: (id: number) => void }) {
  const looks: SavedLook[] = s.save.looks
  return (
    <div className="fr-panel">
      <div className="fr-head">
        <h2>📖 My Lookbook</h2>
        <p>{looks.length ? 'Tap a look to try it on again.' : 'No looks yet. Finish a runway walk and save your favourite look!'}</p>
        <button className="fr-btn ghost" onClick={onBack}>‹ Eras</button>
      </div>
      <div className="fr-book">
        {looks.map((l) => (
          <div key={l.id} className="fr-card">
            <button className="pick" onClick={() => onTry(l.id)} aria-label={`Try on ${eraById(l.era).name} look`}>
              <Thumb look={l} />
              <small>{eraById(l.era).name}</small>
              <Stars n={l.stars} />
            </button>
            <button className="del" onClick={() => onDelete(l.id)} aria-label="Delete this look">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
