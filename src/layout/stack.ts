// The layout brain for the bottom stack inside .kg-display (sheet, DUO strip, Controller dock) and the things that sit above it.
// CSS does the positioning from vars (see the map in instrument.css); this module only measures and publishes:
//   --duo-h / --ctl-h  real heights of the docks (+ their gaps) when they are fully shown
//   --sr-bottom        bottom edge of the smart readouts; --cap-top is where coach captions start (below readouts and any challenge card)
//   --disp-h           display height
//   data-compact       "1" on short displays with 2+ docks, "2" when the visuals would still get under 45%
//   data-coop-slot     "right" | "below": where the challenge card goes so it never covers the readouts
// Non-component module: keeps its observers in import.meta.hot.data and self-accepts (docs/DEVELOPING.md).
import { useSyncExternalStore } from 'react'

const SHORT = 420          // display height under which docks compact
const VISUAL_MIN = 0.45    // share of the display the visuals always keep
const GAP = 8
// natural sizes used only to DECIDE compaction (the real heights are measured when shown)
const NAT = { sheet: 100, duo: 138, ctl: 208 }
const COMPACT = { sheet: 84, duo: 64, ctl: 52 }

let level = 0
const subs = new Set<() => void>()
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** 0 = normal, 1/2 = compact. The Controller dock slims itself when this is above 0 (unless the player expanded it). */
export function useStackCompact(): number { return useSyncExternalStore(sub, () => level) }

const px = (n: number) => Math.round(n) + 'px'

function measure(d: HTMLElement) {
  const q = <T extends HTMLElement>(s: string) => d.querySelector<T>(s)
  const H = d.clientHeight
  if (!H) return
  const screen = d.hasAttribute('data-screen')
  const sheet = d.hasAttribute('data-sheet')
  const duo = d.hasAttribute('data-duo-open') && !screen
  const dock = q('.ctl-dock')
  const ctl = d.hasAttribute('data-surface') && !!dock
  const count = +sheet + +duo + +ctl
  const natural = (sheet ? NAT.sheet : 0) + (duo ? NAT.duo : 0) + (ctl ? NAT.ctl : 0)
  // short display with 2+ docks, or any display where the docks would leave the visuals under ~45%
  const over = natural > H * (1 - VISUAL_MIN)
  const want = (H < SHORT && count >= 2) || (count >= 1 && over) ? 1 : 0
  const set = (name: string, v: string | null) => { if (v == null) d.style.removeProperty(name); else if (d.style.getPropertyValue(name) !== v) d.style.setProperty(name, v) }
  const setAttr = (name: string, v: string | null) => { if (v == null) { if (d.hasAttribute(name)) d.removeAttribute(name) } else if (d.getAttribute(name) !== v) d.setAttribute(name, v) }

  setAttr('data-compact', want ? '1' : null)
  set('--disp-h', px(H))
  // real dock heights when fully shown; compact / slim use the CSS constants so a hover-peek never moves the visuals
  const bar = q('.dj-bar')
  set('--duo-h', duo && !want && bar ? px(bar.offsetHeight + GAP) : null)
  set('--ctl-h', ctl && dock && d.getAttribute('data-surface') === 'open' ? px(dock.offsetHeight + GAP) : null)

  // still tight? shrink the sheet one more step
  if (want) {
    const ctlPx = ctl ? (d.getAttribute('data-surface') === 'open' && dock ? dock.offsetHeight + GAP : COMPACT.ctl) : 0
    const used = (sheet ? COMPACT.sheet : 0) + (duo ? COMPACT.duo : 0) + ctlPx
    setAttr('data-compact', (H - used) / H < VISUAL_MIN && sheet ? '2' : '1')
  }
  const lv = Number(d.getAttribute('data-compact') || 0)
  if (lv !== level) { level = lv; subs.forEach((f) => f()) }

  // readouts, challenge card, captions
  const dr = d.getBoundingClientRect()
  const sr = q('.sr')
  const srr = sr?.getBoundingClientRect()
  const srBottom = srr && srr.height ? srr.bottom - dr.top : 100
  const srRight = srr && srr.height ? srr.right - dr.left : 0
  set('--sr-bottom', px(srBottom))
  const coop = q('.dj-coop')
  setAttr('data-coop-slot', coop ? (d.clientWidth - srRight - 12 >= 420 ? 'right' : 'below') : null)
  let capTop = srBottom + 8
  // compact: the slim card sits at the left and the caption beside it (side by side) instead of stacking, there is no room above the docks
  if (coop && !(lv > 0 && d.getAttribute('data-coop-slot') === 'below')) { const cr = coop.getBoundingClientRect(); capTop = Math.max(capTop, cr.bottom - dr.top + 8) }
  set('--cap-top', px(capTop))
}

type Hot = { stop?: () => void }
function start(): () => void {
  let raf = 0
  let d: HTMLElement | null = null
  const ro = new ResizeObserver(() => schedule())
  const watched = new Set<Element>()
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run() }) }
  const run = () => {
    d = document.querySelector<HTMLElement>('.kg-display')
    if (!d) return
    if (!watched.has(d)) { ro.observe(d); mo.observe(d, { attributes: true, attributeFilter: ['data-screen', 'data-sheet', 'data-duo-open', 'data-surface'], childList: true, subtree: true }); watched.add(d) }
    for (const s of ['.sr', '.dj-bar', '.ctl-dock', '.dj-coop', '.sh-overlay']) {
      const e = d.querySelector(s)
      if (e && !watched.has(e)) { ro.observe(e); watched.add(e) }
    }
    for (const e of [...watched]) if (!e.isConnected) { ro.unobserve(e); watched.delete(e) }
    measure(d)
  }
  const mo = new MutationObserver(schedule)
  schedule()
  window.addEventListener('resize', schedule)
  return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', schedule) }
}

/** Start observing (idempotent, called once by <StackLayout />). */
export function startStack() {
  const hot = (import.meta.hot?.data ?? {}) as Hot
  hot.stop?.()
  const stop = start()
  hot.stop = stop
  return stop
}

if (import.meta.hot) {
  import.meta.hot.dispose((data: Hot) => { data.stop?.(); data.stop = undefined })
  import.meta.hot.accept()
}
