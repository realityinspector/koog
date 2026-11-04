// Code export, Strudel flavour. Pure functions: Koog data in, Strudel (JavaScript + mini-notation) text out.
// Strudel is a free live-coding tool from the education world that runs in the browser.
import { VOICES } from '../../features/drumpads/drumCore'
import { loopSixteenths, noteName, slots, type ExportLayer } from './common'
import type { DrumPatternLike, SongLike } from './sonicPi'

export const STRUDEL_HOWTO = '// Press Ctrl+Enter (or the play button) in Strudel to hear it. Change a note, press Ctrl+Enter again.'
const bpmText = (bpm: number) => String(Math.round(bpm * 10) / 10)
const w = (name: string, weight: number) => (weight === 1 ? name : `${name}@${weight}`)

/** a sequence in 1/16 weights: "c4@2 ~ [c4,e4,g4]@4". Weights add up to `total`. */
function seqOf(notes: Parameters<typeof slots>[0], lenBeats: number): string {
  const total = loopSixteenths(lenBeats), sl = slots(notes, lenBeats), parts: string[] = []
  let cur = 0
  const rest = (to: number) => { if (to > cur) { parts.push(w('~', to - cur)); cur = to } }
  for (let i = 0; i < sl.length; i++) {
    const s = sl[i]
    rest(s.at)
    const next = sl[i + 1], span = (next ? next.at : total) - s.at
    const names = s.notes.map((x) => noteName(x.n))
    parts.push(w(names.length > 1 ? `[${names.join(',')}]` : names[0], span))
    cur = s.at + span
  }
  rest(total)
  return parts.join(' ')
}

/** each non-empty layer is a `note("...")` pattern; several are joined with stack(...). One cycle = the whole loop. */
export function layersToStrudel(layers: ExportLayer[], bpm: number, lenBeats: number): string {
  const lines = layers.filter((l) => l.notes.length).map((l) => `  note("${seqOf(l.notes, lenBeats)}").s("piano")`)
  const out = [STRUDEL_HOWTO, `setcpm(${bpmText(bpm)}/${Math.round(lenBeats * 100) / 100}) // one cycle = the whole loop (${Math.round(lenBeats * 100) / 100} beats)`]
  if (!lines.length) return out.concat('// (No notes yet: record a loop in Koog first.)', '').join('\n')
  out.push(lines.length === 1 ? lines[0].trim() : `stack(\n${lines.join(',\n')}\n)`, '')
  return out.join('\n')
}

/** Strudel's built-in drum sound for each Koog voice (same order as VOICES) */
export const STRUDEL_SAMPLES: Record<string, string> = { kick: 'bd', snare: 'sd', hat: 'hh', open: 'oh', clap: 'cp', tomLo: 'lt', tomHi: 'ht', rim: 'rim' }

/** one `s("bd ~ sd ~ ...")` per drum, stacked. A 16-step beat is one cycle (one bar). */
export function drumsToStrudel(pattern: DrumPatternLike, bpm: number): string {
  const n = pattern.len, beats = n / 4
  const rows: string[] = []
  VOICES.forEach((v, i) => {
    const row = pattern.rows[i]
    if (!row || !row.slice(0, n).some((x) => x > 0)) return
    rows.push(`  s("${Array.from({ length: n }, (_, s) => (row[s] > 0 ? STRUDEL_SAMPLES[v.id] : '~')).join(' ')}")`)
  })
  const out = [STRUDEL_HOWTO, `setcpm(${bpmText(bpm)}/${beats}) // one cycle = ${n / 16} bar${n === 16 ? '' : 's'}`]
  if (!rows.length) return out.concat('// (No beat yet: add some steps in Koog first.)', '').join('\n')
  out.push(rows.length === 1 ? rows[0].trim() : `stack(\n${rows.join(',\n')}\n)`, '')
  return out.join('\n')
}

/** a melody as one note("...") pattern, one cycle = the whole song */
export function songToStrudel(song: SongLike): string {
  const parts = song.notes.map((x) => w(x.note == null ? '~' : noteName(x.note), Math.max(1, Math.round(x.beats * 4))))
  const beats = song.notes.reduce((a, x) => a + Math.max(1, Math.round(x.beats * 4)), 0) / 4
  return [STRUDEL_HOWTO, `// ${song.title.replace(/[\r\n]+/g, ' ')}`, `setcpm(${bpmText(song.bpm)}/${beats})`, `note("${parts.join(' ')}").s("piano")`, ''].join('\n')
}

/** Strudel opens code from the URL hash: https://strudel.cc/#<encodeURIComponent(base64(utf8 code))> (checked against Strudel's own code2hash in packages/core/util.mjs) */
export function strudelUrl(code: string): string {
  const bytes = new TextEncoder().encode(code)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return 'https://strudel.cc/#' + encodeURIComponent(btoa(bin))
}
