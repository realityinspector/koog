// Pure helpers for the piano strip layout. No state.
import { SCALES, pc } from '../../music/theory'
const BLACK = new Set([1, 3, 6, 8, 10])
export const isBlack = (n: number) => BLACK.has(pc(n))
export const noteHue = (n: number) => ((pc(n) * 7) % 12) * 30

export interface KeyShape { note: number; black: boolean; left: number; width: number; label: string | null }

export function buildLayout(lo: number, hi: number): KeyShape[] {
  let whites = 0
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) whites++
  const w = 100 / whites
  const out: KeyShape[] = []
  let wi = 0
  for (let n = lo; n <= hi; n++) {
    const p = pc(n)
    const oct = Math.floor(n / 12) - 1
    if (isBlack(n)) {
      const bw = w * 0.6
      out.push({ note: n, black: true, left: wi * w - bw / 2, width: bw, label: null })
    } else {
      out.push({ note: n, black: false, left: wi * w, width: w, label: p === 0 ? 'C' + oct : ['C', 'D', 'E', 'F', 'G', 'A', 'B'][SCALES.major.indexOf(p)] })
      wi++
    }
  }
  return out
}

export function snapRange(lo: number, hi: number): [number, number] {
  while (isBlack(lo) || lo % 12 !== 0) lo--
  while (hi % 12 !== 0) hi++
  return [Math.max(0, lo), Math.min(120, hi)]
}
