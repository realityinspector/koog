// The gallery runner: walks the stop list hands-free. One click starts it (that click unlocks audio); after that the ghost
// pianist plays and the app moves itself through the same link layer as every canonical link.
//
// It never writes the kid's progress: from "Start" until Exit, every localStorage write is held in memory (see shield()),
// and leaving reloads the page, so settings, badges, bests and mastery are exactly as they were.
import { create } from 'zustand'
import { STOPS, TOTAL_SECONDS, stopIndex, type Stop } from './stops.data'
import { Run, perform } from './ghost'
import { applyForGallery, galleryHooks, resetWorld, setGalleryHash } from '../../links/sync'
import { onNote } from '../../music/notes'
import { flags } from '../../links/bus'
import { isEmbed } from '../../web/webDemo'
import type { KoogState } from '../../links/links'

export type Phase = 'off' | 'title' | 'run' | 'paused' | 'taken' | 'done'
interface G { phase: Phase; idx: number; veil: boolean; started: boolean }
type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<G>()(() => ({ phase: 'off', idx: 0, veil: false, started: false })) }
export const useGallery = hot.store ?? make()
if (import.meta.hot) { import.meta.hot.data.store = useGallery; import.meta.hot.accept() }
const set = (p: Partial<G>) => useGallery.setState(p)
const get = () => useGallery.getState()

export const minutes = () => Math.round((TOTAL_SECONDS + STOPS.length * 1.2) / 60)
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const FADE = () => (reduced() ? 900 : 450)
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ---------- never persist ----------
let shielded = false
const held = new Map<string, string | null>()
const proto = typeof Storage !== 'undefined' ? Storage.prototype : null
const orig = proto ? { set: proto.setItem, remove: proto.removeItem, get: proto.getItem } : null
/** Hold every localStorage write in memory. Reads see the held values, so the app behaves normally; nothing reaches the disk. */
function shield() {
  if (shielded || !proto || !orig) return
  shielded = true
  proto.setItem = function (this: Storage, k: string, v: string) { if (this === localStorage) held.set(k, String(v)); else orig.set.call(this, k, v) }
  proto.removeItem = function (this: Storage, k: string) { if (this === localStorage) held.set(k, null); else orig.remove.call(this, k) }
  proto.getItem = function (this: Storage, k: string) { if (this === localStorage && held.has(k)) return held.get(k) ?? null; return orig.get.call(this, k) }
}
function unshield() {
  if (!shielded || !proto || !orig) return
  proto.setItem = orig.set; proto.removeItem = orig.remove; proto.getItem = orig.get
  shielded = false; held.clear()
}

// ---------- the walk ----------
let token = 0
let run: Run | null = null
const killRun = () => { run?.kill(); run = null }

function stateFor(s: Stop): KoogState {
  const st = s.state
  return { ...st, visual: st.visual ?? 'fireworks', palette: st.palette ?? 'rainbow', key: st.key ?? { tonic: 0, scale: 'major' }, sound: st.sound ?? 'koog' }
}

function press(u: { sel: string; text?: string }) {
  const els = [...document.querySelectorAll<HTMLElement>(u.sel)].filter((e) => e.offsetParent !== null && (!u.text || (e.textContent ?? '').includes(u.text)))
  els[0]?.click()
  return els.length > 0
}

async function runStop(i: number) {
  const my = ++token
  const s = STOPS[i]
  killRun()
  set({ idx: i, phase: 'run', veil: true })
  setGalleryHash('#/gallery/' + s.id)
  await wait(FADE())
  if (my !== token) return
  resetWorld()
  applyForGallery(stateFor(s))
  await wait(900)
  if (my !== token) return
  ;(document.activeElement as HTMLElement | null)?.blur?.() // the app moves focus to a rail tab on screen changes: keep rings off the display
  let t0 = performance.now()
  for (const u of s.ui ?? []) {
    for (let k = 0; k < 8 && !press(u) && my === token; k++) await wait(250) // wait for the screen to be there
    t0 = performance.now()
    await wait(u.after ?? 300)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    if (my !== token) return
  }
  set({ veil: false })
  const deadline = performance.now() + s.seconds * 1000
  const r = new Run(deadline)
  run = r
  const flow = s.state.songMode === 'flow'
  const perf = perform(r, s.perf, { speed: flow ? 0.8 : 1, lead: flow ? 2 : 0, t0: flow ? t0 + 120 : undefined })
  await r.until(deadline)
  if (s.perf.k === 'song') await Promise.race([perf, wait(5000)]) // let a song finish its last note; everything else just ends
  if (my !== token) return
  r.kill()
  if (i + 1 < STOPS.length) void runStop(i + 1)
  else finish(my)
}

async function finish(my: number) {
  set({ veil: true }); await wait(FADE())
  if (my !== token) return
  resetWorld(); set({ phase: 'done', veil: false })
}

// ---------- public controls ----------
/** show the title card (nothing plays, nothing changes) */
export function openGallery(id?: string) {
  if (isEmbed()) return
  const i = id ? stopIndex(id) : 0
  set({ phase: 'title', idx: i < 0 ? 0 : i, veil: false, started: false })
  setGalleryHash('#/gallery' + (i > 0 ? '/' + STOPS[i].id : ''))
  listen()
}
/** the big button: this click unlocks audio, then the tour runs by itself */
export function startGallery() { shield(); flags.gallery = true; set({ started: true }); void runStop(get().idx) }
export function jump(i: number) {
  const n = Math.max(0, Math.min(STOPS.length - 1, i))
  if (get().phase === 'title') { set({ idx: n }); setGalleryHash('#/gallery' + (n > 0 ? '/' + STOPS[n].id : '')); return }
  void runStop(n)
}
export const next = () => jump(get().idx + 1)
export const prev = () => jump(get().idx - 1)
export function pause(taken = false) {
  if (get().phase !== 'run') return
  token++; killRun(); resetWorld()
  set({ phase: taken ? 'taken' : 'paused', veil: false })
}
export function resume() { const p = get().phase; if (p === 'paused' || p === 'taken') void runStop(get().idx) }
export const toggle = () => { const p = get().phase; if (p === 'run') pause(); else if (p === 'paused' || p === 'taken') resume(); else if (p === 'title') startGallery() }
export const again = () => void runStop(0)

/** leave. If the tour ever started, reload so the page is exactly as it was (nothing was saved); otherwise just go. */
export function exitGallery(target = '#/play') {
  token++; killRun()
  try { resetWorld() } catch { /* ignore */ }
  unlisten(); flags.gallery = false
  const wasStarted = get().started
  set({ phase: 'off', veil: false, started: false })
  setGalleryHash(null)
  history.replaceState(null, '', location.pathname + location.search + target)
  if (wasStarted) { location.reload(); return }
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

// ---------- keys, hands-on detection, address bar ----------
const CONTROL = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'F5', 'F12'])
let offNote: (() => void) | null = null
function onKey(e: KeyboardEvent) {
  const p = get().phase
  if (p === 'off') return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation() }
  if (e.key === 'Escape') { eat(); exitGallery(); return }
  if (e.key === ' ' && !(tag === 'BUTTON' && p === 'title')) { eat(); toggle(); return }
  if (e.key === 'ArrowRight' && p !== 'title') { eat(); next(); return }
  if (e.key === 'ArrowLeft' && p !== 'title') { eat(); prev(); return }
  if (p === 'run' && e.isTrusted && !CONTROL.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) pause(true) // a musical key: you're playing
}
function onPointer(e: PointerEvent) {
  if (get().phase === 'run' && e.isTrusted && (e.target as HTMLElement | null)?.closest?.('.kg-keybed')) pause(true)
}
let listening = false
function listen() {
  if (listening) return
  listening = true
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('pointerdown', onPointer, true)
  offNote = onNote((e) => { if (e.id >= 0 && e.on && get().phase === 'run') pause(true) }) // a real MIDI keyboard
}
function unlisten() {
  if (!listening) return
  listening = false
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('pointerdown', onPointer, true)
  offNote?.(); offNote = null
}

galleryHooks.open = openGallery
galleryHooks.hash = (st) => {
  const p = get().phase
  if (p === 'off') return
  if (st) { const i = st.item ? stopIndex(st.item) : 0; if (i >= 0) { if (p === 'title') jump(i); else void runStop(i) } return }
  exitGallery(location.hash || '#/play') // the address bar went somewhere else
}
