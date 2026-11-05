// Pure: Koogalien code text -> Program. Hand-written scanner and parser: no eval, no regex backtracking, hard limits.
// Syntax:  say hello world.   say hello "Maya"!   say 3 2 1!   let hi = hello friend.   say hi world.   hello~wobble~soft   # comment
// Tested by scripts/koogalien-lang-fixtures.ts
import type { Diag, Ending, ModName, Sentence, WordSlot } from '../data/types'
import { KOOGALIEN_VERSION, LIMITS } from '../data/types'
import { lexByEnglish, lexById } from '../data/lexicon'
import { SPELL_END, SPELL_ID, glyphByChar } from '../data/alphabet'
import { closestWord } from './suggest'
import { DEFAULT_MOD_DEPTH } from './print'
import { lower } from './lower'

export interface Program { src: string; sentence: Sentence | null; vars: Record<string, Sentence>; errors: Diag[]; /** every say line, in order */ says: Sentence[] }

type TokKind = 'word' | 'quote' | 'closer' | 'mod' | 'eq' | 'nl'
interface Tok { k: TokKind; text: string; start: number; end: number; value?: number; open?: boolean }

const MOD_NAMES: readonly string[] = ['wobble', 'sweep', 'bend', 'tremolo', 'filter']
const isWordCh = (c: string) => /^[\p{L}\p{N}'_-]$/u.test(c)
const isDigit = (c: string) => c >= '0' && c <= '9'

function scan(src: string, diag: (m: string, s: number, e: number, hint?: string) => void): Tok[] {
  const out: Tok[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '\n') { out.push({ k: 'nl', text: c, start: i, end: i + 1 }); i++; continue }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '"' || c === '“') {
      let j = i + 1
      while (j < n && src[j] !== '"' && src[j] !== '”' && src[j] !== '\n') j++
      const closed = j < n && src[j] !== '\n'
      if (!closed) diag('This quote never closes.', i, j, 'Add a " at the end.')
      out.push({ k: 'quote', text: src.slice(i + 1, j), start: i, end: closed ? j + 1 : j })
      i = closed ? j + 1 : j
      continue
    }
    if (c === '.' || c === '?' || c === '!') { out.push({ k: 'closer', text: c, start: i, end: i + 1 }); i++; continue }
    if (c === '=') { out.push({ k: 'eq', text: c, start: i, end: i + 1 }); i++; continue }
    if (c === '~') {
      let j = i + 1
      while (j < n && /^[A-Za-z]$/.test(src[j])) j++
      const name = src.slice(i + 1, j).toLowerCase()
      let value: number | undefined
      if (src[j] === '=') {
        let k = j + 1
        while (k < n && isDigit(src[k])) k++
        if (src[k] === '.' && isDigit(src[k + 1] ?? '')) { k++; while (k < n && isDigit(src[k])) k++ }
        const txt = src.slice(j + 1, k)
        if (txt) { value = Number(txt); j = k } else { diag('After ~' + name + '= I need a number from 0 to 1.', j, j + 1, 'Try ~' + name + '=0.5'); j++ }
      }
      out.push({ k: 'mod', text: name, start: i, end: j, value })
      i = j
      continue
    }
    if (isWordCh(c)) {
      let j = i + 1
      while (j < n && isWordCh(src[j])) j++
      out.push({ k: 'word', text: src.slice(i, j), start: i, end: j })
      i = j
      continue
    }
    diag('I do not understand the character "' + c + '".', i, i + 1)
    i++
  }
  return out
}

export function parse(src0: string, _known?: ReadonlySet<string>): Program {
  let src = String(src0 ?? '')
  const errors: Diag[] = []
  const lineStarts: number[] = [0]
  const diag = (message: string, start: number, end: number, hint?: string) => {
    if (errors.length >= 20) return
    let lo = 0, hi = lineStarts.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= start) lo = mid; else hi = mid - 1 }
    const d: Diag = { message, start, end: Math.max(end, start), line: lo + 1, col: start - lineStarts[lo] + 1 }
    if (hint) d.hint = hint
    errors.push(d)
  }
  if (src.length > LIMITS.codeChars) { src = src.slice(0, LIMITS.codeChars); }
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1)
  if (String(src0 ?? '').length > LIMITS.codeChars) diag('That is more than ' + LIMITS.codeChars + ' characters, so I stopped reading here.', LIMITS.codeChars - 1, LIMITS.codeChars, 'Split it into a shorter message.')

  const toks = scan(src, diag)
  let p = 0
  const vars: Record<string, Sentence> = {}
  const says: Sentence[] = []
  const peek = () => toks[p]

  const mk = (kind: WordSlot['kind'], id: string | null, en: string, chords: WordSlot['chords'], status: WordSlot['status'], confidence: number): WordSlot =>
    ({ kind, id, en, chords, tone: { loud: 'normal', mods: [] }, confidence, status })

  const spellSlot = (text: string, start: number, end: number): WordSlot | null => {
    const spell = lexById(SPELL_ID)?.chord ?? [1, 2]
    const letters: string[] = []
    for (const ch of text) {
      if (/^[A-Za-z]$/.test(ch) && glyphByChar(ch)) letters.push(ch)
      else diag('Spell mode only knows the letters A to Z, so I skipped "' + ch + '".', start, end)
    }
    if (!letters.length) return null
    if (letters.length > LIMITS.lettersPerSpell) { diag('A spelled word can have ' + LIMITS.lettersPerSpell + ' letters at most.', start, end); letters.length = LIMITS.lettersPerSpell }
    const chords: WordSlot['chords'] = [spell]
    for (const ch of letters) { const g = glyphByChar(ch)!; chords.push([g.row as 1], [g.col as 1]) }
    chords.push(SPELL_END)
    return mk('spelled', null, letters.join(''), chords, 'ok', 1)
  }

  /** a bare token (or a joined two-word phrase) as a lexicon word or digit; null if unknown */
  const lookup = (text: string): WordSlot | null => {
    const e = lexByEnglish(text)
    if (e) return mk('word', e.id, e.en, [e.chord], 'ok', 1)
    if (text.length > 0 && [...text].every(isDigit)) {
      if (text.length === 1 && text >= '1' && text <= '8') return mk('digit', null, text, [[Number(text) as 1]], 'ok', 1)
    }
    return null
  }

  type Group = { slots: WordSlot[] }
  const parseItems = (stopOnEq = false): { groups: Group[]; end: Ending | null } => {
    const groups: Group[] = []
    let count = 0
    let end: Ending | null = null
    const add = (g: Group) => {
      const room = LIMITS.wordsPerSentence - count
      if (g.slots.length > room) {
        const t = peek()
        diag('A sentence can have ' + LIMITS.wordsPerSentence + ' words at most.', t ? t.start : 0, t ? t.end : 0)
        g.slots = g.slots.slice(0, Math.max(0, room))
      }
      count += g.slots.length
      groups.push(g)
    }
    for (;;) {
      const t = peek()
      if (!t || t.k === 'nl') break
      if (t.k === 'closer') { p++; end = t.text as Ending; break }
      if (t.k === 'eq') { if (stopOnEq) break; diag('I did not expect "=" here.', t.start, t.end, 'Use let name = words.'); p++; continue }
      if (t.k === 'mod') {
        p++
        const g = groups[groups.length - 1]
        if (!g || !g.slots.length) { diag('~' + t.text + ' needs a word before it.', t.start, t.end, 'Write it right after a word: hello~wobble'); continue }
        for (const s of g.slots) applyMod(s, t)
        continue
      }
      p++
      if (t.k === 'word') {
        const low = t.text.toLowerCase()
        if (Object.prototype.hasOwnProperty.call(vars, low)) { add({ slots: vars[low].words.map(cloneSlot) }); continue }
        // two-word entries such as "Koog Alien"
        const nx = peek()
        if (nx && nx.k === 'word' && src.slice(t.end, nx.start).trim() === '' && !src.slice(t.end, nx.start).includes('\n')) {
          const two = lookup(t.text + ' ' + nx.text)
          if (two && two.kind === 'word' && two.en.includes(' ')) { p++; add({ slots: [two] }); continue }
        }
        const w = lookup(t.text)
        if (w) { add({ slots: [w] }); continue }
        if ([...t.text].every(isDigit)) {
          diag('I only know the single notes 1 to 8 as digits.', t.start, t.end, 'For other numbers use the words zero, nine or ten.')
        } else {
          const c = closestWord(t.text)
          diag('I do not know the word "' + t.text + '" yet.', t.start, t.end,
            (c ? 'Did you mean "' + c.en + '"? ' : '') + 'To spell a name or a new word, put it in quotes: "' + t.text + '".')
        }
        add({ slots: [mk('unknown', null, t.text, [], 'unknown', 0)] })
        continue
      }
      if (t.k === 'quote') {
        const text = t.text.trim()
        if (!text) { diag('These quotes are empty.', t.start, t.end, 'Put a name between them: "Maya"'); continue }
        if (!/\s/.test(text)) {
          const s = spellSlot(text.replace(/[.,?!]+$/, '') || text, t.start, t.end)
          if (s) add({ slots: [s] })
          continue
        }
        // quoted whole text: read it as plain words
        const slots: WordSlot[] = []
        for (const part of text.split(/\s+/)) {
          const clean = part.replace(/^[.,?!]+|[.,?!]+$/g, '')
          if (!clean) continue
          slots.push(lookup(clean) ?? spellSlot(clean, t.start, t.end) ?? mk('unknown', null, clean, [], 'unknown', 0))
        }
        add({ slots })
        const last = text[text.length - 1]
        if (!end && (last === '.' || last === '?' || last === '!')) {
          const nx = peek()
          if (!nx || nx.k === 'nl') end = last as Ending
        }
        if (end) break
        continue
      }
    }
    return { groups, end }
  }

  const applyMod = (s: WordSlot, t: Tok) => {
    const name = t.text
    if (name === 'soft' || name === 'loud' || name === 'normal') { s.tone.loud = name; return }
    if (MOD_NAMES.includes(name)) {
      if (name !== 'wobble') { diag('~' + name + ' is saved for a later Koogalien.', t.start, t.end, 'Try ~wobble.'); return }
      const depth = Math.max(0, Math.min(1, t.value ?? DEFAULT_MOD_DEPTH))
      s.tone.mods = s.tone.mods.filter((m) => m.name !== 'wobble').concat({ name: name as ModName, depth: Math.round(depth * 100) / 100 })
      return
    }
    const guess = [...MOD_NAMES, 'soft', 'loud'].map((m) => ({ m, d: Math.abs(m.length - name.length) })).sort((a, b) => a.d - b.d).find((x) => x.m[0] === name[0])
    diag('I do not know the sound shape "~' + name + '".', t.start, t.end, 'Try ~wobble, ~soft or ~loud' + (guess ? '' : '.'))
  }

  const skipStatement = () => {
    for (;;) {
      const t = peek()
      if (!t) return
      p++
      if (t.k === 'nl' || t.k === 'closer') return
    }
  }

  while (p < toks.length) {
    const t = peek()!
    if (t.k === 'nl') { p++; continue }
    const kw = t.k === 'word' ? t.text.toLowerCase() : ''
    if (kw === 'say') {
      p++
      const { groups, end } = parseItems()
      const words = groups.flatMap((g) => g.slots)
      if (!words.length) diag('Say what?', t.start, t.end, 'Add some words: say hello world.')
      says.push({ v: KOOGALIEN_VERSION, words, end: end ?? '.' })
    } else if (kw === 'let') {
      p++
      const nm = peek()
      if (!nm || nm.k !== 'word' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm.text)) {
        diag('let needs a name.', nm ? nm.start : t.end, nm ? nm.end : t.end, 'Like this: let hi = hello friend.')
        skipStatement(); continue
      }
      p++
      const name = nm.text.toLowerCase()
      if (name === 'say' || name === 'let') { diag('"' + name + '" is a Koogalien command, so it cannot be a name.', nm.start, nm.end); skipStatement(); continue }
      const eq = peek()
      if (!eq || eq.k !== 'eq') { diag('After the name I need "=".', nm.end, nm.end, 'Like this: let ' + name + ' = hello friend.'); skipStatement(); continue }
      p++
      const { groups, end } = parseItems()
      const words = groups.flatMap((g) => g.slots)
      if (!words.length) diag('Put some words after the "=".', eq.end, eq.end, 'Like this: let ' + name + ' = hello friend.')
      vars[name] = { v: KOOGALIEN_VERSION, words, end: end ?? '.' }
    } else {
      const first = t.k === 'word' ? t.text : t.text
      diag('I read a line by its first word, and "' + first + '" is not one.', t.start, t.end, 'Start with say: say hello world.')
      skipStatement()
    }
  }

  const prog: Program = { src, sentence: null, vars, errors, says }
  prog.sentence = says.length ? lower(prog) : null
  return prog
}

function cloneSlot(w: WordSlot): WordSlot {
  return { ...w, chords: w.chords.map((c) => [...c]), tone: { loud: w.tone.loud, mods: w.tone.mods.map((m) => ({ ...m })) }, alts: w.alts?.map((a) => ({ ...a })) }
}

