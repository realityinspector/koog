// BachDoom's rules, with no drawing. One Game object lives for as long as the component is mounted.
// Input is ONLY the judge's events (see music/judge.ts); every note that matters comes through onJudge().
import { PC_NAMES, noteName, pc } from '../../../music/theory'
import { PRELUDE_C } from '../../../music/scores'
import { clearGuide, setGuide } from '../../../music/guide'
import { pload, psave } from '../../../profile/profile'
import type { JudgeEvent, NoteGrade } from '../../../music/judge'
import type { DemonKind } from './types'
import { LEVELS, buildMap, buildPiece, pathAt, roomCounts } from './levels'
import type { LevelMap, Piece, Room } from './levels'

export type Diff = 'story' | 'normal' | 'ultra'
export type Phase = 'title' | 'play' | 'tally' | 'win' | 'lose'
export type FaceName = 'center' | 'left' | 'right' | 'grin' | 'hurt' | 'sweaty' | 'dizzy'
export interface SaveData { unlocked: number; best: Record<string, { stars: number; acc: number; time: number }>; diff: Diff }

export const DIFFS: { id: Diff; name: string; sub: string }[] = [
  { id: 'story', name: "I'm Too Young to Practice", sub: 'Demons wait for you. Any octave counts.' },
  { id: 'normal', name: 'Hurt Me Plenty', sub: 'Demons advance. Play the exact key.' },
  { id: 'ultra', name: 'Ultra-Virtuoso', sub: 'Timing counts. PERFECT hits do double.' },
]
const CFG = {
  story: { speed: 0, bite: 0, orbSpeed: 0, orbPush: 0.3, lunge: 0 },
  normal: { speed: 0.34, bite: 6, orbSpeed: 0.4, orbPush: 0.22, lunge: 0.6 },
  ultra: { speed: 0.46, bite: 8, orbSpeed: 0.75, orbPush: 0.18, lunge: 0.7 },
} as const

export interface Demon {
  kind: DemonKind; chunk: number; room: number
  hp: number; maxHp: number
  baseLat: number; lat: number; dist: number; spawnDist: number
  /** 0 alive, 1 harmonizing (fading into notes), 2 gone */
  state: 0 | 1 | 2
  t: number; hurtT: number; hurtCool: number; lungeT: number; biteT: number; dieT: number
}
export interface Orb { on: boolean; lat: number; dist: number; z: number; t: number; pop: number }
export interface Part { on: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; frame: number }
export interface Spark { on: boolean; x: number; y: number; vx: number; vy: number; life: number; max: number; frame: number }
export interface Pop { on: boolean; text: string; col: string; t: number; dur: number; big: boolean; world: boolean; wx: number; wy: number; wz: number; fx: number; fy: number }
export interface Pickup { x: number; y: number; on: boolean; ph: number }
export interface Boss { x: number; dist: number; hurtT: number; hurtCool: number; attackT: number; dieT: number; shownHp: number }

const NEW_SAVE = (): SaveData => ({ unlocked: 1, best: {}, diff: 'normal' })

export class Game {
  phase: Phase = 'title'
  diff: Diff = 'normal'
  levelIdx = 0
  save: SaveData
  reduced = false

  map!: LevelMap
  piece!: Piece
  room!: Room
  // camera
  s = 0; camX = 0; camY = 0; camAng = 0; speed = 0
  mode: 'glide' | 'fight' = 'glide'
  roomIdx = 0
  bobT = 0
  clearT = 0
  holdT = 0
  // run
  ptr = 0
  demons: Demon[] = []
  boss: Boss | null = null
  pickups: Pickup[] = []
  bossHp: number[] = []
  orbs: Orb[] = Array.from({ length: 6 }, () => ({ on: false, lat: 0, dist: 0, z: 0.5, t: 0, pop: 0 }))
  lastBar = -1
  chordT = 0
  // player
  harmony = 100; armor = 0; streak = 0; jamT = 0; recoilT = 0
  face: FaceName = 'center'
  faceHurtT = 0; faceGrinT = 0; lookT = 1; look: FaceName = 'center'
  vig = 0; lastVigAt = -9
  lastHitAt = 0
  wrongT = 0
  bfgT = -1; bfgDone = false; bfgPending = false
  shot = { t: 1, wx: 0, wy: 0, wz: 0 }
  smokeT = 0
  introT = 0
  endT = -1
  hintT = 0
  st = { hits: 0, wrongs: 0, perfects: 0, skipped: 0, bfgs: 0, kills: 0, demons: 0, bites: 0, time: 0 }
  result = { stars: 0, acc: 0, notesPct: 0, killsPct: 0, time: 0, newBest: false }
  // effects pools
  parts: Part[] = Array.from({ length: 56 }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, frame: 0 }))
  sparks: Spark[] = Array.from({ length: 32 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, frame: 0 }))
  pops: Pop[] = Array.from({ length: 10 }, () => ({ on: false, text: '', col: '#fff', t: 0, dur: 1, big: false, world: false, wx: 0, wy: 0, wz: 0, fx: 0.5, fy: 0.4 }))
  clock = 0
  /** wrong notes wait ~110 ms: the first notes of a forearm slam arrive before the judge knows it is a slam */
  private pend: { t: number; g: NoteGrade; exp: number }[] = []
  private guideKey = ''
  private tmp = { x: 0, y: 0 }
  private listeners = new Set<() => void>()
  private rngS = 1234567

  constructor() {
    const s = pload<SaveData>('bachdoom', NEW_SAVE())
    this.save = { ...NEW_SAVE(), ...s, best: { ...(s.best ?? {}) } }
    if (!DIFFS.some((d) => d.id === this.save.diff)) this.save.diff = 'normal'
    this.diff = this.save.diff
    this.startDemo()
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((f) => f()) }
  private rnd() { this.rngS = (this.rngS * 1103515245 + 12345) & 0x7fffffff; return this.rngS / 0x7fffffff }

  // ------------------------------------------------------------ lifecycle
  /** the title screen's backdrop: the ballroom, gliding from room to room, demons idling */
  startDemo() {
    this.phase = 'title'
    this.load(1)
    this.clearAll()
    this.emit()
  }
  toTitle() { this.startDemo() }

  start(levelIdx: number, diff: Diff) {
    this.diff = diff
    this.save.diff = diff
    psave('bachdoom', this.save)
    this.load(Math.max(0, Math.min(LEVELS.length - 1, levelIdx)))
    this.phase = 'play'
    this.clearAll()
    this.introT = 3.4
    this.emit()
  }
  retry() { this.start(this.levelIdx, this.diff) }
  next() { if (this.levelIdx + 1 < LEVELS.length) this.start(this.levelIdx + 1, this.diff); else this.toTitle() }

  private load(idx: number) {
    this.levelIdx = idx
    const spec = LEVELS[idx]
    this.map = buildMap(spec)
    this.piece = buildPiece(spec)
    this.demons = []
    this.boss = null
    this.bossHp = []
    this.pickups = []
    const nRooms = this.map.rooms.length
    this.placePickups()
    if (spec.boss) {
      this.bossHp = this.piece.chunks.map((c) => c.e - c.s)
      this.boss = { x: 0, dist: 6.4, hurtT: 0, hurtCool: 0, attackT: 0, dieT: -1, shownHp: 1 }
    } else {
      const counts = roomCounts(this.piece.chunks.length, nRooms)
      let ci = 0
      counts.forEach((n, r) => {
        for (let i = 0; i < n; i++, ci++) {
          const ch = this.piece.chunks[ci]
          const hp = ch.e - ch.s
          const lat = n === 1 ? 0 : (i - (n - 1) / 2) * (n === 2 ? 2.8 : 2.4) + (this.rnd() - 0.5) * 0.4
          const dist = 5.6 + (i % 2) * 0.9 + this.rnd() * 0.4
          this.demons.push({ kind: spec.demons[(ci + r) % spec.demons.length], chunk: ci, room: r, hp, maxHp: hp, baseLat: lat, lat, dist, spawnDist: dist, state: 0, t: this.rnd() * 3, hurtT: 0, hurtCool: 0, lungeT: 0, biteT: 1.2, dieT: 0 })
        }
      })
    }
  }

  private placePickups() {
    const m = this.map
    for (let i = 0; i + 1 < m.rooms.length; i++) {
      for (let s = m.rooms[i].stopS + 3.5; s < m.rooms[i + 1].stopS - 3; s += 2.4) { pathAt(m, s, this.tmp); this.pickups.push({ x: this.tmp.x, y: this.tmp.y, on: true, ph: s }) }
    }
  }

  private clearAll() {
    this.s = 0; this.speed = 0; this.mode = 'glide'; this.roomIdx = 0; this.clearT = 0; this.holdT = 0
    this.ptr = 0; this.lastBar = -1; this.chordT = 0
    this.harmony = 100; this.armor = 0; this.streak = 0; this.jamT = 0; this.recoilT = 0
    this.faceHurtT = 0; this.faceGrinT = 0; this.vig = 0; this.lastHitAt = 0; this.wrongT = 0
    this.bfgT = -1; this.bfgDone = false; this.bfgPending = false; this.shot.t = 1; this.smokeT = 0
    this.endT = -1; this.hintT = 0; this.pend.length = 0
    this.st = { hits: 0, wrongs: 0, perfects: 0, skipped: 0, bfgs: 0, kills: 0, demons: this.demons.length, bites: 0, time: 0 }
    for (const o of this.orbs) o.on = false
    for (const p of this.parts) p.on = false
    for (const p of this.sparks) p.on = false
    for (const p of this.pops) p.on = false
    for (const p of this.pickups) p.on = true
    this.room = this.map.rooms[0]
    pathAt(this.map, 0, this.tmp)
    this.camX = this.tmp.x; this.camY = this.tmp.y; this.camAng = this.room.ang
    this.guideKey = ''
    if (this.phase !== 'play') clearGuide()
    this.syncGuide()
  }

  // ------------------------------------------------------------ helpers
  get spec() { return LEVELS[this.levelIdx] }
  get isBoss() { return !!this.spec.boss }
  get playing() { return this.phase === 'play' && this.endT < 0 }
  chunkOf(i: number) { const cs = this.piece.chunks; for (let k = 0; k < cs.length; k++) if (i < cs[k].e) return k; return cs.length - 1 }
  get expected(): number | null { return this.ptr < this.piece.notes.length ? this.piece.notes[this.ptr] : null }
  /** the next few notes for the HUD */
  upcoming(n: number, out: number[]) { out.length = 0; for (let i = 0; i < n && this.ptr + i < this.piece.notes.length; i++) out.push(this.piece.notes[this.ptr + i]) }
  get target(): Demon | null {
    if (this.isBoss) return null
    const c = this.chunkOf(this.ptr)
    for (const d of this.demons) if (d.room === this.roomIdx && d.chunk === c && d.state === 0) return d
    return null
  }
  demonPos(d: Demon, out: { x: number; y: number }) { const r = this.map.rooms[d.room]; out.x = r.sx + r.hx * d.dist + r.rx * d.lat; out.y = r.sy + r.hy * d.dist + r.ry * d.lat }
  bossPos(out: { x: number; y: number }) { const r = this.room; out.x = r.sx + r.hx * this.boss!.dist; out.y = r.sy + r.hy * this.boss!.dist }
  orbPos(o: Orb, out: { x: number; y: number }) { const r = this.room; out.x = r.sx + r.hx * o.dist + r.rx * o.lat; out.y = r.sy + r.hy * o.dist + r.ry * o.lat }
  get bossPhase() { return this.isBoss ? this.chunkOf(this.ptr) : 0 }
  get bar() { return Math.min(this.piece.bars - 1, Math.floor(this.ptr / 16)) }
  get inDanger() {
    if (this.isBoss) { for (const o of this.orbs) if (o.on && o.dist < 4.2) return true; return false }
    const t = this.target
    return !!t && t.dist < 3.7 && this.diff !== 'story'
  }

  private addPop(text: string, col: string, big = false, world?: { x: number; y: number; z: number }, fy = 0.4, fx = 0.5) {
    let p = this.pops.find((q) => !q.on)
    if (!p) p = this.pops[0]
    p.on = true; p.text = text; p.col = col; p.t = 0; p.dur = big ? 1.6 : 1.1; p.big = big
    p.world = !!world
    if (world) { p.wx = world.x; p.wy = world.y; p.wz = world.z } else { p.fx = fx; p.fy = fy }
  }
  private burst(x: number, y: number, z: number, n: number) {
    if (this.reduced) n = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) {
      const p = this.parts.find((q) => !q.on)
      if (!p) return
      const a = this.rnd() * Math.PI * 2, sp = 0.5 + this.rnd() * 1.1
      p.on = true; p.x = x; p.y = y; p.z = z
      p.vx = Math.cos(a) * sp * 0.6; p.vy = Math.sin(a) * sp * 0.6; p.vz = 0.8 + this.rnd() * 1.2
      p.life = p.max = 0.9 + this.rnd() * 0.5; p.frame = i & 1
    }
  }
  private muzzle(n: number) {
    if (this.reduced) n = 1
    for (let i = 0; i < n; i++) {
      const p = this.sparks.find((q) => !q.on)
      if (!p) return
      p.on = true; p.x = 0.5 + (this.rnd() - 0.5) * 0.04; p.y = 0.66
      p.vx = (this.rnd() - 0.5) * 0.35; p.vy = -0.32 - this.rnd() * 0.3
      p.life = p.max = 0.45 + this.rnd() * 0.2; p.frame = i & 1
    }
  }
  hurtPlayer(amount: number) {
    if (this.diff === 'story' || this.phase !== 'play' || this.endT >= 0) return
    if (this.armor > 0) { const a = Math.min(this.armor, amount * 0.5); this.armor -= a; amount -= a }
    this.harmony = Math.max(0, this.harmony - amount)
    this.faceHurtT = 0.7
    this.streak = 0
    // red edge pulse: at most 3 per second
    if (this.clock - this.lastVigAt >= 0.34) { this.lastVigAt = this.clock; this.vig = 1 }
    if (this.harmony <= 0) this.lose()
  }
  private lose() {
    this.phase = 'lose'
    clearGuide(); this.guideKey = ''
    this.emit()
  }

  // ------------------------------------------------------------ judge input
  onJudge(e: JudgeEvent) {
    if (this.phase !== 'play' || this.endT >= 0) return
    if (e.type === 'note') this.onNote(e.g)
    else if (e.type === 'cluster') { this.pend.length = 0; if (e.boom) this.fireBfg(); else this.jam() }
    else if (e.type === 'cadence') {
      this.harmony = Math.min(100, this.harmony + 10)
      this.faceGrinT = 1.2
      this.addPop('CADENCE! +10 HARMONY', '#7cf0a0', false, undefined, 0.62, 0.2)
    } else if (e.type === 'resolve') {
      this.armor = Math.min(100, this.armor + 20)
      this.addPop('RESOLVED! +TEMPO', '#8fd4ff', false, undefined, 0.62, 0.2)
    }
  }

  private jam() {
    if (this.jamT > 0) return
    this.jamT = 1.5
    this.streak = 0
    this.addPop('JAMMED!', '#ffb454', true, undefined, 0.5)
  }

  private onNote(g: NoteGrade) {
    if (g.cluster != null || g.chordMember) return
    if (this.mode !== 'fight' || this.jamT > 0) return
    const exp = this.expected
    if (exp == null) return
    // between rooms (the last demon is fading) the notes just wait for the next wave
    if (!this.isBoss && !this.target) return
    const ok = this.diff === 'story' ? pc(g.note) === pc(exp) : g.note === exp
    if (!ok) this.pend.push({ t: this.clock + 0.11, g, exp })
    else this.hit(g)
  }

  private misfire(g: NoteGrade, exp: number) {
    this.st.wrongs++
    this.streak = 0
    this.smokeT = 0.5
    this.wrongT = 0.35
    this.hintT = 2.2
    if (pc(g.note) === pc(exp) && this.diff !== 'story') this.addPop('RIGHT NOTE, WRONG OCTAVE!', '#ffd76c', false, undefined, 0.6, 0.78)
    else if (this.diff === 'story') this.addPop('TRY ' + PC_NAMES[pc(exp)] + '!', '#ffd76c', false, undefined, 0.6, 0.78)
    else this.addPop('MISFIRE!', '#c9c3e6', false, undefined, 0.6, 0.78)
    if (CFG[this.diff].lunge > 0) {
      const t = this.target
      if (t) { t.lungeT = 0.5; t.dist = Math.max(2.4, t.dist - CFG[this.diff].lunge) }
      if (this.isBoss) for (const o of this.orbs) if (o.on) o.dist = Math.max(2.0, o.dist - 0.5)
    }
  }

  private hit(g: NoteGrade) {
    const cfg = CFG[this.diff]
    const ci = this.chunkOf(this.ptr)
    let perfect = false
    if (this.diff === 'ultra' && this.lastHitAt > 0 && this.ptr > 0) {
      const want = this.piece.gap[this.ptr]
      const win = Math.min(140, Math.max(70, want * 0.22))
      perfect = Math.abs(g.t - this.lastHitAt - want) <= win
    }
    this.lastHitAt = g.t
    const dmg = perfect ? 2 : 1
    this.st.hits++
    this.streak++
    if (perfect) this.st.perfects++
    this.recoilT = 0.16
    this.muzzle(3)
    this.chordT = 0 // the chord preview is over once you play
    let wx = 0, wy = 0, wz = 0.5
    const ch = this.piece.chunks[ci]
    if (this.isBoss) {
      this.bossPos(this.tmp); wx = this.tmp.x; wy = this.tmp.y; wz = 1.2
      this.bossHp[ci] -= dmg
      const b = this.boss!
      if (b.hurtCool <= 0) { b.hurtT = 0.12; b.hurtCool = 0.34 }
      if (this.bossHp[ci] <= 0) { this.st.skipped += ch.e - this.ptr - 1; this.ptr = ch.e; this.phaseDone(ci) } else this.ptr++
      for (const o of this.orbs) if (o.on) o.dist = Math.min(this.boss!.dist - 1.2, o.dist + cfg.orbPush * (perfect ? 2 : 1))
      if (this.ptr >= this.piece.notes.length && this.boss && this.boss.dieT < 0) this.bossDefeated()
    } else {
      const d = this.target
      if (d) {
        this.demonPos(d, this.tmp); wx = this.tmp.x; wy = this.tmp.y; wz = 0.55
        d.hp -= dmg
        if (d.hurtCool <= 0) { d.hurtT = 0.2; d.hurtCool = 0.34 } // the hurt blink never repeats more than 3 times a second
        if (d.hp <= 0) { this.st.skipped += ch.e - this.ptr - 1; this.ptr = ch.e; this.harmonize(d) } else this.ptr++
      } else this.ptr++
    }
    this.shot.t = 0; this.shot.wx = wx; this.shot.wy = wy; this.shot.wz = wz
    if (perfect) this.addPop('PERFECT!', '#7cf0a0', false, { x: wx, y: wy, z: wz + 0.7 })
    if (this.streak > 0 && this.streak % 8 === 0) this.faceGrinT = 1.0
    this.syncGuide()
  }

  private harmonize(d: Demon, quiet = false) {
    d.state = 1; d.dieT = 0.85
    this.st.kills++
    this.demonPos(d, this.tmp)
    this.burst(this.tmp.x, this.tmp.y, 0.5, 9)
    if (!quiet) this.addPop('HARMONIZED!', '#ffd76c', false, { x: this.tmp.x, y: this.tmp.y, z: 1.25 })
    this.faceGrinT = 1.2
  }

  private phaseDone(ci: number) {
    const b = this.boss!
    this.bossPos(this.tmp)
    this.burst(this.tmp.x, this.tmp.y, 1.1, 14)
    this.faceGrinT = 1.4
    if (ci < this.piece.chunks.length - 1) {
      this.addPop('PHASE ' + (ci + 1) + ' HARMONIZED!', '#ffd76c', true, undefined, 0.3)
      for (const o of this.orbs) o.on = false
      b.hurtT = 0.35
    }
  }
  private bossDefeated() {
    const b = this.boss!
    b.dieT = 0
    for (const o of this.orbs) o.on = false
    this.bossPos(this.tmp)
    this.burst(this.tmp.x, this.tmp.y, 1.2, 28)
    this.addPop('THE CACOPHODEMON IS HARMONIZED!', '#ffd76c', true, undefined, 0.3)
    this.finish()
  }

  private fireBfg() {
    if (this.mode !== 'fight') { this.bfgPending = true; return }
    if (this.bfgT >= 0) return
    this.bfgT = 0; this.bfgDone = false
    this.st.bfgs++
    this.faceGrinT = 2
    this.addPop('BFG!', '#fff0a0', true, undefined, 0.3)
  }
  private bfgImpact() {
    this.bfgDone = true
    if (this.isBoss) {
      const b = this.boss!
      const ci = this.chunkOf(this.ptr), ch = this.piece.chunks[ci]
      const barEnd = Math.min(ch.e, (Math.floor(this.ptr / 16) + 1) * 16)
      const n = barEnd - this.ptr
      this.bossHp[ci] -= n
      this.ptr = barEnd
      for (const o of this.orbs) o.on = false
      this.bossPos(this.tmp); this.burst(this.tmp.x, this.tmp.y, 1.1, 14)
      b.hurtT = 0.4
      if (this.bossHp[ci] <= 0) { this.phaseDone(ci); if (this.ptr >= this.piece.notes.length) this.bossDefeated() }
    } else {
      let last = -1
      for (const d of this.demons) if (d.room === this.roomIdx && d.state === 0) { this.harmonize(d, true); last = Math.max(last, d.chunk) }
      if (last >= 0) { this.ptr = this.piece.chunks[last].e; this.lastHitAt = 0; this.addPop('EVERYONE HARMONIZED!', '#ffd76c', true, undefined, 0.42) }
      // any of the room's chunks not alive but unplayed are already behind us
    }
    this.syncGuide()
  }

  // ------------------------------------------------------------ per-frame update
  update(dtRaw: number) {
    const dt = Math.min(0.05, Math.max(0, dtRaw))
    this.clock += dt
    for (const p of this.pops) if (p.on) { p.t += dt; if (p.t >= p.dur) p.on = false }
    for (const p of this.parts) if (p.on) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 2.2 * dt; if (p.z < 0.05) { p.z = 0.05; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5 } if (p.life <= 0) p.on = false }
    for (const p of this.sparks) if (p.on) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) p.on = false }
    if (this.vig > 0) this.vig = Math.max(0, this.vig - dt * 2.2)
    if (this.recoilT > 0) this.recoilT -= dt
    if (this.smokeT > 0) this.smokeT -= dt
    if (this.wrongT > 0) this.wrongT -= dt
    if (this.hintT > 0) this.hintT -= dt
    if (this.jamT > 0) this.jamT -= dt
    if (this.faceHurtT > 0) this.faceHurtT -= dt
    if (this.faceGrinT > 0) this.faceGrinT -= dt
    if (this.shot.t < 1) this.shot.t += dt / 0.18
    if (this.introT > 0) this.introT -= dt
    for (const o of this.orbs) if (o.pop > 0) o.pop -= dt
    this.updateFace(dt)
    while (this.pend.length && this.pend[0].t <= this.clock) {
      const w = this.pend.shift()!
      if (this.phase === 'play' && this.endT < 0 && this.mode === 'fight' && this.jamT <= 0) this.misfire(w.g, w.exp)
    }

    if (this.phase === 'title' || this.phase === 'play') this.updateWorld(dt)
    if (this.phase === 'play' && this.endT >= 0) {
      this.endT -= dt
      if (this.endT <= 0) { this.endT = -1; this.phase = this.isBoss ? 'win' : 'tally'; clearGuide(); this.guideKey = ''; this.emit() }
    }
    if (this.phase === 'play') this.syncGuide()
  }

  private updateFace(dt: number) {
    this.lookT -= dt
    if (this.lookT <= 0) { const r = this.rnd(); this.look = r < 0.38 ? 'left' : r < 0.76 ? 'right' : 'center'; this.lookT = 0.9 + this.rnd() * 1.6 }
    this.face = this.phase === 'lose' ? 'dizzy' : this.faceHurtT > 0 ? 'hurt' : this.harmony < 30 && this.phase !== 'title' ? 'sweaty' : this.faceGrinT > 0 ? 'grin' : this.look
  }

  private updateWorld(dt: number) {
    const map = this.map
    const demo = this.phase === 'title'
    const running = demo || this.endT < 0
    // ---- camera
    const target = map.rooms[Math.min(this.roomIdx, map.rooms.length - 1)]
    this.room = target
    if (this.mode === 'glide') {
      const remain = target.stopS - this.s
      const want = Math.min(6.4, 0.8 + remain * 1.8)
      this.speed += (want - this.speed) * Math.min(1, dt * 3)
      this.s += this.speed * dt
      this.bobT += dt * this.speed * 2.1
      if (this.s >= target.stopS - 0.02) { this.s = target.stopS; this.speed = 0; this.mode = 'fight'; this.onArrive() }
    }
    pathAt(map, this.s, this.tmp)
    this.camX = this.tmp.x; this.camY = this.tmp.y
    let wantAng = target.ang
    if (this.mode === 'glide' && target.stopS - this.s > 1.4) {
      pathAt(map, this.s + 1.7, this.tmp)
      const dx = this.tmp.x - this.camX, dy = this.tmp.y - this.camY
      if (dx * dx + dy * dy > 0.04) wantAng = Math.atan2(dy, dx)
    }
    let da = wantAng - this.camAng
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    this.camAng += da * Math.min(1, dt * 4.5)
    if (this.boss && this.boss.dieT >= 0) this.boss.dieT += dt
    if (!running) return

    if (this.phase === 'play') this.st.time += dt

    // ---- golden note pickups along the corridors
    if (this.phase === 'play') {
      for (const p of this.pickups) {
        if (!p.on) continue
        const dx = p.x - this.camX, dy = p.y - this.camY
        if (dx * dx + dy * dy < 0.8) { p.on = false; this.harmony = Math.min(100, this.harmony + 2); this.burst(p.x, p.y, 0.45, 4); this.muzzle(1) }
      }
    }

    // ---- demons
    for (const d of this.demons) {
      if (d.state === 2) continue
      d.t += dt
      if (d.hurtT > 0) d.hurtT -= dt
      if (d.hurtCool > 0) d.hurtCool -= dt
      if (d.lungeT > 0) d.lungeT -= dt
      if (d.state === 1) { d.dieT -= dt; if (d.dieT <= 0) d.state = 2; continue }
      if (d.room !== this.roomIdx || this.mode !== 'fight' || demo) continue
      const cfg = CFG[this.diff]
      if (cfg.speed > 0) {
        const isT = this.target === d
        if (isT) d.dist = Math.max(2.4, d.dist - cfg.speed * dt)
        else {
          // the rest of the wave hangs back in a queue
          let rank = 0
          for (const o of this.demons) if (o.room === d.room && o.state === 0 && o.chunk < d.chunk) rank++
          d.dist = Math.max(3.5 + rank * 0.5, d.dist - cfg.speed * 0.3 * dt)
        }
        d.lat = d.baseLat * Math.max(0.15, Math.min(1, (d.dist - 2.4) / 3.2))
        if (d.dist <= 2.55) { d.biteT -= dt; if (d.biteT <= 0) { d.biteT = 1.5; d.lungeT = 0.4; this.st.bites++; this.hurtPlayer(cfg.bite) } }
      }
    }

    // ---- boss
    if (this.boss) this.updateBoss(dt, demo)

    // ---- BFG animation
    if (this.bfgT >= 0) {
      this.bfgT += dt
      if (!this.bfgDone && this.bfgT >= 0.6) this.bfgImpact()
      if (this.bfgT > 1.4) this.bfgT = -1
    }

    // ---- room cleared?
    if (this.mode === 'fight' && !this.isBoss && this.endT < 0) {
      if (demo) {
        this.holdT += dt
        if (this.holdT > 3.2) { this.holdT = 0; this.roomIdx++; this.mode = 'glide'; if (this.roomIdx >= map.rooms.length) { this.roomIdx = 0; this.s = 0; this.speed = 0; pathAt(map, 0, this.tmp); this.camX = this.tmp.x; this.camY = this.tmp.y; this.camAng = map.rooms[0].ang } }
      } else {
        let alive = 0
        for (const d of this.demons) if (d.room === this.roomIdx && d.state === 0) alive++
        if (alive === 0) {
          this.clearT += dt
          if (this.clearT > 0.55) {
            this.clearT = 0; this.roomIdx++
            if (this.roomIdx >= map.rooms.length) this.finish()
            else this.mode = 'glide'
          }
        }
      }
    }
  }

  private onArrive() {
    if (this.phase === 'play' && this.bfgPending) { this.bfgPending = false; this.fireBfg() }
    if (this.isBoss) this.lastBar = -1
    this.hintT = 0
  }

  private updateBoss(dt: number, demo: boolean) {
    const b = this.boss!
    if (b.hurtT > 0) b.hurtT -= dt
    if (b.hurtCool > 0) b.hurtCool -= dt
    if (b.attackT > 0) b.attackT -= dt
    if (b.dieT >= 0) return
    if (this.mode !== 'fight' || demo) return
    const cfg = CFG[this.diff]
    if (this.chordT > 0) this.chordT -= dt
    const bar = this.bar
    if (bar !== this.lastBar) {
      this.lastBar = bar
      this.chordT = this.diff === 'story' ? 1.6 : 0
      // orbs that were held far back last bar fizzle away; closer ones keep coming
      for (const o of this.orbs) if (o.on && o.dist > b.dist * 0.6) { o.on = false; o.pop = 0.3 }
      // lob the orbs for this bar
      const n = this.diff === 'story' ? 1 : this.diff === 'normal' ? 1 + (bar >= 9 ? 1 : 0) : 2
      b.attackT = 0.7
      for (let i = 0; i < n; i++) {
        const o = this.orbs.find((q) => !q.on)
        if (!o) break
        o.on = true; o.lat = (i === 0 ? -1 : 1) * (0.6 + this.rnd() * 1.4) * (n === 1 ? (this.rnd() < 0.5 ? -1 : 1) : 1); o.dist = b.dist - 1.2; o.z = 0.55; o.t = 0
      }
    }
    for (const o of this.orbs) {
      if (!o.on) continue
      o.t += dt
      if (this.diff === 'story') { o.dist = Math.max(3.6, o.dist - 0.35 * dt) } else o.dist -= cfg.orbSpeed * dt
      if (o.dist <= 2.0) { o.on = false; o.pop = 0.35; this.st.bites++; this.hurtPlayer(cfg.bite + 2) }
    }
    b.shownHp += (this.bossHpFrac() - b.shownHp) * Math.min(1, dt * 6)
  }
  bossHpFrac() { let hp = 0, max = 0; this.piece.chunks.forEach((c, i) => { max += c.e - c.s; hp += Math.max(0, this.bossHp[i] ?? 0) }); return max ? hp / max : 0 }

  // ------------------------------------------------------------ the end of a level
  private finish() {
    const st = this.st, total = this.piece.notes.length
    const acc = st.hits + st.wrongs > 0 ? st.hits / (st.hits + st.wrongs) : 1
    const notesPct = Math.min(1, (st.hits + st.skipped) / Math.max(1, total))
    const killsPct = this.isBoss ? 1 : st.demons ? st.kills / st.demons : 1
    const stars = 1 + (acc >= 0.75 ? 1 : 0) + (acc >= 0.92 ? 1 : 0)
    const id = this.spec.id, old = this.save.best[id]
    const better = !old || stars > old.stars || (stars === old.stars && acc > old.acc)
    if (better) this.save.best[id] = { stars, acc, time: st.time }
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, this.levelIdx + 2))
    psave('bachdoom', this.save)
    this.result = { stars, acc, notesPct, killsPct, time: st.time, newBest: better }
    this.endT = this.isBoss ? 3.2 : 1.4
    if (!this.isBoss) this.addPop('LEVEL CLEAR!', '#ffd76c', true, undefined, 0.35)
    this.faceGrinT = 3
    clearGuide(); this.guideKey = ''
  }

  // ------------------------------------------------------------ keybed guide
  private syncGuide() {
    let key = '', targets: number[] = [], tone: 'next' | 'danger' | 'gold' = 'next'
    if (this.phase === 'play' && this.endT < 0 && this.mode === 'fight' && this.diff !== 'ultra' && this.expected != null) {
      if (this.isBoss && this.diff === 'story' && this.chordT > 0) {
        targets = [...new Set(PRELUDE_C[this.bar].notes)]; tone = 'gold'
      } else {
        targets = [this.expected]; tone = this.inDanger ? 'danger' : 'next'
      }
      key = tone + ':' + targets.join(',')
    }
    if (key === this.guideKey) return
    this.guideKey = key
    if (key) setGuide(targets, tone); else clearGuide()
  }

  dispose() { clearGuide(); this.listeners.clear() }

  // dev helpers (used by tests through window.__bachdoom)
  noteLabel(n: number) { return noteName(n) }
}
