// Game Kode powers: pure logic (no DOM, no audio, no storage) so scripts/game-kode-fixtures.ts can test it.
// Each game gains ONE opt-in "Kode power" that teaches a real programming idea through play.
import type { Pal } from '../fashion/data'

export type KodeConcept = 'sequence' | 'loop' | 'function' | 'parameter' | 'event' | 'condition' | 'parallel' | 'random' | 'recursion' | 'debug' | 'variable'

/** what each game teaches, for the Koog App Store listing (the lead wires these into src/kode/kore/apps.ts) */
export const GAME_CONCEPTS: Record<string, { name: string; icon: string; concepts: KodeConcept[]; power: string; kid: string }> = {
  bachdoom: { name: 'BachDoom', icon: '💀', concepts: ['function', 'parameter'], power: 'Spells', kid: 'A function is a recipe with a name. Play its call sign and the whole recipe runs. Play it higher and it hits harder: that is a parameter.' },
  zombielanes: { name: 'Zombie Lanes', icon: '🧟', concepts: ['sequence', 'loop', 'event'], power: 'Turret program', kid: 'A program is steps in order (a sequence). A loop repeats them. An event rule waits for something to happen, then acts.' },
  jiujitsu: { name: 'Jiu-Jitsu Flow', icon: '🥋', concepts: ['function', 'loop'], power: 'Combos', kid: 'Save a chain of moves with a name. Play its call sign and the whole chain runs. Drill it three times and that is a loop.' },
  fashion: { name: 'Runway Remix', icon: '👗', concepts: ['function', 'parameter', 'sequence'], power: 'Looks', kid: 'A look is a recipe with blanks: look(color, extra). The chord you play fills the blanks. A show is looks in order.' },
  memory: { name: 'Phrase Match', icon: '🃏', concepts: ['variable', 'sequence'], power: 'Kode cards', kid: 'A variable is a name that holds something. Win a pair and its tune gets a name, like a = "c e g". Then play b a b.' },
}

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
export const noteWord = (n: number) => NAMES[((n % 12) + 12) % 12]
export const phraseText = (notes: number[]) => notes.map(noteWord).join(' ')

// ---------------- call signs (function) ----------------
export const intervals = (n: number[]) => n.slice(1).map((x, i) => x - n[i])
/** the call sign of a saved motif: its first three notes */
export const callSignOf = (notes: number[]) => notes.slice(0, 3)
/** do the most recent notes play this call sign (same steps up and down, in any octave)? */
export function signMatches(played: number[], sign: number[]): boolean {
  if (sign.length < 2 || played.length < sign.length) return false
  const tail = played.slice(-sign.length)
  const a = intervals(tail), b = intervals(sign)
  return a.every((v, i) => v === b[i])
}
/** which spell (if any) was just cast. A longer call sign wins; ties go to the first saved. */
export function castMatch<T extends { sign: number[] }>(played: number[], spells: T[]): T | null {
  let best: T | null = null
  for (const s of spells) if (signMatches(played, s.sign) && (!best || s.sign.length > best.sign.length)) best = s
  return best
}
/** keep only notes that follow each other within `gap` ms */
export function pushRecent(buf: { n: number; t: number }[], n: number, t: number, gap = 1400, max = 6) {
  const r = buf.filter((x) => t - x.t <= gap)
  r.push({ n, t })
  return r.slice(-max)
}
/** PARAMETER: the higher the call sign is played (closer to the melody), the harder the spell hits. */
export function spellPower(minMelody: number, firstNote: number): 1 | 2 | 3 {
  const d = minMelody - firstNote
  return d <= 12 ? 3 : d <= 24 ? 2 : 1
}
export const spellDamage = (power: number) => 1 + Math.max(1, Math.min(3, power))
/** spell charges: one for every 5 hits in a row, never more than 3 */
export const chargesAfter = (charges: number, streak: number) => (streak > 0 && streak % 5 === 0 ? Math.min(3, charges + 1) : charges)

// ---------------- turret program (sequence + loop + event) ----------------
export const TURRET_LANES = 4
/** SEQUENCE + LOOP: [1,3,2,4] x 2 = 1,3,2,4,1,3,2,4 */
export function expandPattern(pattern: number[], repeat: number): number[] {
  const n = Math.max(1, Math.min(4, Math.round(repeat) || 1))
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(...pattern)
  return out.slice(0, 24)
}
/** which of the four turret lanes (1..4, left to right) an x position is in */
export const turretLane = (x: number, w: number, lanes = TURRET_LANES) => Math.max(1, Math.min(lanes, Math.floor((x / Math.max(1, w)) * lanes) + 1))
export interface TurretProg { pattern: number[]; repeat: number; event: boolean }
export const turretSecs = 1.5 // one shot every two beats at 80 bpm
/** EVENT rule: fire only when a zombie is this far down its lane, and only while shots remain */
export const EVENT_P = 0.82
export const EVENT_SHOTS = 3

// ---------------- combos (function + loop) ----------------
export interface DrillTick { at: number; rung: number; rep: number; step: number }
/** the timeline of a combo performed `reps` times, one position every `secs` seconds */
export function drillSchedule(steps: number[], reps: number, secs = 1.1): DrillTick[] {
  const out: DrillTick[] = []
  const n = Math.max(1, Math.min(3, Math.round(reps) || 1))
  for (let r = 0; r < n; r++) steps.forEach((rung, i) => out.push({ at: out.length * secs, rung, rep: r, step: i }))
  return out
}

// ---------------- looks (function + parameters + sequence) ----------------
export interface KLook { id: number; name: string; emoji: string; era: string; items: number[] }
export interface ChordArg { root: number; q: Pal['q'] }
/** FUNCTION with PARAMETERS: look(color, extra). The chord is the colour; its root note picks the extra (accessory). */
export function applyLook(look: Pick<KLook, 'items'>, chord: ChordArg, accCount: number): { items: number[]; pal: Pal; accIx: number } {
  const accIx = accCount > 0 ? ((chord.root % 12) + 12) % 12 % accCount : 0
  const items = look.items.slice(0, 5)
  while (items.length < 5) items.push(0)
  items[4] = accIx
  return { items, pal: { root: chord.root, q: chord.q }, accIx }
}
/** a show program: up to three looks, each with its own chord, run in order */
export interface ShowStep { lookId: number; chord: ChordArg }
export const showOrder = (steps: ShowStep[]) => steps.slice(0, 3)

// ---------------- Kode cards (variables) ----------------
export const varName = (i: number) => String.fromCharCode(97 + (i % 26))
export interface KVar { name: string; notes: number[] }
export const varLine = (v: KVar) => `${v.name} = "${phraseText(v.notes)}"`
/** an expression like "b a b" becomes the notes to play, in order */
export function exprNotes(vars: KVar[], expr: string[]): number[] {
  const out: number[] = []
  for (const e of expr) { const v = vars.find((x) => x.name === e); if (!v) return []; out.push(...v.notes) }
  return out
}
/** pick three names from the variables (with a repeat when there are only two) */
export function makeExpr(vars: KVar[], rnd: () => number = Math.random): string[] {
  const names = vars.map((v) => v.name)
  if (names.length < 2) return names.slice()
  const pick = () => names[Math.floor(rnd() * names.length)]
  for (let t = 0; t < 20; t++) {
    const e = [pick(), pick(), pick()]
    if (new Set(e).size >= 2) return e
  }
  return [names[0], names[1], names[0]]
}
export const exprText = (e: string[]) => e.join(' ')
/** is this note right for the next step of the expression? easy compares note names only */
export const noteOk = (want: number, got: number, loose: boolean) => (loose ? ((want % 12) + 12) % 12 === ((got % 12) + 12) % 12 : want === got)
