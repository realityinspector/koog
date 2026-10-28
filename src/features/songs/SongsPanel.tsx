import { useCallback, useEffect, useRef, useState } from 'react'
import { onNote } from '../../music/notes'
import { useHarmonyStore } from '../../music/harmonyStore'
import { noteName, pc as pcOf, keyName } from '../../music/theory'
import { SONGS, TIER_LABEL, type Song, type Tier } from './songs'
import { MySongs } from './MySongs'
import { loadMine, saveMine } from './recording'
import { pload, psave } from '../../profile/profile'
import { celebrate } from '../celebrate/celebrate'
import { startBacking, stopBacking } from '../beats/engine'
import './songs.css'

type Mode = 'wait' | 'flow'
type Phase = 'ready' | 'playing' | 'listening' | 'done'
interface N { midi: number; start: number; beats: number; st: 0 | 1 | 2; hitAt: number }
interface Result { score: number; acc: number; stars: number; hits: number; total: number; best: boolean }

const PPB = 60 // pixels per beat
const LEAD = 2 // lead-in beats in flow mode
const BEST_KEY = 'songs.best.v1' // saved per kid
const BEAT_KEY = 'koog.songs.beat'
const GROOVE_FOR: Record<string, string> = {
  'pop-static': 'rock', 'pop-funk': 'funk', 'pop-edm': 'sprint', 'pop-lofi': 'lofi', 'pop-boss': 'rock',
  'pop-dance': 'disco', 'pop-spooky': 'boombap', 'pop-hyper': 'sprint',
}
function loadBeat(): Record<string, boolean> {
  try { const v = JSON.parse(localStorage.getItem(BEAT_KEY) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
const hueOf = (m: number) => ((pcOf(m) * 7) % 12) * 30
const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(pcOf(m))

function loadBest(): Record<string, { score: number; acc: number }> {
  return pload(BEST_KEY, {})
}
function saveBest(b: Record<string, { score: number; acc: number }>) {
  psave(BEST_KEY, b)
}

function buildNotes(song: Song): N[] {
  const out: N[] = []
  let t = 0
  for (const n of song.notes) {
    if (n.note != null) out.push({ midi: n.note, start: t, beats: n.beats, st: 0, hitAt: 0 })
    t += n.beats
  }
  return out
}

interface Game {
  songId: string
  notes: N[]; idx: number; cursor: number; startMs: number; last: number
  wrong: number; firstTry: number; hits: number; score: number; combo: number
  pressed: Set<number>; phase: Phase; doneAt: number; endBeat: number
}
function newGame(song: Song): Game {
  const notes = buildNotes(song)
  const lastN = notes[notes.length - 1]
  return { songId: song.id, notes, idx: 0, cursor: notes[0].start - 1.5, startMs: 0, last: 0, wrong: 0, firstTry: 0, hits: 0, score: 0, combo: 0,
    pressed: new Set(), phase: 'ready', doneAt: 0, endBeat: lastN.start + lastN.beats }
}

function layout(song: Song, W: number, CH: number, KH: number) {
  const ms = song.notes.filter((n) => n.note != null).map((n) => n.note as number)
  let lo = Math.min(...ms), hi = Math.max(...ms)
  while (isBlack(lo)) lo--
  while (isBlack(hi)) hi++
  lo = Math.max(48, lo - 1); while (isBlack(lo)) lo--
  hi = Math.min(84, hi + 1); while (isBlack(hi)) hi++
  const whites: number[] = []
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m)
  const ww = W / whites.length
  const bw = ww * 0.6
  const xOf = (m: number) => {
    if (!isBlack(m)) return whites.indexOf(m) * ww
    return (whites.indexOf(m - 1) + 1) * ww - bw / 2
  }
  const wOf = (m: number) => (isBlack(m) ? bw : ww)
  return { lo, hi, whites, ww, bw, xOf, wOf, ch: CH, kh: KH }
}

export function SongsPanel() {
  const [songId, setSongId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('wait')
  const [speed, setSpeed] = useState(0.8)
  const [names, setNames] = useState(true)
  const [phase, setPhase] = useState<Phase>('ready')
  const [ui, setUi] = useState({ score: 0, combo: 0, hits: 0, msg: '' })
  const [result, setResult] = useState<Result | null>(null)
  const [bests, setBests] = useState(loadBest)
  const [mine, setMineState] = useState<Song[]>(loadMine)
  const setMine = (l: Song[]) => { setMineState(l); saveMine(l) }
  const song = mine.find((s) => s.id === songId) ?? SONGS.find((s) => s.id === songId) ?? null

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const g = useRef<Game | null>(null)
  const opt = useRef({ mode, speed, names })
  opt.current = { mode, speed, names }
  const audio = useRef<AudioContext | null>(null)
  const [beatPref, setBeatPref] = useState(loadBeat)
  const beatOn = song ? (beatPref[song.tier] ?? song.tier === 'pop') : false
  const setBeat = (on: boolean) => {
    if (!song) return
    const n = { ...beatPref, [song.tier]: on }
    setBeatPref(n)
    try { localStorage.setItem(BEAT_KEY, JSON.stringify(n)) } catch { /* ignore */ }
  }
  const beatOnRef = useRef(beatOn)
  beatOnRef.current = beatOn
  const beatActive = mode === 'flow' && beatOn
  useEffect(() => { if (!beatActive) stopBacking() }, [beatActive])
  useEffect(() => () => stopBacking(), [])
  const prevKey = useRef<ReturnType<typeof useHarmonyStore.getState>['key'] | null>(null)

  const stopAudio = useCallback(() => {
    stopBacking()
    try { audio.current?.close() } catch { /* ignore */ }
    audio.current = null
  }, [])

  const reset = useCallback(() => {
    stopAudio()
    if (!song) return
    g.current = newGame(song)
    setPhase('ready'); setResult(null); setUi({ score: 0, combo: 0, hits: 0, msg: '' })
  }, [song, stopAudio])

  // select song: set shared key, restore on change/unmount
  useEffect(() => {
    if (!song) return
    const st = useHarmonyStore.getState()
    if (!prevKey.current) prevKey.current = st.key
    st.setKey(song.key)
    if (g.current?.songId !== song.id) reset()
    return () => stopAudio()
  }, [song, reset, stopAudio])
  useEffect(() => () => {
    if (prevKey.current) useHarmonyStore.getState().setKey(prevKey.current)
    prevKey.current = null
  }, [])
  useEffect(() => { if (!song && prevKey.current) { useHarmonyStore.getState().setKey(prevKey.current); prevKey.current = null } }, [song])

  const finish = useCallback((game: Game) => {
    if (!song) return
    game.phase = 'done'
    stopBacking()
    const total = game.notes.length
    const acc = opt.current.mode === 'wait' ? game.firstTry / total : game.hits / total
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1
    const k = song.id + ':' + opt.current.mode
    const b = loadBest()
    const prev = b[k]
    const isBest = !prev || game.score > prev.score
    if (isBest) { b[k] = { score: game.score, acc }; saveBest(b); setBests(b) }
    if (isBest && prev) celebrate({ kind: 'best', title: 'New personal best: ' + song.title, emoji: '⭐' })
    setResult({ score: game.score, acc, stars, hits: game.hits, total, best: isBest && !!prev })
    setPhase('done')
  }, [song])

  const start = useCallback(() => {
    if (!song) return
    const game = newGame(song)
    game.phase = 'playing'
    game.startMs = performance.now()
    if (opt.current.mode === 'flow') game.cursor = -LEAD
    g.current = game
    stopAudio(); setResult(null); setPhase('playing'); setUi({ score: 0, combo: 0, hits: 0, msg: '' })
    if (opt.current.mode === 'flow' && beatOnRef.current) {
      // beat 0 of the song = startMs + LEAD beats at the effective tempo (same clock as the falling notes)
      const eff = opt.current.speed * song.bpm
      const beatMs = 60000 / eff
      const lastN = game.notes[game.notes.length - 1]
      startBacking({ bpm: eff, grooveId: GROOVE_FOR[song.id] ?? 'pop', startAtMs: game.startMs, leadBeats: LEAD,
        endAtMs: game.startMs + (LEAD + lastN.start + lastN.beats + 1) * beatMs })
    }
  }, [song, stopAudio])

  const listen = useCallback(() => {
    if (!song) return
    stopAudio()
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx() // created after a click
    audio.current = ctx
    const master = ctx.createGain(); master.gain.value = 0.1; master.connect(ctx.destination)
    const spb = 60 / song.bpm
    const t0 = ctx.currentTime + 0.15 + spb
    let t = 0
    for (const n of song.notes) {
      if (n.note != null) {
        const o = ctx.createOscillator(); const e = ctx.createGain()
        o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (n.note - 69) / 12)
        const s = t0 + t * spb, d = n.beats * spb
        e.gain.setValueAtTime(0.0001, s); e.gain.exponentialRampToValueAtTime(0.9, s + 0.02)
        e.gain.exponentialRampToValueAtTime(0.0001, s + Math.max(0.1, d * 0.95))
        o.connect(e); e.connect(master); o.start(s); o.stop(s + d + 0.05)
      }
      t += n.beats
    }
    const game = newGame(song)
    game.phase = 'listening'; game.startMs = performance.now(); game.cursor = -1
    g.current = game
    setResult(null); setPhase('listening')
  }, [song, stopAudio])

  // note input
  useEffect(() => {
    if (!song) return
    return onNote((e) => {
      const game = g.current
      if (!game) return
      if (e.on) game.pressed.add(e.note); else game.pressed.delete(e.note)
      if (!e.on || game.phase !== 'playing') return
      const o = opt.current
      if (o.mode === 'wait') {
        const n = game.notes[game.idx]
        if (!n) return
        if (e.note === n.midi) {
          const pts = game.wrong === 0 ? 100 : game.wrong < 2 ? 60 : 30
          if (game.wrong === 0) game.firstTry++
          game.score += pts + Math.min(game.combo, 10) * 2
          game.combo = game.wrong === 0 ? game.combo + 1 : 0
          game.hits++; n.st = 1; n.hitAt = performance.now(); game.idx++; game.wrong = 0
          setUi({ score: game.score, combo: game.combo, hits: game.hits, msg: game.combo >= 5 ? 'On a roll.' : '' })
        } else {
          game.wrong++; game.combo = 0
          const sameClass = pcOf(e.note) === pcOf(n.midi)
          setUi((u) => ({ ...u, combo: 0, msg: sameClass ? 'Right note, different octave. Look for the glowing key.'
            : game.wrong >= 2 ? 'Hint: the glowing key is the one.' : 'Not quite, no rush.' }))
        }
      } else {
        const win = (250 * o.speed * song.bpm) / 60000
        let best: N | null = null
        for (const n of game.notes) {
          if (n.st === 0 && n.midi === e.note && Math.abs(n.start - game.cursor) <= win && (!best || Math.abs(n.start - game.cursor) < Math.abs(best.start - game.cursor))) best = n
        }
        if (best) {
          const errMs = Math.abs(best.start - game.cursor) * 60000 / (o.speed * song.bpm)
          const perfect = errMs < 100
          best.st = 1; best.hitAt = performance.now(); game.hits++; game.combo++
          game.score += (perfect ? 100 : 70) + Math.min(game.combo, 10) * 2
          setUi({ score: game.score, combo: game.combo, hits: game.hits, msg: perfect ? 'Right on the beat.' : '' })
        } else {
          setUi((u) => ({ ...u, msg: 'Extra note, keep the groove.' }))
        }
      }
    })
  }, [song])

  // render loop
  useEffect(() => {
    if (!song) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    let raf = 0
    let lay = layout(song, 600, 230, 64), W = 600, dpr = 1
    const resize = () => {
      W = cv.clientWidth || 600; dpr = window.devicePixelRatio || 1
      const H = Math.max(140, cv.clientHeight || 294)
      const KH = Math.max(44, Math.min(96, Math.round(H * 0.24)))
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      lay = layout(song, W, H - KH, KH)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const game = g.current
      if (!game) return
      const dt = Math.min(0.1, (now - (game.last || now)) / 1000); game.last = now
      const o = opt.current
      if (game.phase === 'playing') {
        if (o.mode === 'wait') {
          const target = game.notes[game.idx]
          if (target) game.cursor += (target.start - game.cursor) * Math.min(1, dt * 7)
          else if (!game.doneAt) { game.doneAt = now } else if (now - game.doneAt > 700) finish(game)
        } else {
          game.cursor = ((now - game.startMs) * o.speed * song.bpm) / 60000 - LEAD
          const win = (250 * o.speed * song.bpm) / 60000
          for (const n of game.notes) if (n.st === 0 && n.start + win < game.cursor) { n.st = 2; game.combo = 0 }
          if (game.cursor > game.endBeat + 0.5) finish(game)
        }
      } else if (game.phase === 'listening') {
        game.cursor = ((now - game.startMs) * song.bpm) / 60000 - 1
        if (game.cursor > game.endBeat + 0.5) { game.phase = 'ready'; game.cursor = game.notes[0].start - 1.5; setPhase('ready') }
      }
      draw(ctx, game, lay, W, dpr, song, o)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [song, finish])

  const bestFor = (id: string) => {
    const b = bests[id + ':wait']; const f = bests[id + ':flow']
    const m = Math.max(b?.score ?? 0, f?.score ?? 0)
    return m ? m : 0
  }
  const curBest = song ? bests[song.id + ':' + mode] : undefined
  const [tab, setTab] = useState<'pop' | 'bang' | 'warm'>('pop')
  const rows: { id: 'pop' | 'bang' | 'warm'; label: string; tabLabel: string; tiers: Tier[] }[] = [
    { id: 'pop', label: TIER_LABEL.pop, tabLabel: '🎧 Originals', tiers: ['pop'] },
    { id: 'bang', label: '🔥 ' + TIER_LABEL.bang, tabLabel: '🔥 Bangers', tiers: ['bang'] },
    { id: 'warm', label: 'Warm-ups', tabLabel: 'Warm-ups', tiers: ['easy', 'medium', 'flex'] },
  ]
  const liveAcc = g.current && mode === 'wait' && ui.hits > 0 ? Math.round((g.current.firstTry / ui.hits) * 100) : null
  const total = song ? song.notes.filter((n) => n.note != null).length : 0

  return (
    <section className="sg">
      {song ? (
        <div className="play">
          <div className="bar">
            <button className="btn-ghost" onClick={() => setSongId(null)}>← All songs</button>
            <span className="seg">
              <button className={mode === 'wait' ? 'on' : ''} onClick={() => setMode('wait')}>Wait</button>
              <button className={mode === 'flow' ? 'on' : ''} onClick={() => setMode('flow')}>Flow</button>
            </span>
            {mode === 'flow' && (
              <label>Speed
                <input type="range" min={50} max={100} step={5} value={Math.round(speed * 100)} disabled={phase === 'playing'}
                  onChange={(e) => setSpeed(+e.target.value / 100)} /> {Math.round(speed * 100)}%
              </label>
            )}
            {mode === 'flow' && (
              <button className={'btn-ghost' + (beatOn ? ' on' : '')} aria-pressed={beatOn} onClick={() => setBeat(!beatOn)}>🥁 Backing beat: {beatOn ? 'on' : 'off'}</button>
            )}
            <label><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> Names</label>
            <span className="grow" />
            <button className="btn-ghost" onClick={phase === 'listening' ? reset : listen}>{phase === 'listening' ? 'Stop' : 'Listen first'}</button>
            <button className="btn" onClick={start}>{phase === 'playing' ? 'Restart' : 'Play'}</button>
          </div>
          <div className="stage">
            <canvas ref={canvasRef} />
            <div className="ov">
              <span className="pill ttl"><b>{song.title}</b> · {keyName(song.key)} · {song.bpm} bpm</span>
              <span className="pill stats">
                Score <b>{ui.score}</b> · Streak <b>{ui.combo}</b> · <b>{ui.hits}/{total}</b>
                {liveAcc != null && <> · Acc <b>{liveAcc}%</b></>}
                {curBest && <> · Best <b>{curBest.score}</b> ({Math.round(curBest.acc * 100)}%)</>}
              </span>
            </div>
            {(phase === 'ready' || ui.msg) && !result && (
              <div className="hint"><span className="pill">{phase === 'ready' ? (mode === 'wait' ? 'Press Play. The song waits for you.' : 'Press Play. Count-in, then follow the beat.') : ui.msg}</span></div>
            )}
            {result && (
              <div className="card">
                <div className="stars">{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>
                <div className="big">{result.stars === 3 ? 'Absolutely cooked that.' : result.stars === 2 ? 'Smooth. Run it back?' : 'Song complete. Round two hits different.'}</div>
                <div>Score <b>{result.score}</b> · Accuracy <b>{Math.round(result.acc * 100)}%</b> · <span className="gold">{result.best ? 'New personal best!' : curBest ? `Best ${curBest.score}` : 'First score on the board.'}</span></div>
                <div className="bar c">
                  <button className="btn" onClick={start}>Again</button>
                  <button className="btn-ghost" onClick={() => setSongId(null)}>Pick another</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="browse">
          <div className="tabs">
            {rows.map((r) => (
              <button key={r.id} className={'tab t-' + r.id + (tab === r.id ? ' on' : '')} aria-pressed={tab === r.id} onClick={() => setTab(r.id)}>{r.tabLabel}</button>
            ))}
            <span className="grow" />
            <MySongs mine={mine} setMine={setMine} onPick={setSongId} />
          </div>
          {rows.map((r) => (
            <div key={r.id} className={'row' + (tab === r.id ? ' on' : '')}>
              <div className="rl">{r.label}</div>
              <div className="car">
                {SONGS.filter((s) => r.tiers.includes(s.tier)).map((s) => (
                  <button key={s.id} className={'card-s t-' + s.tier} onClick={() => setSongId(s.id)}>
                    <b>{s.title}</b>
                    <span className="hk">{s.hook}</span>
                    {bestFor(s.id) ? <span className="pb">★ {bestFor(s.id)}</span> : <span className="pb none">★ —</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function draw(ctx: CanvasRenderingContext2D, game: Game, lay: ReturnType<typeof layout>, W: number, dpr: number, song: Song, o: { mode: Mode; names: boolean }) {
  const CH = lay.ch, KH = lay.kh
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, CH + KH)
  ctx.fillStyle = '#15161a'; ctx.fillRect(0, 0, W, CH + KH)
  // lane guides
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
  for (let i = 1; i < lay.whites.length; i++) { ctx.beginPath(); ctx.moveTo(i * lay.ww, 0); ctx.lineTo(i * lay.ww, CH); ctx.stroke() }
  // targets: wait = current note; flow = notes inside hit window
  const targets = new Set<number>()
  const cur = game.notes[game.idx]
  if (game.phase === 'playing' && o.mode === 'wait' && cur) targets.add(cur.midi)
  if (game.phase === 'playing' && o.mode === 'flow') for (const n of game.notes) if (n.st === 0 && Math.abs(n.start - game.cursor) < 0.5) targets.add(n.midi)
  if (game.phase === 'ready' && cur) targets.add(cur.midi)
  if (game.phase === 'listening') for (const n of game.notes) if (game.cursor >= n.start && game.cursor < n.start + n.beats) targets.add(n.midi)
  const hint = game.phase === 'playing' && o.mode === 'wait' && game.wrong >= 2 && cur ? cur.midi : -1
  const t = performance.now()

  // falling notes
  ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (const n of game.notes) {
    const bottom = CH - (n.start - game.cursor) * PPB
    const h = Math.max(16, n.beats * PPB - 4)
    const top = bottom - h
    if (bottom < -4 || top > CH) continue
    if (n.st === 1 && game.phase === 'playing' && t - n.hitAt > 350) continue
    const x = lay.xOf(n.midi) + 1, w = lay.wOf(n.midi) - 2
    const hue = hueOf(n.midi)
    let alpha = n.st === 2 ? 0.25 : 1
    if (n.st === 1) alpha = Math.max(0, 1 - (t - n.hitAt) / 350)
    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsl(${hue} 80% ${n.st === 1 ? 75 : 58}%)`
    ctx.beginPath(); ctx.roundRect(x, Math.max(-4, top), w, h, 5); ctx.fill()
    if (o.names && w > 14) {
      ctx.fillStyle = 'rgba(10,10,20,0.85)'
      ctx.fillText(noteName(n.midi).replace(/\d/, ''), x + w / 2, Math.min(bottom - 9, CH - 9))
    }
    ctx.globalAlpha = 1
  }
  // hit line
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, CH - 1, W, 2)

  // count-in
  if (game.phase === 'playing' && o.mode === 'flow' && game.cursor < 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '700 40px system-ui'
    ctx.fillText(String(Math.ceil(-game.cursor)), W / 2, CH / 2)
  }

  // keyboard
  const y0 = CH
  for (const m of lay.whites) {
    const x = lay.xOf(m)
    const on = targets.has(m), pr = game.pressed.has(m)
    ctx.fillStyle = on ? `hsl(${hueOf(m)} 80% 62%)` : pr ? '#cfd0dc' : '#f1f1f6'
    if (m === hint) { const k = 0.5 + 0.5 * Math.sin(t / 250); ctx.fillStyle = `hsl(${hueOf(m)} 85% ${60 + k * 12}%)` }
    ctx.fillRect(x + 0.5, y0, lay.ww - 1, KH)
    if (o.names) { ctx.fillStyle = on ? '#10101a' : '#6a6b7a'; ctx.font = '600 10px system-ui'; ctx.fillText(noteName(m), x + lay.ww / 2, y0 + KH - 9) }
  }
  for (let m = lay.lo; m <= lay.hi; m++) {
    if (!isBlack(m)) continue
    const x = lay.xOf(m), on = targets.has(m), pr = game.pressed.has(m)
    ctx.fillStyle = on ? `hsl(${hueOf(m)} 80% 55%)` : pr ? '#5a5b6a' : '#1a1a22'
    if (m === hint) ctx.fillStyle = `hsl(${hueOf(m)} 85% ${50 + 10 * Math.sin(t / 250)}%)`
    ctx.fillRect(x, y0, lay.bw, KH * 0.62)
  }
  void song
}
