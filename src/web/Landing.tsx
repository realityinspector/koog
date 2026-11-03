import '../ui/tokens.css'
import './landing.css'
import koogLogo from '../assets/koog-logo.svg'
import heroShot from './img/01-play.jpg'
import vibesShot from './img/02-vibes.jpg'
import learnShot from './img/03-learn.jpg'
import gameShot from './img/06-bachdoom.jpg'
import historyShot from './img/07-history.jpg'
import teacherShot from './img/08-teacher-demo.jpg'
import { Icon } from '../ui/Icon'
import { GITHUB_URL } from './webDemo'

const PLAY = './?play'
const TEACHER = './teacher/'

// The three things Koog is (the "who" line is the tagline; the card says what it means in practice)
const BENEFITS: { icon: string; who: string; title: string; text: string }[] = [
  { icon: 'spark', who: 'The emotionally aware synth', title: 'It hears the feeling', text: 'Chords become moods: minor sounds sad, major sounds happy, and the Vibes face shows it. Kids learn why music makes you feel something, and how to make it spooky or bright on purpose.' },
  { icon: 'sheet', who: 'The curriculum aware synth', title: 'It knows what to teach next', text: 'Keys, chords, cadences, motifs, rhythm and reading music, in order. Songs climb a 7-step phrase ladder, and phrases a kid hasn\'t practised come back for review.' },
  { icon: 'bulb', who: 'The superintelligent synth', title: 'It listens to every note', text: 'Key, chord, rhythm, melody shape and mood, all at once. It names the idea in a split second ("Cadence!", "Motif!") and even spots a tune played in a new key.' },
]

const FEATURES: { icon: string; title: string; text: string; img?: string; alt?: string }[] = [
  { icon: 'burst', title: 'Visuals that react to good playing', text: 'In-key notes burst gold, steady rhythm flies straight, and chords turn into moods: minor looks sad, major looks happy.', img: vibesShot, alt: 'Koog showing a sad face for an A minor chord' },
  { icon: 'sheet', title: 'Learn songs phrase by phrase', text: 'Real pieces cut into 2–3 note phrases on a 7-rung ladder: listen, follow the lit keys, echo, then play from memory.', img: learnShot, alt: 'The Learn it phrase ladder for Ode to Joy' },
  { icon: 'game', title: 'Interactive games through classical music', text: 'Blast demons by playing Bach and Beethoven, echo a sparring partner, or strut a runway through six eras of music. Only correct, in-time notes score, so winning means playing the piece.', img: gameShot, alt: 'A retro pixel-art game where each enemy is a note' },
  { icon: 'knobs', title: 'A playable history of the synth', text: 'Play emulations of electronic instruments from the 1920 theremin to the 1980s, each linked to a classical piece.', img: historyShot, alt: 'A timeline of playable historic synthesizers' },
  { icon: 'note', title: 'It listens, then names the music', text: 'End a phrase on the home note and Koog says "Cadence!". Repeat a pattern and it says "Motif!". Free play turns into music words.' },
  { icon: 'trophy', title: 'Challenges, beats and sheet music', text: '15 challenges with badges, 8 original drum grooves, and a grand staff that follows along and writes down what you play.' },
]

const STEPS: [string, string][] = [
  ['Play', 'Any key, any way. The computer keyboard works too.'],
  ['Koog listens', 'Key, chord, rhythm, melody shape and mood.'],
  ['It names the idea', '"Cadence!", "Motif!", "Tension, then release!"'],
  ['It rewards it', 'Bigger fireworks, game power-ups, stars and kind tips.'],
]

/** The web demo's front door: brand, hero, benefits, features, the teacher demo, and a nudge to run Koog locally. */
export function Landing() {
  return (
    <div className="ld">
      <nav className="ld-nav" aria-label="Koog">
        <a className="ld-nav-logo" href="./" aria-label="Koog home"><img src={koogLogo} alt="Koog" width="104" height="33" /></a>
        <div className="ld-nav-links">
          <a href="#features">Features</a>
          <a href="#teachers">For teachers</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a className="ld-btn sm" href={PLAY}>Play now</a>
        </div>
      </nav>

      <header className="ld-hero">
        <div className="ld-hero-copy">
          <p className="ld-kicker">Emotionally aware · Curriculum aware · Superintelligent</p>
          <h1>KOOG is the <span className="ld-grad">Koding Synth for Kids.</span></h1>
          <p className="ld-sub">We make interactive games through classical music. Koog listens as kids play, names what they just did in kid language, and turns free play into music lessons. Free and open source.</p>
          <div className="ld-ctas">
            <a className="ld-btn" href={PLAY}><Icon name="keys" size={18} /> Play in your browser</a>
            <a className="ld-btn ghost" href={TEACHER}><Icon name="user" size={18} /> Teacher demo</a>
          </div>
          <p className="ld-fine">Or sit back: <a className="ld-inline" href="./#/gallery">watch the self-playing gallery →</a> (every feature, about 18 minutes, with music).</p>
          <p className="ld-fine">No sign-up, no ads, no tracking. Ages about 6–13.</p>
        </div>
        <figure className="ld-hero-art">
          <div className="ld-glow" aria-hidden />
          <img src={heroShot} width="1100" height="688" alt="Koog's main screen: fireworks on the display, the key and chord readouts, and a glowing keyboard" />
        </figure>
      </header>

      <section className="ld-benefits" aria-label="What Koog is">
        {BENEFITS.map((b) => (
          <article key={b.who} className="ld-benefit">
            <span className="ld-ic"><Icon name={b.icon} size={22} /></span>
            <p className="ld-who">{b.who}</p>
            <h3>{b.title}</h3>
            <p>{b.text}</p>
          </article>
        ))}
      </section>

      <section className="ld-steps" aria-labelledby="how">
        <h2 id="how" className="ld-h2">How Koog teaches</h2>
        <ol>{STEPS.map(([t, d], i) => <li key={t}><i>{i + 1}</i><b>{t}</b><span>{d}</span></li>)}</ol>
      </section>

      <section id="features" className="ld-features" aria-labelledby="feat">
        <h2 id="feat" className="ld-h2">Everything in the box</h2>
        <p className="ld-h2-sub">One instrument with a big display, a rail of modes and a glowing keybed.</p>
        <div className="ld-feat-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className={'ld-feat' + (f.img ? ' has-img' : '')}>
              {f.img && <img src={f.img} alt={f.alt} loading="lazy" width="720" height="450" />}
              <div className="ld-feat-tx">
                <span className="ld-ic"><Icon name={f.icon} size={20} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="teachers" className="ld-teacher" aria-labelledby="tch">
        <div className="ld-teacher-copy">
          <p className="ld-kicker">Teacher demo</p>
          <h2 id="tch">Show a class what Koog is doing</h2>
          <p>A drawing of a student at a little keyboard, plugged into a laptop that faces the room. The laptop screen is the real Koog, running live. Numbered labels explain each key press, the message on the cable, what Koog hears, and what the student is learning.</p>
          <a className="ld-btn" href={TEACHER}>Open the teacher demo →</a>
          <p className="ld-fine">Then press <b>Start full screen</b>. Best on a projector.</p>
        </div>
        <img src={teacherShot} loading="lazy" width="1100" height="688" alt="The teacher demo: a drawn student plays a red keyboard plugged into a laptop showing Koog live, with numbered labels" />
      </section>

      <section className="ld-local" aria-labelledby="local">
        <div>
          <h2 id="local">Runs best on your own computer</h2>
          <p>This web demo uses the computer keyboard only. Run Koog locally and it works with USB-MIDI keyboards, foot pedals and controllers, keeps progress for each kid, and has the Idea box for requests.</p>
          <p><code>npm install &amp;&amp; npm start</code></p>
        </div>
        <a className="ld-btn" href={GITHUB_URL} target="_blank" rel="noreferrer">Get it on GitHub</a>
      </section>

      <footer className="ld-foot">
        <img src={koogLogo} alt="" width="78" height="25" />
        <p>Free and open source (MIT). Volume is capped, visuals stay at 3 flashes a second or fewer and follow "reduce motion", and every song is public domain or written for Koog.</p>
        <p><a href={GITHUB_URL} target="_blank" rel="noreferrer">Source on GitHub</a> · <a href={PLAY}>Play</a> · <a href={TEACHER}>Teacher demo</a></p>
      </footer>
    </div>
  )
}
