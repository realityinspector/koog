// Koogalien playback checks with a fake SoundPort/ModPort/clock: exact beats, cap on velocity and polyphony, patch applied and restored,
// wobble applied and released on the right beats, lift on '?', onWord order, nothing after stop().
//   npx --no-install tsx scripts/koogalien-play-fixtures.ts        (exit 1 on any failure)
import { playScore, VEL_CAP, MAX_POLY, LEAD_BEATS } from '../src/features/koogalien/play/playScore'
import { modFromMidi, emitMod, startModInput } from '../src/features/koogalien/play/modInput'
import type { Score } from '../src/koogalien/data/types'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, c: boolean, info = '') => eq(name + (c ? '' : ' ' + info), c, true)

function rig(nowBeat = 4) {
  const log: any[] = []
  let ms = 1000
  const host = {
    now: () => ms,
    sound: { bpm: () => 100, nowBeat: () => nowBeat, note: (m: number, v: number, w: number, d: number) => log.push(['note', m, v, w, d]), drum: () => {}, stopAll: () => log.push(['stop']) },
    mods: { apply: (m: any, w: number) => log.push(['apply', m.name, m.depth, w]), release: (m: any, w: number) => log.push(['release', m.name, w]), patch: (a: string | null) => log.push(['patch', a]) },
  }
  return { log, host, advance: (d: number) => { ms += d }, set: (t: number) => { ms = t } }
}
const hello: Score = { v: 1, bpm: 100, beats: 4, wordStarts: [0, 2], mods: [], chords: [
  { word: 0, degrees: [1, 6], midi: [60, 69], at: 0, dur: 1, vel: 0.95 },
  { word: 1, degrees: [1, 5, 8], midi: [60, 67, 72], at: 2, dur: 1, vel: 0.5 }] }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // exact beats + velocity cap
  {
    const r = rig(4)
    const h = playScore(hello, r.host as any, { alien: 'pip' })
    const notes = r.log.filter((l) => l[0] === 'note')
    eq('five notes', notes.length, 5)
    eq('beats = nowBeat + lead + at', notes.map((n) => +(n[3] - 4 - LEAD_BEATS).toFixed(6)), [0, 0, 2, 2, 2])
    ok('velocity <= cap', notes.every((n) => n[2] <= VEL_CAP), JSON.stringify(notes.map((n) => n[2])))
    eq('velocity capped exactly', notes[0][2], VEL_CAP)
    eq('patch applied first', r.log[0], ['patch', 'pip'])
    ok('no restore yet', !r.log.some((l) => l[0] === 'patch' && l[1] === null))
    h.stop()
    eq('stopAll called', r.log.filter((l) => l[0] === 'stop').length, 1)
    eq('patch restored on stop', r.log[r.log.length - 1], ['patch', null])
    h.stop()
    eq('stop idempotent', r.log.filter((l) => l[0] === 'stop').length, 1)
    await h.done
    ok('done resolves after stop', true)
  }
  // natural end restores patch; onWord order
  {
    const r = rig(0)
    const words: number[] = []
    const h = playScore(hello, r.host as any, { alien: 'zee', onWord: (i) => words.push(i), lookaheadMs: 0 })
    eq('nothing before its time', words, [])
    r.advance(100)
    await sleep(60)
    eq('word 0 at start', words, [0])
    r.advance(60000 / 100 * 2.1 + 100)
    await sleep(60)
    eq('word 1 after two beats', words, [0, 1])
    r.advance(60000)
    await h.done
    eq('patch restored at the end', r.log[r.log.length - 1], ['patch', null])
    eq('no stopAll on natural end', r.log.filter((l) => l[0] === 'stop').length, 0)
  }
  // polyphony cap
  {
    const r = rig(0)
    const big: Score = { v: 1, bpm: 100, beats: 2, wordStarts: [0], mods: [], chords: [
      { word: 0, degrees: [1, 2, 3, 4], midi: [60, 62, 64, 65], at: 0, dur: 2, vel: 0.5 },
      { word: 0, degrees: [5, 6, 7, 8], midi: [67, 69, 71, 72], at: 0, dur: 2, vel: 0.5 }] }
    const h = playScore(big, r.host as any)
    eq('polyphony capped', r.log.filter((l) => l[0] === 'note').length, MAX_POLY)
    h.stop()
  }
  // wobble span
  {
    const r = rig(2)
    const sc: Score = { ...hello, mods: [{ word: 1, mod: { name: 'wobble', depth: 0.9 }, at: 2, dur: 1 }] }
    const h = playScore(sc, r.host as any)
    const a = r.log.find((l) => l[0] === 'apply'), re = r.log.find((l) => l[0] === 'release')
    eq('wobble applied at beat', a && +(a[3] - 2 - LEAD_BEATS).toFixed(6), 2)
    eq('wobble released at beat', re && +(re[2] - 2 - LEAD_BEATS).toFixed(6), 3)
    ok('wobble depth capped at 0.6', a[2] <= 0.6)
    h.stop()
    ok('stop releases pending mods', r.log.filter((l) => l[0] === 'release').length >= 2)
  }
  // '?' lift
  {
    const r = rig(0)
    const q: Score = { ...hello, liftAt: 2 }
    const h = playScore(q, r.host as any)
    eq('only last word lifts a whole step', r.log.filter((l) => l[0] === 'note').map((n) => n[1]), [60, 69, 62, 69, 74])
    h.stop()
  }
  {
    const r = rig(0)
    const h = playScore({ ...hello, liftAt: 2, liftApplied: true } as Score, r.host as any)
    eq('no second lift when encode already lifted', r.log.filter((l) => l[0] === 'note').map((n) => n[1]), [60, 69, 60, 67, 72])
    h.stop()
  }
  // nothing after stop
  {
    const r = rig(0)
    const words: number[] = []
    const h = playScore(hello, r.host as any, { onWord: (i) => words.push(i), lookaheadMs: 0 })
    h.stop()
    const n = r.log.length
    r.advance(20000)
    await sleep(80)
    eq('no calls after stop', r.log.length, n)
    ok('no onWord after stop beyond the first', words.length <= 1)
  }
  // empty score ends
  {
    const r = rig(0)
    const h = playScore({ v: 1, bpm: 100, beats: 0, chords: [], mods: [], wordStarts: [] }, r.host as any)
    r.advance(100)
    await h.done
    ok('empty score resolves', true)
  }
  // modInput
  {
    eq('CC1', modFromMidi([0xb0, 1, 127], 5), { kind: 'wheel', value: 1, t: 5 })
    eq('CC1 mid', modFromMidi([0xb3, 1, 0], 5)!.value, 0)
    eq('other CC ignored', modFromMidi([0xb0, 7, 100]), null)
    eq('bend centre', modFromMidi([0xe0, 0, 64], 1)!.value, 0)
    eq('bend up', modFromMidi([0xe0, 127, 127], 1)!.value > 0.99, true)
    eq('bend down', modFromMidi([0xe0, 0, 0], 1)!.value, -1)
    eq('note ignored', modFromMidi([0x90, 60, 100]), null)
    eq('short ignored', modFromMidi([0xb0, 1]), null)
    const got: any[] = []
    let stop: () => void
    try { stop = startModInput((s) => got.push(s)) } catch { stop = () => {} }
    emitMod({ kind: 'slider', value: 2, t: 1 })
    emitMod({ kind: 'slider', value: -3, t: 2 })
    emitMod({ kind: 'bend', value: -9, t: 3 })
    eq('emitMod clamps', got.map((g) => g.value), [1, 0, -1])
    stop()
    emitMod({ kind: 'slider', value: 0.5, t: 4 })
    eq('stop unsubscribes', got.length, 3)
  }
  console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `PASS ${passes} checks`)
  process.exit(fails ? 1 : 0)
}
main()
