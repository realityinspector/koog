// Pure helpers: turn timed note events into a Song, and persist user songs.
import { detectKey } from '../../music/theory'
import type { Song, SongNote } from './songs'
import { pload, psave } from '../../profile/profile'

export interface RawEvent { note: number; t: number; on: boolean } // t in ms from take start
const MINE_KEY = 'mysongs.v1' // saved per kid
const GRID = 0.125

export function loadMine(): Song[] {
  try { const a = pload<unknown>(MINE_KEY, []); return Array.isArray(a) ? a.map(clean).filter((x): x is Song => !!x) : [] } catch { return [] }
}
export function saveMine(list: Song[]) {
  psave(MINE_KEY, list)
}

/** Quantize to 1/8 beat, collapse chords to highest note, keep rests. Returns null if nothing playable. */
export function quantize(events: RawEvent[], bpm: number): SongNote[] | null {
  const open = new Map<number, number>()
  const segs: { note: number; s: number; e: number }[] = []
  const endT = events.length ? events[events.length - 1].t : 0
  for (const ev of events) {
    if (ev.on) { if (!open.has(ev.note)) open.set(ev.note, ev.t) }
    else { const s = open.get(ev.note); if (s != null) { segs.push({ note: ev.note, s, e: ev.t }); open.delete(ev.note) } }
  }
  open.forEach((s, note) => segs.push({ note, s, e: Math.max(endT, s + 200) }))
  segs.sort((a, b) => a.s - b.s)
  // chord collapse: starts within 70 ms of the cluster start -> keep highest
  const mel: { note: number; s: number; e: number }[] = []
  for (const sg of segs) {
    const last = mel[mel.length - 1]
    if (last && sg.s - last.s < 70) { if (sg.note > last.note) { last.note = sg.note }; last.e = Math.max(last.e, sg.e) } else mel.push({ ...sg })
  }
  if (!mel.length) return null
  const q = (ms: number) => Math.round((ms * bpm) / 60000 / GRID) * GRID
  const t0 = mel[0].s
  const out: SongNote[] = []
  let cursor = 0
  for (let i = 0; i < mel.length; i++) {
    const start = Math.max(cursor, q(mel[i].s - t0))
    if (start - cursor >= 0.25) out.push({ note: null, beats: start - cursor })
    else if (start > cursor && out.length) out[out.length - 1].beats += start - cursor
    let end = Math.max(start + GRID, q(mel[i].e - t0))
    const nextStart = i + 1 < mel.length ? q(mel[i + 1].s - t0) : Infinity
    if (end > nextStart && nextStart > start) end = nextStart
    out.push({ note: mel[i].note, beats: end - start })
    cursor = end
  }
  return fit(out)
}

/** Shift whole melody by octaves into the playable 37-key window. */
function fit(notes: SongNote[]): SongNote[] {
  const ms = notes.filter((n) => n.note != null).map((n) => n.note as number)
  if (!ms.length) return notes
  const shift = Math.round((66 - (Math.min(...ms) + Math.max(...ms)) / 2) / 12) * 12
  const fold = (m: number) => { m += shift; while (m > 83) m -= 12; while (m < 49) m += 12; return m }
  return notes.map((n) => (n.note == null ? n : { ...n, note: fold(n.note) }))
}

export function makeSong(title: string, emoji: string, bpm: number, notes: SongNote[]): Song {
  const ms = notes.filter((n) => n.note != null) as { note: number; beats: number }[]
  const key = detectKey(ms.map((n) => n.note), ms.map((n) => n.beats)).key
  return { id: 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: title.trim().slice(0, 40) || 'Untitled',
    origin: 'My recording', year: String(new Date().getFullYear()), key, bpm, tier: 'easy', notes, hook: emoji, mine: true }
}

/** Validate untrusted JSON (import / storage) into a Song. */
export function clean(x: unknown): Song | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (!Array.isArray(o.notes)) return null
  const bpm = Number(o.bpm)
  if (!(bpm >= 30 && bpm <= 300)) return null
  const notes: SongNote[] = []
  for (const n of o.notes.slice(0, 600)) {
    const r = n as { note?: unknown; beats?: unknown }
    const beats = Number(r?.beats)
    if (!(beats > 0 && beats <= 64)) return null
    if (r.note === null) notes.push({ note: null, beats })
    else if (typeof r.note === 'number' && r.note >= 21 && r.note <= 108) notes.push({ note: r.note, beats })
    else return null
  }
  if (!notes.some((n) => n.note != null)) return null
  const fitted = fit(notes)
  const ms = fitted.filter((n) => n.note != null) as { note: number; beats: number }[]
  const key = detectKey(ms.map((n) => n.note), ms.map((n) => n.beats)).key
  return { id: typeof o.id === 'string' ? o.id.slice(0, 30) : 'my-' + Math.random().toString(36).slice(2, 9),
    title: String(o.title ?? 'Untitled').slice(0, 40), origin: 'My recording', year: String(o.year ?? new Date().getFullYear()),
    key, bpm, tier: 'easy', notes: fitted, hook: typeof o.hook === 'string' ? o.hook.slice(0, 4) : '🎵', mine: true }
}
