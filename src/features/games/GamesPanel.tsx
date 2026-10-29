import { useEffect, useState } from 'react'
import { useScreen } from '../../layout/screenStore'
import { clearGuide } from '../../music/guide'
import { ZombieLanes } from './zombielanes/ZombieLanes'
import { BachDoom } from './bachdoom/BachDoom'
import { JiuJitsu } from './jiujitsu/JiuJitsu'
import { Fashion } from './fashion/Fashion'
import './games.css'

type GameId = 'zombies' | 'bachdoom' | 'jiujitsu' | 'fashion'
const GAMES: { id: GameId; icon: string; title: string; blurb: string; skill: string }[] = [
  { id: 'zombies', icon: '🧟', title: 'Zombie Lanes', blurb: 'Zombies march down the lanes toward your keys. Play the note on the zombie to blast it.', skill: 'Learn where every note lives' },
  { id: 'jiujitsu', icon: '🥋', title: 'Jiu-Jitsu Flow', blurb: 'Roll on the mats. Answer your partner\'s moves with the right notes, keep the flow, and earn your belts.', skill: 'Rhythm, call and response' },
  { id: 'fashion', icon: '👗', title: 'Runway Remix', blurb: 'Style a model through the eras of music, then play the era\'s piece on the beat so they strut the runway.', skill: 'Musical eras and style' },
  { id: 'bachdoom', icon: '💀', title: 'BachDoom', blurb: 'Dissonant demons invade the cathedral. Only real music can stop them. Final boss: Bach\'s Prelude in C.', skill: 'Play real pieces, in time' },
]

/** GAMES screen: pick a game. The game takes over the whole display while it runs. */
export function GamesPanel() {
  const [game, setGame] = useState<GameId | null>(null)
  const screen = useScreen((s) => s.screen)
  const active = screen === 'games' && game
  useEffect(() => {
    useScreen.setState({ game: active ? game : null })
    if (!active) clearGuide()
  }, [active, game])
  useEffect(() => () => { useScreen.setState({ game: null }); clearGuide() }, [])

  const exit = () => setGame(null)
  if (active === 'zombies') return <div className="gm-stage"><ZombieLanes onExit={exit} /></div>
  if (active === 'bachdoom') return <div className="gm-stage"><BachDoom onExit={exit} /></div>
  if (active === 'jiujitsu') return <div className="gm-stage"><JiuJitsu onExit={exit} /></div>
  if (active === 'fashion') return <div className="gm-stage"><Fashion onExit={exit} /></div>
  return (
    <div className="gm-menu">
      {GAMES.map((g) => (
        <button key={g.id} className={'gm-card gm-' + g.id} onClick={() => setGame(g.id)}>
          <span className="gm-ic" aria-hidden>{g.icon}</span>
          <b>{g.title}</b>
          <span className="gm-blurb">{g.blurb}</span>
          <span className="gm-skill">🎓 {g.skill}</span>
        </button>
      ))}
      <p className="gm-note">Tip: forearm slams fizzle… unless your ⚡ BOOM meter is full. Charge it by playing in key.</p>
    </div>
  )
}
