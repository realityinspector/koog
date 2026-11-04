// Dancer Choreographer, the pure part: the routine data model, compile/flatten, event + condition evaluation,
// puzzle goal checks and the share-link codec. No DOM, no stores, no eval: a routine is DATA, never code.
// scripts/choreo-fixtures.ts tests all of this with plain numbers.

// ---------------------------------------------------------------- moves
export type MoveId = 'spin' | 'moonwalk' | 'jump' | 'waveL' | 'waveR' | 'robot' | 'clap' | 'bow' | 'shimmy' | 'sprinkler' | 'kick' | 'sway'
export interface MoveDef { id: MoveId; name: string; emoji: string }
export const MOVES: MoveDef[] = [
  { id: 'spin', name: 'Spin', emoji: '🌀' }, { id: 'moonwalk', name: 'Moonwalk', emoji: '🌙' }, { id: 'jump', name: 'Jump', emoji: '🦘' },
  { id: 'waveL', name: 'Wave left', emoji: '👈' }, { id: 'waveR', name: 'Wave right', emoji: '👉' }, { id: 'robot', name: 'Robot', emoji: '🤖' },
  { id: 'clap', name: 'Clap', emoji: '👏' }, { id: 'bow', name: 'Bow', emoji: '🙇' }, { id: 'shimmy', name: 'Shimmy', emoji: '✨' },
  { id: 'sprinkler', name: 'Sprinkler', emoji: '💦' }, { id: 'kick', name: 'High kick', emoji: '🦵' }, { id: 'sway', name: 'Sway', emoji: '🎵' },
]
export const MOVE_IDS = MOVES.map((m) => m.id)
export const moveDef = (id: string): MoveDef => MOVES.find((m) => m.id === id) ?? MOVES[11]
export const isMoveId = (s: unknown): s is MoveId => typeof s === 'string' && (MOVE_IDS as string[]).includes(s)

// ---------------------------------------------------------------- model
export type Arg = 's' | 'm' | 'l'
export type EvKind = 'kick' | 'snare' | 'loud' | 'high'
export type CondKind = 'high' | 'loud'
export const EV_KINDS: EvKind[] = ['kick', 'snare', 'loud', 'high']
export const COND_KINDS: CondKind[] = ['high', 'loud']
export const EV_LABEL: Record<EvKind, string> = { kick: 'the kick drum hits', snare: 'the snare hits', loud: 'a loud note plays', high: 'a high note plays' }
export const COND_LABEL: Record<CondKind, string> = { high: 'the note is high', loud: 'the note is loud' }

/** a function: a name plus a body. The body is "do this move"; the call sign is the motif the kid plays. */
export interface Fn { id: string; name: string; emoji: string; notes: number[]; move: MoveId; vel: number; builtin?: boolean }
export type FnTable = Record<string, Fn>

export type Node =
  | { k: 'call'; fn: string; a?: Arg }
  | { k: 'repeat'; n: number; body: Node[] }
  | { k: 'if'; c: CondKind; then: Node[]; else: Node[] }
export interface Rule { ev: EvKind; body: Node[] }
export interface Routine { v: 1; name: string; bpm: number; nodes: Node[]; rules: Rule[] }

export const emptyRoutine = (name = 'My dance'): Routine => ({ v: 1, name, bpm: 100, nodes: [], rules: [] })

export const SEQ_BEATS = 2 // a move in the main lane takes two beats
export const REACT_BEATS = 1 // a "when" reaction takes one beat
export const HIGH_PITCH = 69 // A4 and up counts as a high note
export const LOUD_VEL = 0.75
export const MAX_REPEAT = 8
export const MAX_STEPS = 64
export const BPM_MIN = 60
export const BPM_MAX = 160 // at most 160 beats a minute: the beat light never flashes more than 3 times a second

// ---------------------------------------------------------------- functions the dancer already knows (built-in) + the puzzles' own
const F = (id: string, name: string, emoji: string, notes: number[], move: MoveId, vel = 0.6, builtin = false): Fn => ({ id, name, emoji, notes, move, vel, builtin })
/** "Built-in functions": tunes he already knows (public-domain openings, the same ones the Dancer's secret tunes use). */
export const BUILTINS: Fn[] = [
  F('bbday', 'Birthday bow', '🎂', [67, 67, 69, 67, 72], 'bow', 0.6, true),
  F('btwinkle', 'Twinkle sway', '⭐', [60, 60, 67, 67, 69, 69], 'sway', 0.6, true),
  F('bode', 'Ode clap', '😀', [64, 64, 65, 67, 67, 65], 'clap', 0.6, true),
]
/** the sounds the puzzles hand you (each is a tiny function: a motif plus a move) */
export const PUZZLE_FNS: Fn[] = [
  F('jump', 'Hop', '🦘', [60, 64, 67], 'jump'), F('spin', 'Twirl', '🌀', [67, 64, 60], 'spin'),
  F('clap', 'Clap', '👏', [60, 62, 64], 'clap'), F('moon', 'Glide', '🌙', [57, 55, 52], 'moonwalk'),
  F('bow', 'Bow', '🙇', [72, 71, 67], 'bow'), F('robot', 'Robot', '🤖', [48, 51, 48], 'robot'),
  F('ding', 'Ding', '🔔', [76, 79], 'sway', 0.6), F('dong', 'Dong', '🔔', [48, 45], 'sway', 0.6),
  F('tap', 'Soft tap', '🤏', [64, 65], 'sway', 0.35), F('boom', 'BOOM', '💥', [64, 67], 'sway', 0.95),
  F('wl', 'Wave L', '👈', [72, 74], 'waveL'), F('wr', 'Wave R', '👉', [67, 65], 'waveR'),
]
export const tableOf = (...lists: Fn[][]): FnTable => { const t: FnTable = {}; for (const l of lists) for (const f of l) t[f.id] = f; return t }

// ---------------------------------------------------------------- paths + list access
/** Node paths: root "0", "2"; a repeat's body "2.0"; an if's branches "3.t0" / "3.e1"; a rule "r0", its body "r0.0". */
export type ListRef = { parent: string; part: '' | 't' | 'e' }
export const ROOT: ListRef = { parent: '', part: '' }
export const refKey = (r: ListRef) => (r.parent === '' ? 'root' : `${r.parent}|${r.part}`)
export const sameRef = (a: ListRef, b: ListRef) => a.parent === b.parent && a.part === b.part
const childPath = (parent: string, part: '' | 't' | 'e', i: number) => (parent === '' ? `${i}` : `${parent}.${part}${i}`)

export function getList(r: Routine, ref: ListRef): Node[] | null {
  if (ref.parent === '') return r.nodes
  const segs = ref.parent.split('.')
  let list: Node[]
  let k = 0
  const m = /^r(\d+)$/.exec(segs[0])
  if (m) { const rule = r.rules[Number(m[1])]; if (!rule) return null; list = rule.body; k = 1; if (segs.length === 1) return ref.part === '' ? list : null }
  else list = r.nodes
  let node: Node | undefined
  for (; k < segs.length; k++) {
    const s = segs[k]
    const mm = /^([te]?)(\d+)$/.exec(s)
    if (!mm) return null
    const idx = Number(mm[2])
    if (k === 0 || !node) node = list[idx]
    else if (node.k === 'repeat' && mm[1] === '') node = node.body[idx]
    else if (node.k === 'if' && mm[1] === 't') node = node.then[idx]
    else if (node.k === 'if' && mm[1] === 'e') node = node.else[idx]
    else return null
    if (!node) return null
  }
  if (!node) return null
  if (node.k === 'repeat' && ref.part === '') return node.body
  if (node.k === 'if' && ref.part === 't') return node.then
  if (node.k === 'if' && ref.part === 'e') return node.else
  return null
}

export function nodeAt(r: Routine, path: string): Node | null {
  const i = path.lastIndexOf('.')
  if (i < 0) { return /^\d+$/.test(path) ? r.nodes[Number(path)] ?? null : null }
  const parentPath = path.slice(0, i), last = path.slice(i + 1)
  const mm = /^([te]?)(\d+)$/.exec(last)
  if (!mm) return null
  const list = getList(r, { parent: parentPath, part: mm[1] as '' | 't' | 'e' })
  return list?.[Number(mm[2])] ?? null
}

/** every list in the routine with a label (for the editor) */
export function walk(r: Routine, fn: (n: Node, path: string, ref: ListRef, i: number) => void) {
  const go = (list: Node[], parent: string, part: '' | 't' | 'e') => {
    list.forEach((n, i) => {
      const p = childPath(parent, part, i)
      fn(n, p, { parent, part }, i)
      if (n.k === 'repeat') go(n.body, p, '')
      if (n.k === 'if') { go(n.then, p, 't'); go(n.else, p, 'e') }
    })
  }
  go(r.nodes, '', '')
  r.rules.forEach((rule, ri) => go(rule.body, `r${ri}`, ''))
}

export function blockCount(r: Routine): number {
  let n = r.rules.length
  walk(r, () => { n++ })
  return n
}

export interface Uses { repeat: boolean; when: boolean; cond: boolean; fn: boolean; param: boolean; calls: number }
/** which ideas the routine really uses (an empty repeat or an empty rule does not count) */
export function usesOf(r: Routine, fns: FnTable): Uses {
  const u: Uses = { repeat: false, when: false, cond: false, fn: false, param: false, calls: 0 }
  walk(r, (n) => {
    if (n.k === 'repeat' && n.body.length > 0) u.repeat = true
    if (n.k === 'if' && (n.then.length > 0 || n.else.length > 0)) u.cond = true
    if (n.k === 'call') { u.calls++; if (n.a && n.a !== 'm') u.param = true; if (fns[n.fn] && !fns[n.fn].builtin && /^u\d+$/.test(n.fn)) u.fn = true }
  })
  if (r.rules.some((x) => x.body.length > 0)) u.when = true
  return u
}

// ---------------------------------------------------------------- compile + flatten
export interface Step {
  fn: string; move: MoveId; a: Arg; beat: number; dur: number
  /** the block that made this step, and the blocks around it (repeat / if) for the debugger highlight */
  path: string; anc: string[]
  react?: EvKind
  /** a one-line "why" for the debugger */
  why: string
}
export interface PEvent { beat: number; kind: 'kick' | 'snare' | 'note'; pitch?: number; vel?: number }
export interface Plan {
  steps: Step[]; reacts: Step[]; events: PEvent[]; beats: number
  /** note events to sound: absolute beat, midi note, velocity */
  notes: { beat: number; n: number; vel: number; path: string }[]
  /** every step in time order (reactions after the main-lane step that starts at the same beat) */
  all: Step[]
  capped: boolean
}
export interface Env { pitch: number; vel: number }
export const DEFAULT_DRUMS = 'K.S.'

export const isHigh = (pitch: number) => pitch >= HIGH_PITCH
export const isLoud = (vel: number) => vel >= LOUD_VEL
export const condHolds = (c: CondKind, e: Env) => (c === 'high' ? isHigh(e.pitch) : isLoud(e.vel))
export const argOf = (a?: Arg): Arg => (a === 's' || a === 'l' ? a : 'm')
export const stepToken = (s: { move: MoveId; a: Arg }) => s.move + (s.a !== 'm' ? ':' + s.a : '')

/** expand repeats and evaluate ifs against the notes that played before. `reacts` is for the 1-beat reaction lane. */
function run(list: Node[], fns: FnTable, env: Env, beat0: number, dur: number, out: Step[], parent: string, part: '' | 't' | 'e', anc: string[], cap: { hit: boolean }, react?: EvKind): number {
  let beat = beat0
  for (let i = 0; i < list.length; i++) {
    if (out.length >= MAX_STEPS) { cap.hit = true; return beat }
    const n = list[i]
    const p = childPath(parent, part, i)
    if (n.k === 'call') {
      const f = fns[n.fn]
      if (!f) continue
      const a = argOf(n.a)
      out.push({ fn: f.id, move: f.move, a, beat, dur, path: p, anc, react, why: `${f.name}${a !== 'm' ? ' (' + (a === 's' ? 'small' : 'big') + ')' : ''}` })
      env.pitch = f.notes.length ? Math.max(...f.notes) : env.pitch
      env.vel = f.vel
      beat += dur
    } else if (n.k === 'repeat') {
      const times = Math.max(1, Math.min(MAX_REPEAT, Math.round(n.n)))
      for (let t = 0; t < times; t++) {
        const before = out.length
        beat = run(n.body, fns, env, beat, dur, out, p, '', [...anc, p], cap, react)
        for (let k = before; k < out.length; k++) if (!out[k].why.includes('loop')) out[k] = { ...out[k], why: `${out[k].why} · loop ${t + 1} of ${times}` }
        if (cap.hit) break
      }
    } else {
      const yes = condHolds(n.c, env)
      const before = out.length
      beat = run(yes ? n.then : n.else, fns, env, beat, dur, out, p, yes ? 't' : 'e', [...anc, p], cap, react)
      for (let k = before; k < out.length; k++) out[k] = { ...out[k], why: `${out[k].why} · if ${COND_LABEL[n.c]}? ${yes ? 'yes' : 'no'}` }
    }
  }
  return beat
}

/** the drum pattern as events: 'K' kick, 'S' snare, anything else a rest; one character per beat, looped to `beats` */
export function drumEvents(pattern: string, beats: number): PEvent[] {
  const ev: PEvent[] = []
  const pat = pattern || DEFAULT_DRUMS
  for (let b = 0; b < beats; b++) {
    const c = pat[b % pat.length]
    if (c === 'K') ev.push({ beat: b, kind: 'kick', vel: 0.9 })
    else if (c === 'S') ev.push({ beat: b, kind: 'snare', vel: 0.8 })
  }
  return ev
}

export function flatten(r: Routine, fns: FnTable, drums = DEFAULT_DRUMS): Plan {
  const cap = { hit: false }
  const steps: Step[] = []
  const env: Env = { pitch: 60, vel: 0.5 }
  const end = run(r.nodes, fns, env, 0, SEQ_BEATS, steps, '', '', [], cap)
  const hasRules = r.rules.some((x) => x.body.length > 0)
  const beats = Math.max(end, steps.length || hasRules ? 4 : 0, hasRules && steps.length === 0 ? 8 : 0)
  // the sounds
  const notes: Plan['notes'] = []
  const events: PEvent[] = drumEvents(drums, beats)
  for (const s of steps) {
    const f = fns[s.fn]
    f.notes.forEach((n, i) => notes.push({ beat: s.beat + (i * s.dur) / Math.max(f.notes.length, 1) * 0.9, n, vel: f.vel, path: s.path }))
    events.push({ beat: s.beat, kind: 'note', pitch: f.notes.length ? Math.max(...f.notes) : 60, vel: f.vel })
  }
  events.sort((a, b) => a.beat - b.beat)
  // the "when" reactions: each rule watches the event stream; a reaction can't start while the last one is still going
  const reacts: Step[] = []
  let busy = -1
  for (const e of events) {
    for (let ri = 0; ri < r.rules.length; ri++) {
      const rule = r.rules[ri]
      const hit = (rule.ev === 'kick' && e.kind === 'kick') || (rule.ev === 'snare' && e.kind === 'snare') ||
        (rule.ev === 'loud' && e.kind === 'note' && isLoud(e.vel ?? 0)) || (rule.ev === 'high' && e.kind === 'note' && isHigh(e.pitch ?? 0))
      if (!hit || e.beat < busy - 1e-9) continue
      const out: Step[] = []
      const end2 = run(rule.body, fns, { pitch: e.pitch ?? 60, vel: e.vel ?? 0.5 }, e.beat, REACT_BEATS, out, `r${ri}`, '', [`r${ri}`], { hit: false }, rule.ev)
      if (!out.length) continue
      reacts.push(...out.map((s) => ({ ...s, why: `when ${EV_LABEL[rule.ev]}: ${s.why}` })))
      busy = end2
    }
  }
  const all = [...steps, ...reacts].sort((a, b) => a.beat - b.beat || (a.react ? 1 : 0) - (b.react ? 1 : 0))
  return { steps, reacts, events, beats, notes, all, capped: cap.hit }
}

/** what the stage should show at a beat: a reaction wins over the main lane */
export function stepAt(p: Plan, beat: number): Step | null {
  for (let i = p.reacts.length - 1; i >= 0; i--) { const s = p.reacts[i]; if (beat >= s.beat && beat < s.beat + s.dur) return s }
  for (const s of p.steps) if (beat >= s.beat && beat < s.beat + s.dur) return s
  return null
}

// ---------------------------------------------------------------- Koog Kode-style text (read-only)
export function toKode(r: Routine, fns: FnTable, drums = DEFAULT_DRUMS): string {
  const L: string[] = [`tempo ${r.bpm}`]
  const used = new Set<string>()
  walk(r, (n) => { if (n.k === 'call') used.add(n.fn) })
  for (const id of used) { const f = fns[id]; if (f) L.push(`fn ${ident(f.name)} = notes "${f.notes.map(noteName).join(' ')}" -> ${f.move}`) }
  const emit = (list: Node[], ind: string) => {
    for (const n of list) {
      if (n.k === 'call') L.push(`${ind}${ident(fns[n.fn]?.name ?? n.fn)}${n.a && n.a !== 'm' ? ' ' + (n.a === 's' ? 'small' : 'big') : ''}`)
      else if (n.k === 'repeat') { L.push(`${ind}repeat ${n.n} {`); emit(n.body, ind + '  '); L.push(`${ind}}`) }
      else { L.push(`${ind}if ${n.c === 'high' ? 'note > high' : 'note > loud'} {`); emit(n.then, ind + '  '); L.push(`${ind}} else {`); emit(n.else, ind + '  '); L.push(`${ind}}`) }
    }
  }
  if (r.nodes.length) emit(r.nodes, '')
  for (const rule of r.rules) { L.push(`when ${rule.ev} {`); emit(rule.body, '  '); L.push('}') }
  if (drums && r.rules.some((x) => x.ev === 'kick' || x.ev === 'snare')) L.push(`drums "${[...drums].map((c) => (c === 'K' ? 'kick' : c === 'S' ? 'snare' : '~')).join(' ')}"`)
  return L.join('\n')
}
const ident = (s: string) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'move')
const PC = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
export const noteName = (n: number) => `${PC[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`

// ---------------------------------------------------------------- editing helpers (immutable: they return a new routine)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
export function addNode(r: Routine, ref: ListRef, node: Node): Routine {
  const c = clone(r); const l = getList(c, ref) ?? c.nodes
  if (blockCount(c) >= 40) return c
  l.push(node); return c
}
export function removeNode(r: Routine, path: string): Routine {
  const c = clone(r)
  const rm = /^r(\d+)$/.exec(path)
  if (rm) { c.rules.splice(Number(rm[1]), 1); return c }
  const i = path.lastIndexOf('.')
  const idxStr = i < 0 ? path : path.slice(i + 1)
  const part = (/^[te]/.test(idxStr) ? idxStr[0] : '') as '' | 't' | 'e'
  const list = getList(c, { parent: i < 0 ? '' : path.slice(0, i), part })
  if (list) list.splice(Number(idxStr.replace(/^[te]/, '')), 1)
  return c
}
/** wrap the last block of a list in a repeat; if it already is one, change how many times it repeats (cycling 2,3,4) */
export function repeatLast(r: Routine, ref: ListRef, n?: number): Routine {
  const c = clone(r); const l = getList(c, ref); if (!l || !l.length) return c
  const last = l[l.length - 1]
  if (last.k === 'repeat') last.n = n ?? (last.n >= 4 ? 2 : last.n + 1)
  else l[l.length - 1] = { k: 'repeat', n: n ?? 2, body: [last] }
  return c
}
export function setArg(r: Routine, path: string, a: Arg): Routine {
  const c = clone(r); const n = nodeAt(c, path); if (n && n.k === 'call') { if (a === 'm') delete n.a; else n.a = a }
  return c
}
export function cycleArg(a?: Arg): Arg { return a === 's' ? 'm' : a === 'l' ? 's' : 'l' }
export function setRule(r: Routine, i: number, ev: EvKind): Routine { const c = clone(r); if (c.rules[i]) c.rules[i].ev = ev; return c }
export function setCond(r: Routine, path: string, cond: CondKind): Routine { const c = clone(r); const n = nodeAt(c, path); if (n && n.k === 'if') n.c = cond; return c }
export function setRepeatN(r: Routine, path: string, n: number): Routine { const c = clone(r); const x = nodeAt(c, path); if (x && x.k === 'repeat') x.n = Math.max(2, Math.min(MAX_REPEAT, n)); return c }
export function addRule(r: Routine, ev: EvKind): Routine { const c = clone(r); if (c.rules.length < 4) c.rules.push({ ev, body: [] }); return c }
export function addIf(r: Routine, ref: ListRef, c: CondKind): Routine { return addNode(r, ref, { k: 'if', c, then: [], else: [] }) }

// ---------------------------------------------------------------- the motif -> function matcher (call signs)
/** the shape of a motif: the steps between its notes. Same shape in any key = same call sign. */
export const shapeOf = (notes: number[]) => notes.slice(1).map((n, i) => n - notes[i])
export const sameShape = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
export interface Call { fn: Fn; a: Arg }
/** which function did the last played notes call? Playing it higher or lower than taught is the argument: +5 or more = big, -5 or less = small. */
export function matchCall(played: number[], fns: Fn[]): Call | null {
  let best: { fn: Fn; a: Arg; len: number } | null = null
  for (const f of fns) {
    const len = f.notes.length
    if (len < 2 || played.length < len) continue
    const tail = played.slice(played.length - len)
    if (!sameShape(shapeOf(tail), shapeOf(f.notes))) continue
    const off = tail[0] - f.notes[0]
    const a: Arg = off >= 5 ? 'l' : off <= -5 ? 's' : 'm'
    if (!best || len > best.len) best = { fn: f, a, len }
  }
  return best ? { fn: best.fn, a: best.a } : null
}

// ---------------------------------------------------------------- puzzle goals
export interface Goal {
  /** the main lane must equal this list of "move" / "move:s" / "move:l" */
  seq?: string[]
  /** every event of this kind in the music must get this move as a reaction */
  reacts?: { ev: EvKind; move: MoveId }[]
  requires?: ('repeat' | 'when' | 'if' | 'fn' | 'param')[]
  /** hard limit on blocks ("only 2 blocks") */
  maxBlocks?: number
}
export interface GoalResult { ok: boolean; blocks: number; problems: string[]; stars: number; plan: Plan }
const NEED_TXT: Record<string, string> = {
  repeat: 'Use a 🔁 repeat block.', when: 'Use a ⚡ when rule.', if: 'Use a 🔀 if / else block.',
  fn: 'Teach him a move of your own (🎓) and use it.', param: 'Make a move big or small (tap its size tag).',
}
export function checkGoal(g: Goal, r: Routine, fns: FnTable, par: number, drums = DEFAULT_DRUMS): GoalResult {
  const plan = flatten(r, fns, drums)
  const blocks = blockCount(r)
  const problems: string[] = []
  const u = usesOf(r, fns)
  if (g.seq) {
    const got = plan.steps.map(stepToken)
    if (got.length !== g.seq.length || got.some((t, i) => t !== g.seq![i])) {
      if (got.length < g.seq.length) problems.push(`His dance is too short: ${got.length} of ${g.seq.length} moves.`)
      else if (got.length > g.seq.length) problems.push(`His dance is too long: ${got.length} moves, the goal has ${g.seq.length}.`)
      else problems.push(`Move ${got.findIndex((t, i) => t !== g.seq![i]) + 1} is not the right one.`)
    }
  }
  for (const want of g.reacts ?? []) {
    const evs = plan.events.filter((e) => (want.ev === 'kick' || want.ev === 'snare' ? e.kind === want.ev : e.kind === 'note' && (want.ev === 'loud' ? isLoud(e.vel ?? 0) : isHigh(e.pitch ?? 0))))
    const done = evs.filter((e) => plan.reacts.some((s) => s.react === want.ev && s.move === want.move && Math.abs(s.beat - e.beat) < 1e-6))
    if (!evs.length) problems.push(`There is nothing to react to: no ${EV_LABEL[want.ev].replace(' hits', '').replace(' plays', '')} in the music yet.`)
    else if (done.length < evs.length) problems.push(`He should ${moveDef(want.move).name.toLowerCase()} every time ${EV_LABEL[want.ev]}: ${done.length} of ${evs.length}.`)
  }
  for (const q of g.requires ?? []) {
    const have = q === 'repeat' ? u.repeat : q === 'when' ? u.when : q === 'if' ? u.cond : q === 'fn' ? u.fn : u.param
    if (!have) problems.push(NEED_TXT[q])
  }
  if (g.maxBlocks != null && blocks > g.maxBlocks) problems.push(`Too many blocks: ${blocks}. The limit is ${g.maxBlocks}.`)
  const ok = problems.length === 0
  return { ok, blocks, problems, stars: ok ? (blocks <= par ? 3 : blocks <= par + 2 ? 2 : 1) : 0, plan }
}

// ---------------------------------------------------------------- sanitising + the share-link codec
const NAME_RE = /^[\p{L}\p{N} '!?-]{1,14}$/u
export const cleanName = (s: unknown, fallback: string): string => {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 14) : ''
  return NAME_RE.test(t) ? t : fallback
}
const cleanEmoji = (s: unknown): string => {
  if (typeof s !== 'string') return '🎵'
  const cps = [...s].slice(0, 2).join('')
  return cps && !/[<>&"'`\\]/.test(cps) && cps.length <= 8 ? cps : '🎵'
}
const FN_ID = /^[a-z][a-z0-9]{0,7}$/

function cleanNodes(x: unknown, depth: number, budget: { n: number }, known: Set<string>): Node[] | null {
  if (!Array.isArray(x) || x.length > 24 || depth > 4) return null
  const out: Node[] = []
  for (const raw of x) {
    if (!raw || typeof raw !== 'object' || --budget.n < 0) return null
    const n = raw as Record<string, unknown>
    if (n.k === 'call') {
      if (typeof n.fn !== 'string' || !known.has(n.fn)) return null
      const node: Node = { k: 'call', fn: n.fn }
      if (n.a === 's' || n.a === 'l') node.a = n.a
      out.push(node)
    } else if (n.k === 'repeat') {
      const body = cleanNodes(n.body, depth + 1, budget, known)
      const times = typeof n.n === 'number' ? Math.round(n.n) : NaN
      if (!body || !(times >= 2 && times <= MAX_REPEAT)) return null
      out.push({ k: 'repeat', n: times, body })
    } else if (n.k === 'if') {
      const t = cleanNodes(n.then, depth + 1, budget, known), e = cleanNodes(n.else, depth + 1, budget, known)
      if (!t || !e || (n.c !== 'high' && n.c !== 'loud')) return null
      out.push({ k: 'if', c: n.c, then: t, else: e })
    } else return null
  }
  return out
}

export function cleanFn(raw: unknown): Fn | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || !FN_ID.test(f.id) || !isMoveId(f.move) || !Array.isArray(f.notes)) return null
  const notes = f.notes
  if (notes.length < 2 || notes.length > 8 || !notes.every((n) => Number.isInteger(n) && (n as number) >= 21 && (n as number) <= 108)) return null
  const vel = typeof f.vel === 'number' && f.vel >= 0 && f.vel <= 1 ? Math.round(f.vel * 100) / 100 : 0.6
  return { id: f.id, name: cleanName(f.name, 'My move'), emoji: cleanEmoji(f.emoji), notes: notes as number[], move: f.move, vel }
}

/** validate any untrusted value into a Routine, or null. `fns` are the functions the routine may call. */
export function cleanRoutine(raw: unknown, fnIds: Iterable<string>): Routine | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const known = new Set(fnIds)
  const budget = { n: 60 }
  const nodes = cleanNodes(r.nodes, 0, budget, known)
  if (!nodes) return null
  const rulesRaw = r.rules
  if (!Array.isArray(rulesRaw) || rulesRaw.length > 4) return null
  const rules: Rule[] = []
  for (const rr of rulesRaw) {
    if (!rr || typeof rr !== 'object') return null
    const x = rr as Record<string, unknown>
    if (!EV_KINDS.includes(x.ev as EvKind)) return null
    const body = cleanNodes(x.body, 1, budget, known)
    if (!body) return null
    rules.push({ ev: x.ev as EvKind, body })
  }
  const bpm = typeof r.bpm === 'number' && Number.isFinite(r.bpm) ? Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(r.bpm))) : 100
  return { v: 1, name: cleanName(r.name, 'My dance'), bpm, nodes, rules }
}

const b64e = (s: string): string => {
  const bytes = new TextEncoder().encode(s); let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64d = (s: string): string => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
export const SHARE_KEY = 'choreo='
export const MAX_SHARE = 3000
const KNOWN_BUILTIN = [...BUILTINS, ...PUZZLE_FNS]

/** encode a routine (plus the taught functions it calls) as URL-safe text. */
export function encodeShare(r: Routine, fns: FnTable): string {
  const used = new Set<string>()
  walk(r, (n) => { if (n.k === 'call') used.add(n.fn) })
  const taught = [...used].map((id) => fns[id]).filter((f): f is Fn => !!f && !KNOWN_BUILTIN.some((b) => b.id === f.id))
    .map((f) => ({ id: f.id, name: f.name, emoji: f.emoji, notes: f.notes, move: f.move, vel: f.vel }))
  return b64e(JSON.stringify({ v: 1, r, f: taught }))
}

/** decode + validate. Never throws; anything odd gives null. The result's fns include only what the routine needs. */
export function decodeShare(text: unknown): { routine: Routine; fns: Fn[] } | null {
  try {
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_SHARE || !/^[A-Za-z0-9_-]+$/.test(text)) return null
    const obj = JSON.parse(b64d(text)) as Record<string, unknown>
    if (!obj || typeof obj !== 'object' || obj.v !== 1 || !Array.isArray(obj.f) || obj.f.length > 12) return null
    const fns: Fn[] = []
    for (const raw of obj.f) { const f = cleanFn(raw); if (!f || fns.some((x) => x.id === f.id) || KNOWN_BUILTIN.some((b) => b.id === f.id)) return null; fns.push(f) }
    const routine = cleanRoutine(obj.r, [...fns.map((f) => f.id), ...KNOWN_BUILTIN.map((b) => b.id)])
    if (!routine) return null
    return { routine, fns }
  } catch { return null }
}

/** pull a share payload out of a location hash like "#choreo=XXXX" */
export function shareFromHash(hash: string): string | null {
  const h = hash.replace(/^#/, '')
  const i = h.indexOf(SHARE_KEY)
  if (i < 0) return null
  const v = h.slice(i + SHARE_KEY.length).split('&')[0]
  return v || null
}
