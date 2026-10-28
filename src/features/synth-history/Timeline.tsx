import { useState } from 'react'
import { EVENTS, QUIZ } from './timelineData'

export function Timeline() {
  const [open, setOpen] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b'>>({})
  const done = Object.keys(answers).length
  const score = QUIZ.filter((q, i) => answers[i] && (answers[i] === 'a') === (q.yearA < q.yearB)).length

  return (
    <div className="sh-tl">
      <p className="sh-hint">Scroll sideways through 100 years. Tap a card to open it.</p>
      <div className="sh-rail" role="list">
        {EVENTS.map((e, i) => (
          <button
            key={i}
            role="listitem"
            className={'sh-card' + (open === i ? ' open' : '')}
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span className="sh-dot" />
            <span className="sh-year">{e.year}</span>
            <span className="sh-emoji">{e.emoji}</span>
            <h3>{e.title}</h3>
            {open === i && (
              <span className="sh-more">
                <span className="sh-body">{e.body}</span>
                <span className="sh-try">👉 {e.hook}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="sh-quiz">
        <h3>Which came first?</h3>
        {QUIZ.map((q, i) => {
          const ans = answers[i]
          const firstIsA = q.yearA < q.yearB
          return (
            <div key={i} className="sh-q">
              {(['a', 'b'] as const).map((k) => {
                const right = (k === 'a') === firstIsA
                const cls = ans ? (right ? ' right' : ans === k ? ' wrong' : '') : ''
                return (
                  <button
                    key={k}
                    className={'sh-opt' + cls}
                    disabled={!!ans}
                    onClick={() => setAnswers({ ...answers, [i]: k })}
                  >
                    {q[k]}
                  </button>
                )
              })}
              {ans && <small>{q.yearA} vs {q.yearB}</small>}
            </div>
          )
        })}
        {done === QUIZ.length && <p className="sh-score">You got {score} of {QUIZ.length}. <button className="sh-reset" onClick={() => setAnswers({})}>Again</button></p>}
      </div>
    </div>
  )
}
