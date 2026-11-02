import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import './modes.css'
import { useDuoOpen } from '../dj/duoOpen'
import { ensure } from '../dj/engine'
import * as mimic from '../mimic/engine'
import { useMentor } from '../mentor/mentorStore'
import { useVibes } from '../../music/vibes'
import * as band from '../smartband/engine'

interface CardDef { id: string; icon: string; name: string; blurb: string; on: boolean; toggle: () => void }

/**
 * ✨ Modes: the one place to switch the optional helpers on and off (top-right of the PLAY display).
 * Each helper keeps its own in-display UI while it is on (DUO strip, Mimic chip, Mentor robot, Band pill, mood face).
 */
export function ModesLauncher() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const duo = useDuoOpen((s) => s.open)
  useSyncExternalStore(mimic.subscribe, mimic.getVersion)
  useSyncExternalStore(band.subscribe, band.getVersion)
  const mimicOn = mimic.getState().on
  const bandOn = band.getState().on
  const mentor = useMentor((s) => s.on)
  const vibes = useVibes((s) => s.chip)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [open])

  const cards: CardDef[] = [
    { id: 'duo', icon: '🎧', name: 'DJ + Piano', blurb: 'A friend DJs on two decks while you play. The DJ sets the beat and key.', on: duo,
      toggle: () => { useDuoOpen.getState().setOpen(!duo); void ensure() } },
    { id: 'mimic', icon: '🎭', name: 'Mimic', blurb: 'Play a little tune and Koog answers in a famous style.', on: mimicOn, toggle: () => void mimic.toggle() },
    { id: 'mentor', icon: '🎓', name: 'Mentor', blurb: 'A synth robot in the front row that beeps for your moves and gives tips.', on: mentor, toggle: () => useMentor.getState().setOn(!mentor) },
    { id: 'vibes', icon: '😀', name: 'Vibes face', blurb: 'A little face that shows the mood of your music.', on: vibes, toggle: () => useVibes.getState().setChip(!vibes) },
    { id: 'band', icon: '🤖', name: 'Band', blurb: 'A backing band that listens and plays along with you.', on: bandOn, toggle: () => void band.toggle() },
  ]
  const count = cards.filter((c) => c.on).length

  return (
    <div className="md-wrap" ref={box} data-modes-launcher onPointerDown={(e) => e.stopPropagation()}>
      <button data-tour="modes" className={'md-btn' + (open ? ' open' : '') + (count ? ' has' : '')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        title="Modes: DJ + Piano, Mimic, Mentor, Vibes and Band">
        <span aria-hidden>✨</span><b>Modes</b>
        <span className="md-dots" aria-label={count + ' on'}>
          {cards.map((c) => <i key={c.id} className={c.on ? 'on' : ''} />)}
        </span>
      </button>
      {open && (
        <div className="md-pop" role="dialog" aria-label="Modes">
          <div className="md-head">Modes <span>{count ? count + ' on' : 'all off'}</span></div>
          <div className="md-grid">
            {cards.map((c) => (
              <button key={c.id} className={'md-card' + (c.on ? ' on' : '')} aria-pressed={c.on} onClick={c.toggle}>
                <span className="md-ic" aria-hidden>{c.icon}</span>
                <span className="md-tx"><b>{c.name}</b><em>{c.blurb}</em></span>
                <span className="md-sw" aria-hidden>{c.on ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
