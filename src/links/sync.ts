// Canonical links, both directions.
//   link  -> state : parse location.hash on load and on hashchange, then set each piece through its own store.
//   state -> link  : keep location.hash equal to toHash(readState()). pushState when the screen or item changes (so Back works),
//                    replaceState for small changes (a key, a visual). Pieces that cannot be read back reliably are left out.
// Sound never starts by itself: anything that plays is armed to begin on the first key or click.
import { parseHash, toHash, toUrl, type HelperMode, type KoogState, type Screen, type BossScreen } from './links'
import { consume as _c, linkNote, useLinkIn, useLinkOut } from './bus'
import { useScreen } from '../layout/screenStore'
import { useProfile } from '../profile/profile'
import { useHarmonyStore } from '../music/harmonyStore'
import { setSheetOn, useSheet } from '../music/scoreStore'
import { SOUNDS, chooseSound, paintKoog, useSound } from '../features/devices/soundChoice'
import { useDuoOpen } from '../features/dj/duoOpen'
import { ensure as ensureDj } from '../features/dj/engine'
import * as mimic from '../features/mimic/engine'
import * as band from '../features/smartband/engine'
import { useMentor } from '../features/mentor/mentorStore'
import { resetVibes, useVibes } from '../music/vibes'
import { resetJudge } from '../music/judge'
import * as beats from '../features/beats/engine'
import { GROOVES } from '../features/beats/grooves'
import { CHALLENGES } from '../features/challenges/defs'
import { useChallengeStore } from '../features/challenges/store'
import { isEmbed } from '../web/webDemo'
import { panicAll } from '../music/panic'
import { releaseAllNotes } from '../music/localNotes'
import { setKodeDock, useKodeDock } from '../features/kode/kodeDock'

void _c

const KID_SCREENS = ['play', 'songs', 'challenges', 'games', 'beats', 'synth', 'log', 'gallery', 'kode']
const BOSS_SCREENS = ['play', 'dj', 'loops', 'drums', 'synth', 'scenes']

// ---------- first key / click ----------
let armed: Array<() => void> = []
let listening = false
const fire = () => { const a = armed; armed = []; stopListening(); a.forEach((f) => { try { f() } catch { /* ignore */ } }) }
function stopListening() { if (!listening) return; listening = false; window.removeEventListener('keydown', fire, true); window.removeEventListener('pointerdown', fire, true) }
function arm(f: () => void) {
  armed.push(f)
  if (listening) return
  listening = true
  window.addEventListener('keydown', fire, true); window.addEventListener('pointerdown', fire, true)
}
function disarm() { armed = []; stopListening(); pendingAlong = null }

function vibesChosen() { try { return localStorage.getItem('koog.vibes.chip') === '1' } catch { return false } }
let pendingAlong: HelperMode | null = null

// ---------- state -> link ----------
const isBoss = () => useProfile.getState().mode === 'dad'

/** Everything about the current moment that a link can say. Leaves out what cannot be read back reliably. */
export function readState(): KoogState {
  const boss = isBoss()
  const sc = useScreen.getState().screen === 'play' && useKodeDock.getState().open && !boss ? 'kode' : useScreen.getState().screen
  const out = useLinkOut.getState()
  const st: KoogState = { screen: (boss ? (BOSS_SCREENS.includes(sc) ? sc : 'play') : (KID_SCREENS.includes(sc) ? sc : 'play')) as Screen | BossScreen }
  if (boss) st.mode = 'boss'
  else {
    if (st.screen === 'songs' && out.song) {
      st.item = out.song.id
      if (out.song.mode) st.songMode = out.song.mode
      if (out.song.mode === 'learn' && out.learn) { st.phrase = out.learn.phrase; st.rung = out.learn.rung }
    } else if (st.screen === 'challenges') st.item = useChallengeStore.getState().active?.def.id
    else if (st.screen === 'games' && out.game) { st.item = out.game; if (out.level) st.level = out.level }
    else if (st.screen === 'beats') st.item = beats.getState().groove.id
    else if (st.screen === 'synth' && out.emu) st.item = out.emu
  }
  // A song, challenge or beat sets the key itself, so it is not part of the link while one is open
  const h = useHarmonyStore.getState()
  if (!st.item) {
    if (h.autoDetect) st.key = 'auto'
    else if (h.key.tonic !== 0 || h.key.scale !== 'major') {
      if (h.key.scale === 'major' || h.key.scale === 'minor') st.key = { tonic: h.key.tonic, scale: h.key.scale }
    }
  }
  if (out.visual && out.visual !== 'fireworks') st.visual = out.visual
  if (out.palette && out.palette !== 'rainbow') st.palette = out.palette
  const m: HelperMode[] = []
  if (useDuoOpen.getState().open) m.push('duo')
  if (band.getState().on) m.push('band')
  if (mimic.getState().on) m.push('mimic')
  if (pendingAlong && !m.includes(pendingAlong)) m.push(pendingAlong)
  if (useMentor.getState().on) m.push('mentor')
  // the Vibes face is on unless switched off, so it only counts once it has been chosen (saved as '1')
  if (useVibes.getState().chip && vibesChosen()) m.push('vibes')
  if (m.length) st.modes = m
  if (useSheet.getState().on) st.sheet = true
  const snd = useSound.getState().id
  if (snd && snd !== 'koog') st.sound = snd
  return st
}

/** the link to exactly this, for the Copy link button */
export const currentUrl = () => galleryHash ? location.origin + location.pathname + galleryHash : toUrl(readState(), location.origin + location.pathname)

// The gallery owns the address bar while it is open (#/gallery/<stopId>); the gallery registers these hooks.
let galleryHash: string | null = null
let galleryReturn = '#/play'
/** where Exit / Esc / Not now should go: the page that was open before the gallery */
export function galleryReturnHash() { return galleryReturn }
function noteGalleryReturn(hash: string) {
  const path = (hash || '').split('?')[0]
  if (path && !path.startsWith('#/gallery')) galleryReturn = path
}
export const galleryHooks: { open?: (id?: string) => void; hash?: (st: KoogState | null) => void } = {}
export function setGalleryHash(h: string | null) {
  if (h) noteGalleryReturn(location.hash)
  galleryHash = h
  if (h && location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h)
}

let applying = false
let forceReplace = false
let timer = 0
function writeNow() {
  if (applying || galleryHash !== null || location.hash.startsWith('#/apps')) return // the Store overlay owns #/apps
  const want = toHash(readState())
  const cur = location.hash
  if (want === cur) return
  if (!cur && want === '#/play') return // the plain start page needs no hash
  const url = location.pathname + location.search + want
  const path = (h: string) => h.split('?')[0] || '#/play'
  if (!forceReplace && path(cur) !== path(want)) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  forceReplace = false
}
const schedule = () => { clearTimeout(timer); timer = window.setTimeout(writeNow, 120) }

// ---------- link -> state ----------
let applyId = 0
function whenScreen(id: string, token: number, fn: () => void) {
  const go = () => { if (token === applyId) fn() }
  if (useScreen.getState().screen === id) return go()
  const off = useScreen.subscribe((s) => { if (s.screen === id) { off(); clearTimeout(t); go() } })
  const t = window.setTimeout(off, 2500)
}

function friendly(p: string): string | null {
  if (/^A Koog link/.test(p)) return null
  if (/^Unknown (screen|Boss screen)/.test(p)) return "That link points to a place Koog doesn't have"
  if (/^Bad key/.test(p)) return "That link mentions a key Koog doesn't know"
  if (/^Unknown helper/.test(p)) return "That link mentions a helper Koog doesn't have"
  return "Part of that link didn't make sense, so Koog skipped it"
}

function turnOnAlong(id: HelperMode) {
  if (id !== 'duo' && useDuoOpen.getState().open) useDuoOpen.getState().setOpen(false)
  if (id !== 'mimic' && mimic.getState().on) void mimic.toggle()
  if (id !== 'band' && band.getState().on) void band.toggle()
  if (id === 'duo' && !useDuoOpen.getState().open) { useDuoOpen.getState().setOpen(true); void ensureDj() }
  if (id === 'band' && !band.getState().on) void band.toggle()
  if (id === 'mimic' && !mimic.getState().on) void mimic.toggle()
}

interface ApplyOpts { immediate?: boolean }
function applyState(st: KoogState, problems: string[], opts: ApplyOpts = {}) {
  const token = ++applyId
  applying = true; forceReplace = true
  disarm()
  useLinkIn.setState({ song: undefined, game: undefined, emu: undefined, visual: undefined, palette: undefined, screen: undefined })
  const first = problems.map(friendly).find(Boolean)
  if (first) linkNote(first)

  const boss = st.mode === 'boss'
  if (boss !== isBoss()) useProfile.getState().setMode(boss ? 'dad' : 'kid')

  const h = useHarmonyStore.getState()
  if (st.key === 'auto') h.setAutoDetect(true)
  else if (st.key) { h.setAutoDetect(false); h.setKey({ tonic: st.key.tonic, scale: st.key.scale }) }

  if (st.sound) {
    if (SOUNDS.some((s) => s.id === st.sound)) {
      chooseSound(st.sound, st.preset)
      // A gallery picture with no setting of its own returns to the everyday Koog patch.
      // A normal link does not: the kid's knobs stay where they left them.
      if (opts.immediate && st.sound === 'koog' && !st.preset) paintKoog()
    } else linkNote("That link mentions a sound Koog doesn't have")
  }
  if (st.sheet) setSheetOn(true)

  if (st.modes?.length) {
    const along = st.modes.filter((m) => m === 'duo' || m === 'band' || m === 'mimic')
    if (st.modes.includes('mentor')) useMentor.getState().setOn(true)
    if (st.modes.includes('vibes')) useVibes.getState().setChip(true)
    if (along.length) {
      if (along.length > 1) linkNote(`Only one play-along helper runs at a time, so Koog picked ${along[0]}`)
      const a = along[0]
      pendingAlong = opts.immediate ? null : a
      if (opts.immediate) turnOnAlong(a) // the gallery already has its click
      else arm(() => { pendingAlong = null; turnOnAlong(a); schedule() }) // these make sound or listen: wait for the first key or click
    }
  }

  if (!boss) {
    if (st.visual) useLinkIn.setState({ visual: st.visual })
    if (st.palette) useLinkIn.setState({ palette: st.palette })
  }
  useLinkIn.setState({ screen: st.screen === 'kode' ? 'play' : st.screen })
  if (!boss) setKodeDock(st.screen === 'kode')
  if (!boss) whenScreen(st.screen, token, () => {
    switch (st.screen) {
      case 'songs': useLinkIn.setState({ song: { id: st.item ?? null, mode: st.songMode, phrase: st.phrase, rung: st.rung } }); break
      case 'games': useLinkIn.setState({ game: { id: st.item ?? null, level: st.level } }); break
      case 'synth': useLinkIn.setState({ emu: st.item ?? null }); break
      case 'challenges': {
        const cs = useChallengeStore.getState()
        if (!st.item) { if (cs.active) cs.quit(); break }
        if (!CHALLENGES.some((c) => c.id === st.item)) { linkNote("That link mentions a challenge Koog doesn't have"); break }
        if (cs.active?.def.id !== st.item) cs.start(st.item, 0)
        break
      }
      case 'beats':
        if (!st.item) break
        if (!GROOVES.some((g) => g.id === st.item)) { linkNote("That link mentions a beat Koog doesn't have"); break }
        beats.setGroove(st.item)
        if (opts.immediate) { if (!beats.getState().playing) beats.start() }
        else arm(() => { if (useScreen.getState().screen === 'beats' && !beats.getState().playing) beats.start() })
        break
    }
  })
  window.setTimeout(() => { if (token === applyId) { applying = false; schedule() } }, 700)
}

function applyHash() {
  const h = location.hash
  if (!h || h === '#') return applyState({ screen: 'play' }, [])
  const { state, problems } = parseHash(h)
  if (state?.screen === 'apps' && !state.mode) return // the Store (src/features/appstore) handles it
  if (state?.screen === 'gallery' && !state.mode) { galleryHooks.open?.(state.item === 'art' && state.sub ? 'art/' + state.sub : state.item); return }
  if (state) applyState(state, problems)
}

/** the gallery drives the app through the same link layer: apply a stop's state without touching the address bar */
export function applyForGallery(st: KoogState) { applyState(st, [], { immediate: true }) }

/** between stops: every helper and engine off, the sheet closed, no notes left ringing (the gallery restores nothing by hand: it never persists) */
export function resetWorld() {
  resetJudge(); resetVibes()
  useHarmonyStore.setState({ streak: 0, accuracy: 1 })
  try { releaseAllNotes() } catch { /* ignore */ }
  try { panicAll() } catch { /* ignore */ }
  disarm()
  if (useDuoOpen.getState().open) useDuoOpen.getState().setOpen(false)
  if (mimic.getState().on) void mimic.toggle()
  if (band.getState().on) void band.toggle()
  if (useMentor.getState().on) useMentor.getState().setOn(false)
  if (beats.getState().playing) beats.stop()
  const cs = useChallengeStore.getState(); if (cs.active) cs.quit()
  setSheetOn(false)
  document.querySelector<HTMLElement>('.vb-patch.on')?.click()
  document.querySelector<HTMLElement>('.kg-dev-chip.open')?.click() // the devices pop-up
  pendingAlong = null
}

/** Start both directions. Returns a cleanup. Does nothing inside the teacher demo's embedded laptop. */
export function startLinks(): () => void {
  if (isEmbed()) return () => {}
  const offs: Array<() => void> = []
  const watch = (sub: (f: () => void) => unknown) => { const off = sub(schedule); if (typeof off === 'function') offs.push(off as () => void) }
  watch((f) => useScreen.subscribe(f)); watch((f) => useProfile.subscribe(f)); watch((f) => useHarmonyStore.subscribe(f))
  watch((f) => useSheet.subscribe(f)); watch((f) => useSound.subscribe(f)); watch((f) => useKodeDock.subscribe(f)); watch((f) => useDuoOpen.subscribe(f))
  watch((f) => useMentor.subscribe(f)); watch((f) => useVibes.subscribe(f)); watch((f) => useChallengeStore.subscribe(f))
  watch((f) => useLinkOut.subscribe(f)); watch(mimic.subscribe); watch(band.subscribe); watch(beats.subscribe)
  const onHash = (e: HashChangeEvent) => {
    try { noteGalleryReturn(new URL(e.oldURL).hash) } catch { /* a synthetic event has no old URL */ }
    if (galleryHash !== null) { const { state } = parseHash(location.hash); galleryHooks.hash?.(state && state.screen === 'gallery' && !state.mode ? state : null); return }
    applyHash()
  }
  window.addEventListener('hashchange', onHash)
  noteGalleryReturn(location.hash)
  if (location.hash.startsWith('#/')) applyHash(); else schedule()
  return () => { offs.forEach((o) => o()); window.removeEventListener('hashchange', onHash); clearTimeout(timer); disarm() }
}
