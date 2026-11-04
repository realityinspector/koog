// Koog canonical links: one URL for every system state a parent, teacher or AI helper might want to open.
// PURE: no browser, React or store imports, so the app, the build scripts and the API/MCP server all share it.
//
// Grammar (hash route, so it works on any static host, locally and at any sub-path):
//
//   <origin>/#/<screen>[/<item>[/<sub>]][?<options>]
//
//   #/play                                   free play (the visualizer)
//   #/songs                                  the song list
//   #/songs/<songId>                         one song, ready to play
//   #/songs/<songId>/<wait|flow|learn>       wait = pauses for you, flow = keeps time, learn = the phrase ladder
//   #/challenges[/<challengeId>]             the challenge list, or one challenge started
//   #/games[/<gameId>]                       the games list, or one game opened ("level" option for BachDoom)
//   #/beats[/<beatId>]                       the beat list, or one groove playing
//   #/synth[/<emulatorId>]                   the instruments rack, or one playable emulator open
//   #/synth/timeline                         the year-by-year history of electronic music
//   #/log                                    the build log
//   #/boss/<studio|dj|loops|drums|synth|scenes>    Boss (adult) mode screens
//   #/gallery[/<stopId>]                     the self-playing gallery tour (title card first; the click that starts it also unlocks audio)
//   #/gallery/art                            Art Gallery mode: full screen, calm music, loops forever (title card first, same click rule)
//   #/gallery/art/thanksgiving | christmas   the same, as a holiday playlist (seasonal palettes, falling leaves or snow, string lights, holiday songs)
//
// Options (any screen; defaults are left out of the canonical form):
//   key=c-major | a-minor | f-sharp-major ...   the key Koog listens in ("auto" = detect it)
//   visual=<sceneId>                            the PLAY visual (fireworks, ripples, ...)
//   palette=<paletteId>                         the visual's colours
//   modes=mentor,vibes                          helpers to switch on (duo, band, mimic, mentor, vibes)
//   sheet=on                                    show the sheet music
//   sound=<soundId>                             the piano's sound
//   rung=1..7                                   Learn it: the ladder rung to start on
//   phrase=1..n                                 Learn it: the phrase to start on
//   level=<levelId>                             a game level
//
// Canonical form: lowercase ids, path first, then options in OPTION_ORDER, defaults omitted, list values sorted.
// Two states that mean the same thing always give the same URL.

import { canonEmuId, canonSoundId } from '../features/synth-history/emu/aliases.ts'
export const DEFAULT_ORIGIN = 'https://koog-demo.fly.dev/'

// 'gallery' (added): the self-playing tour. #/gallery opens its title card, #/gallery/<stopId> starts at that stop (ids: src/features/gallery/stops.data.ts),
// #/gallery/art opens Art Gallery mode's card (the item 'art' is reserved: no stop may use it; pieces: src/features/gallery/art.data.ts)
export const SCREENS = ['play', 'songs', 'challenges', 'games', 'beats', 'synth', 'log', 'gallery'] as const
export const BOSS_SCREENS = ['studio', 'dj', 'loops', 'drums', 'synth', 'scenes'] as const
export const SONG_MODES = ['wait', 'flow', 'learn'] as const
export const HELPER_MODES = ['band', 'duo', 'mentor', 'mimic', 'vibes'] as const
export const TONICS = ['c', 'c-sharp', 'd', 'd-sharp', 'e', 'f', 'f-sharp', 'g', 'g-sharp', 'a', 'a-sharp', 'b'] as const
const FLAT_ALIASES: Record<string, string> = { 'd-flat': 'c-sharp', 'e-flat': 'd-sharp', 'g-flat': 'f-sharp', 'a-flat': 'g-sharp', 'b-flat': 'a-sharp' }
export const SCALES = ['major', 'minor'] as const

export type Screen = (typeof SCREENS)[number]
export type BossScreen = (typeof BOSS_SCREENS)[number]
export type SongMode = (typeof SONG_MODES)[number]
export type HelperMode = (typeof HELPER_MODES)[number]
export interface KeySpec { tonic: number; scale: 'major' | 'minor' } // tonic = pitch class 0..11 (0 = C)

export interface KoogState {
  /** 'kid' (default) or 'boss' */
  mode?: 'kid' | 'boss'
  /** kid screen, or a Boss screen when mode = 'boss' */
  screen: Screen | BossScreen
  /** songs: song id; challenges: challenge id; games: game id; beats: beat id; synth: emulator id */
  item?: string
  /** songs only */
  songMode?: SongMode
  rung?: number
  phrase?: number
  level?: string
  key?: KeySpec | 'auto'
  visual?: string
  palette?: string
  modes?: HelperMode[]
  sheet?: boolean
  sound?: string
  /** gallery/art only: a holiday playlist ('thanksgiving' | 'christmas') */
  sub?: string
}

export const OPTION_ORDER = ['key', 'visual', 'palette', 'modes', 'sheet', 'sound', 'phrase', 'rung', 'level'] as const

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const clean = (s: string) => s.trim().toLowerCase()

export function keyToSlug(k: KeySpec | 'auto'): string {
  if (k === 'auto') return 'auto'
  return `${TONICS[((k.tonic % 12) + 12) % 12]}-${k.scale}`
}
export function slugToKey(s: string): KeySpec | 'auto' | null {
  const v = clean(s)
  if (v === 'auto') return 'auto'
  const m = /^([a-g](?:-(?:sharp|flat))?)-(major|minor)$/.exec(v)
  if (!m) return null
  const t = FLAT_ALIASES[m[1]] ?? m[1]
  const tonic = (TONICS as readonly string[]).indexOf(t)
  if (tonic < 0) {
    // e-sharp, b-sharp, c-flat, f-flat: legal names, map by semitone
    const base = (TONICS as readonly string[]).indexOf(m[1][0])
    if (base < 0) return null
    return { tonic: (base + (m[1].endsWith('sharp') ? 1 : -1) + 12) % 12, scale: m[2] as 'major' | 'minor' }
  }
  return { tonic, scale: m[2] as 'major' | 'minor' }
}

/** The hash part ("#/songs/ode/learn?rung=2") for a state. Canonical: same state -> same string. */
export function toHash(s: KoogState): string {
  const path: string[] = []
  if (s.mode === 'boss') path.push('boss', s.screen === 'play' ? 'studio' : s.screen)
  else {
    path.push(s.screen)
    if (s.item && s.screen !== 'play' && s.screen !== 'log') {
      path.push(clean(s.item))
      if (s.screen === 'songs' && s.songMode) path.push(s.songMode)
      if (s.screen === 'gallery' && s.item === 'art' && s.sub) path.push(clean(s.sub))
    }
  }
  const o: Record<string, string> = {}
  if (s.key) o.key = keyToSlug(s.key)
  if (s.visual) o.visual = clean(s.visual)
  if (s.palette) o.palette = clean(s.palette)
  if (s.modes?.length) o.modes = [...new Set(s.modes)].sort().join(',')
  if (s.sheet) o.sheet = 'on'
  if (s.sound) o.sound = clean(s.sound)
  if (s.screen === 'songs' && s.songMode === 'learn') {
    if (s.phrase && s.phrase > 1) o.phrase = String(Math.floor(s.phrase))
    if (s.rung && s.rung > 1) o.rung = String(Math.min(7, Math.floor(s.rung)))
  }
  if (s.level && s.screen === 'games') o.level = clean(s.level)
  const q = OPTION_ORDER.filter((k) => o[k] !== undefined).map((k) => `${k}=${encodeURIComponent(o[k]).replace(/%2C/g, ',')}`).join('&')
  return '#/' + path.join('/') + (q ? '?' + q : '')
}

/** A full canonical URL. origin defaults to the hosted demo; pass location.origin + location.pathname locally. */
export function toUrl(s: KoogState, origin: string = DEFAULT_ORIGIN): string {
  const base = origin.replace(/#.*$/, '').replace(/\?.*$/, '')
  return (base.endsWith('/') ? base : base + '/') + toHash(s)
}

export interface Parsed { state: KoogState | null; problems: string[] }

/** Parse a hash ("#/songs/ode/learn?rung=2"), or a whole URL containing one. Unknown or bad parts are reported, not thrown. */
export function parseHash(input: string): Parsed {
  const problems: string[] = []
  const h = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input
  if (!h.startsWith('/')) return { state: null, problems: h ? ['A Koog link starts with #/'] : [] }
  const [p, q = ''] = h.slice(1).split('?')
  const seg = p.split('/').filter(Boolean).map((x) => clean(decodeURIComponent(x)))
  const st: KoogState = { screen: 'play' }
  if (seg[0] === 'boss') {
    st.mode = 'boss'
    const b = seg[1] ?? 'studio'
    if ((BOSS_SCREENS as readonly string[]).includes(b)) st.screen = b === 'studio' ? 'play' : (b as BossScreen)
    else problems.push(`Unknown Boss screen "${b}"`)
  } else if (seg[0]) {
    if ((SCREENS as readonly string[]).includes(seg[0])) st.screen = seg[0] as Screen
    else problems.push(`Unknown screen "${seg[0]}"`)
    if (seg[1]) {
      if (ID.test(seg[1])) st.item = st.screen === 'synth' ? canonEmuId(seg[1]) : seg[1] // older emulator ids still open (silently renamed)
      else problems.push(`Bad id "${seg[1]}"`)
    }
    if (seg[2]) {
      if (st.screen === 'songs' && (SONG_MODES as readonly string[]).includes(seg[2])) st.songMode = seg[2] as SongMode
      else if (st.screen === 'gallery' && st.item === 'art' && (seg[2] === 'thanksgiving' || seg[2] === 'christmas')) st.sub = seg[2]
      else problems.push(`Unknown option "${seg[2]}" for ${st.screen}`)
    }
  }
  for (const [k, raw] of new URLSearchParams(q)) {
    const v = clean(raw)
    switch (k) {
      case 'key': { const key = slugToKey(v); if (key) st.key = key; else problems.push(`Bad key "${raw}" (try c-major or a-minor)`); break }
      case 'visual': case 'palette': case 'sound': case 'level':
        if (ID.test(v)) st[k] = k === 'sound' ? canonSoundId(v) : v; else problems.push(`Bad ${k} "${raw}"`); break
      case 'modes': {
        const ms = v.split(',').filter(Boolean)
        const ok = ms.filter((m): m is HelperMode => (HELPER_MODES as readonly string[]).includes(m))
        if (ok.length !== ms.length) problems.push(`Unknown helper in modes "${raw}"`)
        if (ok.length) st.modes = ok
        break
      }
      case 'sheet': st.sheet = v === 'on' || v === '1' || v === 'true'; break
      case 'rung': case 'phrase': { const n = Number(v); if (Number.isInteger(n) && n >= 1) st[k] = n; else problems.push(`Bad ${k} "${raw}"`); break }
      default: problems.push(`Unknown option "${k}"`)
    }
  }
  return { state: st, problems }
}

/** Normalise any Koog link to its canonical URL (or null if it isn't one). */
export function canonicalize(url: string, origin: string = DEFAULT_ORIGIN): string | null {
  const { state } = parseHash(url)
  return state ? toUrl(state, origin) : null
}
