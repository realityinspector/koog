import { useState, type FormEvent } from 'react'
import '../ui/tokens.css'
import './landing.css'
import koogLogo from '../assets/koog-logo.svg'
import { Icon } from '../ui/Icon'
import { GITHUB_URL, isUnlocked, lock, tryUnlock } from './webDemo'

/** The web demo's front door: a demo-code gate, then two doors (play, teacher demo), and a nudge to run Koog locally. */
export function Landing() {
  const [open, setOpen] = useState(isUnlocked())
  const [code, setCode] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    const ok = await tryUnlock(code)
    setBusy(false)
    setBad(!ok)
    if (ok) { setOpen(true); setCode('') }
  }

  return (
    <main className="ld">
      <header className="ld-head">
        <img className="ld-logo" src={koogLogo} alt="Koog" width="208" height="66" />
        <p className="ld-pitch">A smart synth that teaches kids music while they play. Free and open source.</p>
      </header>

      {open ? (
        <section className="ld-cards" aria-label="Choose a demo">
          <a className="ld-card" href="./?play">
            <Icon name="keys" size={28} />
            <h2>Play Koog in your browser</h2>
            <p>Computer keyboard only.</p>
          </a>
          <a className="ld-card" href="./teacher/">
            <Icon name="user" size={28} />
            <h2>Teacher demo</h2>
            <p>An illustrated view of a student at a keyboard, with live labels showing what Koog does and what the student is learning.</p>
          </a>
        </section>
      ) : (
        <form className="ld-gate" onSubmit={submit}>
          <label htmlFor="ld-code"><Icon name="lock" size={16} /> Enter the demo code</label>
          <div className="ld-row">
            <input id="ld-code" type="text" value={code} autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-invalid={bad} onChange={(e) => { setCode(e.target.value); setBad(false) }} />
            <button type="submit" disabled={busy}>Enter</button>
          </div>
          <p className="ld-bad" role="status">{bad ? "That code didn't work. Check it and try again." : ''}</p>
        </form>
      )}

      <section className="ld-local">
        <h2>Runs best on your own computer</h2>
        <p>Run locally, Koog works with USB-MIDI keyboards, foot pedals and controllers, keeps progress for each kid, and has the Idea box for requests.</p>
        <p><code>npm install &amp;&amp; npm start</code></p>
        <a className="ld-gh" href={GITHUB_URL} target="_blank" rel="noreferrer">Get it on GitHub</a>
      </section>

      <footer className="ld-small">
        <span>This web demo supports the computer keyboard only.</span>
        {open && <button type="button" className="ld-link" onClick={() => { lock(); location.reload() }}>lock again</button>}
      </footer>
    </main>
  )
}
