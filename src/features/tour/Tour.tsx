import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isGuest, pload, psave, useProfile } from '../../profile/profile'
import { TOUR_STEPS, type TourStep } from './steps'
import { onNote } from '../../music/notes'
import { celebrate } from '../celebrate/celebrate'
import { firstNoteDone, startMilestones } from '../celebrate/milestones'
import './tour.css'
import { Icon } from '../../ui/Icon'

type R = { top: number; left: number; width: number; height: number }
const PAD = 6
const CARD_W = 340

function findEl(s: TourStep): HTMLElement | null {
  const el = Array.from(document.querySelectorAll<HTMLElement>(s.sel)).find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  return el ?? null
}

export function Tour() {
  const active = useProfile((s) => s.active)
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  // 'tap' = the interactive first note; 'tour' = the 3-step tour. steps = the ones whose target exists right now.
  const [phase, setPhase] = useState<'off' | 'tap' | 'tour'>('off')
  const [steps, setSteps] = useState<TourStep[]>(TOUR_STEPS)
  const [rect, setRect] = useState<R | null>(null)
  const [cardH, setCardH] = useState(180)
  // the strip isn't in the DOM yet during the first render, so find it after mount
  const [strip, setStrip] = useState<Element | null>(null)
  useEffect(() => setStrip(document.querySelector('.kg-strip')), [])
  const card = useRef<HTMLDivElement>(null)
  const later = useRef(0) // pending 'start the tour' timer after the first note
  useEffect(() => () => window.clearTimeout(later.current), [])
  const guest = isGuest(active)

  // "firsts" toasts (first chord, cadence, BOOM...) run for as long as a kid is in kid mode
  useEffect(() => startMilestones(), [])

  const beginTour = useCallback(() => {
    const list = TOUR_STEPS.filter((s) => !s.optional || findEl(s))
    setSteps(list.length ? list : TOUR_STEPS.slice(-1)); setI(0); setPhase('tour'); setOpen(true)
  }, [])

  // auto-start once per signed-in player: first the interactive "tap any key" beat
  useEffect(() => {
    window.clearTimeout(later.current); setOpen(false); setPhase('off')
    if (guest) return
    if (pload<boolean>('tour', false)) return
    const t = setTimeout(() => setPhase('tap'), 700)
    return () => clearTimeout(t)
  }, [active, guest])

  const finish = useCallback(() => { window.clearTimeout(later.current); psave('tour', true); setOpen(false); setPhase('off') }, [])

  // the interactive beat: pulse the keybed, wait for the first note, cheer, then start the tour
  useEffect(() => {
    if (phase !== 'tap') return
    const bed = document.querySelector('.kg-keybed')
    bed?.classList.add('tour-pulse')
    const off = onNote((e) => {
      if (!e.on) return
      off()
      bed?.classList.remove('tour-pulse')
      if (firstNoteDone()) celebrate({ title: "Nice! That's your first note", emoji: '🎆', kind: 'best' })
      setPhase('off')
      later.current = window.setTimeout(beginTour, 2800)
    })
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { off(); bed?.classList.remove('tour-pulse'); finish() } }
    window.addEventListener('keydown', esc)
    return () => { off(); bed?.classList.remove('tour-pulse'); window.removeEventListener('keydown', esc) }
  }, [phase, beginTour, finish])

  const measure = useCallback(() => {
    const el = steps[i] ? findEl(steps[i]) : null
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [i, steps])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    const t = setTimeout(measure, 300)
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); ro.disconnect() }
  }, [open, measure])

  useLayoutEffect(() => { if (open && card.current) setCardH(card.current.offsetHeight) }, [open, i])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      if (k !== 'Escape' && k !== 'ArrowRight' && k !== 'ArrowLeft') return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      if (e.type !== 'keydown') return
      if (k === 'Escape') finish()
      else if (k === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      else if (i >= steps.length - 1) finish()
      else setI((n) => n + 1)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true) }
  }, [open, i, steps, finish])

  if (guest) return null
  const btn = (
    <button className="tour-replay" onClick={beginTour} hidden={open} title="Replay the tour" aria-label="Replay the tour"><Icon name="help" /></button>
  )
  const tap = phase === 'tap' && (
    <div className="tour-tap" role="status">
      <b>Tap any key!</b>
      <span>Play a note on your keyboard, or click the keys below.</span>
      <button className="tour-btn tour-skip" onClick={finish}>Skip</button>
    </div>
  )
  // Lives in the instrument's top strip, next to 💡 Idea (falls back to floating if the strip isn't there).
  const replay = <>{strip ? createPortal(btn, strip) : btn}{tap}</>
  if (!open) return replay

  const step = steps[i] ?? steps[0]
  const last = i === steps.length - 1
  const vw = window.innerWidth, vh = window.innerHeight
  const cw = Math.min(CARD_W, vw - 24)
  let top: number, left: number
  if (rect) {
    left = Math.min(Math.max(12, rect.left + rect.width / 2 - cw / 2), vw - cw - 12)
    const below = rect.top + rect.height + 12
    const above = rect.top - cardH - 12
    if (below + cardH <= vh - 8) top = below
    else if (above >= 8) top = above
    else { top = Math.max(8, vh - cardH - 12); left = rect.left > vw / 2 ? Math.max(12, rect.left - cw - 12) : Math.min(vw - cw - 12, rect.left + rect.width + 12) }
  } else { top = Math.max(8, (vh - cardH) / 2); left = (vw - cw) / 2 }

  return (
    <>
      <div className="tour-block" />
      {rect
        ? <div className="tour-spot" style={rect} />
        : <div className="tour-spot none" />}
      <div ref={card} className="tour-card" role="dialog" aria-label={`Tour step ${i + 1} of ${steps.length}`} style={{ top, left }}>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-row">
          <button className="tour-btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <div className="tour-dots" aria-hidden>{steps.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
          <button className="tour-btn go" autoFocus onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
        <div className="tour-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="tour-btn tour-skip" onClick={finish}>Skip tour</button>
        </div>
      </div>
    </>
  )
}
