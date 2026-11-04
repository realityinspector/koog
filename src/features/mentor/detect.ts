// Cheap, pure detectors the Mentor's ears (listen.ts) use on top of the basic moves:
//   - honest critiques: mashing, banging, a hammered note, off-key landings, phrases that stop mid-run, wobbly time
//   - composer "signature moves": Bach, Satie, Beethoven, Mozart, Chopin, Debussy, Joplin
// Every function takes plain arrays (newest last) and returns null/false unless it is fairly sure. No state, no DOM.
import { PC_NAMES, SCALES, pc, type Key } from '../../music/theory'

export interface Ev { t: number; notes: number[]; vels: number[] }
export interface MN { note: number; t: number; vel: number }

const iv = (ns: number[]) => ns.slice(1).map((n, i) => n - ns[i])
const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0)
const median = (x: number[]) => { if (!x.length) return 0; const s = [...x].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const cv = (x: number[]) => { const m = avg(x); if (!m) return 0; return Math.sqrt(avg(x.map((v) => (v - m) ** 2))) / m }
const iois = (ts: number[]) => ts.slice(1).map((x, i) => x - ts[i])
/** the split between the hands for style detection (the typing keyboard's lower row starts at C3, the upper at C4) */
export const HAND_SPLIT = 60

/** Is velocity real information? The computer keyboard sends a random 80-100 and some devices send one fixed
 *  value, so only a device that produced several different velocities, some outside that typing band, counts. */
export function velocityReal(vels: number[]): boolean {
  if (vels.length < 8) return false
  const d = new Set(vels).size, lo = Math.min(...vels), hi = Math.max(...vels)
  return d >= 4 && (hi > 104 || lo < 76)
}

// ---------------- critiques ----------------

/** Many onsets in ~2 s with no shape: big random jumps, no stepwise motion, no repeated figure. */
export function isMashing(evs: Ev[], now: number): boolean {
  const w = evs.filter((e) => now - e.t <= 2200)
  if (w.length < 9) return false
  const notes = w.flatMap((e) => e.notes)
  if (notes.length < 10) return false
  const line = w.map((e) => e.notes[0]), d = iv(line)
  const steps = d.filter((x) => Math.abs(x) <= 2).length / d.length
  const meanJump = avg(d.map(Math.abs))
  const distinct = new Set(notes).size / notes.length
  const pcs = new Set(notes.map(pc)).size
  if (steps >= 0.4 || meanJump < 4 || distinct < 0.55 || pcs < 6) return false
  // any 3-interval figure repeated (even transposed) = a pattern, not a mash
  const grams = new Set<string>()
  for (let i = 0; i + 3 <= d.length; i++) { const g = d.slice(i, i + 3).join(); if (grams.has(g)) return false; grams.add(g) }
  return true
}

/** Sustained very loud playing with no dynamic contrast (only when velocity is real). */
export function isBanging(history: number[]): boolean {
  if (!velocityReal(history.slice(-40)) || history.length < 10) return false
  const last = history.slice(-10)
  return avg(last) >= 112 && Math.max(...last) - Math.min(...last) <= 12
}

/** the same note struck again and again (length of the trailing run) */
export function hammeredRun(notes: number[]): number {
  let n = 0
  for (let i = notes.length - 1; i >= 0 && notes[i] === notes[notes.length - 1]; i--) n++
  return n
}

const GRID = [0.5, 1, 1.5, 2, 3]
/** Timing that isn't a rhythm: how far the gaps sit from a simple grid (halves, 1, 1.5, 2, 3 x the typical gap), in octaves.
 *  A steady player with normal human jitter scores under ~0.1; 0.15+ means there is no beat to follow. */
export function wobble(times: number[]): number {
  const io = iois(times).filter((x) => x > 60 && x < 1500)
  if (io.length < 7) return 0
  const u = median(io)
  return avg(io.map((x) => Math.min(...GRID.map((g) => Math.abs(Math.log2(x / u / g))))))
}

/** the phrase stopped while it was still running somewhere (three small steps the same way, last note not a chord tone of the key) */
export function endsMidRun(notes: number[], key: Key): boolean {
  if (notes.length < 6) return false
  const d = iv(notes.slice(-4))
  const run = d.every((x) => x !== 0 && Math.abs(x) <= 2 && Math.sign(x) === Math.sign(d[0]))
  const rel = pc(notes[notes.length - 1] - key.tonic)
  const third = key.scale === 'minor' ? 3 : 4
  return run && rel !== 0 && rel !== third && rel !== 7
}

const inScale = (n: number, key: Key) => (SCALES[key.scale] ?? SCALES.major).includes(pc(n - key.tonic))
/** An out-of-key note on a strong spot (the last note of the phrase, or a note held much longer than the rest) that never resolved by step.
 *  Returns the note name and the nearest in-key neighbour to slide to. */
export function wrongLanding(notes: number[], times: number[], key: Key): { note: string; fix: string } | null {
  const n = notes.length
  if (n < 4) return null
  const name = (x: number) => PC_NAMES[pc(x)]
  const fixOf = (x: number) => { for (const s of [1, -1, 2, -2]) if (inScale(x + s, key)) return name(x + s); return PC_NAMES[key.tonic] }
  const last = notes[n - 1]
  if (!inScale(last, key)) return { note: name(last), fix: fixOf(last) }
  const io = iois(times), m = median(io)
  for (let i = 0; i < io.length; i++) {
    const x = notes[i], nx = notes[i + 1]
    if (io[i] >= 700 && io[i] >= m * 2.2 && !inScale(x, key) && !(inScale(nx, key) && Math.abs(nx - x) <= 2)) return { note: name(x), fix: fixOf(x) }
  }
  return null
}

// ---------------- composer signature moves ----------------
export type StyleWho = 'bach' | 'satie' | 'beethoven' | 'mozart' | 'chopin' | 'debussy' | 'joplin'

const near = (a: number[], b: number[], tol: number) => a.length === b.length && a.every((x, i) => Math.sign(x) === Math.sign(b[i]) && Math.abs(x - b[i]) <= tol)

/** Bach: a busy, even line that repeats one figure on new starting notes (a running sequence), or a broken-chord bar figure. */
export function bachRun(mel: MN[]): boolean {
  const ts = mel.map((x) => x.t)
  for (const [p, groups, tol] of [[3, 3, 1], [4, 3, 1], [8, 2, 2]] as const) {
    const L = p * groups
    if (mel.length < L) continue
    const w = mel.slice(-L), ns = w.map((x) => x.note), io = iois(ts.slice(-L))
    if (median(io) > 340 || cv(io) > 0.3) continue
    const g = Array.from({ length: groups }, (_, k) => ns.slice(k * p, k * p + p)), shape = g.map(iv)
    if (!shape.every((s) => near(s, shape[0], tol))) continue
    const s0 = shape[0], turns = s0.slice(1).filter((x, i) => Math.sign(x) !== Math.sign(s0[i])).length
    if (!(s0.some((x) => Math.abs(x) >= 3) || turns >= 1)) continue // a plain scale is not a figure
    if (p === 8 && s0.filter((x) => Math.abs(x) >= 3).length < 4) continue // the bar figure must be a broken chord
    const shifts = g.slice(1).map((x, k) => x[0] - g[k][0])
    if (p < 8 && !shifts.every((x) => x !== 0 && Math.abs(x) <= 5 && Math.sign(x) === Math.sign(shifts[0]))) continue
    return true
  }
  return false
}

const SEVENTH = /maj7|minor 7|7$/
/** Satie: slow, sparse, gentle; a 7th in the harmony or the melody. */
export function satieSpace(mel: MN[], chordNames: string[], velReal: boolean): boolean {
  if (mel.length < 7) return false
  const w = mel.slice(-7), io = iois(w.map((x) => x.t))
  if (median(io) < 900 || Math.min(...io) < 450 || Math.max(...io) > 4500) return false
  if (velReal && avg(w.map((x) => x.vel)) > 85) return false
  const leaps = iv(w.map((x) => x.note)).map(Math.abs)
  if (Math.max(...leaps) > 12) return false
  return chordNames.some((c) => SEVENTH.test(c)) || leaps.some((x) => x === 10 || x === 11)
}

/** Beethoven: a short motif restated, with a sudden accent (sforzando) out of quiet playing. */
export function beethovenPunch(mel: MN[], velReal: boolean): boolean {
  if (!velReal || mel.length < 8) return false
  const w = mel.slice(-12), v = w.map((x) => x.vel)
  let sfz = false
  for (let i = 3; i < v.length; i++) if (v[i] >= 108 && avg(v.slice(i - 3, i)) <= 66) sfz = true
  if (!sfz || Math.max(...v) - Math.min(...v) < 45) return false
  const d = iv(w.map((x) => x.note)), seen = new Set<string>()
  for (let i = 0; i + 3 <= d.length; i++) {
    const g = d.slice(i, i + 3)
    if (g.every((x) => x === 0)) continue
    const k = g.join()
    if (seen.has(k)) return true
    seen.add(k)
  }
  return false
}

/** lowest note of every onset in the lower hand, with its time */
const lowLine = (evs: Ev[], split = HAND_SPLIT + 12) => evs.map((e) => ({ t: e.t, note: Math.min(...e.notes) })).filter((x) => x.note < split)

/** Mozart: an Alberti bass, low-high-middle-high (C G E G), twice in a row, evenly. */
export function albertiBass(evs: Ev[]): boolean {
  const l = lowLine(evs)
  if (l.length < 8) return false
  const w = l.slice(-8), ns = w.map((x) => x.note), io = iois(w.map((x) => x.t))
  if (median(io) > 400 || cv(io) > 0.3) return false
  for (const k of [0, 4]) {
    const [lo, hi, mid, hi2] = ns.slice(k, k + 4)
    if (!(hi === hi2 && lo < mid && mid < hi && hi - lo >= 5 && hi - lo <= 12)) return false
  }
  return true
}

/** Chopin: a wide left-hand broken chord (over an octave) while the right hand sings above it. */
export function chopinSweep(evs: Ev[], now: number): boolean {
  const w = evs.filter((e) => now - e.t <= 4000)
  // the sweep is broken (one left-hand note at a time); an oom-pah bass with chords is not this
  if (w.some((e) => e.notes.filter((n) => n < HAND_SPLIT).length >= 2)) return false
  const lh = w.flatMap((e) => e.notes.filter((n) => n < HAND_SPLIT).map((n) => ({ n, t: e.t })))
  const rh = w.flatMap((e) => e.notes.filter((n) => n >= HAND_SPLIT + 5))
  if (lh.length < 5 || rh.length < 2) return false
  const ns = lh.map((x) => x.n), span = Math.max(...ns) - Math.min(...ns)
  const d = iv(ns).map(Math.abs).filter((x) => x > 0)
  if (span < 15 || !d.length || d.filter((x) => x >= 3).length / d.length < 0.7) return false
  return new Set(ns.map(pc)).size <= 4
}

/** Debussy: a whole-tone line (5+ different notes, all a whole step apart from each other), or one chord shape slid in parallel. */
export function debussyColour(mel: MN[], chordEvs: number[][]): boolean {
  const w = mel.slice(-8).map((x) => x.note)
  if (w.length >= 6) {
    const pcs = new Set(w.map(pc))
    if (pcs.size >= 5 && [...pcs].every((x) => (x - pc(w[0]) + 12) % 2 === 0)) return true
  }
  if (chordEvs.length >= 4) {
    const c = chordEvs.slice(-4).map((x) => [...new Set(x)].sort((a, b) => a - b))
    const shape = c.map((x) => iv(x).join())
    if (c[0].length >= 3 && shape.every((s) => s === shape[0])) {
      const sh = c.slice(1).map((x, i) => x[0] - c[i][0])
      if (sh.every((x) => x !== 0 && Math.abs(x) <= 2 && Math.sign(x) === Math.sign(sh[0]))) return true
    }
  }
  return false
}

/** Joplin: an oom-pah left hand (low single bass, then a chord, evenly) under a right hand that pushes notes across the beat. */
export function joplinRag(evs: Ev[]): boolean {
  const lhE = evs.map((e) => ({ t: e.t, lh: e.notes.filter((n) => n < HAND_SPLIT + 5) })).filter((x) => x.lh.length)
  if (lhE.length < 6) return false
  const w = lhE.slice(-6), io = iois(w.map((x) => x.t))
  if (cv(io) > 0.22) return false
  const sizes = w.map((x) => x.lh.length)
  const oom = (i: number) => sizes[i] === 1, pah = (i: number) => sizes[i] >= 2
  const phase = oom(0) ? 0 : 1
  for (let i = 0; i < 6; i++) if ((i % 2 === phase) ? !oom(i) : !pah(i)) return false
  for (let i = phase; i + 1 < 6; i += 2) if (w[i].lh[0] >= Math.min(...w[i + 1].lh) - 4) return false
  // right hand: onsets between the left-hand beats, with no new right-hand note on the next beat (held across it)
  const beat = median(io), t0 = w[0].t, t1 = w[5].t + beat
  const rh = evs.filter((e) => e.t >= t0 && e.t <= t1 && e.notes.some((n) => n >= HAND_SPLIT + 5)).map((e) => e.t)
  if (rh.length < 3) return false
  let sync = 0
  for (let i = 0; i + 1 < w.length; i++) {
    const a = w[i].t, b = w[i + 1].t
    const off = rh.some((t) => t - a > beat * 0.3 && t - a < beat * 0.7)
    const onNext = rh.some((t) => Math.abs(t - b) < 70)
    if (off && !onNext) sync++
  }
  return sync >= 2
}
