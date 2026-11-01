import { useEffect } from 'react'
import { closeReel, showReel, useMentor, useMentorLine } from './mentorStore'
import './mentor.css'

/** The original Mentor character: an owl in a front-row seat, with headphones. State comes from mentorStore (CSS does the acting). */
function Owl({ mood }: { mood: string }) {
  return (
    <svg className={'mn-owl m-' + mood} viewBox="0 0 64 72" width="56" height="63" aria-hidden="true">
      <rect x="6" y="38" width="52" height="30" rx="10" fill="#3b2a6e" />
      <g className="mn-body">
        <ellipse cx="32" cy="44" rx="19" ry="21" fill="#8b6bd6" />
        <ellipse cx="32" cy="50" rx="11" ry="13" fill="#e7dcff" />
        <path d="M22 54h20M24 59h16" stroke="#b9a4ee" strokeWidth="1.5" strokeLinecap="round" />
        <g className="mn-wing mn-wl"><ellipse cx="14" cy="47" rx="6" ry="13" fill="#6f4fc0" /></g>
        <g className="mn-wing mn-wr"><ellipse cx="50" cy="47" rx="6" ry="13" fill="#6f4fc0" /></g>
        <g className="mn-head">
          <path d="M16 18l5 10M48 18l-5 10" stroke="#8b6bd6" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="32" cy="29" rx="18" ry="15" fill="#9b7de6" />
          <g className="mn-eyes">
            <circle cx="24" cy="28" r="7.5" fill="#fff" /><circle cx="40" cy="28" r="7.5" fill="#fff" />
            <circle className="mn-pupil" cx="24" cy="29" r="3.4" fill="#1b1030" /><circle className="mn-pupil" cx="40" cy="29" r="3.4" fill="#1b1030" />
            <circle cx="25.3" cy="27.6" r="1.1" fill="#fff" /><circle cx="41.3" cy="27.6" r="1.1" fill="#fff" />
          </g>
          <path className="mn-beak" d="M29 34l3 6 3-6z" fill="#ffb347" />
          <path d="M12 26a20 18 0 0 1 40 0" fill="none" stroke="#ff5da2" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="8" y="24" width="6" height="11" rx="3" fill="#ff5da2" /><rect x="50" y="24" width="6" height="11" rx="3" fill="#ff5da2" />
        </g>
      </g>
    </svg>
  )
}

/** Mentor mode: the owl, its speech bubble (a coach-bus line with source 'mentor'), floating move labels, and the highlights reel. */
export function Mentor({ tech = false }: { tech?: boolean }) {
  const on = useMentor((s) => s.on)
  const mood = useMentor((s) => s.mood)
  const moodN = useMentor((s) => s.moodN)
  const labels = useMentor((s) => s.labels)
  const reel = useMentor((s) => s.reel)
  const line = useMentorLine()
  useEffect(() => { useMentor.setState({ tech }); return () => useMentor.setState({ tech: false }) }, [tech])
  if (!on) return <div className={'mn' + (tech ? ' mn-tech' : '')}><MentorChip /></div>
  return (
    <div className={'mn' + (tech ? ' mn-tech' : '')}>
      <div className="mn-labels" aria-live="off">
        {labels.map((l, i) => <div key={l.id} className={'mn-label mn-k-' + l.kind} style={{ ['--i' as string]: i }}>{l.text}</div>)}
      </div>
      {reel && (
        <div className="mn-reel" role="dialog" aria-label="Highlights reel">
          <div className="mn-reel-h">🎬 Highlights <button className="mn-x" aria-label="Close highlights" onClick={closeReel}>✕</button></div>
          <ol>{reel.items.map((r, i) => <li key={i}><b>{r.t}</b> {r.text}</li>)}</ol>
          {reel.note && <div className="mn-reel-n">{reel.note}</div>}
        </div>
      )}
      {line && !reel && <div key={line.id} className={'mn-bubble mn-' + (line.tone ?? 'praise')} role="status">{line.text}</div>}
      <button className="mn-off" aria-label="Turn Mentor off" title="Mentor is on. Tap to turn off" onClick={() => useMentor.getState().setOn(false)}>✕</button>
      <button key={moodN} className="mn-seat" onClick={() => (reel ? closeReel() : showReel(true))} title="Your Mentor is listening. Tap for the highlights" aria-label="Mentor: show highlights">
        <Owl mood={mood} />
      </button>
    </div>
  )
}

/** The discoverable chip (shown at the bottom-left of the display while Mentor is off). */
function MentorChip() {
  const on = useMentor((s) => s.on)
  return (
    <button className={'mn-chip mn-ghost' + (on ? ' on' : '')} aria-pressed={on} title={on ? 'Mentor is listening. Tap to turn off' : 'Turn on the Mentor: an audience that cheers, names your moves and gives tips'} onClick={() => useMentor.getState().setOn(!on)}>
      <span aria-hidden>🎓</span> <span>Mentor</span>
    </button>
  )
}
