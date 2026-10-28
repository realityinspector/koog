import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import './preflight.css'

type Status = 'pass' | 'warn' | 'fail'
type Row = { name: string; status: Status; detail: string }

export function PreflightPanel() {
  const midiConnected = useAppStore((s) => s.midiConnected)
  const midiInputName = useAppStore((s) => s.midiInputName)
  const midiOutputName = useAppStore((s) => s.midiOutputName)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    const out: Row[] = []
    const add = (name: string, status: Status, detail: string) => out.push({ name, status, detail })

    if (!('requestMIDIAccess' in navigator)) add('Web MIDI API', 'fail', 'not available (use Chrome)')
    else {
      add('Web MIDI API', 'pass', 'available')
      try {
        const p = await navigator.permissions.query({ name: 'midi' as PermissionName })
        add('MIDI permission', p.state === 'granted' ? 'pass' : p.state === 'prompt' ? 'warn' : 'fail',
          p.state === 'prompt' ? 'prompt - click Allow in the browser dialog' : p.state === 'denied' ? 'denied - reset in site settings' : p.state)
      } catch (e) { add('MIDI permission', 'warn', 'query failed: ' + (e as Error).message) }
    }

    const usb = [midiInputName, midiOutputName].some((n) => n?.includes('USB MIDI'))
    add('USB MIDI port', midiConnected && usb ? 'pass' : midiConnected ? 'warn' : 'fail',
      `in: ${midiInputName ?? 'none'} / out: ${midiOutputName ?? 'none'}`)

    try {
      const Ctx = window.AudioContext
      const ctx = new Ctx()
      await ctx.resume()
      add('AudioContext', ctx.state === 'running' ? 'pass' : 'warn',
        `${ctx.state}, ${ctx.sampleRate} Hz, latency ${(ctx.baseLatency * 1000).toFixed(1)} ms (out ${((ctx.outputLatency || 0) * 1000).toFixed(1)} ms)`)
      await ctx.close()
    } catch (e) { add('AudioContext', 'fail', (e as Error).message) }

    add('Display', 'pass', `${screen.width}x${screen.height} @${window.devicePixelRatio}x, viewport ${innerWidth}x${innerHeight}`)
    add('HMR', import.meta.hot ? 'pass' : 'warn', import.meta.hot ? 'connected' : 'not available')

    setRows(out)
    setBusy(false)
  }

  return (
    <section className="pf">
      <h2>Pre-flight</h2>
      <button onClick={run} disabled={busy}>{busy ? 'Checking...' : 'Run checks'}</button>
      <ul>
        {rows.map((r) => (
          <li key={r.name}><span className={`pf-tag pf-${r.status}`}>{r.status.toUpperCase()}</span> {r.name}: <span className="pf-d">{r.detail}</span></li>
        ))}
      </ul>
    </section>
  )
}
