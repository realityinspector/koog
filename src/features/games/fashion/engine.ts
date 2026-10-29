// Runway Remix engine: phases, input (Judge), the loop and all canvas drawing. One `Game` per mounted component;
// nothing lives at module level, and destroy() removes every listener, timer, the guide and the score.
import { onJudge, type JudgeEvent } from '../../../music/judge'
import { useHarmonyStore } from '../../../music/harmonyStore'
import { setGuide, clearGuide } from '../../../music/guide'
import { setScore, setScorePos, clearScore } from '../../../music/scoreStore'
import { pc, noteName } from '../../../music/theory'
import {
  CATS, ERAS, MODELS, MAX_LOOKS, computeScores, eraById, fifthPos, homePal, hueOfPos, judgeSay, loadSave, newStats, optionsOf, palColors, palName,
  parseChord, piecesFor, runwayNotes, saveSave, starsOf, wheelCaption, WHEEL_LABEL, CAT_INFO,
  type Cat, type Era, type JudgeSay, type Look, type Pal, type Phase, type Piece, type RunNote, type RunStats, type Save, type SavedLook, type Scores,
} from './data'
import { NEUTRAL, buildFigure, drawFigure, drawHatAlone, goofyHat, makeAudience, type Figure, type Layer, type Pose } from './sprites'

export interface Toast { id: number; text: string; kind: 'good' | 'oops' | 'boom' | 'info' }
export interface Snapshot {
  phase: Phase; eraId: string; items: number[]; itemNames: string[]; itemCounts: number[]
  pal: Pal; palName: string; mood: string; caption: string; model: string
  pieces: { id: string; title: string }[]; pieceIdx: number
  bpm: number; done: number; total: number; confidence: number; nextName: string; started: boolean
  toast: Toast | null; says: JudgeSay[] | null; scores: Scores | null; stars: number; saved: boolean
  save: Save; newUnlock: string | null; reduced: boolean; zoneHit: number
}

const TAU = Math.PI * 2
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ZONE_COL = ['#ff7ab8', '#ffb84d', '#6fd38a', '#5ab8ff', '#b890ff']
const FIG_H = 215
interface Spark { x: number; y: number; t0: number; life: number; r: number; col: string }
interface Confetti { x: number; y: number; vx: number; vy: number; rot: number; vr: number; col: string; sz: number }
interface Floater { text: string; x: number; y: number; t0: number; col: string }
interface Person { x: number; y: number; u: number; v: number; ph: number }
interface Run {
  notes: RunNote[]; idx: number; cum: number[]; total: number; stats: RunStats; piece: Piece
  p: number; target: number; foot: 0 | 1; stepT0: number; stepDur: number; lastHit: number
  confidence: number; poseUntil: number; ended: boolean; endAt: number; started: boolean; wobbleT0: number; hits: number
}

export class Game {
  private canvas: HTMLCanvasElement; private root: HTMLElement; private ctx: CanvasRenderingContext2D
  private onSnap: (s: Snapshot) => void
  private raf = 0; private last = 0; private clock = 0; private dead = false
  private w = 0; private h = 0; private dpr = 1; private sig = ''
  private rm = false; private mq: MediaQueryList | null = null
  private onMq = () => { this.rm = !!this.mq?.matches; this.emit() }
  private ro: ResizeObserver; private mo: MutationObserver | null = null; private moTarget: Element | null = null
  private poll = 0
  private offJudge: () => void; private offHarm: () => void
  private save: Save
  private phase: Phase = 'eras'
  private era: Era = ERAS[0]
  private items = [0, 0, 0, 0, 0]
  private pal: Pal = { root: 0, q: 'major' }
  private modelIdx = 0
  private pieces: Piece[] = []; private pieceIdx = 0
  private fig: Figure | null = null; private figKey = ''; private figDirty = true; private figAt = 0
  private goofy: Layer | null = null
  private bg: HTMLCanvasElement | null = null; private bgKey = ''
  private wheelC: HTMLCanvasElement | null = null; private wheelKey = ''
  private keys: { note: number; x: number; w: number }[] = []
  private zoneOfNote = new Map<number, number>(); private zones: { x0: number; x1: number }[] = []
  private zoneHitT = [-9, -9, -9, -9, -9]; private zoneHit = -1
  private cycleTimer = 0; private pendingCycle: { z: number } | null = null
  private sparks: Spark[] = []; private confetti: Confetti[] = []; private floaters: Floater[] = []
  private flashQ: number[] = []; private lastFlash = -9
  private audience: Person[] = []; private audSprites: HTMLCanvasElement[][] = []; private audKey = ''
  private ovation = 0; private ovationUntil = 0
  private hat = { fly: false, t0: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, back: 0 }
  private toast: Toast | null = null; private toastUntil = 0; private toastId = 0
  private faceUntil = 0; private face: Pose['face'] = 'happy'
  private styleBounce = -9
  private run: Run | null = null
  private says: JudgeSay[] | null = null; private scores: Scores | null = null; private stars = 0; private saved = false; private newUnlock: string | null = null
  private prevKey: { tonic: number; scale: import('../../../music/theory').ScaleType } | null = null
  private lastChord: string | null = null
  private wheelPulse = -9
  private viewW = 0

  constructor(canvas: HTMLCanvasElement, root: HTMLElement, onSnap: (s: Snapshot) => void) {
    this.canvas = canvas; this.root = root; this.onSnap = onSnap
    this.ctx = canvas.getContext('2d')!
    this.save = loadSave()
    this.modelIdx = this.save.model
    this.setEraInternal(ERAS[0])
    try { this.mq = window.matchMedia('(prefers-reduced-motion: reduce)'); this.rm = this.mq.matches; this.mq.addEventListener('change', this.onMq) } catch { /* none */ }
    this.ro = new ResizeObserver(() => this.refresh())
    this.ro.observe(root)
    window.addEventListener('resize', this.onWin)
    canvas.addEventListener('pointerdown', this.onPointer)
    this.poll = window.setInterval(() => this.refresh(), 1000)
    this.offJudge = onJudge((e) => this.onJudgeEvent(e))
    this.offHarm = useHarmonyStore.subscribe((s) => { if (s.chord !== this.lastChord) { this.lastChord = s.chord; this.onChord(s.chord) } })
    this.refresh(true)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    if (import.meta.env.DEV) (window as unknown as { __fr?: Game }).__fr = this
    this.emit()
  }
  private onWin = () => this.refresh()

  destroy() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect(); this.mo?.disconnect()
    window.removeEventListener('resize', this.onWin)
    this.canvas.removeEventListener('pointerdown', this.onPointer)
    clearInterval(this.poll); clearTimeout(this.cycleTimer)
    this.mq?.removeEventListener('change', this.onMq)
    this.offJudge(); this.offHarm()
    this.leaveRunway()
    clearGuide(); clearScore('fashion')
  }

  // ---------------- snapshot ----------------
  private snap(): Snapshot {
    const r = this.run
    const names = CATS.map((c, i) => optionsOf(this.era, c)[this.items[i]]?.name ?? '')
    const next = r ? r.notes[r.idx]?.note : null
    return {
      phase: this.phase, eraId: this.era.id, items: [...this.items], itemNames: names, itemCounts: CATS.map((c) => optionsOf(this.era, c).length),
      pal: this.pal, palName: palName(this.pal), mood: palColors(this.pal).mood, caption: wheelCaption(this.pal), model: MODELS[this.modelIdx].name,
      pieces: this.pieces.map((p) => ({ id: p.id, title: p.title })), pieceIdx: this.pieceIdx,
      bpm: (r?.piece ?? this.pieces[this.pieceIdx])?.song.bpm ?? 100, done: r ? r.hits : 0, total: r ? r.notes.filter((n) => n.note != null).length : 0, confidence: r ? r.confidence : 0,
      nextName: next != null ? noteName(next) : '', started: !!r?.started,
      toast: this.toast, says: this.says, scores: this.scores, stars: this.stars, saved: this.saved, save: this.save, newUnlock: this.newUnlock, reduced: this.rm, zoneHit: this.zoneHit,
    }
  }
  private emit() { if (!this.dead) this.onSnap(this.snap()) }
  private say(text: string, kind: Toast['kind'] = 'info', secs = 2.2) { this.toast = { id: ++this.toastId, text, kind }; this.toastUntil = this.clock + secs; this.emit() }

  // ---------------- commands (called by the UI) ----------------
  private setEraInternal(e: Era) {
    this.era = e
    this.pieces = piecesFor(e); this.pieceIdx = 0
    this.items = [0, 0, 0, 0, 0]
    const k = this.pieces[0]?.song.key
    this.pal = k ? homePal(k) : { root: 0, q: 'major' }
    this.figDirty = true
  }
  pickEra(id: string) {
    if (!this.save.unlocked.includes(id)) return
    this.setEraInternal(eraById(id))
    this.setPhase('style')
  }
  toEras() { this.setPhase('eras') }
  toStyle() { this.setPhase('style') }
  toLookbook() { this.setPhase('lookbook') }
  setPiece(i: number) { if (this.pieces.length) { this.pieceIdx = (i + this.pieces.length) % this.pieces.length; this.emit() } }
  nextModel() { this.modelIdx = (this.modelIdx + 1) % MODELS.length; this.save.model = this.modelIdx; saveSave(this.save); this.figDirty = true; this.emit() }
  cycle(cat: Cat, dir: 1 | -1 = 1) {
    const ci = CATS.indexOf(cat), n = optionsOf(this.era, cat).length
    this.items[ci] = (this.items[ci] + dir + n) % n
    this.figDirty = true; this.styleBounce = this.clock
    const it = optionsOf(this.era, cat)[this.items[ci]]
    this.zoneHitT[ci] = this.clock; this.zoneHit = ci
    this.floatText(it.name, ZONE_COL[ci])
    this.sparkleAroundModel(ZONE_COL[ci], 3)
    this.emit()
  }
  setPal(p: Pal) { this.pal = p; this.figDirty = true; this.wheelPulse = this.clock; this.emit() }
  startRunway() {
    if (!this.pieces.length) return
    this.setPhase('runway')
  }
  retryRunway() { this.setPhase('runway') }
  saveLook() {
    if (this.saved) return
    const look = this.look()
    const entry: SavedLook = { ...look, items: [...look.items], id: Date.now(), stars: this.stars, t: Date.now() }
    this.save.looks = [entry, ...this.save.looks].slice(0, MAX_LOOKS)
    saveSave(this.save); this.saved = true
    this.say('Saved to your Lookbook!', 'good'); this.emit()
  }
  deleteLook(id: number) { this.save.looks = this.save.looks.filter((l) => l.id !== id); saveSave(this.save); this.emit() }
  tryOn(id: number) {
    const l = this.save.looks.find((x) => x.id === id)
    if (!l || !this.save.unlocked.includes(l.era)) return
    this.setEraInternal(eraById(l.era))
    this.items = [...l.items]; this.pal = { ...l.pal }; this.modelIdx = l.model % MODELS.length
    const pi = this.pieces.findIndex((p) => p.id === l.piece); if (pi >= 0) this.pieceIdx = pi
    this.figDirty = true
    this.setPhase('style')
  }
  look(): Look { return { era: this.era.id, items: [...this.items], pal: { ...this.pal }, model: this.modelIdx, piece: this.pieces[this.pieceIdx]?.id ?? '' } }

  private setPhase(p: Phase) {
    if (this.phase === 'runway' && p !== 'runway') this.leaveRunway()
    this.phase = p
    this.toast = null; this.floaters = []
    if (p === 'runway') this.enterRunway()
    if (p === 'style') { this.says = null; this.scores = null; this.saved = false }
    if (p === 'results') this.ovationUntil = 0
    this.emit()
  }

  // ---------------- runway ----------------
  private enterRunway() {
    const piece = this.pieces[this.pieceIdx]
    const notes = runwayNotes(piece.song)
    const cum: number[] = [0]
    for (const n of notes) cum.push(cum[cum.length - 1] + n.beats)
    let idx = notes.findIndex((n) => n.note != null)
    if (idx < 0) idx = 0
    this.run = {
      notes, idx, cum, total: cum[cum.length - 1] || 1, stats: newStats(notes.filter((n) => n.note != null).length), piece,
      p: 0, target: 0, foot: 0, stepT0: -9, stepDur: 0.4, lastHit: -9, confidence: 0, poseUntil: 0, ended: false, endAt: 0, started: false, wobbleT0: -9, hits: 0,
    }
    this.says = null; this.scores = null; this.saved = false; this.newUnlock = null
    const hs = useHarmonyStore.getState()
    this.prevKey = { ...hs.key }
    hs.setKey(piece.song.key)
    setScore({ owner: 'fashion', title: piece.title, notes: notes.map((n) => ({ note: n.note, beats: n.beats })), key: piece.song.key, bpm: piece.song.bpm }, idx)
    this.updateGuide()
    this.hat.fly = false; this.ovation = 0
  }
  private leaveRunway() {
    if (this.prevKey) { useHarmonyStore.getState().setKey(this.prevKey as never); this.prevKey = null }
    clearGuide(); clearScore('fashion')
  }
  private updateGuide() {
    const r = this.run
    if (!r || r.ended) { clearGuide(); return }
    const t: number[] = []
    for (let i = r.idx; i < r.notes.length && t.length < 2; i++) { const n = r.notes[i].note; if (n != null) t.push(n) }
    setGuide(t, 'next')
  }

  // ---------------- input ----------------
  private onJudgeEvent(e: JudgeEvent) {
    if (this.dead) return
    if (e.type === 'note') {
      const g = e.g
      if (g.cluster != null) return
      if (this.phase === 'style') {
        if (g.chordMember) { this.pendingCycle = null; clearTimeout(this.cycleTimer); return }
        const z = this.zoneFor(g.note)
        this.pendingCycle = { z }
        clearTimeout(this.cycleTimer)
        this.cycleTimer = window.setTimeout(() => { const p = this.pendingCycle; this.pendingCycle = null; if (p && !this.dead && this.phase === 'style') this.cycle(CATS[p.z]) }, 70)
      } else if (this.phase === 'runway') this.onRunNote(g)
    } else if (e.type === 'cluster') {
      if (e.boom) this.boom(); else this.fizzle()
    } else if (e.type === 'cadence') {
      const r = this.run
      if (this.phase === 'runway' && r && !r.ended) { r.stats.cadences++; this.strikePose(1.3, 3, 'A confident pose!') }
    } else if (e.type === 'motif') { if (this.run) this.run.stats.motifs++ }
  }

  private onChord(name: string | null) {
    const p = parseChord(name)
    if (!p || this.phase !== 'style') return
    if (this.pendingCycle) { this.pendingCycle = null; clearTimeout(this.cycleTimer) } // the notes were a chord, not a keypress
    this.setPal(p)
    this.floatText(palName(p) + ' colours', palColors(p).main)
  }

  private onRunNote(g: { note: number; kind: string; rhythm: number | null; chordMember: boolean }) {
    const r = this.run
    if (!r || r.ended || g.chordMember) return
    const exp = r.notes[r.idx]?.note
    if (exp == null) return
    r.started = true
    const st = r.stats
    st.allNotes++
    if (g.kind !== 'spicy') st.inKey++
    const onBeat = g.rhythm == null || g.rhythm >= 0.6
    if (g.rhythm != null) { st.rhythmN++; if (g.rhythm >= 0.6) st.rhythmOn++ }
    if (pc(g.note) === pc(exp)) {
      st.hits++; r.hits++
      const sec = r.notes[r.idx].beats * 60 / r.piece.song.bpm
      r.foot = r.foot ? 0 : 1; r.stepT0 = this.clock; r.stepDur = clamp(sec * 0.85, 0.24, 0.55); r.lastHit = this.clock
      r.confidence = clamp(r.confidence + (onBeat ? 0.14 : -0.05), 0, 1)
      setScorePos(r.idx + 1, 'hit')
      r.idx++
      while (r.idx < r.notes.length && r.notes[r.idx].note == null) { r.idx++; setScorePos(r.idx) }
      r.target = r.cum[Math.min(r.idx, r.notes.length)] / r.total
      if (r.idx >= r.notes.length) { st.homeFinish = pc(g.note) === useHarmonyStore.getState().key.tonic; this.finish() }
      else this.updateGuide()
      if (onBeat && r.confidence > 0.6 && r.hits % 4 === 0) this.floatText('Strut!', '#ffe36e')
      this.emit()
    } else {
      st.wrong++
      r.confidence = clamp(r.confidence - 0.1, 0, 1)
      r.wobbleT0 = this.clock; this.face = 'oops'; this.faceUntil = this.clock + 0.7
      setScorePos(r.idx, 'miss')
      this.floatText('Whoops, recover!', '#ffd0a0')
      this.emit()
    }
  }

  private finish() {
    const r = this.run!
    r.ended = true; r.endAt = this.clock
    clearGuide()
    this.strikePose(2.6, 6, 'Final pose!')
    this.ovationUntil = this.clock + 3
  }

  private fizzle() {
    if (this.phase !== 'style' && this.phase !== 'runway') return
    if (this.run) this.run.stats.fizzles++
    this.pendingCycle = null; clearTimeout(this.cycleTimer)
    const f = this.pos()
    this.hat = { fly: true, t0: this.clock, x: f.x, y: f.y - f.s * 190, vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 40), vy: -260, rot: 0, vr: (Math.random() - 0.5) * 12, back: 0 }
    this.face = 'oops'; this.faceUntil = this.clock + 1.4
    this.say('Wardrobe malfunction! Whoops, my hat!', 'oops', 2.4)
  }
  private boom() {
    if (this.phase !== 'style' && this.phase !== 'runway') return
    if (this.run) this.run.stats.booms++
    this.pendingCycle = null; clearTimeout(this.cycleTimer)
    this.face = 'proud'; this.faceUntil = this.clock + 3
    this.ovationUntil = this.clock + 3.2
    this.say('SHOW-STOPPER! Standing ovation!', 'boom', 3)
    if (!this.rm) for (const side of [-1, 1]) for (let i = 0; i < 70; i++) {
      const ang = -Math.PI / 2 + -side * (0.15 + Math.random() * 0.6)
      const sp = 380 + Math.random() * 380
      this.confetti.push({ x: side < 0 ? this.w * 0.04 : this.w * 0.96, y: this.h * 0.95, vx: Math.cos(ang) * sp * 1, vy: Math.sin(ang) * sp, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14, col: `hsl(${Math.floor(Math.random() * 360)} 90% 62%)`, sz: 5 + Math.random() * 5 })
    }
    this.flashQ.push(this.clock + 0.1, this.clock + 0.5, this.clock + 0.9)
  }
  /** a pose with a few small, rate-limited camera sparkles */
  private strikePose(secs: number, flashes: number, text: string) {
    const r = this.run
    if (r) r.poseUntil = this.clock + secs
    this.face = 'proud'; this.faceUntil = this.clock + secs
    for (let i = 0; i < flashes; i++) this.flashQ.push(this.clock + 0.15 + i * 0.4)
    this.floatText(text, '#ffe36e')
  }

  // ---------------- geometry ----------------
  private refresh(force = false) {
    if (this.dead) return
    const r = this.root.getBoundingClientRect()
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const strip = document.querySelector('.kb-strip')
    if (strip && strip !== this.moTarget) { this.mo?.disconnect(); this.mo = new MutationObserver(() => this.refresh()); this.mo.observe(strip, { childList: true }); this.moTarget = strip }
    const keys = this.readKeys()
    const sig = `${w}x${h}@${dpr}|` + keys.map((k) => `${k.note}:${Math.round(k.x)}:${Math.round(k.w)}`).join(',')
    if (!force && sig === this.sig) return
    this.sig = sig
    if (w !== this.w || h !== this.h || dpr !== this.dpr) { this.w = w; this.h = h; this.dpr = dpr; this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.bgKey = ''; this.wheelKey = '' }
    this.keys = keys
    this.zoneOfNote.clear()
    this.zones = []
    const n = keys.length
    for (let z = 0; z < 5; z++) this.zones.push({ x0: Infinity, x1: -Infinity })
    keys.forEach((k, i) => {
      const z = Math.min(4, Math.floor((i * 5) / Math.max(1, n)))
      this.zoneOfNote.set(k.note, z)
      this.zones[z].x0 = Math.min(this.zones[z].x0, k.x); this.zones[z].x1 = Math.max(this.zones[z].x1, k.x + k.w)
    })
    if (!n) for (let z = 0; z < 5; z++) this.zones[z] = { x0: (w * z) / 5, x1: (w * (z + 1)) / 5 }
    this.figDirty = true
  }
  private readKeys() {
    const cr = this.canvas.getBoundingClientRect()
    const out: { note: number; x: number; w: number }[] = []
    document.querySelectorAll<HTMLElement>('.kb-key[data-note]').forEach((el) => {
      const r = el.getBoundingClientRect()
      const note = Number(el.dataset.note)
      if (r.width > 0 && Number.isFinite(note)) out.push({ note, x: r.left - cr.left, w: r.width })
    })
    return out.sort((a, b) => a.note - b.note)
  }
  private zoneFor(note: number) {
    const z = this.zoneOfNote.get(note)
    if (z != null) return z
    return clamp(Math.floor(((note - 48) / 37) * 5), 0, 4)
  }
  private bandH() { return Math.max(26, Math.round(this.h * 0.075)) }
  private wheel() {
    const R = Math.max(30, Math.min(this.w * 0.12, this.h * 0.24))
    return { cx: Math.max(R + 10, this.w * 0.135), cy: this.h * 0.12 + R + 6, R }
  }
  /** where the model's feet are, and the pixels per figure unit */
  private pos() {
    const w = this.w, h = this.h
    if (this.phase === 'runway' && this.run) {
      const p = clamp(this.run.p, 0, 1)
      const e = p * p * (3 - 2 * p) * 0.5 + p * 0.5
      const footY = lerp(h * 0.5, h * 0.9, e)
      const sPx = lerp(h * 0.36, h * 0.62, e)
      return { x: w * 0.5, y: footY, s: sPx / FIG_H }
    }
    if (this.phase === 'results') return { x: w * 0.17, y: h * 0.92, s: (h * 0.62) / FIG_H }
    const feet = h - this.bandH() - h * 0.03
    return { x: w * 0.5, y: feet, s: ((feet - h * 0.25) / FIG_H) }
  }

  private onPointer = (ev: PointerEvent) => {
    if (this.phase !== 'style') return
    const r = this.canvas.getBoundingClientRect()
    const x = ev.clientX - r.left, y = ev.clientY - r.top
    const { cx, cy, R } = this.wheel()
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy)
    if (d > R || d < R * 0.28) return
    const ang = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU
    const p = Math.round(ang / (TAU / 12)) % 12
    const root = (p * 7) % 12
    this.setPal({ root, q: d > R * 0.6 ? 'major' : 'minor' })
  }

  // ---------------- loop ----------------
  private frame = (now: number) => {
    if (this.dead) return
    this.raf = requestAnimationFrame(this.frame)
    if (document.hidden) { this.last = now; return }
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.clock += dt
    this.update(dt)
    this.draw()
  }

  private update(dt: number) {
    if (this.toast && this.clock > this.toastUntil) { this.toast = null; this.emit() }
    if (this.zoneHit >= 0 && this.clock - this.zoneHitT[this.zoneHit] > 0.5) { this.zoneHit = -1 }
    if (this.face !== 'happy' && this.clock > this.faceUntil) this.face = 'happy'
    // flashes: small local sparkles, at most one per 0.38 s (under 3 a second), never full screen
    if (this.flashQ.length && this.clock >= this.flashQ[0]) {
      this.flashQ.shift()
      if (!this.rm && this.clock - this.lastFlash >= 0.38 && this.audience.length) {
        this.lastFlash = this.clock
        const a = this.audience[Math.floor(Math.random() * this.audience.length)]
        this.sparks.push({ x: a.x, y: a.y - 10 * a.u, t0: this.clock, life: 0.34, r: 11 + Math.random() * 4, col: '#fffbe0' })
      }
    }
    this.sparks = this.sparks.filter((s) => this.clock - s.t0 < s.life)
    this.floaters = this.floaters.filter((f) => this.clock - f.t0 < 1.4)
    // confetti
    for (const c of this.confetti) { c.vy += 520 * dt; c.vx *= 1 - 0.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt }
    this.confetti = this.confetti.filter((c) => c.y < this.h + 20)
    // hat physics
    const ht = this.hat
    if (ht.fly) {
      const age = this.clock - ht.t0
      if (age < 1.5) { ht.vy += 900 * dt; ht.x += ht.vx * dt; ht.y += ht.vy * dt; ht.rot += ht.vr * dt; const g = this.pos().y; if (ht.y > g - 8) { ht.y = g - 8; ht.vy *= -0.3; ht.vx *= 0.6; ht.vr *= 0.5 } }
      else if (age > 2.1) { ht.fly = false }
    }
    this.ovation += ((this.clock < this.ovationUntil ? 1 : 0) - this.ovation) * Math.min(1, dt * 6)
    const r = this.run
    if (r && this.phase === 'runway') {
      r.p += (r.target - r.p) * Math.min(1, dt * 5)
      r.confidence = Math.max(0, r.confidence - dt * 0.03)
      if (r.ended && this.clock - r.endAt > 2.8) this.toResults()
    }
    if (this.figDirty && this.clock - this.figAt > 0.05 && this.w > 0) this.rebuildFigure()
  }

  private rebuildFigure() {
    const sc = Math.round(((this.phase === 'runway' ? this.h * 0.58 : this.h * 0.62) / FIG_H) * this.dpr * 4) / 4
    const look = this.look()
    const key = JSON.stringify([look.era, look.items, look.pal, look.model, sc])
    this.figDirty = false; this.figAt = this.clock
    if (key === this.figKey && this.fig) return
    this.figKey = key
    this.fig = buildFigure(look, Math.max(0.5, sc))
    this.goofy = goofyHat(Math.max(0.5, sc))
  }

  private toResults() {
    const r = this.run!
    const key = useHarmonyStore.getState().key
    const look = this.look()
    const sc = computeScores(look, r.stats, key)
    const overall = (sc.style + sc.rhythm + sc.harmony) / 3
    this.scores = sc; this.stars = starsOf(overall)
    this.says = judgeSay(look, r.stats, key, sc)
    const prev = this.save.best[this.era.id] ?? 0
    if (this.stars > prev) this.save.best[this.era.id] = this.stars
    const i = ERAS.findIndex((e) => e.id === this.era.id)
    const next = ERAS[i + 1]
    this.newUnlock = null
    if (next && !this.save.unlocked.includes(next.id)) { this.save.unlocked.push(next.id); this.newUnlock = next.name }
    saveSave(this.save)
    this.leaveRunway()
    this.phase = 'results'
    this.face = 'proud'; this.faceUntil = this.clock + 99
    this.ovationUntil = this.clock + (this.stars >= 4 ? 99 : 0)
    this.emit()
  }

  // ---------------- drawing ----------------
  private poseNow(): Pose {
    const t = this.clock, rm = this.rm
    const p: Pose = { ...NEUTRAL }
    p.face = this.face
    const k = rm ? 0.3 : 1
    const ht = this.hat
    p.hatOn = !(ht.fly)
    if (this.phase === 'runway' && this.run) {
      const r = this.run
      const u = (t - r.stepT0) / r.stepDur
      const conf = 0.4 + r.confidence * 0.6
      if (u >= 0 && u < 1) {
        const lift = Math.sin(u * Math.PI)
        const fwd = Math.sin(u * Math.PI) * conf
        if (r.foot) { p.liftR = lift; p.swingR = fwd; p.swingL = -fwd * 0.6 } else { p.liftL = lift; p.swingL = fwd; p.swingR = -fwd * 0.6 }
        p.bob = -lift * 2.5 * k; p.sway = (r.foot ? 1 : -1) * 0.04 * conf * k; p.arm = (r.foot ? -1 : 1) * Math.sin(u * Math.PI) * 0.5 * conf * k
      } else { p.bob = Math.sin(t * 2.4) * 0.6 * k }
      if (t < r.poseUntil) { p.tilt = -0.045 * k; p.arm = 0.35; p.sway = 0.03 * k; p.liftL = 0; p.liftR = 0; p.swingL = 0; p.swingR = 0 }
      const wu = (t - r.wobbleT0) / 0.6
      if (wu >= 0 && wu < 1) p.tilt += Math.sin(wu * TAU * 2) * 0.07 * (1 - wu) * k
    } else {
      p.bob = Math.sin(t * 2) * 0.8 * k
      p.sway = Math.sin(t * 1.3) * 0.02 * k
      const b = (t - this.styleBounce) / 0.4
      if (b >= 0 && b < 1) p.bob -= Math.sin(b * Math.PI) * 5 * k
      if (this.ovation > 0.5 && this.phase === 'results') p.arm = 0.5
    }
    return p
  }

  private draw() {
    const g = this.ctx
    const w = this.w, h = this.h
    if (!w) return
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const era = this.era
    if (this.phase === 'eras' || this.phase === 'lookbook') { this.drawBg(g, 'style', ERAS[ERAS.length - 1]); return }
    const runLike = this.phase === 'runway' || this.phase === 'results'
    this.drawBg(g, runLike ? 'run' : 'style', era)
    if (runLike) this.drawAudience(g)
    // model
    const f = this.fig
    if (f) {
      const { x, y, s } = this.pos()
      const pose = this.poseNow()
      drawFigure(g, f, x, y, s, pose)
      if (this.hat.fly && this.hat.t0 >= 0) {
        const L = f.hat ?? this.goofy
        if (L) { g.save(); g.translate(this.hat.x, this.hat.y); g.scale(s, s); const k = 1 / L.sc; g.rotate(this.hat.rot); g.drawImage(L.c, -L.ox * k, -L.oy * k, L.c.width * k, L.c.height * k); g.restore() }
      }
      void drawHatAlone
    }
    if (this.phase === 'style') { this.drawWheel(g); this.drawZones(g) }
    // confetti and sparkles
    for (const c of this.confetti) { g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.fillStyle = c.col; g.fillRect(-c.sz / 2, -c.sz / 4, c.sz, c.sz / 2); g.restore() }
    for (const s of this.sparks) {
      const a = (this.clock - s.t0) / s.life, k = Math.sin(a * Math.PI)
      g.save(); g.translate(s.x, s.y); g.globalAlpha = 0.9 * k; g.fillStyle = s.col
      const r = s.r * (0.6 + 0.4 * k)
      g.beginPath(); for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU, rr = i % 2 ? r * 0.28 : r; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) } g.closePath(); g.fill(); g.restore()
    }
    for (const fl of this.floaters) {
      const a = (this.clock - fl.t0) / 1.4
      g.save(); g.globalAlpha = a < 0.8 ? 1 : 1 - (a - 0.8) / 0.2
      g.font = `800 ${Math.max(14, Math.round(h * 0.045))}px system-ui, sans-serif`; g.textAlign = 'center'
      g.lineWidth = 5; g.strokeStyle = 'rgba(20,8,40,.9)'; g.strokeText(fl.text, fl.x, fl.y - a * 24); g.fillStyle = '#fff'; g.fillText(fl.text, fl.x, fl.y - a * 24); g.restore()
    }
  }

  private floatText(text: string, col: string) {
    const { x, y, s } = this.pos()
    this.floaters.push({ text, x: this.phase === 'style' ? x : x, y: y - s * 200, t0: this.clock, col })
    if (this.floaters.length > 4) this.floaters.shift()
  }
  private sparkleAroundModel(col: string, n: number) {
    if (this.rm) return
    const { x, y, s } = this.pos()
    for (let i = 0; i < n; i++) this.sparks.push({ x: x + (Math.random() - 0.5) * 90 * s * 1.6, y: y - Math.random() * 190 * s, t0: this.clock + i * 0.02, life: 0.5, r: 8 + Math.random() * 5, col })
  }

  // ---- background (cached per era + size) ----
  private drawBg(g: CanvasRenderingContext2D, kind: 'style' | 'run', era: Era) {
    const key = `${kind}|${era.id}|${this.w}x${this.h}@${this.dpr}`
    if (key !== this.bgKey || !this.bg) { this.bg = this.renderBg(kind, era); this.bgKey = key }
    g.drawImage(this.bg, 0, 0, this.w, this.h)
  }
  private renderBg(kind: 'style' | 'run', era: Era): HTMLCanvasElement {
    const w = this.w, h = this.h
    const c = document.createElement('canvas'); c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr)
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr)
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, era.bg[0]); gr.addColorStop(1, era.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h)
    // glow behind
    const rg = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.5); rg.addColorStop(0, era.glow + '55'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h)
    this.decor(g, era, w, h)
    // curtains
    g.fillStyle = 'rgba(0,0,0,.18)'
    for (let i = 0; i < 14; i++) { const x = i * (w / 14); g.fillRect(x, 0, w / 56, h * 0.4) }
    // spotlight cones (soft, static)
    for (const fx of [0.22, 0.5, 0.78]) {
      const sg = g.createLinearGradient(0, 0, 0, h); sg.addColorStop(0, 'rgba(255,255,255,.13)'); sg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = sg; g.beginPath(); g.moveTo(w * fx - 8, 0); g.lineTo(w * fx + 8, 0); g.lineTo(w * (fx + (fx - 0.5) * 0.3) + w * 0.12, h); g.lineTo(w * (fx + (fx - 0.5) * 0.3) - w * 0.12, h); g.closePath(); g.fill()
    }
    if (kind === 'run') {
      g.fillStyle = 'rgba(8,4,24,.55)'; g.fillRect(0, h * 0.36, w, h * 0.64)
      const { yf, yn, hf, hn } = this.runwayGeo()
      const rg2 = g.createLinearGradient(0, yf, 0, yn); rg2.addColorStop(0, '#d9d2f0'); rg2.addColorStop(1, '#fff7ff')
      g.fillStyle = rg2; g.beginPath(); g.moveTo(w / 2 - hf, yf); g.lineTo(w / 2 + hf, yf); g.lineTo(w / 2 + hn, yn); g.lineTo(w / 2 - hn, yn); g.closePath(); g.fill()
      g.strokeStyle = 'rgba(80,50,120,.4)'; g.lineWidth = 2; g.stroke()
      // edge lights
      for (let i = 0; i <= 10; i++) { const t = i / 10, y = lerp(yf, yn, t), hw = lerp(hf, hn, t); for (const s of [-1, 1]) { g.fillStyle = era.glow; g.globalAlpha = 0.9; g.beginPath(); g.arc(w / 2 + s * hw, y, 1.5 + t * 3, 0, TAU); g.fill() } }
      g.globalAlpha = 1
    } else {
      g.fillStyle = 'rgba(8,4,24,.4)'; g.fillRect(0, h * 0.8, w, h * 0.2)
      const feet = h - this.bandH() - h * 0.03
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(w / 2, feet + 2, w * 0.1, h * 0.03, 0, 0, TAU); g.fill()
      g.fillStyle = era.glow + '55'; g.beginPath(); g.ellipse(w / 2, feet + 2, w * 0.07, h * 0.02, 0, 0, TAU); g.fill()
    }
    return c
  }
  private runwayGeo() { const w = this.w, h = this.h; return { yf: h * 0.38, yn: h * 0.98, hf: w * 0.07, hn: w * 0.3 } }
  private decor(g: CanvasRenderingContext2D, era: Era, w: number, h: number) {
    g.save(); g.globalAlpha = 0.28; g.strokeStyle = era.glow; g.fillStyle = era.glow; g.lineWidth = 2
    switch (era.id) {
      case 'baroque': for (const x of [0.12, 0.88]) { g.strokeRect(w * x - 34, h * 0.1, 68, h * 0.28); g.strokeRect(w * x - 26, h * 0.1 + 8, 52, h * 0.28 - 16) } break
      case 'classical': for (const x of [0.1, 0.9]) { g.fillRect(w * x - 10, h * 0.08, 20, h * 0.34); g.fillRect(w * x - 16, h * 0.08, 32, 8); g.fillRect(w * x - 16, h * 0.4, 32, 8) } break
      case 'romantic': for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(w * (0.08 + i * 0.14), h * 0.1 + (i % 2) * 14, 10, 0, TAU); g.fill() } break
      case 'belle': for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? era.glow : '#ffffff'; g.fillRect(i * (w / 16), 0, w / 16, h * 0.08) } break
      case 'jazz': for (let r = 30; r < h * 0.5; r += 22) { g.beginPath(); g.arc(w / 2, h * 0.38, r, Math.PI, TAU); g.stroke() } break
      default: for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(w * i / 12, h * 0.38); g.lineTo(w * (0.5 + (i / 12 - 0.5) * 2.6), h); g.stroke() }
    }
    g.restore()
  }

  // ---- audience ----
  private buildAudience() {
    const key = `${this.w}x${this.h}`
    if (key === this.audKey) return
    this.audKey = key
    const u0 = this.h / 400
    const sc = Math.max(0.6, u0 * 1.4 * this.dpr)
    const skins = ['#f1c9a5', '#7a4a2e', '#c68a5c', '#4a2c1c', '#e8be94', '#a56b44']
    const hairs = ['#2a1a10', '#d9602a', '#111', '#c4a35a', '#5a3a20', '#888']
    this.audSprites = [0, 1].map((st) => Array.from({ length: 6 }, (_, i) => makeAudience(i * 55 + 200, skins[i], hairs[(i * 5) % 6], st === 1, sc)))
    const { yf, yn, hf, hn } = this.runwayGeo()
    this.audience = []
    const rows = [0.62, 0.78, 0.96]
    rows.forEach((fy, ri) => {
      const y = this.h * fy
      const t = clamp((y - yf) / (yn - yf), 0, 1)
      const hw = lerp(hf, hn, t)
      const u = u0 * (0.8 + ri * 0.32)
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
        const x = this.w / 2 + side * (hw + 22 * u + i * 32 * u + (ri % 2) * 14 * u)
        if (x > 8 && x < this.w - 8) this.audience.push({ x, y: y + 24 * u, u, v: (i * 2 + ri + (side > 0 ? 3 : 0)) % 6, ph: i * 0.9 + ri })
      }
    })
  }
  private drawAudience(g: CanvasRenderingContext2D) {
    this.buildAudience()
    const stand = this.ovation > 0.5
    for (const p of this.audience) {
      const spr = this.audSprites[stand ? 1 : 0][p.v]
      const bounce = stand && !this.rm ? Math.abs(Math.sin(this.clock * 5 + p.ph)) * 4 * p.u : 0
      const k = p.u / (this.audSprites[0][0].width / 40 / (this.dpr * 0 + 1)) // sprite px per unit
      void k
      const sc = this.audSprites[0][0].width / 40
      const dw = spr.width / sc * p.u, dh = spr.height / sc * p.u
      g.drawImage(spr, p.x - dw / 2, p.y - dh / 2 - bounce, dw, dh)
    }
  }

  // ---- colour wheel (cached) ----
  private drawWheel(g: CanvasRenderingContext2D) {
    const { cx, cy, R } = this.wheel()
    const key = `${R}|${this.dpr}`
    if (key !== this.wheelKey || !this.wheelC) {
      const c = document.createElement('canvas'); const S = Math.ceil(R * 2 + 8)
      c.width = Math.ceil(S * this.dpr); c.height = c.width
      const w = c.getContext('2d')!; w.scale(this.dpr, this.dpr); w.translate(S / 2, S / 2)
      for (let p = 0; p < 12; p++) {
        const a0 = (p - 0.5) * (TAU / 12) - Math.PI / 2, a1 = (p + 0.5) * (TAU / 12) - Math.PI / 2
        const hue = hueOfPos(p)
        for (const major of [true, false]) {
          const r0 = major ? R * 0.6 : R * 0.28, r1 = major ? R : R * 0.58
          w.beginPath(); w.arc(0, 0, r1, a0, a1); w.arc(0, 0, r0, a1, a0, true); w.closePath()
          w.fillStyle = major ? `hsl(${hue} 78% 56%)` : `hsl(${hue} 44% 34%)`; w.fill(); w.strokeStyle = 'rgba(20,10,40,.55)'; w.lineWidth = 1; w.stroke()
          const am = (a0 + a1) / 2, rm2 = (r0 + r1) / 2
          w.fillStyle = major ? '#1d1030' : '#fff'; w.font = `800 ${Math.round(R * (major ? 0.15 : 0.11))}px system-ui, sans-serif`; w.textAlign = 'center'; w.textBaseline = 'middle'
          w.fillText(WHEEL_LABEL(p) + (major ? '' : 'm'), Math.cos(am) * rm2, Math.sin(am) * rm2)
        }
      }
      this.wheelC = c; this.wheelKey = key
    }
    const S = this.wheelC.width / this.dpr
    g.drawImage(this.wheelC, cx - S / 2, cy - S / 2, S, S)
    // highlight the chosen wedge and its two neighbours on the circle of fifths
    const pos = fifthPos(this.pal.root)
    const major = !(this.pal.q === 'minor' || this.pal.q === 'm7' || this.pal.q === 'dim')
    const r0 = major ? R * 0.6 : R * 0.28, r1 = major ? R : R * 0.58
    const pulse = this.rm ? 0 : Math.max(0, 1 - (this.clock - this.wheelPulse) / 0.6)
    for (const d of [-1, 0, 1]) {
      const p = (pos + d + 12) % 12
      const a0 = (p - 0.5) * (TAU / 12) - Math.PI / 2, a1 = (p + 0.5) * (TAU / 12) - Math.PI / 2
      g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath()
      g.lineWidth = d === 0 ? 3.5 + pulse * 2 : 2; g.strokeStyle = d === 0 ? '#ffffff' : 'rgba(255,255,255,.65)'; g.stroke()
    }
    g.fillStyle = 'rgba(20,10,40,.75)'; g.beginPath(); g.arc(cx, cy, R * 0.26, 0, TAU); g.fill()
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(R * 0.14)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(palName(this.pal).replace(' major', '').replace(' minor', 'm'), cx, cy)
    g.textBaseline = 'alphabetic'
  }

  // ---- keyboard zone labels, aligned to the real keys ----
  private drawZones(g: CanvasRenderingContext2D) {
    const bh = this.bandH(), y = this.h - bh
    for (let z = 0; z < 5; z++) {
      const zn = this.zones[z]
      if (!isFinite(zn.x0)) continue
      const hit = clamp(1 - (this.clock - this.zoneHitT[z]) / 0.45, 0, 1)
      g.fillStyle = ZONE_COL[z]; g.globalAlpha = 0.8 + hit * 0.2
      g.beginPath(); g.roundRect(zn.x0 + 2, y, zn.x1 - zn.x0 - 4, bh - 3, 8); g.fill(); g.globalAlpha = 1
      if (hit > 0) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke() }
      g.fillStyle = '#20102e'; g.font = `800 ${Math.max(12, Math.round(bh * 0.5))}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      const cat = CATS[z]
      g.fillText(`${CAT_INFO[cat].icon} ${CAT_INFO[cat].label}`, (zn.x0 + zn.x1) / 2, y + (bh - 3) / 2 + 1)
    }
    g.textBaseline = 'alphabetic'
  }
}
