// Wireless game controller: which pads we accept, and what one poll does with the buttons.
// Pure functions only (src/features/gamepad/padMap.ts), no audio or DOM.
//   npx --no-install tsx scripts/gamepad-fixtures.ts        (exit 1 on any failure)
import { scaleNotes } from '../src/features/padplay/padCore'
import { BTN, NOTE_BUTTONS, TRIGGER, VEL_LOUD, VEL_MID, VEL_SOFT, freshMem, isPlayPad, padLabel, stepPad, velocity, type BtnLike, type Mem } from '../src/features/gamepad/padMap'

let fails = 0, passes = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) passes++; else { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}
function ok(name: string, cond: boolean, extra = '') {
  if (cond) passes++; else { fails++; console.log(`FAIL ${name}${extra ? ': ' + extra : ''}`) }
}

const C = { tonic: 0, scale: 'major' as const }
const notes = (oct: number) => scaleNotes(C, oct)
function pad(down: number[] = [], analog: Record<number, number> = {}): BtnLike[] {
  const b = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  for (const i of down) b[i] = { pressed: true, value: 1 }
  for (const [k, v] of Object.entries(analog)) b[+k] = { pressed: v >= TRIGGER, value: v }
  return b
}
function go(mem: Mem, buttons: BtnLike[] | null) {
  return stepPad(mem, buttons, notes)
}

// ---- which pads ----
const DS = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'
eq('DualSense standard id', isPlayPad(DS, 'standard'), true)
eq('DualSense Edge', isPlayPad('Wireless Controller (Vendor: 054c Product: 0df2)', 'standard'), true)
eq('short vendor-product id, no mapping string', isPlayPad('54c-ce6-Wireless Controller', ''), true)
eq('the name DualSense is enough when mapping is empty', isPlayPad('DualSense Wireless Controller', ''), true)
eq('PlayStation 5 in the id', isPlayPad('PlayStation 5 Controller', ''), true)
eq('label drops that brand too', padLabel('PlayStation 5 Controller'), 'Wireless controller')
eq('exact Wireless Controller + standard mapping', isPlayPad('Wireless Controller', 'standard'), true)
eq('exact Wireless Controller with no mapping is not enough', isPlayPad('Wireless Controller', ''), false)
eq('DualShock 4 uses the same buttons and the same name', isPlayPad('Wireless Controller (Vendor: 054c Product: 05c4)', 'standard'), true)
eq('Xbox is not this pad', isPlayPad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'standard'), false)
eq('a plain standard pad is not this pad', isPlayPad('Generic USB Joystick (Vendor: 1234 Product: 0001)', 'standard'), false)
eq('empty id', isPlayPad('', 'standard'), false)
eq('label keeps the browser name', padLabel(DS), 'Wireless Controller')
eq('label drops a brand name', padLabel('DualSense Wireless Controller'), 'Wireless controller')
eq('label fallback', padLabel(''), 'Wireless controller')

// ---- the 8 notes of C major, octave 0: left, down, right, up, then the face buttons ----
{
  let mem = freshMem()
  const got: number[] = []
  for (const b of NOTE_BUTTONS) {
    const s = go(mem, pad([b]))
    got.push(s.on[0]?.note)
    mem = s.mem
    mem = go(mem, pad()).mem
  }
  eq('C major octave 0', got, [60, 62, 64, 65, 67, 69, 71, 72])
}
{
  const G = { tonic: 7, scale: 'major' as const }
  const g = stepPad(freshMem(), pad([BTN.CROSS]), (oct) => scaleNotes(G, oct))
  eq('G major cross is the 6th scale note', g.on[0].note, scaleNotes(G, 0)[5])
}

// ---- edges: a held button does not retrigger, a release lets go ----
{
  let mem = freshMem()
  const a = go(mem, pad([BTN.CROSS]))
  eq('cross plays once', a.on.map((e) => e.note), [69])
  const b = go(a.mem, pad([BTN.CROSS]))
  eq('holding cross does not play again', [b.on.length, b.off.length], [0, 0])
  const c = go(b.mem, pad())
  eq('releasing cross stops the note', c.off, [69])
  ok('the note is no longer held', c.mem.held.size === 0)
}

// ---- octave: one step per press, clamped, and a new note uses the new octave ----
{
  let mem = freshMem()
  const a = go(mem, pad([BTN.L1, BTN.CROSS]))
  eq('L1 and cross on the same poll: the note is an octave down', [a.mem.oct, a.on[0]?.note], [-1, 57])
  const b = go(a.mem, pad([BTN.L1, BTN.CROSS]))
  eq('holding L1 does not keep stepping', [b.mem.oct, b.on.length], [-1, 0])
  const taps = (button: number, n: number) => {
    let m = freshMem()
    for (let i = 0; i < n; i++) { m = go(m, pad([button])).mem; m = go(m, pad()).mem }
    return m.oct
  }
  eq('R1 clamps at +2', taps(BTN.R1, 3), 2)
  eq('L1 clamps at -2', taps(BTN.L1, 3), -2)
  const both = go(freshMem(), pad([BTN.L1, BTN.R1]))
  eq('L1 and R1 together cancel', both.mem.oct, 0)
  const held = go(go(freshMem(), pad([BTN.CROSS])).mem, pad([BTN.CROSS, BTN.R1]))
  eq('a note already sounding keeps its pitch when the octave moves', [held.mem.oct, held.off, held.mem.held.get(BTN.CROSS)], [1, [], 69])
}

// ---- velocity: L2 quiet, R2 loud, R2 wins ----
eq('neither trigger', velocity(pad()), VEL_MID)
eq('L2 at the threshold', velocity(pad([], { [BTN.L2]: TRIGGER })), VEL_SOFT)
eq('L2 under the threshold', velocity(pad([], { [BTN.L2]: TRIGGER - 0.01 })), VEL_MID)
eq('R2', velocity(pad([], { [BTN.R2]: 1 })), VEL_LOUD)
eq('R2 wins when both are held', velocity(pad([], { [BTN.L2]: 1, [BTN.R2]: TRIGGER })), VEL_LOUD)
{
  const soft = go(freshMem(), pad([BTN.SQUARE], { [BTN.L2]: 0.8 }))
  const loud = go(freshMem(), pad([BTN.SQUARE], { [BTN.L2]: 1, [BTN.R2]: 0.4 }))
  eq('the note uses the trigger velocity', [soft.on[0].vel, loud.on[0].vel], [VEL_SOFT, VEL_LOUD])
}

// ---- Options starts once. Share lets go, and a button still held does not restrike. ----
{
  let mem = freshMem()
  const a = go(mem, pad([BTN.OPTIONS]))
  eq('Options is a start and not a note', [a.start, a.on.length], [true, 0])
  const b = go(a.mem, pad([BTN.OPTIONS]))
  eq('holding Options does not start again', b.start, false)
  mem = go(freshMem(), pad([BTN.LEFT, BTN.TRIANGLE])).mem
  const cut = go(mem, pad([BTN.LEFT, BTN.TRIANGLE, BTN.SHARE]))
  eq('Share releases every held note', cut.off.slice().sort((x, y) => x - y), [60, 72])
  ok('Share is not a start', cut.start === false)
  const again = go(cut.mem, pad([BTN.LEFT, BTN.TRIANGLE, BTN.SHARE]))
  eq('buttons still held after Share stay quiet', [again.on.length, again.off.length], [0, 0])
  const up = go(again.mem, pad())
  const replay = go(up.mem, pad([BTN.LEFT]))
  eq('the same button plays again after it is released', replay.on.map((e) => e.note), [60])
}

// ---- two buttons on one pitch: letting go of one leaves the note sounding ----
{
  const same = (_oct: number) => [60, 60, 64, 65, 67, 69, 71, 72]
  let mem = freshMem()
  mem = stepPad(mem, pad([BTN.LEFT, BTN.DOWN]), same).mem
  const one = stepPad(mem, pad([BTN.DOWN]), same)
  eq('releasing one of two buttons on the same note does not stop it', [one.off, one.mem.held.get(BTN.DOWN)], [[], 60])
  const none = stepPad(one.mem, pad(), same)
  eq('releasing the last button stops it', none.off, [60])
}

// ---- sticks and a short report do nothing, and a missing report releases ----
{
  const mem = go(freshMem(), pad([BTN.CROSS])).mem
  const stick = go(mem, pad([BTN.CROSS, 10, 11]))
  eq('clicking the sticks is not a note', [stick.on.length, stick.off.length, stick.start], [0, 0, false])
  const gone = go(stick.mem, null)
  eq('a pad that sends no buttons releases what it held', gone.off, [69])
}

// ---- every other control, and the drum / synth / pro maps (padAssign.ts) ----
// The note stepper above is unchanged: stick clicks are still not notes there.
// The fun jobs live here, so a remapped face button does not also play a scale note.
import {
  CONTROLS, DEAD, DRUMS_MAP, FUNCS, PLAY_MAP, RANGES, ROLL_MS, SYNTH_MAP,
  buttonParamValue, freshAssign, knownFn, playSideMap, quietAssign, sanitizeMap, shapeAxis, stepAssign,
  type AssignMem, type Fire, type PadMap,
} from '../src/features/gamepad/padAssign'

function axes(vs: number[] = []): number[] {
  const a = [0, 0, 0, 0]
  vs.forEach((v, i) => { a[i] = v })
  return a
}
function run(mem: AssignMem, buttons: BtnLike[] | null, ax: number[], map: PadMap, now = 1000, oct = 0) {
  return stepAssign(mem, buttons, ax, map, (o) => scaleNotes(C, oct + o), now)
}
const ons = (fires: Fire[]) => fires.filter((f) => f.t === 'on').map((f) => f.t === 'on' ? f.note : 0)
const drums = (fires: Fire[]) => fires.filter((f) => f.t === 'drum').map((f) => f.t === 'drum' ? f.voice : -1)
const params = (fires: Fire[]) => fires.filter((f) => f.t === 'param')

eq('every control has a row', CONTROLS.length, 22)
eq('every job is in the list once', new Set(FUNCS.map((f) => f.id)).size, FUNCS.length)
ok('the list names every kind of job', FUNCS.some((f) => f.label === 'Note 1') && FUNCS.some((f) => f.label === 'Kick') && FUNCS.some((f) => f.label === 'Cutoff') && FUNCS.some((f) => f.label === 'Off'))
eq('play map cross is note 6', PLAY_MAP.cross, 'note:5')
eq('play side leaves the note buttons to the note stepper', playSideMap().cross, 'off')
eq('play side still clicks a kick', playSideMap().l3, 'drum:0')
eq('a junk map falls back to play', sanitizeMap({ cross: 'nope', lx: 'bend' }).lx, 'bend')
eq('cutoff stays inside the synth', RANGES.cutoff, { min: 40, max: 12000 })
ok('a centered stick is a dead zone', shapeAxis(0) === null && shapeAxis(DEAD) === null && shapeAxis(DEAD + 0.01) !== null)
ok('stick up is the positive direction', (shapeAxis(-1, true) ?? 0) > 0)

{
  let mem = freshAssign()
  const a = run(mem, pad([BTN.CROSS]), axes(), PLAY_MAP)
  eq('assign cross plays the 6th scale note once', ons(a.fires), [69])
  const b = run(a.mem, pad([BTN.CROSS]), axes(), PLAY_MAP)
  eq('assign holding cross does not play again', ons(b.fires).length + b.fires.filter((f) => f.t === 'off').length, 0)
  const c = run(b.mem, pad(), axes(), PLAY_MAP)
  eq('assign releasing cross stops it', c.fires.filter((f) => f.t === 'off'), [{ t: 'off', note: 69 }])
}
{
  const a = run(freshAssign(), pad([BTN.L1, BTN.CROSS]), axes(), PLAY_MAP)
  eq('assign L1 and cross on the same poll is an octave down', [a.mem.oct, ons(a.fires)[0]], [-1, 57])
  const soft = run(freshAssign(), pad([BTN.CROSS], { [BTN.L2]: 1 }), axes(), PLAY_MAP)
  eq('assign L2 plays the note quieter', soft.fires.find((f) => f.t === 'on'), { t: 'on', note: 69, vel: VEL_SOFT })
}
{
  let mem = run(freshAssign(), pad([BTN.LEFT, BTN.TRIANGLE]), axes(), PLAY_MAP).mem
  const cut = run(mem, pad([BTN.LEFT, BTN.TRIANGLE, BTN.SHARE]), axes(), PLAY_MAP)
  eq('assign back lets go', cut.fires.filter((f) => f.t === 'off').map((f) => f.t === 'off' ? f.note : 0).sort((x, y) => x - y), [60, 72])
  const again = run(cut.mem, pad([BTN.LEFT, BTN.TRIANGLE, BTN.SHARE]), axes(), PLAY_MAP)
  eq('assign buttons still held after back stay quiet', ons(again.fires).length, 0)
  const replay = run(run(again.mem, pad(), axes(), PLAY_MAP).mem, pad([BTN.LEFT]), axes(), PLAY_MAP)
  eq('assign the button plays again after it comes up', ons(replay.fires), [60])
}
{
  const kick = run(freshAssign(), pad([10]), axes(), PLAY_MAP)
  eq('left stick click is a kick and not a note', [drums(kick.fires), ons(kick.fires).length], [[0], 0])
  const held = run(kick.mem, pad([10]), axes(), PLAY_MAP, 1200)
  eq('holding the stick click does not roll', drums(held.fires).length, 0)
  const chord = run(freshAssign(), pad([16]), axes(), PLAY_MAP)
  eq('center button plays the chord', ons(chord.fires), [60, 64, 67])
  const up = run(chord.mem, pad(), axes(), PLAY_MAP)
  eq('letting go of the center button stops only the chord', up.fires.filter((f) => f.t === 'off').map((f) => f.t === 'off' ? f.note : 0), [60, 64, 67])
}
{
  const home = run(freshAssign(), pad(), axes([0, 0, 0, 0]), PLAY_MAP)
  eq('a resting stick does not move a knob', params(home.fires).length, 0)
  const open = run(freshAssign(), pad(), axes([1, 0, 0, 0]), PLAY_MAP)
  eq('left stick sideways opens the filter', params(open.fires), [{ t: 'param', key: 'cutoff', value: RANGES.cutoff.max }])
  const still = run(open.mem, pad(), axes([1, 0, 0, 0]), PLAY_MAP)
  eq('holding the stick still does not write the knob again', params(still.fires).length, 0)
  const back = run(still.mem, pad(), axes([0, 0, 0, 0]), PLAY_MAP)
  eq('letting the stick spring back leaves the filter where it is', params(back.fires).length, 0)
  const bent = run(freshAssign(), pad(), axes([0, 0, 1, 0]), PLAY_MAP)
  eq('right stick sideways bends up', params(bent.fires), [{ t: 'param', key: 'bend', value: RANGES.bend.max }])
  const homeBend = run(bent.mem, pad(), axes([0, 0, 0, 0]), PLAY_MAP)
  eq('bend comes home at 0', params(homeBend.fires), [{ t: 'param', key: 'bend', value: 0 }])
  const upStick = run(freshAssign(), pad(), axes([0, -1, 0, 0]), PLAY_MAP)
  eq('stick up raises resonance', params(upStick.fires), [{ t: 'param', key: 'resonance', value: RANGES.resonance.max }])
}
{
  const open = run(freshAssign(), pad(), axes([1, 0, 0, 0]), DRUMS_MAP, 0)
  eq('a drum-mode stick sweeps the filter and hits no pad', [params(open.fires), drums(open.fires)], [[{ t: 'param', key: 'cutoff', value: RANGES.cutoff.max }], []])
  const rollMap: PadMap = { ...DRUMS_MAP, lx: 'drum:0' }
  const roll = run(freshAssign(), pad(), axes([1, 0, 0, 0]), rollMap, 0)
  eq('a pro stick still rolls a drum immediately', drums(roll.fires), [0])
  const soon = run(roll.mem, pad(), axes([1, 0, 0, 0]), rollMap, ROLL_MS - 1)
  eq('the roll waits', drums(soon.fires).length, 0)
  const next = run(soon.mem, pad(), axes([1, 0, 0, 0]), rollMap, ROLL_MS)
  eq('the roll hits again after the wait', drums(next.fires), [0])
  eq('drums mode left shoulder is a kick', drums(run(freshAssign(), pad([BTN.L1]), axes(), DRUMS_MAP).fires), [0])
  const snare = run(freshAssign(), pad([], { [BTN.L2]: 1 }), axes(), DRUMS_MAP)
  eq('drums mode left trigger is a snare at full pull', snare.fires.find((f) => f.t === 'drum'), { t: 'drum', voice: 1, vel: 1 })
  const light = run(freshAssign(), pad([], { [BTN.L2]: TRIGGER }), axes(), DRUMS_MAP)
  const lightHit = light.fires.find((f) => f.t === 'drum')
  ok('a light left trigger is a quieter snare', !!lightHit && lightHit.t === 'drum' && lightHit.voice === 1 && lightHit.vel < 0.5)
  eq('drums mode right shoulder is a hat', drums(run(freshAssign(), pad([BTN.R1]), axes(), DRUMS_MAP).fires), [2])
  eq('drums mode right trigger is an open hat', drums(run(freshAssign(), pad([BTN.R2]), axes(), DRUMS_MAP).fires), [3])
  const tom = run(freshAssign(), pad([BTN.DOWN]), axes(), DRUMS_MAP)
  eq('drums mode down is a low tom', drums(tom.fires), [5])
  ok('drums mode does not also play a scale note', ons(tom.fires).length === 0)
  ok('drum sticks are joysticks', (['lx', 'ly', 'rx', 'ry'] as const).every((id) => !DRUMS_MAP[id].startsWith('drum:')))
}
{
  const quiet = run(freshAssign(), pad([BTN.CROSS], { [BTN.L2]: 1 }), axes(), SYNTH_MAP)
  eq('synth left trigger plays the note quieter', quiet.fires.find((f) => f.t === 'on'), { t: 'on', note: 69, vel: VEL_SOFT })
  const side = run(freshAssign(), pad(), axes([1, 0, 0, 0]), SYNTH_MAP)
  eq('synth left stick sideways is off', params(side.fires).length, 0)
  const mod = run(freshAssign(), pad(), axes([0, -1, 0, 0]), SYNTH_MAP)
  eq('synth left stick up is the mod wheel', params(mod.fires), [{ t: 'param', key: 'lfoDepth', value: RANGES.lfoDepth.max }])
  const rested = run(mod.mem, pad(), axes([0, 0, 0, 0]), SYNTH_MAP)
  eq('the mod wheel rests at none', params(rested.fires), [{ t: 'param', key: 'lfoDepth', value: 0 }])
  const downWheel = run(freshAssign(), pad(), axes([0, 1, 0, 0]), SYNTH_MAP)
  eq('pushing the mod wheel down adds no wobble', params(downWheel.fires).length, 0)
  const pitch = run(freshAssign(), pad(), axes([0, 0, 0, -1]), SYNTH_MAP)
  eq('synth right stick up is the pitch wheel', params(pitch.fires), [{ t: 'param', key: 'bend', value: RANGES.bend.max }])
  const homePitch = run(pitch.mem, pad(), axes([0, 0, 0, 0]), SYNTH_MAP)
  eq('the pitch wheel springs home', params(homePitch.fires), [{ t: 'param', key: 'bend', value: 0 }])
  const saw = run(freshAssign(), pad([10]), axes(), SYNTH_MAP)
  eq('synth stick click picks a wave', saw.fires.filter((f) => f.t === 'wave'), [{ t: 'wave', wave: 'sawtooth' }])
}
{
  const once = (name: string, map: PadMap) => {
    const seen = new Map<string, string>()
    for (const c of CONTROLS) {
      const fn = map[c.id]
      if (fn === 'off') continue
      const prev = seen.get(fn)
      ok(`${name}: ${fn} is on one control`, !prev, prev ? `${prev} and ${c.id}` : '')
      if (!prev) seen.set(fn, c.id)
    }
  }
  once('play', PLAY_MAP)
  once('play side', playSideMap())
  once('drums', DRUMS_MAP)
  once('synth', SYNTH_MAP)
  ok('each drum voice is on one drums control', new Set(CONTROLS.map((c) => DRUMS_MAP[c.id]).filter((fn) => fn.startsWith('drum:'))).size === 8)
}
{
  const custom: PadMap = { ...PLAY_MAP, square: 'cutoff', share: 'panic', lx: 'note:0' }
  const hit = run(freshAssign(), pad([BTN.SQUARE]), axes(), custom)
  eq('a pro button sets the knob to three quarters', params(hit.fires), [{ t: 'param', key: 'cutoff', value: buttonParamValue('cutoff') }])
  ok('and it is not also a note', ons(hit.fires).length === 0)
  const back = run(hit.mem, pad(), axes(), custom)
  ok('letting the pro button go restores a value', params(back.fires).some((f) => f.t === 'param' && f.key === 'cutoff'))
  let mem = run(freshAssign(), pad(), axes([1, 0, 0, 0]), custom).mem
  const cut = run(mem, pad([BTN.SHARE]), axes([1, 0, 0, 0]), custom, 1500)
  eq('panic is one shot', cut.fires.filter((f) => f.t === 'panic').length, 1)
  const held = run(cut.mem, pad(), axes([1, 0, 0, 0]), custom, 1600)
  eq('a stick note stays quiet after panic until the stick springs back', ons(held.fires).length, 0)
  const free = run(run(held.mem, pad(), axes(), custom).mem, pad(), axes([1, 0, 0, 0]), custom, 2000)
  eq('the stick plays again after it comes home', ons(free.fires), [60])
}
{
  const missing = run(freshAssign(), pad(), axes(), PLAY_MAP)
  ok('a report with no center button stays idle', !missing.fires.some((f) => f.t === 'on' || f.t === 'picture'))
  const pic = run(freshAssign(), pad([17]), axes(), PLAY_MAP)
  eq('touch pad asks for the next picture', pic.fires.filter((f) => f.t === 'picture'), [{ t: 'picture' }])
  const gone = run(pic.mem, null, [], PLAY_MAP)
  eq('a missing report lets go', gone.fires.filter((f) => f.t === 'picture').length, 0)
}
{
  const held = run(freshAssign(), pad([BTN.CROSS]), axes(), PLAY_MAP).mem
  const q = quietAssign(held, pad([BTN.CROSS]), axes(), PLAY_MAP)
  eq('quiet stops the note', q.fires.filter((f) => f.t === 'off'), [{ t: 'off', note: 69 }])
  const again = run(q.mem, pad([BTN.CROSS]), axes(), PLAY_MAP)
  eq('a button that is still down after quiet does not restrike', ons(again.fires).length, 0)
}
ok('known jobs only', knownFn('cutoff') && !knownFn('sustain-pedal'))

console.log(fails ? `${passes} passed, ${fails} failed` : `${passes} passed`)
process.exit(fails ? 1 : 0)
