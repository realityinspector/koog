// Koding Kore checks: motif functions (trim/quantise, call signs, arguments, recursion), concept record, registry validation, define/call/delete/undo/persist.
//   npx --no-install tsx scripts/kore-fixtures.ts        (exit 1 on any failure)
import { CallDetector, HOLD_MS, MAX_DEPTH, ROUND_EXAMPLE, callSignOf, nextBeatOf, planCall, trimQuantise, type Motif } from '../src/kode/kore/motifCore'
import { bump } from '../src/kode/kore/concepts'
import { CONCEPT_IDS, validateApp } from '../src/kode/kore/registry'
import { setKV } from '../src/kode/kore/kv'
import type { KodeApp } from '../src/kode/kore/types'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)

// ---- trim + quantise (100 bpm: 600 ms per beat)
{
  const taps = [60, 64, 67].map((p, i) => ({ pitch: p, t: 5000 + i * 610 + (i === 2 ? 30 : 0), vel: 0.8 }))
  const r = trimQuantise(taps, 100)!
  eq('leading silence trimmed: first note at beat 0', r.notes[0].beat, 0)
  eq('lightly quantised to the grid', r.notes.map((n) => n.beat), [0, 1, 2])
  ok('last note is short, no trailing silence', r.notes[2].beats <= 0.5)
  eq('off-grid feel is kept', trimQuantise([{ pitch: 60, t: 0, vel: 1 }, { pitch: 62, t: 0.62 * 600, vel: 1 }], 100)!.notes[1].beat, 0.6)
  eq('empty taps', trimQuantise([], 100), null)
  eq('pad taps make a lane motif', trimQuantise([{ lane: 2, t: 0, vel: 1 }], 100)!.kind, 'lane')
}

// ---- call sign + detection in two keys
const notes = [60, 64, 67].map((v, i) => ({ v, beat: i, beats: 0.9, vel: 0.8 }))
const sign = callSignOf('pitch', notes)!
eq('call sign = first note + interval', [sign.a, sign.interval], [60, 4])
const M: Motif = { id: 'm1', name: 'Buzz', emoji: '🐝', kind: 'pitch', notes, sign, transpose: 0, speed: 1, created: 1 }
const mk = (pedal = false) => new CallDetector(() => [M], () => pedal)
{
  const d = mk()
  d.on({ src: 'keys', pitch: 60, vel: 0.7, t: 1000 })
  eq('no call after one note', d.on({ src: 'keys', pitch: 64, vel: 0.7, t: 1200 }), null)
  eq('no call before the hold', d.tick(1200 + HOLD_MS - 10), null)
  const c = d.tick(1200 + HOLD_MS)!
  eq('held second note runs the motif', c?.motif.id, 'm1')
  eq('same key = no transpose', c.transpose, 0)
  eq('fires once', d.tick(5000), null)
}
{
  const d = mk()
  d.on({ src: 'keys', pitch: 63, vel: 0.7, t: 0 }); d.on({ src: 'keys', pitch: 67, vel: 0.7, t: 100 })
  eq('three semitones higher = +3', d.tick(100 + HOLD_MS)?.transpose, 3)
  const e = mk(); e.on({ src: 'keys', pitch: 54, vel: 0.7, t: 0 }); e.on({ src: 'keys', pitch: 58, vel: 0.7, t: 100 })
  eq('lower sign = -6', e.tick(1000)?.transpose, -6)
  const f = mk(); f.on({ src: 'keys', pitch: 60, vel: 0.7, t: 0 }); f.on({ src: 'keys', pitch: 64, vel: 0.7, t: 100 })
  eq('a quick tap does not call', f.off({ pitch: 64, t: 200 }), null)
  const g = mk(); g.on({ src: 'keys', pitch: 60, vel: 0.7, t: 0 }); g.on({ src: 'keys', pitch: 65, vel: 0.7, t: 100 })
  eq('different interval does not call', g.tick(2000), null)
  const h = mk(); h.on({ src: 'keys', pitch: 60, vel: 0.7, t: 0 }); h.on({ src: 'keys', pitch: 64, vel: 0.7, t: 2500 })
  eq('too slow between notes does not call', h.tick(5000), null)
  const p = mk(true); p.on({ src: 'keys', pitch: 60, vel: 0.9, t: 0 }); p.on({ src: 'keys', pitch: 64, vel: 0.9, t: 100 })
  const pc = p.tick(1000)!
  eq('pedal held while calling = x2', pc.speed, 2)
  eq('velocity carried', pc.vel, 0.9)
}
{
  const L: Motif = { ...M, id: 'l1', kind: 'lane', notes: [{ v: 0, beat: 0, beats: 0.5, vel: 1 }], sign: { kind: 'lane', a: 0, interval: 0, lane: 3 } }
  const d = new CallDetector(() => [L])
  eq('one pad hit is just drumming', d.on({ src: 'drums', lane: 3, vel: 1, t: 0 }), null)
  eq('pad hit twice calls', d.on({ src: 'drums', lane: 3, vel: 1, t: 300 })?.motif.id, 'l1')
  eq('other pad does not', d.on({ src: 'drums', lane: 4, vel: 1, t: 400 }), null)
}

// ---- arguments: transpose, speed, loudness; on the beat
eq('next beat of 3.4', nextBeatOf(3.4), 4)
eq('next beat of exact 4', nextBeatOf(4), 5)
{
  const c = planCall(M, { transpose: 3, startBeat: 8 })
  eq('transposed +3', c.events.map((e) => e.value), [63, 67, 70])
  eq('on the beat, one beat apart', c.events.map((e) => e.beat), [8, 9, 10])
  const f = planCall(M, { speed: 2, startBeat: 8 })
  eq('speed x2 halves the gaps', f.events.map((e) => e.beat), [8, 8.5, 9])
  const loud = planCall(M, { vel: 0.9, startBeat: 0 }).events[0].vel, soft = planCall(M, { vel: 0.2, startBeat: 0 }).events[0].vel
  ok('velocity scales loudness', loud > soft, `${loud} ${soft}`)
  eq('transpose is capped at 24', planCall(M, { transpose: 99, startBeat: 0 }).transpose, 24)
  eq('pad motifs ignore transpose', planCall({ ...M, kind: 'lane', notes: [{ v: 2, beat: 0, beats: 1, vel: 1 }] }, { transpose: 5, startBeat: 0 }).events[0].value, 2)
}
// ---- recursion
{
  const c = planCall(ROUND_EXAMPLE, { startBeat: 0 })
  eq('round: 4 levels', Math.max(...c.events.map((e) => e.depth)) + 1, MAX_DEPTH)
  eq('round: each level 2 beats later', c.events.filter((e) => e.depth === 1)[0].beat, 2)
  ok('round: later levels softer', c.events[c.events.length - 1].vel < c.events[0].vel)
  const wild = planCall({ ...ROUND_EXAMPLE, recurse: { delay: 1, times: 99, shift: 0 } }, { startBeat: 0 })
  eq('depth is capped even if asked for 99', Math.max(...wild.events.map((e) => e.depth)) + 1, MAX_DEPTH)
}

// ---- concept record
{
  const d1 = new Date('2026-11-01T10:00:00Z'), d2 = new Date('2026-11-03T10:00:00Z')
  const a = bump({}, 'function', d1), b = bump(a.rec, 'function', d2)
  eq('first use', [a.first, a.count], [true, 1])
  eq('second use keeps first date, counts', [b.first, b.count, b.rec.function], [false, 2, { first: '2026-11-01', count: 2 }])
}

// ---- registry validation
{
  const base: KodeApp = { id: 'x-app', name: 'X', icon: '🎵', tagline: 't', concepts: ['loop'], inputs: ['keys'], ages: [6, 12], minutes: 5, route: '#/apps/x-app', status: 'beta' }
  eq('valid app', validateApp(base, () => false), [])
  ok('duplicate id rejected', validateApp(base, () => true).some((p) => p.includes('duplicate')))
  ok('bad concept rejected', validateApp({ ...base, concepts: ['nope' as never] }, () => false).length > 0)
  ok('needs a route or component', validateApp({ ...base, route: '' }, () => false).length > 0)
  eq('component alone is fine', validateApp({ ...base, route: '', component: async () => ({ default: () => null }) }, () => false), [])
  eq('11 concepts', CONCEPT_IDS.length, 11)
}

// ---- store: define from injected notes, call at +3, delete + undo, persistence after reload (memory profile)
const mem = new Map<string, string>()
setKV({ load: <T,>(k: string, f: T) => (mem.has(k) ? (JSON.parse(mem.get(k)!) as T) : f), save: (k, v) => { mem.set(k, JSON.stringify(v)) } })
const S = await import('../src/kode/kore/motifs')
{
  const sched: { value: number; beat: number }[][] = []
  S.setMotifRuntime({ beat: () => 7.3, bpm: () => 100, sink: (e) => sched.push(e.map((x) => ({ value: x.value, beat: x.beat }))) })
  const m = S.defineMotif([60, 64, 67].map((p, i) => ({ pitch: p, t: 9000 + i * 600, vel: 0.8 })), { name: 'Buzz', emoji: '🐝' })!
  eq('defined', [m.name, m.emoji, m.notes.length], ['Buzz', '🐝', 3])
  const d = new CallDetector(S.userMotifs)
  d.on({ src: 'keys', pitch: 63, vel: 0.8, t: 0 }); d.on({ src: 'keys', pitch: 67, vel: 0.8, t: 100 })
  const hit = d.tick(100 + HOLD_MS)!
  S.callDetected(hit)
  eq('scheduled notes transposed +3 and on the beat (next beat after 7.3 = 8)', sched[0], [{ value: 63, beat: 8 }, { value: 67, beat: 9 }, { value: 70, beat: 10 }])
  eq('resolveMotif for Koog Kode: buzz +2', S.resolveMotif('Buzz', 2)!.notes.map((n) => n.note), [62, 66, 69])
  eq('resolveMotif unknown', S.resolveMotif('nope'), null)
  eq('resolveMotif ignores case/emoji', S.resolveMotif('🐝 BUZZ')?.name, 'Buzz')
  eq('use-in-kode line', S.kodeLine(m), 'play buzz +0')
  eq('duplicate name is made unique', S.saveMotif('pitch', m.notes, { name: 'buzz' })!.name, 'buzz2')
  S.removeMotif(S.userMotifs()[1].id)
  eq('deleted', S.userMotifs().length, 1)
  ok('undo brings it back', S.undoRemove() != null && S.userMotifs().length === 2)
  S.updateMotif(m.id, { name: 'Zoom', transpose: 2, speed: 2 })
  S.reloadMotifs()
  const back = S.userMotifs().find((x) => x.id === m.id)!
  eq('persisted after reload', [back.name, back.transpose, back.speed, S.userMotifs().length], ['Zoom', 2, 2, 2])
  eq('example round resolves', S.resolveMotif('round')?.notes.length, 4)
}
console.log(`kore: ${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
