// Fixtures for the Dancer's easter eggs (src/features/vibes/eggs.ts): every egg gets a positive in two keys, a near-miss, and a cooldown check.
// Run: npm run check:eggs
import { createRecognizer, demoFor, INFO, TUNES, type DemoNote, type EggId } from '../src/features/vibes/eggs'

let fails = 0, passes = 0
const ok = (name: string, cond: boolean, extra = '') => { if (cond) passes++; else { fails++; console.log('FAIL', name, extra) } }

/** play events through a fresh recognizer, returning every egg that fired */
function play(ev: DemoNote[], t0 = 1000, slop = 0): EggId[] {
  const r = createRecognizer(), out: EggId[] = []
  let k = 7
  for (const e of [...ev].sort((a, b) => a.t - b.t)) {
    k = (k * 37 + 11) % 101 // deterministic "human" slop
    const h = r.onset(t0 + e.t + ((k / 101) - 0.5) * 2 * slop, e.n, e.v)
    if (h) out.push(h)
  }
  return out
}
const shift = (ev: DemoNote[], by: number): DemoNote[] => ev.map((e) => ({ ...e, n: e.n + by }))
const scaleT = (ev: DemoNote[], f: number): DemoNote[] => ev.map((e) => ({ ...e, t: e.t * f, d: e.d * f }))
/** a list of [note, gapBeforeMs] */
const line = (spec: [number, number][], v = 0.65): DemoNote[] => { let t = 0; return spec.map(([n, g]) => ({ n, t: (t += g), d: 100, v })) }

// ---- every egg: fires in two keys (with +-18 ms human slop, and at a different speed), exactly once, and not when a note is changed
const nearMiss = (id: EggId, ev: DemoNote[]): DemoNote[] => {
  const e = ev.map((x) => ({ ...x }))
  switch (id) {
    case 'scales': e[4].n += 2; break // a wrong step breaks the scale pattern
    case 'surf': e[4].t += 200; e.slice(5).forEach((x) => (x.t += 200)); break // too slow to be a slide (then it is a scale... check below)
    case 'chromatic': e[3].n += 1; break
    case 'woodpecker': e[8].n += 2; e[7].n += 2; break
    case 'quake': e.pop(); e.pop(); e.forEach((x) => (x.n += 12)); break // fewer, and too high
    case 'pogo': e[3].n += 1; break
    case 'ghost': e[3].n += 1; break
    case 'crown': e[6].n += 1; e[7].n += 1; e[8].n += 1; break // IV chord wrong
    case 'dizzy': e.forEach((x) => (x.v = 0.3)); break // soft mashing
    case 'sleepy': e[1].t -= 1000; e[2].t -= 1000; break // too quick
    default: { const mid = 3; e[mid].n += 1 } // tunes: one wrong note
  }
  return e
}
for (const info of INFO) {
  const demo = demoFor(info.id)
  ok(info.id + ' has a demo', demo.length > 0)
  for (const [key, by] of [['C', 0], ['F#', 6]] as const) {
    const sh = id0(info.id) ? demo : demo
    // quake and sleepy keep their register (low cluster / soft) so shift by octaves for them
    const k2 = info.id === 'quake' ? (by ? -12 : 0) : info.id === 'pogo' || info.id === 'woodpecker' ? by : by
    const got = play(shift(sh, k2 === -12 && info.id === 'quake' ? 0 : k2), 1000, 18)
    ok(`${info.id} fires in ${key}`, got[0] === info.id, JSON.stringify(got))
    ok(`${info.id} fires once in ${key}`, got.filter((g) => g === info.id).length === 1, JSON.stringify(got))
  }
  const slow = play(scaleT(demo, info.id === 'sleepy' || info.id === 'dizzy' || info.id === 'surf' || info.id === 'woodpecker' || info.id === 'chromatic' ? 1 : 1.3), 5000, 10)
  ok(`${info.id} fires at another speed`, slow.includes(info.id), JSON.stringify(slow))
  const miss = play(nearMiss(info.id, demo))
  ok(`${info.id} near-miss does not fire`, !miss.includes(info.id), JSON.stringify(miss))
  // cooldown: playing it again right away does nothing; after the cooldown it works again
  const r = createRecognizer(); let n = 0
  const feed = (t0: number) => { for (const e of demo) if (r.onset(t0 + e.t, e.n, e.v) === info.id) n++ }
  feed(1000); const len = demo.reduce((m, x) => Math.max(m, x.t), 0)
  feed(1000 + len + 1500); ok(`${info.id} cooldown holds`, n === 1, 'n=' + n)
  feed(1000 + len + info.cd + 3000); ok(`${info.id} fires again after the cooldown`, n === 2, 'n=' + n)
}
function id0(_: string) { return false }

// ---- specific, named checks
const C = 60
const shave = (k: number, even = false) => line([[C + k, 0], [C + k - 5, 500], [C + k - 5, even ? 500 : 250], [C + k - 3, even ? 500 : 250], [C + k - 5, 500], [C + k - 1, even ? 500 : 1000], [C + k, 500]])
ok('shave: C G G A G _ B C (upper G) also fires', play(line([[60, 0], [67, 500], [67, 250], [69, 250], [67, 500], [71, 1000], [72, 500]])).includes('shave'))
ok('shave: even rhythm does not fire', !play(shave(0, true)).includes('shave'))
ok('shave: real rhythm fires', play(shave(2)).includes('shave'))
ok('birthday: second phrase fires too', play(line([[67, 0], [67, 280], [69, 380], [67, 760], [74, 760], [72, 760]])).includes('birthday'))
ok('scale: natural minor descending fires', play(line([72, 70, 68, 67, 65, 63, 62, 60].map((n, i) => [n, i ? 240 : 0] as [number, number]))).includes('scales'))
ok('scale: harmonic minor ascending fires', play(line([57, 59, 60, 62, 64, 65, 68, 69].map((n, i) => [n, i ? 220 : 0] as [number, number]))).includes('scales'))
ok('scale: 7 notes is not enough', !play(line([60, 62, 64, 65, 67, 69, 71].map((n, i) => [n, i ? 230 : 0] as [number, number]))).includes('scales'))
ok('scale: whole-tone run is not a scale', !play(line([60, 62, 64, 66, 68, 70, 72, 74].map((n, i) => [n, i ? 230 : 0] as [number, number]))).includes('scales'))
ok('scale: fast white-key slide is the surfboard, not the scale', (() => { const g = play(demoFor('surf')); return g[0] === 'surf' && !g.includes('scales') })())
ok('chords: a chord inside a melody does not break it', play(line([[64, 0], [64, 500], [65, 500], [67, 500], [67, 500], [65, 500], [64, 500], [62, 500]]).map((e, i) => (i === 3 ? { ...e, n: 67 } : e)).concat([{ n: 55, t: 1500 + 10, d: 100, v: 0.5 }])).includes('ode'))
ok('held drone under a tune is fine', (() => { const ev = demoFor('twinkle'); const r = createRecognizer(); r.onset(500, 36, 0.5); let hit = false; for (const e of ev) if (r.onset(1000 + e.t, e.n, e.v) === 'twinkle') hit = true; return hit })())
ok('crown: needs I IV V I', !play([[60, 64, 67], [60, 65, 69], [59, 62, 65], [60, 64, 67]].flatMap((c, i) => c.map((n, j) => ({ n, t: i * 900 + j * 5, d: 500, v: 0.6 })))).includes('crown'))
ok('crown: in G fires', play([[67, 71, 74], [67, 72, 76], [66, 69, 74], [67, 71, 74]].flatMap((c, i) => c.map((n, j) => ({ n, t: i * 900 + j * 5, d: 500, v: 0.6 })))).includes('crown'))
ok('sleepy: loud slow notes do not put him to sleep', !play(line([[60, 0], [64, 1700], [62, 1700]], 0.8)).includes('sleepy'))
ok('quake: four low notes but high up is not a quake', !play([60, 63, 65, 67].map((n, i) => ({ n, t: i * 4, d: 400, v: 0.9 }))).includes('quake'))
ok('woodpecker: 7 pecks is not enough', !play(line(Array.from({ length: 7 }, (_, i) => [72, i ? 100 : 0] as [number, number]))).includes('woodpecker'))
ok('woodpecker: slow repeats do not peck', !play(line(Array.from({ length: 9 }, (_, i) => [72, i ? 450 : 0] as [number, number]))).includes('woodpecker'))
ok('ghost needs a tritone, a fifth does not', !play(line([60, 67, 60, 67, 60, 67].map((n, i) => [n, i ? 400 : 0] as [number, number]))).includes('ghost'))
ok('every tune has a distinct interval signature', (() => { const s = new Set(TUNES.map((t) => t.notes.slice(1).map((n, i) => n - t.notes[i]).join(','))); return s.size === TUNES.length })())
{
  const id = INFO[0].id, demo = demoFor(id), r = createRecognizer()
  let n = 0
  const feed = (t0: number) => { for (const e of demo) if (r.onset(t0 + e.t, e.n, e.v) === id) n++ }
  feed(1000)
  const len = demo.reduce((m, x) => Math.max(m, x.t), 0)
  feed(1000 + len + 400) // still inside the cooldown: the costume has not cleared
  r.cleared()
  feed(1000 + len + 800) // costume cleared: the same tune fires again
  ok('cleared() lets the same egg fire again before its cooldown', n === 2, 'n=' + n)
}
ok('no two eggs fire from one demo', INFO.every((i) => { const g = play(demoFor(i.id)); return g.length === 1 }), INFO.filter((i) => play(demoFor(i.id)).length !== 1).map((i) => i.id + ':' + play(demoFor(i.id)).join('+')).join(' '))
ok('egg ids are unique and counted', new Set(INFO.map((i) => i.id)).size === INFO.length && INFO.length === 26)

console.log(`egg fixtures: ${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
