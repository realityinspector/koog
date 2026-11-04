// Dancer mode (request #19): an original little guy on a stage, puppeteered by the Vibes mood.
// His face IS the Vibes face (FaceAnimator), his dance style comes from the mood (happy = bouncy, sad = slow sway,
// epic = big moves, tense = jittery, calm = gentle, groovy = disco, goofy = wiggly, spooky = creepy tiptoe),
// each note or chord triggers a move, how fast you play sets his tempo, and a cadence makes him bow.
// The body is a tiny rig: hips, torso, head, 2-bone arms (joint angles) and 2-bone legs (solved with IK so the feet stay
// planted). Poses are blended: a looping "groove" per style, cross-faded when the mood changes, plus short "moves" on top.
// He travels around the stage (kid request: "he has to move around the area"): the pitch pulls him (low notes = stage
// left, high notes = stage right, like the keyboard), a running scale walks him that way, chords and BOOM launch a
// travelling move (leap, slide, knee slide, cartwheel). Feet step for real while he walks (they only slide on slide moves).
// There is a little depth too: further back = smaller and higher. He drifts back to the middle when nothing plays.
// Named moves (moonwalk, grapevine, robot, ...) are picked by mood, register, tempo, loudness and chord vs note, and the
// same one never plays twice in a row. His head x is published as --dancer-x (and data-dancer-side) so the mentor's
// pills and captions can hop to the other side of the stage, clear of his face.
// Photosensitivity: nothing flashes; the wall hue eases over seconds and floor tiles glow softly in one small spot.
// Reduced motion: half-size moves and travel, slower walking, no spins or cartwheels, no shaking, small jumps.
import type { Scene, SceneFactory, SceneReact } from '../visualizer/scenes'
import { MOODS, useVibes, type MoodId } from '../../music/vibes'
import { FaceAnimator } from './face'
import { useDancerName } from './dancerName'

const TAU = Math.PI * 2
const PI = Math.PI

type PK = 'x' | 'y' | 'lean' | 'tilt' | 'nod' | 'bow' | 'la1' | 'la2' | 'ra1' | 'ra2' | 'lfx' | 'lfy' | 'rfx' | 'rfy' | 'knee'
/** x/y: hip offset (body units, y up), lean/tilt: torso/head roll, nod: head down, bow 0..1,
 *  a1: upper arm angle from hanging down (outward +), a2: elbow bend (outward +, inward -), f: foot out / lift, knee: 1 out .. -1 in */
type Pose = Record<PK, number>
const KEYS: PK[] = ['x', 'y', 'lean', 'tilt', 'nod', 'bow', 'la1', 'la2', 'ra1', 'ra2', 'lfx', 'lfy', 'rfx', 'rfy', 'knee']
const REST: Pose = { x: 0, y: 0, lean: 0, tilt: 0, nod: 0, bow: 0, la1: 0.25, la2: 0.2, ra1: 0.25, ra2: 0.2, lfx: 0, lfy: 0, rfx: 0, rfy: 0, knee: 1 }

type Kind = 'bouncy' | 'sway' | 'epic' | 'jitter' | 'gentle' | 'groovy' | 'goofy' | 'spooky'
const MOOD_KIND: Record<MoodId, Kind> = {
  happy: 'bouncy', joyful: 'bouncy', excited: 'bouncy', surprised: 'jitter',
  triumphant: 'epic', epic: 'epic', angry: 'epic',
  sad: 'sway', bittersweet: 'sway', tender: 'sway', dreamy: 'sway',
  tense: 'jitter', spooky: 'spooky', mysterious: 'spooky',
  calm: 'gentle', content: 'gentle', wondering: 'gentle',
  cool: 'groovy', groovy: 'groovy', sassy: 'groovy', goofy: 'goofy',
}
const WORD: Record<Kind, string> = { bouncy: 'bouncy dancing', sway: 'slow swaying', epic: 'BIG moves', jitter: 'jittery dancing', gentle: 'gentle dancing', groovy: 'disco moves', goofy: 'wiggly dancing', spooky: 'creepy tiptoes' }
const SPEED: Record<Kind, number> = { bouncy: 1, sway: 0.5, epic: 1, jitter: 1.15, gentle: 0.6, groovy: 1, goofy: 1, spooky: 0.55 }
/** how far back on the stage each style likes to dance (0 = front edge, 1 = back wall) */
const DEPTH: Record<Kind, number> = { bouncy: 0.2, sway: 0.5, epic: 0.05, jitter: 0.3, gentle: 0.4, groovy: 0.25, goofy: 0.2, spooky: 0.55 }
const CHEER: Record<Kind, string[]> = {
  bouncy: ['Woo!', 'Yay!', 'Hop!'], sway: ['Aww…', 'Sigh…'], epic: ['YEAH!', 'POWER!'], jitter: ['Eek!', 'Yikes!'],
  gentle: ['Ahh…', 'Nice…'], groovy: ['Groovy!', 'Oh yeah!'], goofy: ['Wheee!', 'Boing!'], spooky: ['Ooo…', 'Boo!'],
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const sm = (x: number) => { const t = x <= 0 ? 0 : x >= 1 ? 1 : x; return t * t * (3 - 2 * t) }
const pos = (v: number) => (v > 0 ? v : 0)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

type Groove = (p: Pose, ph: number, t: number, a: number, shake: number) => void
const GROOVES: Record<Kind, Groove> = {
  bouncy(p, ph, _t, a) {
    const s2 = Math.sin(ph * PI), dip = 0.5 + 0.5 * Math.cos(ph * TAU)
    p.y = -0.15 - 0.8 * dip * a; p.x = 0.3 * s2 * a; p.lean = -0.06 * s2 * a; p.tilt = 0.1 * s2 * a; p.nod = 0.25 * dip * a
    p.la1 = 0.55 + 0.45 * s2 * a; p.la2 = -1.45 - 0.25 * dip * a
    p.ra1 = 0.55 - 0.45 * s2 * a; p.ra2 = -1.45 - 0.25 * dip * a
    p.lfy = 0.75 * pos(s2) ** 2 * a; p.rfy = 0.75 * pos(-s2) ** 2 * a; p.lfx = 0.05; p.rfx = 0.05
  },
  sway(p, ph, _t, a) {
    const s2 = Math.sin(ph * PI), c2 = Math.sin(ph * PI + 0.7), dip = 0.5 + 0.5 * Math.cos(ph * TAU)
    p.y = -0.3 - 0.2 * dip * a; p.x = 0.6 * s2 * a; p.lean = -0.1 * s2 * a; p.tilt = 0.2 * c2 * a; p.nod = 0.55
    p.la1 = 0.12 + 0.2 * c2 * a; p.la2 = 0.15; p.ra1 = 0.12 - 0.2 * c2 * a; p.ra2 = 0.15
    p.lfy = 0.15 * pos(s2) * a; p.rfy = 0.15 * pos(-s2) * a; p.lfx = -0.05; p.rfx = -0.05
  },
  epic(p, ph, _t, a) {
    const s2 = Math.sin(ph * PI), dip = 0.5 + 0.5 * Math.cos(ph * TAU), up = pos(s2) * a, dn = pos(-s2) * a
    p.y = -0.35 - 0.45 * dip * a; p.x = 0.15 * s2 * a; p.nod = 0.5 * dip * a - 0.1
    // strongman flex, then a fist punched up, alternating sides
    p.la1 = lerp(1.45, 2.85, up); p.la2 = lerp(1.5, 0.05, up)
    p.ra1 = lerp(1.45, 2.85, dn); p.ra2 = lerp(1.5, 0.05, dn)
    p.lfx = 0.45; p.rfx = 0.45; p.lfy = 0.2 * up * up; p.rfy = 0.2 * dn * dn
  },
  jitter(p, ph, t, a, k) {
    const dip = 0.5 + 0.5 * Math.cos(ph * TAU), s2 = Math.sin(ph * PI), sh = k * Math.sin(t * 0.047), sh2 = k * Math.sin(t * 0.061 + 1)
    p.y = -0.3 - 0.2 * dip * a; p.x = 0.06 * sh; p.lean = 0.03 * sh2; p.tilt = 0.07 * sh2; p.nod = -0.15
    // hands clutched in front, knees knocking
    p.la1 = 0.35 + 0.06 * sh; p.la2 = -2.0 + 0.12 * sh2; p.ra1 = 0.35 - 0.06 * sh2; p.ra2 = -2.0 - 0.12 * sh
    p.lfx = -0.2 + 0.12 * sh; p.rfx = -0.2 - 0.12 * sh; p.knee = -0.7
    p.lfy = 0.25 * pos(s2) * a; p.rfy = 0.25 * pos(-s2) * a
  },
  gentle(p, ph, _t, a) {
    const s2 = Math.sin(ph * PI), c2 = Math.sin(ph * PI + 0.8), dip = 0.5 + 0.5 * Math.cos(ph * TAU)
    p.y = -0.12 - 0.3 * dip * a; p.x = 0.35 * s2 * a; p.lean = -0.05 * s2 * a; p.tilt = 0.1 * c2 * a; p.nod = 0.1
    p.la1 = 0.32 + 0.22 * c2 * a; p.la2 = 0.4 + 0.15 * dip * a; p.ra1 = 0.32 - 0.22 * c2 * a; p.ra2 = 0.4 + 0.15 * dip * a
    p.lfy = 0.3 * pos(s2) ** 2 * a; p.rfy = 0.3 * pos(-s2) ** 2 * a
  },
  groovy(p, ph, _t, a) {
    const hip = Math.sin(ph * TAU), s2 = Math.sin(ph * PI), dip = 0.5 + 0.5 * Math.cos(ph * TAU)
    p.y = -0.35 - 0.45 * dip * a; p.x = 0.45 * hip * a; p.lean = -0.12 * hip * a; p.tilt = 0.12 * s2 * a; p.nod = 0.25 * dip * a
    const m = 0.5 + 0.5 * s2 * a // disco: one hand points up, the other goes to the hip, then swap
    p.ra1 = lerp(0.8, 2.6, m); p.ra2 = lerp(-1.9, 0, m)
    p.la1 = lerp(2.6, 0.8, m); p.la2 = lerp(0, -1.9, m)
    p.lfx = 0.15; p.rfx = 0.15; p.lfy = 0.35 * pos(-hip) * a; p.rfy = 0.35 * pos(hip) * a
  },
  goofy(p, ph, _t, a) {
    const b = ph * TAU, s2 = Math.sin(ph * PI), dip = 0.5 + 0.5 * Math.cos(b)
    p.y = -0.2 - 0.9 * dip * a; p.x = 0.35 * s2 * a; p.lean = 0.12 * Math.sin(b + 1) * a; p.tilt = 0.22 * Math.sin(b * 0.5 + 0.4) * a; p.nod = 0.2 * dip
    p.la1 = 1.3 + 0.9 * Math.sin(b) * a; p.la2 = 1.0 * Math.sin(b + 1.4) * a
    p.ra1 = 1.3 + 0.9 * Math.sin(b + PI) * a; p.ra2 = 1.0 * Math.sin(b + PI + 1.4) * a
    p.lfx = 0.25 * Math.sin(b) * a; p.rfx = 0.25 * Math.sin(b + PI) * a
    p.lfy = 0.8 * pos(s2) ** 2 * a; p.rfy = 0.8 * pos(-s2) ** 2 * a
    p.knee = Math.cos(b) // chicken knees flap in and out
  },
  spooky(p, ph, t, a, k) {
    const s2 = Math.sin(ph * PI), dip = 0.5 + 0.5 * Math.cos(ph * TAU), wig = 0.18 * Math.sin(t * 0.004) * (0.4 + 0.6 * k)
    p.y = -0.3 - 0.15 * dip * a; p.x = 0.45 * s2 * a; p.lean = -0.08 * s2 * a; p.tilt = 0.15 * s2 * a; p.nod = 0.25
    p.la1 = 1.9 + 0.15 * s2 * a; p.la2 = -1.35 + wig; p.ra1 = 1.9 - 0.15 * s2 * a; p.ra2 = -1.35 - wig
    p.lfy = 0.4 * pos(s2) * a; p.rfy = 0.4 * pos(-s2) * a; p.lfx = -0.05; p.rfx = -0.05
  },
}

interface Move { t0: number; dur: number; att: number; rel: number; note: number; off: number; mask: PK[]; f: (u: number, q: Pose) => void }
interface Glyph { x: number; y: number; t0: number; hue: number; ch: string; sway: number }
interface Puff { x: number; y: number; t0: number }
interface Step { from: number; to: number; t0: number; dur: number; lift: number }
type Ev = 'run' | 'chord' | 'flav' | 'boom'
type Reg = 'high' | 'mid' | 'low'
/** a named move: which styles it suits, which musical events can start it, and the register it likes */
interface Def { kinds: Kind[]; ev: Ev[]; reg?: Reg[]; tempo?: 'fast' | 'slow'; big?: boolean; go: (dir: number, v: number) => boolean }

const arm = (s: number): [PK, PK] => (s < 0 ? ['la1', 'la2'] : ['ra1', 'ra2'])
const foot = (s: number): [PK, PK] => (s < 0 ? ['lfx', 'lfy'] : ['rfx', 'rfy'])
const ARMS: PK[] = ['la1', 'la2', 'ra1', 'ra2']
const FEET: PK[] = ['lfx', 'lfy', 'rfx', 'rfy']

export const createDancer: SceneFactory = (reduced): Scene => {
  let w = 800, h = 500, U = 25, floorTop = 340, floorY = 400
  const face = new FaceAnimator(reduced)
  const calm = reduced ? 0.55 : 1
  const shakeK = reduced ? 0 : 1
  let lastNow = 0
  let kind: Kind = 'gentle', prevKind: Kind = 'gentle', mixT0 = -1e6, shownMood: MoodId = 'calm'
  let ph = 0, period = 1000, nudge = 0, lastOn = -1e6, energy = 0, lastVel = 0.6
  let moves: Move[] = []
  let lastMoveT = -1e6, stepSide = 1
  let jumpT0 = -1e6, jumpDur = 600, jumpH = 0
  let spinT0 = -1e6, lastSpin = -1e6
  const spinDur = 800
  let bubble: { txt: string; t0: number } | null = null
  let lastBubble = -1e6
  let wallHue = MOODS.calm.hue, shirtHue = (MOODS.calm.hue + 180) % 360
  let pulse = 0, everActive = false
  const held = new Set<number>()
  const glyphs: Glyph[] = []
  const puffs: Puff[] = []
  const tiles = new Map<number, { g: number; hue: number }>()
  const hands: [number, number][] = [[0, 0], [0, 0]]
  const feetScr: [number, number][] = [[0, 0], [0, 0]]
  const cur: Pose = { ...REST }
  const tmpA: Pose = { ...REST }, tmpB: Pose = { ...REST }, tmpQ: Pose = { ...REST }
  let curtains: HTMLCanvasElement | null = null
  const COLS = 12, ROWS = 4
  // ---- where he is on the stage (stage x in body units from the centre, depth 0 front .. 1 back)
  let px = 0, pv = 0, tgtX = 0, maxX = 8
  let depth = DEPTH.gentle, holdD = 0, holdDUntil = -1e6
  let turn = 0, faceDir = 0, faceUntil = -1e6
  let dash: { from: number; to: number; t0: number; dur: number; ease: 'sm' | 'out' | 'lin' } | null = null
  let glideUntil = -1e6
  let cart: { t0: number; dur: number; dir: number } | null = null
  let lastCart = -1e6
  const fa = [0, 0] // where each foot is planted (stage x)
  const fst: (Step | null)[] = [null, null]
  const flift = [0, 0]
  // ---- named moves
  let curName = '', nameT = -1e6, nameUntil = -1e6, lastName = '', lastName2 = '', bigUntil = -1e6, notesSince = 0
  let runDir = 0, runN = 0, prevNote = -1, prevNoteT = -1e6
  let pubT = -1e6, pubSide = ''
  let bowMove: Move | null = null, bowT = -1e6
  let base: DOMMatrix | null = null
  let skCur = 1

  const kf = () => (SPEED[kind] < 0.8 ? 1.5 : 1)
  function add(dur: number, att: number, rel: number, note: number, mask: PK[], f: (u: number, q: Pose) => void, speed = true) {
    const k = speed ? kf() : 1
    moves.push({ t0: lastNow, dur: dur * k, att: att * k, rel: rel * k, note, off: 0, mask, f })
    if (moves.length > 5) moves.shift()
    lastMoveT = lastNow
  }
  function say(txt: string, force = false) {
    if (!force && lastNow - lastBubble < 1800) return
    bubble = { txt, t0: lastNow }; lastBubble = lastNow
  }
  const cheer = () => { const c = CHEER[kind]; say(c[Math.floor(Math.random() * c.length)]) }
  const scrX = () => w / 2 + px * U
  function jump(H: number, dur = 600) {
    if (lastNow - jumpT0 < jumpDur) return
    // under the readouts (top-left) he keeps his jumps low so his face never hides behind them
    const under = scrX() < w * 0.45 ? 0.6 : 1
    jumpT0 = lastNow; jumpDur = dur; jumpH = H * (reduced ? 0.35 : 1) * under
  }
  function spin(arms = true) {
    if (reduced || lastNow - lastSpin < 2200) return false
    spinT0 = lastNow; lastSpin = lastNow
    if (arms) add(spinDur, 120, 250, -1, ARMS, (_u, q) => { q.la1 = 1.45; q.la2 = 0.2; q.ra1 = 1.45; q.ra2 = 0.2 }, false)
    return true
  }
  function armsV(dur = 700, wide = 0.25) {
    add(dur, 120, 300, -1, [...ARMS, 'lfx', 'rfx'], (_u, q) => { q.la1 = 2.6; q.la2 = 0.15; q.ra1 = 2.6; q.ra2 = 0.15; q.lfx = wide; q.rfx = wide })
  }

  // ---- travel helpers
  /** the direction to travel `dist` that stays on stage (turns him around at the curtains) */
  function roomDir(dir: number, dist: number) {
    const d = dir < 0 ? -1 : 1, dd = dist * (reduced ? 0.6 : 1)
    if (Math.abs(px + d * dd) <= maxX) return d
    return Math.abs(px - d * dd) <= maxX || maxX - d * px < maxX + d * px ? -d : d
  }
  function dashTo(d: number, dist: number, D: number, glide: boolean, ease: 'sm' | 'out' | 'lin' = 'sm') {
    // stretch the move (up to 1.8x) when the music is pulling him further that way
    const far = Math.sign(tgtX - px) === d ? clamp(Math.abs(tgtX - px), dist, dist * 1.8) : dist
    const to = clamp(px + d * far * (reduced ? 0.6 : 1), -maxX, maxX)
    dash = { from: px, to, t0: lastNow, dur: D * (reduced ? 1.25 : 1), ease }
    // keep a target the music already pulled further the same way (a long run keeps walking him), else stay where he lands
    if (!(Math.sign(tgtX - px) === d && Math.abs(tgtX - px) > Math.abs(to - px))) tgtX = to
    if (glide) glideUntil = lastNow + D
  }
  const faceHold = (dir: number, D: number) => { faceDir = dir; faceUntil = lastNow + D }
  const goDepth = (d: number, ms = 2600) => { holdD = d; holdDUntil = lastNow + ms }
  /** add a named move (blends from the current pose; f gets k = 0..1 through the move) */
  function mv(name: string, dur: number, mask: PK[], f: (k: number, u: number, q: Pose) => void, att = 150, rel = 300) {
    const D = dur * kf()
    add(dur, att, rel, -1, mask, (u, q) => f(Math.min(1, u / D), u, q))
    curName = name; nameT = lastNow; nameUntil = lastNow + D + 700; bigUntil = lastNow + D * 0.85
    if (name !== lastName) { lastName2 = lastName; lastName = name }
    notesSince = 0
    return D
  }

  // ---- the move book
  const MOVES: Record<string, Def> = {
    moonwalk: { kinds: ['groovy', 'goofy', 'spooky'], ev: ['run', 'flav'], reg: ['low', 'mid'], go(dir) {
      const d = roomDir(dir, 3.2)
      const D = mv('moonwalk', 1500, [...FEET, 'lean', 'nod', 'y', ...ARMS], (_k, u, q) => {
        const s = Math.sin(u * 0.0115)
        q.lfy = 0.5 * pos(s); q.rfy = 0.5 * pos(-s); q.lfx = 0; q.rfx = 0 // heel up, toe slides back
        q.lean = -d * 0.07; q.nod = 0.15; q.y = -0.25
        q.la1 = 0.45 + 0.25 * s; q.la2 = -1.3; q.ra1 = 0.45 - 0.25 * s; q.ra2 = -1.3
      })
      dashTo(d, 3.2, D, true, 'lin'); faceHold(-d, D) // he faces one way and glides the other
      return true
    } },
    grapevine: { kinds: ['bouncy', 'gentle', 'sway', 'groovy'], ev: ['run'], go(dir) {
      const d = roomDir(dir, 3)
      const trail: PK = d > 0 ? 'lfx' : 'rfx'
      const D = mv('grapevine', 1300, ['lfx', 'rfx', 'lean', 'tilt', 'y', ...ARMS], (k, _u, q) => {
        const c = Math.sin(k * PI * 3)
        q[trail] = -0.95 * pos(c) // the back foot crosses behind
        q.lean = d * 0.06; q.tilt = d * 0.08; q.y = -0.3 - 0.2 * Math.abs(c)
        q.la1 = 1.2 + 0.3 * c; q.la2 = 0.4; q.ra1 = 1.2 - 0.3 * c; q.ra2 = 0.4
        if (k > 0.78) { const e = sm((k - 0.78) / 0.15); q.la1 = lerp(q.la1, 1.0, e); q.la2 = lerp(0.4, -1.95, e); q.ra1 = lerp(q.ra1, 1.0, e); q.ra2 = lerp(0.4, -1.95, e) } // clap!
      })
      dashTo(d, 3, D, false); faceHold(0, D)
      return true
    } },
    'running man': { kinds: ['bouncy', 'epic', 'jitter', 'goofy'], ev: ['run', 'flav'], reg: ['low'], tempo: 'fast', go(dir) {
      const d = roomDir(dir, 1.8)
      const D = mv('running man', 1400, [...FEET, 'knee', 'y', ...ARMS, 'nod', 'lean'], (_k, u, q) => {
        const s = Math.sin(u * 0.0125), c = Math.abs(Math.cos(u * 0.0125))
        q.lfy = 1.1 * pos(s) ** 1.5; q.rfy = 1.1 * pos(-s) ** 1.5; q.lfx = 0.05; q.rfx = 0.05; q.knee = 1
        q.y = -0.35 - 0.25 * c
        q.la1 = 0.7 + 0.6 * s; q.la2 = -1.6; q.ra1 = 0.7 - 0.6 * s; q.ra2 = -1.6; q.nod = 0.2; q.lean = d * 0.05
      })
      dashTo(d, 1.8, D, true, 'lin')
      return true
    } },
    robot: { kinds: ['spooky', 'jitter', 'goofy'], ev: ['chord', 'flav'], reg: ['mid', 'low'], go() {
      // stiff, stepped poses: arm out with the forearm up, swap, hands forward, one arm up
      const R = [[1.57, 1.57, 1.57, -1.57, 0.15], [1.57, -1.57, 1.57, 1.57, -0.15], [0.45, -1.9, 0.45, -1.9, 0], [2.95, 0, 0.25, 0, 0.12]]
      mv('robot', 1800, [...ARMS, 'tilt', 'lean', 'x', 'y', 'knee', 'nod'], (_k, u, q) => {
        const step = 300, i = Math.floor(u / step), e = sm((u - i * step) / 80)
        const A = R[(i + 3) % 4], B = R[i % 4]
        q.la1 = lerp(A[0], B[0], e); q.la2 = lerp(A[1], B[1], e); q.ra1 = lerp(A[2], B[2], e); q.ra2 = lerp(A[3], B[3], e)
        q.tilt = lerp(A[4], B[4], e); q.lean = 0; q.x = 0; q.y = -0.2 - 0.12 * (i % 2); q.knee = 0.3; q.nod = 0
      }, 100, 250)
      if (Math.random() < 0.5) say('Beep boop!')
      return true
    } },
    sprinkler: { kinds: ['goofy', 'bouncy'], ev: ['chord', 'flav'], reg: ['high', 'mid'], go(dir) {
      const d = dir < 0 ? -1 : 1
      const [a1, a2] = arm(d), [o1, o2] = arm(-d)
      mv('sprinkler', 1800, [...ARMS, 'x', 'tilt', 'y'], (k, _u, q) => {
        q[o1] = 2.55; q[o2] = -2.25 // hand behind the head
        const c = (k * 2) % 1
        let a: number
        if (c < 0.75) { const t = c / 0.15, i = Math.floor(t); a = 1.0 + 0.26 * (i + sm((t - i) / 0.4)) } // tick, tick, tick...
        else a = lerp(1.0 + 0.26 * 5, 1.0, sm((c - 0.75) / 0.2)) // ...and sweep back
        q[a1] = a; q[a2] = 0.05; q.tilt = d * 0.1; q.x = -d * 0.15; q.y = -0.3
      })
      return true
    } },
    'arm swing': { kinds: ['goofy', 'bouncy', 'groovy'], ev: ['chord', 'flav'], reg: ['mid'], tempo: 'fast', go() {
      mv('arm swing', 1600, [...ARMS, 'x', 'lean', 'y', 'lfy', 'rfy'], (_k, u, q) => {
        const s = Math.sin(u * 0.0118)
        q.la1 = 0.35 + 0.75 * s; q.ra1 = 0.35 - 0.75 * s; q.la2 = 0.1; q.ra2 = 0.1 // both arms swing the same way...
        q.x = 0.45 * s * calm; q.lean = -0.1 * s; q.y = -0.3 - 0.2 * Math.abs(s) // ...hips go the other way
        q.lfy = 0.25 * pos(s); q.rfy = 0.25 * pos(-s)
      })
      return true
    } },
    twirl: { kinds: ['gentle', 'sway', 'groovy'], ev: ['flav', 'chord'], reg: ['high'], tempo: 'slow', go(dir) {
      const d = roomDir(dir, 1.2)
      const [a1, a2] = arm(d), [o1, o2] = arm(-d)
      const D = mv('twirl', 1200, [...ARMS, 'y', 'tilt', 'lfy', 'rfy'], (k, _u, q) => {
        q[a1] = 2.75; q[a2] = 0.8; q[o1] = 1.3; q[o2] = 0.3 // one arm curved over the head
        q.y = 0.2; q.tilt = d * 0.12; q.lfy = 0.15 * Math.sin(k * PI); q.rfy = 0.1 * Math.sin(k * PI)
      }, 250, 350)
      spin(false); dashTo(d, 1.2, D, true)
      return true
    } },
    'knee slide': { kinds: ['epic', 'groovy'], ev: ['chord', 'boom'], big: true, go(dir) {
      const d = roomDir(dir, 3.6)
      const D = mv('knee slide', 1300, [...ARMS, 'y', 'lean', ...FEET, 'knee', 'nod', 'tilt'], (k, _u, q) => {
        const dn = sm(k / 0.2) * (1 - sm((k - 0.8) / 0.2))
        q.y = -1.9 * dn - 0.2; q.lean = -d * 0.28 * dn; q.nod = -0.25 * dn; q.tilt = -d * 0.1 * dn
        q.la1 = lerp(0.6, 2.6, dn); q.ra1 = lerp(0.6, 2.6, dn); q.la2 = 0.15; q.ra2 = 0.15
        q.lfx = 0.55; q.rfx = 0.55; q.lfy = 0; q.rfy = 0; q.knee = 1
      }, 120, 300)
      dashTo(d, 3.6, D, true, 'out'); goDepth(0)
      say('Slide!')
      return true
    } },
    shimmy: { kinds: ['groovy', 'bouncy', 'jitter'], ev: ['flav', 'chord'], reg: ['mid'], tempo: 'fast', go() {
      const f = reduced ? 0.015 : 0.035
      mv('shimmy', 1400, ['lean', 'tilt', ...ARMS, 'y', 'x', 'nod'], (k, u, q) => {
        const s = Math.sin(u * f)
        q.lean = 0.07 * s * calm; q.tilt = -0.06 * s; q.y = -0.55 - 0.25 * Math.sin(k * PI); q.nod = 0.1 // shoulders shake, going down low
        q.la1 = 0.9 + 0.12 * s; q.la2 = 0.7; q.ra1 = 0.9 - 0.12 * s; q.ra2 = 0.7
        q.x = 0.35 * Math.sin(k * TAU) * calm
      })
      return true
    } },
    'hip sway': { kinds: ['sway', 'gentle', 'groovy'], ev: ['flav', 'chord'], reg: ['mid', 'low'], tempo: 'slow', go() {
      mv('hip sway', 2000, ['x', 'lean', 'tilt', ...ARMS, 'y', 'lfy', 'rfy'], (k, _u, q) => {
        const s = Math.sin(k * TAU * 1.5)
        q.x = 0.9 * s * calm; q.lean = -0.14 * s; q.tilt = 0.12 * s; q.y = -0.3
        q.la1 = 1.0 + 0.35 * s; q.la2 = 0.7 - 0.3 * s; q.ra1 = 1.0 - 0.35 * s; q.ra2 = 0.7 + 0.3 * s
        q.lfy = 0.18 * pos(-s); q.rfy = 0.18 * pos(s)
      }, 400, 500)
      goDepth(0.55)
      return true
    } },
    'clap & cheer': { kinds: ['bouncy', 'epic', 'gentle'], ev: ['chord', 'flav'], reg: ['high'], go() {
      // (his head is bigger than his reach, so the claps happen in front of his tummy, then both arms shoot up)
      mv('clap & cheer', 1400, [...ARMS, 'y', 'nod', 'lfy', 'rfy'], (k, _u, q) => {
        const c = k < 0.6 ? pos(Math.sin((k / 0.6) * PI * 3)) : 0 // three claps...
        const up = sm((k - 0.6) / 0.15) // ...then a cheer
        q.la1 = lerp(lerp(0.9, 0.42, c), 2.6, up); q.ra1 = lerp(lerp(0.9, 0.42, c), 2.6, up)
        q.la2 = lerp(lerp(-0.9, -1.95, c), 0.1, up); q.ra2 = lerp(lerp(-0.9, -1.95, c), 0.1, up)
        q.y = -0.3 - 0.2 * c + 0.3 * up; q.nod = 0.15 * c - 0.2 * up; q.lfy = 0.25 * up; q.rfy = 0.25 * up
      })
      return true
    } },
    'disco point': { kinds: ['groovy', 'epic'], ev: ['flav', 'chord'], reg: ['high'], go(dir) {
      const d = dir < 0 ? -1 : 1
      const [a1, a2] = arm(d), [o1, o2] = arm(-d)
      mv('disco point', 1500, [...ARMS, 'x', 'lean', 'tilt', 'y'], (k, _u, q) => {
        const c = 0.5 - 0.5 * Math.cos(k * TAU * 2) // up to the sky, then down across the body, twice
        q[a1] = lerp(2.65, -0.35, c); q[a2] = 0; q[o1] = 0.8; q[o2] = -1.9
        q.x = d * 0.4 * (1 - 2 * c) * calm; q.lean = -d * 0.12 * (1 - 2 * c); q.tilt = d * 0.1; q.y = -0.3 - 0.3 * c
      })
      return true
    } },
    'kick-ball-change': { kinds: ['bouncy', 'gentle', 'goofy'], ev: ['flav'], reg: ['low', 'mid'], go(dir) {
      const d = dir < 0 ? -1 : 1
      const [fx, fy] = foot(d), [, oy] = foot(-d)
      mv('kick-ball-change', 1100, [...FEET, 'y', 'lean', ...ARMS], (k, _u, q) => {
        const kick = Math.sin(Math.min(1, k / 0.4) * PI)
        const ball = k > 0.4 && k < 0.7 ? Math.sin(((k - 0.4) / 0.3) * PI) : 0
        const ch = k > 0.7 ? Math.sin(((k - 0.7) / 0.3) * PI) : 0
        q[fx] = 0.15 + 0.9 * kick; q[fy] = 1.2 * kick; q[oy] = 0.35 * ball
        q.y = -0.2 - 0.3 * ball - 0.35 * ch; q.lean = -d * 0.12 * kick
        q.la1 = 1.0; q.la2 = 0.9; q.ra1 = 1.0; q.ra2 = 0.9
      }, 90, 220)
      return true
    } },
    cartwheel: { kinds: ['epic', 'bouncy'], ev: ['boom', 'chord'], big: true, go(dir, v) {
      if (reduced || lastNow - lastCart < 9000 || v < 0.75) return false
      const d = roomDir(dir, 4.2)
      const D = mv('cartwheel', 1150, [...ARMS, ...FEET, 'y', 'lean', 'tilt', 'nod', 'knee', 'x'], (_k, _u, q) => {
        q.la1 = 2.6; q.ra1 = 2.6; q.la2 = 0; q.ra2 = 0; q.lfx = 1.1; q.rfx = 1.1; q.lfy = 0; q.rfy = 0
        q.y = 0; q.x = 0; q.lean = 0; q.tilt = 0; q.nod = 0; q.knee = 1
      }, 120, 220)
      cart = { t0: lastNow, dur: D, dir: d }; lastCart = lastNow
      dashTo(d, 4.2, D, true, 'lin'); goDepth(0.1)
      say('Wheee!', true)
      return true
    } },
    'heel click': { kinds: ['bouncy', 'epic', 'goofy'], ev: ['flav', 'chord'], reg: ['high'], go(dir, v) {
      if (v < 0.65) return false
      const d = roomDir(dir, 1.4)
      const [a1, a2] = arm(d), [o1, o2] = arm(-d)
      const D = mv('heel click', 900, [...FEET, 'lean', ...ARMS, 'nod'], (k, _u, q) => {
        const air = Math.sin(Math.min(1, k / 0.85) * PI)
        q.lfx = lerp(0.1, -0.85, air); q.rfx = lerp(0.1, -0.85, air); q.lfy = 0.35 * air; q.rfy = 0.35 * air // heels together in the air
        q.lean = d * 0.18 * air; q.nod = -0.15 * air
        q[a1] = lerp(0.6, 2.8, air); q[a2] = 0.1; q[o1] = lerp(0.6, 1.5, air); q[o2] = 0.3
      }, 90, 200)
      jump(1.5, D * 0.9); dashTo(d, 1.4, D, true)
      return true
    } },
    'arm wave': { kinds: ['groovy', 'gentle', 'sway', 'spooky'], ev: ['flav', 'chord'], reg: ['high', 'mid'], tempo: 'slow', go(dir) {
      const d = dir < 0 ? -1 : 1
      const [s1, s2] = arm(-d), [t1, t2] = arm(d) // the wave starts in one hand and rolls out of the other
      mv('arm wave', 1600, [...ARMS, 'tilt', 'y'], (k, _u, q) => {
        const wv = k * 6 - 0.5
        const b = (i: number) => { const z = wv - i; return z > -1 && z < 1 ? 0.5 + 0.5 * Math.cos(z * PI) : 0 }
        q[s1] = 1.5 + 0.35 * b(1); q[s2] = 0.85 * b(0)
        q.tilt = d * 0.22 * (b(2) - 0.5 * b(1)); q.y = -0.2 + 0.2 * b(2)
        q[t1] = 1.5 + 0.35 * b(3); q[t2] = 0.85 * b(4)
      }, 250, 350)
      return true
    } },
    leap: { kinds: ['epic', 'bouncy', 'goofy'], ev: ['chord', 'boom'], big: true, go(dir) {
      const d = roomDir(dir, 3.6)
      const [fx, fy] = foot(d), [ox, oy] = foot(-d)
      const D = mv('leap', 820, [...ARMS, ...FEET, 'lean', 'nod'], (k, _u, q) => {
        const air = Math.sin(k * PI)
        q[fx] = 0.9 * air; q[ox] = 0.9 * air; q[fy] = 0.2 * air; q[oy] = 0.7 * air // split legs
        q.la1 = lerp(0.6, 2.5, air); q.ra1 = lerp(0.6, 2.5, air); q.la2 = 0.1; q.ra2 = 0.1
        q.lean = d * 0.15 * air; q.nod = -0.2 * air
      }, 80, 200)
      jump(1.7, D); dashTo(d, 3.6, D, true); goDepth(0)
      return true
    } },
    slide: { kinds: ['sway', 'gentle', 'groovy', 'spooky'], ev: ['chord', 'run', 'boom'], go(dir) {
      const d = roomDir(dir, 3)
      const [fx] = foot(d)
      const D = mv('slide', 1100, [...ARMS, 'lean', 'tilt', 'lfx', 'rfx', 'y'], (k, _u, q) => {
        const e = Math.sin(k * PI)
        q.la1 = lerp(0.4, 1.45, e); q.ra1 = lerp(0.4, 1.45, e); q.la2 = 0.15; q.ra2 = 0.15
        q.lean = d * 0.14 * e; q.tilt = -d * 0.1 * e; q[fx] = 0.6 * e; q.y = -0.45 * e
      })
      dashTo(d, 3, D, true, 'out')
      return true
    } },
    skip: { kinds: ['bouncy', 'goofy', 'gentle'], ev: ['run'], go(dir) {
      const d = roomDir(dir, 3.2)
      const D = mv('skip', 1300, ['y', 'lfy', 'rfy', ...ARMS, 'nod', 'lean'], (k, _u, q) => {
        const s = Math.sin(k * PI * 4)
        q.y = 0.3 * Math.abs(s) - 0.2; q.lfy = 0.8 * pos(s); q.rfy = 0.8 * pos(-s)
        q.la1 = 0.7 + 0.9 * pos(-s); q.ra1 = 0.7 + 0.9 * pos(s); q.la2 = 0.3; q.ra2 = 0.3; q.lean = d * 0.06; q.nod = -0.1
      })
      dashTo(d, 3.2, D, false)
      return true
    } },
    creep: { kinds: ['spooky', 'jitter'], ev: ['run', 'chord'], go(dir) {
      const d = roomDir(dir, 2.6)
      const D = mv('creep', 1700, ['y', 'lfy', 'rfy', ...ARMS, 'nod', 'lean', 'knee'], (k, _u, q) => {
        const s = Math.sin(k * PI * 3)
        q.lfy = 0.85 * pos(s) ** 1.3; q.rfy = 0.85 * pos(-s) ** 1.3; q.y = 0.1 - 0.25 * Math.abs(Math.cos(k * PI * 3)); q.knee = 1 // big tiptoe steps
        q.la1 = 1.95; q.la2 = -1.4 + 0.2 * s; q.ra1 = 1.95; q.ra2 = -1.4 - 0.2 * s; q.nod = 0.45; q.lean = d * 0.1
      })
      dashTo(d, 2.6, D, false); goDepth(0.6)
      return true
    } },
  }
  const MOVE_LIST = Object.entries(MOVES)

  /** pick a move for this musical moment: suits the style, register, tempo and loudness, never the same one twice in a row */
  function choose(ev: Ev, dir: number, v: number, reg?: Reg) {
    const fast = period < 520, slow = period > 800
    const fits = (strict: boolean) => MOVE_LIST.filter(([n, d]) => d.ev.includes(ev) && (!strict || d.kinds.includes(kind)) &&
      (!reg || !d.reg || d.reg.includes(reg)) && n !== lastName && (n !== lastName2 || !strict))
    let c = fits(true)
    if (c.length < 2) c = c.concat(fits(false).filter((x) => !c.includes(x)).slice(0, 3 - c.length))
    for (let tries = 0; tries < 4 && c.length; tries++) {
      const wt = c.map(([, d]) => 1 + (d.kinds.includes(kind) ? 2 : 0) + ((d.tempo === 'fast' && fast) || (d.tempo === 'slow' && slow) ? 1.5 : 0) + (d.big && v > 0.75 ? 2 : 0))
      let r = Math.random() * wt.reduce((a, b) => a + b, 0), i = 0
      while (i < c.length - 1 && r > wt[i]) { r -= wt[i]; i++ }
      if (c[i][1].go(dir, v)) return true
      c.splice(i, 1)
    }
    return false
  }
  /** big travelling moves head for the open side of the stage */
  const openDir = () => (px > maxX * 0.3 ? -1 : px < -maxX * 0.3 ? 1 : Math.random() < 0.5 ? -1 : 1)

  // ---- one note -> one move, chosen by the dance style
  function noteMove(note: number, side: number, v: number, spicy: boolean) {
    const [a1, a2] = arm(side)
    const [fx, fy] = foot(side)
    const amp = (0.6 + v * 0.6) * calm
    if (spicy) {
      // an out-of-key note knocks him off balance (arms out like a tightrope walker)
      add(800, 100, 300, -1, ['lean', 'x', ...ARMS], (u, q) => {
        const d = 1 - Math.min(1, u / 800)
        q.lean = side * 0.22 * Math.sin(u * 0.012) * d * calm; q.x += side * 0.2 * d
        q.la1 = 1.5; q.ra1 = 1.5; q.la2 = 0.2 + 0.3 * Math.sin(u * 0.02); q.ra2 = 0.2 - 0.3 * Math.sin(u * 0.02)
      })
      if (Math.random() < 0.5) say('Wobble!')
      return
    }
    if (note >= 72) {
      switch (kind) {
        case 'epic': add(450, 90, 200, note, [a1, a2, 'y'], (_u, q) => { q[a1] = 2.95; q[a2] = 0.12; q.y -= 0.3 }); if (v > 0.75) jump(1.0, 520); break
        case 'sway': add(1100, 380, 450, note, [a1, a2, 'tilt', 'lean'], (_u, q) => { q[a1] = 1.85; q[a2] = 0.55; q.tilt = side * 0.15; q.lean = side * 0.08 }); break
        case 'jitter': add(650, 120, 220, note, [a1, a2], (u, q) => { q[a1] = 1.0; q[a2] = 1.9 + 0.35 * Math.sin(u * 0.045) * shakeK }); break
        case 'gentle': add(1000, 350, 400, note, [a1, a2], (_u, q) => { q[a1] = 1.35; q[a2] = 0.35 }); break
        case 'groovy': {
          const [o1, o2] = arm(-side)
          add(650, 110, 260, note, [a1, a2, o1, o2, 'x', 'lean'], (_u, q) => { q[a1] = 2.6; q[a2] = 0; q[o1] = 0.8; q[o2] = -1.9; q.x += side * 0.35; q.lean = -side * 0.12 })
          break
        }
        case 'goofy': add(800, 120, 260, note, [a1, a2], (u, q) => { q[a1] = 2.2 + 0.5 * Math.sin(u * 0.02); q[a2] = 1.2 * Math.sin(u * 0.026 + 1) }); break
        case 'spooky': add(800, 200, 300, note, [a1, a2], (u, q) => { q[a1] = 2.0; q[a2] = -1.3 + 0.25 * Math.sin(u * 0.03) * (0.3 + 0.7 * shakeK) }); break
        default: add(900, 160, 260, note, [a1, a2], (u, q) => { q[a1] = 2.55; q[a2] = 0.35 + 0.5 * Math.sin(u * 0.016) }) // a wave
      }
      return
    }
    if (note <= 55) {
      if (kind === 'sway' || kind === 'gentle') {
        add(700, 200, 300, note, ['y', 'nod'], (u, q) => { q.y -= 0.45 * Math.sin(Math.min(1, u / 700) * PI) * amp; q.nod += 0.15 })
        return
      }
      // a stomp: lift the foot, slam it down, little dust puff
      add(460, 60, 140, note, [fx, fy, 'y'], (u, q) => {
        const k = u / 460
        q[fy] = (k < 0.45 ? Math.sin((k / 0.45) * PI * 0.5) : Math.max(0, 1 - (k - 0.45) / 0.1)) * 1.0 * amp
        q[fx] = 0.15
        q.y += k > 0.45 ? -0.5 * Math.sin(Math.min(1, (k - 0.45) / 0.55) * PI) * amp : 0.1
      })
      const [sx, sy] = feetScr[side < 0 ? 0 : 1]
      puffs.push({ x: sx || w / 2 + side * 0.95 * U, y: sy || floorY, t0: lastNow + 460 * 0.47 })
      if (puffs.length > 8) puffs.shift()
      return
    }
    // middle notes: a side step, alternating feet
    stepSide = -stepSide
    const s = stepSide
    const [sx, sy] = foot(s)
    if (kind === 'jitter') { add(320, 60, 140, note, [sx, 'y'], (_u, q) => { q[sx] = -0.35; q.y -= 0.25 }); return }
    add(420, 80, 220, note, [sx, sy, 'x', 'lean'], (u, q) => {
      const k = u / (420 * (SPEED[kind] < 0.8 ? 1.5 : 1))
      q[sx] = 0.55 * amp * sm(k * 2); q[sy] = 0.55 * amp * Math.sin(Math.min(1, k * 1.6) * PI)
      q.x += s * 0.3 * amp; q.lean += -s * 0.05
    })
  }

  function chordMove(v: number) {
    // a chord that has the home note in it also ends a phrase: the chord is the bigger moment, so it takes over from the bow
    if (lastNow - bowT < 350 && bowMove) { moves = moves.filter((m) => m !== bowMove); bowMove = null; bigUntil = -1e6; curName = '' }
    goDepth(Math.max(0, DEPTH[kind] - 0.25), 2000) // chords bring him forward
    if (lastNow >= bigUntil - 150 && Math.random() < 0.8 && choose('chord', openDir(), v)) { cheer(); return }
    switch (kind) {
      case 'bouncy': if (!spin()) { armsV(); jump(0.9, 560) } break
      case 'epic': armsV(750, 0.55); jump(1.8 * (0.6 + v * 0.5), 640); break
      case 'sway': add(1500, 450, 500, -1, [...ARMS, 'nod'], (_u, q) => { q.la1 = 1.35; q.ra1 = 1.35; q.la2 = 0.75; q.ra2 = 0.75; q.nod = -0.1 }); break
      case 'jitter': add(900, 100, 300, -1, [...ARMS, 'x'], (u, q) => { q.la1 = -0.25; q.ra1 = -0.25; q.la2 = -1.5; q.ra2 = -1.5; q.x += 0.08 * Math.sin(u * 0.06) * shakeK }); break
      case 'gentle': add(1300, 400, 450, -1, ARMS, (_u, q) => { q.la1 = 1.25; q.ra1 = 1.25; q.la2 = 0.4; q.ra2 = 0.4 }); break
      case 'groovy': if (Math.random() < 0.5 && spin()) break; noteMove(80, stepSide, v, false); break
      case 'goofy': add(800, 100, 300, -1, ARMS, (u, q) => { q.la1 = 2.2 + 0.6 * Math.sin(u * 0.02); q.ra1 = 2.2 + 0.6 * Math.sin(u * 0.02 + 2); q.la2 = Math.sin(u * 0.03); q.ra2 = Math.sin(u * 0.03 + 2) }); jump(1.0, 560); break
      case 'spooky': add(1000, 250, 350, -1, [...ARMS, 'y'], (u, q) => { q.la1 = 2.0; q.ra1 = 2.0; q.la2 = -1.3 + 0.2 * Math.sin(u * 0.03) * shakeK; q.ra2 = -1.3 - 0.2 * Math.sin(u * 0.03) * shakeK; q.y -= 0.5 }); break
    }
    cheer()
  }

  // ---- the rig: solve joints, then paint. Drawn in his own frame (centre stage, front row); the caller places it.
  const map = (x: number, y: number): [number, number] => {
    if (!base) return [x, y]
    const m = base.multiply(ctxRef!.getTransform()), p = m.transformPoint(new DOMPoint(x, y))
    return [p.x, p.y]
  }
  let ctxRef: CanvasRenderingContext2D | null = null
  function drawGuy(ctx: CanvasRenderingContext2D, now: number, p: Pose, jh: number, sx: number, rot: number) {
    const u = U, cx = w / 2
    const hipX = cx + p.x * u, hipY = floorY - (4.45 + p.y + jh) * u
    const f = face.cur
    const skin = `hsl(${f.fh},${f.fs}%,${f.fl}%)`
    const ink = '#241634'
    const shirt = `hsl(${shirtHue},72%,56%)`, shirtD = `hsl(${shirtHue},60%,40%)`
    const pants = 'hsl(228,36%,30%)'
    const tn = clamp(turn, -1, 1), ta = Math.abs(tn)
    ctx.save()
    if (rot) { ctx.translate(hipX, hipY); ctx.rotate(rot); ctx.translate(-hipX, -hipY) }
    ctx.translate(hipX, 0); ctx.scale(sx, 1); ctx.translate(-hipX, 0)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const cl = Math.cos(p.lean * 0.5), sl = Math.sin(p.lean * 0.5)
    const L1 = 2.3 * u, L2 = 2.25 * u
    // legs (2-bone IK: the hip is placed by the dance, each foot is planted where it last stepped)
    for (const s of [-1, 1]) {
      const i = s < 0 ? 0 : 1
      const hx = hipX + s * 0.55 * u * cl, hy = hipY + s * 0.55 * u * sl
      const fdx = s < 0 ? p.lfx : p.rfx, lift = (s < 0 ? p.lfy : p.rfy) + flift[i]
      let fx = cx + ((fa[i] - px) * u) / skCur + p.x * u * 0.25 + s * (0.8 + fdx) * u, fy = floorY - (0.3 + lift + jh * 1.25) * u
      let dx = fx - hx, dy = fy - hy
      let d = Math.hypot(dx, dy)
      const reach = (L1 + L2) * 0.999
      if (d > reach) { fx = hx + (dx / d) * reach; fy = hy + (dy / d) * reach; dx = fx - hx; dy = fy - hy; d = reach }
      d = Math.max(d, 0.3 * u)
      const bs = Math.atan2(dy, dx)
      const ca = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))
      const a = Math.acos(ca)
      const out = s < 0 ? bs + a : bs - a, inn = s < 0 ? bs - a : bs + a
      const kk = (p.knee + 1) / 2
      const kx = lerp(hx + Math.cos(inn) * L1, hx + Math.cos(out) * L1, kk), ky = lerp(hy + Math.sin(inn) * L1, hy + Math.sin(out) * L1, kk)
      ctx.strokeStyle = ink; ctx.lineWidth = 1.15 * u
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke()
      ctx.strokeStyle = pants; ctx.lineWidth = 0.92 * u
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke()
      // sneaker: toes point outward when he faces you, both point the way he is heading when he turns
      const shx = fx + (s * 0.3 * (1 - ta) + tn * sx * 0.42) * u, shy = fy + 0.12 * u
      ctx.fillStyle = '#fbf8ff'; ctx.strokeStyle = ink; ctx.lineWidth = 0.13 * u
      ctx.beginPath(); ctx.ellipse(shx, shy, 0.7 * u, 0.38 * u, s * 0.08, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.fillStyle = `hsl(${(shirtHue + 40) % 360},80%,55%)`
      ctx.beginPath(); ctx.ellipse(shx, shy + 0.2 * u, 0.62 * u, 0.12 * u, s * 0.08, 0, TAU); ctx.fill()
      feetScr[sx < 0 ? 1 - i : i] = map(shx, shy + 0.3 * u)
    }
    // torso
    const ux = Math.sin(p.lean), uy = -Math.cos(p.lean) // up
    const rx = Math.cos(p.lean), ry = Math.sin(p.lean) // right
    const tl = 2.9 * u * (1 - 0.3 * p.bow)
    const nx = hipX + ux * tl, ny = hipY + uy * tl
    // shorts / waist
    ctx.fillStyle = pants; ctx.strokeStyle = ink; ctx.lineWidth = 0.13 * u
    ctx.beginPath()
    ctx.moveTo(hipX - rx * 0.95 * u - ux * 0.1 * u, hipY - ry * 0.95 * u - uy * 0.1 * u)
    ctx.lineTo(hipX + rx * 0.95 * u - ux * 0.1 * u, hipY + ry * 0.95 * u - uy * 0.1 * u)
    ctx.lineTo(hipX + rx * 0.85 * u - ux * 0.75 * u, hipY + ry * 0.85 * u - uy * 0.75 * u)
    ctx.lineTo(hipX - rx * 0.85 * u - ux * 0.75 * u, hipY - ry * 0.85 * u - uy * 0.75 * u)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // shirt
    const P = (a: number, b: number): [number, number] => [hipX + rx * a * u + ux * b * u * (tl / (2.9 * u)), hipY + ry * a * u + uy * b * u * (tl / (2.9 * u))]
    const pts = { hl: P(-0.95, 0.35), hr: P(0.95, 0.35), sr: P(1.2, 2.75), sl: P(-1.2, 2.75), top: P(0, 3.05), br: P(1.25, 1.5), bl: P(-1.25, 1.5) }
    ctx.fillStyle = shirt
    ctx.beginPath()
    ctx.moveTo(...pts.hl); ctx.lineTo(...pts.hr)
    ctx.quadraticCurveTo(...pts.br, ...pts.sr)
    ctx.quadraticCurveTo(...pts.top, ...pts.sl)
    ctx.quadraticCurveTo(...pts.bl, ...pts.hl)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // hem stripe + a music note on the chest (slides toward the way he faces)
    ctx.strokeStyle = shirtD; ctx.lineWidth = 0.22 * u
    ctx.beginPath(); ctx.moveTo(...P(-0.9, 0.62)); ctx.lineTo(...P(0.9, 0.62)); ctx.stroke()
    const [mx, my] = P(0.05 + tn * sx * 0.35, 1.7)
    ctx.save(); ctx.translate(mx, my); ctx.rotate(p.lean)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `800 ${Math.round(1.25 * u)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('♪', 0, 0)
    ctx.restore()
    // neck
    const hux = Math.sin(p.lean + p.tilt), huy = -Math.cos(p.lean + p.tilt)
    ctx.strokeStyle = ink; ctx.lineWidth = 0.75 * u
    ctx.beginPath(); ctx.moveTo(nx, ny + 0.2 * u); ctx.lineTo(nx + hux * 0.55 * u, ny + huy * 0.55 * u); ctx.stroke()
    ctx.strokeStyle = skin; ctx.lineWidth = 0.52 * u
    ctx.beginPath(); ctx.moveTo(nx, ny + 0.2 * u); ctx.lineTo(nx + hux * 0.55 * u, ny + huy * 0.55 * u); ctx.stroke()
    // arms (forward kinematics: shoulder angle + elbow bend)
    const dir = (s: number, th: number): [number, number] => {
      const dx = s * Math.sin(th), dy = Math.cos(th)
      return [dx * rx - dy * ux, dx * ry - dy * uy]
    }
    for (const s of [-1, 1]) {
      const a1 = s < 0 ? p.la1 : p.ra1, a2 = s < 0 ? p.la2 : p.ra2
      const shx = nx + rx * s * 1.0 * u - ux * 0.38 * u, shy = ny + ry * s * 1.0 * u - uy * 0.38 * u
      const d1 = dir(s, a1), d2 = dir(s, a1 + a2)
      const ex = shx + d1[0] * 1.75 * u, ey = shy + d1[1] * 1.75 * u
      const hx = ex + d2[0] * 1.6 * u, hy = ey + d2[1] * 1.6 * u
      ctx.strokeStyle = ink; ctx.lineWidth = 0.78 * u
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke()
      ctx.strokeStyle = skin; ctx.lineWidth = 0.54 * u
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke()
      // short sleeve
      const vx = shx + (ex - shx) * 0.55, vy = shy + (ey - shy) * 0.55
      ctx.strokeStyle = ink; ctx.lineWidth = 1.0 * u
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.strokeStyle = shirt; ctx.lineWidth = 0.76 * u
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(vx, vy); ctx.stroke()
      ctx.fillStyle = skin; ctx.strokeStyle = ink; ctx.lineWidth = 0.12 * u
      ctx.beginPath(); ctx.arc(hx, hy, 0.42 * u, 0, TAU); ctx.fill(); ctx.stroke()
      hands[(s < 0) === (sx >= 0) ? 0 : 1] = map(hx, hy)
    }
    // head: the Vibes face, with hair. When he turns, the face slides a little toward where he is going (a 3/4 view).
    const R = 1.5 * u
    const hcx = nx + hux * (0.35 * u + R), hcy = ny + huy * (0.35 * u + R) + p.nod * 0.3 * u + p.bow * 0.9 * u
    ctx.save()
    ctx.translate(hcx, hcy); ctx.rotate(p.lean + p.tilt)
    const hair = 'hsl(24,48%,24%)'
    if (sx >= 0) {
      ctx.save(); ctx.translate(tn * 0.1 * R, 0); ctx.scale(1 - 0.08 * ta, 1)
      face.draw(ctx, 0, 0, R, now, { pulse, bob: 0, shake: kind === 'jitter' && !reduced ? 0.006 : 0 })
      ctx.restore()
      ctx.translate(tn * 0.05 * R, 0)
      ctx.fillStyle = hair; ctx.strokeStyle = ink; ctx.lineWidth = 0.1 * u
      ctx.beginPath()
      ctx.arc(0, 0, R * 1.05, PI + 0.5, -0.5)
      ctx.quadraticCurveTo(R * 0.75, -R * 0.55, R * 0.5, -R * 0.76)
      for (let i = 0; i < 4; i++) {
        const x0 = R * (0.5 - (i + 1) * 0.25)
        ctx.quadraticCurveTo(x0 + R * 0.125, -R * 0.62, x0, -R * 0.78)
      }
      ctx.quadraticCurveTo(-R * 0.75, -R * 0.55, Math.cos(PI + 0.5) * R * 1.05, Math.sin(PI + 0.5) * R * 1.05)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    } else {
      // the back of his head, mid-spin
      ctx.fillStyle = skin; ctx.strokeStyle = ink; ctx.lineWidth = 0.1 * u
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.fillStyle = hair
      ctx.beginPath(); ctx.arc(0, -R * 0.05, R * 1.04, PI * 0.9, PI * 0.1); ctx.quadraticCurveTo(0, R * 0.55, Math.cos(PI * 0.9) * R * 1.04, Math.sin(PI * 0.9) * R * 1.04 - R * 0.05); ctx.fill(); ctx.stroke()
    }
    // cowlick
    ctx.strokeStyle = hair; ctx.lineWidth = 0.22 * u
    ctx.beginPath(); ctx.moveTo(R * 0.05, -R * 1.0); ctx.quadraticCurveTo(R * 0.15, -R * 1.42, R * 0.45, -R * 1.3); ctx.stroke()
    const [hx, hy] = map(0, 0), [tx] = map(R, 0)
    ctx.restore()
    ctx.restore()
    return { hx, hy, R: Math.abs(tx - hx) || R }
  }

  function buildCurtains(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h))
    const g = c.getContext('2d')
    if (!g) return c
    const cw = Math.max(36, w * 0.085)
    for (const side of [0, 1]) {
      const x0 = side ? w - cw : 0
      const gr = g.createLinearGradient(x0, 0, x0 + cw, 0)
      for (let i = 0; i <= 6; i++) {
        const t = i / 6
        gr.addColorStop(t, i % 2 ? 'hsl(345,62%,22%)' : 'hsl(345,64%,36%)')
      }
      g.fillStyle = gr
      g.beginPath()
      if (side) { g.moveTo(w, 0); g.lineTo(x0, 0); g.quadraticCurveTo(x0 + cw * 0.15, h * 0.55, x0 + cw * 0.55, h); g.lineTo(w, h) }
      else { g.moveTo(0, 0); g.lineTo(cw, 0); g.quadraticCurveTo(cw * 0.85, h * 0.55, cw * 0.45, h); g.lineTo(0, h) }
      g.closePath(); g.fill()
    }
    // valance with scallops
    const vh = Math.max(22, h * 0.06)
    const vg = g.createLinearGradient(0, 0, 0, vh)
    vg.addColorStop(0, 'hsl(345,60%,24%)'); vg.addColorStop(1, 'hsl(345,64%,34%)')
    g.fillStyle = vg
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, vh)
    const n = Math.max(6, Math.round(w / 90))
    for (let i = n; i > 0; i--) { const xa = (w * i) / n, xb = (w * (i - 1)) / n; g.quadraticCurveTo((xa + xb) / 2, vh * 1.7, xb, vh) }
    g.closePath(); g.fill()
    g.fillStyle = 'hsl(46,80%,58%)'
    for (let i = 0; i < n; i++) { g.beginPath(); g.arc((w * (i + 0.5)) / n, vh * 1.33, 3, 0, TAU); g.fill() }
    return c
  }

  function tileQuad(ctx: CanvasRenderingContext2D, r: number, c: number) {
    const vy = floorTop - (h - floorTop) * 1.6, vx = w / 2
    const yA = floorTop + (h - floorTop) * Math.pow(r / ROWS, 1.35), yB = floorTop + (h - floorTop) * Math.pow((r + 1) / ROWS, 1.35)
    const xb = (j: number) => w / 2 + (j / COLS - 0.5) * w * 1.6
    const xAt = (j: number, y: number) => vx + (xb(j) - vx) * ((y - vy) / (h - vy))
    ctx.beginPath()
    ctx.moveTo(xAt(c, yA), yA); ctx.lineTo(xAt(c + 1, yA), yA); ctx.lineTo(xAt(c + 1, yB), yB); ctx.lineTo(xAt(c, yB), yB)
    ctx.closePath()
  }
  function colFor(x: number) {
    // which column is under screen-x on the front row
    const xb0 = w / 2 - w * 0.8
    return Math.max(0, Math.min(COLS - 1, Math.floor(((x - xb0) / (w * 1.6)) * COLS)))
  }

  /** move him along the stage: a dash (travelling move) or a soft spring toward where the music pulls him */
  function travel(now: number, dt: number) {
    const ds = Math.max(0.001, dt / 1000)
    if (dash) {
      const q = Math.min(1, (now - dash.t0) / dash.dur)
      const e = dash.ease === 'lin' ? sm(q * 1.15 - 0.075) * 0.3 + q * 0.7 : dash.ease === 'out' ? 1 - (1 - q) ** 2.2 : sm(q)
      const nx = lerp(dash.from, dash.to, e)
      pv = (nx - px) / ds; px = nx
      if (q >= 1) dash = null
    } else {
      if (now - lastOn > 2500) tgtX *= Math.exp(-dt / 4500) // nothing playing: wander back to the middle
      const om = reduced ? 1.6 : 2.8, vmax = reduced ? 2.5 : 7
      pv += (om * om * (tgtX - px) - 2 * om * pv) * ds
      pv = clamp(pv, -vmax, vmax)
      px += pv * ds
    }
    if (px > maxX || px < -maxX) { px = clamp(px, -maxX, maxX); pv = 0 }
    // depth: the style's favourite spot, unless a move asked for front/back; never far back under the readouts (top-left)
    let dT = now < holdDUntil ? holdD : DEPTH[kind]
    if (scrX() < w * 0.45) dT = Math.min(dT, 0.1)
    depth += (dT - depth) * (1 - Math.exp(-dt / (reduced ? 2400 : 1500)))
    // facing: a move may hold a direction, otherwise he looks where he is going, and back at you when still
    const ft = now < faceUntil ? faceDir : Math.abs(pv) > 0.7 ? Math.sign(pv) : 0
    turn += (ft - turn) * (1 - Math.exp(-dt / 170))
  }
  /** feet: planted until the body gets too far from them, then a real step (they only slide on slide moves or in the air) */
  function stepFeet(now: number, air: boolean) {
    const glide = now < glideUntil || air || cart !== null
    for (let i = 0; i < 2; i++) {
      const st = fst[i]
      if (glide) { fa[i] = lerp(fa[i], px, 0.5); fst[i] = null; flift[i] = 0; continue }
      if (st) {
        const k = (now - st.t0) / st.dur
        if (k >= 1) { fa[i] = st.to; fst[i] = null; flift[i] = 0 }
        else { fa[i] = lerp(st.from, st.to, sm(k)); flift[i] = st.lift * Math.sin(PI * k) }
      }
    }
    if (glide) return
    const sp = Math.abs(pv)
    const d0 = Math.abs(fa[0] - px), d1 = Math.abs(fa[1] - px)
    const i = d0 >= d1 ? 0 : 1, di = Math.max(d0, d1)
    const thr = sp > 0.4 ? 0.45 : 0.16
    if (!fst[i] && di > thr && (!fst[1 - i] || sp > 5)) {
      const to = px + clamp(pv * 0.2, -1.2, 1.2)
      const dur = clamp(300 - sp * 20, 160, 300) * (reduced ? 1.3 : 1)
      fst[i] = { from: fa[i], to, t0: now, dur, lift: Math.min(0.7, 0.2 + Math.abs(to - fa[i]) * 0.35) }
    }
  }

  return {
    ownBackdrop: true,
    resize(nw, nh) {
      w = nw; h = nh
      U = Math.max(12, Math.min(h * 0.052, w * 0.06))
      floorTop = h * 0.72; floorY = h * 0.85
      // stay between the curtains, arms and all
      const cw = Math.max(36, w * 0.085)
      maxX = Math.max(0, (w / 2 - cw - 4.4 * U) / U) * (reduced ? 0.5 : 1)
      px = clamp(px, -maxX, maxX); tgtX = clamp(tgtX, -maxX, maxX)
      curtains = null
    },
    noteOn(note, x, v, k, hue, _name, g) {
      held.add(note)
      everActive = true
      const now = lastNow
      // tempo: the gap between notes sets his beat (folded into a danceable range)
      const ioi = now - lastOn
      if (ioi > 110 && ioi < 1700) {
        let pp = ioi
        while (pp < 380) pp *= 2
        while (pp > 1150) pp /= 2
        period += (pp - period) * 0.35
      }
      if (ioi > 60) nudge += -(ph - Math.round(ph)) * 0.35 // lean the beat toward this note
      lastOn = now
      lastVel = v
      energy = Math.min(1, energy + 0.16 + v * 0.14)
      pulse = Math.min(0.06, pulse + 0.015 + v * 0.02)
      const c = colFor(x), r = Math.random() < 0.5 ? ROWS - 1 : ROWS - 2
      tiles.set(r * COLS + c, { g: 1, hue })
      if (g?.cluster) return
      // the pitch pulls him across the stage like the keyboard: low = stage left, high = stage right
      const pull = clamp((note - 66) / 18, -1, 1) * maxX
      tgtX = clamp(lerp(tgtX, pull, 0.4), -maxX, maxX)
      // a running scale (3+ steps the same way) walks him that way
      const iv = note - prevNote
      if (prevNote >= 0 && now - prevNoteT < 700 && Math.abs(iv) >= 1 && Math.abs(iv) <= 4) {
        const d = Math.sign(iv)
        if (d === runDir) runN++; else { runDir = d; runN = 1 }
      } else runN = 0
      prevNote = note; prevNoteT = now
      notesSince++
      const side = x < w / 2 ? -1 : 1
      if (runN >= 3) {
        tgtX = clamp(tgtX + runDir * 0.8, -maxX, maxX)
        if (now >= bigUntil - 150) { choose('run', runDir, v) }
      } else if (now >= bigUntil && now - nameT > 1800 && notesSince >= 4 && energy > 0.35) {
        // every few notes, a named move that fits what is being played
        choose('flav', side, v, note >= 72 ? 'high' : note <= 55 ? 'low' : 'mid')
      }
      if (now >= bigUntil && now - lastMoveT > 90) noteMove(note, side, v, k === 'spicy')
      if (glyphs.length < 22) {
        const [hx, hy] = hands[side < 0 ? 0 : 1]
        glyphs.push({ x: hx || w / 2, y: hy || h / 2, t0: now, hue, ch: Math.random() < 0.5 ? '♪' : '♫', sway: Math.random() * 6 })
      }
    },
    react(ev: SceneReact) {
      if (ev.type === 'cadence') {
        moves = []
        add(1500, 300, 450, -1, [...ARMS, 'bow', 'nod', 'y'], (_u, q) => { q.bow = 1; q.nod = 0.9; q.y -= 0.3; q.la1 = -0.45; q.la2 = -1.0; q.ra1 = 1.15; q.ra2 = 0.25 }, false)
        bowMove = moves[moves.length - 1]; bowT = lastNow
        curName = 'bow'; nameT = lastNow; nameUntil = lastNow + 2000; bigUntil = lastNow + 1200; faceHold(0, 1500)
        say('Ta-da!', true)
      } else if (ev.type === 'boom') {
        goDepth(0, 2500)
        if (!choose('boom', openDir(), 1)) { armsV(750, 0.85); jump(2.2, 680) }
        say('BOOM!', true)
      } else if (ev.type === 'fizzle') {
        add(900, 100, 320, -1, ['lean', 'x', ...ARMS], (u, q) => {
          const d = 1 - Math.min(1, u / 900)
          q.lean = 0.25 * Math.sin(u * 0.013) * d * calm
          q.la1 = 1.6 + 0.9 * Math.sin(u * 0.025); q.ra1 = 1.6 + 0.9 * Math.sin(u * 0.025 + PI); q.la2 = 0.3; q.ra2 = 0.3
        }, false)
        say('Oops!', true)
      } else if (ev.type === 'resolve') {
        add(700, 150, 300, -1, [...ARMS, 'nod'], (_u, q) => { q.la1 = 0.75; q.ra1 = 0.75; q.la2 = 1.3; q.ra2 = 1.3; q.nod = -0.2 }, false)
        if (Math.random() < 0.4) say('Phew!')
      } else if (ev.type === 'motif') {
        if (spin()) { curName = 'spin'; nameT = lastNow; nameUntil = lastNow + 1500 } else armsV(600)
        say('Again!')
      }
    },
    noteOff(note) {
      held.delete(note)
      for (const m of moves) if (m.note === note && m.off === 0) m.off = lastNow
    },
    chord(xs) {
      void xs
      chordMove(Math.max(0.5, lastVel))
    },
    clear() {
      moves = []; held.clear(); glyphs.length = 0; puffs.length = 0; tiles.clear(); bubble = null
      energy = 0; jumpT0 = -1e6; spinT0 = -1e6
      dash = null; cart = null; tgtX = 0; glideUntil = -1e6; bigUntil = -1e6; curName = ''; runN = 0
    },
    drawBackdrop(ctx, now) {
      if (!w || !h) return
      const dt = Math.min(64, lastNow ? now - lastNow : 16)
      const st = useVibes.getState()
      const tgt = MOODS[st.mood].hue
      const k = Math.min(1, dt / (reduced ? 4000 : 2200))
      const hd = (a: number, b: number) => ((b - a + 540) % 360) - 180
      wallHue = (wallHue + hd(wallHue, tgt) * k + 360) % 360
      shirtHue = (shirtHue + hd(shirtHue, (tgt + 180) % 360) * k + 360) % 360
      const gA = ctx.globalAlpha, gC = ctx.globalCompositeOperation
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      // back wall
      const wg = ctx.createLinearGradient(0, 0, 0, floorTop)
      wg.addColorStop(0, `hsl(${wallHue},45%,10%)`)
      wg.addColorStop(1, `hsl(${(wallHue + 20) % 360},42%,${20 + st.intensity * 4}%)`)
      ctx.fillStyle = wg
      ctx.fillRect(0, 0, w, floorTop + 1)
      const glow = ctx.createRadialGradient(w / 2, floorTop - 4 * U, 0, w / 2, floorTop - 4 * U, Math.max(w, h) * 0.5)
      glow.addColorStop(0, `hsla(${wallHue},75%,55%,0.22)`); glow.addColorStop(1, `hsla(${wallHue},75%,50%,0)`)
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, floorTop)
      // dance floor
      const fg = ctx.createLinearGradient(0, floorTop, 0, h)
      fg.addColorStop(0, 'hsl(262,26%,15%)'); fg.addColorStop(1, 'hsl(262,30%,8%)')
      ctx.fillStyle = fg; ctx.fillRect(0, floorTop, w, h - floorTop)
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        tileQuad(ctx, r, c)
        ctx.fillStyle = (r + c) % 2 ? `hsla(${wallHue},30%,26%,0.55)` : `hsla(${(wallHue + 40) % 360},30%,20%,0.55)`
        ctx.fill()
        const t = tiles.get(r * COLS + c)
        if (t && t.g > 0.02) { ctx.fillStyle = `hsla(${t.hue},85%,62%,${(reduced ? 0.22 : 0.4) * t.g})`; ctx.fill() }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(w, floorTop); ctx.stroke()
      for (const [key, t] of tiles) { t.g *= Math.exp(-dt / (reduced ? 900 : 480)); if (t.g < 0.02) tiles.delete(key) }
      curtains = curtains ?? buildCurtains()
      ctx.drawImage(curtains, 0, 0, w, h)
      ctx.globalAlpha = gA; ctx.globalCompositeOperation = gC
    },
    draw(ctx, now, quality) {
      const dt = Math.min(64, lastNow ? now - lastNow : 16)
      lastNow = now
      const st = useVibes.getState()
      if (st.activity > 0.05) everActive = true
      if (st.mood !== shownMood) {
        shownMood = st.mood
        face.setMood(st.mood)
        const nk = MOOD_KIND[st.mood]
        if (nk !== kind) { prevKind = kind; kind = nk; mixT0 = now }
      }
      face.step(dt)
      pulse *= Math.exp(-dt / 160)
      energy *= Math.exp(-dt / 2400)
      // tempo + phase
      const idle = now - lastOn > 2600
      const per = idle ? lerp(period, 1300, Math.min(1, (now - lastOn - 2600) / 3000)) : period
      const mix = sm((now - mixT0) / (reduced ? 1200 : 700))
      const speed = lerp(SPEED[prevKind], SPEED[kind], mix)
      const nk = Math.min(1, dt / 120)
      ph += (dt / per) * speed + nudge * nk
      nudge -= nudge * nk
      if (ph > 1e4) ph -= 1e4
      const amp = (0.28 + 0.72 * energy) * Math.min(1.1, 0.8 + 0.35 * st.intensity) * calm
      // groove (cross-faded between the old and new style), then moves on top
      Object.assign(tmpA, REST); GROOVES[prevKind](tmpA, ph, now, amp, shakeK)
      Object.assign(tmpB, REST); GROOVES[kind](tmpB, ph, now, amp, shakeK)
      const p = tmpA
      for (const key of KEYS) p[key] = lerp(tmpA[key], tmpB[key], mix)
      // while he walks, the groove's own hip sway calms down so his feet can keep up
      const walk = Math.min(1, Math.abs(pv) / 3)
      p.x *= 1 - 0.6 * walk
      for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i]
        let end = m.t0 + m.dur
        if (m.note >= 0) end = Math.max(end, Math.min(m.off === 0 ? now + m.rel : m.off + m.rel, m.t0 + 1800))
        if (now >= end) { moves.splice(i, 1); continue }
      }
      for (const m of moves) {
        const u = now - m.t0
        let end = m.t0 + m.dur
        if (m.note >= 0) end = Math.max(end, Math.min(m.off === 0 ? now + m.rel : m.off + m.rel, m.t0 + 1800))
        const wgt = sm(u / m.att) * sm((end - now) / m.rel)
        Object.assign(tmpQ, p)
        m.f(u, tmpQ)
        for (const key of m.mask) p[key] = lerp(p[key], tmpQ[key], wgt)
      }
      // jump (with a little squat before take-off) and spin
      let jh = 0
      const ju = (now - jumpT0) / jumpDur
      if (ju >= 0 && ju < 1) {
        if (ju < 0.16) p.y -= 0.7 * Math.sin((ju / 0.16) * PI) * Math.min(1, jumpH)
        else { const q = (ju - 0.16) / 0.84; jh = 4 * q * (1 - q) * jumpH }
      }
      let sx = 1
      const su = (now - spinT0) / spinDur
      if (su >= 0 && su < 1) { sx = Math.cos(TAU * sm(su)); if (Math.abs(sx) < 0.12) sx = sx < 0 ? -0.12 : 0.12 }
      // cartwheel: the whole rig rolls over, lifted so his hands clear the floor
      let rot = 0
      if (cart) {
        const cu = (now - cart.t0) / cart.dur
        if (cu >= 1) cart = null
        else { rot = cart.dir * TAU * sm(cu); jh += 1.5 * Math.sin(PI * cu) }
      }
      // light low-pass so nothing ever pops
      const lp = 1 - Math.exp(-dt / 40)
      for (const key of KEYS) cur[key] = lerp(cur[key], p[key], lp)
      travel(now, dt)
      stepFeet(now, jh > 0.15)

      ctx.save()
      base = ctx.getTransform().inverse(); ctxRef = ctx
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      const sk = 1 - 0.22 * depth // further back = smaller...
      skCur = sk
      const gy = floorY - depth * (floorY - floorTop) * 0.7 // ...and higher up the floor
      const X = scrX()
      // spotlight cone + pool: they follow him across the stage
      const beat = reduced ? 0 : 0.04 * (0.5 + 0.5 * Math.cos(ph * TAU)) * energy
      const ctop = w / 2 + (X - w / 2) * 0.35
      const cone = ctx.createLinearGradient(0, 0, 0, gy)
      cone.addColorStop(0, 'hsla(48,100%,88%,0.16)'); cone.addColorStop(1, 'hsla(48,100%,88%,0.05)')
      ctx.fillStyle = cone
      ctx.beginPath(); ctx.moveTo(ctop - 0.9 * U, 0); ctx.lineTo(ctop + 0.9 * U, 0); ctx.lineTo(X + 4.6 * U * sk, gy); ctx.lineTo(X - 4.6 * U * sk, gy); ctx.closePath(); ctx.fill()
      ctx.save(); ctx.translate(X, gy); ctx.scale(sk, 0.24 * sk)
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 4.8 * U)
      pool.addColorStop(0, `hsla(48,100%,86%,${0.32 + beat})`); pool.addColorStop(1, 'hsla(48,100%,86%,0)')
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, 4.8 * U, 0, TAU); ctx.fill()
      ctx.restore()
      // soft shadow (smaller when he is in the air, and when he is further back)
      const sh = 1 - Math.min(0.5, jh * 0.18)
      ctx.fillStyle = `rgba(10,4,20,${0.42 * sh})`
      ctx.beginPath(); ctx.ellipse(X + cur.x * U * 0.6 * sk, gy + 0.25 * U * sk, 2.1 * U * sh * sk, 0.42 * U * sh * sk, 0, 0, TAU); ctx.fill()
      // stomp dust
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = (now - puffs[i].t0) / 600
        if (q < 0) continue
        if (q >= 1) { puffs.splice(i, 1); continue }
        ctx.fillStyle = `rgba(230,225,255,${0.35 * (1 - q)})`
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(puffs[i].x + s * (0.4 + q * 1.1) * U * sk, puffs[i].y - q * 0.4 * U, (0.2 + q * 0.35) * U * sk, 0, TAU); ctx.fill() }
      }
      ctx.save()
      ctx.translate(X, gy); ctx.scale(sk, sk); ctx.translate(-w / 2, -floorY)
      const head = drawGuy(ctx, now, cur, jh, sx, rot)
      ctx.restore()
      // tell the page where his head is, so the mentor's pills and captions can sit on the other side (~5 times a second)
      if (now - pubT > 200) {
        pubT = now
        const fx = head.hx / Math.max(1, w)
        const side = fx > 0.58 ? 'right' : fx < 0.5 ? 'centre' : pubSide || 'centre'
        try {
          const de = document.documentElement
          de.style.setProperty('--dancer-x', fx.toFixed(3))
          if (side !== pubSide) { pubSide = side; if (side === 'right') de.dataset.dancerSide = 'right'; else delete de.dataset.dancerSide }
        } catch { /* no DOM */ }
      }
      // floating notes from his hands
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `800 ${Math.round(U * 0.9)}px system-ui, sans-serif`
      const life = 1500
      for (let i = glyphs.length - 1; i >= 0; i--) {
        const gq = glyphs[i]
        const q = (now - gq.t0) / life
        if (q >= 1 || quality < 0.45) { glyphs.splice(i, 1); continue }
        ctx.globalAlpha = (q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85) * 0.9
        ctx.fillStyle = `hsl(${gq.hue},90%,76%)`
        ctx.fillText(gq.ch, gq.x + Math.sin(q * 5 + gq.sway) * U * 0.5 * calm, gq.y - q * 3.2 * U)
      }
      ctx.globalAlpha = 1
      // speech bubble (on whichever side of his head has more room)
      if (bubble) {
        const q = (now - bubble.t0) / 1400
        if (q >= 1) bubble = null
        else {
          const a = q < 0.12 ? q / 0.12 : q > 0.75 ? 1 - (q - 0.75) / 0.25 : 1
          const bs = head.hx > w * 0.6 ? -1 : 1
          const bx = head.hx + bs * head.R * 1.55, by = head.hy - head.R * 1.25 - q * 0.4 * U
          ctx.globalAlpha = a
          ctx.font = `800 ${Math.round(Math.max(13, U * 0.62))}px system-ui, sans-serif`
          const tw = ctx.measureText(bubble.txt).width + U * 0.9, th = U * 1.05
          ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#241634'; ctx.lineWidth = 2
          rr(ctx, bx - tw / 2, by - th / 2, tw, th, th / 2); ctx.fill(); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx - bs * tw * 0.3, by + th / 2 - 1); ctx.lineTo(bx - bs * tw * 0.42, by + th / 2 + U * 0.4); ctx.lineTo(bx - bs * tw * 0.12, by + th / 2 - 1); ctx.fill()
          ctx.fillStyle = '#241634'
          ctx.fillText(bubble.txt, bx, by + 1)
          ctx.globalAlpha = 1
        }
      }
      // caption: the mood and the dance it makes (or the move he is doing right now)
      const def = MOODS[st.mood]
      const fs = Math.round(Math.max(13, Math.min(20, U * 0.6)))
      ctx.font = `800 ${fs}px system-ui, sans-serif`
      const who = useDancerName.getState().name
      const what = curName && now < nameUntil ? curName : WORD[kind]
      const label = `${who ? who + ' · ' : ''}${def.emoji}  ${def.label} = ${what}`
      const tw = ctx.measureText(label).width + fs * 2
      const ly = Math.min(h - 18, floorY + 1.35 * U)
      const cx = w / 2
      ctx.fillStyle = 'rgba(10,8,30,0.55)'
      // keep the label clear of the visual bar's buttons in the bottom-right corner
      const lx = Math.max(tw / 2 + 12, Math.min(cx, w * 0.58 - tw / 2))
      rr(ctx, lx - tw / 2, ly - fs * 0.95, tw, fs * 1.9, fs * 0.95); ctx.fill()
      ctx.fillStyle = `hsl(${def.hue},90%,86%)`
      ctx.fillText(label, lx, ly + 1)
      if (!everActive) {
        ctx.fillStyle = 'rgba(240,236,255,0.85)'
        ctx.font = `600 ${Math.max(12, fs - 3)}px system-ui, sans-serif`
        ctx.fillText(who ? `I'm ${who}! Play some notes and I'll dance.` : "Play some notes and I'll dance! Chords = big moves.", lx, ly + fs * 1.7)
      }
      ctx.restore()
    },
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
