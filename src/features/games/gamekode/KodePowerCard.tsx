import type { ReactNode } from 'react'
import { GAME_CONCEPTS } from './kodeLogic'
import './gamekode.css'

/** The "Kode power" card every game shows on its menu: opt-in, one idea, kid words. */
export function KodePowerCard({ game, on, onToggle, children, status }: { game: string; on: boolean; onToggle: () => void; children?: ReactNode; status?: string }) {
  const g = GAME_CONCEPTS[game]
  return (
    <section className={'gk-card' + (on ? ' on' : '')} data-gk={game} aria-label={`Kode power: ${g.power}`}>
      <header>
        <b>🧑‍💻 Kode power: {g.power}</b>
        <button className="gk-tog" aria-pressed={on} onClick={onToggle}>{on ? 'On' : 'Off'}</button>
      </header>
      <p className="gk-kid">{g.kid}</p>
      <div className="gk-tags" aria-label="Coding ideas">{g.concepts.map((c) => <i key={c}>{c}</i>)}</div>
      {status && <p className="gk-status" role="status">{status}</p>}
      {on && <div className="gk-body">{children}</div>}
    </section>
  )
}
