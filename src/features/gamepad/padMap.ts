// A PlayStation 5 pad (Bluetooth or USB) as the browser's standard gamepad.
// Chrome reports it after a button press, usually as "Wireless Controller", vendor 054c,
// product 0ce6 (DualSense) or 0df2 (DualSense Edge). The buttons follow the standard order.
// Pure: no DOM, no stores. scripts/gamepad-fixtures.ts drives it.
//
// The 8 notes of the current key sit on two diamonds, low cluster then high cluster,
// and each cluster is read left, down, right, up:
//   direction pad: left, down, right, up
//   face buttons:  square, cross, circle, triangle
// L1 / R1 step the octave once per press (-2..+2). A note already sounding keeps the
// pitch it started with. L2 holds the next note quieter, R2 louder (R2 wins if both).
// Options is one start press. Share lets go of every note this pad is holding.
// The sticks are ignored: a resting stick drifts and would play notes by itself.

import { clampOct } from '../padplay/padCore'

export const VEL_SOFT = 40
export const VEL_MID = 82
export const VEL_LOUD = 115
/** an analog trigger counts as held from here up (0..1) */
export const TRIGGER = 0.3

export const BTN = {
  CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3,
  L1: 4, R1: 5, L2: 6, R2: 7,
  SHARE: 8, OPTIONS: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
} as const

/** scale notes 0..7, in the order the two diamonds are read */
export const NOTE_BUTTONS = [BTN.LEFT, BTN.DOWN, BTN.RIGHT, BTN.UP, BTN.SQUARE, BTN.CROSS, BTN.CIRCLE, BTN.TRIANGLE] as const

export interface BtnLike { pressed: boolean; value: number }
export interface Mem { down: boolean[]; held: Map<number, number>; oct: number }
export interface Step {
  mem: Mem
  on: { note: number; vel: number }[]
  off: number[]
  start: boolean
}

const DOWN_N = 16

export function freshMem(): Mem {
  return { down: Array.from({ length: DOWN_N }, () => false), held: new Map(), oct: 0 }
}

/** hex id as Chrome writes it: "054c", "54c", "Vendor: 054c", "54c-0ce6" */
function hasHex(id: string, hex: string): boolean {
  return new RegExp('(?:^|[^0-9a-f])0*' + hex + '(?:[^0-9a-f]|$)', 'i').test(id)
}

/**
 * True for a DualSense / DualSense Edge, and for the same standard layout when the browser
 * only says "Wireless Controller" (that is also how a DualShock 4 introduces itself).
 * An Xbox pad and every other standard gamepad stay out.
 */
export function isPlayPad(id: string, mapping = ''): boolean {
  const s = id ?? ''
  const name = s.split('(')[0].trim().toLowerCase()
  const sony = hasHex(s, '54c')
  const product = hasHex(s, 'ce6') || hasHex(s, 'df2')
  if (sony && product) return true
  if (/dualsense|playstation\s*5|\bps5\b/i.test(s) && (mapping === 'standard' || mapping === '' || sony)) return true
  if (name === 'wireless controller' && (mapping === 'standard' || sony)) return true
  return false
}

/** What the devices menu shows. The browser's own name, with the brand words left off. */
export function padLabel(id: string): string {
  const name = (id ?? '').split('(')[0].trim()
  if (!name || /dualsense|playstation|\bps5\b|sony/i.test(name)) return 'Wireless controller'
  return name
}

function at(buttons: ArrayLike<BtnLike | null> | null | undefined, i: number): BtnLike | null {
  if (!buttons || buttons.length <= i) return null
  return buttons[i] ?? null
}
function digital(buttons: ArrayLike<BtnLike | null> | null | undefined, i: number): boolean {
  const b = at(buttons, i)
  return !!b && (b.pressed || b.value >= 0.5)
}
function analog(buttons: ArrayLike<BtnLike | null> | null | undefined, i: number): boolean {
  const b = at(buttons, i)
  return !!b && (b.value >= TRIGGER || b.pressed)
}
function still(held: Map<number, number>, note: number): boolean {
  for (const n of held.values()) if (n === note) return true
  return false
}

export function velocity(buttons: ArrayLike<BtnLike | null> | null | undefined): number {
  if (analog(buttons, BTN.R2)) return VEL_LOUD
  if (analog(buttons, BTN.L2)) return VEL_SOFT
  return VEL_MID
}

/** One poll. `notesFor(oct)` is the 8 scale notes at that octave. The returned mem is the next poll's prev. */
export function stepPad(prev: Mem, buttons: ArrayLike<BtnLike | null> | null | undefined, notesFor: (oct: number) => readonly number[]): Step {
  const down = prev.down.length >= DOWN_N ? prev.down.slice() : freshMem().down
  const held = new Map(prev.held)
  const on: { note: number; vel: number }[] = []
  const off: number[] = []

  let oct = prev.oct
  let d = 0
  const l1 = digital(buttons, BTN.L1)
  const r1 = digital(buttons, BTN.R1)
  if (l1 && !prev.down[BTN.L1]) d -= 1
  if (r1 && !prev.down[BTN.R1]) d += 1
  if (d) oct = clampOct(oct + d)
  down[BTN.L1] = l1
  down[BTN.R1] = r1

  const share = digital(buttons, BTN.SHARE)
  if (share && !prev.down[BTN.SHARE]) {
    const notes = new Set(held.values())
    held.clear()
    for (const n of notes) off.push(n)
  }
  down[BTN.SHARE] = share

  const opt = digital(buttons, BTN.OPTIONS)
  const start = opt && !prev.down[BTN.OPTIONS]
  down[BTN.OPTIONS] = opt

  const scale = notesFor(oct)
  const vel = velocity(buttons)
  for (let i = 0; i < NOTE_BUTTONS.length; i++) {
    const b = NOTE_BUTTONS[i]
    const now = digital(buttons, b)
    const was = !!prev.down[b]
    if (now && !was) {
      const note = scale[i]
      if (note != null && Number.isFinite(note)) {
        const old = held.get(b)
        if (old != null) {
          held.delete(b)
          if (!still(held, old)) off.push(old)
        }
        held.set(b, note)
        on.push({ note, vel })
      }
    } else if (!now && was) {
      const note = held.get(b)
      if (note != null) {
        held.delete(b)
        if (!still(held, note)) off.push(note)
      }
    }
    down[b] = now
  }
  return { mem: { down, held, oct }, on, off, start }
}
