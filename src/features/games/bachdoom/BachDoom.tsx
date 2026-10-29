import { useEffect, useReducer, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { onJudge } from '../../../music/judge'
import { clearGuide } from '../../../music/guide'
import { DIFFS, Game } from './game'
import type { Diff } from './game'
import { EPISODES, LEVELS, episodeOf } from './levels'
import { View } from './render'
import { Painter } from './hud'
import { SceneList } from './scene'
import { buildTextures } from './textures'
import { buildSprites } from './sprites'
import { buildFaces, buildGun } from './gunface'
import './bachdoom.css'

/** BachDoom: a rail shooter where the weapon is a piano. See docs in this folder's modules. */
export function BachDoom({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [sel, setSel] = useState<number | null>(null)
  const [epSel, setEpSel] = useState<1 | 2 | null>(null)
  const [diffSel, setDiffSel] = useState<Diff | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const cv = canvas.current!, box = host.current!
    const ctx = cv.getContext('2d', { alpha: false })!
    let game: Game, view: View, painter: Painter, scene: SceneList, tex: ReturnType<typeof buildTextures>
    try {
      game = new Game()
      tex = buildTextures()
      painter = new Painter({ sprites: buildSprites(), faces: buildFaces(), gun: buildGun() })
      view = new View(); scene = new SceneList()
    } catch (e) { console.error(e); setErr(String(e)); return }
    gameRef.current = game
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMq = () => { game.reduced = mq.matches }
    syncMq(); mq.addEventListener('change', syncMq)
    const unsub = game.subscribe(redraw)
    redraw()
    const unJudge = onJudge((e) => game.onJudge(e))

    let W = 2, H = 2, hudH = 2
    const resize = () => {
      const r = box.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr))
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
      hudH = Math.max(Math.round(54 * dpr), Math.min(Math.round(96 * dpr), Math.round(H * 0.2)))
      const viewH = H - hudH
      const iw = Math.max(240, Math.min(420, Math.round(r.width / 2.9)))
      view.resize(iw, Math.max(40, Math.round((viewH * iw) / W)))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const perf = { frames: 0, t0: performance.now(), ms: 0, worst: 0, fps: 0, avg: 0 }
    let raf = 0, last = performance.now(), mapRef: unknown = null
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = (now - last) / 1000
      last = now
      const w0 = performance.now()
      game.update(dt)
      if (mapRef !== game.map) { mapRef = game.map; view.setLevel(game.map, tex) }
      const bob = game.reduced || game.mode !== 'glide' ? 0 : Math.sin(game.bobT) * view.ih * 0.012
      scene.build(game, painter.sprites)
      view.render(game.camX, game.camY, game.camAng, bob, scene.list, scene.n)
      painter.draw(game, view, ctx, W, H, hudH, dt)
      const w1 = performance.now() - w0
      perf.ms += w1; perf.worst = Math.max(perf.worst, w1); perf.frames++
      if (now - perf.t0 >= 1000) { perf.fps = (perf.frames * 1000) / (now - perf.t0); perf.avg = perf.ms / Math.max(1, perf.frames); perf.t0 = now; perf.frames = 0; perf.ms = 0 }
    }
    raf = requestAnimationFrame(frame)

    const hook = {
      game,
      jump: (n: number, diff?: Diff) => game.start(n - 1, diff ?? game.diff),
      perf: () => { const o = { fps: Math.round(perf.fps * 10) / 10, avgMs: Math.round(perf.avg * 100) / 100, worstMs: Math.round(perf.worst * 100) / 100, iw: view.iw, ih: view.ih, W, H }; perf.worst = 0; return o },
    }
    ;(window as unknown as { __bachdoom?: unknown }).__bachdoom = hook

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mq.removeEventListener('change', syncMq)
      unsub(); unJudge()
      game.dispose()
      clearGuide()
      gameRef.current = null
      const w = window as unknown as { __bachdoom?: unknown }
      if (w.__bachdoom === hook) delete w.__bachdoom
    }
  }, [])

  const game = gameRef.current
  const phase = game?.phase ?? 'title'
  const save = game?.save
  const unlocked = save?.unlocked ?? 1
  const level = sel ?? Math.min(LEVELS.length - 1, unlocked - 1)
  const ep = epSel ?? episodeOf(LEVELS[level])
  const diff = diffSel ?? game?.diff ?? 'normal'
  // a click should never leave a focused button behind: the computer keyboard plays notes, and Space/Enter would press it
  const act = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.blur(); fn() }

  return (
    <div className="bd-root" ref={host}>
      <canvas ref={canvas} className="bd-canvas" />
      {err && <div className="bd-err">BachDoom could not start: {err}</div>}
      {phase !== 'title' && <button className="bd-top bd-menu" onClick={act(() => game?.toTitle())}>◀ Menu</button>}
      <button className="bd-top bd-back" onClick={act(onExit)}>Back</button>

      {phase === 'title' && game && (
        <div className="bd-title">
          <div className="bd-diffs">
            {DIFFS.map((d) => (
              <button key={d.id} className={'bd-btn bd-diff' + (diff === d.id ? ' on' : '')} onClick={act(() => setDiffSel(d.id))}>
                <b>{d.name}</b><small>{d.sub}</small>
              </button>
            ))}
          </div>
          <div className="bd-diffs bd-eps" role="group" aria-label="Episode">
            {EPISODES.map((e) => {
              const first = LEVELS.findIndex((l) => episodeOf(l) === e.n)
              const locked = first < 0 || first >= unlocked
              return (
                <button key={e.n} disabled={locked} className={'bd-btn bd-diff' + (ep === e.n ? ' on' : '')}
                  onClick={act(() => { setEpSel(e.n); setSel(LEVELS.reduce((best, l, i) => (episodeOf(l) === e.n && i < unlocked ? i : best), first)) })}>
                  <b>{locked ? '🔒 ' : ''}{e.name}</b>{locked && e.n === 2 && <small>Beat Episode 1 to unlock</small>}
                </button>
              )
            })}
          </div>
          <div className="bd-levels">
            {LEVELS.map((l, i) => (episodeOf(l) === ep ? [l, i] as const : null)).filter((x): x is readonly [typeof LEVELS[number], number] => !!x).map(([l, i]) => {
              const best = save?.best[l.id]
              const locked = i >= unlocked
              return (
                <button key={l.id} disabled={locked} className={'bd-btn bd-lvl' + (level === i ? ' on' : '') + ((l.boss || l.finale) ? ' boss' : '')} onClick={act(() => setSel(i))} title={l.name}>
                  <b>{locked ? '🔒' : ''} {l.id}</b>
                  <small>{l.boss || l.finale ? 'BOSS' : l.name}</small>
                  <span className="bd-stars">{[0, 1, 2].map((k) => <i key={k} className={best && best.stars > k ? 'on' : ''}>★</i>)}</span>
                </button>
              )
            })}
          </div>
          <button className="bd-btn bd-start" onClick={act(() => game.start(level, diff))}>▶ Start {LEVELS[level].id}: {LEVELS[level].name}</button>
          <p className="bd-fine">A fan-made parody. Not affiliated with id Software.</p>
        </div>
      )}
      {phase === 'tally' && game && (
        <div className="bd-actions">
          <button className="bd-btn bd-start" onClick={act(() => game.next())}>Next level ▶</button>
          <button className="bd-btn" onClick={act(() => game.retry())}>Replay</button>
        </div>
      )}
      {phase === 'win' && game && (
        <div className="bd-actions">
          <button className="bd-btn bd-start" onClick={act(() => game.toTitle())}>Back to the title</button>
          <button className="bd-btn" onClick={act(() => game.retry())}>Fight again</button>
        </div>
      )}
      {phase === 'lose' && game && (
        <div className="bd-actions">
          <button className="bd-btn bd-start" onClick={act(() => game.retry())}>Try again</button>
          <button className="bd-btn" onClick={act(() => game.toTitle())}>Menu</button>
        </div>
      )}
    </div>
  )
}
