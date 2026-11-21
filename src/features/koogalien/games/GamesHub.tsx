// The Koogalien Games tab: four small games built for learning Koogalien. They all share the same Koogalien progress,
// so a word learned in any game counts in every game (and in the Echo Game and the Dictionary).
import { Suspense, lazy, useState } from 'react'
import type { KoogalienHost } from '../../../koogalien/ports'
import { Mascot } from '../learn/Mascot'
import { currentUnit, isLearned } from '../../../koogalien/learn/ladder'
import { due } from '../../../koogalien/learn/srs'
import { useGamesSave, useProgress } from './hooks'
import './games.css'
import '../learn/learn.css'

const AlienSays = lazy(() => import('./AlienSays'))
const SpellStation = lazy(() => import('./SpellStation'))
const ChatGame = lazy(() => import('./ChatGame'))
const WordRocket = lazy(() => import('./WordRocket'))

type GameId = 'says' | 'spell' | 'chat' | 'rocket'
const GAMES: { id: GameId; icon: string; name: string; units: string; blurb: string }[] = [
  { id: 'says', icon: '🛸', name: 'Alien Says', units: 'Units 1 to 3', blurb: 'Hear a word, pick its picture, play it back. Streaks charge the UFO.' },
  { id: 'spell', icon: '🔤', name: 'Spell Station', units: 'Unit 6', blurb: 'Spell KOOG, your name, pets and friends to dock the ship.' },
  { id: 'chat', icon: '💬', name: 'Chat with a Koogalien', units: 'Units 4 and 5', blurb: 'Answer a Koogalien question with a sentence. It answers back.' },
  { id: 'rocket', icon: '🚀', name: 'Word Rocket', units: 'Review and speed', blurb: 'Zap falling words with their chords. Calm by default.' },
]

export default function GamesHub({ host }: { host: KoogalienHost }) {
  const [game, setGame] = useState<GameId | null>(null)
  const { prog } = useProgress(host)
  const { save } = useGamesSave(host)
  if (game) {
    const back = () => setGame(null)
    return (
      <Suspense fallback={<p className="kgx-soon">Loading...</p>}>
        {game === 'says' ? <AlienSays host={host} onBack={back} /> : game === 'spell' ? <SpellStation host={host} onBack={back} /> : game === 'chat' ? <ChatGame host={host} onBack={back} /> : <WordRocket host={host} onBack={back} />}
      </Suspense>
    )
  }
  const p = prog.current
  const learned = Object.values(p.words).filter(isLearned).length
  const dueNow = due(p.cards, Date.now(), 99).length
  return (
    <section className="kgl kgg" aria-label="Koogalien games">
      <div className="kgl-stage">
        <Mascot pose="wave" size={150} say="Pick a game! Words you miss come back to practise." />
        <div className="kgl-prompt">
          <h2>🎮 Koogalien Games</h2>
          <p className="kgl-coach">Unit {currentUnit(p.words)} · {learned} words learned · {dueNow} ready to review · {p.stars} stars</p>
          <div className="kgg-menu" role="group" aria-label="Games">
            {GAMES.map((g) => (
              <button key={g.id} type="button" className={'kgg-gamecard' + (save.current.last === g.id ? ' last' : '')} onClick={() => setGame(g.id)}>
                <span className="e" aria-hidden>{g.icon}</span>
                <b>{g.name}</b>
                <small>{g.units}</small>
                <span>{g.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
