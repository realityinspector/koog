// The whole program: a tokenizer, a line parser and nothing else. There is no eval, no Function, no way to run general code. PURE.
//   notes "c e g e"      a note pattern  (one per line; each line is its own loop layer)
//   drums "kick ~ snare ~"
//   tempo 100            beats per minute (40 to 240), shared by everything
//   sound "ladder"       the instrument for the layers BELOW it (or put it after a pattern on the same line)
//   loud 0.8             how loud, 0 to 1, the same way
//   # a comment
import { BPM_MAX, BPM_MIN } from './limits'
import { KEYWORDS, SOUND_NAMES, didYouMean, isSound } from './names'
import { parseNotation } from './notation'
import { KodeError, LIMITS, diag, type Diag, type LayerSpec, type PatKind, type Program } from './types'

interface Tok { kind: 'word' | 'str'; text: string; start: number; end: number }

/** split one line into words and quoted strings; `#` outside quotes starts a comment. `at` = offset of the line in the program */
function tokenize(line: string, at: number): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '#') break
    if (c === '"' || c === "'") {
      const close = line.indexOf(c, i + 1)
      if (close < 0) throw new KodeError(`This quote never closes. Put a ${c} at the end of the pattern.`, at + i, at + line.length)
      out.push({ kind: 'str', text: line.slice(i + 1, close), start: at + i + 1, end: at + close })
      i = close + 1
      continue
    }
    const s = i
    while (i < line.length && !' \t\r"\'#'.includes(line[i])) i++
    out.push({ kind: 'word', text: line.slice(s, i), start: at + s, end: at + i })
  }
  return out
}

interface Defaults { sound: string; loud: number }

function parseLine(line: string, at: number, lineNo: number, d: Defaults, st: { tempo?: number }): LayerSpec | null {
  const toks = tokenize(line, at)
  let pat: { kind: PatKind; tok: Tok } | null = null
  let sound: string | undefined, loud: number | undefined
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (t.kind === 'str') throw new KodeError('I found some text in quotes without a word in front. Start the line with notes, drums, tempo, sound or loud.', t.start - 1, t.end + 1)
    const kw = t.text.toLowerCase()
    const arg = toks[i + 1]
    switch (kw) {
      case 'notes': case 'drums': {
        if (!arg || arg.kind !== 'str') throw new KodeError(`${kw} needs a pattern in quotes, like ${kw} "${kw === 'notes' ? 'c e g e' : 'kick ~ snare ~'}".`, t.start, t.end)
        if (pat) throw new KodeError('Put each pattern on its own line. Every line is its own layer.', t.start, t.end)
        pat = { kind: kw, tok: arg }
        i++
        break
      }
      case 'tempo': {
        const n = arg && arg.kind === 'word' ? Number(arg.text) : arg && arg.kind === 'str' ? Number(arg.text) : NaN
        if (!arg || !Number.isFinite(n)) throw new KodeError('tempo needs a number, like tempo 100.', t.start, arg ? arg.end : t.end)
        if (n < BPM_MIN || n > BPM_MAX) throw new KodeError(`tempo goes from ${BPM_MIN} to ${BPM_MAX} beats per minute.`, arg.start, arg.end)
        st.tempo = n
        i++
        break
      }
      case 'sound': {
        if (!arg) throw new KodeError(`sound needs a name, like sound "ladder". Try ${SOUND_NAMES.slice(0, 6).join(', ')}.`, t.start, t.end)
        const w = arg.text.toLowerCase()
        if (!isSound(w)) {
          const near = didYouMean(w, SOUND_NAMES)
          throw new KodeError(`I don't know the sound '${arg.text}'.${near ? ` Did you mean '${near}'?` : ''} Sounds are ${SOUND_NAMES.join(', ')}.`, arg.start, arg.end)
        }
        sound = w === 'koog' ? 'piano' : w
        i++
        break
      }
      case 'loud': {
        const n = arg ? Number(arg.text) : NaN
        if (!arg || !Number.isFinite(n)) throw new KodeError('loud needs a number from 0 to 1, like loud 0.8.', t.start, arg ? arg.end : t.end)
        if (n < 0 || n > 1) throw new KodeError('loud goes from 0 (silent) to 1 (full).', arg.start, arg.end)
        loud = n
        i++
        break
      }
      default: {
        const near = didYouMean(kw, KEYWORDS)
        throw new KodeError(`I don't know the word '${t.text}'.${near ? ` Did you mean '${near}'?` : ''} Words I know: ${KEYWORDS.join(', ')}.`, t.start, t.end)
      }
    }
  }
  if (!pat) {
    // a line with only sound / loud / tempo sets the defaults for the layers below it
    if (sound !== undefined) d.sound = sound
    if (loud !== undefined) d.loud = loud
    return null
  }
  const node = parseNotation(pat.tok.text, pat.tok.start, pat.kind)
  return { kind: pat.kind, node, sound: sound ?? d.sound, loud: loud ?? d.loud, line: lineNo }
}

/** Parse a program. Never throws; problems come back in `errors` (at most one per line). */
export function parseProgram(src: string): Program {
  const prog: Program = { src, layers: [], errors: [] }
  if (src.length > LIMITS.src) {
    prog.errors.push(diag(src, `That is a lot of code! Koog Kode stops at ${LIMITS.src} characters. Cut some lines.`, LIMITS.src, src.length))
    return prog
  }
  const d: Defaults = { sound: 'piano', loud: 0.8 }
  const st: { tempo?: number } = {}
  let at = 0, lineNo = 0, codeLines = 0
  for (const line of src.split('\n')) {
    lineNo++
    const lineAt = at
    at += line.length + 1
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (++codeLines > LIMITS.lines) { prog.errors.push(diag(src, `That is more than ${LIMITS.lines} lines of code. Koog Kode keeps it small.`, lineAt, lineAt + line.length)); break }
    try {
      const layer = parseLine(line, lineAt, lineNo, d, st)
      if (layer) {
        if (prog.layers.length >= LIMITS.layers) throw new KodeError(`Koog Kode plays up to ${LIMITS.layers} layers at once. Take a line out first.`, lineAt, lineAt + line.length)
        prog.layers.push(layer)
      }
    } catch (e) {
      if (!(e instanceof KodeError)) throw e
      prog.errors.push(diag(src, e.message, e.start, e.end))
    }
  }
  if (st.tempo !== undefined) prog.tempo = st.tempo
  if (!prog.layers.length && !prog.errors.length) prog.errors.push(diag(src, 'There is nothing to play yet. Try a line like: notes "c e g e"', 0, Math.min(1, src.length)))
  return prog
}
