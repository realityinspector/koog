import { useEffect, useState } from 'react'
import { currentStage, entries, type Stage } from './entries'
import './buildlog.css'

const STAGES: { id: Stage; label: string; tip: string }[] = [
  { id: 'plan', label: 'Plan', tip: 'Figure out what to build' },
  { id: 'build', label: 'Build', tip: 'Write the code' },
  { id: 'test', label: 'Test', tip: 'Check it works' },
  { id: 'ship', label: 'Ship', tip: 'Hand it to you!' },
]

export function BuildLog() {
  const latest = entries[entries.length - 1]
  const older = entries.slice(0, -1).reverse()
  const [shown, setShown] = useState(0)

  // typewriter effect on the newest entry; restarts when a new one arrives
  useEffect(() => {
    setShown(0)
    const id = setInterval(() => setShown((n) => (n >= latest.body.length ? n : n + 2)), 18)
    return () => clearInterval(id)
  }, [latest.id, latest.body])

  const [sel, setSel] = useState<number | null>(null)
  const picked = sel === null ? null : entries.find((e) => e.id === sel) ?? null
  const cur = picked ?? latest

  return (
    <section className="bl">
      <div className="bl-top">
        <span className="bl-live">● LIVE</span>
        <ol className="bl-stages">
          {STAGES.map((s) => (
            <li key={s.id} className={s.id === currentStage ? 'now' : ''} title={s.tip}>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
      <article className="bl-latest" key={cur.id}>
        <div className="bl-meta">
          {picked ? 'Earlier' : 'Newest'} · {cur.time} · <span className={`bl-tag ${cur.stage}`}>{cur.stage}</span>
        </div>
        <h3>{cur.title}</h3>
        <p>
          {picked ? cur.body : latest.body.slice(0, shown)}
          {!picked && <span className="bl-cursor">▌</span>}
        </p>
      </article>
      {older.length > 0 && (
        <div className="bl-strip" role="list" aria-label="Earlier updates">
          {picked && <button className="bl-chip bl-new" onClick={() => setSel(null)}>↩ Newest</button>}
          {older.map((e) => (
            <button key={e.id} role="listitem" className={'bl-chip' + (e.id === sel ? ' on' : '')} onClick={() => setSel(e.id === sel ? null : e.id)} aria-pressed={e.id === sel}>
              <span className={`bl-tag ${e.stage}`}>{e.stage}</span> {e.title}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
