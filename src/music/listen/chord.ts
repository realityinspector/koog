// Chord naming from held notes. Pure.
import { PC_NAMES, pc } from './pitch'
import type { ChordInfo, ChordQuality } from './types'

const TEMPLATES: [string, ChordQuality, number[]][] = [
  ['7', '7', [0, 4, 7, 10]],
  ['maj7', 'maj7', [0, 4, 7, 11]],
  ['m7', 'm7', [0, 3, 7, 10]],
  ['', 'major', [0, 4, 7]],
  ['m', 'minor', [0, 3, 7]],
  ['dim', 'dim', [0, 3, 6]],
  ['aug', 'aug', [0, 4, 8]],
  ['sus4', 'sus4', [0, 5, 7]],
  ['sus2', 'sus2', [0, 2, 7]],
]
const LONG: Record<string, string> = { '': ' major', m: ' minor', '7': '7', maj7: ' maj7', m7: ' minor 7' }

/** Analyse held MIDI notes (needs 3+ distinct pitch classes) into a chord, or null. */
export function analyseChord(notes: number[]): ChordInfo | null {
  if (notes.length < 3) return null
  const sorted = [...notes].sort((a, b) => a - b)
  const pcs = [...new Set(sorted.map(pc))]
  if (pcs.length < 3) return null
  const bass = pc(sorted[0])
  let best: { score: number; info: ChordInfo } | null = null
  for (const root of pcs) {
    const set = new Set(pcs.map((p) => pc(p - root)))
    for (const [suffix, quality, tpl] of TEMPLATES) {
      if (tpl.length !== set.size || !tpl.every((t) => set.has(t))) continue
      const score = (root === bass ? 2 : 0) + tpl.length * 0.1
      if (!best || score > best.score) {
        best = { score, info: { root, quality, name: PC_NAMES[root] + (LONG[suffix] ?? suffix), pcs: tpl.map((t) => pc(root + t)) } }
      }
    }
  }
  return best?.info ?? null
}
