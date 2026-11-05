// Game pads rules: the scale map in 3 keys, the follow-the-game remap (and that it holds still within a phrase), the octave jog, labels, LED rate limit.
// Pure functions only (src/features/padplay/padCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/padplay-fixtures.ts        (exit 1 on any failure)
import { LED_MIN_GAP_MS, N_PADS, baseOf, clampOct, followLayout, gateLeds, octaveJog, padLabelMap, padLabels, scaleNotes, targetPads, windowLayout } from '../src/features/padplay/padCore'
import { SCALES } from '../src/music/listen/pitch'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const C = { tonic: 0, scale: 'major' as const }, G = { tonic: 7, scale: 'major' as const }, Am = { tonic: 9, scale: 'minor' as const }

// ---- scale map ----
eq('C major: C4 to C5', scaleNotes(C), [60, 62, 64, 65, 67, 69, 71, 72])
eq('G major: G3 to G4 (tonic nearest middle C)', scaleNotes(G), [55, 57, 59, 60, 62, 64, 66, 67])
eq('A minor: A3 to A4', scaleNotes(Am), [57, 59, 60, 62, 64, 65, 67, 69])
eq('pentatonic keeps climbing into the next octave', scaleNotes({ tonic: 0, scale: 'majorPentatonic' }), [60, 62, 64, 67, 69, 72, 74, 76])
eq('chromatic is 8 semitones', scaleNotes({ tonic: 0, scale: 'chromatic' }), [60, 61, 62, 63, 64, 65, 66, 67])
for (const [n, k] of [['C', C], ['G', G], ['Am', Am]] as const) {
  const sc = scaleNotes(k), st = SCALES[k.scale]
  eq(`${n}: every pad is in the key`, sc.every((x) => st.includes((((x - k.tonic) % 12) + 12) % 12)), true)
  eq(`${n}: low to high`, sc.every((x, i) => i === 0 || x > sc[i - 1]), true)
  eq(`${n}: 8 pads, tonic on A1, octave on B4`, [sc.length, sc[0] % 12, sc[7] - sc[0]], [8, k.tonic, 12])
}
eq('every tonic lands in G3..F#4', Array.from({ length: 12 }, (_, t) => baseOf(t)).every((b) => b >= 55 && b <= 66), true)
eq('octave +1', scaleNotes(C, 1), [72, 74, 76, 77, 79, 81, 83, 84])
eq('octave -2', scaleNotes(C, -2), [36, 38, 40, 41, 43, 45, 47, 48])
eq('octave is clamped', [clampOct(5), clampOct(-9), clampOct(1)], [2, -2, 1])

// ---- octave jog ----
let j = octaveJog(0, 1); eq('1 tick: nothing yet', j, { acc: 1, step: 0 })
j = octaveJog(j.acc, 2); eq('3 ticks: nothing yet', j, { acc: 3, step: 0 })
j = octaveJog(j.acc, 1); eq('4 ticks: up one octave', j, { acc: 0, step: 1 })
eq('a slow turn back: down one octave', octaveJog(octaveJog(0, -3).acc, -2), { acc: 0, step: -1 })
eq('turning back and forth cancels', octaveJog(octaveJog(0, 3).acc, -3), { acc: 0, step: 0 })

// ---- labels ----
eq('labels: C major tells the two C\'s apart', padLabels(scaleNotes(C)), ['C4', 'D', 'E', 'F', 'G', 'A', 'B', 'C5'])
eq('labels: sharps', padLabels([61, 63, 66, 70, 69, 72, 74, 76]).slice(0, 4), ['C#', 'D#', 'F#', 'A#'])
const pm = padLabelMap(padLabels(scaleNotes(C)), 1, 'follow')
eq('picture labels: pads, octave, map, transport', [pm['pad1.A'], pm['pad4.B'], pm['jog.A'], pm['padmode.A'], pm['play.A']], ['C4', 'C5', 'OCT +1', 'FOLLOW', 'GO'])

// ---- follow the game ----
const none = { targets: [] as number[], soon: [] as number[] }
const scale = scaleNotes(C)
eq('follow, nothing wanted, between phrases: the scale map', followLayout(null, none, C, 0, false), scale)
eq('follow, nothing wanted, mid phrase: the layout stays', followLayout([50, 52, 53, 55, 57, 59, 60, 62], none, C, 0, true), [50, 52, 53, 55, 57, 59, 60, 62])
const inScale = followLayout(scale, { targets: [64], soon: [64, 65] }, C, 0, false)
eq('follow, target already on a pad: nothing moves (same array)', inScale === scale, true)
const high = followLayout(scale, { targets: [76], soon: [77, 79] }, C, 0, false)
eq('follow, between phrases: a window around the new notes', [high.length, high.includes(76), high.includes(77), high.includes(79)], [8, true, true, true])
eq('window is low to high and distinct', high.every((x, i) => i === 0 || x > high[i - 1]), true)
eq('window is in the key', high.every((x) => SCALES.major.includes(x % 12)), true)
eq('the target note is on a pad that targetPads finds', targetPads(high, [76]).length, 1)
// stability within a phrase: the lit pad moves, the layout does not
let lay = scale.slice()
const song = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62] // Ode to Joy
let moved = 0
for (let i = 0; i < song.length; i++) { const next = followLayout(lay, { targets: [song[i]], soon: song.slice(i + 1, i + 3) }, C, 0, i > 0); if (next !== lay) moved++; lay = next }
eq('Ode to Joy in C on the scale map: the layout never moves', moved, 0)
eq('Ode to Joy: every note had a pad', song.every((n) => lay.includes(n)), true)
// a phrase that leaves the window mid-phrase: only the needed pad changes
const before = [60, 62, 64, 65, 67, 69, 71, 72]
const mid = followLayout(before, { targets: [74], soon: [76] }, C, 0, true)
const changed = mid.map((n, i) => (n === before[i] ? -1 : i)).filter((i) => i >= 0)
eq('mid-phrase: both missing notes are on pads', [mid.includes(74), mid.includes(76)], [true, true])
eq('mid-phrase: only two pads changed', changed.length, 2)
eq('mid-phrase: the pads that changed were unneeded notes near in pitch', changed.map((i) => before[i]).sort(), [71, 72])
eq('mid-phrase: still 8 distinct pads', new Set(mid).size, N_PADS)
const mid2 = followLayout(before, { targets: [64, 67, 72], soon: [] }, C, 0, true)
eq('mid-phrase chord already on pads: untouched', mid2 === before, true)
const chord = windowLayout({ targets: [60, 64, 67], soon: [] }, C)
eq('a chord: all its notes get pads', [60, 64, 67].every((n) => chord.includes(n)), true)
eq('a chord lights 3 pads', targetPads(chord, [60, 64, 67]).length, 3)
eq('more wanted notes than pads: capped at 8', windowLayout({ targets: [], soon: Array.from({ length: 12 }, (_, i) => 50 + i) }, C).length, 8)
eq('an out-of-key target still gets a pad', windowLayout({ targets: [61], soon: [] }, C).includes(61), true)
// two phrases in a row: the second one gets its own window (between phrases)
const p1 = windowLayout({ targets: [64], soon: [65, 67] }, C)
const p2 = followLayout(p1, { targets: [79], soon: [81, 83] }, C, 0, false)
eq('a new phrase far away: remapped', p2 !== p1 && p2.includes(79) && p2.includes(83), true)
const p2b = followLayout(p1, { targets: [79], soon: [81, 83] }, C, 0, true)
eq('the same jump mid-phrase: a minimal swap, most pads stay', p2b.filter((n, i) => n === p1[i]).length >= 5, true)

// ---- LED rate limit ----
const cur = Array(8).fill(false), onAt = Array(8).fill(-1e9)
let st = gateLeds(cur, [true, false, false, false, false, false, false, false], onAt, 1000)
eq('a light switches on', st[0], true)
st = gateLeds(st, [false, ...Array(7).fill(false)], onAt, 1050)
eq('and off at once', st[0], false)
st = gateLeds(st, [true, ...Array(7).fill(false)], onAt, 1100)
eq('but not on again 100 ms later', st[0], false)
st = gateLeds(st, [true, ...Array(7).fill(false)], onAt, 1000 + LED_MIN_GAP_MS)
eq(`switches on again after ${LED_MIN_GAP_MS} ms`, st[0], true)
// 5 seconds of a 16-per-second target flicker: never more than 3 turn-ons in any one second
let s2 = Array(8).fill(false); const at2 = Array(8).fill(-1e9), ons: number[] = []
for (let t = 0; t < 5000; t += 10) { const want = Array(8).fill(false); want[0] = Math.floor(t / 31) % 2 === 0; const nx = gateLeds(s2, want, at2, t); if (nx[0] && !s2[0]) ons.push(t); s2 = nx }
let worst = 0
for (const t of ons) worst = Math.max(worst, ons.filter((u) => u >= t && u < t + 1000).length)
eq('a flickering target never lights more than 3 times in any second', worst <= 3, true)

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
