// Challenge engine + definitions. Pure (no React, no global state).
// To add a challenge: write a `create(level, ctx)` returning an Engine and add it to CHALLENGES.
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALES, inKey, noteName, pc, type Key } from '../../music/theory'

export interface NoteEv { note: number; velocity: number; on: boolean }

export interface View {
  status: string
  sub?: string
  progress: number // 0..1
  targets: number[] // pitch classes to highlight (any octave)
  targetMidi: number[] // exact notes to highlight strongly
  base: number[] // reference notes (shown differently)
  held: number[]
  timeLeft?: number // seconds
  stats: [string, string][]
}
export interface Finish { score: number; max?: number; unit: string; headline: string; detail: string; perfect?: boolean }
export interface Engine {
  keyToSet?: Key
  note(e: NoteEv, t: number): void
  tick(t: number): void
  view(t: number): View
  done: Finish | null
  beepChord?: number[] // optional: several notes at once
  beep: number | null // set by engine when it wants a sound played (store consumes it)
}
export interface Ctx { key: Key }
export interface ChallengeDef {
  id: string; emoji: string; title: string; desc: string
  difficulty: 1 | 2 | 3
  levels: string[]
  badge: string
  create(level: number, ctx: Ctx): Engine
}

const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const pcName = (p: number) => PC_NAMES[pc(p)]
const emptyView = (): View => ({ status: '', progress: 0, targets: [], targetMidi: [], base: [], held: [], stats: [] })

function track(held: Set<number>, e: NoteEv) { if (e.on) held.add(e.note); else held.delete(e.note) }

// ---------- 1. Scale Climber ----------
const CLIMB_KEYS: Key[] = [
  { tonic: 0, scale: 'major' }, { tonic: 7, scale: 'major' }, { tonic: 5, scale: 'major' }, { tonic: 9, scale: 'minor' },
]
function scaleClimber(li: number): Engine {
  const K = CLIMB_KEYS[li]
  const pcs = SCALES[K.scale].map((i) => (K.tonic + i) % 12)
  const seq = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0].map((i) => pcs[i % 7])
  let pos = 0, misses = 0, msg = 'Start on the glowing note.'
  const held = new Set<number>()
  const e: Engine = {
    keyToSet: K, done: null, beep: null,
    note(ev) {
      track(held, ev)
      if (!ev.on || e.done) return
      if (pc(ev.note) === seq[pos]) {
        pos++
        msg = pos === 8 ? 'Top! Now come back down.' : pos < seq.length ? 'Nice. Keep going.' : ''
        if (pos >= seq.length) {
          const score = Math.max(40, 100 - misses * 6)
          e.done = { score, max: 100, unit: 'pts', perfect: misses === 0,
            headline: misses === 0 ? 'Clean climb, up and down.' : 'You made it up and back.',
            detail: misses === 0 ? 'Zero wrong notes.' : `${misses} detour${misses > 1 ? 's' : ''}. The scale is learned by repeating it.` }
        }
      } else { misses++; msg = `Not quite. Look for ${pcName(seq[pos])}.` }
    },
    tick() {},
    view() {
      const target = seq[pos]
      return { ...emptyView(), status: e.done ? 'Done' : `Play ${pcName(target)}`, sub: msg, progress: pos / seq.length,
        targets: e.done ? [] : [target], held: [...held],
        stats: [['Step', `${pos}/${seq.length}`], ['Detours', String(misses)]] }
    },
  }
  return e
}

// ---------- 2. Stay in Key ----------
const STAY_KEYS: (Key | null)[] = [
  { tonic: 0, scale: 'major' }, { tonic: 7, scale: 'major' }, { tonic: 9, scale: 'minor' }, null,
]
function stayInKey(li: number, ctx: Ctx): Engine {
  const K = STAY_KEYS[li] ?? { tonic: Math.floor(Math.random() * 12), scale: rnd<'major' | 'minor'>(['major', 'minor']) }
  const total = 30
  let n = 0, spicy = 0, msg = 'Play anything you like, just stay in the key.'
  const held = new Set<number>()
  const inK = [...Array(12).keys()].filter((p) => inKey(p, K))
  const e: Engine = {
    keyToSet: K, done: null, beep: null,
    note(ev) {
      track(held, ev)
      if (!ev.on || e.done) return
      n++
      if (inKey(ev.note, K)) msg = 'Smooth.'
      else { spicy++; msg = `${noteName(ev.note)} is spicy. Fun, but not in the key.` }
      if (n >= total) {
        const score = total - spicy
        e.done = { score, max: total, unit: `/ ${total} in key`, perfect: spicy === 0,
          headline: spicy === 0 ? 'Thirty for thirty.' : 'Thirty notes played.',
          detail: spicy === 0 ? 'Not one spicy note.' : `${spicy} spicy note${spicy > 1 ? 's' : ''}. Jazz people call those "expression".` }
      }
    },
    tick() {},
    view() {
      void ctx
      return { ...emptyView(), status: `Stay in ${PC_NAMES[K.tonic]} ${K.scale}`, sub: msg, progress: n / total,
        targets: inK, held: [...held], stats: [['Notes', `${n}/${total}`], ['Spicy', String(spicy)]] }
    },
  }
  return e
}

// ---------- 3. Echo Me ----------
function echoMe(li: number): Engine {
  const pool = li === 0 ? [60, 62, 64, 67, 69, 72] : [60, 62, 64, 65, 67, 69, 71, 72]
  const maxRounds = 10
  const melody: number[] = []
  let round = 0, lives = 3, pos = 0, phase: 'demo' | 'play' = 'demo', demoAt = 0, demoIdx = -1, started = false
  let msg = 'Watch the keys, then play it back.'
  const held = new Set<number>()
  const STEP = 700
  const nextRound = () => { round++; melody.push(rnd(pool)); pos = 0; phase = 'demo'; started = false; demoIdx = -1 }
  nextRound()
  const e: Engine = {
    keyToSet: { tonic: 0, scale: li === 0 ? 'majorPentatonic' : 'major' }, done: null, beep: null,
    note(ev, t) {
      track(held, ev)
      if (!ev.on || e.done || phase !== 'play') return
      if (pc(ev.note) === pc(melody[pos])) {
        pos++
        if (pos >= melody.length) {
          if (round >= maxRounds) {
            e.done = { score: round, max: maxRounds, unit: 'rounds', perfect: lives === 3, headline: 'Ten rounds. Elephant memory.', detail: `${lives} lives left.` }
          } else { msg = 'Got it. One more note this time.'; nextRound(); demoAt = t + 600 }
        }
      } else {
        lives--; pos = 0
        if (lives <= 0) {
          const done = round - 1
          e.done = { score: done, max: maxRounds, unit: 'rounds', headline: done >= 6 ? 'Great ears.' : 'Your memory is a muscle. You just trained it.', detail: `You echoed ${done} round${done === 1 ? '' : 's'}.` }
        } else { msg = `Close. Listen once more. ${lives} ${lives === 1 ? 'life' : 'lives'} left.`; phase = 'demo'; started = false; demoIdx = -1; demoAt = t + 800 }
      }
    },
    tick(t) {
      if (e.done || phase !== 'demo') return
      if (!started) { if (demoAt === 0 || t >= demoAt) { started = true; demoAt = t } else return }
      const idx = Math.floor((t - demoAt) / STEP)
      if (idx !== demoIdx && idx < melody.length) { demoIdx = idx; e.beep = melody[idx] }
      if (idx >= melody.length) { phase = 'play'; pos = 0; msg = 'Your turn.' }
    },
    view(t) {
      const showing = phase === 'demo' && started ? Math.floor((t - demoAt) / STEP) : -1
      const tgt = showing >= 0 && showing < melody.length && ((t - demoAt) % STEP) < STEP - 200 ? [melody[showing]] : []
      return { ...emptyView(), status: phase === 'demo' ? 'Watch and listen' : `Your turn: ${pos}/${melody.length}`,
        sub: msg, progress: round / maxRounds, targetMidi: tgt, held: [...held],
        stats: [['Round', `${round}/${maxRounds}`], ['Lives', '♥'.repeat(Math.max(0, lives))]] }
    },
  }
  return e
}

// ---------- 4. Chord Builder ----------
type Chord = { name: string; pcs: number[] }
const mk = (name: string, root: number, iv: number[]): Chord => ({ name, pcs: iv.map((i) => (root + i) % 12) })
const CHORD_SETS: Chord[][] = [
  [mk('C', 0, [0, 4, 7]), mk('F', 5, [0, 4, 7]), mk('G', 7, [0, 4, 7]), mk('Am', 9, [0, 3, 7])],
  [mk('Dm', 2, [0, 3, 7]), mk('Em', 4, [0, 3, 7]), mk('G7', 7, [0, 4, 7, 10]), mk('Cmaj7', 0, [0, 4, 7, 11])],
  [mk('Bb', 10, [0, 4, 7]), mk('Eb', 3, [0, 4, 7]), mk('F#m', 6, [0, 3, 7]), mk('D', 2, [0, 4, 7])],
]
function chordBuilder(li: number): Engine {
  const list = CHORD_SETS[li]
  let i = 0, startT = 0, okSince = 0, msg = 'Hold all the notes at the same time.'
  const held = new Set<number>()
  const e: Engine = {
    done: null, beep: null,
    note(ev, t) { if (!startT) startT = t; track(held, ev) },
    tick(t) {
      if (e.done) return
      const target = list[i]
      const hp = new Set([...held].map(pc))
      const ok = target.pcs.every((p) => hp.has(p)) && [...hp].every((p) => target.pcs.includes(p))
      const extra = [...hp].some((p) => !target.pcs.includes(p))
      if (extra && held.size >= 3) msg = 'One note too many. Just those keys.'
      if (ok) {
        if (!okSince) okSince = t
        if (t - okSince > 450) {
          okSince = 0; i++; msg = 'Locked in. Let go and get ready.'
          if (i >= list.length) {
            const secs = (t - startT) / 1000
            const score = Math.max(20, Math.min(100, Math.round(100 - Math.max(0, secs - 6 * list.length) * 2)))
            e.done = { score, max: 100, unit: 'pts', perfect: score >= 95, headline: 'Every chord, built.', detail: `${secs.toFixed(0)} seconds for ${list.length} chords.` }
          }
        }
      } else okSince = 0
    },
    view() {
      const c = list[Math.min(i, list.length - 1)]
      return { ...emptyView(), status: e.done ? 'Done' : `Hold ${c.name}`, sub: msg, progress: i / list.length,
        targets: e.done ? [] : c.pcs, held: [...held], stats: [['Chord', `${Math.min(i + 1, list.length)}/${list.length}`], ['Notes', c.pcs.map(pcName).join(' ')]] }
    },
  }
  return e
}

// ---------- 5. Speed Run ----------
function speedRun(_li: number, ctx: Ctx): Engine {
  const K = ctx.key
  const LEN = 15_000
  let startT = 0, count = 0, spicy = 0
  const held = new Set<number>()
  const inK = [...Array(12).keys()].filter((p) => inKey(p, K))
  const e: Engine = {
    done: null, beep: null,
    note(ev, t) {
      track(held, ev)
      if (!ev.on || e.done) return
      if (!startT) startT = t
      if (inKey(ev.note, K)) count++; else spicy++
    },
    tick(t) {
      if (startT && !e.done && t - startT >= LEN)
        e.done = { score: count, unit: 'notes in 15s', headline: count >= 40 ? 'Fast hands.' : 'Run complete.', detail: `${count} in key${spicy ? `, ${spicy} spicy (not counted)` : ''}.`, perfect: count >= 50 }
    },
    view(t) {
      const left = startT ? Math.max(0, (LEN - (t - startT)) / 1000) : 15
      return { ...emptyView(), status: startT ? `${count} notes` : 'Play a note to start the clock', sub: 'Only in-key notes count.',
        progress: startT ? 1 - left / 15 : 0, targets: inK, held: [...held], timeLeft: left, stats: [['In key', String(count)], ['Spicy', String(spicy)]] }
    },
  }
  return e
}

// ---------- generic rounds game (6, 7) ----------
interface Round { prompt: string; sub?: string; targets: number[]; targetMidi?: number[]; base?: number[]; hint?: string; accept(note: number, vel: number): boolean; beep?: number }
function roundsGame(total: number, gen: () => Round, finish: (firstTry: number) => Finish): Engine {
  let r = 0, firstTry = 0, missed = false, cur = gen(), msg = '', showHint = false
  const held = new Set<number>()
  const e: Engine = {
    done: null, beep: cur.beep ?? null,
    note(ev) {
      track(held, ev)
      if (!ev.on || e.done) return
      if (cur.accept(ev.note, ev.velocity)) {
        if (!missed) firstTry++
        r++; missed = false; showHint = false
        if (r >= total) { e.done = finish(firstTry); return }
        msg = 'Yes.'; cur = gen(); e.beep = cur.beep ?? null
      } else { missed = true; msg = `That was ${noteName(ev.note)}. Try again.`; if (cur.hint) showHint = true }
    },
    tick() {},
    view() {
      return { ...emptyView(), status: cur.prompt, sub: msg || cur.sub, progress: r / total, targets: showHint ? cur.targets : [],
        targetMidi: showHint ? cur.targetMidi ?? [] : [], base: cur.base ?? [], held: [...held],
        stats: [['Round', `${Math.min(r + 1, total)}/${total}`], ['First try', String(firstTry)]] }
    },
  }
  return e
}
const finishRounds = (what: string, total = 10) => (n: number): Finish => ({
  score: n, max: total, unit: `first-try ${what}`, perfect: n >= total,
  headline: n >= total * 0.9 ? 'Sharp.' : n >= total * 0.6 ? 'Solid.' : 'You found them all.', detail: `${n} on the first try. Everything counts as practice.`,
})

const NATURALS = [0, 2, 4, 5, 7, 9, 11]
const ALL12 = [...Array(12).keys()]
function noteDetective(li: number, total = 10): Engine {
  const pool = li === 0 ? NATURALS : ALL12
  let last = -1
  return roundsGame(total, () => {
    let p = rnd(pool); while (p === last) p = rnd(pool); last = p
    if (li === 2) return { prompt: 'Which note is this? Listen.', sub: 'Find it by ear. Wrong guesses show the name.', targets: [p], hint: 'x', accept: (n) => pc(n) === p, beep: 60 + p }
    return { prompt: `Find ${PC_NAMES[p]}`, sub: 'Any octave works.', targets: [p], accept: (n) => pc(n) === p }
  }, finishRounds('notes', total))
}

const MAJ = [0, 2, 4, 5, 7, 9, 11]
const maj = (i: number) => 12 * Math.floor(i / 7) + MAJ[((i % 7) + 7) % 7]
function intervalJumper(li: number, total = 10): Engine {
  const kinds = [{ n: '3rd', s: 2 }, { n: '5th', s: 4 }, { n: 'octave', s: 7 }]
  return roundsGame(total, () => {
    const k = li === 3 ? rnd(kinds) : kinds[li]
    const idx = Math.floor(Math.random() * 7) // C4..B4
    const base = 60 + maj(idx), target = 60 + maj(idx + k.s)
    return { prompt: `A ${k.n} above ${noteName(base)}`, sub: 'Count the letter names, include the start note.',
      targets: [pc(target)], targetMidi: [target], base: [base], hint: 'x', accept: (n) => pc(n) === pc(target) && n > base }
  }, finishRounds('jumps', total))
}

// ---------- new challenges ----------
const BLACKPC = [1, 3, 6, 8, 10]
function blackKeys(_li: number, total = 25): Engine {
  let n = 0, whites = 0, msg = 'Only the black keys. Pentatonic magic.'
  const held = new Set<number>()
  const e: Engine = {
    keyToSet: { tonic: 6, scale: 'majorPentatonic' }, done: null, beep: null,
    note(ev) {
      track(held, ev)
      if (!ev.on || e.done) return
      if (BLACKPC.includes(pc(ev.note))) {
        n++; msg = n % 7 === 0 ? 'You cannot play a wrong note here.' : 'Smooth.'
        if (n >= total) {
          const score = Math.max(40, 100 - whites * 4)
          e.done = { score, max: 100, unit: 'pts', perfect: whites === 0, headline: 'Black keys, no wrong notes.', detail: whites ? `${whites} white-key slip${whites > 1 ? 's' : ''}.` : 'Zero white keys touched.' }
        }
      } else { whites++; msg = 'That is a white key. Back to the black ones.' }
    },
    tick() {},
    view() {
      return { ...emptyView(), status: 'Black keys only', sub: msg, progress: n / total, targets: BLACKPC, held: [...held],
        stats: [['Notes', `${n}/${total}`], ['White slips', String(whites)]] }
    },
  }
  return e
}

const MIRROR_POOL = [55, 57, 59, 60, 64, 65, 67, 69]
function mirrorMode(_li: number, total = 10): Engine {
  let last = 0
  return roundsGame(total, () => {
    let n = rnd(MIRROR_POOL); while (n === last) n = rnd(MIRROR_POOL); last = n
    const t = 124 - n
    return { prompt: `Mirror ${noteName(n)}`, sub: 'Flip it around the D in the middle (D4). Same distance, other side.',
      targets: [pc(t)], targetMidi: [t], base: [n, 62], hint: 'x', accept: (x) => x === t }
  }, finishRounds('mirrors', total))
}

function loudSoft(_li: number, total = 10): Engine {
  return roundsGame(total, () => {
    const loud = Math.random() < 0.5
    return { prompt: loud ? 'Play any note LOUD' : 'Play any note soft', sub: loud ? 'Hit it with confidence (velocity over 90).' : 'Barely touch it (velocity under 50).',
      targets: [], hint: undefined, accept: (_n, v) => (loud ? v > 90 : v < 50) }
  }, finishRounds('dynamics', total))
}

function majorMinor(): Engine {
  const total = 8
  let r = 0, firstTry = 0, missed = false, msg = 'Turn on soft beeps to hear the chord.'
  let chord: number[] = [], isMajor = true
  const held = new Set<number>()
  const gen = () => {
    const root = 60 + rnd([0, 2, 4, 5, 7, 9]); isMajor = Math.random() < 0.5
    chord = [root, root + (isMajor ? 4 : 3), root + 7]
  }
  gen()
  const e: Engine = {
    done: null, beep: null, beepChord: chord,
    note(ev) {
      track(held, ev)
      if (!ev.on || e.done) return
      const p = pc(ev.note)
      if (p === 0 || p === 9) {
        if ((p === 0) === isMajor) {
          if (!missed) firstTry++
          r++; missed = false
          if (r >= total) { e.done = { score: firstTry, max: total, unit: 'first-try ears', perfect: firstTry >= total, headline: firstTry >= 7 ? 'Golden ears.' : 'Ears are trainable, and yours just got a workout.', detail: `${firstTry} of ${total} on the first listen.` }; return }
          msg = 'Right.'; gen(); e.beepChord = chord
        } else { missed = true; msg = 'Listen again. Major sounds bright, minor sounds moody.'; e.beepChord = chord }
      } else { msg = 'Play C for major, A for minor. (Other keys replay the chord.)'; e.beepChord = chord }
    },
    tick() {},
    view() {
      return { ...emptyView(), status: 'Major (play C) or minor (play A)?', sub: msg, progress: r / total, targets: [0, 9], held: [...held],
        stats: [['Round', `${Math.min(r + 1, total)}/${total}`], ['First listen', String(firstTry)]] }
    },
  }
  return e
}

function glissando(li: number): Engine {
  const [lo, hi, par] = li === 0 ? [60, 72, 3] : [48, 84, 9]
  const seq: number[] = []
  for (let n = lo; n <= hi; n++) if (!BLACKPC.includes(pc(n))) seq.push(n)
  let pos = 0, startT = 0, msg = 'Sweep up the white keys. Start whenever.'
  const held = new Set<number>()
  const e: Engine = {
    done: null, beep: null,
    note(ev, t) {
      track(held, ev)
      if (!ev.on || e.done) return
      if (ev.note === seq[pos]) {
        if (!startT) startT = t
        pos++; msg = pos < seq.length ? '' : ''
        if (pos >= seq.length) {
          const secs = (t - startT) / 1000
          const score = Math.max(10, Math.min(100, Math.round((par / Math.max(secs, 0.1)) * 100)))
          e.done = { score, max: 100, unit: 'pts', perfect: score >= 100, headline: 'Glissando!', detail: `${secs.toFixed(1)} seconds, ${seq.length} keys.` }
        }
      } else if (startT) msg = `Missed one. Next is ${noteName(seq[pos])}.`
    },
    tick() {},
    view(t) {
      return { ...emptyView(), status: e.done ? 'Done' : `Next: ${noteName(seq[pos])}`, sub: msg, progress: pos / seq.length, targetMidi: e.done ? [] : [seq[pos]], held: [...held],
        stats: [['Keys', `${pos}/${seq.length}`], ['Time', startT && !e.done ? `${((t - startT) / 1000).toFixed(1)}s` : '-']] }
    },
  }
  return e
}

// Rhythm Copy: tap the pattern on any key. First tap sets the start, the rest are judged against the grid.
const RHYTHMS = [[0, 2, 4, 6], [0, 1, 2, 4], [0, 2, 3, 4, 6], [0, 1, 4, 5], [0, 3, 4, 6, 7], [0, 2, 3, 5, 6]]
function rhythmCopy(li: number): Engine {
  const STEP = li === 0 ? 450 : 330, WIN = 150, rounds = 5
  let r = 0, firstTry = 0, missed = false, taps: number[] = [], pat = rnd(RHYTHMS), msg = 'Tap the first beat whenever ready. The rest follow the grid.'
  const held = new Set<number>()
  const grid = () => Array.from({ length: 8 }, (_, i) => (pat.includes(i) ? '●' : '·')).join('  ')
  const e: Engine = {
    done: null, beep: null,
    note(ev, t) {
      track(held, ev)
      if (!ev.on || e.done) return
      taps.push(t)
      if (taps.length >= pat.length) {
        const ok = taps.every((x, i) => Math.abs(x - taps[0] - (pat[i] - pat[0]) * STEP) <= WIN)
        taps = []
        if (ok) {
          if (!missed) firstTry++
          r++; missed = false
          if (r >= rounds) { e.done = { score: firstTry, max: rounds, unit: 'first-try rhythms', perfect: firstTry >= rounds, headline: 'Rhythm locked.', detail: `${firstTry} of ${rounds} on the first go.` }; return }
          msg = 'On the beat.'; pat = rnd(RHYTHMS)
        } else { missed = true; msg = 'A little off. Look at the gaps and try again.' }
      }
    },
    tick(t) { if (taps.length && t - taps[taps.length - 1] > 1500) { taps = []; msg = 'Timed out, start again from the first beat.' } },
    view() {
      return { ...emptyView(), status: grid(), sub: msg, progress: r / rounds, held: [...held],
        stats: [['Round', `${Math.min(r + 1, rounds)}/${rounds}`], ['Taps', `${taps.length}/${pat.length}`], ['Tempo', li === 0 ? 'chill' : 'quick']] }
    },
  }
  return e
}

// Boss: five short tasks back to back. Daily: today's seeded pick.
function composite(label: string, makers: (() => Engine)[], bannerOf?: (i: number) => string): Engine {
  let i = 0, cur = makers[0](), ratios: number[] = []
  const e: Engine = {
    get keyToSet() { return cur.keyToSet }, done: null,
    get beep() { return cur.beep }, set beep(v) { cur.beep = v },
    get beepChord() { return cur.beepChord }, set beepChord(v) { cur.beepChord = v },
    note(ev, t) { cur.note(ev, t); adv() }, tick(t) { cur.tick(t); adv() },
    view(t) {
      const v = cur.view(t)
      return { ...v, status: v.status, sub: `${bannerOf ? bannerOf(i) : `${label} ${i + 1}/${makers.length}`}${v.sub ? ' | ' + v.sub : ''}`, progress: (i + v.progress) / makers.length }
    },
  } as Engine
  function adv() {
    if (e.done || !cur.done) return
    ratios.push(cur.done.score / (cur.done.max ?? 100)); i++
    if (i >= makers.length) {
      const sc = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)
      e.done = { score: sc, max: 100, unit: 'pts', perfect: sc >= 95, headline: sc >= 85 ? 'Boss defeated.' : 'Boss beaten, rematch for a higher score.', detail: `${makers.length} tasks cleared.` }
    } else { cur = makers[i](); }
  }
  return e
}
function bossLevel(): Engine {
  const pool: (() => Engine)[] = [
    () => noteDetective(1, 4), () => intervalJumper(3, 3), () => mirrorMode(0, 3), () => blackKeys(0, 6),
    () => loudSoft(0, 4), () => glissando(0), () => rhythmCopy(0),
  ]
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 5)
  return composite('Stage', picks, (i) => `Stage ${i + 1} of 5`)
}
function dailyChallenge(): Engine {
  const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()
  const pool = CHALLENGES.filter((c) => c.id !== 'daily' && c.id !== 'boss' && c.id !== 'majmin' && c.id !== 'echo')
  const def = pool[(seed * 7) % pool.length]
  const level = (seed * 13) % def.levels.length
  return composite('Daily', [() => def.create(level, { key: useHarmonyStore.getState().key })], () => `Today: ${def.emoji} ${def.title} (${def.levels[level]})`)
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'climb', emoji: '🧗', title: 'Scale Climber', desc: 'Up the scale and back down, one glowing note at a time.', difficulty: 1,
    levels: ['C major', 'G major', 'F major', 'A minor'], badge: 'Summit', create: (l) => scaleClimber(l) },
  { id: 'stay', emoji: '🎯', title: 'Stay in Key', desc: '30 notes, no spicy ones. Improvise freely.', difficulty: 2,
    levels: ['C major', 'G major', 'A minor', 'Surprise me'], badge: 'Smooth Operator', create: (l, c) => stayInKey(l, c) },
  { id: 'echo', emoji: '🧠', title: 'Echo Me', desc: 'Watch a melody that grows each round, then play it back.', difficulty: 2,
    levels: ['Pentatonic', 'Full scale'], badge: 'Elephant Memory', create: (l) => echoMe(l) },
  { id: 'chords', emoji: '🎹', title: 'Chord Builder', desc: 'Hold the named chord with all its notes at once.', difficulty: 2,
    levels: ['C F G Am', 'Dm Em G7 Cmaj7', 'Black-key chords'], badge: 'Architect', create: (l) => chordBuilder(l) },
  { id: 'speed', emoji: '⚡', title: 'Speed Run', desc: 'How many in-key notes can you fit into 15 seconds?', difficulty: 2,
    levels: ['Current key'], badge: 'Quick Fingers', create: (l, c) => speedRun(l, c) },
  { id: 'detective', emoji: '🔎', title: 'Note Detective', desc: 'A note name appears. Track it down on the keys.', difficulty: 1,
    levels: ['Natural notes', 'All 12 notes', 'By ear'], badge: 'Detective', create: (l) => noteDetective(l) },
  { id: 'interval', emoji: '🦘', title: 'Interval Jumper', desc: 'Leap a 3rd, 5th or octave above the shown note.', difficulty: 3,
    levels: ['3rds', '5ths', 'Octaves', 'Mixed'], badge: 'Big Leaps', create: (l) => intervalJumper(l) },
  { id: 'rhythm', emoji: '🥁', title: 'Rhythm Copy', desc: 'Tap the dot pattern on any key. Gaps matter, notes do not.', difficulty: 2,
    levels: ['Chill tempo', 'Quick tempo'], badge: 'Human Metronome', create: (l) => rhythmCopy(l) },
  { id: 'black', emoji: '🖤', title: 'Black Keys Only', desc: '25 notes, zero white keys. It is impossible to sound bad.', difficulty: 1,
    levels: ['25 notes'], badge: 'Midnight Jam', create: (l) => blackKeys(l) },
  { id: 'mirror', emoji: '🪞', title: 'Mirror Mode', desc: 'Flip each note around the middle D. Your brain will squeak.', difficulty: 3,
    levels: ['10 mirrors'], badge: 'Through the Looking Glass', create: (l) => mirrorMode(l) },
  { id: 'dynamics', emoji: '🔊', title: 'Loud & Soft', desc: 'Whisper or thunder, on request. Your touch is the controller.', difficulty: 1,
    levels: ['10 rounds'], badge: 'Dynamic Duo', create: (l) => loudSoft(l) },
  { id: 'majmin', emoji: '🎭', title: 'Major or Minor?', desc: 'Hear a chord, answer C for happy or A for moody.', difficulty: 2,
    levels: ['8 chords'], badge: 'Golden Ears', create: () => majorMinor() },
  { id: 'gliss', emoji: '🌊', title: 'Glissando Dash', desc: 'Sweep every white key, low to high, as fast as you dare.', difficulty: 2,
    levels: ['One octave', 'Whole keyboard'], badge: 'Surfer', create: (l) => glissando(l) },
  { id: 'boss', emoji: '👾', title: 'Boss Level', desc: 'Five random mini-tasks back to back. No save point.', difficulty: 3,
    levels: ['Random five'], badge: 'Boss Slayer', create: () => bossLevel() },
  { id: 'daily', emoji: '📅', title: 'Daily Challenge', desc: 'One challenge per day, same for everyone. Come back tomorrow.', difficulty: 2,
    levels: ['Today'], badge: 'Daily Grinder', create: () => dailyChallenge() },
]
