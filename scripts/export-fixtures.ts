// Code exporters (src/kode/export): Sonic Pi and Strudel text from loops, beats and songs.
//   npx --no-install tsx scripts/export-fixtures.ts        (exit 1 on any failure)
import { drumsToSonicPi, drumsToStrudel, layersToSonicPi, layersToStrudel, songToSonicPi, songToStrudel, strudelUrl, ampOf, SONIC_PI_SAMPLES, STRUDEL_SAMPLES } from '../src/kode/export'
import { VOICES, newPattern, parsePattern, STARTERS } from '../src/features/drumpads/drumCore'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}

// A known 2-layer, 4-beat loop at 96 bpm. Layer 2 has a chord, an off-grid time, a note at the very start.
const L1 = { notes: [{ t: 0, d: 0.5, n: 60, v: 100 }, { t: 0.5, d: 0.5, n: 64, v: 64 }, { t: 1, d: 1, n: 67, v: 127 }] }
const L2 = { notes: [{ t: 0.26, d: 1.9, n: 48, v: 1 }, { t: 2, d: 2, n: 52, v: 80 }, { t: 2, d: 2, n: 55, v: 80 }] }
const out = layersToSonicPi([L1, { notes: [] }, L2], 96, 4)
const SNAP = `# Paste into Sonic Pi and press Run. Change a number, press Run again, and hear what changed.
# Made by Koog: 2 layer(s), 4 beats long.
use_bpm 96

live_loop :layer_1 do
  play 60, amp: 0.81, release: 0.5
  sleep 0.5
  play 64, amp: 0.55, release: 0.5
  sleep 0.5
  play 67, amp: 1, release: 1
  sleep 3
end

live_loop :layer_2, sync: :layer_1 do
  sleep 0.25
  play 48, amp: 0.11, release: 1.875
  sleep 1.75
  play 52, amp: 0.67, release: 2
  play 55, amp: 0.67, release: 2
  sleep 2
end
`
eq('snapshot: 2-layer loop, exact Sonic Pi text', out + '', SNAP.replace(/\n$/, '\n') )
// total sleep per live_loop equals the loop length, play count matches
function loops(code: string) {
  return [...code.matchAll(/live_loop :(\w+)[^\n]*do\n([\s\S]*?)\nend/g)].map((m) => ({
    name: m[1], sleep: [...m[2].matchAll(/sleep ([\d.]+)/g)].reduce((a, x) => a + parseFloat(x[1]), 0), plays: [...m[2].matchAll(/play (\d+), amp: ([\d.]+)/g)].map((x) => [+x[1], +x[2]]),
  }))
}
const lp = loops(out)
eq('two live_loops (empty layer skipped)', lp.map((l) => l.name), ['layer_1', 'layer_2'])
eq('layer_1 sleeps 4 beats exactly', lp[0].sleep, 4)
eq('layer_2 sleeps 4 beats exactly', lp[1].sleep, 4)
eq('note counts match', lp.map((l) => l.plays.length), [3, 3])
eq('velocity 127 -> amp 1', lp[0].plays[2][1], 1)
eq('velocity 1 -> amp 0.11 (about 0.1)', lp[1].plays[0][1], 0.11)
eq('velocity 64 -> amp 0.55', lp[0].plays[1][1], 0.55)
eq('ampOf stays in 0.1..1', [ampOf(1) >= 0.1, ampOf(127) <= 1, ampOf(0) >= 0.1, ampOf(500) <= 1], [true, true, true, true])
eq('layer 2 waits for layer 1', /live_loop :layer_2, sync: :layer_1 do/.test(out), true)
eq('header says how to use it', out.startsWith('# Paste into Sonic Pi and press Run'), true)
// a note at the end wraps to the start; 32-beat loop pads exactly; every layer closes
const wrap = loops(layersToSonicPi([{ notes: [{ t: 7.99, d: 0.2, n: 60, v: 90 }] }], 120, 8))
eq('wrapped note: still 8 beats', wrap[0].sleep, 8)
eq('empty export has no live_loop', layersToSonicPi([], 120, 4).includes('live_loop'), false)
for (const beats of [1, 2, 4, 8, 16, 32]) {
  const notes = Array.from({ length: 13 }, (_, i) => ({ t: (i * 0.37) % beats, d: 0.3, n: 50 + i, v: 20 + i * 7 }))
  const r = loops(layersToSonicPi([{ notes }, { notes: notes.slice(0, 5) }], 100, beats))
  eq(`sleep == length at ${beats} beats`, r.map((l) => l.sleep), [beats, beats])
}

// ---- drums ----
const p = newPattern(16)
p.rows[0][0] = 1; p.rows[0][8] = 1; p.rows[1][4] = 0.5; p.rows[1][12] = 1; p.rows[2][2] = 0.7; p.acc[4] = 1
const d = drumsToSonicPi(p, 100)
const grab = (name: string) => d.match(new RegExp(`^${name} = \\(ring ([^)]*)\\)`, 'm'))?.[1].split(', ').map(Number)
eq('kick ring: hits on steps 0 and 8 at 0.8', grab('kick')?.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), [0, 8])
eq('kick amp is 0.8 (normal step)', grab('kick')?.[0], 0.8)
eq('snare accent step is louder (0.5 accent -> 0.5)', [grab('snare')?.[4], grab('snare')?.[12]], [0.5, 0.8])
eq('every ring has 16 steps', [grab('kick')?.length, grab('snare')?.length, grab('hat')?.length], [16, 16, 16])
eq('unused voices are left out', d.includes('rim = '), false)
eq('samples: kick bd_haus, snare sn_dolf, hat drum_cymbal_closed', [SONIC_PI_SAMPLES.kick, SONIC_PI_SAMPLES.snare, SONIC_PI_SAMPLES.hat], [':bd_haus', ':sn_dolf', ':drum_cymbal_closed'])
eq('live_loop uses sample + tick + 0.25 sleep', [d.includes('sample :bd_haus, amp: kick[i] if kick[i] > 0'), d.includes('i = tick'), d.includes('sleep 0.25')], [true, true, true])
eq('every voice has a sample in both tools', VOICES.every((v) => SONIC_PI_SAMPLES[v.id] && STRUDEL_SAMPLES[v.id]), true)
const ds = drumsToStrudel(p, 100)
const sRows = [...ds.matchAll(/s\("([^"]*)"\)/g)].map((m) => m[1].split(' '))
eq('strudel drums: 3 rows of 16 steps', sRows.map((r) => r.length), [16, 16, 16])
eq('strudel kick row', sRows[0].map((x, i) => (x === 'bd' ? i : -1)).filter((i) => i >= 0), [0, 8])
eq('strudel snare row uses sd', sRows[1][4], 'sd')
eq('strudel tempo: 100 bpm, one bar', ds.includes('setcpm(100/4)'), true)
const long = newPattern(32); long.rows[0][31] = 1
eq('32-step beat: 32 slots, 2 bars per cycle', [drumsToStrudel(long, 90).match(/s\("([^"]*)"\)/)![1].split(' ').length, drumsToStrudel(long, 90).includes('setcpm(90/8)'), drumsToSonicPi(long, 90).match(/\(ring ([^)]*)\)/)![1].split(', ').length], [32, true, 32])
for (const st of STARTERS) { const q = parsePattern(st.rows); eq('starter ' + st.id + ' exports', [drumsToSonicPi(q, st.bpm).includes('live_loop :drums'), /s\("/.test(drumsToStrudel(q, st.bpm))], [true, true]) }

// ---- strudel layers: balanced mini-notation, weights add to 16 per beat ----
function mini(code: string) {
  const bodies = [...code.matchAll(/(?<![.\w])(?:note|s)\("([^"]*)"\)/g)].map((m) => m[1])
  return bodies.map((b) => {
    let depth = 0, ok = true
    for (const c of b) { if (c === '[') depth++; if (c === ']') { depth--; if (depth < 0) ok = false } }
    const tokens = b.replace(/\[[^\]]*\]/g, 'X').split(' ')
    const weight = tokens.reduce((a, t) => a + (t.includes('@') ? Number(t.split('@')[1]) : 1), 0)
    return { balanced: ok && depth === 0, weight, tokens }
  })
}
const sv = layersToStrudel([L1, L2], 96, 4)
const m = mini(sv)
eq('strudel layers: balanced, 64 sixteenths each (4 beats)', m.map((x) => [x.balanced, x.weight]), [[true, 64], [true, 64]])
eq('strudel layers joined with stack, tempo set', [sv.includes('stack('), sv.includes('setcpm(96/4)')], [true, true])
eq('strudel layer 1 text', sv.includes('note("c4@2 e4@2 g4@60")'), false) // g4 lasts to loop end: 1 beat in, 3 beats left
eq('strudel layer 1 exact', sv.includes('note("c4@8 e4@8 g4@48")'), true)
eq('strudel layer 2 has a chord', sv.includes('[e3,g3]@32'), true)
eq('single layer: no stack', layersToStrudel([L1], 96, 4).includes('stack('), false)
eq('strudel empty is just a note', layersToStrudel([], 96, 4).includes('note('), false)

// ---- songs ----
const song = { title: 'Test', bpm: 100, notes: [{ note: 60, beats: 1 }, { note: null, beats: 0.5 }, { note: 62, beats: 0.5 }, { note: 64, beats: 2 }] }
const so = songToSonicPi(song)
eq('song sonic pi', so.split('\n').filter((l) => /^(play|sleep)/.test(l)), ['play 60, release: 1', 'sleep 1', 'sleep 0.5', 'play 62, release: 0.5', 'sleep 0.5', 'play 64, release: 2', 'sleep 2'])
eq('song total sleep = 4 beats', [...so.matchAll(/sleep ([\d.]+)/g)].reduce((a, x) => a + +x[1], 0), 4)
const st = songToStrudel(song)
eq('song strudel', [st.includes('note("c4@4 ~@2 d4@2 e4@8").s("piano")'), st.includes('setcpm(100/4)'), mini(st)[0].balanced], [true, true, true])

// ---- strudel url: same format as Strudel's own code2hash (encodeURIComponent(base64(utf8))) ----
const code = 'note("c4 e4 g4 ~").s("piano") // é'
const url = strudelUrl(code)
eq('url starts with strudel hash', url.startsWith('https://strudel.cc/#'), true)
eq('url round-trips', Buffer.from(decodeURIComponent(url.split('#')[1]), 'base64').toString('utf8'), code)
eq('url has no raw + / = or spaces in the hash', /[+/= ]/.test(url.split('#')[1]), false)
eq('known hash', strudelUrl('"c3 e3"'), 'https://strudel.cc/#ImMzIGUzIg%3D%3D')

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
