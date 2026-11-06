// The Library reader engine: plays an edition sentence by sentence as plain or High Koogalien, with pause, seeking, speed presets, "play along" and per-player progress.
// It owns no DOM. Everything goes through the KoogalienHost (capped sound, mods, progress), so it runs under tsx with a fake host (scripts/library-fixtures.ts).
// The store lives on import.meta.hot.data so a code edit never drops the book the kid is reading.
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import { translate } from '../../../koogalien/engine/translate'
import type { Chord, Score, Sentence } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { renderHigh, renderPlain, sceneOf, SPEEDS, type Rendered, type Scene, type SpeedName } from '../../../koogalien/library/high'
import { delivery } from '../../../koogalien/library/text'
import type { Edition, Line, VoiceNo } from '../../../koogalien/library/types'
import { playScore, type PlayHandle } from '../play/playScore'

export interface Pos { ch: number; p: number; s: number }  // p === -1 is the chapter title
export type Register = 'high' | 'plain'
export interface Along { word: number; chord: Chord; misses: number; hit: boolean }
export interface BookProgress { ch: number; p: number; s: number; done: number[]; hits: number }
export interface Prefs { mode: Register; speed: SpeedName; along: boolean }
export const PREFS_KEY = 'library.prefs'
export const bookKey = (id: string) => 'library.book.' + id

export interface ReaderState {
  edition: Edition | null
  pos: Pos
  playing: boolean
  mode: Register
  speed: SpeedName
  along: boolean
  rendered: Rendered | null
  line: Line | null
  playingWord: number | null
  target: Along | null
  scene: Scene
  hits: number
  done: number[]
  ended: boolean
  /** every note this reader has handed to the host (for tests and the safety meter) */
  notes: number
}
const init = (): ReaderState => ({ edition: null, pos: { ch: 0, p: -1, s: 0 }, playing: false, mode: 'high', speed: 'story time', along: false, rendered: null, line: null, playingWord: null, target: null, scene: 'steady', hits: 0, done: [], ended: false, notes: 0 })

type HotData = { reader?: UseBoundStore<StoreApi<ReaderState>> }
const hot = (import.meta.hot?.data ?? {}) as HotData
export const useReader = hot.reader ?? create<ReaderState>(() => init())
if (import.meta.hot) import.meta.hot.data.reader = useReader
const st = () => useReader.getState()
const set = (p: Partial<ReaderState>) => useReader.setState(p)

/* ---------- reading the edition ---------- */
export const stripNo = (t: string) => t.replace(/^\d+\.\s+/, '')
export function lineAt(ed: Edition, pos: Pos): Line | null {
  const ch = ed.chapters[pos.ch]; if (!ch) return null
  if (pos.p === -1) return [stripNo(ch.t), '', 0]
  return ch.ps[pos.p]?.[pos.s] ?? null
}
export function nextPos(ed: Edition, pos: Pos): Pos | null {
  const ch = ed.chapters[pos.ch]; if (!ch) return null
  if (pos.p === -1) return ch.ps.length ? { ch: pos.ch, p: 0, s: 0 } : nextPos(ed, { ch: pos.ch, p: ch.ps.length - 1, s: 0 })
  const para = ch.ps[pos.p]
  if (para && pos.s + 1 < para.length) return { ch: pos.ch, p: pos.p, s: pos.s + 1 }
  if (pos.p + 1 < ch.ps.length) return { ch: pos.ch, p: pos.p + 1, s: 0 }
  if (pos.ch + 1 < ed.chapters.length) return { ch: pos.ch + 1, p: -1, s: 0 }
  return null
}
export const paraEnd = (ed: Edition, pos: Pos): boolean => pos.p >= 0 && pos.s === (ed.chapters[pos.ch]?.ps[pos.p]?.length ?? 1) - 1
export const chapterEnd = (ed: Edition, pos: Pos): boolean => paraEnd(ed, pos) && pos.p === (ed.chapters[pos.ch]?.ps.length ?? 1) - 1
const sceneMemo = new Map<string, Scene>()
function sceneFor(ed: Edition, pos: Pos): Scene {
  if (pos.p < 0) return 'steady'
  const k = `${ed.id}:${pos.ch}:${pos.p}`
  let s = sceneMemo.get(k)
  if (!s) { s = sceneOf((ed.chapters[pos.ch]?.ps[pos.p] ?? []).map((l) => l[0]).join(' ')); sceneMemo.set(k, s) }
  return s
}

/** the sentence under the cursor, rendered in the current register at the current speed */
export function renderAt(ed: Edition, pos: Pos, mode: Register, speed: SpeedName, hostBpm = 100): Rendered | null {
  const line = lineAt(ed, pos); if (!line) return null
  const [en, , voice] = line
  const tail = chapterEnd(ed, pos) ? 7 : paraEnd(ed, pos) ? 3.5 : pos.p === -1 ? 3 : 0
  const sp = SPEEDS[speed] * (100 / Math.max(30, hostBpm))
  if (mode === 'plain') return renderPlain(en, voice, { speed: sp, tail: tail * 0.6 + 1.2 })
  return renderHigh(en, { chapter: pos.ch, scene: sceneFor(ed, pos), voice: voice as VoiceNo, delivery: delivery(en), title: pos.p === -1 }, { speed: sp, tail: tail + 0.8 })
}

/* ---------- the engine ---------- */
/** engine state lives on import.meta.hot.data too, so two copies of this module (after a hot edit) still drive one reader */
interface Eng { host: KoogalienHost | null; run: number; handle: PlayHandle | null; timers: ReturnType<typeof setTimeout>[]; wait: ((c: Chord | 'skip') => void) | null; saveSoon: ReturnType<typeof setTimeout> | null; wrapped: KoogalienHost | null }
const E: Eng = ((hot as { eng?: Eng }).eng ??= { host: null, run: 0, handle: null, timers: [], wait: null, saveSoon: null, wrapped: null })
if (import.meta.hot) import.meta.hot.data.eng = E

/** the host with a filter sweep added: a question closes the synth filter for a moment (the synth cutoff is restored every time) */
function sweepHost(h: KoogalienHost): KoogalienHost {
  let saved: number | null = null
  const later = (whenBeat: number, fn: () => void) => {
    const ms = Math.max(0, (whenBeat - h.sound.nowBeat()) * 60000 / Math.max(30, h.sound.bpm()))
    E.timers.push(setTimeout(fn, ms))
  }
  return {
    ...h,
    sound: { ...h.sound, note: (m, v, w, d) => { set({ notes: st().notes + 1 }); h.sound.note(m, Math.min(0.85, v), w, d) } },
    mods: {
      patch: (a) => h.mods.patch(a),
      apply(mod, whenBeat) {
        if (mod.name !== 'filter') return h.mods.apply(mod, whenBeat)
        later(whenBeat, () => { void import('../../synth-history/engine').then(({ getSynth }) => { try { const p = getSynth().params; saved ??= p.cutoff; getSynth().setParams({ cutoff: Math.max(300, p.cutoff * 0.35) }) } catch { /* audio not ready */ } }).catch(() => undefined) })
      },
      release(mod, whenBeat) {
        if (mod.name !== 'filter') return h.mods.release(mod, whenBeat)
        later(whenBeat, () => { void import('../../synth-history/engine').then(({ getSynth }) => { try { if (saved !== null) getSynth().setParams({ cutoff: saved }); saved = null } catch { /* ignore */ } }).catch(() => undefined) })
      },
    },
  }
}
let wrapped: KoogalienHost | null = null

export function attach(h: KoogalienHost): void {
  E.host = h; E.wrapped = sweepHost(h)
  const prefs = h.progress.load<Partial<Prefs>>(PREFS_KEY, {})
  set({
    mode: prefs.mode === 'plain' ? 'plain' : 'high',
    speed: prefs.speed && prefs.speed in SPEEDS ? prefs.speed : 'story time',
    along: prefs.along === true,
  })
}
export function detach(): void { pause(); E.wrapped = null; E.host = null }

const savePrefs = () => E.host?.progress.save(PREFS_KEY, { mode: st().mode, speed: st().speed, along: st().along } satisfies Prefs)
export function saveProgress(): void {
  const s = st(); if (!E.host || !s.edition) return
  E.host.progress.save(bookKey(s.edition.id), { ...s.pos, done: s.done, hits: s.hits } satisfies BookProgress)
}
const saveLater = () => { if (E.saveSoon) clearTimeout(E.saveSoon); E.saveSoon = setTimeout(saveProgress, 400) }

export function loadSavedPos(id: string, ed: Edition): BookProgress {
  const raw = E.host?.progress.load<Partial<BookProgress> | null>(bookKey(id), null) ?? null
  const ch = Math.max(0, Math.min(ed.chapters.length - 1, Math.floor(Number(raw?.ch) || 0)))
  const para = ed.chapters[ch]?.ps ?? []
  const p = Math.max(-1, Math.min(para.length - 1, Math.floor(Number(raw?.p ?? -1))))
  const s = p < 0 ? 0 : Math.max(0, Math.min((para[p]?.length ?? 1) - 1, Math.floor(Number(raw?.s) || 0)))
  const done = Array.isArray(raw?.done) ? raw!.done.filter((n): n is number => Number.isInteger(n)) : []
  return { ch, p, s, done, hits: Math.max(0, Math.floor(Number(raw?.hits) || 0)) }
}

export function openBook(ed: Edition): void {
  pause()
  const sv = loadSavedPos(ed.id, ed)
  set({ edition: ed, pos: { ch: sv.ch, p: sv.p, s: sv.s }, done: sv.done, hits: sv.hits, ended: false, target: null, playingWord: null })
  refresh()
}
export function closeBook(): void { pause(); saveProgress(); set({ edition: null, rendered: null, line: null }) }

function refresh(): void {
  const s = st(); if (!s.edition) return
  const bpm = E.host?.sound.bpm() ?? 100
  const rendered = renderAt(s.edition, s.pos, s.mode, s.speed, bpm)
  set({ rendered, line: lineAt(s.edition, s.pos), scene: sceneFor(s.edition, s.pos) })
}

export function setMode(mode: Register): void { set({ mode }); savePrefs(); const was = st().playing; if (was) restart(); else refresh() }
export function setSpeed(speed: SpeedName): void { set({ speed }); savePrefs(); const was = st().playing; if (was) restart(); else refresh() }
export function setAlong(along: boolean): void { set({ along, target: null }); savePrefs(); if (st().playing) restart() }

export function seek(pos: Pos): void {
  const was = st().playing
  stopSound(); set({ pos, ended: false, target: null, playingWord: null }); refresh(); saveLater()
  if (was) void loop(++E.run)
}
export function jumpPara(delta: number): void {
  const s = st(); if (!s.edition) return
  const ch = s.edition.chapters[s.pos.ch]; if (!ch) return
  let { ch: c, p } = s.pos
  p += delta
  if (p < 0) { if (s.pos.p > 0 || delta > 0) p = 0; else if (c > 0) { c--; p = Math.max(0, s.edition.chapters[c].ps.length - 1) } else p = -1 }
  else if (p >= ch.ps.length) { if (c + 1 < s.edition.chapters.length) { c++; p = -1 } else p = ch.ps.length - 1 }
  seek({ ch: c, p, s: 0 })
}
export function jumpChapter(ch: number): void {
  const s = st(); if (!s.edition) return
  seek({ ch: Math.max(0, Math.min(s.edition.chapters.length - 1, ch)), p: -1, s: 0 })
}

function stopSound(): void {
  E.run++
  for (const t of E.timers.splice(0)) clearTimeout(t)
  if (E.wait) { const w = E.wait; E.wait = null; w('skip') }
  if (E.handle) { try { E.handle.stop() } catch { /* ignore */ } E.handle = null }
  E.host?.guide.clear()
}
export function pause(): void { stopSound(); if (st().playing || st().target) set({ playing: false, target: null, playingWord: null }); saveProgress() }
function restart(): void { stopSound(); refresh(); void loop(++E.run) }
export function play(): void {
  const s = st(); if (!s.edition || !E.host || s.playing) return
  if (s.ended) set({ ended: false, pos: { ch: 0, p: -1, s: 0 } })
  set({ playing: true }); refresh()
  void loop(++E.run)
}
export function toggle(): void { if (st().playing) pause(); else play() }

/** the word's own slice of a sentence score, starting at beat 0 */
export function sliceWord(score: Score, i: number, closer: boolean): Score {
  const at0 = closer ? Math.min(...score.chords.filter((c) => c.word === i).map((c) => c.at)) : score.wordStarts[i]
  const chords = score.chords.filter((c) => c.word === i).map((c) => ({ ...c, at: c.at - at0 }))
  const mods = score.mods.filter((m) => m.word === i).map((m) => ({ ...m, at: m.at - at0 }))
  const beats = chords.reduce((m, c) => Math.max(m, c.at + c.dur), 0.1)
  return { ...score, beats, chords, mods, wordStarts: [0], liftAt: undefined, liftApplied: true }
}

const sameChord = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i])
/** the kid's chord (from keys or the on-screen pads). Returns true when it was the word being asked for. */
export function submitChord(chord: Chord): boolean {
  const t = st().target; if (!t || !E.wait) return false
  if (sameChord(chord, t.chord)) { const w = E.wait; E.wait = null; w(chord); return true }
  const misses = t.misses + 1
  set({ target: { ...t, misses } })
  if (misses >= 3) { const w = E.wait; E.wait = null; w('skip') }
  return false
}
export function skipTarget(): void { if (E.wait) { const w = E.wait; E.wait = null; w('skip') } }

function playOne(r: Rendered, score: Score, token: number, onWord?: (i: number) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    if (token !== E.run || !E.wrapped) { resolve(); return }
    E.handle = playScore(score, E.wrapped, { alien: r.alien, onWord })
    void E.handle.done.then(() => resolve())
  })
}

async function loop(token: number): Promise<void> {
  while (token === E.run && E.host) {
    const s = st(); const ed = s.edition; if (!ed || !s.playing) return
    const r = s.rendered ?? renderAt(ed, s.pos, s.mode, s.speed, E.host.sound.bpm()); if (!r) return
    if (s.along && r.sentence.words.length) {
      const words = r.sentence.words
      for (let i = 0; i < words.length && token === E.run; i++) {
        const w = words[i]
        const slice = sliceWord(r.score, i, false)
        if (w.kind === 'word' || w.kind === 'digit') {
          const chord = w.chords[0]
          set({ playingWord: i, target: { word: i, chord, misses: 0, hit: false } })
          E.host.guide.show(chord.map((d) => midiOfDegree(d, 60)))
          const got = await new Promise<Chord | 'skip'>((res) => { E.wait = res })
          E.host.guide.clear()
          if (token !== E.run) return
          if (got !== 'skip') { set({ hits: st().hits + 1, target: { word: i, chord, misses: 0, hit: true } }); saveLater() }
          else set({ target: null })
          await playOne(r, slice, token)
        } else {
          set({ playingWord: i, target: null })
          await playOne(r, slice, token)
        }
      }
      if (token !== E.run) return
      const closer = words.length
      await playOne(r, { ...sliceWord(r.score, closer, true), beats: Math.max(1, sliceWord(r.score, closer, true).beats + 1) }, token)
      set({ target: null })
    } else {
      await playOne(r, r.score, token, (i) => set({ playingWord: i }))
    }
    if (token !== E.run) return
    const np = nextPos(ed, s.pos)
    const done = chapterEnd(ed, s.pos) && !s.done.includes(s.pos.ch) ? [...s.done, s.pos.ch] : s.done
    if (!np) { set({ playing: false, ended: true, done, playingWord: null }); saveProgress(); E.host.celebrate('Book finished!'); return }
    set({ pos: np, done, playingWord: null }); refresh(); saveLater()
  }
}

export function toTranslated(en: string): Sentence { return translate(en.replace(/_/g, '')) }
if (import.meta.hot) import.meta.hot.accept()
