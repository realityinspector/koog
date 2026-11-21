// Shared-state invariants (docs/STATE.md): ownership of the key glow and the master clock, one-at-a-time docks, no duplicate
// subscriptions after a hot edit, per-player modules reloading on a profile switch, and source audits that keep new code honest.
// Pure node: no browser, no audio. (The live-app version of these checks is scripts/shots/state-harness-steps.json.)
//   npx --no-install tsx scripts/state-fixtures.ts        (exit 1 on any failure)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A tiny localStorage so the profile modules can be driven in node (must exist BEFORE they are imported).
const mem = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k),
  key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size },
}

let fails = 0, passes = 0
function ok(name: string, cond: boolean, detail?: unknown) { if (cond) passes++; else { fails++; console.log(`FAIL ${name}${detail === undefined ? '' : ': ' + JSON.stringify(detail)}`) } }
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }) }

const { createSlot, createHolds, releaseAll, ownerSnapshot } = await import('../src/music/owners')
const { registerDock, openDocks, closeAllDocks, dockIds } = await import('../src/layout/docks')
const guide = await import('../src/music/guide')
const profile = await import('../src/profile/profile')

// ---------------- last-owner-wins slot (the key glow / the sheet) ----------------
{
  let cleared = 0
  const s = createSlot('t.slot', () => { cleared++ })
  s.claim('a'); s.claim('b')
  ok('slot: a stale owner cannot clear', s.release('a') === false && cleared === 0)
  ok('slot: the current owner clears', s.release('b') === true && cleared === 1 && s.owner() === null)
  s.claim('c'); releaseAll('c')
  ok('slot: releaseAll(owner) frees what that owner holds', s.owner() === null && cleared === 2)
  s.claim('d'); s.force()
  ok('slot: force clears whoever owns it', s.owner() === null && cleared === 3)
  const again = createSlot('t.slot', () => {}) // a hot edit re-creates it: the owner survives
  again.claim('e'); ok('slot: re-creating after a hot edit keeps the owner', createSlot('t.slot', () => {}).owner() === 'e' && again.name === 't.slot')
}

// ---------------- the key glow (music/guide.ts) ----------------
{
  guide.clearGuide()
  guide.setGuideFor('racer', [60], 'next')
  guide.setGuideFor('duo', [62], 'good')
  guide.clearGuideFor('racer') // a late timer from the racer that already left
  eq('guide: a stale clear does not wipe the newer owner', [guide.useGuide.getState().targets, guide.guideOwner()], [[62], 'duo'])
  guide.clearGuideFor('duo')
  eq('guide: the owner exit clears it', [guide.useGuide.getState().targets, guide.guideOwner()], [[], null])
  guide.setGuide([64])
  ok('guide: the old owner-less API still works and records "anon"', guide.guideOwner() === 'anon' && guide.useGuide.getState().targets[0] === 64)
  ;(guide.clearGuide as (e?: unknown) => void)({ type: 'click' }) // used directly as an event handler / timer callback
  eq('guide: clearGuide(event) is a force-clear, not an owner name', guide.useGuide.getState().targets, [])
}

// ---------------- reference-counted holds (the master clock) ----------------
{
  let on = false, starts = 0, stops = 0
  const isOn = () => on
  const start = () => { on = true; starts++ }, stop = () => { on = false; stops++ }
  const h = createHolds('t.clock', start, stop, () => on)
  h.hold('racer'); h.hold('drums'); h.hold('drums')
  ok('holds: first holder starts it, a second hold changes nothing', on && starts === 1 && h.holders().length === 2, h.holders())
  h.release('racer')
  ok('holds: still on while another holder remains (the racer closing no longer stops the drums)', on && stops === 0)
  h.release('drums')
  ok('holds: last holder stops it, and only because a holder started it', !on && stops === 1)
  on = true; starts = 0; stops = 0 // the player pressed START
  h.hold('kode'); h.release('kode')
  ok('holds: a clock the player started is never stopped behind their back', on && stops === 0)
  on = true; h.release('x') // never held: no effect
  const h2 = createHolds('t.clock', start, stop, () => on) // hot edit: holders survive
  on = false; h2.hold('a'); const h3 = createHolds('t.clock', start, stop, () => on)
  ok('holds: re-creating after a hot edit keeps holders and the "we started it" duty', h3.holders().join() === 'a' && h3.weStarted())
  h3.release('a')
  const h4 = createHolds('t.clock4', start, stop, () => on)
  on = false; h4.hold('loops'); h4.release('loops', true)
  ok('holds: keepOn (the looper / a DJ deck still needs it) leaves it running', isOn() === true)
  on = false; h4.hold('a'); h4.hold('b'); releaseAll('a'); ok('holds: releaseAll(owner) drops that owner only', isOn() && h4.holders().join() === 'b'); releaseAll('b')
  ok('holds: releaseAll of the last owner stops it', !isOn())
  ok('owners: snapshot lists slots and holds', 't.slot' in ownerSnapshot().slots && 't.clock' in ownerSnapshot().holds)
}

// ---------------- docks: at most one per group, no stacked subscriptions ----------------
{
  const mk = (id: string, group?: string) => {
    const subs = new Set<() => void>(); let open = false
    const dock = { id, group, isOpen: () => open, close: () => { open = false; subs.forEach((f) => f()) }, subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } } }
    return { dock, set: (v: boolean) => { open = v; [...subs].forEach((f) => f()) }, subs }
  }
  const looper = mk('t.looper', 't.bottom'), kode = mk('t.kode', 't.bottom'), drums = mk('t.drums', 't.bottom'), duo = mk('t.duo')
  for (const d of [looper, kode, drums, duo]) registerDock(d.dock)
  looper.set(true); kode.set(true)
  eq('docks: opening Kode closes the looper', openDocks('t.bottom'), ['t.kode'])
  drums.set(true)
  eq('docks: opening Drums closes Kode', openDocks('t.bottom'), ['t.drums'])
  duo.set(true); looper.set(true)
  ok('docks: a non-exclusive dock (DUO) stays open next to a bottom dock', openDocks().includes('t.duo') && openDocks('t.bottom').join() === 't.looper', openDocks())
  for (const [a, b, c] of [[looper, kode, drums], [kode, drums, looper], [drums, looper, kode]]) { a.set(true); b.set(true); c.set(true) }
  ok('docks: after any sequence of opens at most one bottom dock is open', openDocks('t.bottom').length === 1, openDocks('t.bottom'))
  // a hot edit of the wiring re-registers: the old subscription goes, the count does not grow
  const before = looper.subs.size
  registerDock(looper.dock); registerDock(looper.dock)
  ok('docks: re-registering after a hot edit does not stack subscriptions', looper.subs.size === before, { before, after: looper.subs.size })
  closeAllDocks()
  ok('docks: closeAllDocks closes everything', openDocks().filter((i) => i.startsWith('t.')).length === 0)
  ok('docks: the registry lists them', dockIds().includes('t.looper'))
}

// ---------------- profile registry: named listeners replace, never stack ----------------
{
  let a = 0, b = 0
  const before = profile.profileListenerInfo().count
  const off1 = profile.onProfileChange(() => { a++ }, 't.mod')
  profile.onProfileChange(() => { b++ }, 't.mod') // the hot-edited copy of the same module
  ok('profile: a re-registered name replaces the old listener', profile.profileListenerInfo().count === before + 1)
  const st = profile.useProfile.getState()
  st.create('amy', false); st.create('ben', false)
  ok('profile: only the latest copy runs', a === 0 && b >= 1, { a, b })
  off1()
}

// ---------------- profile switch: each per-player module reloads its own data ----------------
{
  const { useSheetLevel, setSheetLevel } = await import('../src/music/sheetLevel')
  const { useEggs } = await import('../src/features/vibes/eggStore')
  const { useDancerName, setDancerName } = await import('../src/features/vibes/dancerName')
  const motifs = await import('../src/kode/kore/motifs')
  const P = profile.useProfile.getState()
  P.signIn('amy')
  setSheetLevel('full'); setDancerName('Zig'); profile.psave('dancer.eggs', ['x1']); profile.psave('kore.motifs.list', [{ name: 'mine', text: 'notes "c e g"' }])
  P.signIn('ben')
  eq('switch: sheet level reloads for the next kid', useSheetLevel.getState().level, 'single')
  eq('switch: dancer name reloads', useDancerName.getState().name, '')
  eq('switch: eggs found reload', useEggs.getState().found, [])
  setSheetLevel('easy'); setDancerName('Bo')
  P.signIn('amy')
  eq('switch back: sheet level is amy\'s', useSheetLevel.getState().level, 'full')
  eq('switch back: dancer name is amy\'s', useDancerName.getState().name, 'Zig')
  eq('switch back: eggs are amy\'s', useEggs.getState().found, ['x1'])
  ok('switch: motifs module is registered for reloads', profile.profileListenerInfo().names.includes('motifs') && typeof motifs === 'object')
  P.signOut()
  eq('guest: gets its own empty data', useSheetLevel.getState().level, 'single')
  // a value that used to be one key for the whole computer is adopted once per player, not shared
  mem.set('koog.songs.beat', JSON.stringify({ easy: true }))
  P.signIn('amy'); const mine = profile.ploadShared<Record<string, boolean>>('songs.beat', 'koog.songs.beat', {})
  profile.psave('songs.beat', { easy: false }); P.signIn('ben'); const his = profile.ploadShared<Record<string, boolean>>('songs.beat', 'koog.songs.beat', {})
  eq('shared->per-player: the first player adopts the old value', mine, { easy: true })
  eq('shared->per-player: the second player adopts the OLD shared value, not the first player\'s change', his, { easy: true })
  P.signOut()
}

// ---------------- source audits ----------------
const SRC = join(import.meta.dirname, '..', 'src')
function walk(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p) }
  return out
}
const files = walk(SRC).map((p) => ({ p, rel: p.slice(SRC.length + 1), s: readFileSync(p, 'utf8') }))

// 1. a module that caches per-player data (it has module state AND reads/writes pload/psave/pkey) must reload on a profile switch
const READS_ON_DEMAND: Record<string, string> = {
  'features/appstore/storeState.ts': 'recents() reads pload on every call; the module state is the view, not saved data (AppStore is keyed by player)',
  'kode/kore/kv.ts': 'a thin pload/psave pass-through (tests swap it); keeps no data',
  'coach/coachBus.ts': 'seenCount / markSeen read and write pload on every call; the store holds only the line on screen',
}
for (const f of files) {
  if (f.rel === 'profile/profile.ts') continue
  if (!/\b(pload|psave|pkey|kload|ksave)\(/.test(f.s)) continue
  if (!/^(let|var) |\bcreate<|\bcreate\(/m.test(f.s)) continue
  const ok1 = /onProfileChange\(|useProfile\.subscribe\(|useProfile\(/.test(f.s) || f.rel in READS_ON_DEMAND
  ok(`per-player module reloads on a profile switch (or is listed as reading on demand): ${f.rel}`, ok1)
}

// 2. every localStorage key is either per-player (pload/psave/pkey) or on this list of DEVICE-wide settings, each with a reason
const DEVICE_KEYS: Record<string, string> = {
  'koog.active': 'profile: who is signed in', 'koog.profiles': 'profile: the list of players', 'koog.mode': 'kid / Boss mode of this computer',
  'koog.audio': 'volume and mute of this computer (boost is never saved)', 'koog.devices.roles': 'which role each plugged-in MIDI device has',
  'koog.timingOffsets': 'measured latency of this computer\'s devices', 'koog.pedal': 'which key/pedal this computer has and what it does',
  'koog.typing.on': 'computer-keyboard piano: a setting of this computer', 'koog.mode.screen': 'last screen (reload restore)',
  'koog.sheet.on': 'sheet overlay visible (a screen layout choice)', 'koog.sheet.names': 'sheet note names (screen layout choice)',
  'koog.kb.range': 'on-screen keyboard range', 'koog.kb.names': 'on-screen keyboard note names', 'koog.kb.typing': 'on-screen keyboard typing hint',
  'koog.vibes.chip': 'Vibes face visible', 'koog.dj.open': 'DUO strip open', 'koog.dj.map': 'learned DJ controller map (hardware)', 'koog.dj.maps': 'named DJ controller maps (hardware)',
  'koog.band': 'the shared BAND record, shared on purpose (co-op)', 'koog.loop.view': 'simple / advanced looper layout', 'koog.songs.lyrics': 'lyrics on/off',
  'koog.padplay.top': 'Game pads dock position', 'koog.padplay.map': 'Game pads mapping', 'koog.rq.seen': 'LEGACY shared key: adopted per player by ploadShared()', 'koog.songs.beat': 'LEGACY shared key: adopted per player by ploadShared()',
  'koog.viz.mode': 'visualizer look', 'koog.viz.emoji': 'visualizer look', 'koog.viz.sparkle': 'visualizer look', 'koog.viz.theme': 'visualizer look', 'koog.viz.patch': 'visualizer patch panel open',
  'koog.webdemo': 'sessionStorage: web demo flag',
}
const seen = new Set<string>()
for (const f of files) {
  if (f.rel === 'profile/profile.ts' || f.rel === 'profile/ProfileBar.tsx') continue
  for (const m of f.s.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"`]([^'"`$]+)['"`]/g)) seen.add(m[1])
  for (const m of f.s.matchAll(/\b(?:[A-Z_]*KEY|SKEY|OKEY|SEEN|MAPS_KEY|ON_KEY|VIEW_KEY|NAMES_KEY|LYR_KEY|BEAT_KEY|OPEN_KEY|BAND_KEY|OVERRIDE_KEY|WEB_KEY)\s*=\s*['"`](koog\.[^'"`]+)['"`]/g)) seen.add(m[1])
}
const known = (k: string) => k in DEVICE_KEYS || k.startsWith('koog.ctl.') || k.startsWith('koog.perf') || k.startsWith('koog:state')
for (const k of seen) ok(`localStorage key "${k}" is per-player (pload/psave) or listed as a device-wide setting in scripts/state-fixtures.ts`, known(k))

// 3. nobody but the clock's own owners may start or stop the master clock by hand: games and engines hold it (acquireClock / releaseClock)
const CLOCK_RAW_OK = new Set(['music/masterClock.ts', 'features/loopstation/loopEngine.ts', 'features/pro/ProParts.tsx', 'features/pro/ProStudio.tsx', 'features/pedal/pedal.ts'])
for (const f of files) {
  if (CLOCK_RAW_OK.has(f.rel)) continue
  ok(`no raw startMaster/stopMaster outside the clock's owners (use acquireClock / releaseClock): ${f.rel}`, !/\b(startMaster|stopMaster)\(/.test(f.s.replace(/\/\/.*$/gm, '')))
}

// 4. modules that patch globals must keep the patch state on import.meta.hot.data
for (const f of files) if (/Storage\.prototype/.test(f.s) && !/import\.meta\.hot\?*\.data/.test(f.s)) ok(`global patch keeps its state on import.meta.hot.data: ${f.rel}`, false)

console.log(`state fixtures: ${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
