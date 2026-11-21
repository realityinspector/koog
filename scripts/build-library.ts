// Offline pipeline for the Koogalien Library. Grown-ups run it, never kids and never at runtime:
//   npm run build:library              rebuild every edition (short books whole, long books as their first chapters)
//   npm run build:library -- --all     the "more chapters" option: every chapter of every book (bigger files; do not commit them)
//   npm run build:library -- --download   fetch the plain-text files first (polite: one at a time, a few seconds apart)
// Raw downloads live in private/library-raw/ (gitignored) and are treated as untrusted DATA: they are read as text and never executed.
// Output: src/koogalien/library/editions/<id>.json, src/koogalien/library/catalog.json (metadata) and src/koogalien/library/coverage.json (for the lexicon research loop).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCES, US_PD_LAST_YEAR } from '../src/koogalien/library/sources'
import { buildBook } from '../src/koogalien/library/build'
import { KOOGALIEN_LANGUAGE } from '../src/koogalien/data/version'
import { LEXICON_VERSION } from '../src/koogalien/data/lexicon'
import type { BookCoverage, CoverageFile } from '../src/koogalien/library/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(ROOT, 'private/library-raw')
const OUT = join(ROOT, 'src/koogalien/library')
const args = process.argv.slice(2)
const ALL = args.includes('--all')

async function download() {
  mkdirSync(RAW, { recursive: true })
  for (const s of SOURCES) {
    const f = join(RAW, s.file)
    if (existsSync(f) && statSync(f).size > 1000) continue
    const url = `https://www.gutenberg.org/cache/epub/${s.gutenberg}/pg${s.gutenberg}.txt`
    const res = await fetch(url, { headers: { 'user-agent': 'KoogLibraryBuilder/1.0 (kids music app; polite, one at a time)' } })
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    writeFileSync(f, await res.text())
    console.log('downloaded', s.id, s.gutenberg)
    await new Promise((r) => setTimeout(r, 4000))
  }
}

async function main() {
  if (args.includes('--download')) await download()
  mkdirSync(join(OUT, 'editions'), { recursive: true })
  const books: BookCoverage[] = []
  const meta: unknown[] = []
  const all = new Map<string, number>()
  let sizeTotal = 0
  let k = 0, sp = 0
  for (const s of SOURCES) {
    if (s.year > US_PD_LAST_YEAR) throw new Error(`${s.id}: published ${s.year}, after ${US_PD_LAST_YEAR}; not US public domain`)
    const f = join(RAW, s.file)
    if (!existsSync(f)) { console.error('missing raw file (run with --download):', s.file); process.exit(1) }
    const { edition, coverage, spelledCounts } = buildBook(readFileSync(f, 'utf8'), s, { all: ALL })
    const json = JSON.stringify(edition)
    writeFileSync(join(OUT, 'editions', s.id + '.json'), json)
    sizeTotal += json.length
    books.push(coverage)
    k += coverage.known; sp += coverage.spelled
    for (const [w, n] of spelledCounts) all.set(w, (all.get(w) ?? 0) + n)
    const lines = edition.chapters.reduce((n, c) => n + c.ps.reduce((m, p) => m + p.length, 0), 0)
    meta.push({ id: s.id, title: s.title, author: s.author, year: s.year, source: s.gutenberg, blurb: s.blurb, cover: s.cover, chapters: edition.chapters.length, totalChapters: edition.totalChapters, partial: edition.partial, lines, bytes: json.length })
    console.log(`${s.id.padEnd(20)} ${String(edition.chapters.length).padStart(3)}/${String(edition.totalChapters).padEnd(3)} chapters ${String(lines).padStart(5)} lines ${(json.length / 1024).toFixed(0).padStart(5)} KB  coverage ${(coverage.ratio * 100).toFixed(1)}% (High ${(coverage.highRatio * 100).toFixed(1)}%)`)
  }
  const top = [...all.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 50)
  const words = k + sp
  const cov: CoverageFile = {
    v: 1, lang: KOOGALIEN_LANGUAGE, lexiconVersion: LEXICON_VERSION, books,
    total: { words, known: k, spelled: sp, ratio: words ? Math.round((k / words) * 10000) / 10000 : 1, highRatio: Math.round((books.reduce((n, b) => n + b.highRatio * b.words, 0) / (words || 1)) * 10000) / 10000, topSpelled: top },
  }
  writeFileSync(join(OUT, 'coverage.json'), JSON.stringify(cov, null, 1) + '\n')
  writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(meta))
  console.log(`editions total ${(sizeTotal / 1024).toFixed(0)} KB${ALL ? ' (--all: do not commit)' : ''}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
