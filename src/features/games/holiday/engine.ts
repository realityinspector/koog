// Harvest Feast + Light the Tree: one engine for both. State is a zustand store kept on import.meta.hot.data.
// Six rungs: Hunt & Peck, Follow, Echo, Memory (phrase by phrase), Play full (whole song, own pace), Master (whole song, in time).
// Notes arrive from the judge (MIDI keyboard, computer keys, on-screen keys), so real playing and the test harness share one path.
// Hints use the shared keybed guide (music/guide.ts) and the shared sheet music (music/scoreStore.ts).
import { create } from 'zustand'
import { onJudge } from '../../../music/judge'
import { playLocal, unlockAudio } from '../../../music/localNotes'
import { clearGuide, setGuide } from '../../../music/guide'
import { registerPanicTarget } from '../../../music/panic'
import { msPerBeat, noteName } from '../../../music/theory'
import { clearScore, setScore, setScorePos, setSheetOn, useScore } from '../../../music/scoreStore'
import { celebrate } from '../../celebrate/celebrate'
import { songById } from '../phraseKit'
import type { Phrase } from '../../../music/phrases'
import { backingScheduled, chime, startBacking, stopBacking, tickNow } from './backing'
import { LEVELS, MASTER_PASS, NLEV, loadProg, newProg, nextUp, phrasesOf, saveProg, type HolidayGame, type SongProg } from './data'

export interface Result { passed: boolean; stars: number; level: number; acc: number | null; firstTime: boolean; unlockedNext: boolean; retries: number; slips: number; peeks: number; next: string }
export interface HState {
  game: HolidayGame
  phase: 'pick' | 'ladder' | 'intro' | 'count' | 'play' | 'result'
  songId: string | null
  level: number
  phraseCount: number
  phraseIdx: number
  /** index into the current phrase of the NEXT note to play */
  expected: number
  /** phrases nailed in this run */
  got: number[]
  /** the phrase that was just nailed (the scene animates it in) */
  lastGot: number
  /** the current phrase is being sung to you (input is ignored) */
  listening: boolean
  msg: string
  msgKind: 'info' | 'good' | 'oops'
  /** last note feedback: bumps id on every note so the UI can flash */
  fb: { kind: 'good' | 'oops'; id: number }
  peeks: number
  retries: number
  /** wrong notes in a whole-song rung */
  slips: number
  /** goes up every time a phrase is nailed (limited to 3 flashes a second) */
  pulse: number
  /** 3-2-1 before a level (or Master's count-in beats) */
  count: number
  /** whole-song rungs: notes done, hits, wrong notes, total */
  mIdx: number
  mHits: number
  mWrong: number
  mTotal: number
  /** the sheet music is on screen for the current phrase */
  sheetUp: boolean
  prog: SongProg
  result: Result | null
}
const blank = (game: HolidayGame): HState => ({
  game, phase: 'pick', songId: null, level: 1, phraseCount: 0, phraseIdx: 0, expected: 0, got: [], lastGot: -1, listening: false, msg: '', msgKind: 'info', fb: { kind: 'good', id: 0 },
  peeks: 0, retries: 0, slips: 0, pulse: 0, count: 0, mIdx: 0, mHits: 0, mWrong: 0, mTotal: 0, sheetUp: false, prog: newProg(), result: null,
})
let misses = 0
const hot = import.meta.hot?.data as Record<string, unknown> | undefined
export const useHoliday: ReturnType<typeof make> = (hot?.holidayStore as ReturnType<typeof make> | undefined) ?? make()
function make() { return create<HState>()(() => blank('feast')) }
const set = (p: Partial<HState>) => useHoliday.setState(p)
const get = () => useHoliday.getState()

interface MasterNote { note: number; beat: number }
interface Runtime { timers: number[]; phrases: Phrase[]; ignoreUntil: number; master: MasterNote[]; mStart: number; mpb: number; mWin: number; lastFlash: number; loop: number; sounding: number[]; slice: number[] }
const rt: Runtime = (hot?.holidayRt as Runtime | undefined) ?? { timers: [], phrases: [], ignoreUntil: 0, master: [], mStart: 0, mpb: 0, mWin: 0, lastFlash: 0, loop: 0, sounding: [], slice: [] }
rt.sounding ??= []; rt.slice ??= []
const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); rt.timers.push(id); return id }
function clearTimers() { for (const id of rt.timers) window.clearTimeout(id); rt.timers = []; if (rt.loop) { window.clearInterval(rt.loop); rt.loop = 0 } }

/** at most 3 flashes a second: scene sparkles and the feedback chip only change when this says yes */
export function flashOk(): boolean { const n = performance.now(); if (n - rt.lastFlash < 340) return false; rt.lastFlash = n; return true }

const song = () => (get().songId ? songById(get().songId!) : undefined)
const phraseNow = (): Phrase | undefined => rt.phrases[get().phraseIdx]
const lvlOf = () => LEVELS[get().level - 1]
const say = (msg: string, msgKind: HState['msgKind'] = 'info') => set({ msg, msgKind })
const words = (g: HolidayGame) => (g === 'feast' ? ['Yum! A dish lands on the table.', 'Another dish for the feast!', 'The table is filling up!'] : ['An ornament flies onto the tree!', 'Another light glows!', 'The tree is sparkling!'])
const isWhole = () => { const id = lvlOf().id; return id === 'full' || id === 'master' }
function bump(kind: 'good' | 'oops') { if (flashOk()) set({ fb: { kind, id: get().fb.id + 1 } }) }

// ---- shared sheet music + keybed ----
function publish(p: Phrase | undefined) {
  const s = song()
  if (!p || !s) { clearScore('holiday'); set({ sheetUp: false }); return }
  const slice = s.notes.slice(p.start, p.end)
  rt.slice = []; slice.forEach((n, i) => { if (n.note != null) rt.slice.push(i) })
  const sBeat = s.notes.slice(0, p.start).reduce((a, x) => a + x.beats, 0), bpb = s.beatsPerBar ?? 4, p0 = s.pickup ?? 0
  const pickup = sBeat < p0 ? p0 - sBeat : (() => { const o = (((sBeat - p0) % bpb) + bpb) % bpb; return o < 1e-6 ? 0 : bpb - o })()
  setSheetOn(true)
  setScore({ owner: 'holiday', title: s.title, notes: slice, key: s.key, bpm: s.bpm, beatsPerBar: bpb, pickup, beatUnit: s.beatUnit, style: s.style }, rt.slice[0] ?? 0)
  set({ sheetUp: true })
}
const hideSheet = () => { clearScore('holiday'); set({ sheetUp: false }) }
function sheetAt(expected: number, result?: 'hit' | 'miss') {
  if (!get().sheetUp) return
  const pos = rt.slice[expected] ?? (useScore.getState().score?.notes.length ?? 0)
  if (result === 'miss') useScore.setState((st) => ({ results: { ...st.results, [rt.slice[expected]]: 'miss' } }))
  else setScorePos(pos, result)
}
/** the keys that follow the next one, shown dimmer */
const soonOf = (p: Phrase, from: number) => p.notes.slice(from + 1, from + 3).map((n) => n.note)
function hintNext() {
  const lvl = lvlOf(), p = phraseNow()
  if (!lvl.keys || !p) { clearGuide(); return }
  const cur = p.notes[get().expected]; if (!cur) { clearGuide(); return }
  setGuide([cur.note], 'next', soonOf(p, get().expected))
  if (lvl.id === 'follow') {
    const at = get().expected
    later(() => { if (get().phase === 'play' && get().expected === at && !get().listening) clearGuide() }, 1200)
    later(() => { if (get().phase === 'play' && get().expected === at && !get().listening) hintNext() }, 5000)
  }
}

// ---- navigation ----
export function openGame(game: HolidayGame) { leave(); useHoliday.setState(blank(game)) }
export function pickSong(songId: string) { leave(); set({ phase: 'ladder', songId, prog: loadProg(songId), result: null, msg: '', got: [] }) }
export function backToSongs() { leave(); set({ phase: 'pick', songId: null, result: null, msg: '', got: [] }) }
export function backToLadder() { leave(); set({ phase: 'ladder', prog: get().songId ? loadProg(get().songId!) : newProg(), result: null, msg: '', got: [], listening: false }) }
/** stop everything the game is doing (timers, lit keys, sheet, backing, held notes) */
export function leave() { clearTimers(); stopBacking(); clearGuide(); hideSheet(); rt.ignoreUntil = 0; releaseDemo() }
let demoNotes: number[] = []
function releaseDemo() { for (const n of demoNotes) { try { playLocal(n, 0, false) } catch { /* ignore */ } } demoNotes = [] }

/** open a rung: shows the goal and a big Start button. Nothing plays until Start. */
export function startLevel(n: number) {
  const id = get().songId
  if (!id) return
  const prog = loadProg(id)
  if (n < 1 || n > prog.unlocked) return
  leave()
  rt.phrases = phrasesOf(id)
  const s = song()
  rt.sounding = []; s?.notes.forEach((x, i) => { if (x.note != null) rt.sounding.push(i) })
  const whole = LEVELS[n - 1].id === 'full' || LEVELS[n - 1].id === 'master'
  const resume = !prog.done[n - 1] && !whole ? (prog.nailed[String(n)] ?? []).filter((i) => i < rt.phrases.length) : []
  set({ phase: 'intro', level: n, prog, result: null, phraseCount: rt.phrases.length, got: resume, lastGot: -1, peeks: 0, retries: 0, slips: 0, expected: 0, listening: false, msg: '', msgKind: 'info', mIdx: 0, mHits: 0, mWrong: 0, mTotal: rt.sounding.length, count: 0, phraseIdx: 0 })
}
/** the Start button: 3-2-1, then play */
export function begin() {
  const st = get()
  if (st.phase !== 'intro') return
  void unlockAudio()
  const lvl = lvlOf()
  if (lvl.id === 'master') { set({ phase: 'play', msg: 'Count in... then play the whole song.', msgKind: 'info' }); beginMaster(); return }
  set({ phase: 'count', count: 3 })
  tickNow(true)
  later(() => { set({ count: 2 }); tickNow() }, 800)
  later(() => { set({ count: 1 }); tickNow() }, 1600)
  later(() => { set({ phase: 'play', count: 0 }); enterPlay() }, 2400)
}
function enterPlay() {
  const lvl = lvlOf()
  if (lvl.id === 'full') { beginFull(); return }
  beginPhrase(firstOpen())
}
const firstOpen = () => { const g = get().got; const i = rt.phrases.findIndex((_, k) => !g.includes(k)); return i < 0 ? 0 : i }

// ---- phrase rungs ----
function hearPhrase(p: Phrase, then?: () => void, withGuide = true) {
  const s = song(); if (!s) return
  const mpb = msPerBeat(s.bpm * 0.72)
  releaseDemo(); clearGuide()
  set({ listening: true })
  rt.ignoreUntil = Number.MAX_SAFE_INTEGER
  p.notes.forEach((n) => {
    later(() => { playLocal(n.note, 84, true); demoNotes.push(n.note); if (withGuide) setGuide([n.note], 'gold') }, n.beat * mpb)
    later(() => { playLocal(n.note, 0, false); demoNotes = demoNotes.filter((x) => x !== n.note) }, (n.beat + Math.min(n.beats, 1.2) * 0.85) * mpb)
  })
  const last = p.notes[p.notes.length - 1]
  later(() => { clearGuide(); set({ listening: false }); rt.ignoreUntil = performance.now() + 120; then?.() }, (last.beat + Math.min(last.beats, 1.2)) * mpb + 120)
}
function beginPhrase(idx: number) {
  clearTimers(); clearGuide(); misses = 0
  const lvl = lvlOf()
  set({ phraseIdx: idx, expected: 0, listening: false })
  const p = rt.phrases[idx]; if (!p) return
  if (lvl.sheet) publish(p); else hideSheet()
  if (lvl.id === 'hunt' || lvl.id === 'follow') { say(lvl.coach); hintNext() }
  else if (lvl.id === 'echo') { say('Listen...'); hearPhrase(p, () => say('Your turn! Play it back. 🔁 plays it again, free.')) }
  else say(lvl.coach)
}
/** 🔁 Hear it again. Free in Hunt, Follow and Echo; it costs a star in Memory and Play full. */
export function hear() {
  const st = get(), lvl = lvlOf()
  if (st.phase !== 'play' || st.listening || lvl.id === 'master') return
  const p = lvl.id === 'full' ? fullPhrase() : phraseNow(); if (!p) return
  clearTimers()
  const costs = lvl.id === 'memory' || lvl.id === 'full'
  if (costs) set({ peeks: st.peeks + 1 })
  if (lvl.id !== 'full') set({ expected: 0 })
  say(costs ? 'Listen... (that cost a star)' : 'Listen...', costs ? 'oops' : 'info')
  const back = () => { say(lvl.id === 'echo' ? 'Your turn! Play it back.' : lvl.coach); if (lvl.id === 'full') say('Keep going from where you were.'); if (lvl.id !== 'full') hintNext() }
  hearPhrase(p, back)
}
/** 👀 Peek: show the notes of this phrase for a few seconds. Costs a star (Memory and Play full). */
export function peek() {
  const st = get(), lvl = lvlOf()
  if (st.phase !== 'play' || st.listening || (lvl.id !== 'memory' && lvl.id !== 'full')) return
  const p = lvl.id === 'full' ? fullPhrase() : phraseNow(); if (!p) return
  set({ peeks: st.peeks + 1 })
  say('Peek! That cost a star.', 'oops')
  publish(p)
  const k = lvl.id === 'full' ? st.mIdx - sIndexOf(p) : st.expected
  sheetAt(Math.max(0, k))
  const cur = lvl.id === 'full' ? rt.sounding[st.mIdx] : undefined
  void cur
  later(() => { if (get().phase === 'play') { hideSheet(); say(lvl.coach) } }, 4500)
}
/** index (in the sounding-note list) of the first note of a phrase */
const sIndexOf = (p: Phrase) => rt.sounding.findIndex((i) => i >= p.start)
const fullPhrase = (): Phrase | undefined => { const at = rt.sounding[get().mIdx] ?? rt.sounding[rt.sounding.length - 1]; return rt.phrases.find((p) => at >= p.start && at < p.end) }

function completePhrase(clean: boolean) {
  const st = get()
  clearGuide()
  if (!clean) {
    set({ retries: st.retries + 1 })
    say('So close! Same phrase again, cleanly.', 'oops')
    later(() => beginPhrase(st.phraseIdx), 1000)
    return
  }
  nailed(st.phraseIdx)
  const prog = loadProg(st.songId!)
  if (!prog.done[st.level - 1]) { prog.nailed[String(st.level)] = get().got; saveProg(st.songId!, prog) }
  if (get().got.length >= rt.phrases.length) later(finishLevel, 1100)
  else later(() => { const nx = rt.phrases.findIndex((_, k) => !get().got.includes(k) && k > st.phraseIdx); beginPhrase(nx >= 0 ? nx : firstOpen()) }, 1000)
}
/** the "phrase complete" moment: scene item flies in, a chime plays, the message cheers */
function nailed(idx: number) {
  const st = get(), w = words(st.game)
  const got = st.got.includes(idx) ? st.got : [...st.got, idx]
  set({ got, lastGot: idx, pulse: st.pulse + (flashOk() ? 1 : 0), expected: rt.phrases[idx]?.notes.length ?? 0 })
  say(w[got.length % w.length], 'good')
  chime()
}

function wrongText(played: number, want: number) {
  return `That was ${noteName(played).replace(/\d/, '')}. Look for ${noteName(want).replace(/\d/, '')}.`
}
function feedbackGood(note: number, resume: () => void) {
  bump('good'); setGuide([note], 'good'); later(resume, 200)
}
function feedbackWrong(played: number, want: number, showRight: boolean) {
  bump('oops')
  setGuide([played], 'danger', showRight ? [want] : [])
  later(() => { if (get().phase === 'play' && !get().listening) { if (isWhole() || !lvlOf().keys) clearGuide(); else hintNext() } }, 800)
}

export function handleNote(note: number, now = performance.now()) {
  const st = get()
  if (st.phase !== 'play' || now < rt.ignoreUntil) return
  const lvl = lvlOf()
  if (lvl.id === 'master') return masterNote(note, now)
  if (lvl.id === 'full') return fullNote(note)
  const p = phraseNow(); if (!p || st.listening) return
  const want = p.notes[st.expected]?.note
  if (want == null) return
  if (note === want) {
    const e = st.expected + 1
    set({ expected: e })
    sheetAt(e, 'hit')
    if (e >= p.notes.length) { bump('good'); clearGuide(); setGuide([note], 'good'); later(clearGuide, 220); completePhrase(lvl.id === 'hunt' ? true : misses === 0); misses = 0 }
    else feedbackGood(note, () => { if (lvl.keys) hintNext(); else clearGuide() })
    return
  }
  if (lvl.id === 'hunt') { say(wrongText(note, want) + ' No rush.', 'info'); feedbackWrong(note, want, true); return }
  if (lvl.id === 'follow') { misses++; say(wrongText(note, want), 'oops'); feedbackWrong(note, want, true); sheetAt(st.expected, 'miss'); return }
  if (lvl.id === 'echo') {
    set({ retries: st.retries + 1 }); misses = 0
    say('Not quite. Listen once more...', 'oops'); feedbackWrong(note, want, false); sheetAt(st.expected, 'miss')
    clearTimers(); later(() => beginPhrase(st.phraseIdx), 900)
    return
  }
  // memory: back to the start of the phrase, and the wrong key shows red (the right one stays a secret)
  misses = 0
  set({ retries: st.retries + 1, expected: 0 })
  say(st.retries >= 2 ? 'Not quite. Stuck? A peek or 🔁 costs a star.' : 'Not quite. Start the phrase again.', 'oops')
  feedbackWrong(note, want, false)
}

// ---- Play full: the whole song, own pace, only right notes in order. A wrong note is a slip; the song waits. ----
function beginFull() {
  clearTimers(); clearGuide(); hideSheet()
  set({ mIdx: 0, mHits: 0, mWrong: 0, slips: 0, got: [], expected: 0, msg: 'Go! Play the whole song from the start.', msgKind: 'info', phraseIdx: 0 })
}
function fullNote(note: number) {
  const st = get(), s = song(); if (!s) return
  const want = s.notes[rt.sounding[st.mIdx]]?.note
  if (want == null) return
  if (note !== want) {
    set({ slips: st.slips + 1, mWrong: st.mWrong + 1 })
    say(`A slip! The song waits for you. ${st.slips >= 2 ? 'Stuck? 👀 Peek costs a star.' : ''}`, 'oops')
    feedbackWrong(note, want, false)
    return
  }
  const i = st.mIdx + 1
  set({ mIdx: i, mHits: st.mHits + 1 })
  bump('good'); setGuide([note], 'good'); later(clearGuide, 200)
  // a phrase is complete when its last sounding note is played
  const pi = rt.phrases.findIndex((p) => p.end > rt.sounding[i - 1] && p.start <= rt.sounding[i - 1])
  const ph = rt.phrases[pi]
  if (ph && (i >= rt.sounding.length || rt.sounding[i] >= ph.end)) { nailed(pi); set({ expected: 0 }) }
  if (i >= rt.sounding.length) {
    const stars = Math.max(1, 3 - get().peeks - (get().slips > rt.sounding.length * 0.15 ? 1 : 0))
    later(() => finishLevel(true, null, stars), 1200)
  }
}

function stars(): number {
  const st = get(), lvl = lvlOf()
  if (lvl.id === 'hunt') return 3
  if (lvl.id === 'memory') return Math.max(1, 3 - st.peeks)
  return st.retries === 0 ? 3 : st.retries <= Math.ceil(st.phraseCount / 2) ? 2 : 1
}
function finishLevel(passed = true, acc: number | null = null, starsOverride?: number) {
  const st = get(), id = st.songId!
  clearTimers(); stopBacking(); clearGuide(); hideSheet()
  const prog = loadProg(id), n = st.level
  const sc = starsOverride ?? stars()
  const firstTime = passed && !prog.done[n - 1]
  let unlockedNext = false
  if (passed) {
    prog.done[n - 1] = true; prog.stars[n - 1] = Math.max(prog.stars[n - 1], sc); delete prog.nailed[String(n)]
    if (n < NLEV && prog.unlocked < n + 1) { prog.unlocked = n + 1; unlockedNext = true }
  }
  if (n === NLEV && acc != null) prog.master = Math.max(prog.master, Math.round(acc * 100))
  saveProg(id, prog)
  const nu = nextUp(prog)
  set({ phase: 'result', prog, got: isWhole() ? rt.phrases.map((_, i) => i) : st.got, result: { passed, stars: sc, level: n, acc, firstTime, unlockedNext, retries: st.retries, slips: st.slips, peeks: st.peeks, next: nu } })
  if (firstTime) {
    const s = song(), l = LEVELS[n - 1]
    if (l.id === 'full') celebrate({ title: `You know ${s?.title ?? 'it'} by heart!${st.game === 'tree' ? ' The star goes on the tree.' : ' The turkey is served.'}`, emoji: st.game === 'tree' ? '⭐' : '🦃', kind: 'gold' })
    else if (l.id === 'master') celebrate({ title: `Master of ${s?.title ?? 'the song'}, in time!`, emoji: '👑', kind: 'gold' })
    else celebrate({ title: `${l.name} complete! Next up: ${LEVELS[n].name}`, emoji: l.icon, kind: 'badge' })
  }
}

// ---- Master: the whole song, in time, with a gentle backing ----
function beginMaster() {
  const s = song(); if (!s) return
  clearTimers(); hideSheet()
  const bpm = Math.round(s.bpm * 0.8)
  rt.mpb = msPerBeat(bpm)
  rt.mWin = Math.min(450, Math.max(240, rt.mpb * 0.45))
  let t = 0
  const list: MasterNote[] = []
  for (const n of s.notes) { if (n.note != null) list.push({ note: n.note, beat: t }); t += n.beats }
  rt.master = list
  const countIn = 3
  rt.mStart = performance.now() + countIn * rt.mpb + 400
  set({ mIdx: 0, mHits: 0, mWrong: 0, mTotal: list.length, count: countIn, expected: 0, listening: false, got: [] })
  const total = s.notes.reduce((a, n) => a + n.beats, 0)
  startBacking({ beat0Ms: rt.mStart, mpb: rt.mpb, beatsPerBar: s.beatsPerBar ?? 4, root: s.key.tonic, totalBeats: total + 1, countIn })
  rt.loop = window.setInterval(masterTick, 30)
}
function masterTick() {
  const st = get(); if (st.phase !== 'play' || lvlOf().id !== 'master') return
  const now = performance.now()
  const beatsLeft = Math.ceil((rt.mStart - now) / rt.mpb)
  if (now < rt.mStart) { if (beatsLeft !== st.count) set({ count: Math.max(0, Math.min(3, beatsLeft)) }); return }
  if (st.count !== 0) set({ count: 0, msg: 'Go!' })
  let idx = st.mIdx
  while (idx < rt.master.length && now > rt.mStart + rt.master[idx].beat * rt.mpb + rt.mWin) idx++
  if (idx !== st.mIdx) { set({ mIdx: idx }); syncPhraseBar(idx) }
  if (idx >= rt.master.length) {
    const acc = st.mHits / Math.max(1, st.mTotal)
    const passed = acc >= MASTER_PASS
    finishLevel(passed, acc, !passed ? 0 : acc >= 0.95 ? 3 : acc >= 0.88 ? 2 : 1)
  }
}
/** whole-song rungs: fill the phrase bar as the song moves on */
function syncPhraseBar(idx: number) {
  const got = rt.phrases.map((p, k) => (idx >= rt.sounding.length || rt.sounding[idx] >= p.end ? k : -1)).filter((k) => k >= 0)
  if (got.length !== get().got.length) set({ got, lastGot: got[got.length - 1] ?? -1 })
}
function masterNote(note: number, now: number) {
  const st = get()
  if (now < rt.mStart - rt.mWin) return // count-in: free noodling is fine
  const i = st.mIdx
  const m = rt.master[i]; if (!m) return
  const at = rt.mStart + m.beat * rt.mpb
  if (note === m.note) {
    if (now >= at - rt.mWin && now <= at + rt.mWin) {
      set({ mIdx: i + 1, mHits: st.mHits + 1, msg: '' })
      bump('good'); setGuide([note], 'good'); later(clearGuide, 200)
      syncPhraseBar(i + 1)
    }
    return // too early: just ignore, play it on the beat
  }
  set({ mWrong: st.mWrong + 1 })
  feedbackWrong(note, m.note, false)
}

// ---- judge wiring (one listener for the whole session) ----
;(hot?.holidayOff as (() => void) | undefined)?.()
const off = onJudge((e) => { if (e.type === 'note' && !e.g.chordMember) handleNote(e.g.note) })

/** for tests and the dev console */
export const debug = {
  phrase: () => phraseNow()?.notes.map((n) => n.note) ?? [],
  phrases: () => rt.phrases.map((p) => p.notes.map((n) => n.note)),
  whole: () => rt.sounding.map((i) => song()!.notes[i].note as number),
  master: () => rt.master.map((m) => ({ ...m, at: rt.mStart + m.beat * rt.mpb })),
  masterWindow: () => rt.mWin,
  backing: backingScheduled,
  timers: () => rt.timers.length,
}

registerPanicTarget('holiday-game', () => { leave() })
if (import.meta.hot) {
  import.meta.hot.data.holidayStore = useHoliday
  import.meta.hot.data.holidayRt = rt
  import.meta.hot.data.holidayOff = () => { off(); leave() }
  import.meta.hot.accept()
}
if (import.meta.env.DEV) (window as unknown as { __holiday: unknown }).__holiday = { useHoliday, openGame, pickSong, startLevel, begin, handleNote, peek, hear, leave, debug }
