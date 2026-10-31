import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as RPE } from 'react'
import './dj.css'
import './pulse'
import { MODES, dispatch, ensure, getDeckPos, getVersion, getView, subscribe, type DeckView } from './engine'
import { useDuo, cancelChallenge, startChallenge } from './duo'
import { useCoop } from './coop'
import { useCal } from './calibrate'
import { DjPanels, BandMenu, CoopCard } from './Panels'
import { onBeat } from './clock'
import { BEAT } from './synth'
import { PC_NAMES, SCALE_LABEL } from '../../music/theory'
import type { DeckId } from './map'
import { SurfaceToggle } from '../controller/SurfaceToggle'

const OPEN_KEY = 'koog.dj.open'
const loadOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } }
const PAD_LABELS = [['1', '2', '3', '4'], ['½', '1', '2', '4'], ['💥', '👏', '🎹', '⚡'], ['🥁', '🎸', '🎹', '🎤']]
const PAD_TIPS = [['Jump to 1/4 of the song', 'Jump to 2/4', 'Jump to 3/4', 'Jump to 4/4'], ['Loop half a beat', 'Loop 1 beat', 'Loop 2 beats', 'Loop 4 beats'], ['Boom', 'Clap', 'Chord', 'Zap'], ['Drums on/off', 'Bass on/off', 'Synth on/off', 'Voice on/off']]
const MODE_SHORT = ['CUES', 'LOOP', 'PADS', 'STEMS']

/** a button that sends 1 on press and 0 on release (so cue-preview and held pads work) */
function Hold({ id, deck, className, children, title, lit }: { id: string; deck: DeckId; className: string; children: React.ReactNode; title: string; lit?: boolean }) {
  const down = useRef(false)
  const send = (v: number) => dispatch({ id: id as never, deck, value: v })
  const press = () => { if (down.current) return; down.current = true; void ensure(); send(1) }
  const release = () => { if (!down.current) return; down.current = false; send(0) }
  return (
    <button type="button" className={className + (lit ? ' lit' : '')} title={title} aria-pressed={!!lit}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); press() }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press() } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') release() }}>{children}</button>
  )
}

function Slider({ deck, id, label, value, title, center }: { deck: DeckId; id: string; label: string; value: number; title: string; center?: boolean }) {
  return (
    <label className={'dj-sl' + (center ? ' ctr' : '')} title={title}>
      <span>{label}</span>
      <input type="range" min={0} max={1000} value={Math.round(value * 1000)} aria-label={`Deck ${deck} ${title}`}
        onPointerDown={() => void ensure()}
        onChange={(e) => dispatch({ id: id as never, deck, value: Number(e.target.value) / 1000 })} />
    </label>
  )
}

/** the jog ring: spins with the song, drag it to nudge (playing) or scrub (paused) */
function Jog({ deck, v, spinRef }: { deck: DeckId; v: DeckView; spinRef: (el: HTMLDivElement | null) => void }) {
  const last = useRef<number | null>(null)
  const ang = (e: RPE, el: HTMLElement) => { const r = el.getBoundingClientRect(); return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI }
  return (
    <div className={'dj-jog' + (v.playing ? ' on' : '')} role="slider" aria-label={`Deck ${deck} jog wheel: drag to nudge`} aria-valuenow={0}
      onPointerDown={(e) => { void ensure(); e.currentTarget.setPointerCapture(e.pointerId); last.current = ang(e, e.currentTarget) }}
      onPointerMove={(e) => {
        if (last.current == null) return
        const a = ang(e, e.currentTarget); let d = a - last.current
        if (d > 180) d -= 360; if (d < -180) d += 360
        if (Math.abs(d) < 3) return
        last.current = a; dispatch({ id: 'jog', deck, value: d / 4 })
      }}
      onPointerUp={() => { last.current = null }} onPointerCancel={() => { last.current = null }}>
      <div className="dj-jog-spin" ref={spinRef}><i /></div>
      <span className="dj-jog-lb">{deck}</span>
    </div>
  )
}

function DeckPanel({ deck, v, spinRef }: { deck: DeckId; v: DeckView; spinRef: (el: HTMLDivElement | null) => void }) {
  const labels = PAD_LABELS[v.mode], tips = PAD_TIPS[v.mode]
  const lit = (i: number) => (v.mode === 0 ? v.lastCue === i : v.mode === 1 ? v.loopLen === [0.5, 1, 2, 4][i] : v.mode === 2 ? v.held[i] : !!v.mask[i])
  return (
    <div className={'dj-deck dj-' + deck}>
      <Jog deck={deck} v={v} spinRef={spinRef} />
      <div className="dj-col">
        <div className="dj-row">
          <Hold id="play" deck={deck} className="dj-btn dj-play" lit={v.playing && !v.preview} title={`Deck ${deck} play / pause`}>{v.playing && !v.preview ? '❚❚' : '▶'}</Hold>
          <Hold id="cue" deck={deck} className="dj-btn" lit={v.preview} title="Cue: hold to preview, tap while playing to go back to the start">CUE</Hold>
          <Hold id="sync" deck={deck} className="dj-btn" lit={v.synced} title="Sync to the other deck's speed and beat">SYNC</Hold>
          <Hold id="padmode" deck={deck} className="dj-btn dj-mode" title="Pad mode: CUES, LOOP, PADS (sounds), STEMS (mute parts)">{MODE_SHORT[v.mode]}</Hold>
          {[0, 1, 2, 3].map((i) => <Hold key={i} id={'pad' + (i + 1)} deck={deck} className={'dj-pad m' + v.mode} lit={lit(i)} title={`${MODES[v.mode]}: ${tips[i]}`}>{labels[i]}</Hold>)}
        </div>
        <div className="dj-row dj-sls">
          <Slider deck={deck} id="vol" label="VOL" value={v.vol} title="Volume" />
          <Slider deck={deck} id="tempo" label="TEMPO" value={v.tempo} title="Tempo (speed)" center />
          <Slider deck={deck} id="hi" label="HI" value={v.hi} title="Treble" center />
          <Slider deck={deck} id="low" label="LOW" value={v.low} title="Bass" center />
        </div>
      </div>
    </div>
  )
}

function BeatDots() {
  const [b, setB] = useState(-1)
  useEffect(() => onBeat((x) => setB(x.beat)), [])
  return <span className="dj-dots" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} className={b === i ? 'on' : ''} />)}</span>
}

function Middle({ v }: { v: ReturnType<typeof getView> }) {
  const [menu, setMenu] = useState(false)
  const coop = useCoop((s) => s.active)
  useEffect(() => {
    const d = document.querySelector('.kg-display')
    if (menu) d?.setAttribute('data-dj-menu', '1'); else d?.removeAttribute('data-dj-menu')
    return () => d?.removeAttribute('data-dj-menu')
  }, [menu])
  const djKey = useDuo((s) => s.djKey)
  const combo = useDuo((s) => s.combo)
  const bandPaused = useDuo((s) => s.bandPaused)
  const ch = useDuo((s) => s.challenge)
  const keyText = djKey ? `${PC_NAMES[djKey.tonic]} ${SCALE_LABEL[djKey.scale]}` : '—'
  const bpm = Math.round((v.lead ? v[v.lead].bpm : v.anyPlaying ? (v.A.playing ? v.A.bpm : v.B.bpm) : 0) || 0)
  let status = ''
  if (coop && !coop.done) status = `🤝 round ${coop.round}/3 · ${'★'.repeat(coop.stars)}${'☆'.repeat(3 - coop.stars)}`
  else if (ch.state === 'wait') status = '🎯 starts on the next bar…'
  else if (ch.state === 'run') status = `🎯 bar ${Math.min(8, Math.floor((ch.beats - 1) / 4) + 1)}/8 · ${ch.hits}/32`
  else if (ch.state === 'done') status = `🎯 ${'★'.repeat(ch.stars)}${'☆'.repeat(3 - ch.stars)} ${ch.hits}/32 on the beat`
  else if (v.fx) status = v.fx === 'echo' ? '🌊 echo' : v.fx === 'sweep' ? '🌀 sweep' : '🚀 riser…'
  else if (combo >= 2) status = `🎹 on beat ×${combo}`
  else if (bandPaused) status = '🤖 band waits for the DJ'
  return (
    <div className="dj-mid">
      <div className="dj-key" title="The DJ's track sets the key for the piano while a deck plays">🎧 DJ key <b>{keyText}</b>
        <button type="button" className="dj-go dj-band" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} title="Team challenges, Soundcheck, and the controller helper">🤝</button>
        {menu && <BandMenu onClose={() => setMenu(false)} />}
      </div>
      <label className="dj-xf" title="Crossfader: A on the left, B on the right">
        <span>A</span>
        <input type="range" min={0} max={1000} value={Math.round(v.xf * 1000)} aria-label="Crossfader" onPointerDown={() => void ensure()}
          onChange={(e) => dispatch({ id: 'xfade', deck: null, value: Number(e.target.value) / 1000 })} />
        <span>B</span>
      </label>
      <div className="dj-info">
        <BeatDots /><span className="dj-bpm">{bpm ? `${bpm} BPM` : '— BPM'}</span>
        {ch.state === 'idle' || ch.state === 'done'
          ? <button type="button" className="dj-go" disabled={!v.anyPlaying} onClick={() => startChallenge()} title="Duo Challenge: land notes on the DJ's beat for 8 bars">🎯 8 bars</button>
          : <button type="button" className="dj-go" onClick={() => cancelChallenge()}>✕</button>}
      </div>
      <div className="dj-status" aria-live="polite">{status}</div>
      <SurfaceToggle />
    </div>
  )
}

/**
 * DUO: a slim two-deck strip docked at the bottom of the display, inside PLAY, so the piano visuals keep playing above it.
 * A chip at the top right opens and closes it. Everything works by mouse or touch; a Numark controller drives the same decks.
 */
export function DuoDeck() {
  useSyncExternalStore(subscribe, getVersion)
  const v = getView()
  const [open, setOpen] = useState(loadOpen)
  const root = useRef<HTMLDivElement>(null)
  const spin = useRef<Record<DeckId, HTMLDivElement | null>>({ A: null, B: null })
  const combo = useDuo((s) => s.combo)
  void combo

  const toggle = () => { setOpen((o) => { const n = !o; try { localStorage.setItem(OPEN_KEY, n ? '1' : '0') } catch { /* ignore */ } return n }); void ensure() }
  // dock layout: tell the display to make room for the strip (dj.css moves the visual controls up)
  useEffect(() => {
    const d = root.current?.closest('.kg-display')
    if (!d) return
    if (open) d.setAttribute('data-duo-open', '1'); else d.removeAttribute('data-duo-open')
    return () => d.removeAttribute('data-duo-open')
  }, [open])
  // a panel (teach / knob check / soundcheck) covers the display: hide the visualizer's own buttons under it
  const panel = useCal((s) => s.panel)
  useEffect(() => {
    const d = root.current?.closest('.kg-display')
    if (!d) return
    if (panel !== 'none') d.setAttribute('data-dj-panel', '1'); else d.removeAttribute('data-dj-panel')
    return () => d.removeAttribute('data-dj-panel')
  }, [panel])
  // a controller press opens the strip once, so the DJ sees what the decks are doing
  useEffect(() => { if (v.anyPlaying && !open && !loadOpen()) setOpen(true) }, [v.anyPlaying, open])

  // spin the jog rings with the music (off for prefers-reduced-motion)
  useEffect(() => {
    if (!open || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const loop = () => {
      for (const d of ['A', 'B'] as DeckId[]) {
        const el = spin.current[d]
        if (el) el.style.transform = `rotate(${((getDeckPos(d) / (BEAT * 4)) * 360).toFixed(1)}deg)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [open])

  return (
    <div className="dj-root" ref={root}>
      <button type="button" className={'dj-chip' + (open ? ' on' : '') + (v.anyPlaying ? ' live' : '')} aria-pressed={open} onClick={toggle}
        title="DUO: a DJ deck for a second player. The DJ's track sets the key and the beat for the piano.">
        <span aria-hidden>🎧</span> <b>DUO</b>
        {v.anyPlaying && <i className="dj-chip-dot" aria-hidden />}
      </button>
      {open && (
        <div className="dj-bar" role="group" aria-label="DJ decks">
          {(v.needsTap || v.suspended) && <button type="button" className="dj-wake" onClick={() => void ensure()}>👆 Tap to wake the decks</button>}
          <DeckPanel deck="A" v={v.A} spinRef={(el) => { spin.current.A = el }} />
          <Middle v={v} />
          <DeckPanel deck="B" v={v.B} spinRef={(el) => { spin.current.B = el }} />
        </div>
      )}
      <CoopCard />
      <DjPanels />
    </div>
  )
}
