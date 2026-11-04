// Code export, Sonic Pi flavour. Pure functions: Koog data in, Sonic Pi (Ruby-style) text out.
// Sonic Pi is a free live-coding tool from the education world; the kid pastes this text in and presses Run.
import { VOICES } from '../../features/drumpads/drumCore'
import { ampOf, fmt16, loopSixteenths, slots, type ExportLayer, type Slot } from './common'

export const SONIC_PI_HOWTO = '# Paste into Sonic Pi and press Run. Change a number, press Run again, and hear what changed.'
const bpmText = (bpm: number) => String(Math.round(bpm * 10) / 10)

/** play / sleep lines for one timeline. Total sleep always equals `total` sixteenths exactly. */
function playLines(sl: Slot[], total: number, indent: string): string[] {
  const out: string[] = []
  let cur = 0
  const rest = (to: number) => { if (to > cur) { out.push(`${indent}sleep ${fmt16(to - cur)}`); cur = to } }
  for (const s of sl) {
    rest(s.at)
    for (const x of s.notes) out.push(`${indent}play ${x.n}, amp: ${ampOf(x.v)}, release: ${fmt16(x.len)}`)
  }
  rest(total) // pad the last sleep so the loop closes exactly
  return out
}

/** one `live_loop :layer_N` per non-empty layer; layers after the first wait for `layer_1` so they start together */
export function layersToSonicPi(layers: ExportLayer[], bpm: number, lenBeats: number): string {
  const total = loopSixteenths(lenBeats)
  const out = [SONIC_PI_HOWTO, `# Made by Koog: ${layers.filter((l) => l.notes.length).length} layer(s), ${Math.round(lenBeats * 100) / 100} beats long.`, `use_bpm ${bpmText(bpm)}`, '']
  let k = 0
  for (const L of layers) {
    if (!L.notes.length) continue
    k++
    out.push(k === 1 ? `live_loop :layer_${k} do` : `live_loop :layer_${k}, sync: :layer_1 do`)
    out.push(...playLines(slots(L.notes, lenBeats), total, '  '))
    out.push('end', '')
  }
  if (k === 0) out.push('# (No notes yet: record a loop in Koog first.)', '')
  return out.join('\n')
}

/** Sonic Pi built-in sample for each Koog drum voice (same order as VOICES in drumCore) */
export const SONIC_PI_SAMPLES: Record<string, string> = {
  kick: ':bd_haus', snare: ':sn_dolf', hat: ':drum_cymbal_closed', open: ':drum_cymbal_open',
  clap: ':perc_snap', tomLo: ':drum_tom_lo_hard', tomHi: ':drum_tom_hi_hard', rim: ':elec_tick',
}
export interface DrumPatternLike { len: number; rows: number[][]; acc: number[] }
/** hit loudness: normal steps play at 80%, accented steps at full (Koog's own rule) */
export const hitAmp = (vel: number, accent: boolean): number => Math.round(Math.min(1, vel * (accent ? 1 : 0.8)) * 100) / 100

/** a 16 or 32 step beat: one `ring` of loudness per drum (0 = silent step) and one live_loop that `tick`s through them */
export function drumsToSonicPi(pattern: DrumPatternLike, bpm: number): string {
  const n = pattern.len
  const out = [SONIC_PI_HOWTO, '# Each drum is a ring of 16th-note steps: 0 means silent, bigger means louder.', `use_bpm ${bpmText(bpm)}`, '']
  const used: { name: string; sample: string }[] = []
  VOICES.forEach((v, i) => {
    const row = pattern.rows[i]
    if (!row || !row.slice(0, n).some((x) => x > 0)) return
    const steps = Array.from({ length: n }, (_, s) => (row[s] > 0 ? hitAmp(row[s], pattern.acc[s] > 0) : 0))
    out.push(`${v.id.toLowerCase()} = (ring ${steps.join(', ')})`)
    used.push({ name: v.id.toLowerCase(), sample: SONIC_PI_SAMPLES[v.id] })
  })
  out.push('', 'live_loop :drums do', '  i = tick')
  for (const u of used) out.push(`  sample ${u.sample}, amp: ${u.name}[i] if ${u.name}[i] > 0`)
  if (!used.length) out.push('  # (No beat yet: add some steps in Koog first.)')
  out.push('  sleep 0.25', 'end', '')
  return out.join('\n')
}

export interface SongLike { title: string; bpm: number; notes: { note: number | null; beats: number }[] }
/** a melody as plain play / sleep lines (a rest is just a sleep) */
export function songToSonicPi(song: SongLike): string {
  const out = [SONIC_PI_HOWTO, `# ${song.title.replace(/[\r\n]+/g, ' ')}`, `use_bpm ${bpmText(song.bpm)}`, '']
  let rest = 0
  const num = (b: number) => String(Math.round(b * 1000) / 1000)
  const flushRest = () => { if (rest > 0) { out.push(`sleep ${num(rest)}`); rest = 0 } }
  for (const x of song.notes) {
    if (x.note == null) { rest += x.beats; continue }
    flushRest()
    out.push(`play ${x.note}, release: ${num(Math.max(0.0625, x.beats))}`, `sleep ${num(x.beats)}`)
  }
  flushRest()
  return out.join('\n') + '\n'
}
