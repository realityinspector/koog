// Left-hand bonus judging for the GAMES (Easy chords / Full). Wraps lhJudge.ts around a published Score.
// The melody is never touched: a left-hand note only ever earns a bonus, and a miss costs nothing.
// Position is given as an index into score.notes ("the melody note we are on"), same idea as SONGS wait mode.
import { arrange } from '../../music/arrange'
import { getSheetLevel } from '../../music/sheetLevel'
import type { Score } from '../../music/scoreStore'
import { lhAdvance, lhPress, makeLh, type LhState } from './lhJudge'

export class GameLh {
  private st: LhState | null = null
  private lvl = ''
  private starts: number[] = []
  private end = 0
  constructor(private score: Score) {
    let t = 0
    this.starts = score.notes.map((n) => { const s = t; t += n.beats; return s })
    this.end = t
  }
  private ensure(): LhState | null {
    const lv = getSheetLevel()
    if (lv !== this.lvl) {
      this.lvl = lv
      const sc = this.score
      this.st = lv === 'single' || !sc.notes.some((n) => n.note != null) ? null
        : makeLh(arrange({ notes: sc.notes, key: sc.key, beatsPerBar: sc.beatsPerBar, beatUnit: sc.beatUnit, pickup: sc.pickup, title: sc.title, style: sc.style, harmony: sc.harmony }, lv))
    }
    return this.st
  }
  /** Easy or Full is on (so a low note may be left-hand play, not a wrong melody note) */
  get active() { return this.ensure() != null }
  /** a key went down while the melody was at score index `idx`. True if it earned left-hand credit (once per chord window). */
  press(midi: number, idx: number): boolean {
    const st = this.ensure(); if (!st) return false
    const p = idx >= 0 && idx < this.starts.length ? this.starts[idx] : this.end
    lhAdvance(st, p)
    return lhPress(st, midi, p)
  }
}
if (import.meta.hot) import.meta.hot.accept()
