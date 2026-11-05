// Pure: Score -> Koog Kode text (`tempo` + `notes "..."`), so any sentence opens in the Kode editor. Tested by scripts/koogalien-lang-fixtures.ts
import type { Score } from '../data/types'

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const noteName = (m: number) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1)

export function toKode(score: Score): string {
  const bpm = Math.max(30, Math.min(300, Math.round(score.bpm || 100)))
  if (!score.chords.length) return `tempo ${bpm}\n`
  const grid = [1, 0.5, 0.25].find((g) => score.chords.every((c) => Math.abs(c.at / g - Math.round(c.at / g)) < 1e-6)) ?? 0.25
  const stepsPerBar = Math.round(4 / grid)
  const last = Math.max(...score.chords.map((c) => Math.round(c.at / grid)))
  const bars = Math.max(1, Math.ceil((last + 1) / stepsPerBar))
  const steps: string[] = new Array(bars * stepsPerBar).fill('~')
  for (const c of score.chords) {
    const i = Math.round(c.at / grid)
    const names = [...new Set(c.midi)].sort((a, b) => a - b).map(noteName)
    if (!names.length) continue
    steps[i] = names.length === 1 ? names[0] : '[' + names.join(',') + ']'
  }
  const barStr = (b: number) => steps.slice(b * stepsPerBar, (b + 1) * stepsPerBar).join(' ')
  const body = bars === 1 ? barStr(0) : '<' + Array.from({ length: bars }, (_, b) => '[' + barStr(b) + ']').join(' ') + '>'
  return `tempo ${bpm}\nnotes "${body}"\n`
}
