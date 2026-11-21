// The quizzes: pick one, answer one question at a time. After each answer: a one-line kid explanation, plus the technical note when 🔬 is on.
import { useState, type ReactNode } from 'react'
import { PICS, picUrl } from './pics'
import { QUIZZES, type Quiz } from './quizzes'

export function QuizRunner({ tech, toggle, onClose }: { tech: boolean; toggle: ReactNode; onClose: () => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const reset = () => { setI(0); setPicked(null); setScore(0) }

  if (!quiz) {
    return (
      <>
        <div className="pr-bar"><button className="btn-ghost sh-small" onClick={onClose}>← Slides</button><b>🧠 Pick a quiz</b>{toggle}</div>
        <div className="pr-decks">
          {QUIZZES.map((z) => (
            <button key={z.id} className="pr-deck quiz" onClick={() => { setQuiz(z); reset() }}>
              <b>{z.emoji} {z.title}</b><span>{z.blurb}</span><small>{z.qs.length} questions · ▶ Start</small>
            </button>
          ))}
        </div>
      </>
    )
  }
  const done = i >= quiz.qs.length
  if (done) {
    const all = score === quiz.qs.length
    return (
      <>
        <div className="pr-bar"><button className="btn-ghost sh-small" onClick={() => setQuiz(null)}>← Quizzes</button><b>{quiz.emoji} {quiz.title}</b>{toggle}</div>
        <div className="pr-result"><div className="pr-big">{all ? '🏆' : '🎉'}</div><h2>You got {score} of {quiz.qs.length}!</h2>
          <p>{all ? 'Perfect score. You are ready to explain synthesizers to everyone.' : 'Nice work. Try again, or go back to the slides to find the answers.'}</p>
          <button className="sh-play" onClick={reset}>↻ Again</button></div>
      </>
    )
  }
  const q = quiz.qs[i]
  const answer = (k: number) => { if (picked !== null) return; setPicked(k); if (k === q.a) setScore((s) => s + 1) }
  return (
    <>
      <div className="pr-bar"><button className="btn-ghost sh-small" onClick={() => setQuiz(null)}>← Quizzes</button><b>{quiz.emoji} {quiz.title}</b><span className="pr-count">Question {i + 1} of {quiz.qs.length}</span>{toggle}</div>
      <div className="pr-slide quizq">
        <div className="pr-text">
          <h2>{q.q}</h2>
          <div className="pr-opts" role="group" aria-label="Answers">
            {q.o.map((o, k) => (
              <button key={k} className={'sh-opt' + (picked !== null ? (k === q.a ? ' right' : k === picked ? ' wrong' : '') : '')} disabled={picked !== null} onClick={() => answer(k)}>{o}</button>
            ))}
          </div>
          {picked !== null && (
            <div className="pr-why" role="status">
              <p className="pr-kid">{picked === q.a ? '✅ ' : '👉 '}{q.kid}</p>
              {tech && <p className="pr-techline">🔬 {q.tech}</p>}
              <button className="sh-play" onClick={() => { setI(i + 1); setPicked(null) }}>{i + 1 < quiz.qs.length ? 'Next ▶' : 'See my score'}</button>
            </div>
          )}
        </div>
        {q.pic && <div className="pr-pics"><figure className="pr-fig"><img src={picUrl(q.pic)} alt={PICS[q.pic].alt} /><figcaption>Photo: {PICS[q.pic].by} · <a href={PICS[q.pic].page} target="_blank" rel="noreferrer noopener">{PICS[q.pic].license}</a></figcaption></figure></div>}
      </div>
    </>
  )
}
