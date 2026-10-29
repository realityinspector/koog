import { useState } from 'react'
import { EVENTS, QUIZ } from './timelineData'
import { getEmu } from './emu'

const era = (y: number) => (y < 1960 ? 'era-early' : y < 1970 ? 'era-60' : y < 1980 ? 'era-70' : 'era-80')

export function Timeline({ onPlay }: { onPlay: (id: string, preset: number) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [quiz, setQuiz] = useState(false)
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b'>>({})
  const done = Object.keys(answers).length
  const score = QUIZ.filter((q, i) => answers[i] && (answers[i] === 'a') === (q.yearA < q.yearB)).length
  const ev = open !== null ? EVENTS[open] : null

  if (quiz) {
    return (
      <div className="sh-quizbox">
        <div className="sh-quiz-top">
          <b>🧠 Which came first?</b>
          {done === QUIZ.length && <span className="sh-score">You got {score} of {QUIZ.length}. <button className="sh-reset" onClick={() => setAnswers({})}>Again</button></span>}
          <button className="btn-ghost sh-small" onClick={() => setQuiz(false)}>← Timeline</button>
        </div>
        <div className="sh-qs">
          {QUIZ.map((q, i) => {
            const ans = answers[i]
            const firstIsA = q.yearA < q.yearB
            return (
              <div key={i} className="sh-q">
                {(['a', 'b'] as const).map((k) => {
                  const right = (k === 'a') === firstIsA
                  const cls = ans ? (right ? ' right' : ans === k ? ' wrong' : '') : ''
                  return (
                    <button key={k} className={'sh-opt' + cls} disabled={!!ans} onClick={() => setAnswers({ ...answers, [i]: k })}>
                      {q[k]}
                    </button>
                  )
                })}
                <small>{ans ? `${q.yearA} vs ${q.yearB}` : ' '}</small>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="sh-tl">
      <div className="sh-tl-bar">
        <span className="sh-hint">Slide sideways through 100 years. Tap a card.</span>
        <button className="btn-ghost sh-small" onClick={() => setQuiz(true)}>🧠 Quiz</button>
      </div>
      <div className="sh-tl-main">
        <div
          className="sh-rail"
          role="list"
          onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY }}
        >
          {EVENTS.map((e, i) => (
            <button
              key={i}
              role="listitem"
              className={'sh-card ' + era(e.sort) + (open === i ? ' open' : '')}
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span className="sh-dot" />
              <span className="sh-year">{e.year}</span>
              <span className="sh-emoji">{e.emoji}</span>
              <h3>{e.title}</h3>
              {e.emu && getEmu(e.emu) && <span className="sh-play-tag">▶ Play it</span>}
            </button>
          ))}
        </div>
        {ev && (
          <aside className={'sh-side ' + era(ev.sort)}>
            <button className="sh-x" onClick={() => setOpen(null)} aria-label="Close card">✕</button>
            <div className="sh-side-h"><span>{ev.emoji}</span><div><small>{ev.year}</small><h3>{ev.title}</h3></div></div>
            <p className="sh-body">{ev.body}</p>
            {ev.emu && getEmu(ev.emu) && <button className="sh-play" onClick={() => onPlay(ev.emu!, ev.emuPreset ?? 0)}>▶ Play it</button>}
            <p className="sh-try">👉 {ev.hook}</p>
          </aside>
        )}
      </div>
    </div>
  )
}
