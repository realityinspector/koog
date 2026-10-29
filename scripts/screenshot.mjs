// Screenshot the running app in a throwaway headless Chrome profile (never touches your real browser data).
// Usage: node scripts/screenshot.mjs steps.json [outDir]   (see docs/DEVELOPING.md)
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from 'node:os'
import path from 'node:path'
const steps = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const outDir = process.argv[3] || path.join(path.dirname(process.argv[2]), "shots")
mkdirSync(outDir, { recursive: true })
const prof = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), 'koog-shot-'))
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 50; i++) {
  try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = t.find((x) => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {}
  await sleep(200)
}
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pend = new Map()
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } else if (d.method === 'Runtime.exceptionThrown') { console.log('PAGE EXCEPTION', d.params.exceptionDetails.exception?.description?.slice(0, 200)) } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('CONSOLE ERROR', JSON.stringify(d.params.args.map(a => a.value ?? a.description)).slice(0, 200)) })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
for (const s of steps) {
  if (s.nav) { await send('Page.navigate', { url: s.nav }); await sleep(s.wait ?? 2500) }
  if (s.js) { const r = await send('Runtime.evaluate', { expression: s.js, awaitPromise: true, returnByValue: true }); const v = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; if (s.log !== false) console.log((s.name || 'js') + ':', typeof v === 'string' ? v.slice(0, 600) : JSON.stringify(v)?.slice(0, 600)); await sleep(s.wait ?? 300) }
  if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${outDir}/${s.shot}.png`, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot) }
}
ws.close(); chrome.kill(); await sleep(300); try { rmSync(prof, { recursive: true, force: true }) } catch {}
