import { useEffect, useState } from 'react'
import type { Device } from '../../music/devices'
import { OFFSET_MAX, OFFSET_MIN, connDelayHint, connectionGuess, getOffset, lagStats, outputInfo, setOffset, startTapTest, stopTapTest, tapNow, useLatency, useTap, type OutInfo } from './latency'

/** true when the sound probably goes through Bluetooth (for the chip warning) */
export function useBluetoothTip(): boolean {
  useLatency((s) => s.v)
  const [bt, setBt] = useState(false)
  useEffect(() => {
    const check = () => { try { setBt(outputInfo().bluetooth) } catch { /* no audio yet */ } }
    check(); const t = setInterval(check, 4000)
    return () => clearInterval(t)
  }, [])
  return bt
}

/** Devices menu section: sound-out delay, input wobble, connection type, a tap test and a per-device timing offset. */
export function LatencyMeter({ devices }: { devices: Device[] }) {
  useLatency((s) => s.v)
  const [info, setInfo] = useState<OutInfo | null>(null)
  const [, tick] = useState(0)
  const tap = useTap()
  useEffect(() => {
    const go = () => { try { setInfo(outputInfo()) } catch { /* no audio */ } tick((n) => n + 1) }
    go(); const t = setInterval(go, 700)
    return () => { clearInterval(t); stopTapTest(false) }
  }, [])
  const dev = devices.find((d) => d.role === 'piano') ?? devices[0]
  const lag = lagStats(dev?.id)
  const conn = dev ? connectionGuess(dev.name) : null
  const off = dev ? getOffset(dev.name) : 0
  const grade = (ms: number) => (ms < 25 ? 'great' : ms < 60 ? 'okay' : 'late')
  return (
    <div className="kg-lat" data-testid="latency-meter">
      <h4>Timing <span className="kg-pedal-opt">how late things feel</span></h4>
      {info?.bluetooth && (
        <p className="kg-lat-tip" role="status">🎧 Your sound goes through Bluetooth, so notes will feel late. Use the computer speakers or wired headphones for playing.</p>
      )}
      <div className="kg-lat-row"><span>Sound out</span><b className={'kg-lat-' + grade(info?.total ?? 0)}>{info ? (info.state === 'running' ? Math.round(info.total) + ' ms' : 'wakes on first note') : '...'}</b></div>
      {dev && conn && (
        <>
          <div className="kg-lat-row" title={'Guessed from the port name. A web page cannot see the cable. Typical extra delay: ' + connDelayHint(conn.kind)}><span>{dev.name.length > 22 ? dev.name.slice(0, 21) + '…' : dev.name}</span><b>{conn.label}</b></div>
          <div className="kg-lat-row" title="How long each message waited inside the browser before Koog saw it. A high worst-case number means a busy hub, a Bluetooth wobble or a busy computer."><span>Input wobble</span>
            <b className={lag.count ? 'kg-lat-' + grade(lag.p95) : ''}>{lag.count ? `${lag.median.toFixed(1)} ms typical, ${lag.max.toFixed(0)} worst` : 'play a few notes'}</b></div>
        </>
      )}
      <div className="kg-lat-tap">
        {tap.running ? (
          <>
            <button type="button" className="kg-lat-big" onPointerDown={() => tapNow()} aria-label="Tap with the clicks">TAP with the clicks ({tap.taps.length}/{tap.clicks})</button>
            <button type="button" onClick={() => stopTapTest()}>Stop</button>
          </>
        ) : (
          <button type="button" onClick={() => void startTapTest()} title="Ten clicks play. Tap this button, a piano key or a pedal along with them.">Tap test</button>
        )}
        {tap.result !== null && !tap.running && (
          <span className="kg-lat-res">You tapped <b>{tap.result > 0 ? tap.result + ' ms after' : -tap.result + ' ms before'}</b> the clicks.
            {dev && <button type="button" onClick={() => setOffset(dev.name, off + tap.result!)}>Use as timing offset</button>}</span>
        )}
      </div>
      {dev && (
        <label className="kg-lat-off" title="Shifts when your notes COUNT for scoring and recording. It never changes the sound.">Timing offset
          <input type="range" min={OFFSET_MIN} max={OFFSET_MAX} step={5} value={off} onChange={(e) => setOffset(dev.name, +e.target.value)} aria-label="Timing offset in milliseconds" />
          <em>{off} ms</em>
          {off !== 0 && <button type="button" onClick={() => setOffset(dev.name, 0)}>Reset</button>}
        </label>
      )}
      <p className="kg-dev-note">Plug the keyboard straight into the computer, or into a powered hub with nothing else busy on it. Cheap hubs add wobble. Bluetooth headphones add about a quarter of a second.</p>
    </div>
  )
}
