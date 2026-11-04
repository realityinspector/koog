// Harvest Feast + Light the Tree: shared data. Pure module, no state.
import { pload, psave } from '../../../profile/profile'
import { HOLIDAY_ORDER, type Season } from '../../songs/holidaySongs'
import { SONGS, type Song } from '../../songs/songs'
import { songPhrases } from '../phraseKit'
import type { Phrase } from '../../../music/phrases'

export type HolidayGame = 'feast' | 'tree'
export const GAME_SEASON: Record<HolidayGame, Season> = { feast: 'thanksgiving', tree: 'christmas' }

export interface Level {
  n: 1 | 2 | 3 | 4 | 5 | 6
  id: 'hunt' | 'follow' | 'echo' | 'memory' | 'full' | 'master'
  name: string
  icon: string
  /** one-line rule, shown on the rung */
  rule: string
  /** coaching line shown while playing */
  coach: string
  /** the sheet music is shown on this rung */
  sheet: boolean
  /** keys glow on this rung */
  keys: boolean
}
export const LEVELS: Level[] = [
  { n: 1, id: 'hunt', name: 'Hunt & Peck', icon: '🔍', rule: 'The next key glows. No timer, any speed.', coach: 'Find the glowing key. Take your time.', sheet: true, keys: true },
  { n: 2, id: 'follow', name: 'Follow', icon: '👀', rule: 'Keys glow for a moment, then fade.', coach: 'Watch for the glow, then play it before it fades.', sheet: true, keys: true },
  { n: 3, id: 'echo', name: 'Echo', icon: '👂', rule: 'Listen to a phrase, then play it back.', coach: 'Listen first. Then play it back.', sheet: true, keys: false },
  { n: 4, id: 'memory', name: 'Memory', icon: '🧠', rule: 'Phrase by phrase, no hints. A peek costs a star.', coach: 'Play it from memory. A peek costs a star.', sheet: false, keys: false },
  { n: 5, id: 'full', name: 'Play full', icon: '🎼', rule: 'The whole song from memory, your own pace.', coach: 'Play the whole song from memory. A slip just waits for the right note.', sheet: false, keys: false },
  { n: 6, id: 'master', name: 'Master', icon: '👑', rule: 'The whole song from memory, in time.', coach: 'Play the whole song from memory, with the beat.', sheet: false, keys: false },
]
export const MASTER_PASS = 0.8
export const NLEV = LEVELS.length

/** the one-line goal each level opens with */
export function goalFor(level: Level, game: HolidayGame, count: number, total: number): string {
  const verb = game === 'feast' ? `set ${count} ${count === 1 ? 'dish' : 'dishes'} on the table` : `hang ${count} ${count === 1 ? 'ornament' : 'ornaments'} on the tree`
  switch (level.id) {
    case 'hunt': return `Play the glowing keys to ${verb}. No timer, any speed.`
    case 'follow': return `Play each key as it glows, before it fades, to ${verb}.`
    case 'echo': return `Listen to each phrase, then play it back, to ${verb}.`
    case 'memory': return `Play each phrase from memory, with no hints, to ${verb}. A peek costs a star.`
    case 'full': return `Play all ${total} notes of the song from memory, no hints, at your own pace. ${game === 'feast' ? 'Serve the turkey!' : 'Put the star on the tree!'}`
    default: return `Play the whole song from memory, in time with the beat. Land 80% of ${total} notes to win.`
  }
}

export interface SongProg {
  /** highest level you may play (1..6) */
  unlocked: number
  /** levels completed at least once */
  done: boolean[]
  /** best stars (0..3) per level */
  stars: number[]
  /** phrases already nailed in a level you have not finished yet (so you can stop and come back) */
  nailed: Record<string, number[]>
  /** best Master accuracy, 0..100 */
  master: number
}
export const newProg = (): SongProg => ({ unlocked: 1, done: LEVELS.map(() => false), stars: LEVELS.map(() => 0), nailed: {}, master: 0 })

const KEY = 'holidayGames'
type All = Record<string, SongProg>
export function loadAll(): All { const v = pload<All>(KEY, {}); return v && typeof v === 'object' ? v : {} }
export function loadProg(songId: string): SongProg {
  const p = loadAll()[songId]
  if (!p) return newProg()
  const b = newProg()
  let done = Array.isArray(p.done) ? p.done.slice() : [], stars = Array.isArray(p.stars) ? p.stars.slice() : [], unlocked = Number(p.unlocked) || 1
  if (done.length === 5) { done = [...done.slice(0, 4), false, done[4]]; stars = [...stars.slice(0, 4), 0, stars[4] ?? 0]; if (unlocked >= 5) unlocked = 6 } // old 5-rung saves: Master moved to rung 6
  return {
    unlocked: Math.max(1, Math.min(NLEV, unlocked)),
    done: b.done.map((_, i) => !!done[i]), stars: b.stars.map((_, i) => Math.max(0, Math.min(3, Number(stars[i]) || 0))),
    nailed: p.nailed && typeof p.nailed === 'object' ? p.nailed : {}, master: Math.max(0, Math.min(100, Number(p.master) || 0)),
  }
}
export function saveProg(songId: string, p: SongProg) { const all = loadAll(); all[songId] = p; psave(KEY, all) }

/** the songs a game offers, in order */
export function songsFor(game: HolidayGame): Song[] {
  return HOLIDAY_ORDER[GAME_SEASON[game]].map((id) => SONGS.find((s) => s.id === id)).filter((s): s is Song => !!s)
}
/** phrases of a song: small enough to hold in your head (a few notes each) */
export function phrasesOf(songId: string): Phrase[] { return songPhrases(songId, 2).filter((p) => p.notes.length >= 2) }

/** 0..100: how well you know a song (levels done count most, stars the rest) */
export function progressPct(p: SongProg): number { return Math.round(100 * (0.6 * (p.done.filter(Boolean).length / NLEV) + 0.4 * (p.stars.reduce((a, b) => a + b, 0) / (NLEV * 3)))) }
/** the nudge on the song picker */
export function nextUp(p: SongProg): string {
  const k = p.done.indexOf(false)
  if (k < 0) return p.stars.some((x) => x < 3) ? 'Everything done. Go for 3 stars!' : 'Mastered!'
  return `Next up: ${LEVELS[k].icon} ${LEVELS[k].name}`
}
export const dishFor = (i: number) => DISHES[i % DISHES.length]
export const DISHES = ['🥧', '🍗', '🥔', '🌽', '🥗', '🍞', '🍠', '🥕', '🍎', '🫓', '🥦', '🍇']
export const ORNAMENT_COLORS = ['#e5484d', '#f5c542', '#3ea6ff', '#c084fc', '#34d399', '#fb923c', '#f472b6', '#a3e635']
