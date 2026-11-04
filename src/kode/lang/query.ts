// Turn a pattern into the sounds of one bar. PURE. Times are fractions of the bar (0..1).
import { CYCLE_BEATS, type LayerSpec, type Node, type PlanEvent, type Program } from './types'

export interface QEvent { t0: number; t1: number; kind: 'note' | 'drum'; value: number; s: number; e: number }

/** `cyc` = which bar (0 = the first bar after a run); `<a b>` picks by it, and x*n gives each repeat its own count */
export function query(node: Node, cyc: number, t0: number, t1: number, out: QEvent[]): void {
  switch (node.t) {
    case 'note': out.push({ t0, t1, kind: 'note', value: node.midi, s: node.s, e: node.e }); return
    case 'drum': out.push({ t0, t1, kind: 'drum', value: node.voice, s: node.s, e: node.e }); return
    case 'rest': return
    case 'seq': {
      const n = node.items.length
      if (!n) return
      const d = (t1 - t0) / n
      for (let i = 0; i < n; i++) query(node.items[i], cyc, t0 + i * d, t0 + (i + 1) * d, out)
      return
    }
    case 'stack': for (const l of node.layers) query(l, cyc, t0, t1, out); return
    case 'alt': {
      const n = node.items.length
      if (!n) return
      const c = Math.max(0, cyc)
      query(node.items[c % n], Math.floor(c / n), t0, t1, out)
      return
    }
    case 'rep': {
      const d = (t1 - t0) / node.n
      for (let k = 0; k < node.n; k++) query(node.node, cyc * node.n + k, t0 + k * d, t0 + (k + 1) * d, out)
      return
    }
  }
}

export function planLayer(L: LayerSpec, index: number, cyc: number): PlanEvent[] {
  const q: QEvent[] = []
  query(L.node, cyc, 0, 1, q)
  return q.map((e) => ({ layer: index, kind: e.kind, value: e.value, sound: L.sound, vel: L.loud, beat: e.t0 * CYCLE_BEATS, dur: (e.t1 - e.t0) * CYCLE_BEATS, s: e.s, e: e.e }))
}
/** every layer's sounds for bar number `cyc`, in time order */
export function planCycle(p: Program, cyc: number): PlanEvent[] {
  const out: PlanEvent[] = []
  p.layers.forEach((L, i) => out.push(...planLayer(L, i, cyc)))
  return out.sort((a, b) => a.beat - b.beat || a.layer - b.layer)
}
