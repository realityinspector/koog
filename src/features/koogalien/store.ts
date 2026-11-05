// The Koogalien Writer's state (zustand). One Sentence is the hub: the ribbon, the code box, the English line, the
// playback and the share link are all views of it. Tokens and mod samples come in through feedToken / feedMod
// (src/features/koogalien/listen.ts wires the devices); nothing here touches the DOM or audio, so it runs under tsx.
// The recognizer state is opaque plain data that lives on import.meta.hot.data so editing this file never drops half a sentence.
import { create } from 'zustand'
import type { Chord, Degree, Ending, ModSample, Sentence, WordSlot } from '../../koogalien/data/types'
import { LIMITS } from '../../koogalien/data/types'
import { alienById } from '../../koogalien/data/aliens'
import { degreeOf } from '../../koogalien/data/degrees'
import { lexById } from '../../koogalien/data/lexicon'
import { encode } from '../../koogalien/engine/encode'
import { newRecState, pending, step, type RecInput, type RecOut, type RecState } from '../../koogalien/engine/recognize'
import { parse } from '../../koogalien/lang/parse'
import { lower } from '../../koogalien/lang/lower'
import { print } from '../../koogalien/lang/print'
import { toShare } from '../../koogalien/lang/share'
import { playScore, type PlayHandle } from './play/playScore'
import { emitMod } from './play/modInput'
import type { KoogalienHost } from '../../koogalien/ports'
import type { KodeToken } from '../../kode/kodeCore'
import type { Diag } from '../../koogalien/data/types'

export type Listening = { chords: Chord[]; words: WordSlot[]; spelling: boolean; half: Degree | null }
export interface OutboxItem { code: string; en: string; at: number }
export interface KoogalienSettings { autoAccept: boolean; alien: string; chordBuilder: boolean }

export interface KoogalienState {
  tab: 'write' | 'dictionary' | 'learn'
  sentence: Sentence | null
  /** false while the kid is still mid-sentence (the draft shows, but no closer has been played) */
  ended: boolean
  listening: Listening
  code: string
  codeErrors: Diag[]
  playingWord: number | null
  alien: string
  bpm: number
  /** on-screen wobble slider, 0..1 */
  wobble: number
  /** accessibility mode: keys stay lit until commit */
  chordBuilder: boolean
  /** per-player setting: take the best guess for a 'maybe' word without asking (off by default) */
  autoAccept: boolean
  /** pads shown lit (just pressed, or held in chord-builder mode) */
  lit: Degree[]
  status: string
  outbox: OutboxItem[]
  homeC: number
}

const EMPTY: Listening = { chords: [], words: [], spelling: false, half: null }
const INITIAL: KoogalienState = {
  tab: 'write', sentence: null, ended: false, listening: EMPTY, code: '', codeErrors: [], playingWord: null, alien: 'pip', bpm: 100,
  wobble: 0, chordBuilder: false, autoAccept: false, lit: [], status: '', outbox: [], homeC: 60,
}

interface Hot { store?: ReturnType<typeof make>; rec?: RecState; draft?: WordSlot[]; fixed?: Record<number, WordSlot>; litT?: number; held?: Degree[]; builderTokens?: KodeToken[] }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<KoogalienState>()(() => ({ ...INITIAL })) }
export const useKoogalien = hot.store ?? make()

// ---- recognizer plumbing (module state, kept across hot edits)
let rec: RecState = hot.rec ?? newRecState()
let draft: WordSlot[] = hot.draft ?? []
let fixed: Record<number, WordSlot> = hot.fixed ?? {}
let litT = hot.litT ?? 0
let held: Degree[] = hot.held ?? []
let builderTokens: KodeToken[] = hot.builderTokens ?? []
let hostRef: KoogalienHost | null = null
let handle: PlayHandle | null = null
const marked = new Set<string>()

const set = useKoogalien.setState
const get = useKoogalien.getState

function mark(id: Parameters<KoogalienHost['concepts']['mark']>[0]) {
  if (marked.has(id)) return
  marked.add(id)
  try { hostRef?.concepts.mark(id) } catch { /* concept marking must never break the Writer */ }
}

function resetRec() {
  rec = newRecState({ homeC: get().homeC, autoAccept: get().autoAccept, bpm: get().bpm })
  draft = []; fixed = {}
}

function withFixes(words: WordSlot[]): WordSlot[] {
  return words.map((w, i) => fixed[i] ?? w)
}

function draftSentence(): Sentence | null {
  const words = withFixes(draft.filter(Boolean))
  return words.length ? { v: 1, words, end: '.', alien: get().alien } : null
}

function setSentence(s: Sentence | null, ended: boolean) {
  set({ sentence: s, ended, code: s ? safePrint(s) : '', codeErrors: [] })
}

function safePrint(s: Sentence): string { try { return print(s) } catch { return '' } }

function apply(out: RecOut[]) {
  for (const o of out) {
    if (o.type === 'word') { draft[o.index] = o.word; if (get().ended) { setSentence(null, false) } }
    else if (o.type === 'sentence') {
      const words = withFixes(o.sentence.words.map((w) => w))
      const s: Sentence = { ...o.sentence, words, alien: get().alien }
      setSentence(s, true)
      draft = []; fixed = {}
      if (s.words.length >= 2) mark('sequence')
      if (s.words.some((w) => w.status === 'maybe')) set({ status: 'Pick the word you meant.' })
      else set({ status: `Koogalien says: ${s.words.map((w) => w.en).join(' ')}${s.end}` })
    }
  }
  const d = draftSentence()
  if (!get().ended || out.some((o) => o.type === 'word')) {
    if (d) setSentence(d, false)
  }
  set({ listening: pending(rec) })
}

function run(i: RecInput) {
  const r = step(rec, i)
  rec = r.state
  apply(r.out)
}

const degreeOfToken = (t: KodeToken): Degree | null => {
  if (t.lane != null) return (Math.min(7, Math.max(0, t.lane)) + 1) as Degree
  if (t.pitch != null) return degreeOf(t.pitch, get().homeC)
  return null
}

export const koogalienActions = {
  /** call once with the host so the store can mark concepts, load settings and keep the outbox */
  init(host: KoogalienHost) {
    hostRef = host
    const s = host.progress.load<Partial<KoogalienSettings>>('koogalien-settings', {})
    const box = host.progress.load<OutboxItem[]>('koogalien-box', [])
    const alien = typeof s.alien === 'string' && alienById(s.alien) ? s.alien : INITIAL.alien
    set({ autoAccept: !!s.autoAccept, alien, chordBuilder: !!s.chordBuilder, outbox: Array.isArray(box) ? box.slice(0, LIMITS.outbox) : [], bpm: Math.round(host.sound.bpm()) || 100 })
    resetRec()
    set({ status: '' })
  },
  clear() {
    handle?.stop(); handle = null
    resetRec(); held = []; builderTokens = []
    set({ sentence: null, ended: false, listening: EMPTY, code: '', codeErrors: [], playingWord: null, lit: [], status: '' })
  },
  setTab(tab: KoogalienState['tab']) { set({ tab }) },
  feedToken(t: KodeToken) {
    if (t.src === 'pedal' || t.src === 'screen') { run({ type: 'token', token: t }); return }
    const d = degreeOfToken(t)
    if (d == null) { if (t.pitch != null) set({ status: 'That is a black key. Koogalien uses the white keys C to C.' }); return }
    const now = t.t
    if (get().chordBuilder && (t.pitch != null || t.lane != null)) {
      builderTokens.push(t)
      if (!held.includes(d)) held = [...held, d].sort() as Degree[]
      set({ lit: held, listening: { ...pending(rec), half: pending(rec).half } })
      return
    }
    const lit = now - litT > 350 ? [d] : Array.from(new Set([...get().lit, d])).sort() as Degree[]
    litT = now
    set({ lit })
    run({ type: 'token', token: t })
  },
  feedMod(sample: ModSample) { run({ type: 'mod', sample }) },
  tick(t: number) {
    run({ type: 'tick', t })
    if (!get().chordBuilder && get().lit.length && t - litT > 450) set({ lit: [] })
  },
  /** chord-builder OK: everything held so far becomes one chord */
  commit() {
    const toks = builderTokens
    if (!toks.length) return
    const t0 = hostRef?.now() ?? performance.now()
    builderTokens = []; held = []
    set({ lit: [] })
    toks.forEach((tk, i) => run({ type: 'token', token: { ...tk, t: t0 + i } }))
    run({ type: 'commit', t: t0 + toks.length + 1 })
    mark('event')
  },
  /** on-screen Space (a word break) or End (finish the sentence) */
  boundary(kind: 'word' | 'end', end: Ending = '.') {
    const t = hostRef?.now() ?? performance.now()
    if (get().chordBuilder && builderTokens.length) this.commit()
    mark('event')
    flushWord(t)
    if (kind === 'word') return
    const words = withFixes(draft.filter(Boolean))
    if (!words.length) return
    const s: Sentence = { v: 1, words, end, alien: get().alien }
    draft = []; fixed = {}
    resetRec()
    setSentence(s, true)
    set({ listening: EMPTY, status: s.words.some((w) => w.status === 'maybe') ? 'Pick the word you meant.' : `Koogalien says: ${s.words.map((w) => w.en).join(' ')}${s.end}` })
    if (words.length >= 2) mark('sequence')
  },
  /** resolve a 'maybe' word: the kid picked the one they meant */
  confirmAlt(wordIndex: number, id: string) {
    const s = get().sentence
    const lex = lexById(id)
    if (!s || !lex || !s.words[wordIndex]) return
    const old = s.words[wordIndex]
    const w: WordSlot = { ...old, kind: 'word', id: lex.id, en: lex.en, status: 'ok', confidence: 1, alts: undefined }
    const words = s.words.map((x, i) => (i === wordIndex ? w : x))
    if (!get().ended) fixed[wordIndex] = w
    setSentence({ ...s, words }, get().ended)
    set({ status: `Got it: ${lex.en}.` })
    mark('debug')
  },
  setAlien(id: string) {
    if (!alienById(id)) return
    const s = get().sentence
    set({ alien: id, sentence: s ? { ...s, alien: id } : s })
    saveSettings()
    if (s && s.words.length) mark('parameter')
  },
  setAutoAccept(on: boolean) { set({ autoAccept: on }); resetRec(); saveSettings() },
  setChordBuilder(on: boolean) { held = []; builderTokens = []; set({ chordBuilder: on, lit: [] }); saveSettings() },
  setWobble(v: number) {
    const value = Math.min(1, Math.max(0, v))
    set({ wobble: value })
    emitMod({ kind: 'slider', value, t: hostRef?.now() ?? performance.now() })
  },
  /** the code box changed: parse it, and if it is good, it becomes the sentence */
  setCode(src: string) {
    const text = src.slice(0, LIMITS.codeChars)
    set({ code: text })
    if (!text.trim()) { set({ sentence: null, ended: false, codeErrors: [] }); return }
    let p
    try { p = parse(text) } catch { set({ codeErrors: [{ message: 'I could not read that.', start: 0, end: 0, line: 1, col: 1 }] }); return }
    set({ codeErrors: p.errors })
    if (p.errors.length) return
    const s = lower(p)
    if (!s.words.length) { set({ sentence: null, ended: false }); return }
    if (/^\s*let\b/m.test(text)) mark('variable')
    set({ sentence: { ...s, alien: get().alien }, ended: true, status: '' })
    draft = []; fixed = {}
    if (s.words.length >= 2) mark('sequence')
  },
  /** Hear it: encode the sentence and play it on the audio clock */
  hear(host: KoogalienHost): PlayHandle | null {
    const s = get().sentence
    if (!s || !s.words.length) return null
    handle?.stop()
    const bpm = Math.round(host.sound.bpm()) || get().bpm
    const score = encode({ ...s, alien: get().alien }, { bpm, homeC: get().homeC, alien: get().alien })
    set({ bpm, playingWord: null, status: 'Listen...' })
    const h = playScore(score, host, { alien: get().alien, onWord: (i) => set({ playingWord: i }) })
    handle = h
    void h.done.then(() => { if (handle === h) { handle = null; set({ playingWord: null, status: 'Did it sound like what you meant?' }) } })
    return h
  },
  stopHearing() { handle?.stop(); handle = null; set({ playingWord: null }) },
  /** a copyable link; nothing is sent anywhere. Also kept in this player's outbox. */
  share(): string | null {
    const s = get().sentence
    if (!s || !s.words.length) return null
    let code: string
    try { code = toShare(s) } catch { set({ status: 'That sentence is too long to share. Try a shorter one.' }); return null }
    const en = s.words.map((w) => w.en).join(' ') + s.end
    const box = [{ code, en, at: hostRef?.now() ?? Date.now() }, ...get().outbox.filter((o) => o.code !== code)].slice(0, LIMITS.outbox)
    set({ outbox: box })
    try { hostRef?.progress.save('koogalien-box', box) } catch { /* ignore */ }
    return code
  },
  /** open a shared message (reading it is parse + play, nothing runs) */
  loadCode(src: string) { this.setCode(src) },
  setStatus(status: string) { set({ status }) },
}

/** a word break is a pedal tap as far as the recognizer is concerned */
function flushWord(t: number) {
  run({ type: 'token', token: { src: 'pedal', value: 0, vel: 1, t } })
}

function saveSettings() {
  const { autoAccept, alien, chordBuilder } = get()
  try { hostRef?.progress.save('koogalien-settings', { autoAccept, alien, chordBuilder } satisfies KoogalienSettings) } catch { /* ignore */ }
}

if (import.meta.hot) {
  import.meta.hot.data.store = useKoogalien
  import.meta.hot.dispose((d: Hot) => { d.store = useKoogalien; d.rec = rec; d.draft = draft; d.fixed = fixed; d.litT = litT; d.held = held; d.builderTokens = builderTokens })
  import.meta.hot.accept()
}
