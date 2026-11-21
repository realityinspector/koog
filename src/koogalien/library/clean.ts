// Pure: turn a raw downloaded book (UNTRUSTED TEXT, never executed) into clean prose: no header, footer, licence boilerplate or
// publisher trademark lines, no illustration tags, footnote marks or decorations. Tested by scripts/library-fixtures.ts

const START = /^\s*\*{3}\s*START OF (?:THE|THIS) .*?\*{3}\s*$/im
const END = /^\s*\*{3}\s*END OF (?:THE|THIS) .*?\*{3}\s*$/im
/** a line that is front-matter credit or trademark text; dropped wherever it appears */
const BOILER = /gutenberg|gutenberg\.org|distributed proofreading|^\s*(?:(?:produced|e-?text prepared|transcribed|scanned|proofread|html version prepared)\s+by\b|transcriber['’]?s? note|updated:|this ebook is\b|this etext\b)/i

export function stripGutenberg(raw: string): string {
  let t = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const s = START.exec(t)
  if (!s) throw new Error('no START marker: refusing to ship an unrecognised file')
  t = t.slice(s.index + s[0].length)
  const e = END.exec(t)
  if (e) t = t.slice(0, e.index)
  return t.split('\n').filter((l) => !BOILER.test(l)).join('\n')
}

/** illustrations, footnote marks and decorations out; typographic whitespace tidied */
export function tidy(text: string): string {
  return text
    .replace(/\[(?:Illustration|Footnote|Transcriber|Note|Decoration)[^\]]*\]/gis, ' ')
    .replace(/\[\d+\]/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
}

const DECOR = /^[\s*_=\-—–.~#]+$/
/** paragraphs: blank-line separated, lines joined with a space, whitespace collapsed; decorations dropped */
export function paragraphs(text: string): string[] {
  return tidy(text).split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p && !DECOR.test(p) && /[A-Za-z]{2}/.test(p))
}

/** a drop-cap artefact ("IN the sea", "HERE was once") becomes ordinary capitalised text */
export function fixDropCap(p: string): string {
  const m = /^([A-Z]{2,})(?=[\s,]+[a-z’'])/.exec(p)
  if (!m) return p
  return m[1][0] + m[1].slice(1).toLowerCase() + p.slice(m[1].length)
}

export function credit(year: number): string { return `Text from a public-domain edition; original publication ${year}.` }
