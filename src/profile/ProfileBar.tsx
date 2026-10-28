import { useRef, useState } from 'react'
import { checkCode, isGuest, useProfile } from './profile'
import './profile.css'

const HOLD_MS = 1200

/** Top strip: who's playing + Kid / Dad mode switch. */
export function ProfileBar() {
  const { active, mode, setMode, signOut } = useProfile()
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Dad mode needs a 1.2 s press-and-hold: a speed bump for little hands, not a lock.
  const startHold = () => {
    setHolding(true)
    timer.current = window.setTimeout(() => { setHolding(false); setMode('dad') }, HOLD_MS)
  }
  const stopHold = () => { setHolding(false); window.clearTimeout(timer.current) }

  return (
    <div className={`pf-bar pf-${mode}`}>
      <span className="pf-who">
        {isGuest(active) ? '👋 Guest' : <>🎹 <b>{active}</b></>}
        {!isGuest(active) && <button className="pf-link" onClick={signOut}>switch player</button>}
      </span>
      <span className="pf-mode">
        {mode === 'dad' ? (
          <>
            <span className="pf-tag">🛠️ Dad mode: dev tools showing</span>
            <button onClick={() => setMode('kid')}>Back to Kid mode</button>
          </>
        ) : (
          <button
            className={`pf-hold ${holding ? 'on' : ''}`}
            style={{ ['--hold' as string]: `${HOLD_MS}ms` }}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            title="Press and hold"
          >
            Dad mode (hold)
          </button>
        )}
      </span>
    </div>
  )
}

/** Shown while nobody is signed in. Kids tap their word, or make one. */
export function WhoIsPlaying() {
  const { active, profiles, hasLegacy, signIn, create } = useProfile()
  const [code, setCode] = useState('')
  const [claim, setClaim] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  if (!isGuest(active) || hidden) return null

  const typedExisting = profiles.includes(code.trim().toLowerCase())
  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (typedExisting) return signIn(code)
    setErr(create(code, hasLegacy && claim))
  }
  const live = code ? (typedExisting ? null : checkCode(code, profiles)) : null

  return (
    <section className="pf-who-card">
      <h2>Who's playing?</h2>
      {profiles.length > 0 && (
        <div className="pf-chips">
          {profiles.map((p) => <button key={p} onClick={() => signIn(p)}>{p}</button>)}
        </div>
      )}
      <form onSubmit={submit} className="pf-new">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\s/g, '')); setErr(null) }}
          placeholder={profiles.length ? 'or type a new code word' : 'Pick a code word: your name, a nickname, a letter'}
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
        />
        <button disabled={!code || !!live}>{typedExisting ? 'Sign in' : 'Start'}</button>
      </form>
      {(err || live) && <div className="pf-err">{err || live}</div>}
      {hasLegacy && !typedExisting && (
        <label className="pf-claim">
          <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
          Bring the badges and high scores already saved on this computer
        </label>
      )}
      <p className="pf-note">Your code word keeps your badges and scores separate from your brother's or sister's. It's not a password, so pick something easy.</p>
      <button className="pf-link" onClick={() => setHidden(true)}>Just play as a guest</button>
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
