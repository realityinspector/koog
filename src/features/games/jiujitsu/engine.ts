// Jiu-Jitsu Flow engine: rules, loop and canvas drawing. One `Game` per mounted component; all state is on
// the instance, and destroy() removes every listener, observer, timer and the animation frame.
// Input comes ONLY from the Judge (onJudge). The partner's calls are played straight into the synth.
import { onJudge, type JudgeEvent, type NoteGrade } from '../../../music/judge'
import { setGuide, clearGuide } from '../../../music/guide'
import { setScore, setScorePos, clearScore } from '../../../music/scoreStore'
import { noteName } from '../../../music/theory'
import { getSynth } from '../../synth-history/engine'
import {
  BELTS, RUNGS, STEPS, LAST_RUNG, LESSONS, TECHNIQUES, level, makePhrase, flowSongs, loadSave, writeSave,
  type Phase, type Phrase, type Save, type Snapshot,
} from './data'
import { RUNG_POSE, VIA, POSES, FLY, ARMBAR_POSE, lerpPair, type Pair } from './poses'
import { makeView, renderBackground, drawFig, drawShadow, toScreen, KID_LOOK, PARTNER_LOOK, type View } from './draw'
import type { SongNote } from '../../songs/songs'

interface Pop { text: string; x: number; y: number; age: number; max: number; color: string; size: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; sz: number; rot: number }
interface Anim { from: Pair; keys: Pair[]; to: Pair; t0: number; dur: number }

const rnd = Math.random
const ease = (u: number) => u * u * (3 - 2 * u)
const SOUND_VEL = 88
const FLOW_MAX_NOTES = 32
const CONFETTI = ['#ff5d7a', '#ffd23f', '#5fe0a0', '#58b8ff', '#c08cff', '#ffffff']

export class Game {
  private canvas: HTMLCanvasElement
  private root: HTMLElement
  private ctx: CanvasRenderingContext2D
  private onSnap: (s: Snapshot) => void
  private dpr = 1
  private view: View = makeView(300, 200)
  private bg: HTMLCanvasElement | null = null
  private sig = ''
  private ro: ResizeObserver
  private raf = 0
  private last = 0
  private clock = 0
  private rm = false
  private mq: MediaQueryList | null = null
  private onMq = () => { this.rm = !!this.mq?.matches }
  private offJudge: () => void
  private dead = false
  private frozen = false

  private save: Save
  private phase: Phase = 'menu'
  private trainBelt = 0
  private rung = 0
  private points = 0
  private partner = 0
  private banner = ''
  private tip = ''
  private phrase: Phrase = { notes: [], beats: [], ioi: 600 }
  private ei = 0
  private slips = 0
  private offBeat = 0
  private rhy: number[] = []
  private tapN = 0
  private tapAt = -9
  private lesson = LESSONS[0]
  private promoTo = 0
  private stripeEarned = false
  private newBest = false
  private cardAt = 0
  private epoch = 0
  private q: { at: number; fn: () => void }[] = []
  private held = new Set<number>()

  // flow roll
  private songIx = 0
  private flowNotes: number[] = []
  private flowPos = 0
  private chain = 0
  private longest = 0
  private flowRung = 0
  private flowSteady = 0

  // visuals
  private cur: Pair = RUNG_POSE[0]
  private anim: Anim | null = null
  private pops: Pop[] = []
  private bits: Bit[] = []
  private shake = 0
  private wobble = 0
  private pulse = 0
  private call = -1

  constructor(canvas: HTMLCanvasElement, root: HTMLElement, onSnap: (s: Snapshot) => void) {
    this.canvas = canvas; this.root = root; this.onSnap = onSnap
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.save = loadSave()
    this.trainBelt = this.save.belt
    try {
      this.mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.rm = this.mq.matches
      this.mq.addEventListener('change', this.onMq)
    } catch { /* no matchMedia */ }
    this.ro = new ResizeObserver(() => this.refresh())
    this.ro.observe(root)
    this.offJudge = onJudge((e) => this.onJudgeEvent(e))
    this.refresh()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    if (import.meta.env.DEV) (window as unknown as { __bjj?: unknown }).__bjj = this.dev()
    this.emit()
  }

  destroy() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.mq?.removeEventListener('change', this.onMq)
    this.offJudge()
    this.stopSound()
    clearGuide()
    clearScore('jiujitsu')
    if (import.meta.env.DEV) delete (window as unknown as { __bjj?: unknown }).__bjj
  }

  private dev() {
    const self = this
    return {
      get phase() { return self.phase },
      get expected() { return self.phase === 'flow' ? self.flowNotes.slice(self.flowPos) : self.phrase.notes },
      get ei() { return self.ei },
      get rung() { return self.rung },
      get points() { return self.points },
      get level() { return self.level },
      get ioi() { return self.phrase.ioi },
      get beats() { return self.phrase.beats },
      get chain() { return self.chain },
      setSave(belt: number, stripes: number) { self.save.belt = belt; self.save.stripes = stripes; self.trainBelt = belt; self.emit() },
      cont: () => this.cont(),
      freeze: (on: boolean) => { this.frozen = on },
      pose: (name: keyof typeof POSES) => { this.anim = null; this.cur = POSES[name] },
      finish: () => this.startSub(),
    }
  }

  // ---------------- public controls ----------------
  get level() { return level(this.trainBelt, this.trainBelt === this.save.belt ? this.save.stripes : 3) }
  setTrainBelt(b: number) { this.trainBelt = Math.max(0, Math.min(this.save.belt, b)); this.emit() }
  setSong(i: number) { const n = flowSongs().length; if (n) this.songIx = ((i % n) + n) % n; this.emit() }

  start() {
    void getSynth().unlock().catch(() => {})
    this.points = 0; this.partner = 0; this.rung = 0
    this.newRound()
  }

  toMenu() {
    this.reset()
    this.phase = 'menu'
    this.save = loadSave()
    this.trainBelt = Math.min(this.trainBelt, this.save.belt)
    this.cur = RUNG_POSE[0]; this.anim = null
    this.emit()
  }

  /** Play the partner's phrase again (free). */
  hear() {
    if (this.phase !== 'echo' && this.phase !== 'call') return
    this.ei = 0; this.rhy = []
    this.playCall()
  }

  /** The Continue button on the cards. */
  cont() {
    if (this.phase === 'lesson') this.afterLesson()
    else if (this.phase === 'promo') { this.points = 0; this.partner = 0; this.rung = 0; this.newRound() }
    else if (this.phase === 'flowend') this.toMenu()
  }

  startFlow() {
    const songs = flowSongs()
    if (!songs.length) return
    void getSynth().unlock().catch(() => {})
    const song = songs[this.songIx % songs.length]
    const notes = song.notes
    const shown: SongNote[] = []
    let count = 0
    for (const n of notes) {
      if (n.note != null && count >= FLOW_MAX_NOTES) break
      shown.push({ note: n.note, beats: n.beats })
      if (n.note != null) count++
    }
    this.flowNotes = shown.filter((n) => n.note != null).map((n) => n.note as number)
    this.reset()
    this.phase = 'flow'
    this.flowPos = 0; this.chain = 0; this.longest = 0; this.flowRung = 0; this.flowSteady = 0
    this.points = 0; this.partner = 0; this.rung = 0
    this.cur = RUNG_POSE[0]; this.anim = null
    this.banner = `Flow roll: ${song.title}`
    this.tip = 'Play the melody smoothly and steadily. Every steady note chains a technique.'
    setScore({ owner: 'jiujitsu', title: song.title, notes: shown, key: song.key, bpm: song.bpm })
    this.flowGuide()
    this.emit()
  }

  // ---------------- rounds ----------------
  private reset() {
    this.epoch++
    this.q = []
    this.stopSound()
    clearGuide()
    clearScore('jiujitsu')
    this.pops = []; this.bits = []; this.call = -1
    this.ei = 0; this.slips = 0; this.rhy = []; this.offBeat = 0; this.tapN = 0
  }

  private newRound() {
    this.reset()
    this.points = 0; this.partner = 0; this.rung = 0
    this.newBest = false
    this.cur = RUNG_POSE[0]; this.anim = null
    this.phase = 'bow'
    this.banner = 'Bow to your partner: respect first.'
    this.tip = ''
    this.moveTo(POSES.BOW, [], 0.9)
    this.later(1.5, () => { this.moveTo(RUNG_POSE[0], [], 0.9); this.banner = 'Oss! Let\'s roll.'; this.emit() })
    this.later(2.7, () => this.nextExchange())
    this.emit()
  }

  private get slipMax() { const L = this.level; return L < 8 ? 5 : L < 16 ? 4 : 3 }
  private get training() { return this.level < 8 }

  private nextExchange() {
    this.phrase = makePhrase(this.level)
    this.ei = 0; this.slips = 0; this.offBeat = 0; this.rhy = []
    const label = this.rung % 2 === 0 ? 'Partner attacks: listen!' : 'Your turn: watch the technique!'
    this.banner = label
    this.tip = `Next: ${STEPS[this.rung].name}${STEPS[this.rung].pts ? ` (${STEPS[this.rung].pts} pts)` : ''}`
    this.publishScore()
    this.playCall()
  }

  private publishScore() {
    const p = this.phrase
    setScore({ owner: 'jiujitsu', title: `Partner's call: ${STEPS[this.rung].name}`, notes: p.notes.map((n, i) => ({ note: n, beats: p.beats[i] })), bpm: Math.round(60000 / p.ioi) })
  }

  private playCall() {
    this.phase = 'call'
    const ep = ++this.epoch
    this.q = []
    this.stopSound()
    const p = this.phrase
    clearGuide()
    let t = 0.5
    p.notes.forEach((n, i) => {
      const dur = (p.beats[i] * p.ioi) / 1000
      this.later(t, () => { this.sound(n, true); setGuide([n], 'next'); this.pop(noteName(n), 'p', '#ffe27a', 0.5); this.call = n; this.pulse = 1 })
      this.later(t + dur * 0.8, () => { this.sound(n, false) })
      t += dur
    })
    this.later(t + 0.25, () => {
      if (ep !== this.epoch) return
      this.phase = 'echo'
      this.call = -1
      this.banner = 'Now YOU echo it: same notes, steady beat!'
      this.echoGuide()
      this.emit()
    })
    setScorePos(0)
    this.emit()
  }

  private echoGuide() {
    if (this.phase !== 'echo') return
    if (this.training && this.ei < this.phrase.notes.length) setGuide([this.phrase.notes[this.ei]], 'gold')
    else clearGuide()
  }

  private echoNote(g: NoteGrade) {
    const exp = this.phrase.notes
    if (g.note === exp[this.ei]) {
      if (this.ei >= 2 && g.rhythm != null) this.rhy.push(g.rhythm)
      this.pop(noteName(g.note), 'k', '#7dffb0', 0.55)
      this.ei++
      setScorePos(this.ei, 'hit')
      if (this.ei >= exp.length) { clearGuide(); this.echoDone(); return }
      this.echoGuide()
      this.emit()
    } else {
      this.slips++
      this.rhy = []
      this.ei = g.note === exp[0] ? 1 : 0
      this.pop('Not quite', 'k', '#ffb0a0', 0.7)
      this.publishScore()
      if (this.ei) setScorePos(1, 'hit')
      if (this.slips >= this.slipMax) { this.partnerReverses(); return }
      this.tip = this.slips >= 2 ? 'Tap 🔁 to hear it again, then try once more.' : 'Almost! Listen to the order of the notes.'
      this.echoGuide()
      this.emit()
    }
  }

  private echoDone() {
    const onBeat = this.rhy.every((r) => r >= 0.75)
    if (!onBeat && this.offBeat < 2) {
      this.offBeat++
      this.ei = 0; this.rhy = []
      this.banner = 'Right notes! Now keep the beat steady, like a heartbeat.'
      this.tip = 'Same speed from note to note. Listen again.'
      this.pop('Steady!', 'k', '#ffe27a', 0.8)
      this.later(0.8, () => { this.publishScore(); this.playCall() })
      this.phase = 'move'
      this.emit()
      return
    }
    const step = STEPS[this.rung]
    const pts = onBeat ? step.pts : 0
    this.points += pts
    this.pop(pts ? `+${pts} ${step.name}!` : onBeat ? `${step.name}!` : `${step.name} (scramble)`, 'k', '#ffffff', 1)
    this.burst(0.5, 0.9, this.rm ? 6 : 16)
    const target = this.rung + 1
    this.moveTo(RUNG_POSE[target], VIA[this.rung], 1.1)
    this.rung = target
    this.phase = 'move'
    this.banner = target === LAST_RUNG ? 'Perfect control: finish it smoothly.' : `${RUNGS[target]}! Nice technique.`
    this.tip = ''
    this.emit()
    this.later(1.4, () => (this.rung >= LAST_RUNG ? this.startSub() : this.nextExchange()))
  }

  private partnerReverses() {
    this.phase = 'move'
    this.clearInput()
    this.banner = 'Partner reversed the position. That is how we learn!'
    this.tip = 'Breathe and reset. Listen closely.'
    this.dropRung(2)
    this.later(1.6, () => this.nextExchange())
    this.emit()
  }

  private dropRung(partnerPts: number) {
    if (this.rung <= 0) return
    const from = this.rung - 1
    this.partner += partnerPts
    this.pop(`Partner +${partnerPts}`, 'p', '#9ec5ff', 0.8)
    this.moveTo(RUNG_POSE[from], [...VIA[from]].reverse(), 1.0)
    this.rung = from
  }

  private clearInput() { this.epoch++; this.q = []; this.stopSound(); clearGuide() }

  // forearm slams
  private cluster(boom: boolean) {
    if (this.phase === 'flow') {
      if (boom) { this.points += 4; this.pop('FLYING ARMBAR! +4', 'k', '#fff3a8', 1.2); this.burst(0.5, 1, 90); this.moveTo(ARMBAR_POSE, FLY, 1.0); this.later(2.2, () => this.moveTo(RUNG_POSE[this.flowRung], [], 0.9)) }
      else { this.chain = 0; this.pop('Sloppy scramble', 'k', '#ffb0a0', 1); this.wobble = 0.7; this.banner = 'Smooth, not smashed. Slow hands, steady beat.'; this.emit() }
      return
    }
    if (this.phase !== 'call' && this.phase !== 'echo') return
    this.clearInput()
    if (boom) {
      this.points += 4
      this.pop('FLYING ARMBAR! +4', 'k', '#fff3a8', 1.3)
      this.burst(0.5, 1.1, this.rm ? 30 : 110)
      this.moveTo(ARMBAR_POSE, FLY, 1.2)
      this.phase = 'move'
      this.rung = LAST_RUNG
      this.banner = 'FLYING ARMBAR! A highlight-reel finish, done with control.'
      this.tip = ''
      this.later(2.4, () => this.startSub())
    } else {
      this.phase = 'move'
      this.wobble = 0.8
      if (!this.rm) this.shake = 0.5
      this.banner = 'Sloppy scramble! Slow down: control wins the roll.'
      this.tip = this.rung > 0 ? 'You lost a position. Breathe and reset.' : 'Calm hands next time.'
      this.dropRung(2)
      this.later(1.6, () => this.nextExchange())
    }
    this.emit()
  }

  // ---------------- submission ----------------
  private startSub() {
    this.clearInput()
    this.phase = 'sub'
    this.rung = LAST_RUNG
    this.tapN = 0
    this.moveTo(RUNG_POSE[LAST_RUNG], [], 0.8)
    this.banner = 'Submission! Your partner taps: "you got me."'
    this.tip = ''
    ;[0.9, 1.4, 1.9].forEach((t, i) => this.later(t, () => {
      this.tapN = i + 1; this.tapAt = this.clock
      this.pop('TAP!', 'p', '#ffffff', 0.8); this.shake = this.rm ? 0 : 0.2
      this.emit()
    }))
    this.later(2.5, () => { this.moveTo(RUNG_POSE[0], [], 1.1); this.banner = 'You let go right away. That is respect.'; this.emit() })
    this.later(3.9, () => { this.moveTo(POSES.BOW, [], 0.9); this.banner = 'Both bow. Thank you for the roll.'; this.emit() })
    this.later(5.2, () => this.showLesson())
    this.emit()
  }

  private showLesson() {
    const first = this.save.total === 0
    const trainingHere = this.trainBelt === this.save.belt
    this.lesson = first ? LESSONS[0] : LESSONS[(this.level + this.save.total) % LESSONS.length]
    this.newBest = this.points > this.save.best
    if (this.newBest) this.save.best = this.points
    this.save.total += this.points
    this.stripeEarned = trainingHere
    this.promoTo = -1
    if (trainingHere) {
      this.save.stripes++
      if (this.save.stripes >= 4) {
        if (this.save.belt < 4) { this.promoTo = this.save.belt + 1; this.save.belt++; this.save.stripes = 0; this.trainBelt = this.save.belt }
        else this.save.stripes = 3
      }
    }
    writeSave(this.save)
    this.phase = 'lesson'
    this.cardAt = this.clock
    this.moveTo(POSES.BOW, [], 0.1)
    this.emit()
  }

  private afterLesson() {
    if (this.promoTo >= 0) {
      this.phase = 'promo'
      this.cardAt = this.clock
      this.burst(0.5, 1.2, this.rm ? 20 : 120)
      this.emit()
    } else this.newRound()
  }

  // ---------------- flow roll ----------------
  private flowGuide() {
    const n = this.flowNotes[this.flowPos]
    if (n != null) setGuide([n], 'gold'); else clearGuide()
  }

  private flowNote(g: NoteGrade) {
    const want = this.flowNotes[this.flowPos]
    if (g.note !== want) {
      this.chain = 0
      this.pop('Find the note', 'k', '#ffb0a0', 0.7)
      setScorePos(this.flowPos, 'miss')
      this.tip = 'No rush: find the next lit key and keep the beat.'
      this.emit()
      return
    }
    const steady = g.rhythm == null || g.rhythm >= 0.6
    this.flowPos++
    setScorePos(this.flowPos, 'hit')
    if (steady) {
      this.chain++
      this.longest = Math.max(this.longest, this.chain)
      this.points += 1
      this.flowSteady++
      const tech = TECHNIQUES[(this.chain - 1) % TECHNIQUES.length]
      this.pop(`${tech} +1`, 'k', '#9dffcb', 0.9)
      if (this.flowSteady % 3 === 0) this.flowAdvance()
      this.banner = this.chain >= 4 ? `Flow x${this.chain}: keep it smooth!` : 'Steady notes chain techniques together.'
    } else {
      this.chain = 0
      this.banner = 'Right note, but wobbly. Find the steady beat.'
    }
    this.flowGuide()
    if (this.flowPos >= this.flowNotes.length) { this.finishFlow(); return }
    this.emit()
  }

  private flowAdvance() {
    const from = this.flowRung
    if (from >= 5) { this.flowRung = 1; this.points += 2; this.pop('Sweep +2!', 'k', '#ffe27a', 1.1); this.moveTo(RUNG_POSE[1], [POSES.ROLL], 1.0) }
    else { this.flowRung = from + 1; this.moveTo(RUNG_POSE[this.flowRung], VIA[from], 1.0) }
    this.rung = this.flowRung
  }

  private finishFlow() {
    this.newBest = this.points > this.save.flowBest
    if (this.newBest) this.save.flowBest = this.points
    writeSave(this.save)
    this.burst(0.5, 1, this.rm ? 20 : 100)
    this.later(0.9, () => { this.phase = 'flowend'; this.cardAt = this.clock; clearGuide(); this.moveTo(POSES.BOW, [], 0.1); this.emit() })
    this.phase = 'move'
    this.emit()
  }

  // ---------------- input ----------------
  private onJudgeEvent(e: JudgeEvent) {
    if (this.dead) return
    if (e.type === 'cluster') { this.cluster(e.boom); return }
    if (e.type !== 'note' || e.g.cluster != null) return
    if ((this.phase === 'lesson' || this.phase === 'promo' || this.phase === 'flowend') && this.clock - this.cardAt > 1.4) { this.cont(); return }
    if (this.phase === 'echo') this.echoNote(e.g)
    else if (this.phase === 'flow') this.flowNote(e.g)
  }

  // ---------------- sound ----------------
  private sound(n: number, on: boolean) {
    const sy = getSynth()
    if (on) { if (sy.ready) { sy.noteOn(n, SOUND_VEL); this.held.add(n) } }
    else if (this.held.delete(n)) sy.noteOff(n)
  }
  private stopSound() { for (const n of [...this.held]) { getSynth().noteOff(n); this.held.delete(n) } }

  // ---------------- scheduling and animation ----------------
  private later(sec: number, fn: () => void) {
    const ep = this.epoch
    this.q.push({ at: this.clock + sec, fn: () => { if (ep === this.epoch) fn() } })
  }

  private moveTo(to: Pair, keys: Pair[], dur: number) {
    this.anim = { from: this.sample(), keys, to, t0: this.clock, dur: Math.max(0.05, dur) }
    this.cur = to
  }

  private sample(): Pair {
    const a = this.anim
    if (!a) return this.cur
    const u = Math.min(1, (this.clock - a.t0) / a.dur)
    if (u >= 1) { this.anim = null; return this.cur }
    const seq = [a.from, ...a.keys, a.to]
    const segs = seq.length - 1
    const x = u * segs
    const i = Math.min(segs - 1, Math.floor(x))
    return lerpPair(seq[i], seq[i + 1], ease(x - i))
  }

  private pop(text: string, who: 'k' | 'p', color: string, sec: number) {
    const x = who === 'k' ? -0.6 : 0.6
    while (this.pops.length > 2) this.pops.shift()
    this.pops.push({ text, x: x + (rnd() - 0.5) * 0.4, y: 1.45 + (rnd() - 0.5) * 0.1, age: 0, max: Math.max(0.5, sec + 0.4), color, size: text.length > 8 ? 1 : 1.25 })
  }

  private burst(x: number, y: number, n: number) {
    const cap = 160
    for (let i = 0; i < n && this.bits.length < cap; i++) {
      this.bits.push({ x: (x - 0.5) * 3 + (rnd() - 0.5) * 0.4, y: y + rnd() * 0.3, vx: (rnd() - 0.5) * 2.4, vy: 1.2 + rnd() * 2.6, life: 0, max: 1.6 + rnd() * 1.2, hue: Math.floor(rnd() * CONFETTI.length), sz: 0.035 + rnd() * 0.03, rot: rnd() * 6 })
    }
  }

  // ---------------- loop ----------------
  private frame = (now: number) => {
    if (this.dead) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = this.frozen ? 0 : Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.clock += dt
    this.update(dt)
    this.draw()
  }

  private update(dt: number) {
    if (this.q.length) {
      const due = this.q.filter((x) => x.at <= this.clock)
      if (due.length) {
        this.q = this.q.filter((x) => x.at > this.clock)
        due.sort((a, b) => a.at - b.at).forEach((x) => x.fn())
      }
    }
    this.shake = Math.max(0, this.shake - dt)
    this.wobble = Math.max(0, this.wobble - dt)
    this.pulse = Math.max(0, this.pulse - dt * 4)
    for (const p of this.pops) p.age += dt
    this.pops = this.pops.filter((p) => p.age < p.max)
    for (const b of this.bits) { b.life += dt; b.vy -= 4.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.995 }
    this.bits = this.bits.filter((b) => b.life < b.max && b.y > -0.3)
  }

  private refresh() {
    const r = this.root.getBoundingClientRect()
    const w = Math.max(40, Math.round(r.width)), h = Math.max(40, Math.round(r.height))
    this.dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const sig = `${w}x${h}@${this.dpr}`
    if (sig === this.sig) return
    this.sig = sig
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr)
    this.view = makeView(w, h)
    this.bg = renderBackground(w, h, this.dpr, this.view.gy)
  }

  private draw() {
    const g = this.ctx, v = this.view
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.bg) g.drawImage(this.bg, 0, 0, v.w, v.h)
    const pair = this.sample()
    const t = this.clock
    let { k, p } = pair
    if (!this.rm) {
      const sway = Math.sin(t * 1.8) * 1.2
      k = { ...k, t: k.t + sway, hd: k.hd + sway * 0.5 }
      p = { ...p, t: p.t - sway * 0.8 }
    }
    if (this.wobble > 0 && !this.rm) {
      const w = Math.sin(t * 28) * 14 * (this.wobble / 0.8)
      k = { ...k, t: k.t + w, l: [k.l[0] + w, k.l[1] - w, k.l[2] - w, k.l[3] + w], a: [k.a[0] + w * 2, k.a[1] - w, k.a[2] - w * 2, k.a[3] + w] }
      p = { ...p, t: p.t - w * 0.6 }
    }
    if (this.phase === 'call' && this.call >= 0 && !this.rm) {
      const nod = this.pulse * 4
      p = { ...p, hd: p.hd - nod, t: p.t - nod * 0.5 }
    }
    if (this.tapN > 0 && this.phase === 'sub') {
      const u = this.clock - this.tapAt
      const sw = u < 0.35 ? Math.sin((u / 0.35) * Math.PI) * 38 : 0
      p = { ...p, a: [p.a[0] + 30 - sw * 0.5, p.a[1] - 40 + sw, p.a[2], p.a[3]] }
    }
    // shake
    let ox = 0
    if (this.shake > 0 && !this.rm) ox = Math.sin(t * 60) * 3 * this.shake
    g.save()
    g.translate(ox, 0)
    drawShadow(g, v, k, p)
    const belt = BELTS[this.trainBelt]?.color ?? '#fff'
    const happy = this.wobble > 0 ? 0.2 : 1
    drawFig(g, v, p, PARTNER_LOOK, happy)
    drawFig(g, v, k, KID_LOOK(belt), happy)
    g.restore()
    // pops
    g.textAlign = 'center'; g.textBaseline = 'middle'
    for (const o of this.pops) {
      const u = o.age / o.max
      const [sx, sy] = toScreen(v, o.x, o.y + u * 0.35)
      const a = u < 0.15 ? u / 0.15 : u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1
      const sc = u < 0.12 ? 0.7 + (u / 0.12) * 0.3 : 1
      g.globalAlpha = a
      g.font = `800 ${Math.round(Math.max(16, Math.min(34, v.s * 0.2)) * o.size * sc)}px system-ui, sans-serif`
      g.lineWidth = 5; g.strokeStyle = 'rgba(14,10,40,.9)'; g.strokeText(o.text, sx, sy)
      g.fillStyle = o.color; g.fillText(o.text, sx, sy)
    }
    g.globalAlpha = 1
    // confetti
    for (const b of this.bits) {
      const [sx, sy] = toScreen(v, b.x, b.y)
      g.save(); g.translate(sx, sy); g.rotate(b.rot + b.life * 5)
      g.globalAlpha = Math.max(0, 1 - b.life / b.max)
      g.fillStyle = CONFETTI[b.hue]
      g.fillRect(-b.sz * v.s, -b.sz * v.s * 0.5, b.sz * 2 * v.s, b.sz * v.s)
      g.restore()
    }
    g.globalAlpha = 1
  }

  // ---------------- snapshot ----------------
  private emit() {
    if (this.dead) return
    const songs = flowSongs()
    this.onSnap({
      phase: this.phase, belt: this.trainBelt === this.save.belt ? this.save.belt : this.trainBelt,
      stripes: this.trainBelt === this.save.belt ? this.save.stripes : 4, practice: this.trainBelt !== this.save.belt,
      rung: this.rung, points: this.points, partner: this.partner, banner: this.banner, tip: this.tip,
      ei: this.ei, len: this.phrase.notes.length, slips: this.slips, maxSlips: this.slipMax,
      lesson: this.lesson, promoTo: this.promoTo, stripeEarned: this.stripeEarned, newBest: this.newBest, tapN: this.tapN,
      songs: songs.map((s) => ({ id: s.id, title: s.title })), songIx: songs.length ? this.songIx % songs.length : 0,
      flowPos: this.flowPos, flowTotal: this.flowNotes.length, chain: this.chain, longest: this.longest, save: this.save,
    })
  }
}
