// 🕺 Koreographer: the second Koog Kode app. Teach the stick-man dancer moves (functions), then program a routine with
// repeat (loops), when (events) and if / else (conditions), and watch him perform it like a debugger.
// Runs on the Koding Kore: tokens (keys, drums, DJ, pedal, screen), capped sound, the keyboard guide, per-player progress and concept badges.
// A routine is DATA (see engine.ts): nothing here evals, and everything loaded or shared is validated first.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KoreAppProps } from '../../../kode/kore/types'
import {
  BUILTINS, BPM_MAX, BPM_MIN, COND_KINDS, COND_LABEL, DEFAULT_DRUMS, EV_KINDS, EV_LABEL, MOVES, PUZZLE_FNS, REACT_BEATS, ROOT, SEQ_BEATS,
  addIf, addNode, addRule, argOf, checkGoal, blockCount, cleanFn, cleanName, cleanRoutine, cycleArg, decodeShare, emptyRoutine, encodeShare, flatten,
  getList, isHigh, isLoud, matchCall, moveDef, nodeAt, removeNode, repeatLast, sameRef, setArg, setCond, setRepeatN, setRule, shapeOf, sameShape,
  shareFromHash, stepAt, tableOf, toKode, usesOf, type Arg, type EvKind, type Fn, type FnTable, type ListRef, type Node, type Plan, type Routine, type Step,
} from './engine'
import { PUZZLES, type Puzzle } from './puzzles'
import { DancerStage, type StageState } from './DancerStage'
import './choreo.css'

export const APP_NAME = 'Koreographer'
const MAX_TAUGHT = 12
const ROUTE = '#/apps/choreographer'

interface PuzzleBest { stars: number; blocks: number }
interface SavedDance { id: string; name: string; routine: Routine; fns: Fn[] }
interface RunState { pl: Plan; from: number; to: number; t0: number; last: number; silent: boolean; kind: 'run' | 'step' | 'demo'; forced?: Step; done?: () => void }
interface Live { move: Fn['move']; a: Arg; until: number; t0: number; label: string }
type Teach = { stage: 'off' } | { stage: 'listen'; notes: number[]; vels: number[] } | { stage: 'pick'; notes: number[]; vel: number; move: Fn['move'] | null; name: string }

/** what the dancer actually did, for tests: window.__koreoLog = [{ move, a, react, why }] (last 200 changes) */
function logMove(s: Step) {
  try { const w = window as unknown as { __koreoLog?: unknown[] }; const l = (w.__koreoLog ??= []); l.push({ move: s.move, a: s.a, react: !!s.react, why: s.why, fn: s.fn }); if (l.length > 200) l.shift() } catch { /* ignore */ }
}
const childPath = (parent: string, part: '' | 't' | 'e', i: number) => (parent === '' ? `${i}` : `${parent}.${part}${i}`)
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const goalText = (p: Puzzle, table: FnTable): string => {
  const parts: string[] = []
  if (p.goal.seq) parts.push(p.goal.seq.map((t) => { const [m, a] = t.split(':'); return moveDef(m).emoji + (a ? (a === 's' ? '(small)' : '(BIG)') : '') }).join(' → '))
  for (const r of p.goal.reacts ?? []) parts.push(`⚡ when ${EV_LABEL[r.ev]} → ${moveDef(r.move).emoji} ${moveDef(r.move).name}`)
  if (p.goal.requires?.includes('if')) parts.push('🔀 use an if / else')
  if (p.goal.requires?.includes('fn')) parts.push('🎓 teach him a move of your own')
  void table
  return parts.join('   +   ')
}

export default function Koreographer({ kore }: KoreAppProps) {
  const reduced = useMemo(reducedMotion, [])
  const [mode, setMode] = useState<'puzzles' | 'free'>('puzzles')
  const [pid, setPid] = useState<string>(() => {
    const done = kore.progress.load<Record<string, PuzzleBest>>('puzzles', {})
    return (PUZZLES.find((p) => !done[p.id]) ?? PUZZLES[0]).id
  })
  const puzzle = mode === 'puzzles' ? PUZZLES.find((p) => p.id === pid) ?? PUZZLES[0] : null
  const [routine, setRoutineRaw] = useState<Routine>(() => emptyRoutine('Puzzle'))
  const undo = useRef<Routine[]>([])
  const [focus, setFocus] = useState<ListRef>(ROOT)
  const [taught, setTaught] = useState<Fn[]>(() => { const v = kore.progress.load<unknown[]>('taught', []); return Array.isArray(v) ? v.map(cleanFn).filter((f): f is Fn => !!f && /^u\d+$/.test(f.id)).slice(0, MAX_TAUGHT) : [] })
  const [best, setBest] = useState<Record<string, PuzzleBest>>(() => kore.progress.load('puzzles', {}))
  const [saved, setSaved] = useState<SavedDance[]>(() => loadSaved(kore.progress.load('saved', [])))
  const [msg, setMsg] = useState('')
  const [teach, setTeach] = useState<Teach>({ stage: 'off' })
  const [perf, setPerf] = useState<'idle' | 'run' | 'step' | 'demo'>('idle')
  const [active, setActive] = useState<{ paths: string[]; step: Step | null }>({ paths: [], step: null })
  const [stepIdx, setStepIdx] = useState(0)
  const [result, setResult] = useState<{ ok: boolean; stars: number; blocks: number; problems: string[] } | null>(null)
  const [hintN, setHintN] = useState(0)
  const [shareLink, setShareLink] = useState('')
  const [incoming, setIncoming] = useState<{ routine: Routine; fns: Fn[] } | null>(null)
  const [drumFlash, setDrumFlash] = useState('')

  // ---- the function table + the plan
  const table: FnTable = useMemo(() => {
    if (puzzle) return tableOf(PUZZLE_FNS.filter((f) => puzzle.fns.includes(f.id)), taught)
    return tableOf(BUILTINS, PUZZLE_FNS, taught)
  }, [puzzle, taught])
  const fnList = useMemo(() => Object.values(table), [table])
  const drums = puzzle?.drums ?? DEFAULT_DRUMS
  const plan = useMemo(() => flatten(routine, table, drums), [routine, table, drums])
  const focusEff = getList(routine, focus) ? focus : ROOT

  // ---- latest values for the frame loop and the token handler
  const S = useRef({ routine, table, plan, fnList, drums, teach, focusEff, perf, puzzle, mode })
  S.current = { routine, table, plan, fnList, drums, teach, focusEff, perf, puzzle, mode }
  const run = useRef<RunState | null>(null)
  const live = useRef<Live | null>(null)
  const stage = useRef<StageState>({ move: null, u: 0, a: 'm', beat: 0, react: false, label: '', tint: 265 })
  const playhead = useRef<HTMLDivElement>(null)
  const t00 = useRef(performance.now())
  const muteUntil = useRef(0)
  const marked = useRef(new Set<string>())
  const buf = useRef<{ n: number; t: number }[]>([])
  const bufTimer = useRef(0)
  const teachTimer = useRef(0)
  const lastActive = useRef('')
  const read = useCallback(() => stage.current, [])

  const setRoutine = useCallback((next: Routine, keep = false) => {
    if (!keep) { undo.current.push(S.current.routine); if (undo.current.length > 30) undo.current.shift() }
    setRoutineRaw(next); setResult(null); setStepIdx(0)
  }, [])

  // ---- sound + marks
  const mark = useCallback((id: Parameters<typeof kore.concepts.mark>[0]) => { if (!marked.current.has(id)) { marked.current.add(id); kore.concepts.mark(id) } }, [kore])
  const markUsed = useCallback(() => {
    const u = usesOf(S.current.routine, S.current.table)
    if (u.calls > 0) mark('sequence')
    if (u.repeat) mark('loop'); if (u.when) mark('event'); if (u.cond) mark('condition'); if (u.fn) mark('function'); if (u.param) mark('parameter')
  }, [mark])
  const preview = useCallback((f: Fn) => {
    muteUntil.current = performance.now() + 900
    f.notes.forEach((n, i) => kore.sound.note(n, f.vel, undefined, 0.3 + 0 * i))
  }, [kore])

  // ---- playing a plan on the stage
  const stop = useCallback((reset = true) => {
    run.current = null
    kore.sound.stop()
    if (reset) { setPerf('idle'); setActive({ paths: [], step: null }); lastActive.current = '' }
  }, [kore])
  const play = useCallback((pl: Plan, from: number, to: number, o: { silent?: boolean; kind: 'run' | 'step' | 'demo'; forced?: Step; done?: () => void }) => {
    run.current = { pl, from, to, t0: performance.now(), last: from - 1e-6, silent: !!o.silent, kind: o.kind, forced: o.forced, done: o.done }
    live.current = null
    setPerf(o.kind)
  }, [])

  useEffect(() => {
    let raf = 0, alive = true
    const tick = () => {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      const now = performance.now(), s = S.current
      const bpm = run.current?.kind === 'demo' ? 100 : s.routine.bpm
      const msb = 60000 / bpm
      const st = stage.current
      st.tint = s.puzzle ? 265 : 200
      const r = run.current
      if (r) {
        const beat = r.from + (now - r.t0) / msb
        if (!r.silent) {
          for (const n of r.pl.notes) if (n.beat > r.last && n.beat <= beat && n.beat >= r.from && n.beat < r.to) kore.sound.note(n.n, n.vel, undefined, 0.4)
          for (const e of r.pl.events) if (e.kind !== 'note' && e.beat > r.last && e.beat <= beat && e.beat >= r.from && e.beat < r.to) { kore.sound.drum(e.kind === 'kick' ? 0 : 1, e.vel ?? 0.8); setDrumFlash(e.kind) }
        }
        r.last = beat
        const cur = r.forced ?? stepAt(r.pl, beat)
        if (cur && beat < r.to) {
          st.move = cur.move; st.a = cur.a; st.u = Math.min(0.999, Math.max(0, (beat - cur.beat) / cur.dur)); st.react = !!cur.react; st.label = ''
          const key = cur.path + '@' + cur.beat
          if (key !== lastActive.current) { lastActive.current = key; logMove(cur); setActive({ paths: [...cur.anc, cur.path], step: cur }) }
        } else if (beat < r.to) { st.move = null; st.react = false; if (lastActive.current) { lastActive.current = ''; setActive({ paths: [], step: null }) } }
        st.beat = ((beat % 1) + 1) % 1
        if (playhead.current) playhead.current.style.left = `${Math.min(100, Math.max(0, (beat / Math.max(r.pl.beats, 1)) * 100))}%`
        if (beat >= r.to) { const d = r.done; run.current = null; kore.sound.stop(); setPerf('idle'); st.move = null; if (!r.forced) { setActive({ paths: [], step: null }); lastActive.current = '' }; if (playhead.current) playhead.current.style.left = '0%'; d?.() }
      } else {
        st.beat = (((now - t00.current) / msb) % 1 + 1) % 1
        const lv = live.current
        if (lv && now < lv.until) { st.move = lv.move; st.a = lv.a; st.u = (now - lv.t0) / (lv.until - lv.t0); st.react = true; st.label = lv.label } else { live.current = null; st.move = null; st.react = false; st.label = '' }
        if (playhead.current) playhead.current.style.left = '0%'
      }
    }
    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [kore])

  // ---- editing actions
  const addCall = useCallback((fnId: string, a?: Arg) => {
    const s = S.current
    if (!s.table[fnId]) return
    const node: Node = a && a !== 'm' ? { k: 'call', fn: fnId, a } : { k: 'call', fn: fnId }
    setRoutine(addNode(s.routine, s.focusEff, node))
  }, [setRoutine])
  const doRepeat = useCallback((n?: number) => {
    const s = S.current
    const list = getList(s.routine, s.focusEff)
    if (!list || !list.length) { setMsg('Add a move first, then repeat it.'); return }
    setRoutine(repeatLast(s.routine, s.focusEff, n)); setMsg('')
  }, [setRoutine])
  const newIf = () => {
    const r = addIf(routine, focusEff, 'high'); setRoutine(r)
    const idx = (getList(r, focusEff)?.length ?? 1) - 1
    setFocus({ parent: childPath(focusEff.parent, focusEff.part, idx), part: 't' })
    setMsg('Fill the "then" box and the "else" box: tap a box, then a move.')
  }
  const newRule = () => {
    const r = addRule(routine, 'kick'); setRoutine(r); setFocus({ parent: `r${r.rules.length - 1}`, part: '' })
    setMsg('Pick what he waits for, then tap the box and choose his reaction.')
  }
  const undoLast = () => { const p = undo.current.pop(); if (p) { setRoutine(p, true); setFocus(ROOT) } }

  // ---- teaching
  const startTeach = () => { stop(); setTeach({ stage: 'listen', notes: [], vels: [] }); setMsg('Play a short tune (2 to 6 notes). Tap Done or the pedal when you finish.') }
  const finishListen = useCallback(() => {
    const t = S.current.teach
    if (t.stage !== 'listen') return
    if (t.notes.length < 2) { setMsg('Play at least 2 notes first.'); return }
    const vel = Math.round(Math.min(0.95, Math.max(0.3, t.vels.reduce((a, b) => a + b, 0) / t.vels.length)) * 100) / 100
    setTeach({ stage: 'pick', notes: t.notes, vel, move: null, name: '' }); setMsg('Now choose what this tune MEANS.')
  }, [])
  const pickMove = (m: Fn['move']) => {
    setTeach((t) => (t.stage === 'pick' ? { ...t, move: m, name: t.name || moveDef(m).name } : t))
    live.current = { move: m, a: 'm', t0: performance.now(), until: performance.now() + (60000 / routine.bpm) * SEQ_BEATS, label: '' }
  }
  const saveTeach = () => {
    if (teach.stage !== 'pick' || !teach.move) return
    const clash = fnList.find((f) => sameShape(shapeOf(f.notes), shapeOf(teach.notes)))
    if (clash) { setMsg(`That tune already means ${clash.emoji} ${clash.name}. Play a different one.`); return }
    if (taught.length >= MAX_TAUGHT) { setMsg(`He can learn ${MAX_TAUGHT} moves of yours. Forget one first.`); return }
    let n = 1; while (taught.some((f) => f.id === `u${n}`)) n++
    const def = moveDef(teach.move)
    const f: Fn = { id: `u${n}`, name: cleanName(teach.name, def.name), emoji: def.emoji, notes: teach.notes, move: teach.move, vel: teach.vel }
    const next = [...taught, f]
    setTaught(next); kore.progress.save('taught', next); mark('function')
    setTeach({ stage: 'off' }); setMsg(`Taught! Play that tune and he will ${def.name.toLowerCase()}. It is a function: a name plus what it does.`)
  }
  const forget = (id: string) => { const next = taught.filter((f) => f.id !== id); setTaught(next); kore.progress.save('taught', next) }

  // ---- the token stream
  useEffect(() => {
    const off = kore.tokens.on((t) => {
      const s = S.current
      if (run.current || performance.now() < muteUntil.current) return
      const tchPitch = t.pitch ?? (t.lane != null ? 48 + t.lane * 2 : undefined)
      if (s.teach.stage === 'listen') {
        if (t.src === 'pedal') { finishListen(); return }
        if (tchPitch == null) return
        const notes = [...s.teach.notes, tchPitch].slice(0, 6), vels = [...s.teach.vels, t.vel].slice(0, 6)
        setTeach({ stage: 'listen', notes, vels })
        window.clearTimeout(teachTimer.current)
        if (notes.length >= 2) teachTimer.current = window.setTimeout(finishListen, 2200)
        return
      }
      if (s.teach.stage === 'pick') return
      if (t.src === 'pedal') { doRepeat(); return }
      if (t.src === 'screen') return
      // live "when" rules: try your rules by playing
      const evs: EvKind[] = []
      if ((t.src === 'drums' || t.src === 'dj') && t.lane != null) { if (t.lane === 0) evs.push('kick'); if (t.lane === 1) evs.push('snare') }
      if (t.pitch != null) { if (isLoud(t.vel)) evs.push('loud'); if (isHigh(t.pitch)) evs.push('high') }
      for (const ev of evs) {
        const rule = s.routine.rules.find((q) => q.ev === ev && q.body[0]?.k === 'call')
        const c = rule?.body[0]
        if (rule && c && c.k === 'call' && s.table[c.fn]) {
          const f = s.table[c.fn], now = performance.now()
          live.current = { move: f.move, a: argOf(c.a), t0: now, until: now + (60000 / s.routine.bpm) * REACT_BEATS * 1.2, label: `when ${ev}` }
          break
        }
      }
      // call signs: play a function's tune to add it (higher = BIG, lower = small)
      if (t.pitch != null) {
        const now = performance.now()
        if (buf.current.length && now - buf.current[buf.current.length - 1].t > 1800) buf.current = []
        buf.current.push({ n: t.pitch, t: now }); if (buf.current.length > 8) buf.current.shift()
        window.clearTimeout(bufTimer.current)
        bufTimer.current = window.setTimeout(() => {
          const m = matchCall(buf.current.map((b) => b.n), S.current.fnList)
          if (m) { buf.current = []; addCall(m.fn.id, m.a); setMsg(`Added ${m.fn.emoji} ${m.fn.name}${m.a === 'l' ? ' (big, you played it higher)' : m.a === 's' ? ' (small, you played it lower)' : ''}`) }
        }, 520)
      }
    })
    return () => { off(); window.clearTimeout(bufTimer.current); window.clearTimeout(teachTimer.current) }
  }, [kore, addCall, doRepeat, finishListen])

  // ---- keyboard glow for the early puzzles
  useEffect(() => {
    if (!puzzle?.glow) { kore.guide.clear(); return }
    const want = flatten(puzzle.solution, table, drums).steps.map((s) => s.fn)
    const have = plan.steps.map((s) => s.fn)
    let i = 0; while (i < have.length && i < want.length && have[i] === want[i]) i++
    if (i < want.length && i === have.length && table[want[i]]) kore.guide.show(table[want[i]].notes); else kore.guide.clear()
  }, [kore, puzzle, plan, table, drums])
  useEffect(() => () => { kore.guide.clear(); kore.sound.stop() }, [kore])
  useEffect(() => { if (mode === 'free') kore.progress.save('draft', routine) }, [kore, mode, routine])

  // ---- loading a shared link
  useEffect(() => {
    const raw = shareFromHash(location.hash)
    if (!raw) return
    const d = decodeShare(raw)
    if (d) setIncoming(d); else setMsg('That share link is damaged, so Koreographer ignored it.')
  }, [])
  const adopt = useCallback((rt: Routine, fns: Fn[]): Routine | null => {
    // bring a stranger's functions into my list with fresh ids, reusing identical ones
    const mine = [...taught]
    const map = new Map<string, string>()
    for (const f of fns) {
      const same = mine.find((m) => m.move === f.move && sameShape(shapeOf(m.notes), shapeOf(f.notes)) && m.notes[0] === f.notes[0])
      if (same) { map.set(f.id, same.id); continue }
      if (mine.length >= MAX_TAUGHT) return null
      let n = 1; while (mine.some((m) => m.id === `u${n}`)) n++
      const nf = { ...f, id: `u${n}` }; mine.push(nf); map.set(f.id, nf.id)
    }
    const fix = (l: Node[]): Node[] => l.map((n): Node => (n.k === 'call' ? { ...n, fn: map.get(n.fn) ?? n.fn } : n.k === 'repeat' ? { ...n, body: fix(n.body) } : { ...n, then: fix(n.then), else: fix(n.else) }))
    const out: Routine = { ...rt, nodes: fix(rt.nodes), rules: rt.rules.map((q) => ({ ...q, body: fix(q.body) })) }
    if (mine.length !== taught.length) { setTaught(mine); kore.progress.save('taught', mine) }
    return out
  }, [taught, kore])
  const openIncoming = () => {
    if (!incoming) return
    const rt = adopt(incoming.routine, incoming.fns)
    if (!rt) { setMsg('Your move list is full. Forget one first.'); return }
    setMode('free'); setRoutine(rt); setFocus(ROOT); setIncoming(null); setMsg(`Opened "${rt.name}". Press Perform!`)
    try { history.replaceState(null, '', ROUTE) } catch { /* ignore */ }
  }

  // ---- perform, step, demo, check
  const autoCheck = useCallback(() => {
    const p = S.current.puzzle
    if (!p) return
    const res = checkGoal(p.goal, S.current.routine, S.current.table, p.par, p.drums)
    setResult({ ok: res.ok, stars: res.stars, blocks: res.blocks, problems: res.problems })
    if (res.ok) {
      mark(p.concept === 'sequence' ? 'sequence' : p.concept)
      setBest((b) => {
        const old = b[p.id], isBetter = !old || res.stars > old.stars || (res.stars === old.stars && res.blocks < old.blocks)
        const nb = isBetter ? { ...b, [p.id]: { stars: res.stars, blocks: res.blocks } } : b
        if (isBetter) kore.progress.save('puzzles', nb)
        return nb
      })
      if (!best[p.id]) kore.celebrate({ title: `${APP_NAME} ${p.n}: ${p.title}`, emoji: '🕺', kind: res.stars === 3 ? 'gold' : 'badge' })
    }
  }, [kore, mark, best])
  const perform = () => {
    if (perf === 'run' || perf === 'step') { stop(); return }
    if (perf === 'demo') stop()
    if (!plan.all.length) { setMsg('Add a move first (tap one in the list, or play its tune).'); return }
    markUsed(); setMsg(''); setStepIdx(0)
    play(plan, 0, plan.beats, { kind: 'run', done: autoCheck })
  }
  const stepOnce = () => {
    if (perf !== 'idle') stop()
    if (!plan.all.length) { setMsg('Add a move first.'); return }
    markUsed(); mark('debug')
    const i = stepIdx >= plan.all.length ? 0 : stepIdx
    const s = plan.all[i]
    play(plan, s.beat, s.beat + s.dur, { kind: 'step', forced: s, silent: false })
    setActive({ paths: [...s.anc, s.path], step: s }); lastActive.current = s.path + '@' + s.beat
    setStepIdx(i + 1)
    if (i + 1 >= plan.all.length && S.current.puzzle) window.setTimeout(autoCheck, 100)
  }
  const watchDemo = useCallback(() => {
    const p = S.current.puzzle
    if (!p) return
    const pl = flatten(p.solution, S.current.table, p.drums)
    setMsg('Watch his dance. Then build it yourself.')
    play(pl, 0, pl.beats, { kind: 'demo', silent: true, done: () => setMsg('Your turn! Tap moves to build the same dance.') })
  }, [play])
  useEffect(() => { if (puzzle?.demo) { const h = window.setTimeout(watchDemo, 500); return () => window.clearTimeout(h) } }, [puzzle?.id, watchDemo]) // eslint-disable-line react-hooks/exhaustive-deps

  const choosePuzzle = (id: string) => {
    stop(); setPid(id); setMode('puzzles'); setRoutineRaw(emptyRoutine('Puzzle')); undo.current = []; setFocus(ROOT); setResult(null); setHintN(0); setMsg(''); setStepIdx(0)
  }
  const setBpm = (b: number) => setRoutine({ ...routine, bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, b)) }, true)
  const modeSwitch = (m: 'puzzles' | 'free') => {
    if (m === mode) return
    stop(); setMode(m); undo.current = []; setFocus(ROOT); setResult(null); setStepIdx(0); setMsg('')
    setRoutineRaw(m === 'free' ? cleanFreeDraft(kore.progress.load('draft', null)) : emptyRoutine('Puzzle'))
  }

  // ---- save + share (free mode)
  const saveDance = () => {
    const used = new Set<string>(); const walkL = (l: Node[]) => l.forEach((n) => { if (n.k === 'call') used.add(n.fn); else if (n.k === 'repeat') walkL(n.body); else { walkL(n.then); walkL(n.else) } })
    walkL(routine.nodes); routine.rules.forEach((q) => walkL(q.body))
    const fns = taught.filter((f) => used.has(f.id))
    const entry: SavedDance = { id: Date.now().toString(36), name: cleanName(routine.name, 'My dance'), routine, fns }
    const next = [entry, ...saved.filter((x) => x.name !== entry.name)].slice(0, 20)
    setSaved(next); kore.progress.save('saved', next); setMsg(`Saved "${entry.name}".`)
  }
  const loadDance = (d: SavedDance) => {
    const rt = adopt(d.routine, d.fns)
    if (!rt) { setMsg('Your move list is full.'); return }
    stop(); setRoutine(rt); setFocus(ROOT); setMsg(`Loaded "${d.name}".`)
  }
  const deleteDance = (id: string) => { const next = saved.filter((x) => x.id !== id); setSaved(next); kore.progress.save('saved', next) }
  const share = () => {
    const link = `${location.origin}${location.pathname}${ROUTE}?choreo=${encodeShare(routine, table)}`
    setShareLink(link)
    try { void navigator.clipboard?.writeText(link).then(() => setMsg('Link copied! Anyone who opens it gets this dance.'), () => setMsg('Copy the link below.')) } catch { setMsg('Copy the link below.') }
  }

  // ---- the editor tree
  const ctx = useMemo(() => ({
    routine, table, focus: focusEff, active: new Set(active.paths),
    setFocus, remove: (p: string) => { setRoutine(removeNode(routine, p)); setFocus(ROOT) },
    size: (p: string) => { const n = nodeAt(routine, p); if (n && n.k === 'call') setRoutine(setArg(routine, p, cycleArg(n.a))) },
    count: (p: string, d: number) => { const n = nodeAt(routine, p); if (n && n.k === 'repeat') setRoutine(setRepeatN(routine, p, n.n + d)) },
    cond: (p: string) => { const n = nodeAt(routine, p); if (n && n.k === 'if') setRoutine(setCond(routine, p, COND_KINDS[(COND_KINDS.indexOf(n.c) + 1) % COND_KINDS.length])) },
    ev: (i: number) => setRoutine(setRule(routine, i, EV_KINDS[(EV_KINDS.indexOf(routine.rules[i].ev) + 1) % EV_KINDS.length])),
  }), [routine, table, focusEff, active.paths, setRoutine])

  const cur = active.step
  const blocks = blockCount(routine)
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
  const code = useMemo(() => toKode(routine, table, drums), [routine, table, drums])

  return (
    <div className="kr-app">
      <header className="kr-head">
        <button className="btn-ghost kr-back" onClick={() => { stop(); kore.exit() }} aria-label="Back">←</button>
        <h1>🕺 {APP_NAME}</h1>
        <div className="kr-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'puzzles'} className={mode === 'puzzles' ? 'on' : ''} onClick={() => modeSwitch('puzzles')}>🧩 Puzzles</button>
          <button role="tab" aria-selected={mode === 'free'} className={mode === 'free' ? 'on' : ''} onClick={() => modeSwitch('free')}>🎨 Free</button>
        </div>
        <div className="kr-bpm" title="Tempo (beats per minute)">
          <button className="btn-ghost" onClick={() => setBpm(routine.bpm - 5)} aria-label="Slower">−</button>
          <span>{routine.bpm} <small>bpm</small></span>
          <button className="btn-ghost" onClick={() => setBpm(routine.bpm + 5)} aria-label="Faster">+</button>
        </div>
      </header>

      {incoming && (
        <div className="kr-banner" role="status">🔗 Someone shared a dance: <b>{incoming.routine.name}</b> ({blockCount(incoming.routine)} blocks).
          <button className="btn" onClick={openIncoming}>Open it</button><button className="btn-ghost" onClick={() => setIncoming(null)}>No thanks</button></div>
      )}

      <div className="kr-top">
        <section className="kr-stagebox">
          <DancerStage read={read} reduced={reduced} />
          <div className="kr-controls">
            <button className="btn kr-go" onClick={perform} aria-pressed={perf === 'run'}>{perf === 'run' ? '⏹ Stop' : '▶ Perform'}</button>
            <button className="btn-ghost" onClick={stepOnce} title="Run one move at a time, like a debugger">⏭ Step {plan.all.length ? `${Math.min(stepIdx + 1, plan.all.length)}/${plan.all.length}` : ''}</button>
            {puzzle?.demo && <button className="btn-ghost" onClick={watchDemo}>👀 Watch</button>}
            <button className="btn-ghost" onClick={undoLast} disabled={!undo.current.length} aria-label="Undo">↩ Undo</button>
            <button className="btn-ghost" onClick={() => { stop(); setRoutine(emptyRoutine(routine.name)); setFocus(ROOT) }}>🗑 Clear</button>
          </div>
          <p className="kr-debug" aria-live="polite">{cur ? <><b>{cur.react ? '⚡ ' : '▶ '}{moveDef(cur.move).emoji} {cur.why}</b><i> beat {cur.beat + 1}</i></> : msg || 'Press Perform, or Step to go one move at a time.'}</p>
          <p className="kr-drumrow" aria-hidden>{drumFlash ? `last drum: ${drumFlash}` : ''}</p>
        </section>

        <section className="kr-side">
          {puzzle ? (
            <>
              <div className="kr-pstrip" role="list">
                {PUZZLES.map((p) => (
                  <button key={p.id} role="listitem" className={`kr-pchip${p.id === puzzle.id ? ' on' : ''}${best[p.id] ? ' done' : ''}`} onClick={() => choosePuzzle(p.id)} aria-label={`Puzzle ${p.n}: ${p.title}${best[p.id] ? `, ${best[p.id].stars} stars` : ''}`}>
                    {p.n}{best[p.id] ? <small>{stars(best[p.id].stars)}</small> : null}
                  </button>
                ))}
              </div>
              <h2 className="kr-ptitle">{puzzle.emoji} {puzzle.n}. {puzzle.title} <span className="kr-tag">{puzzle.concept}</span></h2>
              <p>{puzzle.story}</p>
              <p className="kr-goal"><b>Goal:</b> {goalText(puzzle, table)}</p>
              <p className="kr-par">Blocks: <b className={blocks > puzzle.par ? 'over' : ''}>{blocks}</b> · par {puzzle.par}{puzzle.goal.maxBlocks ? ` · limit ${puzzle.goal.maxBlocks}` : ''}{best[puzzle.id] ? ` · best ${stars(best[puzzle.id].stars)}` : ''}</p>
              <div className="kr-row">
                <button className="btn" onClick={() => { markUsed(); autoCheck() }}>✅ Check</button>
                <button className="btn-ghost" onClick={() => setHintN((h) => Math.min(h + 1, puzzle.hints.length))}>💡 Hint</button>
                {puzzle.n < PUZZLES.length && result?.ok && <button className="btn" onClick={() => choosePuzzle(PUZZLES[puzzle.n].id)}>Next puzzle ▶</button>}
              </div>
              {hintN > 0 && <ul className="kr-hints">{puzzle.hints.slice(0, hintN).map((h, i) => <li key={i}>{h}</li>)}</ul>}
              {result && (result.ok
                ? <p className="kr-result ok" role="status">🎉 Solved! <b>{stars(result.stars)}</b> in {result.blocks} blocks{result.stars < 3 ? ` (par is ${puzzle.par}: can you get 3 stars?)` : ' (par!)'}</p>
                : <div className="kr-result" role="status"><b>Not yet.</b><ul>{result.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
            </>
          ) : (
            <>
              <h2 className="kr-ptitle">🎨 Free choreography</h2>
              <label className="kr-name">Name <input value={routine.name} maxLength={14} onChange={(e) => setRoutine({ ...routine, name: e.target.value }, true)} aria-label="Dance name" /></label>
              <div className="kr-row">
                <button className="btn" onClick={saveDance}>💾 Save</button>
                <button className="btn-ghost" onClick={share}>🔗 Share</button>
              </div>
              {shareLink && <input className="kr-link" readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />}
              <details open={saved.length > 0}><summary>📂 My dances ({saved.length})</summary>
                <ul className="kr-saved">{saved.map((d) => (
                  <li key={d.id}><button className="btn-ghost" onClick={() => loadDance(d)}>{d.name}</button><small>{blockCount(d.routine)} blocks</small><button className="kr-x" onClick={() => deleteDance(d.id)} aria-label={`Delete ${d.name}`}>✕</button></li>
                ))}</ul>
              </details>
              <p className="kr-dim">Shared links hold the dance itself. Nothing is sent to a server.</p>
            </>
          )}
        </section>
      </div>

      <section className="kr-moves">
        <h3>Moves <small>tap one, or play its tune{puzzle?.glow ? ' (the lit keys show you)' : ''}</small></h3>
        <div className="kr-chips">
          {fnList.map((f) => (
            <span key={f.id} className="kr-chipwrap">
              <button className={`kr-chip${f.builtin ? ' built' : ''}`} onClick={() => { addCall(f.id); preview(f) }} title={`${f.name}: play ${f.notes.length} notes`}>{f.emoji} {f.name}{f.builtin ? ' ★' : ''}</button>
              {/^u\d+$/.test(f.id) && <button className="kr-x" onClick={() => forget(f.id)} aria-label={`Forget ${f.name}`}>✕</button>}
            </span>
          ))}
          <button className="btn kr-teach" onClick={startTeach}>🎓 Teach him a move</button>
        </div>
        {teach.stage === 'listen' && (
          <div className="kr-teachbox" role="status"><b>🎹 Listening…</b> {teach.notes.length ? teach.notes.map((n, i) => <span key={i} className="kr-note">{n}</span>) : <i>play 2 to 6 notes (keys, pads or screen)</i>}
            <button className="btn" onClick={finishListen}>Done</button><button className="btn-ghost" onClick={() => setTeach({ stage: 'off' })}>Cancel</button></div>
        )}
        {teach.stage === 'pick' && (
          <div className="kr-teachbox">
            <b>What does this tune mean?</b>
            <div className="kr-pick">{MOVES.map((m) => <button key={m.id} className={teach.move === m.id ? 'on' : ''} onClick={() => pickMove(m.id)}>{m.emoji} {m.name}</button>)}</div>
            <label className="kr-name">Name <input value={teach.name} maxLength={14} onChange={(e) => setTeach({ ...teach, name: e.target.value })} aria-label="Move name" /></label>
            <button className="btn" disabled={!teach.move} onClick={saveTeach}>Save move</button><button className="btn-ghost" onClick={() => setTeach({ stage: 'off' })}>Cancel</button>
          </div>
        )}
      </section>

      <section className="kr-prog">
        <div className="kr-tools">
          <h3>Routine <small>{blocks} block{blocks === 1 ? '' : 's'}</small></h3>
          <button className="btn-ghost" onClick={() => doRepeat(2)} title="Wrap the last block in a repeat (or tap the pedal)">🔁 ×2</button>
          <button className="btn-ghost" onClick={() => doRepeat(3)}>×3</button>
          <button className="btn-ghost" onClick={() => doRepeat(4)}>×4</button>
          <button className="btn-ghost" onClick={newIf} title="If the last note was high, do one thing, else another">🔀 If / else</button>
          <button className="btn-ghost" onClick={newRule} title="When something happens, he reacts">⚡ When</button>
        </div>
        <div className="kr-lane" onClick={() => setFocus(ROOT)}>
          <ListView nodes={routine.nodes} parent="" part="" ctx={ctx} hint="Empty. Tap a move above." />
        </div>
        {routine.rules.length > 0 && (
          <div className="kr-rules">
            {routine.rules.map((rule, i) => (
              <div key={i} className={`kr-blk kr-rule${active.paths.includes(`r${i}`) ? ' kr-on' : ''}`}>
                <div className="kr-bh">⚡ when <button className="kr-pill" onClick={() => ctx.ev(i)}>{EV_LABEL[rule.ev]}</button> then
                  <button className="kr-x" onClick={() => ctx.remove(`r${i}`)} aria-label="Remove rule">✕</button></div>
                <ListView nodes={rule.body} parent={`r${i}`} part="" ctx={ctx} hint="Tap here, then a move." />
              </div>
            ))}
          </div>
        )}
        <Timeline plan={plan} playhead={playhead} active={cur} table={table} />
        <details className="kr-codebox" open><summary>Koog Kode text <small>(read-only)</small></summary><pre className="kr-code" aria-label="Routine as Koog Kode text">{code}</pre></details>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ editor pieces
interface Ctx {
  routine: Routine; table: FnTable; focus: ListRef; active: Set<string>
  setFocus: (r: ListRef) => void; remove: (p: string) => void; size: (p: string) => void; count: (p: string, d: number) => void; cond: (p: string) => void; ev: (i: number) => void
}
function ListView({ nodes, parent, part, ctx, hint }: { nodes: Node[]; parent: string; part: '' | 't' | 'e'; ctx: Ctx; hint: string }) {
  const ref: ListRef = { parent, part }
  const focused = sameRef(ref, ctx.focus)
  return (
    <div className={`kr-list${focused ? ' kr-focus' : ''}`} onClick={(e) => { e.stopPropagation(); ctx.setFocus(ref) }} data-list={parent || 'root'} data-part={part}>
      {nodes.map((n, i) => <BlockView key={i} n={n} path={childPath(parent, part, i)} ctx={ctx} />)}
      {nodes.length === 0 && <span className="kr-empty">{hint}</span>}
    </div>
  )
}
function BlockView({ n, path, ctx }: { n: Node; path: string; ctx: Ctx }) {
  const on = ctx.active.has(path)
  if (n.k === 'call') {
    const f = ctx.table[n.fn]
    const a = argOf(n.a)
    return (
      <div className={`kr-blk kr-call${on ? ' kr-on' : ''}`} data-path={path}>
        <span>{f?.emoji} {f?.name ?? '?'}</span>
        <button className="kr-pill kr-size" onClick={(e) => { e.stopPropagation(); ctx.size(path) }} aria-label={`Size ${a === 's' ? 'small' : a === 'l' ? 'big' : 'medium'}, tap to change`}>{a === 's' ? 'S' : a === 'l' ? 'L' : 'M'}</button>
        <button className="kr-x" onClick={(e) => { e.stopPropagation(); ctx.remove(path) }} aria-label="Remove block">✕</button>
      </div>
    )
  }
  if (n.k === 'repeat') {
    return (
      <div className={`kr-blk kr-rep${on ? ' kr-on' : ''}`} data-path={path}>
        <div className="kr-bh">🔁 repeat <button className="kr-pill" onClick={(e) => { e.stopPropagation(); ctx.count(path, -1) }} aria-label="Fewer">−</button><b>×{n.n}</b><button className="kr-pill" onClick={(e) => { e.stopPropagation(); ctx.count(path, 1) }} aria-label="More">+</button>
          <button className="kr-x" onClick={(e) => { e.stopPropagation(); ctx.remove(path) }} aria-label="Remove repeat">✕</button></div>
        <ListView nodes={n.body} parent={path} part="" ctx={ctx} hint="Tap here, then a move." />
      </div>
    )
  }
  return (
    <div className={`kr-blk kr-if${on ? ' kr-on' : ''}`} data-path={path}>
      <div className="kr-bh">🔀 if <button className="kr-pill" onClick={(e) => { e.stopPropagation(); ctx.cond(path) }}>{COND_LABEL[n.c]}</button>
        <button className="kr-x" onClick={(e) => { e.stopPropagation(); ctx.remove(path) }} aria-label="Remove if">✕</button></div>
      <div className="kr-branch"><span>then</span><ListView nodes={n.then} parent={path} part="t" ctx={ctx} hint="a move" /></div>
      <div className="kr-branch"><span>else</span><ListView nodes={n.else} parent={path} part="e" ctx={ctx} hint="a move" /></div>
    </div>
  )
}

/** the beat lane: the dance on top, the reactions under it, the drums, and a playhead that follows the beat */
function Timeline({ plan, playhead, active, table }: { plan: Plan; playhead: React.RefObject<HTMLDivElement | null>; active: Step | null; table: FnTable }) {
  const B = Math.max(plan.beats, 1)
  const pct = (b: number) => `${(b / B) * 100}%`
  return (
    <div className="kr-tl" aria-label="Timeline">
      <div className="kr-tl-row" aria-hidden>{Array.from({ length: Math.ceil(B) }, (_, b) => <i key={b} style={{ left: pct(b) }} className={b % 4 === 0 ? 'bar' : ''} />)}</div>
      <div className="kr-tl-row kr-tl-main">{plan.steps.map((s, i) => <span key={i} className={`kr-cell${active && active.path === s.path && active.beat === s.beat ? ' kr-on' : ''}`} style={{ left: pct(s.beat), width: pct(s.dur) }} title={s.why}>{table[s.fn]?.emoji}</span>)}</div>
      <div className="kr-tl-row kr-tl-react">{plan.reacts.map((s, i) => <span key={i} className={`kr-cell react${active && active.react && active.beat === s.beat ? ' kr-on' : ''}`} style={{ left: pct(s.beat), width: pct(s.dur) }} title={s.why}>⚡{table[s.fn]?.emoji}</span>)}</div>
      <div className="kr-tl-row kr-tl-drum" aria-hidden>{plan.events.filter((e) => e.kind !== 'note').map((e, i) => <em key={i} className={e.kind} style={{ left: pct(e.beat) }}>{e.kind === 'kick' ? 'K' : 'S'}</em>)}</div>
      <div className="kr-playhead" ref={playhead} aria-hidden />
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ loading saved data (always validated)
function cleanFreeDraft(raw: unknown): Routine {
  const ids = [...BUILTINS, ...PUZZLE_FNS].map((f) => f.id)
  const ok = cleanRoutine(raw, [...ids, ...Array.from({ length: 99 }, (_, i) => `u${i + 1}`)])
  return ok ?? emptyRoutine('My dance')
}
function loadSaved(raw: unknown): SavedDance[] {
  if (!Array.isArray(raw)) return []
  const out: SavedDance[] = []
  for (const x of raw.slice(0, 20)) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const fns = Array.isArray(o.fns) ? o.fns.map(cleanFn).filter((f): f is Fn => !!f).slice(0, MAX_TAUGHT) : []
    const rt = cleanRoutine(o.routine, [...[...BUILTINS, ...PUZZLE_FNS].map((f) => f.id), ...fns.map((f) => f.id)])
    if (rt && typeof o.id === 'string' && /^[a-z0-9]{1,12}$/.test(o.id)) out.push({ id: o.id, name: cleanName(o.name, rt.name), routine: rt, fns })
  }
  return out
}
