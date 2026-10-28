import { PC_NAMES, pc } from './theory'

const TEMPLATES: [string, number[]][] = [
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
]
const LONG: Record<string, string> = { '': ' major', m: ' minor', '7': '7', maj7: ' maj7', m7: ' minor 7' }

/** Name a chord from held MIDI notes (needs 3+ distinct pitch classes), or null. */
export function detectChord(notes: number[]): string | null {
  if (notes.length < 3) return null
  const sorted = [...notes].sort((a, b) => a - b)
  const pcs = [...new Set(sorted.map(pc))]
  if (pcs.length < 3) return null
  const bass = pc(sorted[0])
  let best: { score: number; name: string } | null = null
  for (const root of pcs) {
    const set = new Set(pcs.map((p) => pc(p - root)))
    for (const [suffix, tpl] of TEMPLATES) {
      if (tpl.length !== set.size || !tpl.every((t) => set.has(t))) continue
      const score = (root === bass ? 2 : 0) + tpl.length * 0.1
      if (!best || score > best.score) best = { score, name: PC_NAMES[root] + (LONG[suffix] ?? suffix) }
    }
  }
  return best?.name ?? null
}
