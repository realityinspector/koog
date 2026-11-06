// Pure: the Koogalien Library edition schema. An edition is one public-domain book, cleaned and cut into chapter, paragraph, sentence.
// Built offline by scripts/build-library.ts (grown-ups run it, never kids). Tested by scripts/library-fixtures.ts
export const EDITION_VERSION = 1

/** 0 = narrator, 1..3 = Pip, Dro, Zee (the speaking Koogaliens) */
export type VoiceNo = 0 | 1 | 2 | 3
export const VOICE_IDS = ['narrator', 'pip', 'dro', 'zee'] as const
export const VOICE_NAMES = ['Narrator', 'Pip', 'Dro', 'Zee'] as const

/** one sentence: [English as printed (underscores mark emphasis), Koogalien code (plain, `say hello world.`), voice] */
export type Line = [en: string, code: string, voice: VoiceNo]
/** a paragraph is a run of lines; an empty chapter title line is never stored */
export type Para = Line[]

export interface Chapter {
  /** chapter heading as the reader shows it */
  t: string
  /** who spoke in this chapter: [name, voice] in order of first appearance */
  cast: [string, VoiceNo][]
  ps: Para[]
}

export interface Edition {
  v: number
  /** Koogalien language version the codes were printed with (KOOGALIEN_LANGUAGE); if it differs at runtime the reader re-translates from English */
  lang: string
  id: string
  title: string
  author: string
  /** original publication year (US public domain: 1930 or earlier) */
  year: number
  /** the public-domain source's catalogue number, for the credits */
  source: number
  credit: string
  /** how many chapters the whole book has, and how many this edition carries */
  totalChapters: number
  partial: boolean
  chapters: Chapter[]
}

export interface BookCoverage {
  id: string
  title: string
  chapters: number
  words: number
  known: number
  spelled: number
  ratio: number
  /** plain Koogalien vs High (High folds plurals and past tenses onto their chord word) */
  highRatio: number
  /** the 50 most common spelled words: candidates for new chord-words */
  topSpelled: [word: string, count: number][]
}

export interface CoverageFile { v: number; lang: string; lexiconVersion: number; books: BookCoverage[]; /** all books together */ total: Omit<BookCoverage, 'id' | 'title' | 'chapters'> }
