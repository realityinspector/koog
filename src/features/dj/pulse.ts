// A gentle beat pulse for the display while a deck plays: sets --dj-beat (0..1) and data-duo-on on .kg-display.
// dj.css turns that into a soft glow on the display EDGE only (never a full-screen flash, never more than ~2 beats a second;
// beats 2-4 are weaker than the bar line). With prefers-reduced-motion the glow stays off. We don't touch the visualizer.
import { getView, subscribe } from './engine'
import { getBeat } from './clock'

type Hot = { raf?: number; el?: HTMLElement | null }
const hot = (import.meta.hot?.data ?? {}) as Hot
if (hot.raf) cancelAnimationFrame(hot.raf)
let raf = 0
let el: HTMLElement | null = null
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function clear() {
  const e = el ?? document.querySelector<HTMLElement>('.kg-display')
  e?.removeAttribute('data-duo-on'); e?.style.removeProperty('--dj-beat')
  el = null
}
function frame() {
  raf = 0
  if (!getView().anyPlaying) { clear(); return }
  if (!el || !el.isConnected) el = document.querySelector<HTMLElement>('.kg-display')
  if (el) {
    if (reduce()) { el.removeAttribute('data-duo-on') }
    else {
      const b = getBeat()
      const amp = b.beat === 0 ? 1 : 0.55
      el.setAttribute('data-duo-on', '1')
      el.style.setProperty('--dj-beat', (Math.exp(-b.phase * 5) * amp).toFixed(3))
    }
  }
  raf = requestAnimationFrame(frame)
}
const off = subscribe(() => { if (!raf && getView().anyPlaying) raf = requestAnimationFrame(frame) })
if (!raf && getView().anyPlaying) raf = requestAnimationFrame(frame)

if (import.meta.hot) {
  import.meta.hot.dispose((data: Hot) => { off(); if (raf) cancelAnimationFrame(raf); data.raf = 0; clear() })
  import.meta.hot.accept()
}
