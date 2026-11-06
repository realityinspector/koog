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

console.log(fails ? `${passes} passed, ${fails} failed` : `${passes} passed`)
process.exit(fails ? 1 : 0)
