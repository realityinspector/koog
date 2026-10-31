// Bridges the SONGS game to the shared score store (the sheet-music overlay reads it).
import { setScore, setScorePos, clearScore, useScore } from '../../music/scoreStore'
import type { NoteResult } from '../../music/scoreStore'
import type { Song } from '../songs/songs'
import { LH_BASE } from './layout'
import { getSheetLevel } from '../../music/sheetLevel'

const OWNER = 'songs'
let map: number[] = [] // sounding-note index -> index in song.notes
let mapFor = ''

/** call each frame: cheap unless something changed. `live` = a round is under way. */
export function syncSongScore(song: Song, live: boolean, notes: { st: number; start: number; beats: number }[], idx: number, cursor: number, wait: boolean, done: boolean, lhHits: number[] = []) {
  if (!live) { clearScore(OWNER); return }
  const st = useScore.getState()
  if (st.score?.owner !== OWNER || mapFor !== song.id + getSheetLevel()) {
    map = []; song.notes.forEach((n, i) => { if (n.note != null) map.push(i) })
    mapFor = song.id + getSheetLevel()
    setScore({ owner: OWNER, title: song.title, notes: song.notes, key: song.key, bpm: song.bpm, beatsPerBar: song.beatsPerBar, pickup: song.pickup, style: song.style, harmony: song.harmony }, 0)
  }
  let sp = 0
  if (done) sp = notes.length
  else if (wait) sp = idx
  else { sp = notes.findIndex((n) => n.start + n.beats > cursor); if (sp < 0) sp = notes.length }
  const pos = sp >= notes.length ? song.notes.length : map[sp]
  const cur = useScore.getState()
  let changed = cur.pos !== pos
  const results: Record<number, NoteResult> = {}
  notes.forEach((n, k) => { if (n.st === 1) results[map[k]] = 'hit'; else if (n.st === 2) results[map[k]] = 'miss' })
  for (const k of lhHits) results[LH_BASE + k] = 'hit'
  const rk = Object.keys(results).length
  if (rk !== Object.keys(cur.results).length) changed = true
  if (changed) { setScorePos(pos); useScore.setState({ results }) }
}
if (import.meta.hot) import.meta.hot.accept()
