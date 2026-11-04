// The pattern inside the quotes: "c e g e", "kick ~ snare ~", "[c e] <g a>*2". PURE.
//   word      a note (c, f#3, bb) or a drum (kick), by the line's keyword
//   ~         a rest
//   [a b]     squeeze the steps inside into ONE step
//   [a,b,c]   play together (a chord, or kick and hat at once)
//   <a b>     a different one each bar
//   x*3       repeat 3 times inside the step (1 to 16)
// Spaces separate steps; the steps of a pattern share one bar equally.
import { KodeError, LIMITS, type Node, type PatKind } from './types'
import { readDrum, readNote } from './names'

const BREAK = new Set([' ', '\t', '\n', '\r', '[', ']', '<', '>', ',', '*', '~'])
const rest: Node = { t: 'rest' }

class P {
  i = 0
  constructor(private s: string, private base: number, private kind: PatKind) {}
  private at = () => this.s[this.i]
  private abs = (i: number) => this.base + i
  private ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++ }
  private err(msg: string, a: number, b: number): never { throw new KodeError(msg, this.abs(a), this.abs(b)) }

  /** the whole pattern: a sequence that must reach the end */
  top(): Node {
    const items = this.seq(null, 0, -1).items
    return { t: 'seq', items }
  }

  /** steps until `close` (or a comma when stacking). Leaves i ON the stopper. */
  seq(close: ']' | '>' | null, depth: number, openAt: number): { items: Node[]; stop: string } {
    const items: Node[] = []
    for (;;) {
      this.ws()
      if (this.i >= this.s.length) {
        if (close) this.err(`This '${close === ']' ? '[' : '<'}' never closes. Add a '${close}' at the end.`, openAt, openAt + 1)
        return { items, stop: '' }
      }
      const c = this.at()
      if (close && c === close) return { items, stop: c }
      if (c === ',') {
        if (close === ']') return { items, stop: c }
        this.err("Commas only work inside square brackets, like [c,e,g].", this.i, this.i + 1)
      }
      if (c === ']') this.err("This ']' has no '[' to close. Every ] needs a [ before it.", this.i, this.i + 1)
      if (c === '>') this.err("This '>' has no '<' to close. Every > needs a < before it.", this.i, this.i + 1)
      if (c === '*') this.err("The * goes right after a step, like c*2.", this.i, this.i + 1)
      if (items.length >= LIMITS.steps) this.err(`That is too many steps in a row (the limit is ${LIMITS.steps}). Use [ ] to squeeze some together.`, this.i, this.i + 1)
      items.push(this.step(depth))
    }
  }

  step(depth: number): Node {
    const startAt = this.i
    let node = this.atom(depth)
    if (this.at() === '*') {
      const star = this.i
      this.i++
      const ds = this.i
      while (this.i < this.s.length && this.s[this.i] >= '0' && this.s[this.i] <= '9') this.i++
      if (this.i === ds) this.err('After * I need a number, like c*2.', star, star + 1)
      const n = Number(this.s.slice(ds, this.i))
      if (n < 1 || n > LIMITS.repeat) this.err(`You can repeat from 1 to ${LIMITS.repeat} times, like c*4.`, star, this.i)
      node = { t: 'rep', n, node }
      if (this.at() === '*') this.err('Only one * per step. Use [ ] to repeat a repeat, like [c*2]*2.', this.i, this.i + 1)
    }
    void startAt
    return node
  }

  atom(depth: number): Node {
    const c = this.at()
    const start = this.i
    if (c === '~') { this.i++; return rest }
    if (c === '[' || c === '<') {
      if (depth + 1 > LIMITS.depth) this.err(`The brackets are nested too deep (the limit is ${LIMITS.depth}).`, start, start + 1)
      this.i++
      const close = c === '[' ? ']' : '>'
      const layers: Node[] = []
      for (;;) {
        const r = this.seq(close, depth + 1, start)
        layers.push({ t: 'seq', items: r.items })
        if (r.stop === ',') { this.i++; continue }
        break
      }
      this.i++ // the closer
      if (layers.every((l) => l.t === 'seq' && l.items.length === 0)) this.err(`There is nothing inside this ${c}${close}. Put some steps between them.`, start, this.i)
      if (layers.some((l) => l.t === 'seq' && l.items.length === 0)) this.err('There is an empty part next to a comma. Put a step (or ~) on both sides.', start, this.i)
      if (c === '<') return { t: 'alt', items: (layers[0] as { items: Node[] }).items }
      return layers.length === 1 ? layers[0] : { t: 'stack', layers }
    }
    // a word
    while (this.i < this.s.length && !BREAK.has(this.s[this.i])) this.i++
    const word = this.s.slice(start, this.i)
    const a = this.abs(start), b = this.abs(this.i)
    if (this.kind === 'notes') return { t: 'note', midi: readNote(word, a, b), s: a, e: b }
    return { t: 'drum', voice: readDrum(word, a, b), s: a, e: b }
  }
}

/** most sounds a node can make in one bar, and how much work it takes to plan it (rests and repeats count) */
export function weigh(n: Node): { size: number; work: number } {
  switch (n.t) {
    case 'note': case 'drum': return { size: 1, work: 1 }
    case 'rest': return { size: 0, work: 1 }
    case 'seq': case 'stack': {
      let size = 0, work = 1
      for (const x of n.t === 'seq' ? n.items : n.layers) { const w = weigh(x); size += w.size; work += w.work }
      return { size, work }
    }
    case 'alt': {
      let size = 0, work = 1
      for (const x of n.items) { const w = weigh(x); size = Math.max(size, w.size); work += w.work }
      return { size, work }
    }
    case 'rep': { const w = weigh(n.node); return { size: w.size * n.n, work: 1 + w.work * n.n } }
  }
}

/** Parse the text between the quotes. `base` = offset of its first character in the whole program. Throws KodeError. */
export function parseNotation(text: string, base: number, kind: PatKind): Node {
  const node = new P(text, base, kind).top()
  const w = weigh(node)
  if (w.size > LIMITS.events) throw new KodeError(`That pattern makes ${w.size} sounds in one bar. The limit is ${LIMITS.events}. Try fewer repeats.`, base, base + Math.max(1, text.length))
  if (w.work > LIMITS.work) throw new KodeError('That pattern is too busy for one bar. Try fewer repeats or brackets.', base, base + Math.max(1, text.length))
  return node
}
