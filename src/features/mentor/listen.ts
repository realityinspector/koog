// The Mentor's ears. Pure, incremental rules over a bounded window of recent notes (no ML, no network, no React).
//   const L = createListener(ctx, (move) => ...)
//   L.push(note, velocity, t)   // every note-on, t in ms
//   L.advance(now)              // call a few times a second: closes chords (70 ms) and phrases (650 ms of quiet)
// Each recogniser is a short function below; moves are rate-limited per kind here, the Mentor store picks what to say.
import { findAllusion, type AllusionIndex, type Played, type Allusion } from '../../music/allusion'
import { detectChord } from '../../music/chords'
import { PC_NAMES, SCALES, pc, type Key } from '../../music/theory'
import { describe, type Desc, type MoveKind } from './lines'

export interface Ctx {
  key(): Key
  index(): AllusionIndex
  /** judge meters, when available (0..1) */
  meters?(): { rhythm: number }
}
export interface Move extends Desc { kind: MoveKind; topic: string; t: number; data: Record<string, string | number> }

const CHORD_WIN = 70, PHRASE_PAUSE = 650, CONT_GAP = 1600
const COOL: Partial<Record<MoveKind, number>> = { sequence: 5000, inversion: 8000, retrograde: 8000, motif: 8000, arpeggio: 8000, 'walking-bass': 15000, crescendo: 10000, decrescendo: 10000, range: 40000, space: 40000, modulation: 20000, 'rhythm-motif': 12000, tension: 8000, cluster: 6000, progression: 8000 }
const iv = (ns: number[]) => ns.slice(1).map((n, i) => n - ns[i])
const sgn = Math.sign
const neg = (a: number[]) => a.map((x) => -x)
const eq = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
const turns = (a: number[]) => { let t = 0; for (let i = 1; i < a.length; i++) if (a[i] && a[i - 1] && sgn(a[i]) !== sgn(a[i - 1])) t++; return t }
/** a figure worth naming: it jumps, or turns around (so a plain scale run never counts) */
const interesting = (a: number[]) => a.filter((x) => x !== 0).length >= 2 && (a.some((x) => Math.abs(x) >= 3) || turns(a) >= 1)
const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }

interface MN { note: number; t: number; vel: number }
interface Phrase { notes: number[]; times: number[]; vels: number[] }
interface Chord { rel: number; minor: boolean; t: number; root: number }

export function parseChord(name: string | null): { root: number; minor: boolean } | null {
  const m = name && /^([A-G]#?)(.*)$/.exec(name)
  if (!m) return null
  if (/dim|aug|sus/.test(m[2])) return null
  return { root: PC_NAMES.indexOf(m[1]), minor: /minor/.test(m[2]) }
}

function nameKey(notes: number[], cands: number[]): string {
  let best = '', bs = -1
  const last = notes[notes.length - 1]
  const w = (tonic: number) => notes.filter((n) => pc(n) === tonic).length * 2 + notes.filter((n) => pc(n) === (tonic + 7) % 12).length + (pc(last) === tonic ? 3 : 0)
  for (const c of cands) {
    const maj = w(c), min = w((c + 9) % 12)
    const useMin = min > maj + 2
    const sc = Math.max(maj, min)
    if (sc > bs) { bs = sc; best = useMin ? PC_NAMES[(c + 9) % 12] + ' minor' : PC_NAMES[c] + ' major' }
  }
  return best
}
const fitKeys = (notes: number[]) => {
  const out: number[] = []
  for (let t = 0; t < 12; t++) { const miss = notes.filter((n) => !SCALES.major.includes(pc(n - t))).length; if (miss === 0) out.push(t) }
  return out
}

export function createListener(ctx: Ctx, emit: (m: Move) => void) {
  let group: { t0: number; notes: number[]; vel: number } | null = null
  let mel: MN[] = []
  let phrase: Phrase = { notes: [], times: [], vels: [] }
  let phrases: Phrase[] = []
  let chords: Chord[] = []
  let lastMelT = -1e9
  let spaces: number[] = []
  let octs: { o: number; t: number }[] = []
    const lastAt: Partial<Record<string, number>> = {}
  let lastNow = 0
  let jam0 = -1

  function fire(kind: MoveKind, t: number, data: Move['data'] = {}, topicSuffix = '', cool = COOL[kind] ?? 0) {
    const key = kind + topicSuffix
    if (cool && lastAt[key] != null && t - (lastAt[key] as number) < cool) return
    lastAt[key] = t
    emit({ ...describe(kind, data), kind, topic: kind === 'quote' ? 'quote:' + topicSuffix : kind.startsWith('c-') ? 'critique:' + kind.slice(2) : 'move:' + kind, t, data })
  }

  // ---- input ----
  function push(note: number, vel: number, t: number) {
    lastNow = Math.max(lastNow, t)
    advance(t)
    if (group && t - group.t0 < CHORD_WIN) { group.notes.push(note); return }
    group = { t0: t, notes: [note], vel }
  }
  function advance(now: number) {
    lastNow = Math.max(lastNow, now)
    if (group && now - group.t0 >= CHORD_WIN) { const g = group; group = null; settle(g) }
    if (!group && phrase.notes.length && now - lastMelT > PHRASE_PAUSE) closePhrase(lastMelT)
  }
  function resolve(t: number) { fire('tension', t) }

  function settle(g: { t0: number; notes: number[]; vel: number }) {
    const ns = g.notes, pcs = new Set(ns.map(pc))
    const sorted = [...new Set(ns)].sort((a, b) => a - b)
    let close = 0
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] <= 2) close++
    if ((ns.length >= 4 && close >= 3) || ns.length >= 7) { fire('cluster', g.t0, { boom: 0 }); phrase = { notes: [], times: [], vels: [] }; return }
    if (pcs.size >= 3 && ns.length >= 3) { onChord(ns, g.t0); return }
    melody(ns[0], g.vel, g.t0)
  }

  // ---- chords and progressions ----
  function onChord(ns: number[], t: number) {
    const c = parseChord(detectChord(ns))
    if (!c) return
    const prev = chords[chords.length - 1]
    if (prev && t - prev.t > 6000) chords = []
    if (prev && prev.root === c.root && prev.minor === c.minor && t - prev.t < 6000) { prev.t = t; return }
    chords.push({ root: c.root, minor: c.minor, rel: pc(c.root - ctx.key().tonic), t })
    if (chords.length > 8) chords.shift()
    const n = chords.length
    const rel = (k: number) => chords.slice(n - k).map((x) => pc(x.root - chords[n - k].root))
    const q = (k: number) => chords.slice(n - k).map((x) => (x.minor ? 'm' : 'M')).join('')
    const r4 = n >= 4 ? rel(4).join() : '', q4 = n >= 4 ? q(4) : ''
    const r3 = n >= 3 ? rel(3).join() : '', q3 = n >= 3 ? q(3) : ''
    if (r4 === '0,7,9,5' && q4 === 'MMmM') fire('progression', t, { name: 'I–V–vi–IV', pop: 1 })
    else if (r4 === '0,5,7,0' && q4 === 'MMMM') fire('progression', t, { name: 'I–IV–V–I' })
    else if (r4 === '0,9,5,7' && q4 === 'MmMM') fire('progression', t, { name: 'I–vi–IV–V' })
    else if (r3 === '0,5,10' && q3 === 'mMM') fire('progression', t, { name: 'ii–V–I' })
  }

  // ---- melody notes ----
  function melody(note: number, vel: number, t: number) {
    const gap = t - lastMelT
    if (gap > PHRASE_PAUSE && phrase.notes.length) closePhrase(lastMelT)
    if (gap >= 800 && gap <= 4000 && phrases.length && phrases[phrases.length - 1].notes.length >= 3) {
      spaces.push(t); spaces = spaces.filter((x) => t - x < 25000)
      if (spaces.length >= 2) fire('space', t)
    }
    if (jam0 < 0 || gap > 30000) { jam0 = t; home = [] }
    lastMelT = t
    mel.push({ note, t, vel }); if (mel.length > 64) mel.shift()
    phrase.notes.push(note); phrase.times.push(t); phrase.vels.push(vel)
    octs.push({ o: Math.floor(note / 12), t }); octs = octs.filter((x) => t - x.t < 15000)
    recognise(t)
  }

  /** the newest notes with no long pause inside, newest last */
  function run(max: number): MN[] {
    let i = mel.length - 1
    while (i > 0 && mel.length - i < max && mel[i].t - mel[i - 1].t <= CONT_GAP) i--
    return mel.slice(i)
  }

  function recognise(t: number) {
    // quotation: longest window, bounded, first
    const w: Played[] = run(8)
    if (w.length >= 4) {
      const a = findAllusion(w, ctx.index())
      if (a) quote(a, t)
    }
    const r = run(16), ns = r.map((x) => x.note), n = ns.length
    relations(ns, n, t)
    arpeggio(r, t); walking(r, t); dynamics(r, t); rhythmMotif(r, ns, t)
    range(t); modulation(t)
  }

  function quote(a: Allusion, t: number) {
    if (a.source.kind === 'phrase') {
      // your own learned phrase: only worth saying when it is moved or placed inside new material
      fire('quote', t, { title: a.source.title, key: a.keyName ?? '', learned: 1, n: a.length, miss: a.mismatches }, a.source.id, 25000)
    } else fire('quote', t, { title: a.source.title, key: a.keyName ?? '', learned: 0, n: a.length, miss: a.mismatches }, a.source.id, 25000)
  }

  // sequence / inversion / retrograde / exact motif: compare the newest figure with an earlier one in the same run
  function relations(ns: number[], n: number, t: number) {
    for (const k of [3, 2]) {
      if (n < 2 * k + 1) continue
      const lat = ns.slice(n - k - 1), iv2 = iv(lat)
      if (!interesting(iv2) || (k === 2 && !(iv2.some((x) => Math.abs(x) >= 3) && turns(iv2) >= 1))) continue
      for (let i = n - k - 2; i >= 0; i--) {
        if (i + k > n - k - 1) continue
        const iv1 = iv(ns.slice(i, i + k + 1))
        if (eq(iv1, iv2)) {
          const d = ns[n - k - 1] - ns[i]
          if (d === 0) fire('motif', t)
          else if (Math.abs(d) <= 5) fire('sequence', t, { dir: d > 0 ? 'up' : 'down', by: Math.abs(d) })
          else fire('motif', t)
          return
        }
        if (eq(iv2, neg(iv1))) { fire('inversion', t); return }
        if (eq(iv2, neg(iv1).reverse())) { fire('retrograde', t); return }
      }
    }
  }

  function arpeggio(r: MN[], t: number) {
    if (r.length < 4) return
    const l = r.slice(-4), ns = l.map((x) => x.note), d = iv(ns)
    if (l[3].t - l[0].t > 2400 || !d.every((x) => Math.abs(x) >= 3 && Math.abs(x) <= 9) || !d.every((x) => sgn(x) === sgn(d[0]))) return
    const ch = detectChord(ns)
    if (ch) fire('arpeggio', t, { chord: ch })
  }
  function walking(r: MN[], t: number) {
    if (r.length < 4) return
    const l = r.slice(-4)
    if (l.some((x) => x.note > 55)) return
    const gaps = l.slice(1).map((x, i) => x.t - l[i].t), d = iv(l.map((x) => x.note))
    if (Math.min(...gaps) < 250 || Math.max(...gaps) > 900 || Math.max(...gaps) / Math.min(...gaps) > 1.4) return
    if (d.some((x) => x === 0 || Math.abs(x) > 5)) return
    fire('walking-bass', t)
  }
  function dynamics(r: MN[], t: number) {
    if (r.length < 5) return
    const v = r.slice(-5).map((x) => x.vel), up = v.slice(3).reduce((a, b) => a + b) / 2 - v.slice(0, 2).reduce((a, b) => a + b) / 2
    const mono = v.every((x, i) => i === 0 || x >= v[i - 1] - 4), mono2 = v.every((x, i) => i === 0 || x <= v[i - 1] + 4)
    if (up >= 25 && mono) fire('crescendo', t)
    else if (up <= -25 && mono2) fire('decrescendo', t)
  }
  function rhythmMotif(r: MN[], ns: number[], t: number) {
    const n = r.length
    if (n < 8) return
    const tm = r.map((x) => x.t), ioi = (a: number) => [tm[a + 1] - tm[a], tm[a + 2] - tm[a + 1], tm[a + 3] - tm[a + 2]]
    const cur = ioi(n - 4), rr = (x: number[]) => x.map((y) => Math.log2(y / x[0]))
    const rc = rr(cur)
    if (Math.max(...rc.map(Math.abs)) < 0.5) return // all even: not a rhythm worth naming
    for (let a = n - 8; a >= 0; a--) {
      const ra = rr(ioi(a))
      if (ra.every((x, i) => Math.abs(x - rc[i]) < 0.25) && !eq(iv(ns.slice(a, a + 4)), iv(ns.slice(n - 4)))) { fire('rhythm-motif', t); return }
    }
  }
  function range(t: number) {
    const os = octs.map((x) => x.o)
    if (new Set(os).size >= 3 && Math.max(...os) - Math.min(...os) >= 2) fire('range', t)
  }
  // The home key set narrows as notes arrive (it keeps only major keys that every recent window fits). When the newest 8 notes
  // fit a different, well-pinned key and none of the old ones, three notes in a row, that is a modulation.
  let home: number[] = [], homeNotes: number[] = [], modCand = { to: '', n: 0 }
  function modulation(t: number) {
    const n = mel.length
    if (n < 8) return
    const rec = mel.slice(n - 8).map((x) => x.note), W = fitKeys(rec)
    if (!W.length) return
    if (!home.length) { if (W.length <= 4) { home = W; homeNotes = rec } return }
    const both = home.filter((k) => W.includes(k))
    if (both.length) { home = both; homeNotes = rec; modCand = { to: '', n: 0 }; return }
    if (W.length > 3) return
    const id = W.join()
    modCand = id === modCand.to ? { to: id, n: modCand.n + 1 } : { to: id, n: 1 }
    if (modCand.n < 3) return
    const to = nameKey(mel.slice(-14).map((x) => x.note), W)
    fire('modulation', t, { from: nameKey(homeNotes, home), to })
    home = W; homeNotes = rec; modCand = { to: '', n: 0 }
  }

  // ---- phrase level ----
  function closePhrase(tEnd: number) {
    const p = phrase
    phrase = { notes: [], times: [], vels: [] }
    if (p.notes.length < 2) return
    const prev = phrases[phrases.length - 1]
    phrases.push(p); if (phrases.length > 12) phrases.shift()
    const key = ctx.key(), tonic = key.tonic, home = PC_NAMES[tonic]
    const keyN = home + (key.scale === 'minor' ? ' minor' : ' major')
    const n = p.notes.length, last = p.notes[n - 1], relLast = pc(last - tonic), relPrev = n > 1 ? pc(p.notes[n - 2] - tonic) : -1
    const t = tEnd
    let praised = false

    // cadences: chords first (V->I, V->vi, ends on V), else the melody's last two notes
    const cs = chords.filter((c) => c.t >= p.times[0] - 2500 && c.t <= tEnd + 500)
    let cad: MoveKind | null = null
    if (cs.length >= 2) {
      const a = cs[cs.length - 2], b = cs[cs.length - 1]
      if (a.rel === 7 && b.rel === 0) cad = 'cadence-authentic'
      else if (a.rel === 7 && b.rel === 9) cad = 'cadence-deceptive'
    } else if (cs.length === 1 && cs[0].rel === 7) cad = 'cadence-half'
    if (!cad && n >= 4) {
      if (relLast === 0 && (relPrev === 11 || relPrev === 2)) cad = 'cadence-authentic'
      else if (relLast === 7 && n >= 5 && (relPrev === 5 || relPrev === 9 || relPrev === 4)) cad = 'cadence-half'
      else if (relLast === 0) cad = 'cadence'
    }
    if (cad) { fire(cad, t, { home, key: keyN }); praised = true }

    // repetition / variation / call and response against the previous phrase
    if (prev && prev.notes.length >= 3 && n >= 3 && p.times[0] - prev.times[prev.times.length - 1] <= 4000) {
      const i1 = iv(prev.notes), i2 = iv(p.notes), m = Math.min(i1.length, i2.length)
      let same = 0
      for (let i = 0; i < m; i++) if (sgn(i1[i]) === sgn(i2[i])) same++
      const sim = m ? same / m : 0
      const exact = eq(i1, i2)
      const prevEnd = pc(prev.notes[prev.notes.length - 1] - tonic)
      if (exact) {
        const d = p.notes[0] - prev.notes[0]
        if (d !== 0 && Math.abs(d) <= 5) fire('sequence', t, { dir: d > 0 ? 'up' : 'down', by: Math.abs(d) })
        else fire('repetition', t)
        praised = true
      } else if (sim >= 0.6 && relLast === 0 && prevEnd !== 0) { fire('call-response', t); praised = true }
      else if (sim >= 0.6 && Math.abs(i1.length - i2.length) <= 1) { fire('variation', t); praised = true }
    }

    // call-back to an idea from an earlier part of the jam (older than the last two phrases)
    if (n >= 5 && phrases.length >= 4) {
      const grams = new Map<string, number>()
      for (let i = 0; i + 4 <= n; i++) { const g = iv(p.notes.slice(i, i + 4)); if (interesting(g)) grams.set(g.join(), i) }
      outer: for (let j = 0; j < phrases.length - 2; j++) {
        const o = phrases[j]
        if (p.times[0] - o.times[o.times.length - 1] < 8000) continue
        for (let i = 0; i + 4 <= o.notes.length; i++) if (grams.has(iv(o.notes.slice(i, i + 4)).join())) { fire('callback', t, { ago: mmss(o.times[i] - jam0) }); praised = true; break outer }
      }
    }
    if (n >= 12) { fire('flow', t, {}, '', 30000); praised = true }

    // kind critiques (only when something is actually improvable; the Mentor decides how often to say them)
    if (n >= 5 && !praised && relLast !== 0 && relLast !== 7) fire('c-nohome', t, { home }, '', 30000)
    if (n >= 7) {
      const io = p.times.slice(1).map((x, i) => x - p.times[i]), a = io.slice(0, 3), b = io.slice(-3)
      const avg = (x: number[]) => x.reduce((q, w) => q + w, 0) / x.length
      if (avg(b) < avg(a) * 0.72) fire('c-rushing', t, {}, '', 40000)
      else if (ctx.meters && ctx.meters().rhythm < 0.45) fire('c-wobbly', t, {}, '', 40000)
    }
    if (n >= 6) {
      const out = p.notes.filter((x) => !SCALES[key.scale].includes(pc(x - tonic))).length
      if (out / n >= 0.4) fire('c-wandering', t, { key: keyN }, '', 40000)
      if (new Set(p.notes).size <= 2) fire('c-stuck', t, {}, '', 40000)
    }
  }

  return { push, advance, resolve, reset() { mel = []; phrases = []; chords = []; group = null; phrase = { notes: [], times: [], vels: [] }; spaces = []; octs = []; home = []; homeNotes = []; for (const k in lastAt) delete lastAt[k] } }
}
export type Listener = ReturnType<typeof createListener>
