// Pure helpers for the piano strip layout. No state.
const BLACK = new Set([1, 3, 6, 8, 10])
export const isBlack = (n: number) => BLACK.has(((n % 12) + 12) % 12)
export const noteHue = (n: number) => ((((n % 12) + 12) % 12 * 7) % 12) * 30

export interface KeyShape { note: number; black: boolean; left: number; width: number; label: string | null }

export function buildLayout(lo: number, hi: number): KeyShape[] {
  let whites = 0
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) whites++
  const w = 100 / whites
  const out: KeyShape[] = []
  let wi = 0
  for (let n = lo; n <= hi; n++) {
    const pc = ((n % 12) + 12) % 12
    const oct = Math.floor(n / 12) - 1
    if (isBlack(n)) {
      const bw = w * 0.6
      out.push({ note: n, black: true, left: wi * w - bw / 2, width: bw, label: null })
    } else {
      out.push({ note: n, black: false, left: wi * w, width: w, label: pc === 0 ? 'C' + oct : ['C', 'D', 'E', 'F', 'G', 'A', 'B'][[0, 2, 4, 5, 7, 9, 11].indexOf(pc)] })
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
