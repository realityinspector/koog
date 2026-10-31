// Pure notation layout: notes in, drawable shapes out. All units are "staff spaces" (1 = gap between two staff lines).
// No React here; SheetOverlay renders the shapes once per score and just translates a group to scroll.
import type { Key } from '../../music/theory'

export type Shape =
  | { k: 'e'; x: number; y: number; open: boolean; rx?: number }
  | { k: 'l'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { k: 'p'; d: string; w: number; fill?: boolean }
  | { k: 't'; x: number; y: number; s: string; size: number }
export interface Group { i: number; x: number; shapes: Shape[]; rest: boolean; lh?: boolean }
export interface LayoutInput { note: number | null; midis?: number[]; beats: number }
/** left-hand event for the two-voice layout (empty midis = rest) */
export interface LhInput { start: number; beats: number; midis: number[] }
export interface TwoVoice { lh: LhInput[]; marks: { start: number; name: string }[]; pickup?: number }
export interface Layout {
  groups: Group[]; bars: number[]; xs: number[]; endX: number
  fifths: number; bpb: number; header: Shape[]; headerW: number; names: Shape[]
  /** chord symbols above the treble staff (two-voice layouts only) */
  marks: Shape[]
}
/** left-hand groups carry i = LH_BASE + index so hit/miss colours can address them */
export const LH_BASE = 100000

export const VH = 15
const TREB_BOT = 6.5, BASS_BOT = 12.5
const TREB_MID_D = 34, BASS_MID_D = 22 // middle-line diatonic steps
const yT = (d: number) => TREB_BOT - (d - 30) * 0.5
const yB = (d: number) => BASS_BOT - (d - 18) * 0.5
const NAT = [0, 2, 4, 5, 7, 9, 11]
const LET = 'CDEFGAB'
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]
const FIFTHS_BY_PC = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]

export function keyFifths(key?: Key): number {
  if (!key) return 0
  const minorish = key.scale === 'minor' || key.scale === 'minorPentatonic' || key.scale === 'blues'
  if (key.scale === 'chromatic') return 0
  return FIFTHS_BY_PC[(key.tonic + (minorish ? 3 : 0)) % 12]
}
function keyAccs(f: number): number[] {
  const a = [0, 0, 0, 0, 0, 0, 0]
  if (f > 0) for (let i = 0; i < f; i++) a[SHARP_ORDER[i]] = 1
  if (f < 0) for (let i = 0; i < -f; i++) a[FLAT_ORDER[i]] = -1
  return a
}
interface Sp { letter: number; acc: number; d: number }
function spell(midi: number, f: number, ka: number[], leadPc: number): Sp {
  const p = ((midi % 12) + 12) % 12
  let letter = -1, acc = 0
  for (let l = 0; l < 7; l++) if ((NAT[l] + ka[l] + 12) % 12 === p) { letter = l; acc = ka[l]; break }
  if (letter < 0) { for (let l = 0; l < 7; l++) if (NAT[l] === p) { letter = l; acc = 0; break } }
  if (letter < 0) {
    const sharp = f >= 0 || p === leadPc
    for (let l = 0; l < 7; l++) {
      if (sharp && (NAT[l] + 1) % 12 === p) { letter = l; acc = 1; break }
      if (!sharp && (NAT[l] + 11) % 12 === p) { letter = l; acc = -1; break }
    }
  }
  const oct = (midi - acc - NAT[letter]) / 12 - 1
  return { letter, acc, d: Math.round(oct) * 7 + letter }
}

const DUR: [number, string, boolean][] = [[4, 'w', false], [3, 'h', true], [2, 'h', false], [1.5, 'q', true], [1, 'q', false], [0.75, 'e', true], [0.5, 'e', false], [0.25, 's', false]]
function quant(b: number): [string, boolean] {
  if (b >= 4) return ['w', false]
  let best = DUR[DUR.length - 1]
  for (const d of DUR) if (Math.abs(d[0] - b) < Math.abs(best[0] - b)) best = d
  return [best[1], best[2]]
}
const flagsOf = (t: string) => (t === 'e' ? 1 : t === 's' ? 2 : 0)

function accShapes(acc: number, x: number, y: number): Shape[] {
  if (acc === 1) return [
    { k: 'l', x1: x - 0.18, y1: y - 1.15, x2: x - 0.18, y2: y + 1.3, w: 0.12 }, { k: 'l', x1: x + 0.18, y1: y - 1.3, x2: x + 0.18, y2: y + 1.15, w: 0.12 },
    { k: 'l', x1: x - 0.5, y1: y - 0.2, x2: x + 0.5, y2: y - 0.5, w: 0.3 }, { k: 'l', x1: x - 0.5, y1: y + 0.5, x2: x + 0.5, y2: y + 0.2, w: 0.3 }]
  if (acc === -1) return [
    { k: 'l', x1: x - 0.3, y1: y - 1.8, x2: x - 0.3, y2: y + 0.5, w: 0.13 },
    { k: 'p', d: `M${x - 0.3} ${y + 0.5} C${x + 0.1} ${y + 0.3} ${x + 0.75} ${y - 0.1} ${x + 0.6} ${y - 0.55} C${x + 0.45} ${y - 0.95} ${x} ${y - 0.8} ${x - 0.3} ${y - 0.4}`, w: 0.15 }]
  return [
    { k: 'l', x1: x - 0.3, y1: y - 1.2, x2: x - 0.3, y2: y + 0.4, w: 0.12 }, { k: 'l', x1: x + 0.3, y1: y - 0.4, x2: x + 0.3, y2: y + 1.2, w: 0.12 },
    { k: 'l', x1: x - 0.3, y1: y + 0.4, x2: x + 0.3, y2: y + 0.15, w: 0.2 }, { k: 'l', x1: x - 0.3, y1: y - 0.15, x2: x + 0.3, y2: y - 0.4, w: 0.2 }]
}

function restShapes(t: string, dotted: boolean, x: number, bass: boolean): Shape[] {
  const mid = bass ? 10.5 : 4.5
  const out: Shape[] = []
  if (t === 'w') out.push({ k: 'l', x1: x - 0.7, y1: mid - 0.75, x2: x + 0.7, y2: mid - 0.75, w: 0.5 })
  else if (t === 'h') out.push({ k: 'l', x1: x - 0.7, y1: mid - 0.25, x2: x + 0.7, y2: mid - 0.25, w: 0.5 })
  else if (t === 'q') out.push({ k: 'p', d: `M${x - 0.35} ${mid - 1.4} L${x + 0.35} ${mid - 0.5} L${x - 0.3} ${mid + 0.3} C${x + 0.5} ${mid + 0.2} ${x + 0.6} ${mid + 1.1} ${x} ${mid + 1.5}`, w: 0.3 })
  else {
    const n = t === 'e' ? 1 : 2
    for (let i = 0; i < n; i++) {
      const y = mid - 0.5 + i * 1
      out.push({ k: 'e', x: x - 0.25 + i * -0.15, y: y - 0.2, open: false, rx: 0.3 })
      out.push({ k: 'p', d: `M${x - 0.1 - i * 0.15} ${y - 0.1} C${x + 0.3 - i * 0.15} ${y} ${x + 0.4 - i * 0.15} ${y - 0.1} ${x + 0.5 - i * 0.15} ${y - 0.4}`, w: 0.2 })
    }
    out.push({ k: 'l', x1: x + 0.5, y1: mid - 1 - 0, x2: x - 0.1 - (n - 1) * 0.15, y2: mid + n * 1 + 0.3, w: 0.18 })
  }
  if (dotted) out.push({ k: 'e', x: x + 1.1, y: mid - 0.5, open: false, rx: 0.2 })
  return out
}

interface P1 {
  id: number; i: number; voice: 0 | 1; start: number; beats: number; t: string; dotted: boolean; rest: boolean; bass: boolean; x: number
  heads: { m: number; d: number; acc: number; showAcc: boolean; bass: boolean }[]
}

const MIN_GAP = 2.7, SCALE = 2.3

export function layoutSheet(input: LayoutInput[], key: Key | undefined, bpbIn: number | undefined, two?: TwoVoice, pickupIn?: number): Layout {
  const f = keyFifths(key)
  const ka = keyAccs(f)
  const bpb = bpbIn && bpbIn > 0 ? bpbIn : 4
  const minorish = key?.scale === 'minor' || key?.scale === 'minorPentatonic' || key?.scale === 'blues'
  const leadPc = minorish && key ? (key.tonic + 11) % 12 : -1

  // header (clefs live in the component as text; key signature + time signature here)
  const header: Shape[] = []
  let hx = 6.6 // clear of the clef glyphs
  const sig = f > 0 ? SHARP_ORDER.slice(0, f) : FLAT_ORDER.slice(0, -f)
  const TREB_D_S = [38, 35, 39, 36, 33, 37, 34], TREB_D_F = [34, 37, 33, 36, 32, 35, 31]
  for (let n = 0; n < sig.length; n++) {
    const dT = f > 0 ? TREB_D_S[n] : TREB_D_F[n]
    header.push(...accShapes(f > 0 ? 1 : -1, hx, yT(dT)), ...accShapes(f > 0 ? 1 : -1, hx, yB(dT - 14)))
    hx += 1.15
  }
  if (sig.length) hx += 0.4
  header.push({ k: 't', x: hx + 0.6, y: 4.5, s: String(bpb), size: 2.85 }, { k: 't', x: hx + 0.6, y: 6.5, s: '4', size: 2.85 })
  header.push({ k: 't', x: hx + 0.6, y: 10.5, s: String(bpb), size: 2.85 }, { k: 't', x: hx + 0.6, y: 12.5, s: '4', size: 2.85 })
  const headerW = hx + 2.2

  // pass 1: spell, accidentals, x positions
  // Every event (right hand = voice 0, left hand = voice 1) sits on an "onset"; both hands share one x per onset,
  // so the two staves line up by beat position. One voice (no `two`) is the old single-line layout.
  const pickup = two?.pickup ?? pickupIn ?? 0
  const minGap = two ? 2.4 : MIN_GAP
  interface Raw { i: number; voice: 0 | 1; start: number; beats: number; midis: number[] }
  const raws: Raw[] = []
  let tb = 0
  input.forEach((n, i) => { raws.push({ i, voice: 0, start: tb, beats: n.beats, midis: n.midis ?? (n.note != null ? [n.note] : []) }); tb += n.beats })
  if (two) two.lh.forEach((e, k) => raws.push({ i: LH_BASE + k, voice: 1, start: e.start, beats: e.beats, midis: e.midis }))
  const key1 = (v: number) => Math.round(v * 1000)
  const onsets = [...new Set(raws.map((r) => key1(r.start)))].sort((a, b) => a - b)
  const items: P1[] = []
  for (const voice of [0, 1] as const) {
    let lastBass = voice === 1
    let bar = -2
    let memo = new Map<number, number>()
    raws.filter((r) => r.voice === voice).sort((a, b) => a.start - b.start).forEach((n) => {
      const [t, dotted] = quant(n.beats)
      const nb = n.start < pickup - 1e-6 ? -1 : Math.floor((n.start - pickup) / bpb + 1e-6)
      if (nb !== bar) { bar = nb; memo = new Map() }
      const rest = n.midis.length === 0
      const heads: P1['heads'] = []
      for (const m of [...n.midis].sort((a, b) => a - b)) {
        const sp = spell(m, f, ka, leadPc)
        const cur = memo.has(sp.d) ? memo.get(sp.d)! : ka[sp.letter]
        heads.push({ m, d: sp.d, acc: sp.acc, showAcc: sp.acc !== cur, bass: two ? voice === 1 : m < 60 })
        memo.set(sp.d, sp.acc)
      }
      if (!rest && !two) lastBass = heads[0].bass && heads[heads.length - 1].bass
      items.push({ id: items.length, i: n.i, voice, start: n.start, beats: n.beats, t, dotted, rest, bass: two ? voice === 1 : lastBass, x: 0, heads })
    })
  }
  const bars: number[] = []
  const xOn = new Map<number, number>()
  let endCx = 0
  {
    let cx = headerW + 1.6, bar = -2
    onsets.forEach((o, k) => {
      const at = items.filter((p) => key1(p.start) === o)
      const nb = o / 1000 < pickup - 1e-6 ? -1 : Math.floor((o / 1000 - pickup) / bpb + 1e-6)
      if (k > 0 && nb > bar && nb >= 0) { bars.push(cx - 1.0); cx += 0.5 }
      bar = Math.max(bar, nb)
      const hasAcc = at.some((p) => p.heads.some((h) => h.showAcc))
      const multi = at.some((p) => p.heads.length > 1)
      const x = cx + (hasAcc ? 1.6 : 0.2) + (multi ? 0.3 : 0)
      xOn.set(o, x)
      const gap = k + 1 < onsets.length ? (onsets[k + 1] - o) / 1000 : Math.max(...at.map((p) => p.beats))
      const dotted = at.some((p) => p.dotted && Math.abs(p.beats - gap) < 0.01)
      cx = x + Math.max(minGap - 0.2, gap * SCALE) + (dotted ? 0.5 : 0)
    })
    endCx = cx
  }
  for (const p of items) p.x = xOn.get(key1(p.start))!
  const rhItems = items.filter((p) => p.voice === 0)
  const xs = rhItems.map((p) => p.x)

  // beam groups: consecutive single notes with flags, same staff, same beat (per hand)
  const beamed = new Map<number, { dir: -1 | 1; tip: number; members: number[] }>()
  for (const voiceItems of [rhItems, items.filter((p) => p.voice === 1)]) {
    let run: P1[] = []
    const flush = () => {
      if (run.length >= 2) {
        let sum = 0
        for (const p of run) { const h = p.heads[0]; sum += h.d - (h.bass ? BASS_MID_D : TREB_MID_D) }
        const dir: -1 | 1 = sum >= 0 ? 1 : -1 // 1 = stems down
        const ys = run.map((p) => (p.heads[0].bass ? yB(p.heads[0].d) : yT(p.heads[0].d)))
        const mid = run[0].heads[0].bass ? 10.5 : 4.5
        const tip = dir === -1 ? Math.min(Math.min(...ys) - 3.4, mid) : Math.max(Math.max(...ys) + 3.4, mid)
        const g = { dir, tip, members: run.map((p) => p.id) }
        for (const p of run) beamed.set(p.id, g)
      }
      run = []
    }
    for (const p of voiceItems) {
      const ok = !p.rest && p.heads.length === 1 && flagsOf(p.t) > 0
      if (ok && run.length && (run[0].heads[0].bass !== p.heads[0].bass || Math.floor(run[0].start + 1e-6) !== Math.floor(p.start + 1e-6))) flush()
      if (ok) run.push(p); else flush()
    }
    flush()
  }

  // pass 2: shapes
  const groups: Group[] = []
  const names: Shape[] = []
  const done = new Set<object>()
  for (const p of items) {
    const sh: Shape[] = []
    if (p.rest) { sh.push(...restShapes(p.t, p.dotted, p.x, p.bass)); groups.push({ i: p.i, x: p.x, shapes: sh, rest: true, lh: p.voice === 1 }); continue }
    for (const staffBass of [false, true]) {
      const hs = p.heads.filter((h) => h.bass === staffBass)
      if (!hs.length) continue
      const yOf = (d: number) => (staffBass ? yB(d) : yT(d))
      const midD = staffBass ? BASS_MID_D : TREB_MID_D
      const midY = staffBass ? 10.5 : 4.5
      const bg = beamed.get(p.id)
      const far = hs.reduce((a, h) => a + (h.d - midD), 0)
      const down = bg ? bg.dir === 1 : far / hs.length >= 0
      const hasStem = p.t !== 'w'
      // note head x offsets for seconds
      const off = hs.map(() => 0)
      if (!down) { for (let k = 1; k < hs.length; k++) if (hs[k].d - hs[k - 1].d === 1 && off[k - 1] === 0) off[k] = 1.05 }
      else { for (let k = hs.length - 2; k >= 0; k--) if (hs[k + 1].d - hs[k].d === 1 && off[k + 1] === 0) off[k] = -1.05 }
      // ledger lines
      const ledD = new Set<number>()
      hs.forEach((h) => {
        const lo = staffBass ? 18 : 30, hi = staffBass ? 26 : 38
        if (h.d < lo - 1) for (let d = lo - 2; d >= h.d; d -= 2) ledD.add(d * 2)
        if (h.d > hi + 1) for (let d = hi + 2; d <= h.d; d += 2) ledD.add(d * 2)
        if (staffBass && h.d >= 28) ledD.add(28 * 2)
      })
      ledD.forEach((v) => { const y = yOf(v / 2); sh.push({ k: 'l', x1: p.x - 1.05, y1: y, x2: p.x + 1.05 + (off.some((o) => o > 0) ? 1 : 0), y2: y, w: 0.14 }) })
      // accidentals in columns
      const cols: number[] = []
      ;[...hs].reverse().forEach((h) => {
        if (!h.showAcc) return
        let c = 0
        while (cols[c] !== undefined && cols[c] - h.d < 6) c++
        cols[c] = h.d
        sh.push(...accShapes(h.acc, p.x - 1.35 - c * 0.95 + (off.some((o) => o < 0) ? -1.05 : 0), yOf(h.d)))
      })
      hs.forEach((h, k) => {
        const y = yOf(h.d)
        sh.push({ k: 'e', x: p.x + off[k], y, open: p.t === 'w' || p.t === 'h', rx: p.t === 'w' ? 0.75 : undefined })
        if (p.dotted) sh.push({ k: 'e', x: p.x + 1.15 + Math.max(0, ...off), y: h.d % 2 === (staffBass ? 18 : 30) % 2 ? y - 0.5 : y, open: false, rx: 0.2 })
      })
      if (hasStem) {
        const ys = hs.map((h) => yOf(h.d))
        const top = Math.min(...ys), bot = Math.max(...ys)
        const sx = down ? p.x - 0.58 : p.x + 0.58
        const tipY = bg ? bg.tip : down ? Math.max(bot + 3.4, midY) : Math.min(top - 3.4, midY)
        const base = down ? top : bot
        sh.push({ k: 'l', x1: sx, y1: base, x2: sx, y2: tipY, w: 0.14 })
        const fl = flagsOf(p.t)
        if (fl && !bg) {
          for (let q = 0; q < fl; q++) {
            const sg = down ? -1 : 1
            const y0 = tipY + q * 0.85 * sg
            sh.push({ k: 'p', d: `M${sx} ${y0} C${sx + 0.2} ${y0 + sg * 0.9} ${sx + 1.5} ${y0 + sg * 1.2} ${sx + 1.2} ${y0 + sg * 2.5}`, w: 0.32 })
          }
        }
        if (bg && !done.has(bg)) {
          done.add(bg)
          const mem = bg.members.map((id) => items[id])
          const sxOf = (it: P1) => (bg.dir === 1 ? it.x - 0.58 : it.x + 0.58)
          const inward = bg.dir === 1 ? -1 : 1
          const by = (n: number) => bg.tip + inward * (0.22 + n * 0.68)
          sh.push({ k: 'l', x1: sxOf(mem[0]), y1: by(0), x2: sxOf(mem[mem.length - 1]), y2: by(0), w: 0.45 })
          for (let q = 0; q < mem.length; q++) {
            if (mem[q].t !== 's') continue
            const a = mem[q - 1]?.t === 's' ? q - 1 : -1, b = mem[q + 1]?.t === 's' ? q + 1 : -1
            if (b >= 0) sh.push({ k: 'l', x1: sxOf(mem[q]), y1: by(1), x2: sxOf(mem[b]), y2: by(1), w: 0.45 })
            else if (a < 0) { const dx = q === 0 ? 1 : -1; sh.push({ k: 'l', x1: sxOf(mem[q]), y1: by(1), x2: sxOf(mem[q]) + dx * 0.9, y2: by(1), w: 0.45 }) }
          }
          // the beam is drawn with the first member's group, which is always the first item reaching here
        }
      }
    }
    groups.push({ i: p.i, x: p.x, shapes: sh, rest: false, lh: p.voice === 1 })
    if (p.voice === 0) names.push({ k: 't', x: p.x, y: VH - 0.35, s: p.heads.map((h) => LET[spell(h.m, f, ka, leadPc).letter]).join(''), size: 1.25 })
  }
  const marks: Shape[] = (two?.marks ?? []).map((m) => ({ k: 't', x: (xOn.get(key1(m.start)) ?? headerW) + 0.2, y: 1.75, s: m.name, size: 1.7 }) as Shape)
  return { groups, bars, xs, endX: endCx, fifths: f, bpb, header, headerW, names, marks }
}
