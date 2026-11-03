import { isEmbed } from '../web/webDemo'
import { useEffect, useRef, useState } from 'react'
import { checkCode, isGuest, psave, useProfile } from './profile'
import './profile.css'
import { Icon } from '../ui/Icon'

const HOLD_MS = 1200

/** Top strip: who's playing + Kid / Dad mode switch. */
export function ProfileBar() {
  const { active, mode, setMode, signOut } = useProfile()
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // remember when each player last played, so "Who's playing?" can show it
  useEffect(() => {
    if (isGuest(active)) return
    const stamp = () => psave('lastPlayed', Date.now())
    stamp()
    const t = window.setInterval(stamp, 60000)
    return () => { window.clearInterval(t); stamp() }
  }, [active])

  // Dad mode needs a 1.2 s press-and-hold: a speed bump for little hands, not a lock.
  const startHold = () => {
    setHolding(true)
    timer.current = window.setTimeout(() => { setHolding(false); setMode('dad') }, HOLD_MS)
  }
  const stopHold = () => { setHolding(false); window.clearTimeout(timer.current) }
  // Keyboard: hold Enter or Space for the same 1.2 s.
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (!e.repeat && !holding) startHold()
  }
  const keyUp = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') stopHold() }

  return (
    <div className={`pf-bar pf-${mode}`}>
      <span className="pf-who">
        {isGuest(active) ? <><Icon name="user" size={16} /> <b>Guest</b></> : <><Icon name="user" size={16} /> <b>{active}</b></>}
        {!isGuest(active) && <button className="pf-switch" onClick={signOut} title="Pick a different player">switch player</button>}
      </span>
      <span className="pf-mode">
        {mode === 'dad' ? (
          <>
            <span className="pf-tag">🛠️ Boss mode</span>
            <button onClick={() => setMode('kid')}>Back to Kid mode</button>
          </>
        ) : (
          <button
            className={`pf-hold ${holding ? 'on' : ''}`}
            style={{ ['--hold' as string]: `${HOLD_MS}ms` }}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onKeyDown={keyDown}
            onKeyUp={keyUp}
            onBlur={stopHold}
            aria-label="Switch to Boss mode — hold for a second"
            title="Grown-ups: hold for Boss mode"
          >
            {/* visible progress ring while holding */}
            <svg className="pf-ring" width="26" height="26" viewBox="0 0 20 20" aria-hidden>
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
              <circle cx="10" cy="10" r="8" fill="none" stroke="#ffb86c" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 10 10)"
                strokeDasharray="50.3" strokeDashoffset={holding ? 0 : 50.3}
                style={{ transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : 'none' }} />
            </svg>
            <span className="pf-lock" aria-hidden><Icon name="lock" size={14} /></span>
          </button>
        )}
      </span>
    </div>
  )
}

const EMOJIS = ['🦊', '🐯', '🐙', '🦄', '🐸', '🚀', '🎸', '🦖', '🐼', '🌈', '🐬', '🦉']
const COLORS = ['#7c5cff', '#ff5da2', '#35d4e8', '#ffb43c', '#3ddc84', '#ff6a3c']
const hashOf = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const read = <T,>(code: string, name: string, d: T): T => {
  try { const v = localStorage.getItem(`koog.p.${code}.${name}`); return v ? (JSON.parse(v) as T) : d } catch { return d }
}
function ago(t: number | null): string {
  if (!t) return 'New here'
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}
const tileInfo = (code: string) => ({
  emoji: EMOJIS[hashOf(code) % EMOJIS.length],
  color: COLORS[(hashOf(code) >> 3) % COLORS.length],
  last: read<number | null>(code, 'lastPlayed', null),
  badges: Object.keys(read<Record<string, number>>(code, 'challenges.badges', {})).length,
})

/** Shown while nobody is signed in. Kids tap their tile, or make a new one. */
export function WhoIsPlaying() {
  const { active, profiles, hasLegacy, signIn, create } = useProfile()
  const [code, setCode] = useState('')
  const [claim, setClaim] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  // a link that names a screen opens it as a guest: the picker must not cover it
  const [hidden, setHidden] = useState(() => location.hash.startsWith('#/'))
  const [adding, setAdding] = useState(false)
  if (!isGuest(active) || hidden || isEmbed()) return null

  const showForm = adding || profiles.length === 0
  const typedExisting = profiles.includes(code.trim().toLowerCase())
  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (typedExisting) return signIn(code)
    setErr(create(code, hasLegacy && claim))
  }
  const live = code ? (typedExisting ? null : checkCode(code, profiles)) : null

  return (
    <section className="pf-who-card" aria-label="Who's playing?">
      <h2>Who's playing?</h2>
      <div className="pf-tiles">
        {profiles.map((p) => {
          const t = tileInfo(p)
          return (
            <button key={p} className="pf-tile" style={{ ['--tc' as string]: t.color }} onClick={() => signIn(p)}>
              <span className="pf-av" aria-hidden>{t.emoji}</span>
              <b>{p}</b>
              <small>{ago(t.last)}</small>
              <small className="pf-bd">🏅 {t.badges} {t.badges === 1 ? 'badge' : 'badges'}</small>
            </button>
          )
        })}
        {!showForm && (
          <button className="pf-tile pf-add" onClick={() => setAdding(true)}>
            <span className="pf-av" aria-hidden>＋</span>
            <b>New player</b>
          </button>
        )}
      </div>
      {showForm && (
        <form onSubmit={submit} className="pf-new">
          <input
            autoFocus={adding}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\s/g, '')); setErr(null) }}
            placeholder="Your name or nickname"
            aria-label="Your name or nickname"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />
          <button disabled={!code || !!live}>{typedExisting ? 'Sign in' : 'Start'}</button>
        </form>
      )}
      {(err || live) && <div className="pf-err">{err || live}</div>}
      {showForm && hasLegacy && !typedExisting && (
        <label className="pf-claim">
          <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
          Bring the badges and high scores already saved on this computer
        </label>
      )}
      <button className="pf-guest" onClick={() => setHidden(true)}>Just play</button>
      <p className="pf-note">Your name keeps your badges and scores separate from your brother's or sister's. It's not a password, so pick something easy.</p>
    </section>
  )
}

/** Dad mode: see and remove kids' profiles. */
export function ProfileManager() {
  const { profiles, active, signIn, remove } = useProfile()
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <section className="pf-manage">
      <h2>Players</h2>
      {profiles.length === 0 && <p className="pf-note">No players yet. Kids make one from "Who's playing?".</p>}
      <ul>
        {profiles.map((p) => (
          <li key={p}>
            <b>{p}</b>{p === active && ' (playing now)'}
            {p !== active && <button onClick={() => signIn(p)}>Switch to</button>}
            {confirm === p ? (
              <>
                <span className="pf-err"> Remove {p} from the list? (their saved data stays in the browser)</span>
                <button onClick={() => { remove(p); setConfirm(null) }}>Yes, remove</button>
                <button onClick={() => setConfirm(null)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirm(p)}>Remove…</button>
            )}
          </li>
        ))}
      </ul>
      <p className="pf-note">Profiles keep siblings apart on this computer. They are not security: everything stays in this browser's localStorage under koog.p.&lt;word&gt;.</p>
    </section>
  )
}
