import { useEffect, useRef, useState } from 'react'
import './loopstation.css'
import { ControllerPic } from '../dj/Controller'
import { BPM_MAX, BPM_MIN, setBpm, setLink, tapTempo, useMaster } from '../../music/masterClock'
import {
  INSTRUMENTS, LEN_CHOICES, buttonDown, buttonUp, canFilter, clearAll, downloadMidi, holdProgress, instLabel, layerProgress, lcdInfo, listSessions, loadSession,
  saveSession, select, setLayerInst, setLayerOpt, setLayerParam, setLayerVol, setLenBars, setOpt, stopAll, stopLayer, toggleMute, toggleSolo, togglePlay, useLoop, type Layer,
} from './loopEngine'
import { GUIDE_PATS, setGuide, unlockGuide, useGuide, type GuidePat } from './guide'
import { currentPage, loopInput, loopLabels, setControllerPage, useLoopPage, useLoopView } from './loopSurface'
import { useSurface } from '../controller/surface'

// A loop-pedal style panel: track strips with one big REC/PLAY/DUB button each (coloured ring), a fader, STOP, and an LCD.
const CIRC = 2 * Math.PI * 40
const WORD: Record<string, string> = { empty: 'EMPTY', rec: 'REC', over: 'DUB', play: 'PLAY', stop: 'STOP' }
const ICON: Record<string, string> = { empty: '●', rec: '●', over: '◉', play: '▶', stop: '▶' }
const QUANTS: [number, string][] = [[0, 'Off'], [0.5, '1/8'], [0.25, '1/16']]
const stateClass = (l: Layer) => (l.pend ? 'wait' : l.state)

/** rings follow the loop (rAF; 4 Hz when the person prefers reduced motion), and the hold ring fills while a button is held */
function useRings(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, h = 0
    const step = () => {
      const el = root.current; if (!el) return
      el.querySelectorAll<SVGCircleElement>('[data-ring]').forEach((c) => {
        const i = Number(c.dataset.ring), p = layerProgress(i)
        c.style.strokeDashoffset = String(CIRC * (1 - (p < 0 ? (p === -2 ? 1 : 0) : p)))
      })
      el.querySelectorAll<SVGCircleElement>('[data-hold]').forEach((c) => { c.style.strokeDashoffset = String(CIRC * (1 - holdProgress(Number(c.dataset.hold)))) })
    }
    if (calm) h = window.setInterval(step, 250)
    else {
      // rAF only while something moves (loop running or a button held) and the panel is on screen; idle or hidden: a slow timer
      const loop = () => {
        const el = root.current; if (!el) return
        const seen = el.getClientRects().length > 0
        if (seen) step()
        const busy = seen && (useLoop.getState().running || [0, 1, 2, 3, 4, 5, 6, 7].some((i) => holdProgress(i) > 0))
        if (busy) raf = requestAnimationFrame(loop); else h = window.setTimeout(() => { raf = requestAnimationFrame(loop) }, 200)
      }
      raf = requestAnimationFrame(loop)
    }
    return () => { cancelAnimationFrame(raf); clearInterval(h); clearTimeout(h) }
  }, [root])
}

function RingButton({ i, l, mini }: { i: number; l: Layer; mini?: boolean }) {
  const cls = stateClass(l)
  const down = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); buttonDown(i) }
  const up = () => buttonUp(i)
  const kd = (e: React.KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); buttonDown(i) } }
  const ku = (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); buttonUp(i) } }
  const what = l.pend ? `waiting to ${l.pend.to === 'over' ? 'dub' : l.pend.to}` : WORD[l.state].toLowerCase()
  return (
    <button type="button" className={'lp-ring rs-' + cls + (mini ? ' mini' : '')} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onKeyDown={kd} onKeyUp={ku}
      aria-label={`Track ${i + 1}: ${what}. Tap: record, then play or dub. Double-tap: stop. Hold 2 seconds: undo. Hold while stopped: clear.`}
      title="Tap REC / PLAY / DUB  ·  double-tap STOP  ·  hold 2 s UNDO (again REDO)  ·  hold while stopped CLEAR">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="40" className="lp-track" />
        <circle cx="50" cy="50" r="40" className="lp-arc" data-ring={i} strokeDasharray={CIRC} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="33" className="lp-hold" data-hold={i} strokeDasharray={2 * Math.PI * 40} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="28" className="lp-cap" />
        <text x="50" y={mini ? 58 : 54} textAnchor="middle" className="lp-glyph">{mini ? i + 1 : ICON[l.state]}</text>
        {!mini && <text x="50" y="68" textAnchor="middle" className="lp-word">{l.pend ? 'WAIT' : WORD[l.state]}</text>}
      </svg>
    </button>
  )
}

function Strip({ i, l, sel }: { i: number; l: Layer; sel: boolean }) {
  return (
    <section className={'lp-strip' + (sel ? ' sel' : '') + ' ss-' + stateClass(l)} onPointerDown={() => { if (!sel) select(i) }} aria-label={`Track ${i + 1}`}>
      <header>
        <b>{i + 1}</b>
        <select className="lp-inst" aria-label={`Track ${i + 1} sound`} value={l.inst} onChange={(e) => setLayerInst(i, e.target.value)}>
          {INSTRUMENTS().map((x) => <option key={x} value={x}>{instLabel(x)}</option>)}
          {!INSTRUMENTS().includes(l.inst) && <option value={l.inst}>{instLabel(l.inst)}</option>}
        </select>
        <button type="button" className={'lp-mini' + (l.mute ? ' on' : '')} aria-pressed={l.mute} title="Mute" onClick={() => toggleMute(i)}>M</button>
        <button type="button" className={'lp-mini' + (l.solo ? ' on' : '')} aria-pressed={l.solo} title="Solo" onClick={() => toggleSolo(i)}>S</button>
      </header>
      <div className="lp-mid">
        <input className="lp-fader" type="range" min={0} max={1} step={0.01} value={l.vol} aria-label={`Track ${i + 1} level`} onChange={(e) => setLayerVol(i, Number(e.target.value))} />
        <div className="lp-btncol">
          <RingButton i={i} l={l} />
          <button type="button" className="lp-stop" disabled={l.state === 'empty'} onClick={() => stopLayer(i)} title="Stop this track (follows its STOP mode)">■ STOP</button>
        </div>
      </div>
    </section>
  )
}

/** pedal options + FX of the SELECTED track, in one slim row under the strips */
function EditBar({ i, l }: { i: number; l: Layer }) {
  const set = <K extends Parameters<typeof setLayerOpt>[1]>(k: K, v: Layer[K]) => setLayerOpt(i, k, v)
  const filt = canFilter(l.inst)
  return (
    <div className="lp-edit" role="group" aria-label={`Track ${i + 1} options`}>
      <b>TRACK {i + 1}</b>
        <button type="button" className={'lp-chip' + (l.oneShot ? ' on' : '')} aria-pressed={l.oneShot} title="Play once, then stop" onClick={() => set('oneShot', !l.oneShot)}>1-SHOT</button>
        <button type="button" className={'lp-chip' + (l.reverse ? ' on' : '')} aria-pressed={l.reverse} title="Play the loop backwards" onClick={() => set('reverse', !l.reverse)}>REV</button>
        <select className="lp-chip" aria-label="Speed" value={l.speed} onChange={(e) => set('speed', Number(e.target.value) as Layer['speed'])} title="Playback speed"><option value={0.5}>½ speed</option><option value={1}>1× speed</option><option value={2}>2× speed</option></select>
        <select className="lp-chip" aria-label="Start mode" value={l.startMode} onChange={(e) => set('startMode', e.target.value as Layer['startMode'])} title="When PLAY starts"><option value="now">start: now</option><option value="end">start: loop end</option></select>
        <select className="lp-chip" aria-label="Stop mode" value={l.stopMode} onChange={(e) => set('stopMode', e.target.value as Layer['stopMode'])} title="When STOP stops"><option value="now">stop: now</option><option value="end">stop: loop end</option><option value="fade">stop: fade</option></select>
        <select className="lp-chip" aria-label="Loop length" value={l.mult} onChange={(e) => set('mult', Number(e.target.value) as Layer['mult'])} title="Length as a multiple of track 1 (LOOP SYNC)"><option value={1}>len ×1</option><option value={2}>len ×2</option><option value={4}>len ×4</option><option value={8}>len ×8</option></select>
        <button type="button" className={'lp-chip fx' + (l.fxFilter ? ' on' : '')} disabled={!filt} title={filt ? 'Filter sweep (click: off / half / full)' : 'This sound has no filter'} onClick={() => set('fxFilter', l.fxFilter === 0 ? 0.5 : l.fxFilter < 1 ? 1 : 0)}>FILT{l.fxFilter ? ' ' + Math.round(l.fxFilter * 100) : ''}</button>
        <button type="button" className={'lp-chip fx' + (l.fxStutter ? ' on' : '')} title="Stutter roll (click: off / 1/8 / 1/16)" onClick={() => set('fxStutter', ((l.fxStutter + 1) % 3) as 0 | 1 | 2)}>ROLL{l.fxStutter ? (l.fxStutter === 1 ? ' ⅛' : ' 1/16') : ''}</button>
        <button type="button" className={'lp-chip fx' + (l.transpose === -12 ? ' on' : '')} title="Down an octave" onClick={() => setLayerParam(i, 'transpose', l.transpose === -12 ? 0 : -12)}>−8va</button>
        <button type="button" className={'lp-chip fx' + (l.transpose === 12 ? ' on' : '')} title="Up an octave" onClick={() => setLayerParam(i, 'transpose', l.transpose === 12 ? 0 : 12)}>+8va</button>
    </div>
  )
}

/** tempo box: typing never changes the clock half-way ("1" would clamp to 40 and eat the next digit); Enter / blur commits, arrows commit at once */
function BpmField({ bpm, disabled }: { bpm: number; disabled: boolean }) {
  const [txt, setTxt] = useState<string | null>(null)
  const commit = () => { if (txt != null) { const v = parseFloat(txt); if (v > 0) setBpm(v); setTxt(null) } }
  return <input type="number" min={BPM_MIN} max={BPM_MAX} step={1} value={txt ?? String(Math.round(bpm * 10) / 10)} disabled={disabled} aria-label="Tempo in beats per minute"
    onChange={(e) => { const nat = (e.nativeEvent as InputEvent).inputType; if (nat === undefined || nat === 'insertReplacementText') { const v = parseFloat(e.target.value); if (v > 0) setBpm(v); setTxt(null) } else setTxt(e.target.value) }}
    onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
}

/** the LCD: track, mode, bar.beat, bpm, settings */
function Lcd() {
  const s = useLoop(), g = useGuide(), bpm = useMaster((m) => m.bpm), following = useMaster((m) => m.following)
  const [, tick] = useState(0)
  useEffect(() => { const h = window.setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(h) }, [])
  const L = s.layers[s.sel], info = lcdInfo()
  const mode = L.pend ? 'WAIT' : WORD[L.state]
  const pos = info.running ? (info.counting ? `COUNT ${info.count}` : `${String(info.bar).padStart(2, '0')}.${info.beat}`) : '--.-'
  return (
    <div className="lp-lcd" role="status" aria-live="off">
      <div className="l1"><span>TRACK {s.sel + 1}</span><b>{mode}</b><span>{pos}{info.bars ? ' / ' + (Math.round(info.bars * 10) / 10) + ' BARS' : ''}</span></div>
      <div className="l2"><span>{Math.round(bpm * 10) / 10} BPM{following ? ' DJ' : ''}</span><span>{s.recNext === 'play' ? 'REC>PLAY' : 'REC>DUB'}</span><span>{s.sync ? 'SYNC' : 'FREE'}</span><span>{s.measure ? 'MEASURE' : 'LIVE'}</span><span>{g.on ? 'GUIDE ' + g.pat.toUpperCase() : 'GUIDE OFF'}</span></div>
    </div>
  )
}

function Seg({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return <button type="button" className={'lp-chip big' + (on ? ' on' : '')} aria-pressed={on} title={title} onClick={onClick}>{children}</button>
}

function Settings({ more, setMore, pic, setPic }: { more: boolean; setMore: (b: boolean) => void; pic: boolean; setPic: (b: boolean) => void }) {
  const s = useLoop(), g = useGuide(), bpm = useMaster((m) => m.bpm), following = useMaster((m) => m.following), link = useMaster((m) => m.link)
  const [slot, setSlot] = useState('1'), [, bump] = useState(0)
  const all = listSessions()
  return (
    <>
      <div className="lp-top">
        <Lcd />
        <button type="button" className={'lp-all' + (s.running ? ' on' : '')} aria-pressed={s.running} onClick={() => { unlockGuide(); togglePlay() }} title="ALL START / STOP">{s.running ? '■ ALL STOP' : '▶ ALL START'}</button>
        <span className="lp-grp"><b>BPM</b>
          <BpmField bpm={bpm} disabled={following} />
          <button type="button" className="lp-chip" onClick={() => tapTempo()} title="Tap tempo">TAP</button></span>
      </div>
      <div className="lp-set">
        <span className="lp-grp"><b>REC →</b>
          <Seg on={s.recNext === 'play'} onClick={() => setOpt('recNext', 'play')} title="Second press goes to PLAY">PLAY</Seg>
          <Seg on={s.recNext === 'dub'} onClick={() => setOpt('recNext', 'dub')} title="Second press goes straight to DUB">DUB</Seg></span>
        <Seg on={s.sync} onClick={() => setOpt('sync', !s.sync)} title="LOOP SYNC: tracks lock to the first track's length (or a multiple)">LOOP SYNC</Seg>
        <Seg on={s.measure} onClick={() => setOpt('measure', !s.measure)} title="MEASURE: REC / DUB / PLAY wait for the next bar line (the ring blinks while waiting)">MEASURE</Seg>
        <span className="lp-grp"><Seg on={g.on} onClick={() => { unlockGuide(); setGuide({ on: !g.on }) }} title="Rhythm guide: a light drum pattern on the loop's tempo">GUIDE</Seg>
          <select aria-label="Guide pattern" value={g.pat} onChange={(e) => setGuide({ pat: e.target.value as GuidePat })}>{GUIDE_PATS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></span>
        <Seg on={more} onClick={() => setMore(!more)} title="Show tracks 6 to 8">{more ? '◂ 1-5' : '6-8 ▸'}</Seg>
        <details className="lp-more"><summary title="More settings: quantise, bars, save / load, export">⋯ MORE</summary>
          <div className="lp-more-body">
            <label>Count-in <select value={s.countIn} onChange={(e) => setOpt('countIn', Number(e.target.value))}>{[0, 1, 2].map((n) => <option key={n} value={n}>{n} bar{n === 1 ? '' : 's'}</option>)}</select></label>
            <label title="Loop main volume (under every engine's own safety cap)">Main <input type="range" min={0} max={1} step={0.01} value={s.master} aria-label="Loop main volume" onChange={(e) => setOpt('master', Number(e.target.value))} /></label>
            <label>Quantise <select value={s.quant} onChange={(e) => setOpt('quant', Number(e.target.value))}>{QUANTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Bars <select value={s.lenBars} onChange={(e) => setLenBars(Number(e.target.value))}><option value={0}>auto</option>{LEN_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label title="Make the beat machine follow this tempo"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> link beats</label>
            <label title="Also record DJ pad hits"><input type="checkbox" checked={s.recPads} onChange={(e) => setOpt('recPads', e.target.checked)} /> DJ pads</label>
            <label title="Show the selected track on the sheet music while it plays"><input type="checkbox" checked={s.sheet} onChange={(e) => setOpt('sheet', e.target.checked)} /> sheet</label>
            <Seg on={pic} onClick={() => setPic(!pic)} title="The drawn controller for the Loop page">controller</Seg>
            <span className="lp-grp"><select aria-label="Save slot" value={slot} onChange={(e) => setSlot(e.target.value)}>{['1', '2', '3', '4'].map((k) => <option key={k} value={k}>slot {k}{all[k] ? ' ●' : ''}</option>)}</select>
              <button type="button" className="lp-chip" onClick={() => { saveSession(slot); bump((n) => n + 1) }}>SAVE</button>
              <button type="button" className="lp-chip" disabled={!all[slot]} onClick={() => loadSession(slot)}>LOAD</button></span>
            <button type="button" className="lp-chip" disabled={!s.layers.some((l) => l.takes.length)} onClick={() => downloadMidi(1)} title="Download as a Standard MIDI File">⬇ .MID</button>
            <button type="button" className="lp-chip" onClick={() => stopAll()}>■ stop</button>
            <button type="button" className="lp-chip" onClick={() => clearAll()} title="Clear every track">CLEAR ALL</button>
          </div>
        </details>
      </div>
    </>
  )
}

export function LoopStation({ compact }: { compact?: boolean }) {
  const s = useLoop()
  const root = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false), [pic, setPic] = useState(false)
  useRings(root)
  const bpm = useMaster((m) => m.bpm), guideOn = useGuide((g) => g.on)

  if (compact) {
    return (
      <div className="lp lp-compact" ref={root} role="group" aria-label="Loop station">
        <div className="lp-crow">
          <button type="button" className={'lp-all sm' + (s.running ? ' on' : '')} aria-pressed={s.running} onClick={() => { unlockGuide(); togglePlay() }} title="ALL START / STOP">{s.running ? '■' : '▶'}</button>
          {s.layers.slice(0, 5).map((l, i) => <RingButton key={i} i={i} l={l} mini />)}
        </div>
        <div className="lp-crow">
          <span className="lp-lcd sm"><b>{Math.round(bpm)}</b> BPM{s.countLeft > 0 ? ' · COUNT ' + s.countLeft : ''}</span>
          <button type="button" className={'lp-chip' + (guideOn ? ' on' : '')} aria-pressed={guideOn} onClick={() => { unlockGuide(); setGuide({ on: !guideOn }) }} title="Rhythm guide">GUIDE</button>
        </div>
      </div>
    )
  }
  const shown = more ? s.layers : s.layers.slice(0, 5)
  return (
    <div className="lp" ref={root} role="region" aria-label="Loop station" data-n={shown.length}>
      <Settings more={more} setMore={setMore} pic={pic} setPic={setPic} />
      <div className="lp-strips" style={{ ['--n' as string]: shown.length }}>
        {shown.map((l, i) => <Strip key={i} i={i} l={l} sel={i === s.sel} />)}
      </div>
      <EditBar i={s.sel} l={s.layers[s.sel]} />
      {pic && <div className="lp-picwrap"><PadsPicture /></div>}
    </div>
  )
}

function PadsPicture() {
  const v = useLoopView()
  const synth = useSurface((s) => s.on)
  const page = currentPage(synth, v.on)
  const now = performance.now()
  const ctl = Object.fromEntries(Object.entries(v.values).map(([k, x]) => [k, { v: x, n: 1 }]))
  const hot = Object.fromEntries(Object.entries(v.touched).filter(([, t]) => now - t < 600).map(([k]) => [k, true]))
  return (
    <div className="lp-pic">
      <div className="lp-pic-head">
        <button type="button" className={'lp-chip big' + (page === 'loop' ? ' on' : '')} aria-pressed={page === 'loop'} onClick={() => setControllerPage(page === 'loop' ? 'dj' : 'loop')}>
          {page === 'loop' ? '🔁 Controller is on the Loop page' : '🔁 Put the controller on the Loop page'}
        </button>
        <small>{v.last || 'Pads 1-5 are the track buttons: tap, double-tap, hold. PAD MODE flips to tracks 6-8.'}</small>
      </div>
      <ControllerPic ctl={ctl} labels={loopLabels()} ghost={v.ghost} hot={hot} interactive title="LOOP" onSend={(id, val) => loopInput(id, val)} />
    </div>
  )
}
