// Drum pads: the pure rules (no DOM, no audio) so scripts/drum-fixtures.ts can test them under node.
// A pattern is 8 drum rows x up to 32 sixteenth-note steps. A cell holds a velocity 0..1 (0 = no hit).
// STABLE API: VOICES, newPattern, nearestStep, swingOffset, stepBeats, recordHit, clearRow, clearAll, setLength, toggleCell, repeatPositions, parsePattern, STARTERS.
// Added in round 2: four pattern banks (A-D), an accent track, per-drum mute and solo, copy bar 1 to bar 2, a roll fill, step-edit pages, the status line.

export const STEPS_1 = 16
export const STEPS_MAX = 32
export type BarLen = 16 | 32

export interface VoiceDef { id: string; label: string; emoji: string; hue: number }
/** pad order: pad1.A..pad4.A = 0..3, pad1.B..pad4.B = 4..7 */
export const VOICES: VoiceDef[] = [
  { id: 'kick', label: 'KICK', emoji: '🥁', hue: 350 },
  { id: 'snare', label: 'SNARE', emoji: '🪘', hue: 28 },
  { id: 'hat', label: 'HAT', emoji: '🎩', hue: 52 },
  { id: 'open', label: 'OPEN', emoji: '💥', hue: 95 },
  { id: 'clap', label: 'CLAP', emoji: '👏', hue: 160 },
  { id: 'tomLo', label: 'LO TOM', emoji: '🔵', hue: 205 },
  { id: 'tomHi', label: 'HI TOM', emoji: '🟣', hue: 265 },
  { id: 'rim', label: 'RIM', emoji: '🔔', hue: 310 },
]
export const N_VOICES = VOICES.length

/** `acc` is the accent track: 1 on a step makes every drum on that step play louder (see effVel). */
export interface Pattern { len: BarLen; rows: number[][]; acc: number[] }

export const newPattern = (len: BarLen = 16): Pattern => ({ len, rows: VOICES.map(() => new Array<number>(STEPS_MAX).fill(0)), acc: new Array<number>(STEPS_MAX).fill(0) })
export const clonePattern = (p: Pattern): Pattern => ({ len: p.len, rows: p.rows.map((r) => r.slice()), acc: p.acc.slice() })
export const isEmpty = (p: Pattern) => p.rows.every((r) => r.every((v) => v <= 0))
export const rowEmpty = (p: Pattern, voice: number) => p.rows[voice].every((v) => v <= 0)

/** the step (0..len-1) nearest to a position measured in 16ths since the clock's beat 0 (a hit just before the downbeat lands on step 0) */
export function nearestStep(posSteps: number, len: number = STEPS_1): number {
  const n = Math.round(posSteps)
  return ((n % len) + len) % len
}

/** swing amount 0..0.6 -> how far (in steps) every second 16th is delayed. 0.6 = a full triplet feel (1/3 of a step). */
export const clampSwing = (s: number) => Math.min(0.6, Math.max(0, Number.isFinite(s) ? s : 0))
export function swingOffset(step: number, swing: number): number {
  return ((step % 2) + 2) % 2 === 1 ? clampSwing(swing) / 1.8 : 0
}
/** the time of absolute 16th `n` in beats (4 sixteenths per beat), swing included */
export const stepBeats = (n: number, swing: number) => (n + swingOffset(n, swing)) / 4

/** write a hit (record mode). Keeps the louder of the old and new velocity. Returns the step it landed on. */
export function recordHit(p: Pattern, voice: number, posSteps: number, vel: number): number {
  const s = nearestStep(posSteps, p.len)
  p.rows[voice][s] = Math.max(p.rows[voice][s], Math.min(1, Math.max(0.1, vel)))
  return s
}
export function clearRow(p: Pattern, voice: number) { p.rows[voice].fill(0) }
export function clearAll(p: Pattern) { for (const r of p.rows) r.fill(0); p.acc.fill(0) }

/** 16 <-> 32 steps. Growing from an empty second bar copies bar 1 (same groove, ready to vary); shrinking keeps the data so growing again brings it back. */
export function setLength(p: Pattern, len: BarLen) {
  if (len === p.len) return
  if (len === 32) {
    const second = p.rows.every((r) => r.slice(16, 32).every((v) => v <= 0))
    if (second) { for (const r of p.rows) for (let i = 0; i < 16; i++) r[16 + i] = r[i]; for (let i = 0; i < 16; i++) p.acc[16 + i] = p.acc[i] }
  }
  p.len = len
}
export function toggleCell(p: Pattern, voice: number, step: number): boolean {
  if (step < 0 || step >= STEPS_MAX) return false
  const on = p.rows[voice][step] <= 0
  p.rows[voice][step] = on ? 1 : 0
  return on
}

/** which grid points (in steps) fall in (from, to] for a note-repeat rate (in steps: 2 = 1/8 notes, 1 = 1/16). `skipWithin` drops a point that comes too soon after `from`. */
export function repeatPositions(from: number, to: number, rate: number, skipWithin = 0): number[] {
  if (!(rate > 0) || to <= from) return []
  const out: number[] = []
  for (let k = Math.floor(from / rate) + 1; k * rate <= to + 1e-9; k++) {
    const x = k * rate
    if (x - from < skipWithin) continue
    out.push(x)
  }
  return out
}
export const REPEAT_RATES = [0, 2, 1] as const // off, 1/8, 1/16 (in steps)
export const REPEAT_NAMES = ['Off', '1/8', '1/16']

// ---------- hold gestures ----------
export const ROW_CLEAR_MS = 1000
export const CLEAR_ALL_MS = 2000
export const UNDO_HOLD_MS = 700
/** velocity from a MIDI note-on (1..127) -> 0.3..1 (a pad that sends 0 or nothing counts as full) */
export const velocityOf = (v: number | undefined) => (v && v > 0 ? 0.3 + 0.7 * Math.min(1, v / 127) : 1)

// ---------- fader / knob maps (0..1) ----------
export const bpmOfFader = (v: number) => 60 + v * 120
export const faderOfBpm = (b: number) => Math.min(1, Math.max(0, (b - 60) / 120))
export const pick3 = (v: number) => (v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2)

// ---------- starter patterns: original, simple. X = full hit, x = soft hit, . = rest. Rows in VOICES order. ----------
export interface Starter { id: string; name: string; bpm: number; rows: string[] }
export const STARTERS: Starter[] = [
  { id: 'rock', name: 'Basic rock', bpm: 100, rows: [
    'X.......X.X.....', '....X.......X...', 'X.X.X.X.X.X.X.X.', '................', '................', '................', '................', '................'] },
  { id: 'hiphop', name: 'Hip-hop', bpm: 90, rows: [
    'X.....x...X.....', '....X.......X...', 'X.X.X.X.X.X.X.xX', '..............X.', '................', '................', '................', '................'] },
  { id: 'four', name: 'Four on the floor', bpm: 122, rows: [
    'X...X...X...X...', '................', '..x...x...x...x.', '..X...X...X...X.', '....X.......X...', '................', '................', '................'] },
  { id: 'funky', name: 'Funky', bpm: 104, rows: [
    'X..x..X...X.x...', '....X..x.x..X..x', 'XxXxXxXxXxXxXxXx', '......X.......X.', '................', '..........x...X.', '.............x..', 'X...........X...'] },
]
export function parsePattern(rows: string[], len: BarLen = 16): Pattern {
  const p = newPattern(len)
  rows.forEach((r, v) => { if (v < N_VOICES) for (let i = 0; i < Math.min(r.length, STEPS_MAX); i++) p.rows[v][i] = r[i] === 'X' ? 1 : r[i] === 'x' ? 0.55 : 0 })
  return p
}

// ---------- round 2: banks, accent, mute / solo, copy, fill, step-edit pages, status ----------
export const N_BANKS = 4
export const BANK_NAMES = ['A', 'B', 'C', 'D']
/** velocity a pattern step plays at: an accented step is full strength, the rest sit at 80% so the accent is clearly louder */
export const ACCENT_GAIN = 1, NORMAL_GAIN = 0.8
export const effVel = (vel: number, accent: boolean) => Math.min(1, vel * (accent ? ACCENT_GAIN : NORMAL_GAIN))
export function toggleAccent(p: Pattern, step: number): boolean {
  if (step < 0 || step >= STEPS_MAX) return false
  const on = !(p.acc[step] > 0); p.acc[step] = on ? 1 : 0; return on
}
/** copy bar 1 onto bar 2 (and make the pattern two bars long). Bar 1 is never changed. */
export function copyBar(p: Pattern) {
  p.len = 32
  for (const r of p.rows) for (let i = 0; i < 16; i++) r[16 + i] = r[i]
  for (let i = 0; i < 16; i++) p.acc[16 + i] = p.acc[i]
}
/** does a drum sound from the pattern? Solo wins over mute: with any solo on, only soloed drums play. */
export function audible(voice: number, mute: boolean[], solo: boolean[]): boolean {
  return solo.some(Boolean) ? !!solo[voice] : !mute[voice]
}
/** the bank to play after `cur` when chaining: the next bank that has something in it (cycles; stays on `cur` when it is the only one) */
export function nextBank(cur: number, filled: boolean[]): number {
  for (let k = 1; k <= N_BANKS; k++) { const b = (cur + k) % N_BANKS; if (filled[b]) return b }
  return cur
}
/** a queued pattern change happens on the first step of a cycle of the playing pattern (the bar line) */
export const atBarLine = (n: number, patStart: number, len: number) => (((n - patStart) % len) + len) % len === 0
/** a hold-to-roll fill: 16th notes whose velocity swells from 0.45 to 1 over two beats */
export const fillVel = (elapsedBeats: number) => 0.45 + 0.55 * Math.min(1, Math.max(0, elapsedBeats / 2))
/** step edit: the pads (0-7) toggle one page of 8 steps. A 1-bar pattern has 2 pages, a 2-bar pattern 4. */
export const STEP_PAGE = 8
export const pagesOf = (len: number) => Math.max(1, Math.floor(len / STEP_PAGE))
export const stepOfPad = (page: number, pad: number) => page * STEP_PAGE + pad
/** the name of a pad on the controller: A1..A4 (deck A, left) and B1..B4 (deck B, right) */
export const padName = (voice: number) => (voice < 4 ? 'A' : 'B') + ((voice % 4) + 1)

export interface StatusIn { running: boolean; rec: boolean; bank: number; queued: number; chain: boolean; kitName: string; bpm: number; edit: boolean; editVoice: number; page: number; pages: number; muted: number; solo: number; fill: boolean }
/** the one-line status under the title */
export function statusLine(s: StatusIn): string {
  const bits: string[] = []
  bits.push(s.running ? (s.rec ? 'RECORDING' : 'PLAYING') : s.rec ? 'REC ARMED' : 'STOPPED')
  bits.push(`Pattern ${BANK_NAMES[s.bank]}${s.queued >= 0 ? ` then ${BANK_NAMES[s.queued]} at the bar line` : ''}${s.chain ? ' (chain on)' : ''}`)
  bits.push(`${s.kitName} kit, ${Math.round(s.bpm)} bpm`)
  if (s.edit) bits.push(`STEP EDIT: ${VOICES[s.editVoice].label}, steps ${s.page * STEP_PAGE + 1}-${s.page * STEP_PAGE + STEP_PAGE} (page ${s.page + 1} of ${s.pages})`)
  if (s.solo) bits.push(`${s.solo} solo`); else if (s.muted) bits.push(`${s.muted} muted`)
  if (s.fill) bits.push('FILL')
  return bits.join(' · ')
}

/** The control map, one row per control. The help card on screen and the fixtures both read this, so the two cannot drift apart. */
export const HELP_MAP: { keys: string; does: string }[] = [
  { keys: 'Pads A1-A4 (left) and B1-B4 (right)', does: 'KICK SNARE HAT OPEN and CLAP LO-TOM HI-TOM RIM. Hit harder, louder. Light up when their drum sounds.' },
  { keys: 'PLAY', does: 'Start or stop the beat. Hold 2 seconds to clear everything.' },
  { keys: 'CUE', does: 'Record on or off. Hold 0.7 seconds to undo the last take. CUE + a pad erases that drum.' },
  { keys: 'SYNC', does: 'Tap tempo (tap it in time). SYNC + a pad mutes that drum.' },
  { keys: 'PLAY + a pad', does: 'Solo that drum: only soloed drums play.' },
  { keys: 'PAD MODE B', does: 'Next drum kit.' },
  { keys: 'PAD MODE + A1 A2 A3 A4', does: 'Choose pattern A, B, C or D. While playing it waits for the end of the bar.' },
  { keys: 'PAD MODE + B1 / B2 / B3', does: 'B1 chain the patterns, B2 copy bar 1 to bar 2, B3 all drums back on.' },
  { keys: 'PAD MODE + B4 (hold)', does: 'FILL: a fast roll that gets louder. It is never recorded.' },
  { keys: 'PAD MODE A', does: 'STEP EDIT on or off. The 8 pads become steps 1-8 and a lit pad is a step that is on.' },
  { keys: 'In step edit', does: 'Tap a pad to flip a step. PAD MODE B shows the next 8 steps. JOG B or SYNC + a pad picks the drum. CUE + a pad makes an accent (louder step).' },
  { keys: 'Faders and knobs', does: 'TEMPO bpm, VOL A drum volume, VOL B beat level, JOG A swing, JOG B fine tempo. Deck A knobs shape the last drum (pitch, decay, tone). Deck B knobs: kit, bars, roll.' },
]

// ---------- undo of recording passes ----------
export interface UndoStack { snaps: Pattern[] }
export const newUndo = (): UndoStack => ({ snaps: [] })
export function pushUndo(u: UndoStack, p: Pattern) { u.snaps.push(clonePattern(p)); if (u.snaps.length > 8) u.snaps.shift() }
/** restore the most recent snapshot into p; false when there is nothing to undo */
export function popUndo(u: UndoStack, p: Pattern): boolean {
  const s = u.snaps.pop(); if (!s) return false
  p.len = s.len; p.rows = s.rows.map((r) => r.slice()); p.acc = s.acc.slice()
  return true
}

// ---------- serialising ----------
/** Saved data (localStorage 'drumpads.v1' via pkey). Top-level len/rows/acc are pattern A, exactly as the first build saved them, so old saves load and
 *  an old build still reads a new save (it sees pattern A). `more` holds B, C, D; the rest are optional and default when missing. */
export interface PatData { len: BarLen; rows: number[][]; acc?: number[] }
export interface Saved {
  len: BarLen; rows: number[][]; acc?: number[]; kit: number; swing: number; vol: number; patVol: number; repeat: number; tweak: Tweak[]
  more?: PatData[]; bank?: number; chain?: boolean; mute?: boolean[]; solo?: boolean[]
}
export interface Tweak { pitch: number; decay: number; tone: number } // pitch -1..1 (about +/-7 semitones), decay 0..1 (0.5 = normal), tone 0..1 (1 = open)
export const defaultTweak = (): Tweak => ({ pitch: 0, decay: 0.5, tone: 1 })
const cleanRows = (src: unknown) => VOICES.map((_, i) => {
  const r = Array.isArray((src as unknown[] | undefined)?.[i]) ? (src as unknown[][])[i] : []
  return Array.from({ length: STEPS_MAX }, (_, s) => { const x = Number(r[s]); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0 })
})
const cleanAcc = (a: unknown) => Array.from({ length: STEPS_MAX }, (_, s) => (Array.isArray(a) && Number(a[s]) > 0 ? 1 : 0))
const cleanBools = (a: unknown) => VOICES.map((_, i) => Array.isArray(a) && a[i] === true)
/** a saved blob -> a clean Saved, or null when it is not one. Always returns acc, more (3 entries), bank, chain, mute and solo filled in. */
export function reviveSaved(v: unknown): Saved | null {
  try {
    const o = v as Partial<Saved>
    if (!o || !Array.isArray(o.rows)) return null
    const rows = cleanRows(o.rows)
    const n = (x: unknown, d: number, lo: number, hi: number) => { const y = Number(x); return Number.isFinite(y) ? Math.min(hi, Math.max(lo, y)) : d }
    const tweak = VOICES.map((_, i) => { const t = (o.tweak?.[i] ?? {}) as Partial<Tweak>; return { pitch: n(t.pitch, 0, -1, 1), decay: n(t.decay, 0.5, 0, 1), tone: n(t.tone, 1, 0, 1) } })
    const more: PatData[] = Array.from({ length: N_BANKS - 1 }, (_, i) => {
      const m = Array.isArray(o.more) ? (o.more[i] as Partial<PatData> | undefined) : undefined
      return { len: (m?.len === 32 ? 32 : 16) as BarLen, rows: cleanRows(m?.rows), acc: cleanAcc(m?.acc) }
    })
    return {
      len: o.len === 32 ? 32 : 16, rows, acc: cleanAcc(o.acc), kit: Math.round(n(o.kit, 0, 0, 2)), swing: n(o.swing, 0, 0, 0.6), vol: n(o.vol, 0.8, 0, 1), patVol: n(o.patVol, 1, 0, 1), repeat: Math.round(n(o.repeat, 0, 0, 2)), tweak,
      more, bank: Math.round(n(o.bank, 0, 0, N_BANKS - 1)), chain: o.chain === true, mute: cleanBools(o.mute), solo: cleanBools(o.solo),
    }
  } catch { return null }
}
