#!/usr/bin/env node
// Pre-flight checks. Read-only: never changes system settings.
import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sh = (cmd, timeout = 20000) =>
  new Promise((res) => exec(cmd, { cwd: root, timeout, maxBuffer: 32e6 }, (err, stdout, stderr) =>
    res({ ok: !err, out: String(stdout), err: String(stderr), code: err?.code })))
const R = (status, detail, fix) => ({ status, detail, fix })

const checks = [
  ['Node version', async () => {
    const major = Number(process.versions.node.split('.')[0])
    return major >= 20 ? R('PASS', `v${process.versions.node}`) : R('FAIL', `v${process.versions.node}`, 'Install Node 20+')
  }],
  ['USB-MIDI keyboard (CoreMIDI)', async () => {
    // Any MIDI source counts. Set KOOG_MIDI_NAME to require a specific port name.
    const want = process.env.KOOG_MIDI_NAME
    const r = await sh(`swift ${JSON.stringify(path.join(root, 'scripts/preflight/midi-ports.swift'))}`, 60000)
    if (!r.ok) return R('FAIL', 'swift CoreMIDI listing failed', r.err.trim().split('\n')[0])
    const lines = r.out.split('\n')
    const srcs = lines.filter((l) => l.startsWith('src:')).map((l) => l.slice(4))
    const dsts = lines.filter((l) => l.startsWith('dst:')).map((l) => l.slice(4))
    const pick = want ? srcs.filter((n) => n === want) : srcs
    if (!pick.length) return R('FAIL', want ? `no MIDI source named "${want}"` : 'no MIDI sources', 'Plug in the keyboard with a data-capable USB cable; check Audio MIDI Setup')
    const name = pick[0]
    return dsts.includes(name) ? R('PASS', `"${name}" source + destination`) : R('WARN', `"${name}" source only (no MIDI out)`, 'Fine for playing; panic/All-Notes-Off to the keyboard will be skipped')
  }],
  ['Dev server :5173', async () => {
    try {
      const a = await fetch('http://localhost:5173/', { signal: AbortSignal.timeout(4000) })
      if (a.status !== 200) return R('FAIL', `/ returned ${a.status}`, 'Run npm run dev')
      const b = await fetch('http://localhost:5173/src/main.tsx', { signal: AbortSignal.timeout(4000) })
      return b.status === 200 ? R('PASS', '/ and /src/main.tsx return 200') : R('FAIL', `/src/main.tsx returned ${b.status}`, 'Is this the Koog dev server?')
    } catch (e) { return R('FAIL', 'no response: ' + (e.cause?.code ?? e.message), 'Run npm run dev') }
  }],
  ['TypeScript (tsc --noEmit)', async () => {
    const r = await sh('npx tsc --noEmit', 90000)
    if (r.ok) return R('PASS', 'no type errors')
    const n = (r.out.match(/error TS/g) || []).length
    return R('FAIL', `${n || '?'} type error(s)`, r.out.trim().split('\n').slice(0, 3).join('\n      '))
  }],
  ['Audio output + volume', async () => {
    const [vol, dev] = await Promise.all([
      sh(`osascript -e 'output volume of (get volume settings)'`),
      sh('system_profiler SPAudioDataType -json'),
    ])
    let name = 'unknown'
    try {
      const items = JSON.parse(dev.out).SPAudioDataType.flatMap((d) => d._items ?? [])
      name = items.find((i) => i.coreaudio_default_audio_output_device === 'spaudio_yes')?._name ?? 'none'
    } catch {}
    const muteR = await sh(`osascript -e 'output muted of (get volume settings)'`)
    const v = vol.out.trim()
    const muted = muteR.out.trim() === 'true'
    const n = Number(v)
    const d = `${name}, volume ${v}${muted ? ', MUTED' : ''}`
    if (name === 'none') return R('FAIL', d, 'Choose an output device in System Settings > Sound')
    if (muted) return R('WARN', d, 'Output is muted; unmute manually if you want sound')
    if (!Number.isFinite(n)) return R('WARN', d + ' (volume not readable, e.g. fixed-volume output)', 'Check the level on the device itself')
    if (n > 70) return R('WARN', d, 'Above 70%: lower it manually for ear/speaker safety')
    return R('PASS', d)
  }],
  ['Chrome installed', async () => {
    const p = ['/Applications/Google Chrome.app', path.join(process.env.HOME ?? '', 'Applications/Google Chrome.app')].find(existsSync)
    return p ? R('PASS', p) : R('FAIL', 'not found', 'Install Google Chrome (Web MIDI needs it)')
  }],
]

const t0 = Date.now()
const results = await Promise.all(checks.map(async ([name, fn]) => {
  try { return [name, await fn()] } catch (e) { return [name, R('FAIL', 'check crashed: ' + e.message)] }
}))
const color = { PASS: '\x1b[32m', WARN: '\x1b[33m', FAIL: '\x1b[31m' }
const tty = process.stdout.isTTY
console.log('\nKoog pre-flight\n')
for (const [name, r] of results) {
  const tag = tty ? `${color[r.status]}${r.status}\x1b[0m` : r.status
  console.log(` [${tag}] ${name.padEnd(34)} ${r.detail}`)
  if (r.fix && r.status !== 'PASS') console.log(`        -> ${r.fix}`)
}
const c = (s) => results.filter(([, r]) => r.status === s).length
console.log(`\n${c('PASS')} pass, ${c('WARN')} warn, ${c('FAIL')} fail  (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
console.log('Browser: MIDI permission is checked in the in-page Pre-flight panel (click Allow if prompted).\n')
process.exit(c('FAIL') ? 1 : 0)
