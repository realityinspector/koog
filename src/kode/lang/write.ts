// Music -> code ("Write it for me"): turn played notes and drum hits into a `notes "..."` / `drums "..."` line. PURE.
// The first sound is the start of the bar. Sounds snap to an eighth-note grid (or sixteenths when the playing was fiddlier), a phrase
// longer than a bar becomes <[bar1] [bar2]>, and steps are merged ("c ~ e ~" -> "c e") when that sounds the same.
import { CYCLE_BEATS } from './types'
import { drumVoice, DRUM_NAMES, midiName } from './names'

/** the least a played sound has to say (a Kode token has all of these) */
export interface Played { src: string; pitch?: number; lane?: number; vel: number; t: number }
export interface Onset { beat: number; names: string[] }

export const MAX_BARS = 4
const CHORD_MS = 45

/** place onsets (beats from the phrase start) on a grid and write the pattern text. */
export function onsetsToPattern(onsets: Onset[], grid: 'auto' | 2 | 4 = 'auto'): { text: string; bars: number; dropped: number } {
  if (!onsets.length) return { text: '~', bars: 1, dropped: 0 }
  const errAt = (r: number) => onsets.reduce((m, o) => Math.max(m, Math.abs(o.beat * r - Math.round(o.beat * r))), 0)
  const r = grid === 'auto' ? (errAt(2) <= 0.3 ? 2 : 4) : grid
  const per = CYCLE_BEATS * r
  const slots = new Map<number, Set<string>>()
  let maxSlot = 0, dropped = 0
  for (const o of onsets) {
    const k = Math.max(0, Math.round(o.beat * r))
    if (k >= per * MAX_BARS) { dropped += o.names.length; continue }
    maxSlot = Math.max(maxSlot, k)
    const set = slots.get(k) ?? new Set<string>()
    o.names.forEach((n) => set.add(n))
    slots.set(k, set)
  }
  const bars = Math.floor(maxSlot / per) + 1
  const texts: string[] = []
  for (let b = 0; b < bars; b++) {
    let arr: string[] = []
    for (let i = 0; i < per; i++) {
      const set = slots.get(b * per + i)
      arr.push(!set ? '~' : set.size === 1 ? [...set][0] : '[' + [...set].sort().join(',') + ']')
    }
    while (arr.length > 4 && arr.length % 2 === 0 && arr.every((x, i) => i % 2 === 0 || x === '~')) arr = arr.filter((_, i) => i % 2 === 0)
    texts.push(arr.join(' '))
  }
  const text = bars === 1 ? texts[0] : '<' + texts.map((t) => (t === '~' ? '~' : '[' + t + ']')).join(' ') + '>'
  return { text, bars, dropped }
}

/** group sounds that happened within a few ms into one onset (a chord / pads hit together) */
function cluster(items: { t: number; name: string }[]): { t: number; names: string[] }[] {
  const sorted = [...items].sort((a, b) => a.t - b.t)
  const out: { t: number; names: string[] }[] = []
  for (const it of sorted) {
    const last = out[out.length - 1]
    if (last && it.t - last.t <= CHORD_MS) { if (!last.names.includes(it.name)) last.names.push(it.name) } else out.push({ t: it.t, names: [it.name] })
  }
  return out
}

/** the drum a played token means: pad lanes follow the drum voices; the foot pedal is the kick; the on-screen GO button is ignored */
export function drumNameOf(p: Played): string | null {
  if (p.pitch != null) return null
  if (p.src === 'pedal') return 'kick'
  if (p.lane != null) return DRUM_NAMES[Math.max(0, Math.min(7, Math.round(p.lane)))]
  return null
}

export interface Written { lines: string[]; notes: number; drums: number; bars: number; dropped: number }

/** played tokens + the tempo -> code lines. The first sound (of either kind) is beat 0. */
export function writeFromPlayed(played: readonly Played[], bpm: number): Written {
  const toks = [...played].sort((a, b) => a.t - b.t)
  const out: Written = { lines: [], notes: 0, drums: 0, bars: 1, dropped: 0 }
  if (!toks.length) return out
  const t0 = toks[0].t, msb = 60000 / Math.max(20, bpm)
  const noteItems: { t: number; name: string }[] = [], drumItems: { t: number; name: string }[] = []
  for (const p of toks) {
    const ms = p.t - t0
    if (p.pitch != null) noteItems.push({ t: ms, name: midiName(p.pitch) })
    else { const d = drumNameOf(p); if (d) drumItems.push({ t: ms, name: d }) }
  }
  const toOn = (items: { t: number; name: string }[]): Onset[] => cluster(items).map((c) => ({ beat: c.t / msb, names: c.names }))
  const n = toOn(noteItems), d = toOn(drumItems)
  if (n.length) { const w = onsetsToPattern(n); out.lines.push(`notes "${w.text}"`); out.notes = n.length; out.bars = Math.max(out.bars, w.bars); out.dropped += w.dropped }
  if (d.length) { const w = onsetsToPattern(d); out.lines.push(`drums "${w.text}"`); out.drums = d.length; out.bars = Math.max(out.bars, w.bars); out.dropped += w.dropped }
  return out
}

/** drum pattern rows (rows[voice][step], 16th-note steps, 16 or 32 long) -> a drums line, or null when empty */
export function drumRowsToLine(rows: readonly (readonly number[])[], len: number): string | null {
  const on: Onset[] = []
  for (let s = 0; s < len; s++) {
    const names: string[] = []
    rows.forEach((row, v) => { if ((row[s] ?? 0) > 0 && DRUM_NAMES[v]) names.push(DRUM_NAMES[v]) })
    if (names.length) on.push({ beat: s / 4, names })
  }
  if (!on.length) return null
  return `drums "${onsetsToPattern(on, 4).text}"`
}

export interface LoopNote { t: number; n: number }
/** a looper layer (notes with start times in beats) -> a notes line, or null when empty */
export function loopNotesToLine(notes: readonly LoopNote[]): string | null {
  if (!notes.length) return null
  const by = new Map<number, Set<string>>()
  for (const x of notes) { const k = Math.round(x.t * 1000) / 1000; const s = by.get(k) ?? new Set<string>(); s.add(midiName(x.n)); by.set(k, s) }
  const on: Onset[] = [...by.entries()].map(([beat, s]) => ({ beat, names: [...s] }))
  return `notes "${onsetsToPattern(on).text}"`
}

export { drumVoice }
