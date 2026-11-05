// Pure: closest lexicon word for a mistyped one (edit distance <= 2). Tested by scripts/koogalien-lang-fixtures.ts
import { LEXICON } from '../data/lexicon'

function dist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

export function closestWord(en: string): { id: string; en: string } | null {
  const w = en.toLowerCase().trim().slice(0, 40)
  if (!w) return null
  const max = w.length <= 3 ? 1 : 2
  let best: { id: string; en: string } | null = null
  let bd = max + 1
  for (const e of LEXICON) {
    if (e.kind === 'closer' || e.kind === 'control') continue
    for (const cand of [e.en.toLowerCase(), ...(e.alt ?? [])]) {
      const d = dist(w, cand.toLowerCase(), max)
      if (d < bd) { bd = d; best = { id: e.id, en: e.en } }
    }
  }
  return best
}
