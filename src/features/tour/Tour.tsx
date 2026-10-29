import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isGuest, pload, psave, useProfile } from '../../profile/profile'
import { TOUR_STEPS } from './steps'
import './tour.css'

type R = { top: number; left: number; width: number; height: number }
const PAD = 6
const CARD_W = 340

function findTarget(i: number): HTMLElement | null {
  const s = TOUR_STEPS[i]
  const all = Array.from(document.querySelectorAll<HTMLElement>(s.sel))
  const el = s.text ? all.find((e) => e.textContent?.includes(s.text!)) : all[0]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export function Tour() {
  const active = useProfile((s) => s.active)
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<R | null>(null)
  const [cardH, setCardH] = useState(180)
  const card = useRef<HTMLDivElement>(null)
  const guest = isGuest(active)

  // auto-start once per signed-in player
  useEffect(() => {
    if (guest) { setOpen(false); return }
    if (pload<boolean>('tour', false)) return
    const t = setTimeout(() => { setI(0); setOpen(true) }, 700)
    return () => clearTimeout(t)
  }, [active, guest])

  const finish = useCallback(() => { psave('tour', true); setOpen(false) }, [])

  const measure = useCallback(() => {
    const el = findTarget(i)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [i])

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
      else if (i >= TOUR_STEPS.length - 1) finish()
      else setI((n) => n + 1)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true) }
  }, [open, i, finish])

  if (guest) return null
  const btn = (
    <button className="tour-replay" onClick={() => { setI(0); setOpen(true) }} hidden={open} title="Replay the tour" aria-label="Replay the tour">❓</button>
  )
  // Lives in the instrument's top strip, next to 💡 Idea (falls back to floating if the strip isn't there).
  const strip = document.querySelector('.kg-strip')
  const replay = strip ? createPortal(btn, strip) : btn
  if (!open) return replay

  const step = TOUR_STEPS[i]
  const last = i === TOUR_STEPS.length - 1
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
      <div ref={card} className="tour-card" role="dialog" aria-label={`Tour step ${i + 1} of ${TOUR_STEPS.length}`} style={{ top, left }}>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-row">
          <button className="tour-btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <div className="tour-dots" aria-hidden>{TOUR_STEPS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
          <button className="tour-btn go" autoFocus onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
        <div className="tour-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="tour-btn tour-skip" onClick={finish}>Skip tour</button>
        </div>
      </div>
    </>
  )
}
