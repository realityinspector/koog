import { useEffect, useRef, useState } from 'react'
import { BPM_MAX, BPM_MIN, setBpm, useMaster } from '../../music/masterClock'
import { BIG_WORDS, type BigState } from './loopCore'
import { INSTRUMENTS, isLooperOpen, bigDown, canUndoClear, setMetronomeOn, undoClear, bigHoldProgress, bigLayers, bigProgress, bigRedo, bigState, bigUndo, bigUp, canBigRedo, clearAll, clearLayer, instLabel, nextSound, setLayerInst, setNextSound, setOpt, stopAll, timingInfo, toggleMute, useLoop } from './loopEngine'
import { setGuide, unlockGuide, useGuide } from './guide'
import { LOOP_STYLES, pedalJob, setLoopStyle, usePedal, type LoopStyle } from '../pedal/pedal'
import { hideClearToast, useClearToast } from './clearToast'
import { registerShortcut } from '../../ui/shortcuts'
import { CodeMenu } from '../codeexport/CodeMenu'
import { loopCode } from '../codeexport/sources'

let spaceIds = 0 // one shortcut id per mounted looper
// The simple looper: ONE big button (also the foot pedal, and Space), like a guitar loop pedal.
//   tap: record -> tap: loop it -> tap: add a layer -> tap: finish the layer    press twice: stop    hold 2 s: undo / redo (stopped: clear)
// One line says how it keeps time (free: the tempo follows your loop / locked: loops snap to whole bars); the ring says how long the loop is.
// Every layer gets its own Mute and ✕. Everything else is behind "Advanced".
const R = 44, CIRC = 2 * Math.PI * R
const GLYPH: Record<BigState, string> = { empty: '●', count: '●', rec: '●', play: '▶', over: '+', stop: '■' }

/** tempo box: typing never changes the clock half-way ("1" would clamp to 40 and eat the next digit); Enter / blur commits, arrows commit at once */
export function BpmField({ bpm, disabled, title }: { bpm: number; disabled: boolean; title?: string }) {
  const [txt, setTxt] = useState<string | null>(null)
  const commit = () => { if (txt != null) { const v = parseFloat(txt); if (v > 0) setBpm(v); setTxt(null) } }
  return <input type="number" min={BPM_MIN} max={BPM_MAX} step={1} value={txt ?? String(Math.round(bpm * 10) / 10)} disabled={disabled} title={title} aria-label="Tempo in beats per minute"
    onChange={(e) => { const nat = (e.nativeEvent as InputEvent).inputType; if (nat === undefined || nat === 'insertReplacementText') { const v = parseFloat(e.target.value); if (v > 0) setBpm(v); setTxt(null) } else setTxt(e.target.value) }}
    onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
}

/** Destructive action: first tap arms ("Sure? tap again"), second tap within 3 s does it. */
export function ConfirmChip({ label, onConfirm, disabled, title, className = 'lp-chip' }: { label: string; onConfirm: () => void; disabled?: boolean; title?: string; className?: string }) {
  const [armed, setArmed] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  useEffect(() => { if (disabled) setArmed(false) }, [disabled])
  return (
    <button type="button" className={className + (armed ? ' on' : '')} disabled={disabled} title={title} data-armed={armed || undefined}
      onClick={() => {
        window.clearTimeout(t.current)
        if (armed) { setArmed(false); onConfirm(); return }
        setArmed(true)
        t.current = window.setTimeout(() => setArmed(false), 3000)
      }}>{armed ? 'Sure? Tap again' : label}</button>
  )
}

/** the big "Cleared" toast after the pedal's 2 s hold (simple style), with Undo clear for 5 s */
export function ClearedToast() {
  const t = useClearToast((s) => s.t)
  useLoop((s) => s.rev) // re-render when the loops change (recording something new retires the Undo)
  useEffect(() => {
    if (!t) return
    const h = window.setTimeout(hideClearToast, Math.max(0, t.until - Date.now()))
    return () => window.clearTimeout(h)
  }, [t])
  if (!t) return null
  const can = t.undo && canUndoClear()
  return (
    <div className="lps-cleared" role="status" aria-live="assertive" key={t.n} style={{ ['--ms' as string]: Math.max(0, t.until - Date.now()) + 'ms' }}>
      <b>🧹 Cleared</b>
      {can && <button type="button" className="lps-cleared-undo" onClick={() => undoClear()}>↶ Undo clear</button>}
      {can && <i className="lps-cleared-bar" aria-hidden />}
    </div>
  )
}

/** which style the foot pedal uses for the looper (the same switch is in the pedal setup) */
function PedalStyle({ here }: { here: boolean }) {
  const style = usePedal((p) => p.loopStyle) ?? 'simple'
  const desc = LOOP_STYLES.find(([k]) => k === style)
  return (
    <label className="lps-pedalstyle" title={desc?.[2]}>
      <span>Foot pedal style{here ? ' (in use)' : ''}</span>{' '}
      <select value={style} onChange={(e) => setLoopStyle(e.target.value as LoopStyle)} aria-label="Foot pedal style for the looper" data-pedal-style={style}>
        {LOOP_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  )
}

/** the loop ring and the hold ring follow the loop (rAF while running or held, a slow timer otherwise; 4 Hz under reduced motion) */
function useBigRings(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, h = 0
    const step = () => {
      const el = root.current; if (!el) return false
      const ring = el.querySelector<SVGCircleElement>('[data-big-ring]'), hold = el.querySelector<SVGCircleElement>('[data-big-hold]')
      const p = bigProgress(), hp = bigHoldProgress()
      if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - (p < 0 ? (p === -2 ? 1 : 0) : p)))
      if (hold) hold.style.strokeDashoffset = String(CIRC * (1 - hp))
      return p >= 0 || p === -2 || hp > 0
    }
    if (calm) h = window.setInterval(step, 250)
    else {
      const loop = () => {
        const el = root.current; if (!el) return
        const busy = el.getClientRects().length > 0 && step()
        if (busy) raf = requestAnimationFrame(loop); else h = window.setTimeout(() => { raf = requestAnimationFrame(loop) }, 150)
      }
      raf = requestAnimationFrame(loop)
    }
    return () => { cancelAnimationFrame(raf); clearInterval(h); clearTimeout(h) }
  }, [root])
}

const formField = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]') }

function BigButton({ st, count }: { st: BigState; count: number }) {
  const down = (e: React.PointerEvent) => { if (e.button !== 0) return; e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); bigDown('classic', e.timeStamp) }
  const up = () => bigUp()
  const w = BIG_WORDS[st]
  return (
    <button type="button" className={'lps-big bs-' + st} onPointerDown={down} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); bigDown() } }} onKeyUp={(e) => { if (e.key === 'Enter') { e.preventDefault(); bigUp() } }}
      aria-label={`Loop button: ${w.word.toLowerCase()}. ${w.hint} Double-tap to stop. Hold to undo.`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} className="lps-track" />
        <circle cx="50" cy="50" r={R} className="lps-arc" data-big-ring strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r={R - 7} className="lps-hold" data-big-hold strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="33" className="lps-cap" />
        <text x="50" y={st === 'count' && count ? 56 : 52} textAnchor="middle" className="lps-glyph">{st === 'count' && count ? count : GLYPH[st]}</text>
        <text x="50" y="67" textAnchor="middle" className="lps-word">{st === 'empty' ? 'TAP' : st === 'over' ? 'LAYER' : w.word}</text>
      </svg>
    </button>
  )
}

export function SimpleLooper({ onAdvanced }: { onAdvanced: () => void }) {
  const s = useLoop()
  const root = useRef<HTMLDivElement>(null)
  const bpm = useMaster((m) => m.bpm), following = useMaster((m) => m.following), guideOn = useGuide((g) => g.on)
  const pedal = usePedal()
  const [, tick] = useState(0)
  useBigRings(root)
  // the count-in and its end are timed by the clock, not by a store change: re-read the state a few times a second
  useEffect(() => { const h = window.setInterval(() => tick((n) => n + 1), 200); return () => clearInterval(h) }, [])
  // Space = the big button while the looper is on screen (form fields keep their Space; a focused key elsewhere keeps it too)
  useEffect(() => {
    let held = false
    const seen = () => !!root.current && root.current.getClientRects().length > 0
    // registered through src/ui/shortcuts.ts: only while this looper is on screen, never in a text box, never with Ctrl / Cmd / Alt
    const mine = (e: KeyboardEvent) => !formField(e.target) && !(e.target instanceof HTMLElement && e.target.closest('button, a, [role=button]') && !root.current!.contains(e.target))
    const un = registerShortcut({
      id: 'looper-space-' + (++spaceIds), key: 'Space', owner: 'SimpleLooper (Space)', when: () => seen() && isLooperOpen(),
      run: (e) => { if (!mine(e)) return false; if (!held) { held = true; bigDown('classic', e.timeStamp) } },
      up: (e) => { if (!held) return; e.preventDefault(); held = false; bigUp() },
    })
    const blur = () => { if (held) { held = false; bigUp() } }
    window.addEventListener('blur', blur)
    return () => { un(); window.removeEventListener('blur', blur); blur() }
  }, [])

  const st = bigState(), w = BIG_WORDS[st]
  const layers = bigLayers()
  const any = layers.some((i) => s.layers[i].takes.length)
  const job = pedalJob(pedal.action), pedalHere = (pedal.code || pedal.midi) && job === 'loop'
  const ti = timingInfo()
  const tempoTitle = following ? 'The DJ decks set the tempo' : ti.tempoLocked ? 'Clear to change tempo' : 'Beats per minute'
  return (
    <div className={'lp lps lps-' + st} ref={root} role="region" aria-label="Loop station">
      <div className="lps-main">
        <div className="lps-ringcol">
          <BigButton st={st} count={s.countLeft} />
          <div className="lps-len" aria-label="Loop length">{ti.len || (st === 'rec' ? 'recording…' : '\u00a0')}</div>
        </div>
        <div className="lps-side">
          <div className="lps-status" role="status" aria-live="polite">
            <b>{st === 'count' ? `GET READY… ${s.countLeft || ''}` : w.word}</b>
            <span>{w.hint}</span>
          </div>
          <div className="lps-row">
            <button type="button" className="lps-btn" disabled={st === 'empty' || st === 'stop'} onClick={() => stopAll()}>■ Stop</button>
            <button type="button" className="lps-btn" disabled={!any} onClick={() => bigUndo()} title="Take away the newest layer (or hold the big button 2 s)">↶ Undo</button>
            <button type="button" className="lps-btn" disabled={!canBigRedo()} onClick={() => bigRedo()} title="Bring back what Undo took away (or hold the big button 2 s again)">↷ Redo</button>
            <ConfirmChip className="lps-btn" label="🗑 Clear all" disabled={!any && st === 'empty'} onConfirm={() => { stopAll(); clearAll() }} />
            <CodeMenu build={loopCode} disabled={!any} what="loop" />
          </div>
          <div className="lps-row lps-opts">
            <button type="button" className={'lps-tog' + (s.countIn > 0 ? ' on' : '')} aria-pressed={s.countIn > 0} onClick={() => setOpt('countIn', s.countIn > 0 ? 0 : 1)}
              title="Four clicks before recording starts, and the loop snaps to whole bars">🥁 Count-in {s.countIn > 0 ? 'on' : 'off'}</button>
            <button type="button" className={'lps-tog' + (guideOn ? ' on' : '')} aria-pressed={guideOn} onClick={() => { unlockGuide(); setGuide({ on: !guideOn }) }} title="A soft drum beat to play along with">🎵 Beat {guideOn ? 'on' : 'off'}</button>
            <button type="button" className={'lps-tog' + (s.metro ? ' on' : '')} aria-pressed={s.metro} onClick={() => setMetronomeOn(!s.metro)}
              title="A soft click on every beat (louder on beat 1). It needs no loop, and it is not recorded. Press Shift+M anywhere to flip it (plain M is the note B).">🔔 Metronome {s.metro ? 'on' : 'off'}</button>
            <label className="lps-bpm" title={tempoTitle}>Tempo <BpmField bpm={bpm} disabled={following || ti.tempoLocked} title={tempoTitle} />{ti.tempoLocked && !following ? <small className="lps-bpm-hint">clear to change tempo</small> : null}</label>
          </div>
          <p className={'lps-timing lps-timing-' + ti.mode} data-timing={ti.mode}>{ti.mode === 'free' ? '〰️' : '📏'} {ti.words}</p>
          <div className="lps-row lps-opts">
            {/* many instruments in one loop: each new layer can be a different sound */}
            <label className="lps-next" title="The sound your next layer records with. Stack a bass, then piano, then a synth!">Next layer sound{' '}
              <select value={nextSound()} onChange={(e) => setNextSound(e.target.value)} aria-label="Next layer sound">
                {INSTRUMENTS().filter((x) => x !== 'follow').map((x) => <option key={x} value={x}>{instLabel(x)}</option>)}
              </select>
            </label>
          </div>
          <p className="lps-keys"><kbd>Space</kbd> = the big button · press twice = stop · hold 2 s = undo / redo (stopped: clear) · <kbd>Shift</kbd>+<kbd>M</kbd> = metronome</p>
          <PedalStyle here={!!pedalHere} />
          {pedalHere && <p className="lps-keys lps-pedalline" data-pedal-line={pedal.loopStyle ?? 'simple'}>🦶 <b>Foot pedal</b>, {(pedal.loopStyle ?? 'simple') === 'simple'
            ? 'simple style: one tap = record, then one tap = loop it. Tap to add a layer. Two quick taps = stop all. Hold 2 s = clear all.'
            : 'classic style: tap = record, loop, add a layer. Press twice = stop. Hold 2 s = undo / redo (stopped: clear).'}</p>}
        </div>
      </div>
      <ol className="lps-layers" aria-label="Layers">
        {layers.length === 0 && <li className="lps-none">Your layers show up here.</li>}
        {layers.map((i, k) => {
          const L = s.layers[i], live = L.state === 'rec' || L.state === 'over'
          return (
            <li key={i} className={'lps-layer' + (L.mute ? ' muted' : '') + (live ? ' live' : '')}>
              <span className="lps-dot" aria-hidden />
              <b>Layer {k + 1}</b>
              {live ? <span className="lps-inst">recording…</span> : (
                <select className="lps-inst" value={L.inst} aria-label={`Layer ${k + 1} sound`} title="Change this layer's instrument" onChange={(e) => setLayerInst(i, e.target.value)}>
                  {INSTRUMENTS().map((x) => <option key={x} value={x}>{instLabel(x)}</option>)}
                  {!INSTRUMENTS().includes(L.inst) && <option value={L.inst}>{instLabel(L.inst)}</option>}
                </select>
              )}
              <button type="button" className={'lps-mute' + (L.mute ? ' on' : '')} aria-pressed={L.mute} onClick={() => toggleMute(i)} disabled={live} title={L.mute ? 'Unmute this layer' : 'Mute this layer'}>{L.mute ? '🔇 Muted' : '🔊 Mute'}</button>
              <button type="button" className="lps-x" onClick={() => clearLayer(i)} aria-label={`Remove layer ${k + 1}`} title="Remove this layer">✕</button>
            </li>
          )
        })}
      </ol>
      <button type="button" className="lps-adv" onClick={onAdvanced} title="Eight tracks, sync, speed, reverse, effects, save and export">Advanced ▸</button>
    </div>
  )
}
