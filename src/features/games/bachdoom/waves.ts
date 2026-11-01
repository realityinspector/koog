// PHRASE WAVES: a Galaga-style level type for BachDoom.
// A short phrase (2 notes up to a whole line) is taught first: a formation of demons hovers at the top of the view,
// one demon per note, and each pulses on its beat while the phrase plays (phraseEngine.demo). Then the formation DIVES:
// each demon swoops at the player so it reaches the gold "strike ring" exactly when its note is due. The kid must play
// the right note inside the rung's timing window to shoot it. Anything else (wrong note, too early, too late, nothing)
// lets that demon finish its dive and bite (a big HARMONY loss) and BREAKS the phrase: the formation swirls back, an extra
// demon joins, and the phrase starts over. A clean pass shatters the formation into golden notes.
// All timing is on the performance.now() clock, the same one the judge stamps notes with (NoteGrade.t).
// Mastery is recorded through src/music/phraseEngine.ts (a "shadow" attempt grades the same notes), so it counts in SONGS too.
import { PC_NAMES, pc } from '../../../music/theory'
import { phraseEngine } from '../../../music/phraseEngine'
import { RUNGS, clearPhraseView, setPhraseView, usePhraseView } from '../../../music/phrases'
import type { Phrase, Rung } from '../../../music/phrases'
import { clearGuide, setGuide, useGuide } from '../../../music/guide'
import { clearScore, setScore } from '../../../music/scoreStore'
import { getSheetLevel } from '../../../music/sheetLevel'
import type { NoteGrade } from '../../../music/judge'
import { resolvePhrase } from './levels'
import type { Demon, Game } from './game'

export type WaveRung = 'follow' | 'echo' | 'memory' | 'timed' | 'blind' | 'hands'
export interface RungCfg { name: string; win: number; guide: 'lit' | 'flash' | 'none'; labels: boolean; sheet: boolean; blurb: string }
/** the timing window (ms either side of the beat), what helps the kid, and whether the sheet is shown, per rung */
export const RUNG_CFG: Record<WaveRung, RungCfg> = {
  follow: { name: 'FOLLOW', win: 300, guide: 'lit', labels: true, sheet: true, blurb: 'PLAY THE LIT KEY AS ITS DEMON SWOOPS' },
  echo: { name: 'ECHO', win: 240, guide: 'flash', labels: true, sheet: true, blurb: 'THE KEY ONLY FLASHES. REMEMBER IT!' },
  memory: { name: 'MEMORY', win: 200, guide: 'none', labels: false, sheet: true, blurb: 'NO KEY HELP. READ THE SHEET MUSIC!' },
  timed: { name: 'TIMED', win: 120, guide: 'none', labels: false, sheet: true, blurb: 'STRICT TIMING: HIT THE RING ON THE BEAT!' },
  blind: { name: 'BLIND BONUS', win: 120, guide: 'none', labels: false, sheet: false, blurb: 'BONUS: NO SHEET MUSIC AT ALL!' },
  hands: { name: 'BOTH HANDS', win: 120, guide: 'none', labels: false, sheet: true, blurb: 'LEFT HAND CHORD ON BEAT ONE, THEN THE TUNE' },
}
const LADDER: WaveRung[] = ['follow', 'echo', 'memory', 'timed', 'blind']
const DIFF_WIN = { story: 1.6, normal: 1, ultra: 0.8 } as const
/** strike ring and bite distances, in front of the player */
const DS = 3.1, DB = 2.0, ZS = 0.02
const ENTER_MS = 1000, BACK_MS = 1100

type WState = 'idle' | 'enter' | 'teach' | 'ready' | 'dive' | 'win' | 'regroup'
interface Slot { lat: number; dist: number; z: number }
export interface FD {
  d: Demon; i: number; note: number; beat: number; extra: boolean
  slot: Slot
  due: number; biteAt: number
  /** 0 waiting, 1 shot, 2 failed (the demon is finishing its dive) */
  res: 0 | 1 | 2
  mode: 'enter' | 'form' | 'dive' | 'back'
  t0: number
  from: Slot
  sw: number
  bit: boolean; perfect: boolean; melOk: boolean; melDt: number; lhOk: boolean
}

export class WaveRun {
  state: WState = 'idle'
  fds: FD[] = []
  phrase!: Phrase
  slow = 1
  ladder: WaveRung[] = []
  wi = 0
  rung: WaveRung = 'follow'
  extra = 0
  breaks = 0
  totalBreaks = 0
  chain = 0
  /** lead (ms a dive takes to reach the strike ring) and the active timing window (ms) */
  L = 1000; W = 200
  /** HUD: how long to keep a big banner, and the last result line */
  stateT = 0
  hasLh = false
  private beatMs = 500
  private token = 0
  private lastNow = 0
  private shadow: { cancel(): void } | null = null
  private regroupEnd = 0
  private pulsed = 0
  private unsubView: (() => void) | null = null
  private kinds: Demon['kind'][] = []
  private tmp = { x: 0, y: 0 }

  constructor(private g: Game) {
    const r = resolvePhrase(g.spec)
    this.phrase = r.phrase; this.slow = r.slow
    this.beatMs = 60000 / g.piece.bpm
    this.kinds = g.spec.demons.length ? g.spec.demons : ['imp']
  }

  // ------------------------------------------------------------------ lifecycle
  /** the level was (re)started: forget everything */
  reset() {
    this.stop()
    this.token++
    this.state = 'idle'; this.fds = []; this.wi = 0; this.extra = 0; this.breaks = 0; this.totalBreaks = 0; this.chain = 0
    this.lastNow = 0
  }
  /** leave: stop the engine's demo/attempt and drop the guide */
  stop() {
    this.token++
    this.unsubView?.(); this.unsubView = null
    this.shadow?.cancel(); this.shadow = null
    phraseEngine.stopAll()
    clearGuide()
  }
  dispose() { this.stop(); this.state = 'idle' }

  get rungCfg() { return RUNG_CFG[this.rung] }
  get total() { return this.ladder.length }
  get showLabels() { return this.state === 'teach' || this.state === 'ready' || this.state === 'enter' || this.rungCfg.labels }
  /** the demon the kid should shoot next (first one not yet shot), during a dive */
  get cur(): FD | null { if (this.state !== 'dive') return null; for (const f of this.fds) if (f.res === 0) return f; return null }
  get target(): Demon | null { return this.cur?.d ?? null }
  get inDanger() { const c = this.cur; return !!c && performance.now() > c.due - this.L * 0.25 }
  upcoming(n: number, out: number[]) {
    out.length = 0
    if (!this.showLabels) return
    for (const f of this.fds) { if (out.length >= n) break; if (f.res !== 1 && !f.extra) out.push(f.note) }
  }

  /** the level's camera has arrived: build the ladder from what this kid already knows and start the first wave */
  begin() {
    if (this.state !== 'idle') return
    const g = this.g
    const m = phraseEngine.mastery(this.phrase.id)
    const mi = RUNGS.indexOf(m.rung)
    const start = Math.max(0, Math.min(3, mi - 1))
    this.hasLh = !!g.lh && g.lh.active
    this.ladder = LADDER.slice(start)
    if (this.hasLh) this.ladder.push('hands')
    this.wi = 0
    this.newWave()
  }

  private win() { return Math.max(70, Math.round(RUNG_CFG[this.rung].win * DIFF_WIN[this.g.diff])) }
  private count() { return this.phrase.notes.length + this.extra }

  private slotOf(i: number, n: number): Slot {
    const perRow = n <= 5 ? n : Math.ceil(n / 2)
    const row = Math.floor(i / perRow), col = i % perRow
    const cols = row === 0 ? perRow : n - perRow
    const sp = cols <= 3 ? 2.1 : Math.min(1.6, 6.6 / Math.max(1, cols - 1))
    const mid = (cols - 1) / 2
    const arc = mid > 0 ? 1 - ((col - mid) / mid) ** 2 : 1
    return { lat: (col - mid) * sp + (row ? sp * 0.5 : 0), dist: 5.4 + row * 0.4, z: (n <= 5 ? 0.62 : 0.88) - row * 0.42 + arc * 0.1 }
  }

  private makeDemon(i: number): Demon {
    const kind = this.kinds[i % this.kinds.length]
    return { kind, chunk: i, room: 0, hp: 1, maxHp: 1, baseLat: 0, lat: 0, dist: 8, spawnDist: 8, state: 0, t: i * 0.7, hurtT: 0, hurtCool: 0, lungeT: 0, biteT: 9, dieT: 0, kb: 0, sq: 0, vhp: 1, pipT: 0, pipN: 0, dying: false, wv: true, fz: 2, sc: 0.72, pulse: 0 }
  }

  private noteFor(i: number): { note: number; beat: number } {
    const ns = this.phrase.notes
    if (i < ns.length) return { note: ns[i].note, beat: ns[i].beat }
    const last = ns[ns.length - 1]
    return { note: last.note, beat: last.beat + (i - ns.length + 1) }
  }

  private spawn(i: number, n: number, now: number, delay = 0): FD {
    const { note, beat } = this.noteFor(i)
    const slot = this.slotOf(i, n)
    const sw = i % 2 ? -1 : 1
    const from = { lat: slot.lat - sw * 3.2, dist: slot.dist + 2.6, z: slot.z + 1.3 }
    const dm = this.makeDemon(i)
    if (n > 5) dm.sc = 0.58
    return { d: dm, i, note, beat, extra: i >= this.phrase.notes.length, slot, due: 0, biteAt: 0, res: 0, mode: 'enter', t0: now + delay, from, sw, bit: false, perfect: false, melOk: false, melDt: 0, lhOk: false }
  }

  /** a fresh formation for the wave `wi` (flies in from the top) */
  private newWave() {
    const g = this.g, now = performance.now()
    this.rung = this.ladder[this.wi]
    this.extra = 0; this.breaks = 0
    const n = this.count()
    this.fds = Array.from({ length: n }, (_, i) => this.spawn(i, n, now, i * 90))
    g.demons = this.fds.map((f) => f.d)
    this.W = this.win()
    const bm = this.beatMs
    this.L = Math.max(900, Math.min(1500, bm * 1.5)) * (g.diff === 'story' ? 1.25 : 1)
    this.state = 'enter'; this.stateT = now
    this.resetSheet()
    g.ptr = 0
    g.addPop('WAVE ' + (this.wi + 1) + ' OF ' + this.ladder.length + ': ' + this.rungCfg.name, '#ffd76c', true, undefined, 0.56)
    g.addPop(this.rungCfg.blurb, '#fff3d0', false, undefined, 0.66)
  }

  // ------------------------------------------------------------------ sheet and guide
  private resetSheet() {
    const g = this.g
    if (this.rungCfg.sheet && g.score0) { setScore(g.score0, g.piece.scoreIdx[0] ?? 0); setPhraseView({ hideSheet: false }) }
    else { clearScore('bachdoom'); clearScore('phrase'); setPhraseView({ hideSheet: true }) }
  }
  /** keep the keybed guide matching the rung (per frame, but only touching the store when it differs) */
  syncGuide() {
    if (this.state === 'teach') return
    const now = performance.now(), c = this.cur
    let want: number | null = null
    if (c) {
      const mode = this.rungCfg.guide
      if (mode === 'lit' || this.breaks >= 2) want = c.note
      else if (mode === 'flash' && now >= c.due - this.L - 100 && now < c.due - this.L + 520) want = c.note
    }
    const cur = useGuide.getState().targets
    if (want == null) { if (cur.length) clearGuide() }
    else if (cur.length !== 1 || cur[0] !== want) setGuide([want], c && now > c.due - this.L * 0.3 ? 'danger' : 'next')
  }

  // ------------------------------------------------------------------ teaching
  private startTeach() {
    const g = this.g, tok = ++this.token
    this.state = 'teach'; this.stateT = performance.now()
    this.pulsed = 0
    this.resetSheet()
    g.addPop('WATCH AND LISTEN...', '#8fd4ff', true, undefined, 0.58)
    // each demon pulses when the engine's demo reaches its note (the engine publishes the note index)
    this.unsubView?.()
    this.unsubView = usePhraseView.subscribe((s) => {
      if (this.state !== 'teach' || this.token !== tok) return
      if (s.index === this.pulsed && this.pulsed < this.phrase.notes.length) { this.pulse(this.pulsed); this.pulsed++ }
    })
    const bpm = g.piece.bpm / this.slow
    const first = phraseEngine.mastery(this.phrase.id).rung === 'listen'
    // the very first hearing of a brand-new phrase is a real 'listen' attempt: it records the first rung in SONGS too
    const done = first ? phraseEngine.attempt(this.phrase, 'listen', { bpm }).done.then(() => undefined) : phraseEngine.demo(this.phrase, bpm)
    const last = this.phrase.notes[this.phrase.notes.length - 1]
    const dur = (last.beat + last.beats) * this.slow * this.beatMs
    const finish = () => { if (this.token === tok && this.state === 'teach') { this.unsubView?.(); this.unsubView = null; this.afterTeach() } }
    void done.then(() => setTimeout(finish, 350), () => finish())
    setTimeout(finish, dur + 4000)
  }
  private pulse(i: number) {
    const f = this.fds[i]
    if (f) f.d.pulse = 0.42
  }
  private afterTeach() {
    this.resetSheet()
    this.state = 'ready'; this.stateT = performance.now()
    this.g.addPop('NOW YOU!', '#ffd76c', true, undefined, 0.58)
    this.g.ptr = 0
  }

  // ------------------------------------------------------------------ the dive
  private startPass() {
    const g = this.g, now = performance.now()
    const t0 = now + this.L + 450
    this.W = this.win()
    for (const f of this.fds) {
      f.due = t0 + f.beat * this.slow * this.beatMs
      f.biteAt = f.due + this.W + 320
      f.res = 0; f.bit = false; f.perfect = false; f.melOk = false; f.lhOk = false; f.mode = 'dive'
      const d = f.d
      d.state = 0; d.dying = false; d.hp = 1; d.vhp = 1; d.dieT = 0; d.kb = 0; d.biting = false
    }
    g.ptr = 0
    this.resetSheet()
    this.state = 'dive'; this.stateT = now
    // the shadow attempt grades the same notes for the phrase engine and records mastery (never above what the kid has reached)
    this.shadow?.cancel()
    const m = phraseEngine.mastery(this.phrase.id)
    const mi = RUNGS.indexOf(m.rung), wi = RUNGS.indexOf(this.rung as Rung)
    // (the 'hands' wave only records once the kid has reached 'hands' there: lower engine rungs grade a left-hand note as a wrong one)
    if (mi > 0 && (this.rung !== 'hands' || m.rung === 'hands')) {
      const rung = RUNGS[Math.min(mi, wi)]
      const bpm = g.piece.bpm / this.slow
      this.shadow = phraseEngine.attempt(this.phrase, rung, {
        bpm, startAt: t0, timingWindowMs: this.W,
        onEvent: (e) => { if (e.type === 'climb') g.addPop('PHRASE RANK UP: ' + e.to.toUpperCase() + '!', '#8fd4ff', false, undefined, 0.7) },
      })
      this.resetSheet()
    }
    this.syncGuide()
  }

  /** a note from the judge, during a dive */
  onNote(gr: NoteGrade) {
    const g = this.g
    if (this.state !== 'dive') return
    const c = this.cur
    if (!c) return
    const now = gr.t, W = this.W, exp = c.note
    // left hand: a low chord tone never costs the tune; on the 'hands' rung the first demon needs it
    if (g.lh && g.lh.active && gr.note < exp) {
      // the engine's lower rungs would grade this low note as wrong: this pass is not recorded
      if (this.rung !== 'hands' && this.shadow) { this.shadow.cancel(); this.shadow = null }
      const f0 = this.fds[0]
      if (this.rung === 'hands' && f0.res === 0 && !f0.lhOk && now >= f0.due - 600 && now <= f0.due + W + 400) {
        if (g.lh.press(gr.note, 0)) { f0.lhOk = true; g.addPop('LEFT HAND!', '#8fd4ff', false, undefined, 0.62, 0.3); if (f0.melOk) this.hit(f0, f0.melDt) }
      } else if (g.lh.press(gr.note, g.piece.scoreIdx[c.i] ?? -1)) g.armor = Math.min(100, g.armor + 6)
      return
    }
    if (gr.chordMember) return
    if (now < c.due - this.L - 120) return // before its dive began: not part of this phrase
    const dt = now - c.due
    const ok = g.diff === 'story' ? pc(gr.note) === pc(exp) : gr.note === exp
    if (!ok) {
      const same = pc(gr.note) === pc(exp) && g.diff !== 'story'
      this.fail(c, 'wrong', same ? 'RIGHT NOTE, WRONG OCTAVE!' : 'WRONG: THAT WAS ' + PC_NAMES[pc(gr.note)] + ', NEEDED ' + PC_NAMES[pc(exp)])
    } else if (Math.abs(dt) <= W) {
      if (this.rung === 'hands' && c.i === 0 && !c.lhOk) { c.melOk = true; c.melDt = dt; return }
      this.hit(c, dt)
    } else if (dt < 0) this.fail(c, 'early', 'TOO EARLY ← ' + Math.round(-dt) + 'MS')
    else this.fail(c, 'late', 'LATE → ' + Math.round(dt) + 'MS')
  }

  /** a feedback pop at the demon (just under it, so it is never cut off at the top of the view) */
  private worldPop(f: FD, text: string, col: string, big: boolean, dz = -0.05) {
    const g = this.g
    g.demonPos(f.d, this.tmp)
    g.addPop(text, col, big, { x: this.tmp.x, y: this.tmp.y, z: (f.d.fz ?? 0) + dz })
  }

  private hit(f: FD, dt: number) {
    const g = this.g
    f.res = 1
    f.perfect = Math.abs(dt) <= Math.max(45, this.W * 0.35)
    g.st.hits++; g.streak++
    if (f.perfect) g.st.perfects++
    g.recoilT = 0.16; g.muzzle(3)
    f.d.dying = true; f.d.hp = 0
    g.fireBolt(0, f.d, 0, 1, f.perfect, true, 0, 0)
    g.ptr = this.fds.filter((x) => x.res === 1).length
    g.scoreSync('hit')
    if (!this.fds.some((x) => x.res !== 1)) this.complete()
  }

  /** a wrong, early, late or missing note: the demon keeps diving and bites, and the phrase is broken */
  private fail(f: FD, kind: 'wrong' | 'early' | 'late' | 'missed' | 'lh', text: string) {
    const g = this.g, now = performance.now()
    f.res = 2
    g.st.wrongs++; g.streak = 0; this.chain = 0
    g.wrongT = 0.35; g.hintT = 2.2
    g.scoreSync('miss')
    this.worldPop(f, text, '#ff8a6a', true)
    g.addPop('PHRASE BROKEN!', '#ff5a5a', true, undefined, 0.5)
    g.wrongFx(kind !== 'missed')
    g.edgePulse(1.5)
    if (kind === 'wrong' || kind === 'early' || kind === 'late') g.fireBolt(3, f.d, 0, 0, false, false, 0, 0)
    this.shadow?.cancel(); this.shadow = null
    clearGuide()
    this.breaks++; this.totalBreaks++
    // the failed demon finishes its dive; the others swirl back and an extra demon joins
    f.biteAt = Math.max(f.biteAt, now + 260)
    this.state = 'regroup'; this.stateT = now
    if (this.extra < 3) this.extra++
    const n = this.count()
    const old = this.fds
    const next: FD[] = []
    for (let i = 0; i < n; i++) {
      const o = old[i]
      const slot = this.slotOf(i, n)
      if (o) {
        o.slot = slot
        if (o !== f) this.sendBack(o, now + (i % 4) * 60)
        next.push(o)
      } else next.push(this.spawn(i, n, now + 200))
    }
    this.fds = next
    g.demons = next.map((x) => x.d)
    this.regroupEnd = Math.max(now, f.biteAt) + BACK_MS + 350
  }

  /** a demon returns to its slot (dead ones come back from the top) */
  private sendBack(f: FD, t0: number) {
    const d = f.d
    if (f.res === 1 || d.state !== 0) f.from = { lat: f.slot.lat + f.sw * 2.6, dist: f.slot.dist + 2.4, z: f.slot.z + 1.3 }
    else f.from = { lat: d.lat, dist: d.dist, z: d.fz ?? 1 }
    d.state = 0; d.dying = false; d.hp = 1; d.vhp = 1; d.dieT = 0; d.kb = 0; d.biting = false
    f.res = 0; f.mode = 'back'; f.t0 = t0; f.bit = false
  }

  private bite(f: FD) {
    const g = this.g
    f.bit = true
    const d = f.d
    d.biting = true; d.lungeT = 0.4
    g.st.bites++
    const before = g.harmony
    g.waveBite()
    g.wrongFx(false)
    const amt = Math.round(before - g.harmony)
    g.addPop(amt ? 'BITTEN! -' + amt + ' HARMONY' : 'THE DEMON GOT THROUGH!', '#ff6a6a', true, undefined, 0.44)
    setTimeout(() => { d.biting = false }, 450)
    this.sendBack(f, performance.now() + 350)
  }

  /** every demon shot on its beat: reward big */
  private complete() {
    const g = this.g, now = performance.now()
    this.state = 'win'; this.stateT = now
    this.chain++
    const allPerfect = this.fds.every((f) => f.perfect)
    const bonus = Math.min(30, 6 * this.chain) * (allPerfect ? 2 : 1)
    g.harmony = Math.min(100, g.harmony + bonus)
    g.armor = Math.min(100, g.armor + 12)
    g.faceGrinT = 2.2; g.killT = 0.3
    if (!g.reduced) g.kickT = 0.12
    g.addPop('PHRASE PERFECT!', '#ffd76c', true, undefined, 0.5)
    g.addPop('CHAIN x' + this.chain + (allPerfect ? '  ALL ON THE BEAT!' : '') + '  +' + bonus + ' HARMONY', '#7cf0a0', false, undefined, 0.62)
    // the empty formation shatters into golden notes
    const r = g.room
    for (const f of this.fds) {
      const x = r.sx + r.hx * f.slot.dist + r.rx * f.slot.lat, y = r.sy + r.hy * f.slot.dist + r.ry * f.slot.lat
      g.burst(x, y, f.slot.z + 0.3, 7)
      g.confetti(x, y, f.slot.z + 0.3, 4)
    }
    clearGuide()
  }

  // ------------------------------------------------------------------ per frame
  private shift(ms: number) {
    this.stateT += ms; this.regroupEnd += ms
    for (const f of this.fds) { f.due += ms; f.biteAt += ms; f.t0 += ms }
  }

  update(dt: number) {
    const g = this.g
    if (this.state === 'idle') return
    const now = performance.now()
    // the tab was in the background: slide the timeline instead of punishing the kid
    if (this.lastNow && now - this.lastNow > 500) this.shift(now - this.lastNow)
    this.lastNow = now
    for (const f of this.fds) {
      if (f.d.pulse && f.d.pulse > 0) f.d.pulse -= dt
      if (f.res !== 1 && !f.d.dying) this.place(f, now)
    }
    // a failed demon completes its dive
    for (const f of this.fds) if (f.res === 2 && !f.bit && now >= f.biteAt) this.bite(f)
    switch (this.state) {
      case 'enter':
        if (now - this.stateT > ENTER_MS + this.fds.length * 90 && g.introT <= 0) this.startTeach()
        break
      case 'ready':
        if (now - this.stateT > 800) this.startPass()
        break
      case 'dive': {
        const c = this.cur
        if (c) {
          if (c.melOk && !c.lhOk && now > c.due + this.W + 400) this.fail(c, 'lh', 'LEFT HAND! CHORD ON BEAT ONE')
          else if (!c.melOk && now > c.due + this.W + 200) this.fail(c, 'missed', 'MISSED')
        }
        break
      }
      case 'win':
        if (now - this.stateT > 2300) {
          this.wi++
          if (this.wi >= this.ladder.length) { this.state = 'idle'; g.finish() } else this.newWave()
        }
        break
      case 'regroup':
        if (now >= this.regroupEnd && this.fds.every((f) => f.bit || f.res !== 2)) {
          const reteach = !this.rungCfg.labels
          if (reteach) this.startTeach()
          else { this.state = 'ready'; this.stateT = now; g.addPop('AGAIN, FROM THE START!', '#ffd76c', true, undefined, 0.58) }
        }
        break
    }
    if (this.state === 'ready' || this.state === 'dive') this.syncGuide()
  }

  /** where a demon is right now: the formation, flying in, diving at the player, or swirling back */
  private place(f: FD, now: number) {
    const d = f.d, s = f.slot, g = this.g
    const sway = g.reduced ? 0 : 1
    let lat = s.lat, dist = s.dist, z = s.z
    if (f.mode === 'form' || (f.mode === 'dive' && now < f.due - this.L)) {
      lat += Math.sin(now * 0.0011 + f.i * 0.7) * 0.12 * sway
      z += Math.sin(now * 0.0017 + f.i) * 0.04 * sway
    } else if (f.mode === 'enter' || f.mode === 'back') {
      const u0 = (now - f.t0) / (f.mode === 'enter' ? ENTER_MS : BACK_MS)
      if (u0 < 0) { lat = f.from.lat; dist = f.from.dist; z = f.from.z }
      else if (u0 >= 1) { f.mode = this.state === 'dive' ? 'dive' : 'form' }
      else {
        const e = u0 * u0 * (3 - 2 * u0), w = Math.sin(u0 * Math.PI * 2) * (1 - u0) * 1.2 * f.sw * sway
        lat = f.from.lat + (s.lat - f.from.lat) * e + w
        dist = f.from.dist + (s.dist - f.from.dist) * e
        z = f.from.z + (s.z - f.from.z) * e + Math.sin(u0 * Math.PI) * 0.25 * sway
      }
    } else {
      // dive: loop-the-loop out of the formation to the strike ring (reached exactly at `due`), then on to the bite
      const tau = (now - (f.due - this.L)) / this.L
      const latS = s.lat * 0.3, zS = ZS
      if (now <= f.due) {
        const e = Math.pow(Math.max(0, tau), 1.7)
        lat = s.lat + (latS - s.lat) * e + Math.sin(tau * Math.PI * 2) * 1.1 * (1 - tau) * f.sw * sway
        dist = s.dist + (DS - s.dist) * e
        z = s.z + (zS - s.z) * e + (1 - Math.cos(tau * Math.PI * 2)) * 0.12 * (1 - tau) * sway
      } else {
        const u = Math.min(1, (now - f.due) / Math.max(1, f.biteAt - f.due))
        lat = latS * (1 - u); dist = DS + (DB - DS) * u; z = zS + (-0.12 - zS) * u
      }
    }
    d.lat = lat; d.dist = dist; d.fz = z
    if (f.mode === 'dive' && now > f.due - this.L * 0.4 && f.res !== 1) d.lungeT = Math.max(d.lungeT, 0.05)
  }

  /** screen-ring info for the HUD: how far a pending demon is from its beat (-1 long before .. 0 at the beat .. +) */
  ringT(f: FD, now: number) { return (now - f.due) / this.L }
  /** world height of the middle of a demon when it sits on its strike ring */
  ringZ(f: FD) { const d = f.d; return ZS + 0.5 * ({ imp: 1.22, grumble: 1.12, squeak: 0.8 }[d.kind]) * Math.min(1.25, this.g.map.spec.wallH ?? 1) * (d.sc ?? 1) }
  label(f: FD) { return PC_NAMES[pc(f.note)] + String(Math.floor(f.note / 12) - 1) }
  /** the phrase's note names, for the "how to" line when the sheet is hidden */
  get sheetOn() { return this.rungCfg.sheet }
  get sheetLevel() { return getSheetLevel() }
  get currentRung(): Rung { return this.rung as Rung }
  clearView() { clearPhraseView() }
}
