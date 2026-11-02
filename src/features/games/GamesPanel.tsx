import { useEffect, useState } from 'react'
import { useScreen } from '../../layout/screenStore'
import { clearGuide } from '../../music/guide'
import { ZombieLanes } from './zombielanes/ZombieLanes'
import { BachDoom } from './bachdoom/BachDoom'
import { JiuJitsu } from './jiujitsu/JiuJitsu'
import { Fashion } from './fashion/Fashion'
import { loadSave as zSave } from './zombielanes/data'
import { loadSave as jSave, BELTS } from './jiujitsu/data'
import { loadSave as fSave, ERAS } from './fashion/data'
import { LEVELS } from './bachdoom/levels'
import { pload } from '../../profile/profile'
import './games.css'

type GameId = 'zombies' | 'bachdoom' | 'jiujitsu' | 'fashion'
const GAMES: { id: GameId; icon: string; title: string; blurb: string; skill: string }[] = [
  { id: 'zombies', icon: '🧟', title: 'Zombie Lanes', blurb: 'Zombies march down the lanes toward your keys. Play the note on the zombie to blast it.', skill: 'Learn where every note lives' },
  { id: 'jiujitsu', icon: '🥋', title: 'Jiu-Jitsu Flow', blurb: 'Roll on the mats. Answer your partner\'s moves with the right notes, keep the flow, and earn your belts.', skill: 'Rhythm, call and response' },
  { id: 'fashion', icon: '👗', title: 'Runway Remix', blurb: 'Style a model through the eras of music, then play the era\'s piece on the beat so they strut the runway.', skill: 'Musical eras and style' },
  { id: 'bachdoom', icon: '💀', title: 'BachDoom', blurb: 'Clashing-note demons invade the cathedral. Only real music can stop them. Final boss: Bach\'s Prelude in C.', skill: 'Play real pieces, in time' },
]

interface Prog { played: boolean; line: string }
/** Per-game progress, read from each game's own save (per kid). */
function progress(): Record<GameId, Prog> {
  const z = zSave(), j = jSave(), f = fSave()
  const b = pload<{ unlocked?: number; best?: Record<string, { stars: number }> }>('bachdoom', {}) ?? {}
  const bestScore = Math.max(z.best.easy, z.best.normal), wave = Math.max(z.wave.easy, z.wave.normal)
  const bStars = Object.values(b.best ?? {}).reduce((n, x) => n + (x?.stars ?? 0), 0)
  const bLv = Math.min(LEVELS.length, Math.max(0, (b.unlocked ?? 1)))
  return {
    zombies: { played: bestScore > 0 || wave > 1, line: bestScore > 0 || wave > 1 ? `Best wave ${wave} · High score ${Math.round(bestScore)}` : '' },
    jiujitsu: { played: j.total > 0 || j.belt > 0 || j.best > 0, line: j.total > 0 || j.belt > 0 || j.best > 0 ? `${BELTS[j.belt].name} belt${j.stripes ? ' · ' + '|'.repeat(j.stripes) : ''}` : '' },
    fashion: { played: f.looks.length > 0 || f.unlocked.length > 1 || Object.keys(f.best).length > 0, line: `${f.unlocked.length}/${ERAS.length} eras unlocked` },
    bachdoom: { played: Object.keys(b.best ?? {}).length > 0 || bLv > 1, line: `Level ${Math.min(bLv, LEVELS.length)}/${LEVELS.length} · ${bStars} ★` },
  }
}
const dailyPick = (): GameId => GAMES[Math.floor(Date.now() / 864e5) % GAMES.length].id

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
  const prog = progress(), daily = dailyPick()
  return (
    <div className="gm-menu">
      {GAMES.map((g) => (
        <button key={g.id} className={'gm-card gm-' + g.id} onClick={() => setGame(g.id)}>
          <span className="gm-tags">
            {g.id === daily && <span className="gm-chip gm-daily">Daily pick</span>}
          </span>
          <span className="gm-ic" aria-hidden>{g.icon}</span>
          <b>{g.title}</b>
          <span className="gm-blurb">{g.blurb}</span>
          <span className="gm-skill">{g.skill}</span>
          {prog[g.id].played && prog[g.id].line && <span className="gm-prog">{prog[g.id].line}</span>}
        </button>
      ))}
      <p className="gm-note">Tip: forearm slams fizzle, unless your BOOM meter is full. Charge it by playing in key.</p>
    </div>
  )
}
