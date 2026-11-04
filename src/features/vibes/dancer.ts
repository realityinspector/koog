// Dancer mode (request #19): an original little guy on a stage, puppeteered by the Vibes mood.
// His face IS the Vibes face (FaceAnimator), his dance style comes from the mood (happy = bouncy, sad = slow sway,
// epic = big moves, tense = jittery, calm = gentle, groovy = disco, goofy = wiggly, spooky = creepy tiptoe),
// each note or chord triggers a move, how fast you play sets his tempo, and a cadence makes him bow.
// The body is a tiny rig: hips, torso, head, 2-bone arms (joint angles) and 2-bone legs (solved with IK so the feet stay
// planted). Poses are blended: a looping "groove" per style, cross-faded when the mood changes, plus short "moves" on top.
// Photosensitivity: nothing flashes; the wall hue eases over seconds and floor tiles glow softly in one small spot.
// Reduced motion: half-size moves, no spins, no shaking, small jumps.
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
const CHEER: Record<Kind, string[]> = {
  bouncy: ['Woo!', 'Yay!', 'Hop!'], sway: ['Aww…', 'Sigh…'], epic: ['YEAH!', 'POWER!'], jitter: ['Eek!', 'Yikes!'],
  gentle: ['Ahh…', 'Nice…'], groovy: ['Groovy!', 'Oh yeah!'], goofy: ['Wheee!', 'Boing!'], spooky: ['Ooo…', 'Boo!'],
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const sm = (x: number) => { const t = x <= 0 ? 0 : x >= 1 ? 1 : x; return t * t * (3 - 2 * t) }
const pos = (v: number) => (v > 0 ? v : 0)

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

const arm = (s: number): [PK, PK] => (s < 0 ? ['la1', 'la2'] : ['ra1', 'ra2'])
const foot = (s: number): [PK, PK] => (s < 0 ? ['lfx', 'lfy'] : ['rfx', 'rfy'])
const ARMS: PK[] = ['la1', 'la2', 'ra1', 'ra2']

export const createDancer: SceneFactory = (reduced): Scene => {
  let w = 800, h = 500, U = 25, floorTop = 340, floorY = 400
  const face = new FaceAnimator(reduced)
  const calm = reduced ? 0.55 : 1
  const shakeK = reduced ? 0 : 1
  let lastNow = 0
  let kind: Kind = 'gentle', prevKind: Kind = 'gentle', mixT0 = -1e6, shownMood: MoodId = 'calm'
  let ph = 0, period = 1000, nudge = 0, lastOn = -1e6, energy = 0
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
  const cur: Pose = { ...REST }
  const tmpA: Pose = { ...REST }, tmpB: Pose = { ...REST }, tmpQ: Pose = { ...REST }
  let curtains: HTMLCanvasElement | null = null
  const COLS = 12, ROWS = 4

  function add(dur: number, att: number, rel: number, note: number, mask: PK[], f: (u: number, q: Pose) => void, speed = true) {
    const sp = speed ? SPEED[kind] : 1
    const k = sp < 0.8 ? 1.5 : 1
    moves.push({ t0: lastNow, dur: dur * k, att: att * k, rel: rel * k, note, off: 0, mask, f })
    if (moves.length > 5) moves.shift()
    lastMoveT = lastNow
  }
  function say(txt: string, force = false) {
    if (!force && lastNow - lastBubble < 1800) return
    bubble = { txt, t0: lastNow }; lastBubble = lastNow
  }
  const cheer = () => { const c = CHEER[kind]; say(c[Math.floor(Math.random() * c.length)]) }
  function jump(H: number, dur = 600) {
    if (lastNow - jumpT0 < jumpDur) return
    jumpT0 = lastNow; jumpDur = dur; jumpH = H * (reduced ? 0.35 : 1)
  }
  function spin() {
    if (reduced || lastNow - lastSpin < 2200) return false
    spinT0 = lastNow; lastSpin = lastNow
    add(spinDur, 120, 250, -1, ARMS, (_u, q) => { q.la1 = 1.45; q.la2 = 0.2; q.ra1 = 1.45; q.ra2 = 0.2 }, false)
    return true
  }
  function armsV(dur = 700, wide = 0.25) {
    add(dur, 120, 300, -1, [...ARMS, 'lfx', 'rfx'], (_u, q) => { q.la1 = 2.6; q.la2 = 0.15; q.ra1 = 2.6; q.ra2 = 0.15; q.lfx = wide; q.rfx = wide })
  }

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
      puffs.push({ x: w / 2 + side * 0.95 * U, y: floorY, t0: lastNow + 460 * 0.47 })
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

  // ---- the rig: solve joints, then paint
  function drawGuy(ctx: CanvasRenderingContext2D, now: number, p: Pose, jh: number, sx: number) {
    const u = U, cx = w / 2
    const hipX = cx + p.x * u, hipY = floorY - (4.45 + p.y + jh) * u
    const f = face.cur
    const skin = `hsl(${f.fh},${f.fs}%,${f.fl}%)`
    const ink = '#241634'
    const shirt = `hsl(${shirtHue},72%,56%)`, shirtD = `hsl(${shirtHue},60%,40%)`
    const pants = 'hsl(228,36%,30%)'
    ctx.save()
    ctx.translate(hipX, 0); ctx.scale(sx, 1); ctx.translate(-hipX, 0)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const cl = Math.cos(p.lean * 0.5), sl = Math.sin(p.lean * 0.5)
    const L1 = 2.3 * u, L2 = 2.25 * u
    // legs (2-bone IK: the hip is placed by the dance, the foot is planted on the floor)
    for (const s of [-1, 1]) {
      const hx = hipX + s * 0.55 * u * cl, hy = hipY + s * 0.55 * u * sl
      const fdx = s < 0 ? p.lfx : p.rfx, lift = s < 0 ? p.lfy : p.rfy
      let fx = cx + p.x * u * 0.25 + s * (0.8 + fdx) * u, fy = floorY - (0.3 + lift + jh * 1.25) * u
      let dx = fx - hx, dy = fy - hy
      let d = Math.hypot(dx, dy)
      const reach = (L1 + L2) * 0.999
      if (d > reach) { fx = hx + (dx / d) * reach; fy = hy + (dy / d) * reach; dx = fx - hx; dy = fy - hy; d = reach }
      d = Math.max(d, 0.3 * u)
      const base = Math.atan2(dy, dx)
      const ca = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))
      const a = Math.acos(ca)
      const out = s < 0 ? base + a : base - a, inn = s < 0 ? base - a : base + a
      const kk = (p.knee + 1) / 2
      const kx = lerp(hx + Math.cos(inn) * L1, hx + Math.cos(out) * L1, kk), ky = lerp(hy + Math.sin(inn) * L1, hy + Math.sin(out) * L1, kk)
      ctx.strokeStyle = ink; ctx.lineWidth = 1.15 * u
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke()
      ctx.strokeStyle = pants; ctx.lineWidth = 0.92 * u
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke()
      // sneaker
      const shx = fx + s * 0.3 * u, shy = fy + 0.12 * u
      ctx.fillStyle = '#fbf8ff'; ctx.strokeStyle = ink; ctx.lineWidth = 0.13 * u
      ctx.beginPath(); ctx.ellipse(shx, shy, 0.7 * u, 0.38 * u, s * 0.08, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.fillStyle = `hsl(${(shirtHue + 40) % 360},80%,55%)`
      ctx.beginPath(); ctx.ellipse(shx, shy + 0.2 * u, 0.62 * u, 0.12 * u, s * 0.08, 0, TAU); ctx.fill()
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
    // hem stripe + a music note on the chest
    ctx.strokeStyle = shirtD; ctx.lineWidth = 0.22 * u
    ctx.beginPath(); ctx.moveTo(...P(-0.9, 0.62)); ctx.lineTo(...P(0.9, 0.62)); ctx.stroke()
    const [mx, my] = P(0.05, 1.7)
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
      hands[s < 0 ? 0 : 1] = [hipX + (hx - hipX) * sx, hy]
    }
    // head: the Vibes face, with hair
    const R = 1.5 * u
    const hcx = nx + hux * (0.35 * u + R), hcy = ny + huy * (0.35 * u + R) + p.nod * 0.3 * u + p.bow * 0.9 * u
    ctx.save()
    ctx.translate(hcx, hcy); ctx.rotate(p.lean + p.tilt)
    const hair = 'hsl(24,48%,24%)'
    if (sx >= 0) {
      face.draw(ctx, 0, 0, R, now, { pulse, bob: 0, shake: kind === 'jitter' && !reduced ? 0.006 : 0 })
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
    ctx.restore()
    ctx.restore()
    return { hx: hipX + (hcx - hipX) * sx, hy: hcy, R }
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

  return {
    ownBackdrop: true,
    resize(nw, nh) {
      w = nw; h = nh
      U = Math.max(12, Math.min(h * 0.052, w * 0.06))
      floorTop = h * 0.72; floorY = h * 0.85
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
      energy = Math.min(1, energy + 0.16 + v * 0.14)
      pulse = Math.min(0.06, pulse + 0.015 + v * 0.02)
      const c = colFor(x), r = Math.random() < 0.5 ? ROWS - 1 : ROWS - 2
      tiles.set(r * COLS + c, { g: 1, hue })
      if (g?.cluster) return
      const side = x < w / 2 ? -1 : 1
      if (now - lastMoveT > 90) noteMove(note, side, v, k === 'spicy')
      if (glyphs.length < 22) {
        const [hx, hy] = hands[side < 0 ? 0 : 1]
        glyphs.push({ x: hx || w / 2, y: hy || h / 2, t0: now, hue, ch: Math.random() < 0.5 ? '♪' : '♫', sway: Math.random() * 6 })
      }
    },
    react(ev: SceneReact) {
      if (ev.type === 'cadence') {
        moves = []
        add(1500, 300, 450, -1, [...ARMS, 'bow', 'nod', 'y'], (_u, q) => { q.bow = 1; q.nod = 0.9; q.y -= 0.3; q.la1 = -0.45; q.la2 = -1.0; q.ra1 = 1.15; q.ra2 = 0.25 }, false)
        say('Ta-da!', true)
      } else if (ev.type === 'boom') {
        armsV(750, 0.85); jump(2.2, 680)
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
        if (!spin()) armsV(600)
        say('Again!')
      }
    },
    noteOff(note) {
      held.delete(note)
      for (const m of moves) if (m.note === note && m.off === 0) m.off = lastNow
    },
    chord(xs) {
      void xs
      chordMove(0.7)
    },
    clear() {
      moves = []; held.clear(); glyphs.length = 0; puffs.length = 0; tiles.clear(); bubble = null
      energy = 0; jumpT0 = -1e6; spinT0 = -1e6
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
      // light low-pass so nothing ever pops
      const lp = 1 - Math.exp(-dt / 40)
      for (const key of KEYS) cur[key] = lerp(cur[key], p[key], lp)

      ctx.save()
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      const cx = w / 2
      // spotlight cone + pool
      const beat = reduced ? 0 : 0.04 * (0.5 + 0.5 * Math.cos(ph * TAU)) * energy
      const cone = ctx.createLinearGradient(0, 0, 0, floorY)
      cone.addColorStop(0, 'hsla(48,100%,88%,0.16)'); cone.addColorStop(1, 'hsla(48,100%,88%,0.05)')
      ctx.fillStyle = cone
      ctx.beginPath(); ctx.moveTo(cx - 0.9 * U, 0); ctx.lineTo(cx + 0.9 * U, 0); ctx.lineTo(cx + 4.6 * U, floorY); ctx.lineTo(cx - 4.6 * U, floorY); ctx.closePath(); ctx.fill()
      ctx.save(); ctx.translate(cx, floorY); ctx.scale(1, 0.24)
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 4.8 * U)
      pool.addColorStop(0, `hsla(48,100%,86%,${0.32 + beat})`); pool.addColorStop(1, 'hsla(48,100%,86%,0)')
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, 4.8 * U, 0, TAU); ctx.fill()
      ctx.restore()
      // soft shadow (smaller when he is in the air)
      const sh = 1 - Math.min(0.5, jh * 0.18)
      ctx.fillStyle = `rgba(10,4,20,${0.42 * sh})`
      ctx.beginPath(); ctx.ellipse(cx + cur.x * U * 0.6, floorY + 0.25 * U, 2.1 * U * sh, 0.42 * U * sh, 0, 0, TAU); ctx.fill()
      // stomp dust
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = (now - puffs[i].t0) / 600
        if (q < 0) continue
        if (q >= 1) { puffs.splice(i, 1); continue }
        ctx.fillStyle = `rgba(230,225,255,${0.35 * (1 - q)})`
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(puffs[i].x + s * (0.4 + q * 1.1) * U, puffs[i].y - q * 0.4 * U, (0.2 + q * 0.35) * U, 0, TAU); ctx.fill() }
      }
      const head = drawGuy(ctx, now, cur, jh, sx)
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
      // speech bubble
      if (bubble) {
        const q = (now - bubble.t0) / 1400
        if (q >= 1) bubble = null
        else {
          const a = q < 0.12 ? q / 0.12 : q > 0.75 ? 1 - (q - 0.75) / 0.25 : 1
          const bx = head.hx + head.R * 1.55, by = head.hy - head.R * 1.25 - q * 0.4 * U
          ctx.globalAlpha = a
          ctx.font = `800 ${Math.round(Math.max(13, U * 0.62))}px system-ui, sans-serif`
          const tw = ctx.measureText(bubble.txt).width + U * 0.9, th = U * 1.05
          ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#241634'; ctx.lineWidth = 2
          rr(ctx, bx - tw / 2, by - th / 2, tw, th, th / 2); ctx.fill(); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx - tw * 0.3, by + th / 2 - 1); ctx.lineTo(bx - tw * 0.42, by + th / 2 + U * 0.4); ctx.lineTo(bx - tw * 0.12, by + th / 2 - 1); ctx.fill()
          ctx.fillStyle = '#241634'
          ctx.fillText(bubble.txt, bx, by + 1)
          ctx.globalAlpha = 1
        }
      }
      // caption: the mood and the dance it makes
      const def = MOODS[st.mood]
      const fs = Math.round(Math.max(13, Math.min(20, U * 0.6)))
      ctx.font = `800 ${fs}px system-ui, sans-serif`
      const who = useDancerName.getState().name
      const label = `${who ? who + ' · ' : ''}${def.emoji}  ${def.label} = ${WORD[kind]}`
      const tw = ctx.measureText(label).width + fs * 2
      const ly = Math.min(h - 18, floorY + 1.35 * U)
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
