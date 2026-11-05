// The Kode player: plays a Program bar by bar on the master clock, and swaps in new code only at a bar line. PURE.
// It owns no timers and no audio. The app calls tick() about every 20 ms; sounds go out through a Sink with their exact start time
// (the sink hands them to the audio clock), so nothing here depends on how late a timer fires.
//   run(program)  the new code starts at the NEXT bar line; what was playing finishes its bar first (no cut, no click)
//   stop()        everything ends now (the sink silences what it already handed out)
import { CYCLE_BEATS, type MotifResolver, type PlanEvent, type Program } from './types'
import { planCycle } from './query'

export interface Clock {
  /** absolute beat position at performance.now() time t */
  beatPos(t: number): number
  /** performance.now() ms at which absolute beat b sounds */
  timeOfBeat(b: number): number
  bpm(): number
  setBpm(b: number): void
}
export interface Sink {
  /** one sound: starts at performance.now() time `atMs`, lasts `durMs` */
  event(ev: PlanEvent, atMs: number, durMs: number, absBeat: number): void
  stop(): void
}
export interface Mark { atMs: number; endMs: number; s: number; e: number; layer: number }

interface Slot { prog: Program; cycle: number }

export class Runner {
  active: Slot | null = null
  pending: Slot | null = null
  private cursor = 0
  private marks: Mark[] = []
  constructor(private clock: Clock, private sink: Sink, private lookMs = 100, private motifs?: MotifResolver) {}

  isPlaying() { return !!(this.active || this.pending) }
  /** the bar number the pending code starts on (absolute), or null */
  pendingCycle() { return this.pending ? this.pending.cycle : null }
  activeSource() { return this.active?.prog.src ?? null }

  /** returns the absolute bar number the new code starts on */
  run(prog: Program, nowMs: number): number {
    const idle = !this.active && !this.pending
    if (idle) this.cursor = this.clock.beatPos(nowMs)
    const cycle = Math.max(Math.ceil(this.clock.beatPos(nowMs) / CYCLE_BEATS - 1e-9), Math.ceil(this.cursor / CYCLE_BEATS - 1e-9))
    this.pending = { prog, cycle }
    return cycle
  }

  stop() {
    this.active = null; this.pending = null; this.marks.length = 0
    this.sink.stop()
  }

  tick(nowMs: number) {
    if (!this.active && !this.pending) return
    const to = this.clock.beatPos(nowMs + this.lookMs)
    if (to < this.cursor - 0.01) this.cursor = to // the clock restarted: pick up from where it is now
    else if (to - this.cursor > CYCLE_BEATS) this.cursor = to - 0.5 // we stalled: skip what is stale instead of bursting it out
    if (to <= this.cursor) return
    for (let c = Math.floor(this.cursor / CYCLE_BEATS + 1e-9); c * CYCLE_BEATS < to; c++) {
      if (this.pending && c >= this.pending.cycle) {
        this.active = { prog: this.pending.prog, cycle: this.pending.cycle }
        this.pending = null
        if (this.active.prog.tempo !== undefined && Math.abs(this.active.prog.tempo - this.clock.bpm()) > 0.01) this.clock.setBpm(this.active.prog.tempo)
      }
      if (!this.active) continue
      const base = c * CYCLE_BEATS
      for (const ev of planCycle(this.active.prog, c - this.active.cycle, this.motifs)) {
        const abs = base + ev.beat
        if (abs < this.cursor - 1e-9 || abs >= to) continue
        const at = this.clock.timeOfBeat(abs)
        const durMs = ev.dur * (60000 / this.clock.bpm())
        this.sink.event(ev, at, durMs, abs)
        this.marks.push({ atMs: at, endMs: at + durMs, s: ev.s, e: ev.e, layer: ev.layer })
      }
    }
    this.cursor = to
    if (this.marks.length > 600) this.marks.splice(0, this.marks.length - 400)
  }

  /** the source ranges sounding at `nowMs` (for the highlight) */
  activeMarks(nowMs: number): Mark[] {
    const keep = nowMs - 3000
    if (this.marks.length && this.marks[0].endMs < keep) this.marks = this.marks.filter((m) => m.endMs >= keep)
    return this.marks.filter((m) => m.atMs <= nowMs && nowMs < m.endMs)
  }
}
