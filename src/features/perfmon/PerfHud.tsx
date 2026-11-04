// "⏱ Perf" HUD for grown-ups: the current state's numbers against budgets, a table of the states visited, and a Copy report button.
// Boss mode always gets the small pill; kid mode never does unless a grown-up runs __perfmon.showHud() in the console.
import { useEffect, useState } from 'react'
import { useProfile } from '../../profile/profile'
import { BUDGET, hudWanted, isEnabled, perfmon, setEnabled, type Report, type Row } from './perfmon'
import './perfmon.css'

type Lvl = 'ok' | 'warn' | 'bad' | 'na'
const lvl = (v: number, budget: number, n: number): Lvl => (n < 5 ? 'na' : v <= budget ? 'ok' : v <= budget * 1.5 ? 'warn' : 'bad')
const worst = (a: Lvl[]): Lvl => (a.includes('bad') ? 'bad' : a.includes('warn') ? 'warn' : a.includes('ok') ? 'ok' : 'na')
const rowLvls = (r: Row) => [lvl(r.frames.p95, BUDGET.frameP95, r.frames.n), lvl(r.input.p95, BUDGET.inputP95, r.input.n), lvl(r.lag.p95, BUDGET.lagP95, r.lag.n), r.glitches > BUDGET.glitches ? 'bad' as Lvl : 'ok' as Lvl]
const f1 = (x: number) => (Math.round(x * 10) / 10).toString()

function Cell({ label, value, l, hint }: { label: string; value: string; l: Lvl; hint: string }) {
  return <div className={'pm-cell ' + l} title={hint}><span>{label}</span><b>{value}</b></div>
}

export function PerfHud() {
  const boss = useProfile((s) => s.mode === 'dad')
  const [want, setWant] = useState(hudWanted)
  const [open, setOpen] = useState(false)
  const [rep, setRep] = useState<Report | null>(null)
  const [on, setOn] = useState(isEnabled)
  const [copied, setCopied] = useState('')
  const [dotRow, setDotRow] = useState<Row | null>(null)
  useEffect(() => { const f = () => setWant(hudWanted()); window.addEventListener('koog-perf-hud', f); return () => window.removeEventListener('koog-perf-hud', f) }, [])
  const shown = boss || want
  useEffect(() => {
    if (!shown) return
    const tick = () => { setOn(isEnabled()); setRep(open ? perfmon.snapshot() : null); if (!open) setDotRow(perfmon.currentRow()) }
    tick()
    const id = window.setInterval(tick, open ? 1000 : 3000)
    return () => clearInterval(id)
  }, [shown, open])
  if (!shown) return null
  const cur = rep?.states.find((r) => r.live && r.label === rep.current) ?? (open ? null : dotRow)
  const dot: Lvl = on && cur ? worst(rowLvls(cur)) : 'na'
  const copy = async () => {
    const text = perfmon.report()
    try { await navigator.clipboard.writeText(text); setCopied('Copied') } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); setCopied('Copied') } catch { setCopied('Could not copy') }
      ta.remove()
    }
    setTimeout(() => setCopied(''), 2000)
  }
  return (
    <div className="pm-wrap" data-perfmon onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className={'pm-pill ' + dot} onClick={() => setOpen(!open)} aria-expanded={open} title="Performance monitor (grown-ups). Measured on this device only.">
        <span className="pm-dot" aria-hidden /> ⏱ Perf
      </button>
      {open && (
        <div className="pm-panel" role="dialog" aria-label="Performance monitor">
          <div className="pm-head">
            <b>⏱ Performance</b>
            <label className="pm-sw"><input type="checkbox" checked={on} onChange={(e) => { setEnabled(e.target.checked); setOn(e.target.checked) }} /> {on ? 'Measuring' : 'Off'}</label>
          </div>
          <p className="pm-priv">Measured on this device only. Nothing is sent anywhere: there is no network code in the monitor.</p>
          {on && cur ? (
            <>
              <div className="pm-state" title="the app state these numbers belong to">{cur.label}</div>
              <div className="pm-grid">
                <Cell label="Frame p50 / p95" value={`${f1(cur.frames.p50)} / ${f1(cur.frames.p95)} ms`} l={lvl(cur.frames.p95, BUDGET.frameP95, cur.frames.n)} hint="Time between screen frames. Budget: p95 under 20 ms." />
                <Cell label="Dropped frames" value={String(cur.frames.dropped)} l={cur.frames.dropped > 0 ? 'warn' : 'ok'} hint="Frames that took over 25 ms" />
                <Cell label="Input to sound p95" value={cur.input.n ? `${f1(cur.input.p50)} / ${f1(cur.input.p95)} ms` : 'no MIDI notes yet'} l={lvl(cur.input.p95, BUDGET.inputP95, cur.input.n)} hint="MIDI key time to the first sound starting. Budget: p95 under 10 ms. Needs a MIDI keyboard." />
                <Cell label="Event-loop lag p95" value={`${f1(cur.lag.p95)} ms`} l={lvl(cur.lag.p95, BUDGET.lagP95, cur.lag.n)} hint="How late a worker heartbeat reaches the page. Budget: p95 under 15 ms." />
                <Cell label="Long tasks" value={`${cur.longTasks.n} (max ${cur.longTasks.maxMs} ms)`} l={cur.longTasks.n > 0 ? 'warn' : 'ok'} hint="Main-thread jobs over 50 ms" />
                <Cell label="Audio glitches" value={String(cur.glitches)} l={cur.glitches > 0 ? 'bad' : 'ok'} hint="Audio dropouts. Budget: zero." />
                <Cell label="Looper timer lag" value={`${f1(cur.looperLag)} ms`} l="na" hint="Largest smoothed lag of the looper's timer. Drum pads do not expose scheduler lateness." />
                <Cell label="JS heap / sounds/s" value={`${f1(cur.heapMB)} MB / ${cur.oscPerSec}`} l="na" hint="Used JS heap (Chrome only) and oscillator+sample starts in the last second" />
              </div>
            </>
          ) : <p className="pm-priv">{on ? 'Collecting...' : 'Switch Measuring on to start sampling.'}</p>}
          {rep && (
            <div className="pm-tablewrap">
              <table className="pm-table">
                <thead><tr><th>State</th><th>s</th><th>Frame p95</th><th>In p95</th><th>Lag p95</th><th>Glitch</th></tr></thead>
                <tbody>
                  {rep.states.map((r) => {
                    const [a, b, c, d] = rowLvls(r)
                    return (
                      <tr key={r.key} className={(r.label === rep.current && r.live ? 'cur ' : '') + (r.live ? '' : 'old ') + worst([a, b, c, d])} title={r.label + (r.live ? '' : ' (saved from an earlier visit)')}>
                        <td>{r.label}</td><td>{r.secs}</td><td className={a}>{f1(r.frames.p95)}</td><td className={b}>{r.input.n ? f1(r.input.p95) : '-'}</td><td className={c}>{f1(r.lag.p95)}</td><td className={d}>{r.glitches}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="pm-foot">
            <button type="button" onClick={copy}>{copied || 'Copy report'}</button>
            <button type="button" onClick={() => { perfmon.reset(); setRep(perfmon.snapshot()) }}>Reset</button>
            <span>Budgets: frame p95 &lt; 20 ms, input&rarr;sound p95 &lt; 10 ms, lag p95 &lt; 15 ms, 0 glitches</span>
          </div>
        </div>
      )}
    </div>
  )
}
if (import.meta.hot) import.meta.hot.accept()
