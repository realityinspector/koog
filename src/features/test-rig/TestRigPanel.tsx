import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { latencyInfo, MAX_GAIN } from '../../audio/synth'
import { useRig, setPlayback, setLevel, setMuted, panicAll, resetMonitor, setSendEnabled, sendTestNote, outputPanic } from './rigStore'
import './rig.css'

const keys = (o: Record<number, number>) => Object.keys(o).map(Number).sort((a, b) => a - b)

function summary(s: ReturnType<typeof useRig.getState>['stats']) {
  const ch = keys(s.channels).map((c) => `${c} (${s.channels[c]})`).join(', ') || 'none yet'
  const style = s.noteOff80 && s.noteOn0 ? 'mixed (0x80 and 0x90 vel 0)' : s.noteOff80 ? '0x80 Note Off' : s.noteOn0 ? '0x90 with velocity 0' : 'not seen yet'
  const ccs = keys(s.ccs).map((c) => `CC${c} (${s.ccs[c]})`).join(', ') || 'none seen'
  const other = Object.entries(s.other).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'
  return [
    `Channel(s): ${ch}`,
    `Note-on velocity: ${s.velMin ?? '?'}..${s.velMax ?? '?'}`,
    `Note range seen: ${s.noteMin ?? '?'}..${s.noteMax ?? '?'}`,
    `Note-off style: ${style}`,
    `CCs: ${ccs}`,
    `Other messages: ${other}`,
    `Messages total: ${s.total}`,
  ].join('\n')
}

export function TestRigPanel() {
  const { log, stats, playback, muted, level, sendEnabled, sendStatus } = useRig()
  const connected = useAppStore((s) => s.midiConnected)
  const inName = useAppStore((s) => s.midiInputName)
  const outName = useAppStore((s) => s.midiOutputName)
  const [lat, setLat] = useState(latencyInfo())
  const [copied, setCopied] = useState(false)
  useEffect(() => { const t = setInterval(() => setLat(latencyInfo()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => () => outputPanic(), [])
  const text = summary(stats)
  const ms = (v: number | null | undefined) => (v == null ? 'n/a' : `${(v * 1000).toFixed(1)} ms`)

  return (
    <section className="rig">
      <h2>Test rig</h2>
      <div><span className={'dot' + (connected ? ' on' : '')} />{connected ? `Input: ${inName}` : 'No MIDI input'} | Output: {outName ?? 'none'}</div>

      <h3>Mac playback</h3>
      <div className="warn">If your keyboard has its own speakers: turn its volume down or expect double sound. Keep Mac volume low.</div>
      <div className="row">
        <label><input type="checkbox" checked={playback} onChange={(e) => void setPlayback(e.target.checked)} /> Enable playback (off by default)</label>
        <button className={'mute' + (muted ? ' on' : '')} onClick={() => setMuted(!muted)}>{muted ? 'MUTED' : 'Mute'}</button>
        <button className="panic" onClick={panicAll}>PANIC</button>
      </div>
      <div className="row">
        <label>Volume <input type="range" min={0} max={MAX_GAIN} step={0.01} value={level} onChange={(e) => setLevel(+e.target.value)} /> {level.toFixed(2)} (cap {MAX_GAIN})</label>
      </div>
      <div>Audio: {lat ? `${lat.state}, ${lat.sampleRate} Hz, base latency ${ms(lat.base)}, output latency ${ms(lat.output)}` : 'not started'}</div>

      <h3>Send test to keyboard</h3>
      <div className="row">
        <label><input type="checkbox" checked={sendEnabled} onChange={(e) => setSendEnabled(e.target.checked)} /> Send test to keyboard (off by default)</label>
        <button disabled={!sendEnabled || !outName} onClick={sendTestNote}>Send C4 note (vel 64, 0.5 s)</button>
      </div>
      <div className="warn">Only note on/off + All Notes Off / All Sound Off, max 50 msg/s. No SysEx. {sendStatus}</div>

      <h3>MIDI monitor <button onClick={resetMonitor}>Clear</button></h3>
      <div className="log">{log.length ? log.map((e) => `#${e.n} +${e.dt.toFixed(0)}ms lag ${e.lag.toFixed(1)}ms  ${e.hex.padEnd(9)} ${e.text}`).join('\n') : 'Waiting for MIDI messages... (clock/active-sensing are counted, not logged)'}</div>

      <h3>Results <button onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }) }}>{copied ? 'Copied' : 'Copy'}</button></h3>
      <pre>{text}</pre>
    </section>
  )
}
