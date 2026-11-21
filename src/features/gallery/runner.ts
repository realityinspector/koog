// The gallery runner: walks the stop list hands-free. One click starts it (that click unlocks audio); after that the ghost
// pianist plays and the app moves itself through the same link layer as every canonical link.
//
// It never writes the kid's progress: from "Start" until Exit, every localStorage write is held in memory (see shield()),
// and leaving reloads the page, so settings, badges, bests and mastery are exactly as they were.
//
// Art Gallery mode (#/gallery/art) is the same engine in a lean-back costume: the display fills the screen, the app's
// chrome is hidden (html[data-art], see gallery.css), and art.data.ts's pieces loop forever with slow camera drifts,
// calm public-domain songs played in full, and a wall label. Space pauses; any other key or a click hands the keys back.
import { create } from 'zustand'
import { STOPS, TOTAL_SECONDS, stopIndex, type Stop } from './stops.data'
import { ART_ROOMS, PIECES, type Piece } from './art.data'
import { Run, perform, duck, inGhost } from './ghost'
import { findSong, holidayPieces, isSeason, SEASONS, type Season } from './holiday'
import { applyForGallery, galleryHooks, galleryReturnHash, resetWorld, setGalleryHash } from '../../links/sync'
import { galleryVoice, pictureOrdinal } from './voices'
import { onNote } from '../../music/notes'
import { flags } from '../../links/bus'
import { isEmbed } from '../../web/webDemo'
import type { KoogState } from '../../links/links'

export type Phase = 'off' | 'title' | 'run' | 'paused' | 'taken' | 'done'
interface G {
  phase: Phase; idx: number; veil: boolean; started: boolean
  /** Art Gallery mode: the piece on show, when it began (performance clock) and how long it should last (ms) */
  art: boolean; piece: Piece | null; pieceAt: number; pieceMs: number
  /** which Art Gallery playlist: the everyday one, or a holiday one */
  kind: 'art' | Season
  /** true while the gallery's own music is turned down because someone is playing */
  ducked: boolean
}
type Hot = { store?: ReturnType<typeof make> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<G>()(() => ({ phase: 'off', idx: 0, veil: false, started: false, art: false, piece: null, pieceAt: 0, pieceMs: 0, kind: 'art', ducked: false })) }
export const useGallery = hot.store ?? make()
if (import.meta.hot) { import.meta.hot.data.store = useGallery; import.meta.hot.accept() }
const set = (p: Partial<G>) => useGallery.setState(p)
const get = () => useGallery.getState()

export const minutes = () => Math.round((TOTAL_SECONDS + STOPS.length * 1.2) / 60)
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const FADE = () => (reduced() ? 900 : 450)
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ---------- never persist ----------
// The shield state lives on import.meta.hot.data: an edit of this file WHILE the gallery runs used to capture the already-patched
// functions as "the originals", so unshield() put the wrappers back and every later save was silently held in memory (docs/STATE.md).
type Shield = { shielded: boolean; held: Map<string, string | null>; orig: { set: Storage['setItem']; remove: Storage['removeItem']; get: Storage['getItem'] } | null }
const sh: Shield = ((import.meta.hot?.data as { shield?: Shield } | undefined)?.shield) ?? { shielded: false, held: new Map(), orig: null }
if (import.meta.hot) import.meta.hot.data.shield = sh
const proto = typeof Storage !== 'undefined' ? Storage.prototype : null
if (proto && !sh.orig) sh.orig = { set: proto.setItem, remove: proto.removeItem, get: proto.getItem }
const orig = sh.orig
const held = sh.held
let shielded = sh.shielded
/** Hold every localStorage write in memory. Reads see the held values, so the app behaves normally; nothing reaches the disk. */
function shield() {
  if (shielded || !proto || !orig) return
  shielded = sh.shielded = true
  proto.setItem = function (this: Storage, k: string, v: string) { if (this === localStorage) held.set(k, String(v)); else orig.set.call(this, k, v) }
  proto.removeItem = function (this: Storage, k: string) { if (this === localStorage) held.set(k, null); else orig.remove.call(this, k) }
  proto.getItem = function (this: Storage, k: string) { if (this === localStorage && held.has(k)) return held.get(k) ?? null; return orig.get.call(this, k) }
}
function unshield() {
  if (!shielded || !proto || !orig) return
  proto.setItem = orig.set; proto.removeItem = orig.remove; proto.getItem = orig.get
  shielded = sh.shielded = false; held.clear()
}

// ---------- the walk ----------
let token = 0
let run: Run | null = null
const killRun = () => { run?.kill(); run = null }

function playItems() {
  return STOPS.map((s) => ({ id: s.id, screen: s.state.screen, mode: s.state.mode, sound: s.state.sound }))
}
function artItems(): { id: string; screen?: string; mode?: string; sound?: string }[] {
  return piecesFor(get().kind).map((p) => ({ id: p.id, screen: p.state?.screen ?? 'play', mode: p.state?.mode, sound: p.state?.sound }))
}
/** The synth for a play picture. A picture that already names a sound keeps it. The rest of the play screen takes the next voice in the cycle. */
function stateFor(st: KoogState, id: string): KoogState {
  const picture = st.screen === 'play' && st.mode !== 'boss'
  const list = STOPS.some((x) => x.id === id) ? playItems() : artItems()
  const ord = picture && !st.sound ? pictureOrdinal(list, id) : -1
  const voice = !st.sound && ord >= 0 ? galleryVoice(ord) : undefined
  return {
    ...st,
    visual: st.visual ?? 'fireworks',
    palette: st.palette ?? 'rainbow',
    key: st.key ?? { tonic: 0, scale: 'major' },
    sound: st.sound ?? voice?.sound ?? 'koog',
    preset: st.preset ?? voice?.preset,
  }
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
  applyForGallery(stateFor(s.state, s.id))
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

// ---------- Art Gallery mode ----------
const ART_HASH = '#/gallery/art'
const hashFor = (k: 'art' | Season) => (k === 'art' ? ART_HASH : SEASONS[k].hash)
/** the pieces of a playlist */
export const piecesFor = (k: 'art' | Season): Piece[] => (k === 'art' ? PIECES : holidayPieces(k))
const ART_FADE = () => (reduced() ? 2200 : 1700) // the soft dip to dark between pieces (a slow fade, never a flash)
let artQ: Piece[] = [], artI = 0, artPass = 0
let cam: Animation | null = null
let wentFull = false

const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
/** one pass: the rooms in order the first time, then shuffled (and shuffled inside), never the same piece twice in a row */
function artPassList(): Piece[] {
  const kind = get().kind, all = piecesFor(kind)
  const first = artPass++ === 0
  const rooms = first ? ART_ROOMS : shuffle(ART_ROOMS)
  const q = kind === 'art' ? rooms.flatMap((r) => { const ps = all.filter((p) => p.room === r); return first ? ps : shuffle(ps) }) : first ? all : shuffle(all)
  const last = artQ[artQ.length - 1]
  if (last && q[0]?.id === last.id && q.length > 1) q.push(q.shift()!)
  return q
}
function resolvePiece(p: Piece) {
  const base = p.from ? STOPS[stopIndex(p.from)] : undefined
  const state = { ...(base?.state ?? { screen: 'play' as const }), ...p.state } as KoogState
  return { state, perf: p.perf ?? base?.perf ?? { k: 'none' as const }, ui: p.ui ?? base?.ui ?? [], seconds: p.seconds ?? base?.seconds ?? 16 }
}
/** What the placard says the picture is playing. Null when this stop is not a play picture. */
export function stopVoice(s: Stop): { sound: string; preset?: string } | null {
  if (s.state.screen !== 'play' || s.state.mode === 'boss') return null
  const st = stateFor(s.state, s.id)
  return { sound: st.sound ?? 'koog', preset: st.preset }
}
export function pieceVoice(p: Piece): { sound: string; preset?: string } | null {
  const { state } = resolvePiece(p)
  if (state.screen !== 'play' || state.mode === 'boss') return null
  const st = stateFor(state, p.id)
  return { sound: st.sound ?? 'koog', preset: st.preset }
}
/** how long a song takes (ms), so the progress line and the label know */
function songMs(id: string, speed: number, lead: number) {
  const s = findSong(id)
  if (!s) return 0
  return ((s.notes.reduce((n, x) => n + x.beats, 0) + lead) * 60000) / (s.bpm * speed)
}
const display = () => document.querySelector<HTMLElement>('.kg-display')
function stopCamera() { try { cam?.cancel() } catch { /* ignore */ } cam = null }
/** a slow, gentle camera move over the whole piece: a little zoom and a drift. None under reduced motion (crossfades only). */
function startCamera(ms: number) {
  stopCamera()
  const d = display()
  if (!d || reduced() || typeof d.animate !== 'function') return
  const r = () => (Math.random() * 2 - 1)
  const s0 = 1.04 + Math.random() * 0.02, s1 = 1.07 + Math.random() * 0.03
  const zoomIn = Math.random() < 0.6
  const [a, b] = zoomIn ? [s0, s1] : [s1, s0]
  const k = 1.2 // % of drift, kept inside the overscan so no edge ever shows
  try {
    cam = d.animate([
      { transform: `translate(${(r() * k).toFixed(2)}%, ${(r() * k).toFixed(2)}%) scale(${a.toFixed(3)})` },
      { transform: `translate(${(r() * k).toFixed(2)}%, ${(r() * k).toFixed(2)}%) scale(${b.toFixed(3)})` },
    ], { duration: Math.max(4000, ms), easing: 'ease-in-out', fill: 'forwards' })
  } catch { cam = null }
}

async function runPiece(my: number) {
  if (artI >= artQ.length) { artQ = artPassList(); artI = 0 }
  const p = artQ[artI]
  const { state, perf: pf, ui, seconds } = resolvePiece(p)
  killRun()
  set({ phase: 'run', veil: true })
  await wait(ART_FADE())
  if (my !== token) return
  stopCamera(); resetWorld()
  applyForGallery(stateFor(state, p.id))
  await wait(1000)
  if (my !== token) return
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  let t0 = performance.now()
  for (const u of ui) {
    for (let k = 0; k < 8 && !press(u) && my === token; k++) await wait(250)
    t0 = performance.now()
    await wait(u.after ?? 300)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    if (my !== token) return
  }
  const flow = state.songMode === 'flow'
  const speed = flow ? 0.8 : p.speed ?? 1, lead = flow ? 2 : 0
  const ms = Math.max(seconds * 1000, pf.k === 'song' ? songMs(pf.id, speed, lead) + 2500 : 0)
  startCamera(ms + ART_FADE() * 2)
  set({ veil: false, piece: p, pieceAt: performance.now(), pieceMs: ms })
  const deadline = performance.now() + ms
  const r = new Run(deadline)
  run = r
  const done = perform(r, pf, { speed, lead, t0: flow ? t0 + 120 : undefined })
  await r.until(deadline)
  await Promise.race([done, wait(15000)]) // songs play to their last note; a looping phrase ends at the end of its phrase
  if (my !== token) return
  await wait(1200) // let the last notes ring out before the fade
  if (my !== token) return
  r.kill()
  artI++
  void runPiece(my)
}

function onFullscreen() {
  if (!get().art || get().phase === 'title' || get().phase === 'off') return
  if (wentFull && !document.fullscreenElement) exitGallery() // Esc (or the browser) left full screen: leave the mode too
}

/** the Art Gallery mode button: this click unlocks audio and asks for full screen (fails silently), then it loops forever */
export function startArt() {
  shield(); flags.gallery = true
  try { document.documentElement.dataset.art = '1' } catch { /* ignore */ }
  wentFull = false
  try {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen().then(() => { wentFull = true }, () => {})
  } catch { /* no full screen here: fine */ }
  document.addEventListener('fullscreenchange', onFullscreen)
  artQ = []; artI = 0; artPass = 0
  set({ started: true, art: true, idx: 0, ducked: false })
  duck.level = 1
  setGalleryHash(hashFor(get().kind))
  idleCursor(true)
  void runPiece(++token)
}

// the cursor and the controls fade after 3.5 s without a move, tap or key (art mode only)
let idleT = 0
export const wake = () => {
  const h = document.documentElement
  h.removeAttribute('data-idle')
  clearTimeout(idleT)
  idleT = window.setTimeout(() => { if (get().art) h.setAttribute('data-idle', '') }, 3500)
}
function idleCursor(on: boolean) {
  window.removeEventListener('pointermove', wake)
  clearTimeout(idleT)
  document.documentElement.removeAttribute('data-idle')
  if (on) { window.addEventListener('pointermove', wake); wake() }
}

// ---------- public controls ----------
/** show the title card (nothing plays, nothing changes). id 'art' = the Art Gallery mode card. */
export function openGallery(id?: string) {
  if (isEmbed()) return
  const sub = id?.startsWith('art/') ? id.slice(4) : ''
  if (id === 'art' || (sub && isSeason(sub))) {
    const kind = isSeason(sub) ? sub : 'art'
    set({ phase: 'title', idx: 0, veil: false, started: false, art: true, piece: null, kind, ducked: false })
    setGalleryHash(hashFor(kind))
    listen()
    return
  }
  const i = id ? stopIndex(id) : 0
  set({ phase: 'title', idx: i < 0 ? 0 : i, veil: false, started: false, art: false, piece: null, kind: 'art' })
  setGalleryHash('#/gallery' + (i > 0 ? '/' + STOPS[i].id : ''))
  listen()
}
/** the big button: this click unlocks audio, then the tour runs by itself */
export function startGallery() { if (get().art) { startArt(); return } shield(); flags.gallery = true; set({ started: true }); void runStop(get().idx) }
/** from the art title card: back to the guided tour's card */
export function tourInstead() { if (get().phase !== 'title') return; set({ art: false, idx: 0, kind: 'art' }); setGalleryHash('#/gallery') }
export function jump(i: number) {
  if (get().art) return
  const n = Math.max(0, Math.min(STOPS.length - 1, i))
  if (get().phase === 'title') { set({ idx: n }); setGalleryHash('#/gallery' + (n > 0 ? '/' + STOPS[n].id : '')); return }
  void runStop(n)
}
export const next = () => { if (get().art) skip(1); else jump(get().idx + 1) }
export const prev = () => { if (get().art) skip(-1); else jump(get().idx - 1) }

/** Art Gallery mode: leave this piece now (a soft fade, then the next one; or the one before). Works while paused too. */
export function skip(dir: 1 | -1 = 1) {
  if (!get().art || (get().phase !== 'run' && get().phase !== 'paused')) return
  token++; killRun()
  artI = Math.max(0, artI + dir)
  void runPiece(token)
}
/** Art Gallery mode: jump straight to one piece; the playlist carries on from there */
export function pick(id: string) {
  if (!get().art || (get().phase !== 'run' && get().phase !== 'paused')) return
  const p = piecesFor(get().kind).find((x) => x.id === id)
  if (!p) return
  token++; killRun()
  artQ = [p, ...artQ.slice(artI + 1).filter((x) => x.id !== p.id)]; artI = 0
  void runPiece(token)
}

// ---------- playing over the art: the gallery's music ducks, then comes back ----------
const DUCK_TO = 0.3, QUIET_MS = 4000
let quietT = 0, rampT = 0
function kidPlayed() {
  window.clearTimeout(quietT); window.clearInterval(rampT)
  duck.level = DUCK_TO
  if (!get().ducked) set({ ducked: true })
  quietT = window.setTimeout(() => { // a few quiet seconds: the music glides back up
    rampT = window.setInterval(() => {
      duck.level = Math.min(1, duck.level + 0.1)
      if (duck.level >= 1) { window.clearInterval(rampT); set({ ducked: false }) }
    }, 150)
  }, QUIET_MS)
}
function resetDuck() { window.clearTimeout(quietT); window.clearInterval(rampT); duck.level = 1; if (get().ducked) set({ ducked: false }) }
export function pause(taken = false) {
  if (get().phase !== 'run') return
  if (get().art) { token++; killRun(); try { cam?.pause() } catch { /* ignore */ } set({ phase: 'paused', veil: false }); return } // the picture stays, the music stops
  token++; killRun(); resetWorld()
  set({ phase: taken ? 'taken' : 'paused', veil: false })
}
export function resume() { const p = get().phase; if (p !== 'paused' && p !== 'taken') return; if (get().art) void runPiece(++token); else void runStop(get().idx) }
export const toggle = () => { const p = get().phase; if (p === 'run') pause(); else if (p === 'paused' || p === 'taken') resume(); else if (p === 'title') startGallery() }
export const again = () => { if (get().art) return; void runStop(0) }

/** leave. If the tour ever started, reload so the page is exactly as it was (nothing was saved); otherwise just go. */
export function exitGallery(target = galleryReturnHash()) {
  token++; killRun(); stopCamera(); resetDuck()
  try { resetWorld() } catch { /* ignore */ }
  unlisten(); flags.gallery = false
  idleCursor(false)
  document.removeEventListener('fullscreenchange', onFullscreen)
  try { delete document.documentElement.dataset.art } catch { /* ignore */ }
  if (wentFull && document.fullscreenElement) { wentFull = false; void document.exitFullscreen?.().catch(() => {}) }
  const wasStarted = get().started
  set({ phase: 'off', veil: false, started: false, art: false, piece: null, kind: 'art' })
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
  if (get().art && p !== 'title') { // Art Gallery mode: Space pauses, arrows skip, Esc leaves. Every other key plays (the piano keys are never taken)
    wake()
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === ' ' && tag !== 'BUTTON') { eat(); if (!e.repeat) toggle(); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { eat(); if (!e.repeat) skip(e.key === 'ArrowRight' ? 1 : -1) }
    return
  }
  if (e.key === ' ' && !(tag === 'BUTTON' && p === 'title')) { eat(); toggle(); return }
  if (e.key === 'ArrowRight' && p !== 'title') { eat(); next(); return }
  if (e.key === 'ArrowLeft' && p !== 'title') { eat(); prev(); return }
  if (p === 'run' && e.isTrusted && !CONTROL.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) pause(true) // a musical key: you're playing
}
function onPointer(e: PointerEvent) {
  const p = get().phase
  if (get().art && p !== 'title' && p !== 'off') { wake(); return } // art mode: a tap only brings the controls back; clicks never end the show
  if (get().phase === 'run' && e.isTrusted && (e.target as HTMLElement | null)?.closest?.('.kg-keybed')) pause(true)
}
let listening = false
function listen() {
  if (listening) return
  listening = true
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('pointerdown', onPointer, true)
  offNote = onNote((e) => { // a real MIDI keyboard
    const p = get().phase
    if (get().art) { // anyone playing (MIDI keyboard, computer keys, on-screen keys, a controller) keeps the show going and turns the music down
      if (e.on && (p === 'run' || p === 'paused') && !inGhost()) kidPlayed()
      return
    }
    if (!(e.id >= 0 && e.on)) return
    if (p === 'run') pause(true)
  })
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
  const want = st?.item === 'art' ? (isSeason(st.sub) ? st.sub : 'art') : null
  if (get().art && p !== 'title') { if (want !== get().kind) exitGallery(location.hash || '#/play'); return }
  if (want) { // the address bar asked for Art Gallery mode: its title card (the start needs a click)
    const was = get().started
    token++; killRun(); try { resetWorld() } catch { /* ignore */ }
    openGallery(want === 'art' ? 'art' : 'art/' + want); set({ started: was })
    return
  }
  if (st && p === 'title' && get().art) set({ art: false })
  if (st) { const i = st.item ? stopIndex(st.item) : 0; if (i >= 0) { if (p === 'title') jump(i); else void runStop(i) } return }
  exitGallery(location.hash || '#/play') // the address bar went somewhere else
}
