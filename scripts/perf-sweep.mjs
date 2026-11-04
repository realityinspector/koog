// Performance sweep: drives every major Koog state with a steady note stream and writes a table of frame, event-loop, input->sound and audio numbers.
// Same approach as scripts/screenshot.mjs: headless Chrome, muted, a throwaway profile (a kid's saved progress is never touched). Needs the dev server (default http://localhost:5173/).
// Usage: node scripts/perf-sweep.mjs [--quick] [--only=regex] [--secs=5] [--attempts=3]      (npm run check:perf)
// Env:   PERF_URL, PERF_OUT (markdown file), CHROME (browser path), PERF_TOTAL_MIN (hard cap on the whole run, default 25)
// Exit:  0 = every state within the hard limits; 1 = a state is far over budget in its BEST attempt; 2 = could not run (server down, browser failed).
// Hard limits leave headroom for headless Chrome on a busy laptop. Budgets (the real targets) only produce an OVER flag. The monitor itself lives in src/features/perfmon/.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir, loadavg, cpus } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d }
const QUICK = process.argv.includes('--quick')
const SECS = Number(arg('secs', 5)), ATTEMPTS = Math.max(1, Number(arg('attempts', 3))), ONLY = arg('only', '') ? new RegExp(arg('only', ''), 'i') : null
const BASE = (process.env.PERF_URL || 'http://localhost:5173/').replace(/#.*$/, '')
const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.PERF_OUT || path.join(here, 'shots', 'perf', 'SWEEP.md')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BUDGET = { frame: 20, input: 10, lag: 15, glitch: 0 }
const HARD = { frame: 50, input: 30, lag: 80, glitch: 5 } // headless + loaded laptop headroom
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- states ----------
const SCENES = ['fireworks', 'ripples', 'rise', 'fire', 'ghost', 'mail', 'confetti', 'zombie', 'vibes', 'dancer']
const GAMES = ['zombies', 'jiujitsu', 'fashion', 'memory', 'feast', 'tree', 'bachdoom']
const EMUS = ['airhands', 'ribbon', 'wheelhouse', 'tapechoir', 'ladder', 'patchbay', 'squelch', 'five', 'shimmer', 'bellfm']
const imp = (p) => `await import('${p}')`
const DOCK = {
  looper: `(${imp('/src/features/loopstation/LoopsDock.tsx')}).setLoopsDock(true)`,
  drums: `(${imp('/src/features/loopstation/loopSurface.ts')}).setControllerPage('drums')`,
  dj: `(${imp('/src/features/dj/duoOpen.ts')}).useDuoOpen.getState().setOpen(true); (${imp('/src/features/dj/engine.ts')}).ensure?.()`,
  board: `(${imp('/src/features/pedalboard/boardOpen.ts')}).setBoardOpen(true)`,
  mentor: `(${imp('/src/features/mentor/mentorStore.ts')}).useMentor.getState().setOn(true)`,
  band: `(${imp('/src/features/smartband/engine.ts')}).start()`,
  mimic: `await (${imp('/src/features/mimic/engine.ts')}).setOn(true)`,
}
const RESET = `(async()=>{ try{ (${imp('/src/features/loopstation/LoopsDock.tsx')}).setLoopsDock(false); (${imp('/src/features/loopstation/loopSurface.ts')}).setControllerPage('dj');
 (${imp('/src/features/dj/duoOpen.ts')}).useDuoOpen.getState().setOpen(false); (${imp('/src/features/pedalboard/boardOpen.ts')}).setBoardOpen(false);
 (${imp('/src/features/mentor/mentorStore.ts')}).useMentor.getState().setOn(false); (${imp('/src/features/smartband/engine.ts')}).panic(); (${imp('/src/features/mimic/engine.ts')}).panic?.(); await (${imp('/src/features/mimic/engine.ts')}).setOn(false)
 }catch(e){ return 'reset: '+e.message } return 'ok' })()`
const mk = (name, hash, expect, setup = [], boss = false) => ({ name, hash, expect, setup, boss })
let states = [
  mk('play (default scene)', '#/play', 'play'),
  ...SCENES.map((s) => mk('play scene ' + s, `#/play?visual=${s}`, 'scene:' + s)),
  mk('songs', '#/songs', 'songs'), mk('challenges', '#/challenges', 'challenges'), mk('games list', '#/games', 'games'),
  ...GAMES.map((g) => mk('game ' + g, `#/games/${g}`, 'games/' + g)),
  mk('beats', '#/beats', 'beats'), mk('beat disco', '#/beats/disco', 'beats'), mk('synth rack', '#/synth', 'synth'),
  ...EMUS.map((e) => mk('synth ' + e, `#/synth/${e}`, 'synth/' + e)),
  mk('log', '#/log', 'log'), mk('gallery (title card over the last screen)', '#/gallery', ''),
  mk('play + looper', '#/play', 'looper', ['looper']), mk('play + drum pads', '#/play', 'drums', ['drums']), mk('play + DJ strip', '#/play', 'dj-strip', ['dj']), mk('play + pedalboard', '#/play', 'pedalboard', ['board']),
  mk('play + mentor', '#/play', 'mentor', ['mentor']), mk('play + band', '#/play', 'band', ['band']), mk('play + mimic', '#/play', 'mimic', ['mimic']),
  mk('play + looper + band + mentor', '#/play', 'looper', ['looper', 'band', 'mentor']),
  ...['studio', 'dj', 'loops', 'drums', 'synth', 'scenes'].map((s) => mk('boss ' + s, `#/boss/${s}`, 'boss/', [], true)),
]
if (QUICK) {
  const keep = new Set(['play (default scene)', 'play scene fire', 'play scene vibes', 'songs', 'games list', 'game zombies', 'game bachdoom', 'beats', 'synth ladder', 'synth bellfm', 'log', 'play + looper', 'play + drum pads', 'play + band', 'boss studio', 'boss dj', 'boss loops'])
  states = states.filter((s) => keep.has(s.name))
}
if (ONLY) states = states.filter((s) => ONLY.test(s.name))
if (!states.length) { console.error('perf-sweep: no states match --only'); process.exit(2) }

// ---------- browser ----------
let chrome = null, prof = null
function killChrome() {
  if (chrome && chrome.exitCode === null) { try { process.kill(-chrome.pid, 'SIGKILL') } catch { try { chrome.kill('SIGKILL') } catch { /* gone */ } } }
  if (prof) { try { rmSync(prof, { recursive: true, force: true }) } catch { /* ignore */ } prof = null }
}
process.on('exit', killChrome)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { killChrome(); process.exit(130) })
const hardStop = setTimeout(() => { console.error('perf-sweep: hit the overall time cap, killing the browser'); killChrome(); process.exit(2) }, Number(process.env.PERF_TOTAL_MIN || 25) * 60000)
hardStop.unref()

async function launch() {
  prof = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), 'koog-perf-'))
  const port = 9800 + Math.floor(Math.random() * 150)
  chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore', detached: true })
  chrome.on('error', (e) => { console.error('perf-sweep: cannot start the browser:', e.message); killChrome(); process.exit(2) })
  let ws
  for (let i = 0; i < 60 && !ws; i++) {
    try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl) } catch { /* not up yet */ }
    if (!ws) await sleep(250)
  }
  if (!ws) throw new Error('the browser did not open a debugging port')
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('websocket error'))) })
  let id = 0; const pend = new Map()
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } })
  const send = (method, params = {}, ms = 60000) => new Promise((res, rej) => {
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('timeout: ' + method)) }, ms)
    pend.set(i, (d) => { clearTimeout(to); res(d) }); ws.send(JSON.stringify({ id: i, method, params }))
  })
  const ev = async (expression, ms = 60000) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms)
    if (r.result?.exceptionDetails) throw new Error('page error: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Runtime.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  return { send, ev, ws }
}

// the note stream, in the page: ~8 notes/s through playLocal (each held 100 ms); times playLocal() -> first oscillator/sample start() for input->sound
const STREAM = (ms) => `new Promise(async (done) => {
  const { playLocal } = await import('/src/music/localNotes.ts'); const pm = window.__perfmon
  let i = 0; const t0 = performance.now(); let sent = 0
  const tick = () => {
    if (performance.now() - t0 >= ${ms}) { clearInterval(iv); return setTimeout(() => done(sent), 250) }
    const n = 55 + ((i * 5) % 26); i++
    const a = performance.now(); playLocal(n, 90, true); const s = pm.lastStart(); if (s >= a) pm.addInput(s - a); sent++
    setTimeout(() => playLocal(n, 0, false), 100)
  }
  const iv = setInterval(tick, 125)
})`

async function measure(b, st, boss, attempt) {
  await b.ev(RESET)
  await b.ev(`location.hash = '${st.hash}'; 1`)
  await sleep(attempt === 0 ? 1600 : 1000)
  for (const k of st.setup) { const r = await b.ev(`(async()=>{ try { ${DOCK[k]}; return 'ok' } catch(e) { return 'setup ' + e.message } })()`); if (r !== 'ok') console.log('  ', st.name, r) }
  await sleep(1200)
  await b.ev(`window.__perfmon.reset(); 1`)
  await sleep(150)
  const sent = await b.ev(STREAM(SECS * 1000), (SECS + 30) * 1000)
  const row = await b.ev(`JSON.stringify(window.__perfmon.currentRow())`)
  const audio = await b.ev(`JSON.stringify(window.__perfmon.snapshot().audio)`)
  return { sent, row: row ? JSON.parse(row) : null, audio: audio ? JSON.parse(audio) : {}, boss }
}

// the machine's own floor: rAF p95 of an empty page in this same browser. On a busy laptop the floor alone can pass the frame budget, and then frame numbers say nothing about Koog.
async function calibrate(b) {
  await b.send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  const v = await b.ev(`new Promise((res) => { const d = []; let l = 0; const f = (t) => { if (l) d.push(t - l); l = t; if (d.length < 100) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res(d[Math.floor(d.length * 0.95)]) } }; requestAnimationFrame(f) })`, 30000)
  return Number(v) || 0
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const fmt = (x, d = 1) => (x == null || Number.isNaN(x) ? '-' : (Math.round(x * 10 ** d) / 10 ** d).toString())

async function main() {
  try { const r = await fetch(BASE); if (!r.ok) throw new Error('HTTP ' + r.status) } catch (e) {
    console.error(`perf-sweep: cannot reach ${BASE} (${e.message}). Start the app first (npm run dev, or ./scripts/start.sh).`); process.exit(2)
  }
  const load0 = loadavg()[0] / cpus().length
  const results = [] // {st, attempts:[{row,sent}], bestIdx}
  const floors = []
  let b = await launch()
  try {
    let mode = null
    const setMode = async (m) => {
      await b.send('Page.navigate', { url: BASE + '#/play' }); await sleep(1500)
      await b.ev(`localStorage.setItem('koog.perf','1'); localStorage.setItem('koog.mode','${m}'); localStorage.setItem('koog.mode.screen','play'); 1`)
      await b.send('Page.navigate', { url: BASE + '#/play' }); await sleep(3000)
      await b.ev(`location.reload(); 1`).catch(() => {}); await sleep(3500)
      mode = m
    }
    for (const bossPass of [false, true]) {
      const list = states.filter((s) => s.boss === bossPass)
      if (!list.length) continue
      floors.push(await calibrate(b))
      await setMode(bossPass ? 'dad' : 'kid')
      // an input event unlocks audio, then check the monitor is there
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift' }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift' })
      const ok = await b.ev(`typeof window.__perfmon === 'object' && window.__perfmon.isEnabled()`)
      if (!ok) throw new Error('the performance monitor is not running in the page (src/features/perfmon/)')
      for (const st of list) {
        const attempts = []
        for (let a = 0; a < ATTEMPTS; a++) {
          let m
          try { m = await measure(b, st, bossPass, a) } catch (e) {
            console.log(`  ${st.name}: attempt ${a + 1} failed (${e.message}); restarting the browser`)
            killChrome(); b = await launch(); await setMode(bossPass ? 'dad' : 'kid'); continue
          }
          if (m.row) attempts.push(m)
          const r = m.row
          const over = r && (r.frames.p95 > BUDGET.frame || (r.input.n && r.input.p95 > BUDGET.input) || r.lag.p95 > BUDGET.lag || r.glitches > 0)
          console.log(`  ${st.name} [try ${a + 1}] frame p95 ${fmt(r?.frames.p95)} ms, lag p95 ${fmt(r?.lag.p95)}, in p95 ${fmt(r?.input.p95)}, glitches ${r?.glitches}${over ? '  (over budget' + (a + 1 < ATTEMPTS ? ', retrying' : '') + ')' : ''}`)
          if (!over) break // within budget: a single clean attempt is enough
        }
        results.push({ st, attempts })
      }
    }
    floors.push(await calibrate(b))
  } finally {
    try { b?.ws.close() } catch { /* ignore */ }
    killChrome()
  }
  return { results, floor: Math.max(0, ...floors), load0, load1: loadavg()[0] / cpus().length, audio: results.find((r) => r.attempts[0])?.attempts[0].audio }
}

function judge(res) {
  const lines = [], bad = [], over = []
  const trusted = res.floor <= BUDGET.frame * 2 // an empty page cannot even hold 20 ms: the machine is too busy to judge frames
  const hardFrame = trusted ? Math.max(HARD.frame, res.floor * 2.5) : Infinity
  for (const { st, attempts } of res.results) {
    if (!attempts.length) { bad.push(`${st.name}: no measurement at all`); lines.push(`| ${st.name} | - | no data | | | | | | | FAIL |`); continue }
    const f = attempts.map((a) => a.row.frames.p95), best = attempts.reduce((p, c) => (c.row.frames.p95 < p.row.frames.p95 ? c : p))
    const r = best.row
    const spread = attempts.length > 1 ? `${fmt(Math.min(...f))}-${fmt(Math.max(...f))}` : 'single'
    const flags = []
    const hard = r.frames.p95 > hardFrame || r.lag.p95 > HARD.lag || (r.input.n && r.input.p95 > HARD.input) || r.glitches > HARD.glitch
    const soft = r.frames.p95 > BUDGET.frame || r.lag.p95 > BUDGET.lag || (r.input.n && r.input.p95 > BUDGET.input) || r.glitches > BUDGET.glitch
    if (r.frames.p95 > BUDGET.frame) flags.push(trusted ? 'frame' : 'frame (machine too busy to judge)'); if (!r.oscPerSec) flags.push('no oscillator starts: input unmeasured (worklet or sample sound)'); if (r.lag.p95 > BUDGET.lag) flags.push('lag'); if (r.input.n && r.input.p95 > BUDGET.input) flags.push('input'); if (r.glitches > 0) flags.push('glitch'); if (r.longTasks.n) flags.push(r.longTasks.n + ' long')
    if (!r.label.includes(st.expect)) flags.push('STATE? got "' + r.label + '"')
    const verdict = hard ? 'FAIL' : soft ? 'OVER' : 'ok'
    if (hard) bad.push(`${st.name}: frame p95 ${fmt(r.frames.p95)} ms, lag p95 ${fmt(r.lag.p95)} ms, input p95 ${fmt(r.input.p95)} ms, glitches ${r.glitches} (best of ${attempts.length})`)
    else if (soft) over.push(st.name)
    lines.push(`| ${st.name} | ${best.sent} | ${fmt(r.frames.p50)} / ${fmt(r.frames.p95)} | ${spread} | ${r.frames.dropped} | ${fmt(r.lag.p95)} | ${r.input.n ? fmt(r.input.p50) + ' / ' + fmt(r.input.p95) + ' (n ' + r.input.n + ')' : '-'} | ${r.longTasks.n} (${r.longTasks.maxMs}) | ${r.glitches} | ${fmt(r.heapMB)} | ${r.oscPerSec} | ${verdict}${flags.length ? ' ' + flags.join(', ') : ''} |`)
  }
  return { lines, bad, over, trusted, hardFrame }
}

const res = await main()
const { lines, bad, over, trusted, hardFrame } = judge(res)
const md = [
  '# Koog performance sweep', '',
  `Run ${new Date().toISOString()} on ${process.platform}, headless Chrome, muted. ${SECS} s per state at about 8 notes/s through playLocal; up to ${ATTEMPTS} attempts per state, stopping at the first one inside budget. Machine load (1-min load average per core): ${fmt(res.load0, 2)} before, ${fmt(res.load1, 2)} after. Empty-page rAF p95 in this browser (the machine's floor): ${fmt(res.floor)} ms. ${trusted ? `Frame hard limit used: ${fmt(hardFrame)} ms.` : '**The machine is too busy to judge frame times (an empty page misses 20 ms), so frame numbers are shown but NOT enforced; event-loop lag, input and glitches still are. Re-run when the laptop is quiet.**'}`,
  `Budgets (real targets): frame p95 < ${BUDGET.frame} ms, input to sound p95 < ${BUDGET.input} ms, event-loop lag p95 < ${BUDGET.lag} ms, 0 audio glitches. Hard limits (FAIL, headroom for headless): frame ${HARD.frame} ms, lag ${HARD.lag} ms, input ${HARD.input} ms, more than ${HARD.glitch} glitches. OVER = over budget but inside the hard limits.`,
  `Audio: ${JSON.stringify(res.audio || {})}. The row shown is the best attempt (lowest frame p95); "frame p95 range" is the spread across attempts, so a wide range means the machine was noisy, not the state.`,
  `Input to sound here is playLocal() to the first oscillator start (same thread, synchronous); real MIDI input to sound is measured by the in-app monitor from the key's own timestamp.`, '',
  '| State | notes | frame p50 / p95 ms | frame p95 range | dropped | lag p95 ms | in p50 / p95 ms | long tasks (max ms) | glitches | heap MB | sounds/s | verdict |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|', ...lines, '',
  bad.length ? '## FAIL\n' + bad.map((x) => '- ' + x).join('\n') : '## No state is far over budget.',
  over.length ? '\n## Over budget but within the hard limits\n' + over.map((x) => '- ' + x).join('\n') : '', '',
].join('\n')
mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, md)
console.log(`\nperf-sweep: ${res.results.length} states, ${over.length} over budget, ${bad.length} FAIL. Table: ${OUT}`)
if (!trusted) console.log(`perf-sweep: NOTE the machine is too busy to judge frame times (empty page p95 ${fmt(res.floor)} ms); frames are reported, not enforced.`)
for (const x of bad) console.error('FAIL ' + x)
process.exit(bad.length ? 1 : 0)
