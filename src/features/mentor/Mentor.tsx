import { useEffect } from 'react'
import { closeReel, showReel, useMentor, useMentorLine } from './mentorStore'
import './mentor.css'

/** The original Mentor character: a retro-futurist synth robot in a front-row seat (chrome dome, CRT visor,
 *  LED eyes, a sine-wave mouth, tuning-knob ears, a keyboard and patch cable on its chest). State comes from
 *  mentorStore; CSS does the acting. Class names (mn-wing = arms, mn-beak = mouth) are shared with mentor.css. */
function Robot({ mood }: { mood: string }) {
  return (
    <svg className={'mn-bot m-' + mood} viewBox="0 0 64 72" width="56" height="63" aria-hidden="true">
      <defs>
        <linearGradient id="mnChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f7ff" /><stop offset=".45" stopColor="#b9c3dc" /><stop offset=".55" stopColor="#8e98b8" /><stop offset="1" stopColor="#c9d1e8" /></linearGradient>
        <linearGradient id="mnVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#123048" /><stop offset="1" stopColor="#06121f" /></linearGradient>
      </defs>
      <rect x="6" y="40" width="52" height="28" rx="10" fill="#3b2a6e" />
      <g className="mn-body">
        <rect x="16" y="40" width="32" height="25" rx="8" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" />
        <rect x="20" y="45" width="24" height="9" rx="2" fill="#1a1430" />
        <path d="M22.5 46.5v6M25.5 46.5v6M28.5 46.5v6M31.5 46.5v6M34.5 46.5v6M37.5 46.5v6M40.5 46.5v6" stroke="#e8ecff" strokeWidth="2.2" />
        <path d="M24 46.5v3.4M27 46.5v3.4M33 46.5v3.4M36 46.5v3.4M39 46.5v3.4" stroke="#1a1430" strokeWidth="1.4" />
        <circle cx="24" cy="59" r="2" fill="#1a1430" stroke="#f5c96b" strokeWidth="1" /><circle cx="32" cy="59" r="2" fill="#1a1430" stroke="#f5c96b" strokeWidth="1" />
        <circle className="mn-led" cx="40" cy="59" r="1.8" fill="#ff5da2" />
        <path d="M24 59c-4 5 4 9 8 0" fill="none" stroke="#ff5da2" strokeWidth="1.6" strokeLinecap="round" />
        <g className="mn-wing mn-wl"><rect x="8" y="42" width="7" height="17" rx="3.5" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" /><circle cx="11.5" cy="60" r="3" fill="#8e98b8" /></g>
        <g className="mn-wing mn-wr"><rect x="49" y="42" width="7" height="17" rx="3.5" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" /><circle cx="52.5" cy="60" r="3" fill="#8e98b8" /></g>
        <g className="mn-head">
          <rect x="28" y="34" width="8" height="7" rx="1.5" fill="#8e98b8" />
          <path d="M32 13V5" stroke="#b9c3dc" strokeWidth="1.8" />
          <circle className="mn-ant" cx="32" cy="4" r="2.8" fill="#5fffd0" />
          <circle cx="10" cy="25" r="4.2" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" /><path d="M10 25l-1.8-2.6" stroke="#1a1430" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="54" cy="25" r="4.2" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" /><path d="M54 25l1.8-2.6" stroke="#1a1430" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="12" y="12" width="40" height="25" rx="10" fill="url(#mnChrome)" stroke="#5d6788" strokeWidth="1" />
          <path d="M17 15.5h30" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
          <rect x="16" y="17" width="32" height="16" rx="6" fill="url(#mnVisor)" stroke="#5fffd0" strokeWidth="1" strokeOpacity=".55" />
          <g className="mn-eyes">
            <circle cx="25" cy="23.5" r="3.6" fill="#5fffd0" opacity=".28" /><circle cx="39" cy="23.5" r="3.6" fill="#5fffd0" opacity=".28" />
            <circle className="mn-pupil" cx="25" cy="23.5" r="2.2" fill="#bfffee" /><circle className="mn-pupil" cx="39" cy="23.5" r="2.2" fill="#bfffee" />
          </g>
          <path className="mn-beak" d="M22 29.5q2.5-2.6 5 0t5 0t5 0t5 0" fill="none" stroke="#5fffd0" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

/** Mentor mode: the synth robot, its speech bubble (a coach-bus line with source 'mentor'), floating move labels, and the highlights reel. */
export function Mentor({ tech = false }: { tech?: boolean }) {
  const on = useMentor((s) => s.on)
  const mood = useMentor((s) => s.mood)
  const moodN = useMentor((s) => s.moodN)
  const labels = useMentor((s) => s.labels)
  const reel = useMentor((s) => s.reel)
  const line = useMentorLine()
  useEffect(() => { useMentor.setState({ tech }); return () => useMentor.setState({ tech: false }) }, [tech])
  // kid PLAY: the entry switch lives in the ✨ Modes launcher; the chip stays only for the Boss (tech) audience
  if (!on) return tech ? <div className="mn mn-tech"><MentorChip /></div> : null
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
      {line && !reel && <div key={'line-' + line.id} className={'mn-bubble mn-' + (line.tone ?? 'praise')} role="status">{line.text}</div>}
      <button className="mn-off" aria-label="Turn Mentor off" title="Mentor is on. Tap to turn off" onClick={() => useMentor.getState().setOn(false)}>✕</button>
      <button key={'seat-' + moodN} className="mn-seat" onClick={() => (reel ? closeReel() : showReel(true))} title="Your Mentor is listening. Tap for the highlights" aria-label="Mentor: show highlights">
        <Robot mood={mood} />
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
