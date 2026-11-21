// What each control on a standard wireless gamepad does.
// Pure: no DOM, no stores, no audio. scripts/gamepad-fixtures.ts drives it.
// The play-note path in padMap.ts stays as it is. This file covers the other jobs
// (drums, synth knobs, and a full custom map) and the controls padMap ignores
// (stick clicks, the center button, the touch pad, and the sticks).
//
// Button order is the W3C standard map. Axes: 0/1 left stick, 2/3 right stick.
// Stick up is -1, so the up/down axes are inverted before they become a knob.
// A resting stick drifts, so values inside the dead zone do nothing. Bend is the
// exception: letting the stick spring back sets bend to 0 so the pitch does not stick.

import { clampOct } from '../padplay/padCore'
import { TRIGGER, VEL_LOUD, VEL_MID, VEL_SOFT, type BtnLike } from './padMap'

export const DEAD = 0.25
export const ROLL_MS = 140
const BUTTONS = 18

export type ControlId =
  | 'left' | 'down' | 'right' | 'up'
  | 'square' | 'cross' | 'circle' | 'triangle'
  | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3'
  | 'share' | 'options' | 'home' | 'touch'
  | 'lx' | 'ly' | 'rx' | 'ry'

export interface ControlDef {
  id: ControlId
  label: string
  kind: 'button' | 'axis'
  index: number
  /** L2 / R2: the pull amount is the value, not just on/off. */
  analog?: boolean
  /** Stick up is negative. Flip it so up means more. */
  invert?: boolean
}

/** One row per physical control, in the order the Pro list shows them. */
export const CONTROLS: ControlDef[] = [
  { id: 'left', label: 'Left', kind: 'button', index: 14 },
  { id: 'down', label: 'Down', kind: 'button', index: 13 },
  { id: 'right', label: 'Right', kind: 'button', index: 15 },
  { id: 'up', label: 'Up', kind: 'button', index: 12 },
  { id: 'square', label: 'Square', kind: 'button', index: 2 },
  { id: 'cross', label: 'Cross', kind: 'button', index: 0 },
  { id: 'circle', label: 'Circle', kind: 'button', index: 1 },
  { id: 'triangle', label: 'Triangle', kind: 'button', index: 3 },
  { id: 'l1', label: 'Left shoulder', kind: 'button', index: 4 },
  { id: 'r1', label: 'Right shoulder', kind: 'button', index: 5 },
  { id: 'l2', label: 'Left trigger', kind: 'button', index: 6, analog: true },
  { id: 'r2', label: 'Right trigger', kind: 'button', index: 7, analog: true },
  { id: 'l3', label: 'Left stick click', kind: 'button', index: 10 },
  { id: 'r3', label: 'Right stick click', kind: 'button', index: 11 },
  { id: 'share', label: 'Back', kind: 'button', index: 8 },
  { id: 'options', label: 'Start', kind: 'button', index: 9 },
  { id: 'home', label: 'Center button', kind: 'button', index: 16 },
  { id: 'touch', label: 'Touch pad', kind: 'button', index: 17 },
  { id: 'lx', label: 'Left stick sideways', kind: 'axis', index: 0 },
  { id: 'ly', label: 'Left stick up and down', kind: 'axis', index: 1, invert: true },
  { id: 'rx', label: 'Right stick sideways', kind: 'axis', index: 2 },
  { id: 'ry', label: 'Right stick up and down', kind: 'axis', index: 3, invert: true },
]

export type NoteFn = `note:${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
export type DrumFn = `drum:${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
export type WaveFn = 'wave:sawtooth' | 'wave:square' | 'wave:triangle' | 'wave:sine'
export type ParamKey =
  | 'cutoff' | 'resonance' | 'filterEnv' | 'attack' | 'decay' | 'sustain' | 'release'
  | 'glide' | 'detune' | 'lfoRate' | 'lfoDepth' | 'bend'
export type Fn =
  | NoteFn | DrumFn | WaveFn | ParamKey
  | 'oct-' | 'oct+' | 'quiet' | 'loud' | 'letgo' | 'start' | 'panic' | 'tap'
  | 'picture' | 'chord' | 'hold' | 'off'

export const FUNCS: { id: Fn; label: string }[] = [
  { id: 'note:0', label: 'Note 1' }, { id: 'note:1', label: 'Note 2' }, { id: 'note:2', label: 'Note 3' }, { id: 'note:3', label: 'Note 4' },
  { id: 'note:4', label: 'Note 5' }, { id: 'note:5', label: 'Note 6' }, { id: 'note:6', label: 'Note 7' }, { id: 'note:7', label: 'Note 8' },
  { id: 'drum:0', label: 'Kick' }, { id: 'drum:1', label: 'Snare' }, { id: 'drum:2', label: 'Hat' }, { id: 'drum:3', label: 'Open hat' },
  { id: 'drum:4', label: 'Clap' }, { id: 'drum:5', label: 'Low tom' }, { id: 'drum:6', label: 'High tom' }, { id: 'drum:7', label: 'Rim' },
  { id: 'oct-', label: 'Octave down' }, { id: 'oct+', label: 'Octave up' },
  { id: 'quiet', label: 'Quieter' }, { id: 'loud', label: 'Louder' },
  { id: 'letgo', label: 'Let go of notes' }, { id: 'start', label: 'Start' }, { id: 'panic', label: 'Panic' },
  { id: 'tap', label: 'Tap the tempo' }, { id: 'picture', label: 'Next picture' }, { id: 'chord', label: 'Play a chord' },
  { id: 'hold', label: 'Hold notes' },
  { id: 'wave:sawtooth', label: 'Saw' }, { id: 'wave:square', label: 'Square' }, { id: 'wave:triangle', label: 'Triangle' }, { id: 'wave:sine', label: 'Sine' },
  { id: 'cutoff', label: 'Cutoff' }, { id: 'resonance', label: 'Resonance' }, { id: 'filterEnv', label: 'Filter sweep' },
  { id: 'attack', label: 'Attack' }, { id: 'decay', label: 'Decay' }, { id: 'sustain', label: 'Sustain' }, { id: 'release', label: 'Release' },
  { id: 'glide', label: 'Glide' }, { id: 'detune', label: 'Detune' }, { id: 'lfoRate', label: 'LFO speed' }, { id: 'lfoDepth', label: 'LFO depth' },
  { id: 'bend', label: 'Bend' },
  { id: 'off', label: 'Off' },
]

const FN_SET = new Set<string>(FUNCS.map((f) => f.id))
export const knownFn = (v: unknown): v is Fn => typeof v === 'string' && FN_SET.has(v)

/** Same clamps the synth engine uses. Bend is cents. */
export const RANGES: Record<ParamKey, { min: number; max: number }> = {
  cutoff: { min: 40, max: 12000 },
  resonance: { min: 0.1, max: 20 },
  filterEnv: { min: 0, max: 8000 },
  attack: { min: 0.002, max: 4 },
  decay: { min: 0.005, max: 4 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.01, max: 4 },
  glide: { min: 0, max: 0.5 },
  detune: { min: -50, max: 50 },
  lfoRate: { min: 0.1, max: 12 },
  lfoDepth: { min: 0, max: 1 },
  bend: { min: -200, max: 200 },
}

const PARAMS = new Set<string>(Object.keys(RANGES))
export const isParam = (fn: Fn): fn is ParamKey => PARAMS.has(fn)
const noteDegree = (fn: Fn): number | null => fn.startsWith('note:') ? Number(fn.slice(5)) : null
const drumVoice = (fn: Fn): number | null => fn.startsWith('drum:') ? Number(fn.slice(5)) : null
const waveOf = (fn: Fn): FireWave | null => fn.startsWith('wave:') ? fn.slice(5) as FireWave : null
type FireWave = 'sawtooth' | 'square' | 'triangle' | 'sine'

export type PadMap = Record<ControlId, Fn>
export type PadRole = 'play' | 'drums' | 'synth' | 'custom'

/** The out-of-the-gate layout. Custom starts here, so an unedited Pro map matches Play. */
export const PLAY_MAP: PadMap = {
  left: 'note:0', down: 'note:1', right: 'note:2', up: 'note:3',
  square: 'note:4', cross: 'note:5', circle: 'note:6', triangle: 'note:7',
  l1: 'oct-', r1: 'oct+', l2: 'quiet', r2: 'loud',
  share: 'letgo', options: 'start',
  l3: 'drum:0', r3: 'drum:1', home: 'chord', touch: 'picture',
  lx: 'cutoff', ly: 'resonance', rx: 'bend', ry: 'lfoDepth',
}

/** Each drum voice once. Shoulders and triggers are the kit. Directions are the other four. Sticks are knobs. */
export const DRUMS_MAP: PadMap = {
  left: 'drum:4', down: 'drum:5', right: 'drum:6', up: 'drum:7',
  square: 'hold', cross: 'chord', circle: 'picture', triangle: 'tap',
  l1: 'drum:0', r1: 'drum:2', l2: 'drum:1', r2: 'drum:3',
  share: 'letgo', options: 'start',
  l3: 'off', r3: 'off', home: 'off', touch: 'off',
  lx: 'cutoff', ly: 'resonance', rx: 'bend', ry: 'lfoDepth',
}

/** Left stick up is the mod wheel. Right stick up and down is the pitch wheel. Every other job is somewhere else. */
export const SYNTH_MAP: PadMap = {
  left: 'note:0', down: 'note:1', right: 'note:2', up: 'note:3',
  square: 'note:4', cross: 'note:5', circle: 'note:6', triangle: 'note:7',
  l1: 'oct-', r1: 'oct+', l2: 'quiet', r2: 'loud',
  share: 'letgo', options: 'start',
  l3: 'wave:sawtooth', r3: 'wave:square', home: 'wave:sine', touch: 'picture',
  lx: 'off', ly: 'lfoDepth', rx: 'off', ry: 'bend',
}

/** Controls the note stepper already handles. The play-role side pass skips these so a note is not struck twice. */
const PLAY_OWNS: ControlId[] = ['left', 'down', 'right', 'up', 'square', 'cross', 'circle', 'triangle', 'l1', 'r1', 'options']

export function playSideMap(): PadMap {
  const map: PadMap = { ...PLAY_MAP }
  for (const id of PLAY_OWNS) map[id] = 'off'
  return map
}

export function activeMap(role: PadRole, custom: PadMap): PadMap {
  if (role === 'drums') return DRUMS_MAP
  if (role === 'synth') return SYNTH_MAP
  if (role === 'custom') return custom
  return PLAY_MAP
}

export function sanitizeMap(raw: unknown): PadMap {
  const map: PadMap = { ...PLAY_MAP }
  if (!raw || typeof raw !== 'object') return map
  const o = raw as Record<string, unknown>
  for (const c of CONTROLS) {
    const v = o[c.id]
    if (knownFn(v)) map[c.id] = v
  }
  return map
}

export type Fire =
  | { t: 'on'; note: number; vel: number }
  | { t: 'off'; note: number }
  | { t: 'drum'; voice: number; vel: number }
  | { t: 'start' }
  | { t: 'panic' }
  | { t: 'tap' }
  | { t: 'picture' }
  | { t: 'wave'; wave: FireWave }
  | { t: 'hold'; on: boolean }
  | { t: 'param'; key: ParamKey; value: number }

export interface AssignMem {
  down: boolean[]
  /** control id -> the midi note it is holding */
  held: Map<string, number>
  /** control id -> the chord it struck */
  chords: Map<string, number[]>
  oct: number
  holdOn: boolean
  /** control id -> last drum-roll time */
  rollAt: Record<string, number>
  /** control id -> the knob value to put back when a button or trigger lets go */
  captured: Record<string, number>
  /** control id -> last knob value we sent, or null when the stick is home */
  axisLive: Record<string, number | null>
  /** an axis note or drum must spring home before it can strike again (after Let go / Panic) */
  wait: Record<string, boolean>
}

export function freshAssign(): AssignMem {
  return {
    down: Array.from({ length: BUTTONS }, () => false),
    held: new Map(), chords: new Map(), oct: 0, holdOn: false,
    rollAt: {}, captured: {}, axisLive: {}, wait: {},
  }
}

export interface AssignStep { mem: AssignMem; fires: Fire[] }

function at(buttons: ArrayLike<BtnLike | null> | null | undefined, i: number): BtnLike | null {
  if (!buttons || buttons.length <= i) return null
  return buttons[i] ?? null
}

function heldDown(b: BtnLike, analog: boolean): boolean {
  if (analog) return b.value >= TRIGGER || b.pressed
  return b.pressed || b.value >= 0.5
}

/** 0..1 across the trigger's travel, or null at rest. A digital click counts as full. */
function triggerAmount(b: BtnLike): number | null {
  if (b.value >= TRIGGER) return Math.min(1, (b.value - TRIGGER) / (1 - TRIGGER))
  if (b.pressed) return 1
  return null
}

const AXIS_PAIR: Partial<Record<ControlId, ControlId>> = { lx: 'ly', ly: 'lx', rx: 'ry', ry: 'rx' }

/**
 * A stick with one live axis is a wheel. The mod wheel (LFO depth) follows the upward push
 * and returns to none at rest. A stick that also has a sideways job keeps the last value.
 */
function springWheel(map: PadMap, c: ControlDef, fn: Fn): boolean {
  if (c.kind !== 'axis' || fn !== 'lfoDepth') return false
  const other = AXIS_PAIR[c.id]
  return !!other && map[other] === 'off'
}

/** null inside the dead zone. Otherwise -1..1, 0 at the edge of the dead zone. */
export function shapeAxis(v: number, invert = false): number | null {
  if (!Number.isFinite(v)) return null
  const x = invert ? -v : v
  const a = Math.abs(x)
  if (a <= DEAD) return null
  const s = Math.sign(x) * (a - DEAD) / (1 - DEAD)
  return Math.max(-1, Math.min(1, s))
}

function axisOf(axes: ArrayLike<number> | null | undefined, i: number): number {
  if (!axes || axes.length <= i) return 0
  const v = axes[i]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function lerp(key: ParamKey, t: number): number {
  const r = RANGES[key]
  const u = Math.max(0, Math.min(1, t))
  return r.min + u * (r.max - r.min)
}

/** A plain button, while held, sits at three quarters of the knob's range. */
export function buttonParamValue(key: ParamKey): number {
  return lerp(key, 0.75)
}

function near(key: ParamKey, a: number, b: number): boolean {
  const r = RANGES[key]
  return Math.abs(a - b) < Math.max(1e-4, (r.max - r.min) / 200)
}

function sounding(held: Map<string, number>, chords: Map<string, number[]>, note: number, except?: string): boolean {
  for (const [id, n] of held) if (id !== except && n === note) return true
  for (const [id, arr] of chords) {
    if (id === except) continue
    for (const n of arr) if (n === note) return true
  }
  return false
}

function releaseNote(held: Map<string, number>, chords: Map<string, number[]>, id: string, fires: Fire[]) {
  const note = held.get(id)
  if (note == null) return
  held.delete(id)
  if (!sounding(held, chords, note)) fires.push({ t: 'off', note })
}

function releaseChord(held: Map<string, number>, chords: Map<string, number[]>, id: string, fires: Fire[]) {
  const notes = chords.get(id)
  if (!notes) return
  chords.delete(id)
  for (const note of notes) if (!sounding(held, chords, note)) fires.push({ t: 'off', note })
}

function cutSounding(mem: AssignMem, fires: Fire[], axes: ArrayLike<number> | null | undefined, map: PadMap) {
  const notes = new Set<number>()
  for (const n of mem.held.values()) notes.add(n)
  for (const arr of mem.chords.values()) for (const n of arr) notes.add(n)
  mem.held.clear()
  mem.chords.clear()
  for (const n of notes) fires.push({ t: 'off', note: n })
  for (const c of CONTROLS) {
    if (c.kind !== 'axis') continue
    const fn = map[c.id]
    const shaped = shapeAxis(axisOf(axes, c.index), c.invert)
    if (shaped != null && (noteDegree(fn) != null || drumVoice(fn) != null || fn === 'chord')) mem.wait[c.id] = true
  }
}

function cloneMem(prev: AssignMem): AssignMem {
  const chords = new Map<string, number[]>()
  for (const [k, v] of prev.chords) chords.set(k, v.slice())
  const down = prev.down.length >= BUTTONS ? prev.down.slice() : freshAssign().down
  return {
    down, held: new Map(prev.held), chords, oct: prev.oct, holdOn: prev.holdOn,
    rollAt: { ...prev.rollAt }, captured: { ...prev.captured }, axisLive: { ...prev.axisLive }, wait: { ...prev.wait },
  }
}

/**
 * One poll. `notesFor(oct)` is the 8 scale notes. `now` is milliseconds (drum rolls).
 * `readParam` is the knob's current value, captured when a button takes it over.
 * A null button list is a pad that went away: notes stop and borrowed knobs go back.
 */
export function stepAssign(
  prev: AssignMem,
  buttons: ArrayLike<BtnLike | null> | null | undefined,
  axes: ArrayLike<number> | null | undefined,
  map: PadMap,
  notesFor: (oct: number) => readonly number[],
  now: number,
  readParam: (key: ParamKey) => number = (key) => (RANGES[key].min + RANGES[key].max) / 2,
): AssignStep {
  const fires: Fire[] = []
  const mem = cloneMem(prev)
  const live = (c: ControlDef): boolean => {
    if (c.kind !== 'button') return false
    const b = at(buttons, c.index)
    return !!b && heldDown(b, !!c.analog)
  }

  let dOct = 0
  let cut = false
  for (const c of CONTROLS) {
    if (c.kind !== 'button') continue
    const nowDown = live(c)
    const was = !!prev.down[c.index]
    if (!nowDown || was) continue
    const fn = map[c.id]
    if (fn === 'oct-') dOct -= 1
    else if (fn === 'oct+') dOct += 1
    else if (fn === 'letgo' || fn === 'panic') {
      cut = true
      if (fn === 'panic') fires.push({ t: 'panic' })
    }
  }
  if (dOct) mem.oct = clampOct(mem.oct + dOct)
  if (cut) cutSounding(mem, fires, axes, map)

  let loud = false
  let quiet = false
  for (const c of CONTROLS) {
    if (c.kind !== 'button' || !live(c)) continue
    if (map[c.id] === 'loud') loud = true
    else if (map[c.id] === 'quiet') quiet = true
  }
  const vel = loud ? VEL_LOUD : quiet ? VEL_SOFT : VEL_MID
  const scale = notesFor(mem.oct)

  for (const c of CONTROLS) {
    const fn = map[c.id]
    if (c.kind === 'button') {
      const b = at(buttons, c.index)
      const nowDown = !!b && heldDown(b, !!c.analog)
      const was = !!prev.down[c.index]
      mem.down[c.index] = nowDown
      if (!nowDown) mem.wait[c.id] = false

      if (c.analog && isParam(fn)) {
        const amount = b ? triggerAmount(b) : null
        if (amount == null) {
          if (mem.captured[c.id] != null) {
            fires.push({ t: 'param', key: fn, value: mem.captured[c.id] })
            delete mem.captured[c.id]
            mem.axisLive[c.id] = null
          }
        } else {
          if (mem.captured[c.id] == null) mem.captured[c.id] = readParam(fn)
          const value = lerp(fn, amount)
          const last = mem.axisLive[c.id]
          if (last == null || !near(fn, last, value)) {
            mem.axisLive[c.id] = value
            fires.push({ t: 'param', key: fn, value })
          }
        }
        continue
      }

      if (!nowDown && was) {
        releaseNote(mem.held, mem.chords, c.id, fires)
        releaseChord(mem.held, mem.chords, c.id, fires)
        if (isParam(fn) && mem.captured[c.id] != null) {
          fires.push({ t: 'param', key: fn, value: mem.captured[c.id] })
          delete mem.captured[c.id]
        }
        if (fn === 'hold' && mem.holdOn && !CONTROLS.some((o) => o.id !== c.id && map[o.id] === 'hold' && live(o))) {
          mem.holdOn = false
          fires.push({ t: 'hold', on: false })
        }
      }
      if (!(nowDown && !was) || mem.wait[c.id] || fn === 'off') continue

      const degree = noteDegree(fn)
      if (degree != null) {
        const note = scale[degree]
        if (note != null && Number.isFinite(note)) {
          releaseNote(mem.held, mem.chords, c.id, fires)
          mem.held.set(c.id, note)
          fires.push({ t: 'on', note, vel })
        }
        continue
      }
      const voice = drumVoice(fn)
      if (voice != null) {
        let dv = vel / 127
        if (c.analog && b) {
          const amount = triggerAmount(b)
          if (amount != null) dv = Math.min(1, 0.35 + 0.65 * amount)
        }
        fires.push({ t: 'drum', voice, vel: dv })
        continue
      }
      if (fn === 'chord') {
        const chord = [0, 2, 4].map((i) => scale[i]).filter((n) => n != null && Number.isFinite(n))
        mem.chords.set(c.id, chord)
        for (const note of chord) fires.push({ t: 'on', note, vel })
        continue
      }
      const wave = waveOf(fn)
      if (wave) { fires.push({ t: 'wave', wave }); continue }
      if (isParam(fn)) {
        mem.captured[c.id] = readParam(fn)
        fires.push({ t: 'param', key: fn, value: buttonParamValue(fn) })
        continue
      }
      if (fn === 'hold' && !mem.holdOn) { mem.holdOn = true; fires.push({ t: 'hold', on: true }) }
      else if (fn === 'start') fires.push({ t: 'start' })
      else if (fn === 'tap') fires.push({ t: 'tap' })
      else if (fn === 'picture') fires.push({ t: 'picture' })
      continue
    }

    const shaped = shapeAxis(axisOf(axes, c.index), c.invert)
    if (shaped == null) {
      mem.wait[c.id] = false
      delete mem.rollAt[c.id]
      releaseNote(mem.held, mem.chords, c.id, fires)
      releaseChord(mem.held, mem.chords, c.id, fires)
      if (fn === 'bend' && mem.axisLive[c.id] != null) fires.push({ t: 'param', key: 'bend', value: 0 })
      if (springWheel(map, c, fn) && mem.axisLive[c.id] != null) fires.push({ t: 'param', key: 'lfoDepth', value: 0 })
      if (isParam(fn)) mem.axisLive[c.id] = null
      continue
    }
    if (mem.wait[c.id]) continue
    const degree = noteDegree(fn)
    if (degree != null) {
      if (!mem.held.has(c.id)) {
        const note = scale[degree]
        if (note != null && Number.isFinite(note)) {
          mem.held.set(c.id, note)
          fires.push({ t: 'on', note, vel })
        }
      }
      continue
    }
    const voice = drumVoice(fn)
    if (voice != null) {
      const last = mem.rollAt[c.id] ?? -Infinity
      if (now - last >= ROLL_MS) {
        mem.rollAt[c.id] = now
        const mag = Math.min(1, Math.abs(shaped))
        fires.push({ t: 'drum', voice, vel: Math.min(1, (vel / 127) * (0.45 + 0.55 * mag)) })
      }
      continue
    }
    if (fn === 'chord') {
      if (!mem.chords.has(c.id)) {
        const chord = [0, 2, 4].map((i) => scale[i]).filter((n) => n != null && Number.isFinite(n))
        mem.chords.set(c.id, chord)
        for (const note of chord) fires.push({ t: 'on', note, vel })
      }
      continue
    }
    if (!isParam(fn)) continue
    const wheel = springWheel(map, c, fn)
    const value = fn === 'bend' ? shaped * RANGES.bend.max : wheel ? lerp(fn, Math.max(0, shaped)) : lerp(fn, (shaped + 1) / 2)
    const last = mem.axisLive[c.id]
    if (wheel && value === RANGES[fn].min && last == null) continue
    if (last == null || !near(fn, last, value)) {
      mem.axisLive[c.id] = value
      fires.push({ t: 'param', key: fn, value })
    }
  }
  return { mem, fires }
}

/** Let go of notes this pad is holding. Buttons that are still down do not strike again. Knob moves stay. */
export function quietAssign(
  prev: AssignMem,
  buttons: ArrayLike<BtnLike | null> | null | undefined,
  axes: ArrayLike<number> | null | undefined,
  map: PadMap,
): AssignStep {
  const fires: Fire[] = []
  const mem = cloneMem(prev)
  const notes = new Set<number>()
  for (const n of mem.held.values()) notes.add(n)
  for (const arr of mem.chords.values()) for (const n of arr) notes.add(n)
  mem.held.clear()
  mem.chords.clear()
  for (const n of notes) fires.push({ t: 'off', note: n })
  if (mem.holdOn) { mem.holdOn = false; fires.push({ t: 'hold', on: false }) }
  mem.rollAt = {}
  for (const c of CONTROLS) {
    if (c.kind === 'button') {
      const b = at(buttons, c.index)
      mem.down[c.index] = !!b && heldDown(b, !!c.analog)
      continue
    }
    const fn = map[c.id]
    const shaped = shapeAxis(axisOf(axes, c.index), c.invert)
    if (shaped != null && (noteDegree(fn) != null || drumVoice(fn) != null || fn === 'chord')) mem.wait[c.id] = true
    else if (shaped == null) mem.wait[c.id] = false
  }
  return { mem, fires }
}
