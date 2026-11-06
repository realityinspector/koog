// Phrase Match engine: a plain zustand store. Cards, flips, the claim-by-playing step and saved bests.
// Long-lived state sits on import.meta.hot.data so an edit never resets a game in progress.
import { create } from 'zustand'
import { onNote } from '../../../music/notes'
import { demo, stopAll } from '../../../music/phraseEngine'
import { clearGuideFor, setGuideFor, type GuideTone } from '../../../music/guide'
// the key glow is OWNED: a late timer from this game can never wipe a newer feature's glow (docs/STATE.md)
const setGuide = (t: number[], tone?: GuideTone, soon?: number[]) => setGuideFor('memory', t, tone, soon)
const clearGuide = () => clearGuideFor('memory')
import { onProfileChange, pload, psave } from '../../../profile/profile'
import { kload, ksave, markConcept } from '../gamekode/kodeStore'
import { exprNotes, makeExpr, noteOk, varName, type KVar } from '../gamekode/kodeLogic'
import { bestKey, fmtTime, isBetter, levelDef, pickPhrases, shuffle, starsFor, type Best, type Level, type MemSave, type Phr } from './data'

export interface Card { id: number; pair: number; up: boolean; done: boolean }
export type Stage = 'idle' | 'hear' | 'claim' | 'back'
export interface MState {
  phase: 'menu' | 'play' | 'done'
  level: Level; ear: boolean
  cards: Card[]; phrases: Phr[]
  picks: number[]; stage: Stage
  flips: number; misses: number; matched: number
  startedAt: number; endedAt: number
  progress: number
  msg: string
  stars: number; newBest: boolean
  save: MemSave
  /** Kode cards (opt-in): each won pair becomes a named variable; a bonus round plays an expression of them */
  kode: boolean; vars: KVar[]
  bonus: { state: 'off' | 'play' | 'won'; expr: string[]; want: number[]; progress: number; misses: number }
  kodeWins: number
}
const noBonus = (): MState['bonus'] => ({ state: 'off', expr: [], want: [], progress: 0, misses: 0 })
const kodeSave = () => kload<{ on?: boolean; wins?: number }>('memory', {})
const emptySave = (): MemSave => ({ best: {}, plays: 0 })
const loadSave = (): MemSave => { const s = pload<MemSave>('memory', emptySave()) ?? emptySave(); return { best: s.best ?? {}, plays: s.plays ?? 0 } }

const initial = (): MState => ({
  phase: 'menu', level: 'easy', ear: false, cards: [], phrases: [], picks: [], stage: 'idle',
  flips: 0, misses: 0, matched: 0, startedAt: 0, endedAt: 0, progress: 0, msg: '', stars: 0, newBest: false, save: loadSave(),
  kode: !!kodeSave().on, vars: [], bonus: noBonus(), kodeWins: kodeSave().wins ?? 0,
})
export const useMemory: ReturnType<typeof make> = (import.meta.hot?.data.memStore as ReturnType<typeof make> | undefined) ?? make()
function make() { return create<MState>()(() => initial()) }
const get = () => useMemory.getState()
const set = (p: Partial<MState>) => useMemory.setState(p)

interface Run { token: number; timers: ReturnType<typeof setTimeout>[]; off: (() => void) | null }
const run: Run = (import.meta.hot?.data.memRun as Run | undefined) ?? { token: 0, timers: [], off: null }
const later = (fn: () => void, ms: number) => { run.timers.push(setTimeout(fn, ms)) }
function clearTimers() { for (const t of run.timers) clearTimeout(t); run.timers = [] }

export const loadBests = () => set({ save: loadSave() })

function hintFor(progress: number) {
  const { level, phrases, cards, picks } = get()
  const ph = phrases[cards[picks[0]]?.pair]
  if (!ph) return
  const h = levelDef(level).hint
  if (h === 'all') setGuide(ph.notes.slice(progress).map((n) => n.note), 'next')
  else if (h === 'first' && progress === 0) setGuide([ph.notes[0].note], 'next')
  else clearGuide()
}

function flipBack() {
  const { cards, picks } = get()
  set({ cards: cards.map((c, i) => (picks.includes(i) ? { ...c, up: false } : c)), picks: [], stage: 'idle', progress: 0 })
}

function claim() {
  const s = get()
  const cards = s.cards.map((c, i) => (s.picks.includes(i) ? { ...c, done: true } : c))
  const matched = s.matched + 1
  clearGuide()
  let vars = s.vars
  if (s.kode) {
    const ph = s.phrases[s.cards[s.picks[0]].pair]
    vars = [...s.vars, { name: varName(s.vars.length), notes: ph.notes.map((n) => n.note) }]
    markConcept('memory', 'variable')
  }
  if (matched < s.phrases.length) { set({ cards, matched, vars, picks: [], stage: 'idle', progress: 0, msg: s.kode ? `Pair won! It is now ${vars[vars.length - 1].name}. Flip two more cards.` : 'Pair won! Flip two more cards.' }); return }
  set({ vars })
  finish(cards, matched)
}

function finish(cards: Card[], matched: number) {
  const s = get()
  const endedAt = Date.now()
  const ms = endedAt - s.startedAt
  const stars = starsFor(s.flips, s.phrases.length)
  const res: Best = { flips: s.flips, ms, stars }
  const save = loadSave()
  const k = bestKey(s.level, s.ear)
  const newBest = isBetter(res, save.best[k])
  if (newBest) save.best[k] = res
  else if ((save.best[k]?.stars ?? 0) < stars) save.best[k] = { ...save.best[k], stars }
  save.plays += 1
  psave('memory', save)
  set({ cards, matched, picks: [], stage: 'idle', phase: 'done', endedAt, stars, newBest, save, msg: `All pairs! ${s.flips} flips in ${fmtTime(ms)}.` })
}

function bonusKey(e: { note: number }) {
  const s = get()
  const b = s.bonus
  const want = b.want[b.progress]
  if (noteOk(want, e.note, s.level === 'easy')) {
    const progress = b.progress + 1
    if (progress >= b.want.length) {
      const wins = s.kodeWins + 1
      ksave('memory', { on: true, wins })
      markConcept('memory', 'sequence')
      set({ kodeWins: wins, bonus: { ...b, progress, state: 'won' }, msg: `You ran ${b.expr.join(' ')}! An expression is variables in order.` })
    } else set({ bonus: { ...b, progress } })
  } else set({ bonus: { ...b, progress: 0, misses: b.misses + 1 }, msg: 'Not quite. Start the expression again.' })
}

/** Kode cards bonus round: play an expression made from the variables, like b a b */
export function startBonus() {
  const s = get()
  if (!s.kode || s.vars.length < 2) return
  const expr = makeExpr(s.vars)
  const want = exprNotes(s.vars, expr)
  attach()
  set({ bonus: { state: 'play', expr, want, progress: 0, misses: 0 }, msg: `Bonus: play ${expr.join(' ')} on the keys.` })
}
export function setKode(on: boolean) { ksave('memory', { on, wins: get().kodeWins }); set({ kode: on }) }

function onKey(e: { note: number; on: boolean; velocity: number }) {
  const s = get()
  if (s.phase === 'done' && s.bonus.state === 'play' && e.on && e.velocity > 0) { bonusKey(e); return }
  if (s.phase !== 'play' || s.stage !== 'claim' || !e.on || e.velocity <= 0) return
  const ph = s.phrases[s.cards[s.picks[0]]?.pair]
  if (!ph) return
  const want = ph.notes[s.progress].note
  const ok = s.level === 'easy' ? e.note % 12 === want % 12 : e.note === want
  if (ok) {
    const progress = s.progress + 1
    if (progress >= ph.notes.length) { set({ progress }); claim() }
    else { set({ progress }); hintFor(progress) }
    return
  }
  clearGuide()
  set({ misses: s.misses + 1, stage: 'back', msg: 'Not quite. The cards flip back, listen again.' })
  const tk = run.token
  later(() => { if (tk === run.token) { flipBack(); set({ msg: 'Flip two cards.' }) } }, 900)
}

function attach() { run.off?.(); run.off = onNote(onKey) }

export function start(level: Level, ear: boolean) {
  stop()
  const def = levelDef(level)
  const phrases = pickPhrases(level)
  const pairs = phrases.length
  const cards: Card[] = shuffle(Array.from({ length: pairs * 2 }, (_, i) => ({ id: i, pair: i % pairs, up: false, done: false }))).map((c, i) => ({ ...c, id: i }))
  attach()
  void def
  set({ phase: 'play', level, ear, cards, phrases, picks: [], stage: 'idle', flips: 0, misses: 0, matched: 0, startedAt: 0, endedAt: 0, progress: 0, stars: 0, newBest: false, msg: 'Flip a card to hear its tune.', save: loadSave(), vars: [], bonus: noBonus() })
}

export function flip(i: number) {
  const s = get()
  if (s.phase !== 'play') return
  const c = s.cards[i]
  if (!c || c.up || c.done) return
  const okStage = (s.stage === 'idle' && s.picks.length <= 1) || (s.stage === 'hear' && s.picks.length === 1)
  if (!okStage) return
  const token = ++run.token
  const picks = [...s.picks, i]
  const first = s.startedAt === 0
  set({ cards: s.cards.map((x, j) => (j === i ? { ...x, up: true } : x)), picks, stage: 'hear', flips: s.flips + 1, startedAt: first ? Date.now() : s.startedAt, msg: picks.length === 1 ? 'Listen... now find its twin.' : 'Listen...' })
  void demo(s.phrases[c.pair], s.phrases[c.pair].bpm).then(() => {
    if (token !== run.token || get().phase !== 'play') return
    const n = get()
    if (n.picks.length < 2) { set({ stage: 'idle', msg: 'Flip a second card.' }); return }
    const [a, b] = n.picks
    if (n.cards[a].pair === n.cards[b].pair) {
      set({ stage: 'claim', progress: 0, msg: 'A match! Play the tune back on the keys to win the pair.' })
      hintFor(0)
    } else {
      set({ stage: 'back', msg: 'Different tunes. Flipping back.' })
      later(() => { if (token === run.token) { flipBack(); set({ msg: 'Flip two cards.' }) } }, 700)
    }
  })
}

/** hear the matched tune again while claiming (free, not counted) */
export function replay() {
  const s = get()
  if (s.stage !== 'claim') return
  const ph = s.phrases[s.cards[s.picks[0]].pair]
  const token = ++run.token
  void demo(ph, ph.bpm).then(() => { if (token === run.token && get().stage === 'claim') hintFor(get().progress) })
}

export function stop() { run.token++; clearTimers(); run.off?.(); run.off = null; try { stopAll() } catch { /* ignore */ } clearGuide() }
export function toMenu() { stop(); set({ ...initial(), phase: 'menu', kode: get().kode, kodeWins: get().kodeWins }) }
export function retry() { const s = get(); start(s.level, s.ear) }

// A different kid signed in: their best scores and Kode power replace the last kid's (the stale copy used to be shown, and setKode wrote the old win count under the new kid).
const offProfile = onProfileChange(() => { stop(); set({ ...initial(), phase: 'menu' }) }, 'memory')

if (import.meta.hot) {
  import.meta.hot.dispose(offProfile)
  import.meta.hot.data.memStore = useMemory
  import.meta.hot.data.memRun = run
  import.meta.hot.dispose(() => { clearTimers(); run.off?.(); run.off = null })
  import.meta.hot.accept()
}
