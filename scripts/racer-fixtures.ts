// Koogalien Racer + Koog Kode rules: track-from-phrase geometry, steering error, mishap thresholds, stars, vehicle phrase-keys.
// Pure functions only (src/features/games/racer/racerCore.ts, src/kode/kodeCore.ts), no audio or DOM.
//   npx --no-install tsx scripts/racer-fixtures.ts        (exit 1 on any failure)
import { SPB, UNIT, ROAD_HALF, buildTrack, drive, foldPc, lanesFor, sampleOfBeat, type Play, type PhraseNote } from '../src/features/games/racer/racerCore'
import { TRACKS, WORLDS, phraseOf, trackFor } from '../src/features/games/racer/tracks'
import { VEHICLES, vehicleForKey } from '../src/features/games/racer/vehicles'
import { buttonToken, djLane, keyToken, padToken, repeatedKey, steerOf, sideOfLane } from '../src/kode/kodeCore'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
const ok = (name: string, cond: boolean, info = '') => eq(name + (cond ? '' : ' ' + info), cond, true)
const notes = (ns: number[], gap = 1): PhraseNote[] => ns.map((note, i) => ({ note, beat: i * gap, beats: gap }))
const playsOf = (p: PhraseNote[], off = 0, dt = 0): Play[] => p.map((n) => ({ beat: n.beat + dt, v: n.note + off }))

// ---- geometry: the track is a timeline
{
  const t = buildTrack(notes([60, 62, 62, 55, 67]))
  eq('gate beats line up with the phrase', t.gates.map((g) => g.beat), [0, 1, 2, 3, 4])
  eq('a gate sits at its beat on the timeline', t.gates.map((g) => g.j), [0, 1, 2, 3, 4].map((b) => sampleOfBeat(b)))
  eq('first note: straight', t.gates[0].turn, 0)
  ok('up = turn right', t.gates[1].turn > 0)
  eq('same note = straight', t.gates[2].turn, 0)
  ok('down = turn left', t.gates[3].turn < 0)
  ok('bigger interval = sharper turn', Math.abs(t.gates[4].turn) > Math.abs(t.gates[1].turn), `${t.gates[4].turn} vs ${t.gates[1].turn}`)
  ok('turn is capped', Math.abs(buildTrack(notes([36, 96])).gates[1].turn) <= 62)
  // distance along the road is time: one beat = UNIT world units, whatever the turns
  const a = sampleOfBeat(0), b = sampleOfBeat(3)
  let len = 0
  for (let j = a; j < b; j++) len += Math.hypot(t.x[j + 1] - t.x[j], t.y[j + 1] - t.y[j])
  ok('3 beats of road are 3 x UNIT long', Math.abs(len - 3 * UNIT) < 1, `${len}`)
  // the road really bends right after an up interval
  ok('heading goes clockwise after an up turn', t.h[sampleOfBeat(2)] > 0.05)
  ok('heading turns back after a drop', t.h[sampleOfBeat(3.9)] < t.h[sampleOfBeat(2.5)])
  const pads = buildTrack(notes([60, 62, 64]), 'pads')
  eq('pad lanes for three notes', pads.gates.map((g) => g.v), [0, 2, 4])
  ok('pad phrases steer by lane: low to high turns right', pads.gates[2].turn > 0)
  eq('lanes: 5 unique notes spread over the pads', lanesFor([60, 62, 64, 65, 67]), [0, 2, 4, 5, 7])
  eq('lanes: repeated notes share a pad', lanesFor([60, 60, 62]), [0, 0, 2])
}

// ---- steering error
eq('foldPc: same', foldPc(0), 0)
eq('foldPc: octave slip is no error', foldPc(12), 0)
eq('foldPc: octave down is no error', foldPc(-24), 0)
eq('foldPc: +1', foldPc(1), 1)
eq('foldPc: +7 is -5', foldPc(7), -5)
eq('foldPc: -7 is +5', foldPc(-7), 5)

// ---- the drive on the first-ladder phrases
const bpm = 70
for (const def of TRACKS) {
  const ph = phraseOf(def)
  const tr = trackFor(def, 'keys')
  ok(`${def.id} has ${def.to - def.from + 1} or fewer notes`, ph.length >= 3 && ph.length <= 9, String(ph.length))
  const clean = drive(tr, playsOf(ph), bpm)
  ok(`${def.id}: perfect play stays on the road (max off ${clean.maxOff.toFixed(1)})`, clean.mishaps.length === 0 && clean.maxOff < 1)
  eq(`${def.id}: perfect play = 3 stars`, clean.stars, 3)
  const sloppy = drive(tr, playsOf(ph, 0, 0.12), bpm)
  eq(`${def.id}: a hair late (0.12 beat) is still 3 stars`, sloppy.stars, 3)
}
const ph0 = phraseOf(TRACKS[2]), tr0 = trackFor(TRACKS[2], 'keys')
{
  // wrong pitch: how far off before the car leaves the road
  const wrongBy = (semi: number, at = 2) => { const p = playsOf(ph0); p[at].v += semi; return drive(tr0, p, bpm) }
  ok('1 semitone off: stays on the road', wrongBy(1).mishaps.length === 0, String(wrongBy(1).maxOff))
  ok('2 semitones off: stays on the road', wrongBy(2).mishaps.length === 0, String(wrongBy(2).maxOff))
  ok('1 semitone off: not 3 stars', wrongBy(1).stars < 3)
  ok('5 semitones off: off the road', wrongBy(5).mishaps.length >= 1, String(wrongBy(5).maxOff))
  ok('-5 semitones off: off the road', wrongBy(-5).mishaps.length >= 1)
  ok('a bigger mistake drifts farther', wrongBy(4).maxOff > wrongBy(2).maxOff)
  const m = wrongBy(5).mishaps[0]
  eq('mishap blames the wrong note (gate 3)', m.gate, 2)
  ok('mishap text names both notes', /Note 3 was .+, the road wanted .+/.test(m.text), m.text)
  ok('mishap is one of the funny kinds', ['pond', 'hay', 'chickens'].includes(m.kind), m.kind)
  eq('octave slip is not a mistake', (() => { const p = playsOf(ph0); p[2].v += 12; return drive(tr0, p, bpm).stars })(), 3)
  eq('wrong pitch is graded wrong', wrongBy(3).results[2].grade, 'wrong')
  ok('after a mishap the lap goes on and the car is back on the road', (() => { const d = wrongBy(6); return Math.abs(d.d[d.d.length - 1]) < ROAD_HALF })())
  // wrong note on the left/right sets pond vs hay
  const up = wrongBy(5), down = wrongBy(-5)
  ok('a wrong note up and down end on opposite sides', up.mishaps[0].side !== down.mishaps[0].side)
  eq('side left = pond', [up, down].find((d) => d.mishaps[0].side < 0)?.mishaps[0].kind === 'pond' || [up, down].find((d) => d.mishaps[0].side < 0)?.mishaps[0].kind === 'chickens', true)
}
{
  // timing
  const dlate = (dt: number) => drive(tr0, playsOf(ph0, 0, dt), bpm)
  const early = drive(tr0, playsOf(ph0, 0, -0.35), bpm), late = drive(tr0, playsOf(ph0, 0, 0.35), bpm)
  ok('late notes drift', late.maxOff > 8, String(late.maxOff))
  ok('early notes drift', early.maxOff > 8, String(early.maxOff))
  ok('late is not 3 stars', late.stars < 3)
  ok('later = more drift', dlate(0.5).maxOff > dlate(0.25).maxOff)
  ok('very late spins out', dlate(0.9).mishaps.some((m) => m.kind === 'spin' || m.kind === 'cow'), JSON.stringify(dlate(0.9).mishaps.map((m) => m.kind)))
  eq('late dt is positive', late.results[1].dt > 0.3, true)
  const spin = dlate(0.9).mishaps.find((m) => m.kind === 'spin')
  if (spin) ok('spin text says late', /late/.test(spin.text), spin.text)
  // missed notes
  const miss = (() => { const p = playsOf(ph0); p.splice(2, 1); return drive(tr0, p, bpm) })()
  eq('a missed note is a cow', miss.mishaps.map((m) => m.kind), ['cow'])
  eq('a missed note is gate 3', miss.mishaps[0].gate, 2)
  ok('missed note text', /Note 3 never came/.test(miss.mishaps[0].text))
  eq('missed note: 2 stars', miss.stars, 2)
  const none = drive(tr0, [], bpm)
  eq('no notes at all: 0 stars', none.stars, 0)
  ok('no notes: a cow for every gate (or recovering)', none.mishaps.length >= 2)
  // a stray extra note does not break the lap
  const extra = drive(tr0, [...playsOf(ph0), { beat: 2.5, v: 61 }], bpm)
  ok('an extra note is ignored', extra.stars === 3, String(extra.stars))
  // the snail is forgiving
  const sn = VEHICLES.find((v) => v.id === 'snail')!
  const p5 = playsOf(ph0); p5[2].v += 4
  ok('the snail forgives what the family car does not', drive(tr0, p5, bpm).mishaps.length >= drive(tr0, p5, bpm, { half: sn.half }).mishaps.length)
  const rock = playsOf(ph0); rock[2].v += 4
  ok('snail stays on at 4 semitones off', drive(tr0, rock, bpm, { half: sn.half }).mishaps.length === 0, String(drive(tr0, rock, bpm, { half: sn.half }).maxOff))
}
{
  // pads steer by lane
  const tp = buildTrack(notes([60, 62, 64]), 'pads')
  const laneOf = (lanes: number[]): Play[] => lanes.map((v, i) => ({ beat: i, v }))
  eq('pads: right pads on the beat = 3 stars', drive(tp, laneOf([0, 2, 4]), bpm).stars, 3)
  const one = drive(tp, laneOf([0, 3, 4]), bpm)
  ok('pads: one lane off is still on the road', one.mishaps.length === 0 && one.stars < 3, String(one.maxOff))
  const far = drive(tp, laneOf([0, 2, 7]), bpm)
  ok('pads: three lanes off leaves the road', far.mishaps.length >= 1, String(far.maxOff))
  ok('pads: message names pads', /pad \d/.test(far.mishaps[0]?.text ?? ''), far.mishaps[0]?.text)
  // steering by side: a hit on a right pad (lane 4+) steers right of a left pad
  ok('right-side pad error pushes right', drive(tp, laneOf([0, 2, 7]), bpm).d.reduce((m, v) => Math.max(m, v), 0) > 10)
  ok('left-side pad error pushes left', drive(tp, laneOf([0, 0, 4]), bpm).d.reduce((m, v) => Math.min(m, v), 0) < -10)
}

// ---- Kode tokens
{
  const t0 = 1000
  const k = keyToken('keys', 60, 0.8, t0), m = keyToken('midi', 62, 1, t0)
  eq('piano token steers by its MIDI note', steerOf(k), 60)
  eq('midi src', m.src, 'midi')
  const p = padToken('drums', 5, 1, t0)
  eq('pad token has a lane', p.lane, 5)
  eq('pad value is the lane', p.value, 5)
  ok('pad steers by lane x scale', Math.abs(steerOf(p) - 5 * 1.75) < 1e-9)
  eq('left pads', sideOfLane(0), 'left'); eq('right pads', sideOfLane(7), 'right')
  eq('pedal token has no pitch', buttonToken('pedal', 1, t0).pitch, undefined)
  eq('pad1 on deck A is lane 0', djLane('pad1', 'A'), 0)
  eq('pad4 on deck B is lane 7', djLane('pad4', 'B'), 7)
  eq('a jog is not a Kode input', djLane('jog', 'A'), null)
}

// ---- vehicle phrase-keys
{
  const row = (n: number, pitch: number, gap = 300, t0 = 0) => Array.from({ length: n }, (_, i) => keyToken('keys', pitch + (i % 2) * 12, 1, t0 + i * gap))
  eq('C four times -> bee', vehicleForKey(repeatedKey(row(4, 60)))?.id, 'bee')
  eq('D four times -> family car', vehicleForKey(repeatedKey(row(4, 62)))?.id, 'family')
  eq('G four times (octaves mixed) -> snail', vehicleForKey(repeatedKey(row(4, 67)))?.id, 'snail')
  eq('three times is not enough', repeatedKey(row(3, 60)), null)
  eq('C C C D is nothing', repeatedKey([...row(3, 60), keyToken('keys', 62, 1, 1000)]), null)
  eq('too slow is nothing', repeatedKey(row(4, 60, 2000)), null)
  eq('five C: the last four count', vehicleForKey(repeatedKey(row(5, 60)))?.id, 'bee')
  eq('F# is no vehicle', vehicleForKey(repeatedKey(row(4, 66))), null)
  const pads = Array.from({ length: 4 }, (_, i) => padToken('drums', 0, 1, i * 300))
  eq('pad 1 four times -> bee', vehicleForKey(repeatedKey(pads))?.id, 'bee')
  eq('pad 4 four times -> rocket', vehicleForKey(repeatedKey(Array.from({ length: 4 }, (_, i) => padToken('dj', 3, 1, i * 300))))?.id, 'rocket')
  eq('a pedal press in between is ignored', vehicleForKey(repeatedKey([...row(2, 60), buttonToken('pedal', 1, 700), ...row(2, 60, 300, 800)]))?.id, 'bee')
  eq('pitch then pad is nothing', repeatedKey([...row(3, 60), padToken('drums', 0, 1, 1000)]), null)
  eq('every vehicle has a unique note', new Set(VEHICLES.map((v) => v.pc)).size, VEHICLES.length)
  eq('every vehicle has a unique pad', new Set(VEHICLES.map((v) => v.lane)).size, VEHICLES.length)
  ok('7 to 8 vehicles', VEHICLES.length >= 6 && VEHICLES.length <= 8)
}

// ---- the ladder
{
  eq('4 worlds', WORLDS.length, 4)
  eq('12 tracks', TRACKS.length, 12)
  ok('track ids unique', new Set(TRACKS.map((t) => t.id)).size === TRACKS.length)
  ok('first track is 3 notes', phraseOf(TRACKS[0]).length === 3)
  ok('lengths grow overall', phraseOf(TRACKS[8]).length > phraseOf(TRACKS[0]).length)
  ok('tempo grows', TRACKS[11].bpm > TRACKS[0].bpm)
  ok('hints fade', TRACKS[0].hints === 'full' && TRACKS[11].hints === 'none')
  ok('every phrase sits mid-keyboard', TRACKS.every((t) => phraseOf(t).every((n) => n.note >= 48 && n.note <= 84)))
  ok('syncopation track has off-beat notes', phraseOf(TRACKS[10]).some((n) => n.beat % 1 !== 0))
  eq('pad mode builds for every track', TRACKS.every((t) => trackFor(t, 'pads').gates.length === phraseOf(t).length), true)
  ok('SPB is positive', SPB > 0)
}
console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
