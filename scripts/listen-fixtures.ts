// Golden-output harness for the listening core. Replays note sequences from scripts/fixtures/*.json through the
// current analysis functions and compares with scripts/fixtures/golden/golden.json.
//   npx --no-install tsx scripts/listen-fixtures.ts            compare (exit 1 on any difference)
//   npx --no-install tsx scripts/listen-fixtures.ts --freeze   (re)write the baseline
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size }, clear: () => m.clear() } }
const g = globalThis as Record<string, unknown>
g.localStorage ??= mem(); g.sessionStorage ??= mem()
const noop = () => {}
g.window ??= { addEventListener: noop, removeEventListener: noop, localStorage: g.localStorage, sessionStorage: g.sessionStorage }
g.document ??= { addEventListener: noop, removeEventListener: noop, hidden: false }

const here = path.dirname(fileURLToPath(import.meta.url))
const FIX = path.join(here, 'fixtures')
const GOLDEN = path.join(FIX, 'golden', 'golden.json')
interface Fx { name: string; bpm: number; notes: { note: number; t: number; vel: number }[]; chords?: number[][] }

const round = (x: number) => Math.round(x * 1e6) / 1e6
const norm = (v: unknown): unknown => typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)])) : v

async function compute() {
  const theory = await import('../src/music/theory')
  const chords = await import('../src/music/chords')
  const harm = await import('../src/features/smartband/harmonizer')
  const judge = await import('../src/music/judge')
  const allusion = await import('../src/music/allusion')
  const vibes = await import('../src/music/vibesCore')
  const pe = await import('../src/music/phraseEngine')
  const songs = await import('../src/features/songs/songs')

  const fixtures: Fx[] = fs.readdirSync(FIX).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')))
  const out: Record<string, unknown> = {}

  // key + keys' candidate chords for all 12 x scales
  const cands: Record<string, unknown> = {}
  for (let t = 0; t < 12; t++) for (const scale of ['major', 'minor', 'blues', 'majorPentatonic'] as const) cands[`${t}-${scale}`] = harm.candidateChords({ tonic: t, scale })
  out.candidateChords = cands

  const index = allusion.buildIndex(allusion.songSources())
  out.fixtures = {}
  for (const fx of fixtures) {
    const ns = fx.notes.map((n) => n.note)
    const r: Record<string, unknown> = {}
    r.key = theory.detectKey(ns)
    r.keyWeighted = theory.detectKey(ns, fx.notes.map((_, i) => 1 + (i % 3)))
    // sliding key + pickChord (96 bpm grid, downbeat every 4th note)
    const key = r.key as ReturnType<typeof theory.detectKey>
    let cur: ReturnType<typeof harm.pickChord> | null = null
    const picks: string[] = []
    fx.notes.forEach((n, i) => {
      const win = fx.notes.slice(0, i + 1).map((m) => ({ note: m.note, ageBeats: (n.t - m.t) / (60000 / fx.bpm) }))
      cur = harm.pickChord(harm.weighMelody(win), key.key, cur, i % 4 === 0)
      picks.push((cur as { name: string }).name)
    })
    r.pickChord = picks
    // estimateBpm progressive
    const bpms: number[] = []; let prev = harm.DEFAULT_BPM
    fx.notes.forEach((_, i) => { prev = harm.estimateBpm(fx.notes.slice(0, i + 1).map((m) => m.t), prev); bpms.push(prev) })
    r.estimateBpm = bpms
    // rhythmScore on consecutive IOIs
    const iois = fx.notes.slice(1).map((n, i) => n.t - fx.notes[i].t)
    r.rhythmScore = iois.slice(1).map((x, i) => judge.rhythmScore(x, iois[i]))
    r.isClusterWindows = fx.notes.map((_, i) => judge.isCluster(ns.slice(Math.max(0, i - 6), i + 1)))
    // allusion sliding
    r.allusion = fx.notes.map((_, i) => {
      const a = allusion.findAllusion(fx.notes.slice(0, i + 1).map((m) => ({ note: m.note, t: m.t })), index)
      return a && { id: a.source.id, length: a.length, shift: a.shift, keyName: a.keyName, start: a.start, mismatches: a.mismatches, rhythm: a.rhythm, bits: a.bits, score: a.score }
    })
    if (fx.chords) {
      r.detectChord = fx.chords.map((c) => chords.detectChord(c))
      r.isClusterChords = fx.chords.map((c) => judge.isCluster(c))
      r.classifyChord = fx.chords.map((c) => vibes.classifyChord(c))
      r.mood = fx.chords.map((c) => {
        const core = new vibes.VibeCore()
        c.forEach((n) => core.noteOn(n, 90, 0))
        let s = core.update(100)
        for (let t = 200; t <= 3000; t += 100) s = core.update(t)
        return { mood: s.mood, valence: s.valence, arousal: s.arousal, intensity: s.intensity, chord: s.chord }
      })
    }
    ;(out.fixtures as Record<string, unknown>)[fx.name] = r
  }

  // phrase segmentation of real songs
  const seg: Record<string, unknown> = {}
  for (const s of songs.SONGS.slice(0, 40)) for (const size of [1, 2, 3, 4] as const) {
    try { seg[`${s.id}/${size}`] = pe.segment(s.id, s.notes, size, s.beatsPerBar).map((p) => ({ id: p.id, from: (p as unknown as { from?: number }).from, n: p.notes?.length, size: p.size })) }
    catch (e) { seg[`${s.id}/${size}`] = 'ERR ' + (e as Error).message }
  }
  out.segment = seg
  return norm(out) as Record<string, unknown>
}

function diff(a: unknown, b: unknown, p = '', acc: string[] = []) {
  if (acc.length > 20) return acc
  if (JSON.stringify(a) === JSON.stringify(b)) return acc
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff((a as never)[k], (b as never)[k], p + '/' + k, acc)
  } else acc.push(`${p}: golden=${JSON.stringify(a)} now=${JSON.stringify(b)}`)
  return acc
}

const now = await compute()
const text = JSON.stringify(now, null, 1)
if (process.argv.includes('--freeze')) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true }); fs.writeFileSync(GOLDEN, text + '\n')
  console.log('froze baseline:', GOLDEN, `(${text.length} bytes)`)
} else {
  if (!fs.existsSync(GOLDEN)) { console.error('no baseline; run with --freeze'); process.exit(1) }
  const d = diff(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')), JSON.parse(text))
  if (d.length) { console.error('MISMATCH\n' + d.join('\n')); process.exit(1) }
  console.log('listen fixtures: all outputs match the baseline')
}
process.exit(0)
