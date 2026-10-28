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

  return (
    <section className="bl">
      <div className="bl-head">
        <span className="bl-live">● LIVE</span>
        <h2>Behind the scenes: this app is being built right now</h2>
      </div>
      <ol className="bl-stages">
        {STAGES.map((s) => (
          <li key={s.id} className={s.id === currentStage ? 'now' : ''} title={s.tip}>
            {s.label}
          </li>
        ))}
      </ol>
      <article className="bl-latest" key={latest.id}>
        <div className="bl-meta">
          {latest.time} · <span className={`bl-tag ${latest.stage}`}>{latest.stage}</span>
        </div>
        <h3>{latest.title}</h3>
        <p>
          {latest.body.slice(0, shown)}
          <span className="bl-cursor">▌</span>
        </p>
      </article>
      <details className="bl-older">
        <summary>Earlier updates ({older.length})</summary>
        {older.map((e) => (
          <div key={e.id} className="bl-item">
            <div className="bl-meta">
              {e.time} · <span className={`bl-tag ${e.stage}`}>{e.stage}</span>
            </div>
            <strong>{e.title}</strong>
            <p>{e.body}</p>
          </div>
        ))}
      </details>
    </section>
  )
}
