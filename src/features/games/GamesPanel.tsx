import { useEffect, useState } from 'react'
import { useScreen } from '../../layout/screenStore'
import { clearGuide } from '../../music/guide'
import { ZombieLanes } from './zombielanes/ZombieLanes'
import { BachDoom } from './bachdoom/BachDoom'
import { JiuJitsu } from './jiujitsu/JiuJitsu'
import { Fashion } from './fashion/Fashion'
import { MemoryGame } from './memory/MemoryGame'
import { HolidayGame } from './holiday/HolidayGame'
import { loadAll as holidayAll } from './holiday/data'
import { loadSave as zSave } from './zombielanes/data'
import { loadSave as jSave, BELTS } from './jiujitsu/data'
import { loadSave as fSave, ERAS } from './fashion/data'
import { LEVELS } from './bachdoom/levels'
import { pload } from '../../profile/profile'
import { consume, linkNote, report, useLinkIn } from '../../links/bus'
import './games.css'

type GameId = 'zombies' | 'bachdoom' | 'jiujitsu' | 'fashion' | 'memory' | 'feast' | 'tree'
const GAMES: { id: GameId; icon: string; title: string; blurb: string; skill: string }[] = [
  { id: 'zombies', icon: '🧟', title: 'Zombie Lanes', blurb: 'Zombies march down the lanes toward your keys. Play the note on the zombie to blast it.', skill: 'Learn where every note lives' },
  { id: 'jiujitsu', icon: '🥋', title: 'Jiu-Jitsu Flow', blurb: 'Roll on the mats. Answer your partner\'s moves with the right notes, keep the flow, and earn your belts.', skill: 'Rhythm, call and response' },
  { id: 'fashion', icon: '👗', title: 'Runway Remix', blurb: 'Style a model through the eras of music, then play the era\'s piece on the beat so they strut the runway.', skill: 'Musical eras and style' },
  { id: 'memory', icon: '🃏', title: 'Phrase Match', blurb: 'Flip cards to hear short tunes, find the twins, then play each tune back on the keys to win the pair.', skill: 'Ear and memory for phrases' },
  { id: 'feast', icon: '🦃', title: 'Harvest Feast', blurb: 'Learn a Thanksgiving song step by step, from hunt-and-peck to master. Every phrase you nail puts a dish on the table.', skill: 'Memorize songs, one level at a time' },
  { id: 'tree', icon: '🎄', title: 'Light the Tree', blurb: 'Learn a Christmas song step by step, from hunt-and-peck to master. Every phrase hangs an ornament, and master puts the star on top.', skill: 'Memorize songs, one level at a time' },
  { id: 'bachdoom', icon: '💀', title: 'BachDoom', blurb: 'Clashing-note demons invade the cathedral. Only real music can stop them. Final boss: Bach\'s Prelude in C.', skill: 'Play real pieces, in time' },
]

interface Prog { played: boolean; line: string }
/** Harvest Feast / Light the Tree: levels finished across that holiday's songs */
function holidayLine(game: 'feast' | 'tree', all: ReturnType<typeof holidayAll>): Prog {
  const ids = Object.keys(all).filter((id) => (game === 'feast') === (['overriver', 'gather', 'thankful', 'simplegifts'].includes(id)))
  const lv = ids.reduce((n, id) => n + (all[id]?.done ?? []).filter(Boolean).length, 0)
  return { played: lv > 0, line: `${lv} level${lv === 1 ? '' : 's'} done` }
}
/** Per-game progress, read from each game's own save (per kid). */
function progress(): Record<GameId, Prog> {
  const z = zSave(), j = jSave(), f = fSave()
  const b = pload<{ unlocked?: number; best?: Record<string, { stars: number }> }>('bachdoom', {}) ?? {}
  const m = pload<{ best?: Record<string, unknown> }>('memory', {}) ?? {}
  const hol = holidayAll()
  const bestScore = Math.max(z.best.easy, z.best.normal), wave = Math.max(z.wave.easy, z.wave.normal)
  const bStars = Object.values(b.best ?? {}).reduce((n, x) => n + (x?.stars ?? 0), 0)
  const bLv = Math.min(LEVELS.length, Math.max(0, (b.unlocked ?? 1)))
  return {
    zombies: { played: bestScore > 0 || wave > 1, line: bestScore > 0 || wave > 1 ? `Best wave ${wave} · High score ${Math.round(bestScore)}` : '' },
    jiujitsu: { played: j.total > 0 || j.belt > 0 || j.best > 0, line: j.total > 0 || j.belt > 0 || j.best > 0 ? `${BELTS[j.belt].name} belt${j.stripes ? ' · ' + '|'.repeat(j.stripes) : ''}` : '' },
    fashion: { played: f.looks.length > 0 || f.unlocked.length > 1 || Object.keys(f.best).length > 0, line: `${f.unlocked.length}/${ERAS.length} eras unlocked` },
    memory: { played: Object.keys(m.best ?? {}).length > 0, line: `${Object.keys(m.best ?? {}).length} best score${Object.keys(m.best ?? {}).length === 1 ? '' : 's'} saved` },
    feast: holidayLine('feast', hol), tree: holidayLine('tree', hol),
    bachdoom: { played: Object.keys(b.best ?? {}).length > 0 || bLv > 1, line: `Level ${Math.min(bLv, LEVELS.length)}/${LEVELS.length} · ${bStars} ★` },
  }
}
const dailyPick = (): GameId => GAMES[Math.floor(Date.now() / 864e5) % GAMES.length].id

/** GAMES screen: pick a game. The game takes over the whole display while it runs. */
export function GamesPanel() {
  const [game, setGame] = useState<GameId | null>(null)
  const [levelReq, setLevelReq] = useState<string | undefined>()
  // Links: open a game (and a BachDoom level) from a canonical link; report which game is open
  const linkReq = useLinkIn((s) => s.game)
  useEffect(() => {
    if (!linkReq) return
    consume('game')
    const g = GAMES.find((x) => x.id === linkReq.id)
    if (linkReq.id && !g) linkNote("That link mentions a game Koog doesn't have")
    setGame(g ? g.id : null)
    setLevelReq(g?.id === 'bachdoom' ? linkReq.level : undefined)
    if (linkReq.level && g && g.id !== 'bachdoom') linkNote('That game has no levels to pick from')
  }, [linkReq])
  useEffect(() => { report({ game }); if (!game) report({ level: null }) }, [game])
  useEffect(() => () => report({ game: null, level: null }), [])
  const screen = useScreen((s) => s.screen)
  const active = screen === 'games' && game
  useEffect(() => {
    useScreen.setState({ game: active ? game : null })
    if (!active) clearGuide()
  }, [active, game])
  useEffect(() => () => { useScreen.setState({ game: null }); clearGuide() }, [])

  const exit = () => setGame(null)
  if (active === 'zombies') return <div className="gm-stage"><ZombieLanes onExit={exit} /></div>
  if (active === 'bachdoom') return <div className="gm-stage"><BachDoom onExit={exit} levelId={levelReq} /></div>
  if (active === 'jiujitsu') return <div className="gm-stage"><JiuJitsu onExit={exit} /></div>
  if (active === 'memory') return <div className="gm-stage"><MemoryGame onExit={exit} /></div>
  if (active === 'fashion') return <div className="gm-stage"><Fashion onExit={exit} /></div>
  if (active === 'feast' || active === 'tree') return <div className="gm-stage"><HolidayGame kind={active} onExit={exit} /></div>
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
