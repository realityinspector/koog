// Pure: cut a cleaned book into chapters (headings, a table of contents, or one single piece). Deterministic. Tested by scripts/library-fixtures.ts
import type { Cut } from './sources'

export interface RawChapter { title: string; text: string }

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 }
export function romanToInt(r: string): number {
  let n = 0
  for (let i = 0; i < r.length; i++) { const v = ROMAN[r[i]] ?? 0; n += v < (ROMAN[r[i + 1]] ?? 0) ? -v : v }
  return n
}
const SMALL = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'or', 'with', 'by'])
export function titleCase(s: string): string {
  const w = s.trim().replace(/\s+/g, ' ').replace(/[.:]+$/, '').split(' ')
  return w.map((x, i) => {
    const low = x.toLowerCase()
    return i > 0 && SMALL.has(low) ? low : low.replace(/(^|[-(])([a-z])/g, (_m, p, c) => p + c.toUpperCase())
  }).join(' ')
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function cutChapters(text: string, cut: Cut, bookTitle: string): RawChapter[] {
  const lines = text.split('\n')
  if (cut.how === 'single') {
    let a = lines.findIndex((l) => cut.start.test(l.trim()))
    if (a < 0) a = 0
    let b = cut.end ? lines.findIndex((l, i) => i > a && cut.end!.test(l.trim())) : -1
    if (b < 0) b = lines.length
    return [{ title: bookTitle, text: lines.slice(a, b).join('\n') }]
  }
  if (cut.how === 'headings') {
    const idx: number[] = []
    lines.forEach((l, i) => { if (cut.re.test(l)) idx.push(i) })
    return idx.map((a, k) => {
      const b = idx[k + 1] ?? lines.length
      const head = lines[a].trim()
      let body = a + 1
      let title = ''
      const roman = /^(?:CHAPTER|Chapter|STAVE)?\s*([IVXL]+)\b/.exec(head)
      const digits = /^(\d+)\s+(.*)$/.exec(head)
      const inline = /^STAVE\s+[IVXL]+:\s+(.*)$/.exec(head)
      if (inline) title = titleCase(inline[1])
      else if (digits) title = titleCase(digits[2])
      else if (cut.titleNext) {
        while (body < b && !lines[body].trim()) body++
        if (body < b) { title = titleCase(lines[body]); body++ }
      }
      const n = roman ? romanToInt(roman[1]) : digits ? Number(digits[1]) : k + 1
      return { title: `${n}. ${title}`.replace(/\.\s*$/, ''), text: lines.slice(body, b).join('\n') }
    })
  }
  // toc: indented lines after the marker are the titles; the body repeats each title alone on a line, flush left
  const at = lines.findIndex((l) => cut.tocFrom.test(l))
  const titles: string[] = []
  let blanks = 0
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) { if (++blanks >= 3 && titles.length) break; continue }
    blanks = 0
    if (/^\s/.test(l)) titles.push(l.trim().replace(/^\d+\.\s+/, ''))
    else if (titles.length) break
  }
  const found: { title: string; line: number }[] = []
  let from = at + 1 + titles.length
  for (const t of titles) {
    const want = norm(t)
    if (!want || found.some((f) => norm(f.title) === want)) continue
    for (let i = from; i < lines.length; i++) {
      const l = lines[i]
      if (l && !/^\s/.test(l) && norm(l) === want && !lines[i - 1]?.trim()) { found.push({ title: t, line: i }); from = i + 1; break }
    }
  }
  return found.map((f, k) => ({ title: titleCase(f.title.replace(/\[.*?\]/g, '')), text: lines.slice(f.line + 1, found[k + 1]?.line ?? lines.length).join('\n') }))
}
