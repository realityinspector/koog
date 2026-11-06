// Pure: raw book text -> Edition + coverage. Used by scripts/build-library.ts (offline) and the fixtures. Deterministic: the same text always gives the same bytes.
import { translate } from '../engine/translate'
import { print } from '../lang/print'
import { KOOGALIEN_LANGUAGE } from '../data/version'
import { cutChapters } from './chapters'
import { credit, fixDropCap, paragraphs, stripGutenberg } from './clean'
import type { Source } from './sources'
import { annotate } from './high'
import { isSpoken, newCast, quoteDepth, sentencesOf, startChapter, voiceFor } from './text'
import { EDITION_VERSION, type BookCoverage, type Chapter, type Edition, type Line, type Para, type VoiceNo } from './types'

export function buildChapter(title: string, text: string, cast = newCast()): Chapter {
  startChapter(cast)
  const ps: Para[] = []
  paragraphs(text).forEach((p0, pi) => {
    const p = pi === 0 ? fixDropCap(p0) : p0
    const single = /^['‘][A-Za-z]/.test(p)
    const para: Para = []
    let open = 0
    sentencesOf(p).forEach((s0, si) => {
      let s = s0
      if ((s.match(/_/g) ?? []).length % 2) s = s.replace(/_/g, '')
      const spoken = isSpoken(s, open, single)
      open = quoteDepth(s, open)
      const sen = translate(s.replace(/_/g, ''))
      if (!sen.words.length) return
      const voice: VoiceNo = spoken ? voiceFor(cast, s, si === 0) : 0
      const line: Line = [s, print(sen), voice]
      para.push(line)
    })
    if (para.length) ps.push(para)
  })
  return { t: title, cast: [...cast.names.entries()].filter(([n]) => cast.seen.has(n)), ps }
}

export interface Built { edition: Edition; coverage: BookCoverage; spelledCounts: Map<string, number> }

export function buildBook(raw: string, src: Source, o: { all?: boolean } = {}): Built {
  const body = stripGutenberg(raw)
  const cuts = cutChapters(body, src.cut, src.title)
  if (!cuts.length) throw new Error(`${src.id}: no chapters found`)
  const keep = o.all ? cuts.length : Math.min(src.ship, cuts.length)
  const chapters: Chapter[] = []
  let known = 0, spelled = 0, highKnown = 0, highSpelled = 0, wordsTotal = 0
  const counts = new Map<string, number>()
  const cast = newCast()
  cuts.forEach((c, ci) => {
    const ch = buildChapter(c.title, c.text, cast)
    for (const para of ch.ps) for (const [en, , v] of para) {
      void v
      const plain = translate(en.replace(/_/g, ''))
      for (const w of plain.words) {
        wordsTotal++
        if (w.kind === 'spelled') { spelled++; counts.set(w.en.toLowerCase(), (counts.get(w.en.toLowerCase()) ?? 0) + 1) } else known++
      }
      for (const w of annotate(en, { chapter: ci, scene: 'steady', voice: 0 }).sentence.words) { if (w.kind === 'spelled') highSpelled++; else highKnown++ }
    }
    if (ci < keep) chapters.push(ch)
  })
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 50)
  const edition: Edition = {
    v: EDITION_VERSION, lang: KOOGALIEN_LANGUAGE, id: src.id, title: src.title, author: src.author, year: src.year, source: src.gutenberg,
    credit: credit(src.year), totalChapters: cuts.length, partial: keep < cuts.length, chapters,
  }
  const r = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 10000) / 10000 : 1)
  const coverage: BookCoverage = { id: src.id, title: src.title, chapters: cuts.length, words: wordsTotal, known, spelled, ratio: r(known, spelled), highRatio: r(highKnown, highSpelled), topSpelled: top }
  return { edition, coverage, spelledCounts: counts }
}
