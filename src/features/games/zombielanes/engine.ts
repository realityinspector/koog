// Zombie Lanes engine: the game rules, the loop and the canvas drawing. One `Game` per mounted component.
// All state lives on the instance (nothing at module level), and `destroy()` removes every listener,
// observer, timer and the animation frame, so mounting and unmounting is always clean.
// Input comes ONLY from the Judge (onJudge), so forearm clusters and BOOM work like the rest of the app.
import { onJudge, type JudgeEvent, type NoteGrade } from '../../../music/judge'
import { setGuide, clearGuide } from '../../../music/guide'
import { pc } from '../../../music/theory'
import { buildLayout, noteHue } from '../../keyboard/layout'
import { Sprites, SKINS, EXTRAS, ZH, ZFEET, KH, KFEET, SIGN_Y, KSIGN_Y, CONFETTI_FRAMES } from './sprites'
import { renderBackground, renderVignette, type Lane } from './background'
import {
  LEVELS, CHORDS, CHORD_WINDOW, MAX_LIVES, odeMelody, noteLabel, isBlackKey, loadSave, writeSave,
  type Mode, type Phase, type Snapshot, type LevelDef, type Chord, type Save,
} from './data'

const BUFFER_MS = 45 // hold each note this long, so a forearm slam is recognised before its first notes count
const JAM_SECONDS = 1.5
const BOOM_BOSS_SKIP = 8

interface Zombie {
  id: number; kind: 'note' | 'chord'; note: number; label: string; chord: Chord | null
  p: number; skin: number; extra: number; age: number; walk: number; x: number
}
interface Boss { p: number; idx: number; max: number; melody: number[]; flinch: number; age: number }
interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; kind: 0 | 1 | 2 | 3; ci: number; size: number; spin: number }
interface Pop { text: string; x: number; y: number; age: number; max: number; color: string; size: number }
interface Beam { x: number; x2: number; y0: number; y1: number; w: number; age: number; max: number; fizzle: boolean; grad: CanvasGradient; hue: number }
interface Ring { x: number; y: number; age: number; max: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rnd = Math.random

export class Game {
  private canvas: HTMLCanvasElement
  private root: HTMLElement
  private ctx: CanvasRenderingContext2D
  private onSnap: (s: Snapshot) => void
  private dpr = 1
  private w = 0
  private h = 0
  private horizonY = 0
  private lanes: Lane[] = []
  private laneMap = new Map<number, Lane>()
  private sig = ''
  private zk = 0.7
  private sprites: Sprites | null = null
  private bg: HTMLCanvasElement | null = null
  private vig: HTMLCanvasElement | null = null
  private raf = 0
  private last = 0
  private clock = 0
  private rm = false

  // run state
  private phase: Phase = 'menu'
  private mode: Mode = 'easy'
  private wave = 1
  private startWave = 1
  private score = 0
  private lives = MAX_LIVES
  private combo = 0
  private cleared = 0
  private stars = 0
  private won = false
  private newBest = false
  private bonusBrain = false
  private save: Save
  private cardAt = 0

  // wave state
  private zombies: Zombie[] = []
  private boss: Boss | null = null
  private spawned = 0
  private spawnLeft = 0
  private spawnTimer = 0
  private bag: number[] = []
  private chordIx = 0
  private nextId = 1
  private ending = false
  private later: { at: number; fn: () => void } | null = null
  private jamUntil = 0
  private jamShown = false
  private jamPuff = 0
  private recent: { note: number; t: number }[] = []
  private pending: { g: NoteGrade; at: number }[] = []
  private guideKey = ''

  // effects
  private particles: Particle[] = []
  private pops: Pop[] = []
  private beams: Beam[] = []
  private rings: Ring[] = []
  private press = new Map<number, number>()
  private pulse = 0
  private shake = 0

  // cleanup
  private ro: ResizeObserver
  private mo: MutationObserver | null = null
  private moTarget: Element | null = null
  private poll = 0
  private offJudge: () => void
  private mq: MediaQueryList | null = null
  private onMq = () => { this.rm = !!this.mq?.matches }
  private onWinResize = () => this.refresh()
  private dead = false

  constructor(canvas: HTMLCanvasElement, root: HTMLElement, onSnap: (s: Snapshot) => void) {
    this.canvas = canvas; this.root = root; this.onSnap = onSnap
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.save = loadSave()
    this.mode = this.save.mode
    try {
      this.mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.rm = this.mq.matches
      this.mq.addEventListener('change', this.onMq)
    } catch { /* no matchMedia */ }
    this.ro = new ResizeObserver(() => this.refresh())
    this.ro.observe(root)
    window.addEventListener('resize', this.onWinResize)
    this.poll = window.setInterval(() => this.refresh(), 1000)
    this.offJudge = onJudge((e) => this.onJudgeEvent(e))
    this.refresh(true)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    if (import.meta.env.DEV) (window as unknown as { __zl?: Game }).__zl = this
    this.emit()
  }

  destroy() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.mo?.disconnect()
    window.removeEventListener('resize', this.onWinResize)
    window.clearInterval(this.poll)
    this.mq?.removeEventListener('change', this.onMq)
    this.offJudge()
    clearGuide()
    if (import.meta.env.DEV && (window as unknown as { __zl?: Game }).__zl === this) delete (window as unknown as { __zl?: Game }).__zl
  }

  // ---------------- public controls ----------------
  setMode(m: Mode) { this.mode = m; this.save.mode = m; writeSave(this.save); this.emit() }

  start(mode: Mode, wave: number) {
    this.mode = mode
    this.save.mode = mode
    this.startWave = clamp(Math.round(wave), 1, LEVELS.length)
    this.wave = this.startWave
    this.score = 0; this.lives = MAX_LIVES; this.combo = 0; this.cleared = 0; this.won = false; this.newBest = false; this.bonusBrain = false
    this.resetField()
    this.phase = 'card'
    this.cardAt = this.clock
    this.emit()
  }
  retry() { this.start(this.mode, this.startWave) }

  toMenu() {
    this.recordBest()
    this.resetField()
    this.save = loadSave()
    this.mode = this.save.mode
    this.phase = 'menu'
    this.emit()
  }

  beginWave() {
    if (this.phase !== 'card') return
    this.resetField()
    const lv = this.lv
    this.phase = 'play'
    this.spawnLeft = lv.count
    this.spawnTimer = 0.7
    if (lv.boss) {
      const melody = odeMelody()
      this.boss = { p: 0, idx: 0, max: melody.length, melody, flinch: 0, age: 0 }
      this.spawnLeft = 0
    }
    this.emit()
  }

  private get lv(): LevelDef { return LEVELS[this.wave - 1] }

  private resetField() {
    this.zombies = []; this.boss = null; this.spawned = 0; this.spawnLeft = 0; this.bag = []; this.chordIx = 0
    this.ending = false; this.later = null; this.recent = []; this.pending = []
    this.particles = []; this.pops = []; this.beams = []; this.rings = []; this.press.clear()
    this.jamUntil = 0; this.pulse = 0; this.shake = 0
    this.setGuideKey('')
  }

  private snap(): Snapshot {
    const left = this.boss ? 0 : this.spawnLeft + this.zombies.length
    return {
      phase: this.phase, mode: this.mode, wave: this.wave, score: this.score, lives: this.lives, combo: this.combo, left,
      jam: this.clock < this.jamUntil, bossHp: this.boss ? this.boss.max - this.boss.idx : 0, bossMax: this.boss ? this.boss.max : 0,
      stars: this.stars, won: this.won, newBest: this.newBest, cleared: this.cleared, save: this.save, bonusBrain: this.bonusBrain,
    }
  }
  private emit() { if (!this.dead) this.onSnap(this.snap()) }

  // ---------------- geometry ----------------
  private refresh(force = false) {
    if (this.dead) return
    const r = this.root.getBoundingClientRect()
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    // watch the keybed so a range change re-aligns the lanes right away
    const strip = document.querySelector('.kb-strip')
    if (strip && strip !== this.moTarget) {
      this.mo?.disconnect()
      this.mo = new MutationObserver(() => this.refresh())
      this.mo.observe(strip, { childList: true })
      this.moTarget = strip
    }
    const lanes = this.readLanes()
    const sig = `${w}x${h}@${dpr}|` + lanes.map((l) => `${l.note}:${Math.round(l.x)}:${Math.round(l.w)}`).join(',')
    if (!force && sig === this.sig) return
    this.sig = sig
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.w = w; this.h = h; this.dpr = dpr
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr)
      this.vig = renderVignette(w, h)
    }
    this.lanes = lanes
    this.laneMap = new Map(lanes.map((l) => [l.note, l]))
    this.horizonY = Math.round(h * 0.28)
    const zk = clamp((h * 0.4) / ZH, 0.4, 1.1)
    if (!this.sprites || Math.abs(zk * 100 - this.zk * 100) >= 2 || this.sprites.dpr !== dpr) {
      this.zk = zk
      this.sprites = new Sprites(zk * dpr, dpr)
    }
    this.bg = renderBackground(w, h, dpr, lanes, this.horizonY)
  }

  /** Lane rectangles taken straight from the real on-screen keys, relative to this canvas. */
  private readLanes(): Lane[] {
    const cr = this.canvas.getBoundingClientRect()
    const out: Lane[] = []
    document.querySelectorAll<HTMLElement>('.kb-key[data-note]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0) return
      const note = Number(el.dataset.note)
      if (!Number.isFinite(note)) return
      out.push({ note, x: r.left - cr.left, w: r.width, cx: r.left - cr.left + r.width / 2, black: el.classList.contains('black') })
    })
    if (out.length) return out
    // no keybed on screen (should not happen): spread a default range over the canvas
    const w = this.root.getBoundingClientRect().width
    return buildLayout(48, 84).map((k) => ({ note: k.note, x: (k.left / 100) * w, w: (k.width / 100) * w, cx: ((k.left + k.width / 2) / 100) * w, black: k.black }))
  }

  private laneFor(note: number) { return this.laneMap.get(note) }
  private yAt(p: number) { return this.horizonY + 22 + (this.h - 10 - (this.horizonY + 22)) * p }

  // ---------------- input (Judge) ----------------
  private onJudgeEvent(e: JudgeEvent) {
    if (this.dead) return
    if (e.type === 'note') {
      const g = e.g
      if (g.cluster != null) return // part of a forearm slam: the cluster event handles it
      if (this.phase === 'card') {
        if (this.clock - this.cardAt > 0.7) this.beginWave()
        return
      }
      if (this.phase !== 'play' || this.ending) return
      this.pending.push({ g, at: performance.now() })
    } else if (e.type === 'cluster') {
      // the first notes of a slam were graded as normal notes before the cluster was recognised: drop them
      this.pending.length = 0
      if (this.phase !== 'play' || this.ending) return
      if (e.boom) this.boom()
      else this.jam(e.notes)
    }
  }

  private flushPending() {
    const now = performance.now()
    while (this.pending.length && now - this.pending[0].at >= BUFFER_MS) {
      const { g } = this.pending.shift()!
      if (this.phase === 'play' && !this.ending) this.handleNote(g)
    }
  }

  private matches(target: number, played: number) {
    return this.mode === 'easy' ? pc(target) === pc(played) : target === played
  }

  private handleNote(g: NoteGrade) {
    this.press.set(g.note, this.clock)
    if (this.clock < this.jamUntil) { this.dud(g.note); return }
    this.recent = this.recent.filter((r) => g.t - r.t <= CHORD_WINDOW && r.note !== g.note)
    this.recent.push({ note: g.note, t: g.t })

    if (this.boss) {
      const b = this.boss
      if (this.matches(b.melody[b.idx], g.note)) this.hitBoss(g)
      else this.miss(g.note)
      return
    }
    // 1. a chord zombie completed within 400 ms
    const chords = this.zombies.filter((z) => z.kind === 'chord').sort((a, b) => b.p - a.p)
    for (const z of chords) {
      if (z.chord!.tones.every((t) => this.recent.some((r) => this.matches(t, r.note)))) {
        this.recent = []
        this.blastChord(z, g.note)
        return
      }
    }
    // 2. a plain zombie: the lowest (closest) matching one
    let best: Zombie | null = null
    for (const z of this.zombies) if (z.kind === 'note' && this.matches(z.note, g.note) && (!best || z.p > best.p)) best = z
    if (best) { this.blast(best, g); return }
    // 3. a chord tone: building a chord, no penalty
    if (chords.some((z) => z.chord!.tones.some((t) => this.matches(t, g.note)))) {
      const lane = this.laneFor(g.note)
      if (lane) this.addBeam(lane, this.h * 0.55, false, undefined, true)
      return
    }
    this.miss(g.note)
  }

  private miss(note: number) {
    const lane = this.laneFor(note)
    if (lane) this.addBeam(lane, this.h - (this.h - this.horizonY) * 0.4, true)
    if (this.combo) { this.combo = 0; this.emit() }
  }
  private dud(note: number) {
    const lane = this.laneFor(note)
    if (lane) this.addParticle({ x: lane.cx, y: this.h - 8, vx: (rnd() - 0.5) * 30, vy: -30 - rnd() * 30, g: -10, life: 0, max: 0.6, kind: 3, ci: 0, size: 0.8, spin: 0 })
  }

  private points(g: NoteGrade) {
    const onBeat = g.rhythm != null && g.rhythm >= 0.8
    const base = 100 + 10 * Math.min(this.combo, 10)
    return { pts: base * (onBeat ? 2 : 1), onBeat }
  }

  private zombieCenter(z: Zombie) {
    const lane = this.laneFor(z.note)
    if (lane) z.x = lane.cx
    const s = (0.72 + 0.28 * z.p) * (z.kind === 'chord' ? 1.28 : 1)
    return { x: z.x, y: this.yAt(z.p) - (ZFEET - SIGN_Y) * this.zk * s, top: this.yAt(z.p) - ZFEET * this.zk * s }
  }

  private blast(z: Zombie, g: NoteGrade) {
    const { pts, onBeat } = this.points(g)
    const c = this.zombieCenter(z)
    const lane = this.laneFor(g.note)
    if (lane) this.addBeam(lane, c.y, false, c.x)
    this.zombies.splice(this.zombies.indexOf(z), 1)
    this.poof(c.x, c.y, false)
    this.score += pts; this.combo++
    this.pop('+' + pts, c.x, c.top + 6, onBeat ? '#ffe14a' : '#fff7b0', onBeat ? 30 : 26)
    if (onBeat) this.pop('ON BEAT!', c.x, c.top - 22, '#7dffb0', 20, 1.0)
    this.emit()
  }

  private blastChord(z: Zombie, playedNote: number) {
    const c = this.zombieCenter(z)
    for (const t of z.chord!.tones) {
      const lane = this.laneFor(t)
      if (lane) this.addBeam(lane, c.y, false, c.x)
    }
    this.zombies.splice(this.zombies.indexOf(z), 1)
    this.poof(c.x, c.y, true)
    const pts = 300 + 10 * Math.min(this.combo, 10)
    this.score += pts; this.combo++
    this.pop('+' + pts, c.x, c.top + 6, '#ffe14a', 32)
    this.pop('CHORD!', c.x, c.top - 24, '#7dffb0', 22, 1.0)
    void playedNote
    this.emit()
  }

  private hitBoss(g: NoteGrade) {
    const b = this.boss!
    const { pts, onBeat } = this.points(g)
    const c = this.bossCenter()
    const lane = this.laneFor(g.note)
    if (lane) this.addBeam(lane, c.y, false, c.x)
    b.idx++; b.flinch = 1
    this.score += pts; this.combo++
    this.poof(c.x + (rnd() - 0.5) * 40, c.y + (rnd() - 0.5) * 30, false)
    this.pop('+' + pts, c.x, c.top + 24, onBeat ? '#ffe14a' : '#fff7b0', onBeat ? 30 : 26)
    if (onBeat) this.pop('ON BEAT!', c.x, c.top - 4, '#7dffb0', 20, 1.0)
    if (b.idx >= b.max) this.defeatBoss()
    this.emit()
  }

  private defeatBoss() {
    const c = this.bossCenter()
    this.boss = null
    this.ending = true
    this.score += 1000
    this.poof(c.x, c.y, true); this.poof(c.x - 60, c.y + 20, true); this.poof(c.x + 60, c.y + 20, true)
    this.ring(c.x, c.y)
    this.pop('THE KING IS DOWN!', this.w / 2, this.h * 0.42, '#ffe14a', 38, 2.4)
    this.pop('+1000', this.w / 2, this.h * 0.55, '#fff7b0', 30, 2.0)
    this.setGuideKey('')
    this.after(2.6, () => this.gameOver(true))
  }

  // ---------------- forearm: JAM or BOOM ----------------
  private jam(notes: number[]) {
    this.jamUntil = this.clock + JAM_SECONDS
    this.jamShown = true
    for (const n of notes.slice(0, 8)) {
      const lane = this.laneFor(n)
      if (lane) for (let i = 0; i < 2; i++) this.addParticle({ x: lane.cx, y: this.h - 10, vx: (rnd() - 0.5) * 50, vy: -40 - rnd() * 50, g: -20, life: 0, max: 0.9, kind: 3, ci: 0, size: 1.1, spin: 0 })
    }
    this.emit()
  }

  private boom() {
    const n = this.zombies.length
    const ctr = this.w / 2
    this.ring(ctr, this.h)
    this.rings.push({ x: ctr, y: this.h, age: -0.16, max: 0.8 })
    if (!this.rm) this.shake = 0.4
    for (const z of this.zombies) {
      const c = this.zombieCenter(z)
      this.poof(c.x, c.y, false)
      this.score += 100
    }
    this.zombies = []
    if (this.boss) {
      const b = this.boss
      b.idx = Math.min(b.max - 1, b.idx + BOOM_BOSS_SKIP); b.flinch = 1
      const c = this.bossCenter()
      this.poof(c.x, c.y, true)
    }
    this.pop('BOOM!', ctr, this.h * 0.48, '#ffe14a', 54, 1.4)
    if (n) this.pop('+' + n * 100, ctr, this.h * 0.62, '#fff7b0', 28, 1.2)
    this.emit()
  }

  // ---------------- wave flow ----------------
  private after(sec: number, fn: () => void) { this.later = { at: this.clock + sec, fn } }

  private waveClear() {
    this.ending = true
    this.cleared++
    this.score += 500
    this.setGuideKey('')
    this.save.wave[this.mode] = Math.max(this.save.wave[this.mode], Math.min(LEVELS.length, this.wave + 1))
    writeSave(this.save)
    this.pop('WAVE CLEAR!', this.w / 2, this.h * 0.45, '#7dffb0', 44, 1.8)
    this.pop('+500', this.w / 2, this.h * 0.58, '#fff7b0', 30, 1.6)
    this.emit()
    this.after(2.0, () => {
      this.wave++
      this.bonusBrain = this.lives < MAX_LIVES
      if (this.bonusBrain) this.lives++
      this.resetField()
      this.phase = 'card'
      this.cardAt = this.clock
      this.emit()
    })
  }

  private recordBest() {
    if (this.score > 0 && this.score > this.save.best[this.mode]) { this.save.best[this.mode] = this.score; this.newBest = true }
    this.save.mode = this.mode
    writeSave(this.save)
  }

  private gameOver(won: boolean) {
    this.won = won
    this.stars = this.score <= 0 ? 0 : won ? 3 : this.cleared >= 2 ? 2 : 1
    this.recordBest()
    this.resetField()
    this.phase = 'over'
    this.emit()
  }

  private eat(z: Zombie) {
    const lane = this.laneFor(z.note)
    const x = lane ? lane.cx : z.x
    this.zombies.splice(this.zombies.indexOf(z), 1)
    this.loseBrain(x)
  }
  private loseBrain(x: number) {
    this.lives = Math.max(0, this.lives - 1)
    this.combo = 0
    this.pulse = Math.max(this.pulse, 0.95)
    this.pop('CHOMP! -1', clamp(x, 70, this.w - 70), this.h - 70, '#ff9aa8', 30, 1.1)
    for (let i = 0; i < 6; i++) this.addParticle({ x: x + (rnd() - 0.5) * 30, y: this.h - 14, vx: (rnd() - 0.5) * 90, vy: -60 - rnd() * 70, g: 120, life: 0, max: 0.8, kind: 3, ci: 0, size: 0.9, spin: 0 })
    if (this.lives <= 0) {
      this.ending = true
      this.after(0.9, () => this.gameOver(false))
    }
    this.emit()
  }

  // ---------------- spawning ----------------
  private spawnOne(): boolean {
    const lv = this.lv
    const n = this.spawned + 1
    let z: Zombie | null = null
    if (lv.chordEvery && n % lv.chordEvery === 0 && !this.zombies.some((q) => q.kind === 'chord' && q.p < 0.3)) {
      const ch = CHORDS[this.chordIx++ % CHORDS.length]
      const lane = this.laneFor(ch.tones[0])
      if (lane && ch.tones.every((t) => this.laneFor(t))) z = this.mkZombie('chord', ch.tones[0], ch.name, ch)
    }
    if (!z) {
      const note = this.pickNote(lv)
      if (note == null) return false
      const flat = isBlackKey(note) && rnd() < 0.5
      z = this.mkZombie('note', note, lv.hideNames ? '?' : noteLabel(note, flat), null)
    }
    this.zombies.push(z)
    this.spawned++
    this.spawnLeft--
    return true
  }
  private mkZombie(kind: 'note' | 'chord', note: number, label: string, chord: Chord | null): Zombie {
    const lane = this.laneFor(note)
    return { id: this.nextId++, kind, note, label, chord, p: 0, skin: (rnd() * SKINS.length) | 0, extra: (rnd() * EXTRAS) | 0, age: 0, walk: rnd() * 6, x: lane ? lane.cx : 0 }
  }
  private pickNote(lv: LevelDef): number | null {
    const pool = lv.pool.filter((n) => this.laneMap.has(n))
    if (!pool.length) return null
    for (let tries = 0; tries < pool.length * 2; tries++) {
      if (!this.bag.length) { this.bag = pool.slice(); for (let i = this.bag.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]] } }
      const n = this.bag.pop()!
      if (!pool.includes(n)) continue
      const clash = this.zombies.some((z) => z.kind === 'note' && ((z.note === n && z.p < 0.4) || (this.mode === 'easy' && pc(z.note) === pc(n) && z.p < 0.15)))
      if (!clash) return n
      this.bag.unshift(n)
    }
    return null
  }

  // ---------------- training wheels ----------------
  private setGuideKey(key: string, notes: number[] = [], tone: 'next' | 'danger' = 'next') {
    if (key === this.guideKey) return
    this.guideKey = key
    if (notes.length) setGuide(notes, tone)
    else clearGuide()
  }
  private updateGuide() {
    if (this.phase !== 'play' || this.ending || !this.lv.guide || this.clock < this.jamUntil) { this.setGuideKey(''); return }
    let near: Zombie | null = null
    for (const z of this.zombies) if (z.kind === 'note' && (!near || z.p > near.p)) near = z
    if (!near) { this.setGuideKey(''); return }
    const tone = near.p > 0.62 ? 'danger' : 'next'
    this.setGuideKey(near.note + tone, [near.note], tone)
  }

  // ---------------- update ----------------
  private frame = (now: number) => {
    if (this.dead) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.clock += dt
    this.flushPending()
    this.update(dt)
    this.render(dt)
  }

  private update(dt: number) {
    if (this.jamShown && this.clock >= this.jamUntil) { this.jamShown = false; this.emit() }
    if (this.clock < this.jamUntil) {
      this.jamPuff -= dt
      if (this.jamPuff <= 0) {
        this.jamPuff = 0.14
        const l = this.lanes[(rnd() * this.lanes.length) | 0]
        if (l) this.addParticle({ x: l.cx, y: this.h - 10, vx: (rnd() - 0.5) * 30, vy: -40 - rnd() * 40, g: -15, life: 0, max: 0.8, kind: 3, ci: 0, size: 1, spin: 0 })
      }
    }
    if (this.later && this.clock >= this.later.at) { const f = this.later.fn; this.later = null; f() }
    if (this.phase === 'card' && this.clock - this.cardAt > 12) this.beginWave()
    if (this.phase === 'play') {
      const lv = this.lv
      const slow = (this.mode === 'normal' ? 0.88 : 1) * (this.rm ? 1.3 : 1)
      if (this.boss) {
        const b = this.boss
        b.age += dt; b.flinch = Math.max(0, b.flinch - dt * 4)
        if (!this.ending) {
          b.p += dt / (lv.travel * slow)
          if (b.p >= 1) { this.boss = null; this.lives = 1; this.loseBrain(this.w / 2) }
        }
      } else if (!this.ending) {
        this.spawnTimer -= dt
        if (this.spawnLeft > 0 && this.spawnTimer <= 0 && this.zombies.length < 7) {
          this.spawnTimer = this.spawnOne() ? lv.interval * slow * (0.85 + rnd() * 0.3) : 0.4
        }
        const speed = dt / (lv.travel * slow)
        for (const z of [...this.zombies]) {
          z.age += dt; z.walk += dt * 5.2; z.p += speed
          if (z.p >= 1) this.eat(z)
        }
        if (!this.ending && this.spawnLeft <= 0 && this.zombies.length === 0 && this.spawned > 0) this.waveClear()
      }
      this.updateGuide()
    } else this.setGuideKey('')

    // effects
    this.pulse = Math.max(0, this.pulse - dt * 1.1)
    this.shake = Math.max(0, this.shake - dt)
    const ps = this.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life += dt
      if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt
      if (p.kind === 0) p.vx *= 1 - dt * 0.8
    }
    for (let i = this.pops.length - 1; i >= 0; i--) { this.pops[i].age += dt; if (this.pops[i].age >= this.pops[i].max) this.pops.splice(i, 1) }
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].age += dt; if (this.beams[i].age >= this.beams[i].max) this.beams.splice(i, 1) }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].age += dt; if (this.rings[i].age >= this.rings[i].max) this.rings.splice(i, 1) }
    for (const [n, t] of this.press) if (this.clock - t > 0.4) this.press.delete(n)
  }

  // ---------------- effects spawners ----------------
  private addParticle(p: Particle) {
    if (this.particles.length < (this.rm ? 90 : 260)) this.particles.push(p)
  }
  private poof(x: number, y: number, big: boolean) {
    const f = this.rm ? 0.35 : 1
    const nc = Math.round((big ? 30 : 16) * f), ns = Math.round((big ? 7 : 4) * f)
    for (let i = 0; i < nc; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, sp = 90 + rnd() * (big ? 260 : 190)
      this.addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 520, life: 0, max: 0.8 + rnd() * 0.6, kind: 0, ci: rnd() < 0.72 ? i % 3 : 3 + (i % 3), size: 1, spin: 6 + rnd() * 8 })
    }
    for (let i = 0; i < ns; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2, sp = 80 + rnd() * 200
      this.addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 280, life: 0, max: 0.7 + rnd() * 0.4, kind: 1, ci: i, size: 0.8 + rnd() * 0.6, spin: 0 })
    }
    for (let i = 0; i < Math.max(2, Math.round(3 * f)); i++) {
      this.addParticle({ x: x + (rnd() - 0.5) * 26, y: y + (rnd() - 0.5) * 26, vx: (rnd() - 0.5) * 30, vy: -20 - rnd() * 30, g: 0, life: 0, max: 0.45, kind: 2, ci: 0, size: big ? 1.6 : 1.1, spin: 0 })
    }
  }
  private pop(text: string, x: number, y: number, color: string, size: number, max = 0.95) {
    if (this.pops.length > 14) this.pops.shift()
    this.pops.push({ text, x: clamp(x, 60, this.w - 60), y: Math.max(66, y), age: 0, max: this.rm ? max * 0.8 : max, color, size })
  }
  private ring(x: number, y: number) { this.rings.push({ x, y, age: 0, max: 0.8 }) }

  private addBeam(lane: Lane, ty: number, fizzle: boolean, tx?: number, soft = false) {
    const ctx = this.ctx
    const y0 = this.h, y1 = clamp(ty, this.horizonY, this.h)
    const hue = fizzle || soft ? (soft ? 46 : 225) : noteHue(lane.note)
    const grad = ctx.createLinearGradient(0, y0, 0, y1)
    const sat = fizzle ? 18 : 100, lum = fizzle ? 74 : 68
    grad.addColorStop(0, `hsla(${hue},${sat}%,${lum}%,0.85)`)
    grad.addColorStop(1, `hsla(${hue},${sat}%,${lum}%,${fizzle || soft ? 0 : 0.5})`)
    const w = Math.max(6, lane.w * (lane.black ? 0.9 : 0.62))
    this.beams.push({ x: lane.cx, x2: tx ?? lane.cx, y0, y1, w, age: 0, max: fizzle ? 0.42 : 0.3, fizzle: fizzle || soft, grad, hue })
    if (fizzle && !soft) {
      for (let i = 0; i < 3; i++) this.addParticle({ x: lane.cx + (rnd() - 0.5) * lane.w * 0.5, y: y1, vx: (rnd() - 0.5) * 40, vy: -10 - rnd() * 30, g: -10, life: 0, max: 0.7, kind: 3, ci: 0, size: 0.9, spin: 0 })
    }
  }

  // ---------------- boss geometry ----------------
  /** the King walks the lower part of the lane, so his sign stays big enough to read */
  private bossFeetY(p: number) { return this.yAt(0.3 + 0.7 * p) }
  private bossScale() {
    const p = this.boss ? this.boss.p : 1
    const full = clamp(this.h * 0.56, 120, 260) / KH
    return full * (0.8 + 0.2 * p)
  }
  private bossCenter() {
    const b = this.boss
    const s = this.bossScale()
    const x = this.w / 2 + (this.rm || !b ? 0 : Math.sin(b.age * 0.7) * this.w * 0.035)
    const feet = this.bossFeetY(b ? b.p : 0.5)
    return { x, y: feet - (KFEET - KSIGN_Y + 6) * s, top: feet - KFEET * s }
  }

  // ---------------- render ----------------
  private render(_dt: number) {
    const ctx = this.ctx, w = this.w, h = this.h
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h)
    else { ctx.fillStyle = '#2c2563'; ctx.fillRect(0, 0, w, h) }
    const sp = this.sprites
    if (!sp) return
    // lane glow under keys you press
    for (const [n, t] of this.press) {
      const l = this.laneMap.get(n)
      if (!l) continue
      const a = 0.18 * (1 - (this.clock - t) / 0.4)
      ctx.fillStyle = `hsla(${noteHue(n)},90%,70%,${a.toFixed(3)})`
      ctx.fillRect(l.x, h - 70, l.w, 70)
    }
    if (this.shake > 0 && !this.rm) ctx.translate(Math.sin(this.clock * 90) * 3 * this.shake * 2.5, Math.cos(this.clock * 77) * 2 * this.shake * 2.5)

    // zombies, far ones first
    this.zombies.sort((a, b) => a.p - b.p)
    for (const z of this.zombies) this.drawZombie(sp, z)
    if (this.boss) this.drawBoss(sp, this.boss)

    // beams (light)
    ctx.globalCompositeOperation = 'lighter'
    for (const b of this.beams) {
      const t = b.age / b.max
      const a = b.fizzle ? (1 - t) * 0.8 : (1 - t * t)
      ctx.globalAlpha = Math.max(0, a)
      ctx.fillStyle = b.grad
      ctx.fillRect(b.x - b.w / 2, b.y1, b.w, b.y0 - b.y1)
      if (!b.fizzle) {
        ctx.fillStyle = 'rgba(255,255,255,.85)'
        ctx.fillRect(b.x - b.w * 0.14, b.y1, b.w * 0.28, b.y0 - b.y1)
        if (Math.abs(b.x2 - b.x) > b.w * 0.5) {
          ctx.fillStyle = `hsla(${b.hue},100%,75%,.9)`
          ctx.fillRect(Math.min(b.x, b.x2), b.y1 - 2, Math.abs(b.x2 - b.x), 4)
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    // particles
    const d = this.dpr
    for (const p of this.particles) {
      const t = p.life / p.max
      if (p.kind === 0) {
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
        const s = sp.confetti(p.ci, Math.floor(p.life * p.spin) % CONFETTI_FRAMES)
        ctx.drawImage(s, p.x - 8, p.y - 8, s.width / d, s.height / d)
      } else if (p.kind === 1) {
        ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1
        const s = sp.star(p.ci), sz = 22 * p.size * (1 - t * 0.3)
        ctx.drawImage(s, p.x - sz / 2, p.y - sz / 2, sz, sz)
      } else if (p.kind === 2) {
        ctx.globalAlpha = (1 - t) * 0.8
        const s = sp.puff(), sz = 64 * p.size * (0.5 + t)
        ctx.drawImage(s, p.x - sz / 2, p.y - sz / 2, sz, sz)
      } else {
        ctx.globalAlpha = (1 - t) * 0.7
        const s = sp.smoke(), sz = 34 * p.size * (0.6 + t * 0.9)
        ctx.drawImage(s, p.x - sz / 2, p.y - sz / 2, sz, sz)
      }
    }
    ctx.globalAlpha = 1
    // BOOM rings
    for (const r of this.rings) {
      if (r.age < 0) continue
      const t = r.age / r.max
      ctx.strokeStyle = `rgba(190,255,200,${(0.55 * (1 - t)).toFixed(3)})`
      ctx.lineWidth = 8 * (1 - t) + 2
      ctx.beginPath(); ctx.arc(r.x, r.y, 20 + t * this.w * 0.55, Math.PI, 2 * Math.PI); ctx.stroke()
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // pops
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
    for (const p of this.pops) {
      const t = p.age / p.max
      const grow = t < 0.15 ? 0.7 + (t / 0.15) * 0.45 : t < 0.3 ? 1.15 - ((t - 0.15) / 0.15) * 0.15 : 1
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
      ctx.font = `800 ${Math.round(p.size * grow)}px system-ui, -apple-system, "Segoe UI", sans-serif`
      const y = p.y - t * 30
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,12,70,.9)'
      ctx.strokeText(p.text, p.x, y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, y)
    }
    ctx.globalAlpha = 1
    // gentle red glow around the edges when a brain is lost (soft, slow, never a full-screen flash)
    if (this.pulse > 0.01 && this.vig) {
      const e = this.pulse
      ctx.globalAlpha = (this.rm ? 0.22 : 0.42) * Math.pow(e, 1.4)
      ctx.drawImage(this.vig, 0, 0, w, h)
      ctx.globalAlpha = 1
    }
  }

  private drawZombie(sp: Sprites, z: Zombie) {
    const ctx = this.ctx, zk = this.zk
    const lane = this.laneMap.get(z.note)
    if (lane) z.x = lane.cx
    const crown = z.kind === 'chord'
    const s = (0.72 + 0.28 * z.p) * (crown ? 1.28 : 1)
    const w = 100 * zk * s, hh = ZH * zk * s
    const feetY = this.yAt(z.p)
    const rise = clamp(z.age / 0.8, 0, 1)
    const frame = Math.sin(z.walk) > 0 ? 0 : 1
    const bob = this.rm ? 0 : -Math.abs(Math.sin(z.walk)) * 4 * s
    const sway = this.rm ? 0 : Math.sin(z.walk) * 0.05
    // shadow + dirt mound
    ctx.drawImage(sp.mound(), z.x - 40 * zk * s * 1.1, feetY - 14 * zk * s, 80 * zk * s * 1.1 * 1.2, 24 * zk * s * 1.1)
    ctx.save()
    ctx.translate(z.x, feetY)
    if (rise < 1) {
      ctx.beginPath(); ctx.rect(-w, -hh * 2, w * 2, hh * 2 + 2); ctx.clip()
    }
    ctx.translate(0, (1 - rise) * (1 - rise) * hh * 0.85 + bob)
    ctx.rotate(sway)
    const body = sp.zombie(z.skin, z.extra, frame, crown)
    ctx.drawImage(body, -w / 2, -ZFEET * zk * s, w, hh)
    const label = crown ? z.chord!.name : z.label
    const sign = sp.sign(label, z.skin, crown ? 3 : 0)
    ctx.drawImage(sign, -w / 2, -ZFEET * zk * s, w, hh)
    ctx.restore()
  }

  private drawBoss(sp: Sprites, b: Boss) {
    const ctx = this.ctx
    const s = this.bossScale()
    const c = this.bossCenter()
    const feetY = this.bossFeetY(b.p)
    const w = 150 * s, hh = KH * s
    const frame = Math.sin(b.age * 2.6) > 0 ? 0 : 1
    const bob = this.rm ? 0 : -Math.abs(Math.sin(b.age * 2.6)) * 5 * s
    const sq = 1 + b.flinch * 0.08
    ctx.drawImage(sp.shadow(), c.x - 80 * s * 1.3, feetY - 18 * s, 160 * s * 1.3, 34 * s)
    ctx.save()
    ctx.translate(c.x, feetY + bob)
    ctx.scale(sq, 1 / sq)
    ctx.rotate(this.rm ? 0 : Math.sin(b.age * 1.3) * 0.025 + (b.flinch > 0 ? Math.sin(this.clock * 60) * 0.03 * b.flinch : 0))
    ctx.drawImage(sp.king(frame), -w / 2, -KFEET * s, w, hh)
    const chips: string[] = []
    for (let i = 0; i < 5 && b.idx + i < b.max; i++) {
      const n = b.melody[b.idx + i]
      chips.push(noteLabel(n) + (this.mode === 'normal' ? '|' + String(Math.floor(n / 12) - 1) : ''))
    }
    ctx.drawImage(sp.kingSign(chips), -w / 2, -KFEET * s, w, hh)
    ctx.restore()
  }
}
