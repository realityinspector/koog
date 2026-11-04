// Easter eggs for the Dancer: a pure melody recognizer plus the egg list (names, hints, demos). No DOM, no state outside
// createRecognizer(), so scripts/egg-fixtures.ts can test every egg with plain numbers.
// Tunes are matched by INTERVAL, so any key or octave works. Rhythm is checked loosely: the tempo is fitted to what was
// played and every gap must stay within a factor of the written rhythm (rt). Notes within 45 ms of each other are ONE
// "group" (a chord, or a hand landing slightly apart); a group counts as its top note for melodies, and as a set for chords.
// Held notes make no new onset, so a drone under a tune does not disturb it. Every egg has a cooldown.
// Only public-domain tunes (US publication 1930 or earlier, or traditional) and simple universal patterns.
import { seq } from '../../music/classical'
import { HOLIDAY_SONGS } from '../songs/holidaySongs'

export type EggId =
  | 'shave' | 'birthday' | 'scales' | 'ode' | 'twinkle' | 'chromatic' | 'woodpecker' | 'quake' | 'pogo' | 'crown' | 'clock' | 'wig' | 'sleepy' | 'dizzy' | 'ghost' | 'surf'
  | 'santa' | 'lights' | 'present' | 'snow' | 'tree' | 'antlers' | 'sleigh' | 'pilgrim' | 'pie' | 'turkey'

export interface DemoNote { n: number; t: number; d: number; v: number }
export interface EggInfo { id: EggId; name: string; emoji: string; hint: string; section: 'fun' | 'holiday'; dur: number; cd: number; what: string }

// ---------------------------------------------------------------- tunes
interface Tune { egg: EggId; notes: number[]; beats: number[]; rt: number; alt?: number[][] }
/** a tune from "E4:1 D4 C4:2 R:1" text: midi notes + the gap (in beats) from each note to the next, rests included */
function fromSeq(egg: EggId, text: string, rt = 2.2, alt?: number[][]): Tune {
  const notes: number[] = [], beats: number[] = []
  for (const s of seq(text)) {
    if (s.note == null) { if (beats.length) beats[beats.length - 1] += s.beats; continue }
    notes.push(s.note); beats.push(s.beats)
  }
  beats.pop()
  return { egg, notes, beats, rt, alt }
}
/** the opening `count` sounding notes of a holiday song (read from the Songs tab data, so the tunes always agree) */
function opening(egg: EggId, songId: string, count: number, rt = 2.2): Tune {
  const song = HOLIDAY_SONGS.find((s) => s.id === songId)
  if (!song) throw new Error('no holiday song ' + songId)
  const notes: number[] = [], beats: number[] = []
  for (const s of song.notes) {
    if (s.note == null) { if (beats.length) beats[beats.length - 1] += s.beats; continue }
    notes.push(s.note); beats.push(s.beats)
    if (notes.length === count) break
  }
  beats.pop()
  return { egg, notes, beats, rt }
}
const ivs = (notes: number[]) => notes.slice(1).map((n, i) => n - notes[i])

export const TUNES: Tune[] = [
  fromSeq('shave', 'C4:1 G3:.5 G3:.5 A3:1 G3:2 B3:1 C4:2', 1.8, [[7, 0, 2, -2, 4, 1]]),
  fromSeq('birthday', 'G4:.75 G4:.25 A4:1 G4:1 C5:1 B4:2'),
  fromSeq('birthday', 'G4:.75 G4:.25 A4:1 G4:1 D5:1 C5:2'),
  fromSeq('ode', 'E4:1 E4 F4 G4 G4 F4 E4 D4'),
  fromSeq('twinkle', 'C4:1 C4 G4 G4 A4 A4 G4:2'),
  fromSeq('clock', 'G#4:1 F#4 E4 B3:2 E4:1 G#4 F#4 B3:2', 3),
  fromSeq('wig', 'E5:.5 D#5 E5 D#5 E5 B4 D5 C5'),
  opening('santa', 'jingle', 8),
  opening('lights', 'deckhalls', 8),
  opening('present', 'wewish', 8),
  opening('snow', 'silentnight', 8, 2.6),
  opening('tree', 'christmastree', 8),
  opening('antlers', 'housetop', 8),
  opening('sleigh', 'overriver', 8),
  opening('pilgrim', 'gather', 8),
  opening('pie', 'simplegifts', 8),
  opening('turkey', 'thankful', 7),
]
const TUNE_IV = TUNES.map((t) => [ivs(t.notes), ...(t.alt ?? [])])

// ---------------------------------------------------------------- scales
const MAJ = [2, 2, 1, 2, 2, 2, 1], NMIN = [2, 1, 2, 2, 1, 2, 2], HMIN = [2, 1, 2, 2, 1, 3, 1], MMIN = [2, 1, 2, 2, 2, 2, 1]
const SCALE_SET = new Set<string>()
for (const p of [MAJ, NMIN, HMIN, MMIN]) for (let r = 0; r < 7; r++) {
  const rot = [...p.slice(r), ...p.slice(0, r)]
  SCALE_SET.add(rot.slice(0, 7).join(','))
  SCALE_SET.add(rot.slice(0, 7).reverse().join(','))
}

// ---------------------------------------------------------------- recognizer
interface G { t: number; top: number; cnt: number; pcs: number; v: number }
interface Raw { t: number; n: number; v: number }
const GROUP_MS = 45

export interface Recognizer { onset(t: number, note: number, v: number): EggId | null; reset(): void }

type Check = (g: G[], r: Raw[], t: number) => boolean
const gap = (g: G[], i: number) => g[i].t - g[i - 1].t

function tuneHit(g: G[], ti: number): boolean {
  const tune = TUNES[ti], n = tune.notes.length
  if (g.length < n) return false
  const w = g.slice(g.length - n)
  const got = ivs(w.map((x) => x.top))
  if (!TUNE_IV[ti].some((want) => want.every((x, i) => x === got[i]))) return false
  // timing: every gap sane, and the written rhythm fits the played one once the tempo is fitted
  let sum = 0
  const lr: number[] = []
  for (let i = 1; i < n; i++) {
    const a = gap(w, i)
    if (a < 50 || a > 3200) return false
    const l = Math.log(a / tune.beats[i - 1]); lr.push(l); sum += l
  }
  const mean = sum / lr.length
  const beatMs = Math.exp(mean)
  if (beatMs < 110 || beatMs > 1700) return false
  const lim = Math.log(tune.rt)
  return lr.every((l) => Math.abs(l - mean) <= lim)
}

/** the last `n` groups moving the same way in steps of 1..maxStep, each gap within [lo, hi]; returns the direction or 0 */
function run(g: G[], n: number, maxStep: number, lo: number, hi: number): number {
  if (g.length < n) return 0
  let dir = 0
  for (let i = g.length - n + 1; i < g.length; i++) {
    const s = g[i].top - g[i - 1].top, a = gap(g, i)
    if (Math.abs(s) < 1 || Math.abs(s) > maxStep || a < lo || a > hi) return 0
    const d = s > 0 ? 1 : -1
    if (dir && d !== dir) return 0
    dir = d
  }
  return dir
}

const CHECK: Partial<Record<EggId, Check>> = {
  scales(g) {
    if (!run(g, 8, 3, 141, 900)) return false
    const w = g.slice(g.length - 8), steps: number[] = []
    let lo = 1e9, hi = 0
    for (let i = 1; i < 8; i++) { steps.push(Math.abs(w[i].top - w[i - 1].top)); const a = gap(w, i); lo = Math.min(lo, a); hi = Math.max(hi, a) }
    return hi <= lo * 3 && SCALE_SET.has(steps.join(','))
  },
  surf(g) {
    if (!run(g, 8, 2, 45, 140)) return false
    const w = g.slice(g.length - 8), steps: number[] = []
    for (let i = 1; i < 8; i++) steps.push(Math.abs(w[i].top - w[i - 1].top))
    return SCALE_SET.has(steps.join(',')) // a slide along a scale, in any key (white keys in C)
  },
  chromatic(g) {
    if (!run(g, 8, 1, 45, 500)) return false
    return true
  },
  woodpecker(g) {
    if (g.length < 8) return false
    for (let i = g.length - 7; i < g.length; i++) if (g[i].top !== g[i - 1].top || gap(g, i) < 40 || gap(g, i) > 260) return false
    return true
  },
  pogo(g) {
    if (g.length < 5) return false
    for (let i = g.length - 4; i < g.length; i++) {
      const s = g[i].top - g[i - 1].top, p = g[i - 1].top - (i > g.length - 4 ? g[i - 2].top : 1e9)
      if (Math.abs(s) !== 12 || gap(g, i) > 900 || gap(g, i) < 80 || (i > g.length - 4 && s !== -p)) return false
    }
    return true
  },
  ghost(g) {
    if (g.length < 5) return false
    for (let i = g.length - 4; i < g.length; i++) {
      const s = g[i].top - g[i - 1].top, p = g[i - 1].top - (i > g.length - 4 ? g[i - 2].top : 1e9)
      if (Math.abs(s) !== 6 || gap(g, i) > 1100 || gap(g, i) < 80 || (i > g.length - 4 && s !== -p)) return false
    }
    return true
  },
  quake(g) {
    const l = g[g.length - 1]
    return l.cnt >= 4 && l.top <= 55
  },
  dizzy(_g, r, t) {
    let n = 0, sum = 0, mask = 0
    for (let i = r.length - 1; i >= 0 && t - r[i].t <= 1400; i--) { n++; sum += r[i].v; mask |= 1 << (r[i].n % 12) }
    let bits = 0
    for (let m = mask; m; m &= m - 1) bits++
    return n >= 12 && sum / n >= 0.72 && bits >= 5
  },
  sleepy(g) {
    if (g.length < 3) return false
    for (let i = g.length - 2; i < g.length; i++) if (gap(g, i) < 1300 || gap(g, i) > 6500) return false
    for (let i = g.length - 3; i < g.length; i++) if (g[i].v > 0.38) return false
    return true
  },
}

/** the root of a major triad hiding in a set of pitch classes, or -1 */
function triad(mask: number): number {
  for (let r = 0; r < 12; r++) if (mask & (1 << r) && mask & (1 << ((r + 4) % 12)) && mask & (1 << ((r + 7) % 12))) return r
  return -1
}

/** crown: four major chords, oldest to newest: I, IV, V, I */
CHECK.crown = (g) => {
  if (g.length < 4) return false
  const roots: number[] = []
  for (let i = g.length - 4; i < g.length; i++) {
    if (g[i].cnt < 3) return false
    const r = triad(g[i].pcs)
    if (r < 0) return false
    if (i > g.length - 4 && gap(g, i) > 5200) return false
    roots.push(r)
  }
  const [a, b, c, d] = roots
  return d === a && b === (a + 5) % 12 && c === (a + 7) % 12
}

/** order matters: specific tunes first, impulsive reactions last */
const ORDER: EggId[] = ['scales', 'surf', 'chromatic', 'woodpecker', 'pogo', 'ghost', 'crown', 'quake', 'dizzy', 'sleepy']

export const INFO: EggInfo[] = []
const cdOf = (id: EggId) => INFO.find((e) => e.id === id)?.cd ?? 6000

export function createRecognizer(): Recognizer {
  const gs: G[] = [], raw: Raw[] = []
  const fired = new Map<EggId, number>()
  let lock = -1e9
  const ready = (id: EggId, t: number) => t - (fired.get(id) ?? -1e9) >= cdOf(id)
  return {
    reset() { gs.length = 0; raw.length = 0; fired.clear(); lock = -1e9 },
    onset(t, note, v) {
      raw.push({ t, n: note, v }); if (raw.length > 24) raw.shift()
      const last = gs[gs.length - 1]
      if (last && t - last.t < GROUP_MS) {
        last.cnt++; last.pcs |= 1 << (note % 12); last.v = Math.max(last.v, v)
        if (note > last.top) last.top = note
      } else {
        gs.push({ t, top: note, cnt: 1, pcs: 1 << (note % 12), v })
        if (gs.length > 24) gs.shift()
      }
      if (t < lock) return null
      let hit: EggId | null = null
      for (let i = 0; i < TUNES.length && !hit; i++) if (ready(TUNES[i].egg, t) && tuneHit(gs, i)) hit = TUNES[i].egg
      for (let i = 0; i < ORDER.length && !hit; i++) { const id = ORDER[i]; if (ready(id, t) && CHECK[id]!(gs, raw, t)) hit = id }
      if (hit) { fired.set(hit, t); lock = t + 700 }
      return hit
    },
  }
}

// ---------------------------------------------------------------- the egg list
const E = (id: EggId, emoji: string, name: string, hint: string, section: 'fun' | 'holiday', dur: number, what: string, cd = dur + 3500): EggInfo => ({ id, emoji, name, hint, section, dur, cd, what })
INFO.push(
  E('shave', '🧔', 'Shave and a haircut', 'Try a barbershop goodbye…', 'fun', 4500, 'a foam beard, then a razor swoosh'),
  E('birthday', '🎂', 'Happy Birthday', 'Try the song everyone sings at parties…', 'fun', 5200, 'a cake with candles and a bow'),
  E('scales', '🐟', 'Scales!', 'Try climbing every step of a scale, up or down…', 'fun', 5000, 'he turns into a fish'),
  E('ode', '🎼', 'Ode to Joy', 'Try the happiest tune Beethoven ever wrote…', 'fun', 5000, 'a baton and a tails coat'),
  E('twinkle', '🚀', 'Twinkle Twinkle', 'Try wondering what a little star is…', 'fun', 5200, 'an astronaut helmet and floating stars'),
  E('chromatic', '🌈', 'Rainbow run', 'Try climbing every single key, black ones too…', 'fun', 4500, 'a rainbow trail'),
  E('woodpecker', '🐦', 'Woodpecker', 'Try pecking one key super fast…', 'fun', 4000, 'a woodpecker hat, he pecks'),
  E('quake', '🌋', 'Rumble', 'Try a big low rumble with your whole hand…', 'fun', 3000, 'a gentle earthquake', 6500),
  E('pogo', '🦘', 'Pogo stick', 'Try leaping up and down by an octave, again and again…', 'fun', 4200, 'a pogo stick'),
  E('crown', '👑', 'The crown', 'Try a happy ending: home, away, tension, home…', 'fun', 5000, 'a crown (I, IV, V, I)'),
  E('clock', '🕰️', 'Tower clock', 'Try the tune a famous clock tower plays…', 'fun', 5500, 'he becomes a clock'),
  E('wig', '🎩', 'Fancy wig', 'Try a famous little piece Beethoven wrote for a friend…', 'fun', 5000, 'a powdered wig and a bow'),
  E('sleepy', '😴', 'Snooze', 'Try playing very slow and very soft…', 'fun', 40000, 'he falls asleep until a loud note', 12000),
  E('dizzy', '😵', 'Dizzy', 'Try mashing the keys loud and fast…', 'fun', 3600, 'a dizzy spin with stars', 5000),
  E('ghost', '👻', 'Spooky sheet', 'Try two spooky notes, back and forth…', 'fun', 5000, 'a ghost costume'),
  E('surf', '🏄', 'Surf\'s up', 'Try a super-fast slide across all the white keys…', 'fun', 4500, 'a surfboard'),
  E('santa', '🎅', 'Santa', 'Try the sleigh-bell song…', 'holiday', 6000, 'a red suit, hat and white beard'),
  E('lights', '💡', 'String lights', 'Try the fa-la-la song…', 'holiday', 6000, 'lights wrapped around him'),
  E('present', '🎁', 'Present', 'Try the song that asks for figgy pudding…', 'holiday', 5500, 'he hands out a present'),
  E('snow', '❄️', 'Silent Night', 'Try the quietest lullaby of the year…', 'holiday', 7000, 'snow falls and he holds a candle'),
  E('tree', '🎄', 'Little tree', 'Try the song about an evergreen…', 'holiday', 6000, 'he becomes a tree with a star'),
  E('antlers', '🦌', 'Reindeer', 'Try the click-click-click rooftop song…', 'holiday', 6000, 'antlers and rooftop hops'),
  E('sleigh', '🛷', 'Sleigh ride', 'Try the sleigh-ride song to grandmother\'s house…', 'holiday', 6000, 'a sleigh slides him across'),
  E('pilgrim', '🧢', 'Pilgrim', 'Try a hymn of thanks…', 'holiday', 6000, 'a pilgrim hat'),
  E('pie', '🥧', 'Pumpkin pie', 'Try the Shaker song about being simple…', 'holiday', 6000, 'a pie he takes a bite of'),
  E('turkey', '🦃', 'Turkey', 'Try the harvest-home song…', 'holiday', 6000, 'a turkey costume'),
)
export const EGG_COUNT = INFO.length
export const eggInfo = (id: EggId): EggInfo => INFO.find((e) => e.id === id)!

// ---------------------------------------------------------------- demos (what the gallery's "Play it" plays)
export function demoFor(id: EggId): DemoNote[] {
  const out: DemoNote[] = []
  const tune = TUNES.find((t) => t.egg === id)
  if (tune) {
    const beat = id === 'snow' ? 520 : id === 'clock' ? 480 : 340
    let t = 0
    tune.notes.forEach((n, i) => {
      const b = i < tune.beats.length ? tune.beats[i] : 1
      out.push({ n, t, d: Math.min(b * beat * 0.85, 700), v: id === 'snow' ? 0.5 : 0.65 })
      t += b * beat
    })
    return out
  }
  const step = (notes: number[], gapMs: number, v = 0.65) => notes.forEach((n, i) => out.push({ n, t: i * gapMs, d: gapMs * 0.8, v }))
  switch (id) {
    case 'scales': step([60, 62, 64, 65, 67, 69, 71, 72], 230); break
    case 'surf': step([60, 62, 64, 65, 67, 69, 71, 72, 74], 85); break
    case 'chromatic': step([60, 61, 62, 63, 64, 65, 66, 67, 68, 69], 150); break
    case 'woodpecker': step([72, 72, 72, 72, 72, 72, 72, 72, 72], 105, 0.8); break
    case 'pogo': step([60, 72, 60, 72, 60, 72], 320); break
    case 'ghost': step([60, 66, 60, 66, 60, 66], 420); break
    case 'sleepy': step([60, 64, 62], 1700, 0.22); break
    case 'quake': for (const n of [36, 39, 41, 43, 46]) out.push({ n, t: 0, d: 700, v: 0.9 }); break
    case 'dizzy': step([60, 71, 62, 69, 64, 67, 72, 59, 66, 61, 70, 63, 68, 65], 70, 0.95); break
    case 'crown': {
      const ch = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]]
      ch.forEach((c, i) => c.forEach((n) => out.push({ n, t: i * 1000, d: 800, v: 0.65 })))
      break
    }
  }
  return out
}
/** how long a demo takes to finish playing */
export const demoLength = (id: EggId) => demoFor(id).reduce((m, x) => Math.max(m, x.t + x.d), 0)
