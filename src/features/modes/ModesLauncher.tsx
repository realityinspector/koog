import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import './modes.css'
import { useDuoOpen } from '../dj/duoOpen'
import { ensure } from '../dj/engine'
import * as mimic from '../mimic/engine'
import { useMentor } from '../mentor/mentorStore'
import { useVibes } from '../../music/vibes'
import * as band from '../smartband/engine'
import { Icon } from '../../ui/Icon'
import { useOnePop } from '../../ui/onePop'
import { setLoopsDock, useLoopsDock } from '../loopstation/LoopsDock'
import { setControllerPage } from '../loopstation/loopSurface'
import { useDrumPage } from '../drumpads/drumSurface'
import { setBoardOpen, useBoardOpen } from '../pedalboard/boardOpen'
import { setKodeDock, useKodeDock } from '../kode/kodeDock'
import { openStore } from '../appstore/storeState'
import { STORE_NAME as storeName } from '../../kode/kore/brand'

interface CardDef { id: string; icon: string; name: string; blurb: string; on: boolean; toggle: () => void }

/**
 * ✨ Modes: the one place to switch the optional helpers on and off (top-right of the PLAY display).
 * Each helper keeps its own in-display UI while it is on (DUO strip, Mimic chip, Mentor robot, Band pill, mood face).
 */
export function ModesLauncher() {
  const [open, setOpen] = useState(false)
  useOnePop('modes', open, () => setOpen(false))
  const box = useRef<HTMLDivElement>(null)
  const duo = useDuoOpen((s) => s.open)
  useSyncExternalStore(mimic.subscribe, mimic.getVersion)
  useSyncExternalStore(band.subscribe, band.getVersion)
  const mimicOn = mimic.getState().on
  const bandOn = band.getState().on
  const mentor = useMentor((s) => s.on)
  const vibes = useVibes((s) => s.chip)
  const looper = useLoopsDock((s) => s.open)
  const drums = useDrumPage((s) => s.on)
  const kode = useKodeDock((s) => s.open)
  const board = useBoardOpen((s) => s.open)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [open])

  // Play-along helpers all make music next to you, so only one runs at a time: switching one on switches the others off.
  const offOthers = (keep: string) => {
    if (keep !== 'duo' && duo) useDuoOpen.getState().setOpen(false)
    if (keep !== 'mimic' && mimicOn) void mimic.toggle()
    if (keep !== 'band' && bandOn) void band.toggle()
  }
  const play: CardDef[] = [
    { id: 'duo', icon: '🎧', name: 'DJ + Piano', blurb: 'A friend DJs on two decks while you play. The DJ sets the beat and key.', on: duo,
      toggle: () => { if (!duo) offOthers('duo'); useDuoOpen.getState().setOpen(!duo); void ensure() } },
    { id: 'band', icon: '🤖', name: 'Band', blurb: 'A backing band that listens and plays along with you.', on: bandOn, toggle: () => { if (!bandOn) offOthers('band'); void band.toggle() } },
    { id: 'mimic', icon: '🎭', name: 'Mimic', blurb: 'Play a little tune and Koog answers in a famous style.', on: mimicOn, toggle: () => { if (!mimicOn) offOthers('mimic'); void mimic.toggle() } },
  ]
  const helpers: CardDef[] = [
    { id: 'mentor', icon: '🎓', name: 'Mentor', blurb: 'A synth robot in the front row that beeps for your moves and gives tips.', on: mentor, toggle: () => useMentor.getState().setOn(!mentor) },
    { id: 'vibes', icon: '😀', name: 'Vibes face', blurb: 'A little face that shows the mood of your music.', on: vibes, toggle: () => useVibes.getState().setChip(!vibes) },
  ]
  // the looper and the drum pads both dock over the display, so one at a time
  const make: CardDef[] = [
    { id: 'looper', icon: '🔁', name: 'Looper', blurb: 'Record a loop, then play on top of it. One big button: tap, tap, tap.', on: looper,
      toggle: () => { if (!looper && drums) setControllerPage('dj'); if (!looper) setKodeDock(false); setLoopsDock(!looper); setOpen(false) } },
    { id: 'drums', icon: '🥁', name: 'Drum pads', blurb: 'Eight drum pads and a beat you build step by step. Works on a DJ controller too.', on: drums,
      toggle: () => { if (!drums) { setLoopsDock(false); setKodeDock(false) } setControllerPage(drums ? 'dj' : 'drums'); setOpen(false) } },
    { id: 'kode', icon: '🧑‍💻', name: 'Koog Kode', blurb: 'Code your music: type a pattern like notes "c e g e" and it plays. Or play something and Koog writes the code.', on: kode,
      toggle: () => { if (!kode) { setLoopsDock(false); setControllerPage('dj') } setKodeDock(!kode); setOpen(false) } },
    { id: 'pedalboard', icon: '🦶', name: 'Pedalboard', blurb: 'Stomp Fuzz, Echo, Wobble and more on your sound, and use the piano pedals.', on: board, toggle: () => { setBoardOpen(!board); setOpen(false) } },
  ]
  const cards = [...play, ...make, ...helpers]
  const count = cards.filter((c) => c.on).length
  const card = (c: CardDef) => (
    <button key={c.id} className={'md-card' + (c.on ? ' on' : '')} aria-pressed={c.on} onClick={c.toggle}>
      <span className="md-ic" aria-hidden>{c.icon}</span>
      <span className="md-tx"><b>{c.name}</b><em>{c.blurb}</em></span>
      <span className="md-sw" aria-hidden>{c.on ? 'ON' : 'OFF'}</span>
    </button>
  )

  return (
    <div className="md-wrap" ref={box} data-modes-launcher onPointerDown={(e) => e.stopPropagation()}>
      <button data-tour="modes" className={'md-btn' + (open ? ' open' : '') + (count ? ' has' : '')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        title="Modes: DJ + Piano, Band, Mimic, Looper, Drum pads, Koog Kode, Pedalboard, Mentor and Vibes">
        <Icon name="spark" /><b>Modes</b>
        <span className="md-dots" aria-label={count + ' on'}>
          {cards.map((c) => <i key={c.id} className={c.on ? 'on' : ''} />)}
        </span>
      </button>
      {open && (
        <div className="md-pop" role="dialog" aria-label="Modes">
          <div className="md-head">Modes <span>{count ? count + ' on' : 'all off'}</span></div>
          {/* gallery entries first, so they are never scrolled out of reach on a short display */}
          <div className="md-gal-row">
            <button className="md-gallery" onClick={() => { setOpen(false); location.hash = '#/gallery' }}>▶ Guided tour <span>a self-playing tour of everything</span></button>
            <button className="md-gallery" onClick={() => { setOpen(false); location.hash = '#/gallery/art' }}>🖼 Art Gallery mode <span>calm moving art, loops forever</span></button>
          </div>
          <button className="md-gallery" onClick={() => { setOpen(false); openStore() }}>🏪 {storeName} <span>find Kode apps and earn coding powers</span></button>
          <div className="md-sec">Play along <span>pick one</span></div>
          <div className="md-grid md-grid-3">{play.map(card)}</div>
          <div className="md-sec">Make music</div>
          <div className="md-grid">{make.map(card)}</div>
          <div className="md-sec">Helpers</div>
          <div className="md-grid">{helpers.map(card)}</div>
        </div>
      )}
    </div>
  )
}
