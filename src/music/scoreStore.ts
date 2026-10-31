// "What piece is being played right now, and where are we in it?" Games and SONGS publish here;
// the sheet-music overlay reads it. When nothing is published, the overlay writes down what you play.
// STABLE API: useScore, setScore(score), setScorePos(pos, result?), clearScore(owner), useSheet { on }, setSheetOn.
import { create } from 'zustand'
import type { Key } from './theory'
import type { SongNote } from '../features/songs/songs'
import type { ArrStyle, HarmonyBar } from './arrange'

export interface Score {
  /** who published it ('songs', 'bachdoom', ...). clearScore only clears your own. */
  owner: string
  title: string
  notes: SongNote[]
  key?: Key
  bpm?: number
  /** beats per bar for bar lines (default 4) */
  beatsPerBar?: number
  /** upbeat beats before the first full bar */
  pickup?: number
  /** left-hand pattern the arranger should prefer (Full level) */
  style?: ArrStyle
  /** real chords for the piece, if known (used instead of generated ones) */
  harmony?: HarmonyBar[]
}
export type NoteResult = 'hit' | 'miss'
export interface ScoreState {
  score: Score | null
  /** index into score.notes of the NEXT note to play */
  pos: number
  /** results so far by note index (for green/red note heads) */
  results: Record<number, NoteResult>
}
function make() { return create<ScoreState>()(() => ({ score: null, pos: 0, results: {} })) }
export const useScore = (import.meta.hot?.data.scoreStore as ReturnType<typeof make> | undefined) ?? make()

export const setScore = (score: Score, pos = 0) => useScore.setState({ score, pos, results: {} })
/** move to `pos`; optionally record how the note at the old position went */
export const setScorePos = (pos: number, result?: NoteResult) => useScore.setState((s) => ({
  pos, results: result ? { ...s.results, [s.pos]: result } : s.results,
}))
export const clearScore = (owner: string) => { if (useScore.getState().score?.owner === owner) useScore.setState({ score: null, pos: 0, results: {} }) }

// Sheet-music overlay on/off (global, remembered).
const SKEY = 'koog.sheet.on'
function makeSheet() {
  let on = false
  try { on = localStorage.getItem(SKEY) === '1' } catch { /* ignore */ }
  return create<{ on: boolean }>()(() => ({ on }))
}
export const useSheet = (import.meta.hot?.data.sheetStore as ReturnType<typeof makeSheet> | undefined) ?? makeSheet()
export const setSheetOn = (on: boolean) => { useSheet.setState({ on }); try { localStorage.setItem(SKEY, on ? '1' : '0') } catch { /* ignore */ } }

if (import.meta.hot) {
  import.meta.hot.data.scoreStore = useScore
  import.meta.hot.data.sheetStore = useSheet
  import.meta.hot.accept()
}
