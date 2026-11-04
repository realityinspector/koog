// "🥚 Eggs" chip next to "✎ Name him" while the Dancer is showing: a gallery of every easter egg.
// Found eggs show their picture, name and a "Play it" button (plays the tune through the normal synth, which makes him do it).
// Unfound eggs are a "?" with a gentle hint. Found state is saved per player (eggStore.ts).
import { useEffect, useRef, useState } from 'react'
import { INFO, demoFor, EGG_COUNT, type EggId, type EggInfo } from './eggs'
import { useEggs } from './eggStore'
import { playLocal } from '../../music/localNotes'
import './eggs.css'

const timers: number[] = []
/** play an egg's tune with the normal synth (and so the Dancer's recogniser hears it too) */
function playDemo(id: EggId) {
  for (const t of timers.splice(0)) window.clearTimeout(t)
  // notes with the same start time (a chord or a cluster) go down in ONE call, so they land together like a real hand
  const by = new Map<number, { on: number[]; off: number }>()
  for (const n of demoFor(id)) { const g = by.get(n.t) ?? { on: [], off: 0 }; g.on.push(n.n); g.off = Math.max(g.off, n.d); by.set(n.t, g) }
  const notes = demoFor(id)
  for (const [t, g] of by) {
    const v = notes.find((n) => n.t === t)!.v
    const velocity = Math.max(1, Math.min(127, Math.round(v * 127)))
    timers.push(window.setTimeout(() => { for (const n of g.on) playLocal(n, velocity, true) }, t))
    timers.push(window.setTimeout(() => { for (const n of g.on) playLocal(n, 0, false) }, t + g.off))
  }
}

function Tile({ e, found, onPlay }: { e: EggInfo; found: boolean; onPlay: () => void }) {
  return (
    <div className={'eg-tile' + (found ? ' found' : '')} data-egg={e.id} data-found={found ? '1' : '0'}>
      <div className="eg-pic" aria-hidden>{found ? e.emoji : '?'}</div>
      <div className="eg-name">{found ? e.name : 'A secret egg'}</div>
      {found
        ? <><div className="eg-what">{e.what}</div><button type="button" className="eg-play" onClick={onPlay} aria-label={`Play it: ${e.name}`}>▶ Play it</button></>
        : <div className="eg-hint">{e.hint}</div>}
    </div>
  )
}

export function EggGallery() {
  const found = useEggs((s) => s.found)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key) }
  }, [open])
  const fun = INFO.filter((e) => e.section === 'fun'), holiday = INFO.filter((e) => e.section === 'holiday')
  const play = (id: EggId) => { setOpen(false); window.setTimeout(() => playDemo(id), 350) }
  return (
    <div className="vb-scene" ref={box}>
      <button className={'vb-chip eg-chip' + (open ? ' open' : '')} aria-expanded={open} aria-haspopup="dialog" title="Secret tunes make him do surprises. See them all!" onClick={() => setOpen((o) => !o)}>
        🥚 <span className="vb-cur">Eggs <b className="eg-count" data-testid="egg-count">{found.length}/{EGG_COUNT}</b></span>
      </button>
      {open && (
        <div className="vb-pop eg-pop" role="dialog" aria-label="Easter egg gallery">
          <div className="vb-poph">Easter eggs · {found.length} of {EGG_COUNT} found</div>
          <div className="eg-grid">{fun.map((e) => <Tile key={e.id} e={e} found={found.includes(e.id)} onPlay={() => play(e.id)} />)}</div>
          <div className="vb-poph eg-sec">🎄 Holiday eggs · {holiday.filter((e) => found.includes(e.id)).length} of {holiday.length}</div>
          <div className="eg-grid">{holiday.map((e) => <Tile key={e.id} e={e} found={found.includes(e.id)} onPlay={() => play(e.id)} />)}</div>
        </div>
      )}
    </div>
  )
}
