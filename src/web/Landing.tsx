import '../ui/tokens.css'
import './landing.css'
import koogLogo from '../assets/koog-logo.svg'
import { Icon } from '../ui/Icon'
import { GITHUB_URL } from './webDemo'

/** The web demo's front door: two doors (play, teacher demo), and a nudge to run Koog locally. */
export function Landing() {
  return (
    <main className="ld">
      <header className="ld-head">
        <img className="ld-logo" src={koogLogo} alt="Koog" width="208" height="66" />
        <p className="ld-pitch">A smart synth that teaches kids music while they play. Free and open source.</p>
      </header>

        <section className="ld-cards" aria-label="Choose a demo">
          <a className="ld-card" href="./?play">
            <Icon name="keys" size={28} />
            <h2>Play Koog in your browser</h2>
            <p>Play with the computer keyboard (Z X C V…) or click the keys on screen.</p>
            <span className="ld-go">Start playing →</span>
          </a>
          <a className="ld-card" href="./teacher/">
            <Icon name="user" size={28} />
            <h2>Teacher demo</h2>
            <p>For a projector: a drawing of a student at a keyboard and a laptop running Koog live, with labels that explain what Koog does and what the student is learning.</p>
            <span className="ld-go">Open the teacher demo →</span>
            <em className="ld-go-note">Then press <b>Start full screen</b>.</em>
          </a>
        </section>

      <section className="ld-local">
        <h2>Runs best on your own computer</h2>
        <p>Run locally, Koog works with USB-MIDI keyboards, foot pedals and controllers, keeps progress for each kid, and has the Idea box for requests.</p>
        <p><code>npm install &amp;&amp; npm start</code></p>
        <a className="ld-gh" href={GITHUB_URL} target="_blank" rel="noreferrer">Get it on GitHub</a>
      </section>

      <footer className="ld-small">
        <span>This web demo supports the computer keyboard only.</span>
      </footer>
    </main>
  )
}
