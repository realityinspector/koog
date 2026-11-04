import { useEffect, useRef, useState } from 'react'
import './drumpads.css'
import { ControllerPic } from '../dj/Controller'
import { setBpm, tapTempo, useMaster } from '../../music/masterClock'
import { useProfile } from '../../profile/profile'
import { useScreen } from '../../layout/screenStore'
import { currentPage, setControllerPage, useLoopPage } from '../loopstation/loopSurface'
import { useSurface } from '../controller/surface'
import { BANK_NAMES, HELP_MAP, REPEAT_NAMES, STARTERS, VOICES, N_BANKS, padName, pagesOf, statusLine } from './drumCore'
import { KITS } from './drumKit'
import {
  clearMuteSolo, clearPattern, clearVoiceRow, copyBar12, currentStep, loadStarter, onDrumHit, previewVoice, selectBank, setBars, setChain, setKit, setPatVol, setRepeat, setSwing, setTweak, setVol, startFill, stopFill,
  toggleAccentStep, toggleMute, toggleRec, togglePlay, toggleSolo, toggleStep, undoPass, unlockDrums, useDrums,
} from './drumEngine'
import { drumInput, drumLabels, hintFor, useDrumPage, useDrumView, voicePad } from './drumSurface'
import { drumsOpen } from './pedalKick'

// The drum machine panel: 8 big pads (2 rows of 4, like the controller), a 16-step grid, and the basics (PLAY, REC, tempo, swing, kit).
// Pads on screen use the same input path as the controller's pads (drumInput), so hold-to-clear and note repeat work the same.

function Pad({ v, reg }: { v: number; reg: (el: HTMLButtonElement | null) => void }) {
  const def = VOICES[v], id = voicePad(v), name = padName(v)
  const held = useDrums((s) => s.held[v])
  const muted = useDrums((s) => s.mute[v]), soloed = useDrums((s) => s.solo[v])
  const down = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); unlockDrums(); drumInput(id, 1, 100) }
  const up = () => drumInput(id, 0)
  const kd = (e: React.KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); drumInput(id, 1, 100) } }
  const ku = (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drumInput(id, 0) } }
  return (
    <button type="button" ref={reg} className={'dp-pad' + (held ? ' down' : '') + (muted ? ' muted' : '') + (soloed ? ' solo' : '')} style={{ ['--h' as string]: def.hue }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onKeyDown={kd} onKeyUp={ku} onBlur={up} aria-label={`${def.label} pad, controller pad ${name}`} title={`${def.label} is pad ${name} on the DJ controller. It lights up brighter the harder it is hit. Hold 1 second while stopped to clear its row.`}>
      <span className="dp-pad-n" aria-hidden>{name}</span>
      <span className="dp-pad-e" aria-hidden>{def.emoji}</span>
      <span className="dp-pad-l">{def.label}</span>
      {(muted || soloed) && <span className="dp-pad-m" aria-hidden>{soloed ? 'SOLO' : 'MUTE'}</span>}
    </button>
  )
}

/** deck A pads on the left, deck B pads on the right, just like the controller. A pad glows when its drum sounds; louder hits glow brighter. */
function Pads() {
  const els = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const last = VOICES.map(() => -1e9), timers: number[] = []
    const off = onDrumHit((h) => {
      if (h.at - last[h.voice] < 340) return // at most about 3 glows a second per pad
      last[h.voice] = h.at
      const t = window.setTimeout(() => {
        const el = els.current[h.voice]; if (!el) return
        el.style.setProperty('--vel', String(Math.max(0.2, Math.min(1, h.vel))))
        el.classList.add('hit'); timers.push(window.setTimeout(() => el.classList.remove('hit'), 140))
      }, Math.max(0, h.at - performance.now()))
      timers.push(t)
    })
    return () => { off(); timers.forEach(clearTimeout) }
  }, [])
  const deck = (d: 'A' | 'B', from: number) => (
    <div className="dp-deck" role="group" aria-label={`Deck ${d} pads (${d === 'A' ? 'left' : 'right'} side of the controller)`}>
      <span className="dp-deck-t">DECK {d} · {d === 'A' ? 'left' : 'right'}</span>
      <div className="dp-pads">{[0, 1, 2, 3].map((k) => <Pad key={from + k} v={from + k} reg={(el) => { els.current[from + k] = el }} />)}</div>
    </div>
  )
  return <div className="dp-decks" role="group" aria-label="Drum pads">{deck('A', 0)}{deck('B', 4)}</div>
}

function StepGrid() {
  const pat = useDrums((s) => s.pat)
  const running = useDrums((s) => s.running)
  const mute = useDrums((s) => s.mute), solo = useDrums((s) => s.solo)
  const P = { edit: useDrumPage((s) => s.edit), editVoice: useDrumPage((s) => s.editVoice), editPage: useDrumPage((s) => s.editPage) }
  const [bar, setBar] = useState(0)
  const [step, setStep] = useState(-1)
  useEffect(() => {
    if (!running) { setStep(-1); return }
    let last = -2
    const h = window.setInterval(() => { const s = currentStep(); if (s !== last) { last = s; setStep(s) } }, 40)
    return () => clearInterval(h)
  }, [running])
  const two = pat.len === 32
  const b = two ? bar : 0
  const cols = Array.from({ length: 16 }, (_, i) => b * 16 + i)
  const editPage = Math.min(P.editPage ?? 0, pagesOf(pat.len) - 1)
  const inPage = (s: number) => P.edit && Math.floor(s / 8) === editPage
  return (
    <div className="dp-seq" role="group" aria-label="Step pattern">
      {two && (
        <div className="dp-bars" role="tablist" aria-label="Which bar to edit">
          {[0, 1].map((n) => <button key={n} type="button" role="tab" aria-selected={bar === n} className={'dp-chip' + (bar === n ? ' on' : '') + (running && step >= 0 && Math.floor(step / 16) === n ? ' now' : '')} onClick={() => setBar(n)}>Bar {n + 1}</button>)}
        </div>
      )}
      <div className="dp-scroll" tabIndex={0} aria-label="Step grid, scrolls sideways on a small screen">
        <div className="dp-grid">
          <div className="dp-row dp-acc">
            <span className="dp-rl"><b title="Accent: a louder step. Every drum on an accented step plays harder.">ACCENT</b></span>
            {cols.map((s) => (
              <button key={s} type="button" aria-pressed={pat.acc[s] > 0} aria-label={`Accent on step ${s + 1}`} title="Accent: this step plays louder"
                className={'dp-cell acc' + (pat.acc[s] > 0 ? ' on' : '') + (s % 4 === 0 ? ' beat' : '') + (inPage(s) ? ' pg' : '')} onClick={() => toggleAccentStep(s)} />
            ))}
            <span />
          </div>
          {VOICES.map((def, v) => (
            <div className={'dp-row' + (P.edit && (P.editVoice ?? 0) === v ? ' editing' : '') + (mute[v] ? ' muted' : '')} key={def.id} style={{ ['--h' as string]: def.hue }}>
              <span className="dp-rl">
                <button type="button" className="dp-rlb" onClick={() => previewVoice(v)} title={`Hear ${def.label} (controller pad ${padName(v)})`}><span aria-hidden>{def.emoji}</span><b>{def.label}</b></button>
                <button type="button" className={'dp-ms m' + (mute[v] ? ' on' : '')} aria-pressed={mute[v]} onClick={() => toggleMute(v)} aria-label={`Mute ${def.label}`} title={`Mute ${def.label} (on the controller: hold SYNC and tap pad ${padName(v)})`}>M</button>
                <button type="button" className={'dp-ms s' + (solo[v] ? ' on' : '')} aria-pressed={solo[v]} onClick={() => toggleSolo(v)} aria-label={`Solo ${def.label}`} title={`Solo ${def.label}: only soloed drums play (on the controller: hold PLAY and tap pad ${padName(v)})`}>S</button>
              </span>
              {cols.map((s) => (
                <button key={s} type="button" aria-pressed={pat.rows[v][s] > 0} aria-label={`${def.label} step ${s + 1}`}
                  className={'dp-cell' + (pat.rows[v][s] > 0 ? ' on' : '') + (pat.rows[v][s] > 0 && pat.rows[v][s] < 0.8 ? ' soft' : '') + (pat.acc[s] > 0 ? ' accd' : '') + (s % 4 === 0 ? ' beat' : '') + (s === step ? ' now' : '') + (inPage(s) ? ' pg' : '')} onClick={() => toggleStep(v, s)} />
              ))}
              <button type="button" className="dp-rx" onClick={() => clearVoiceRow(v)} aria-label={`Clear ${def.label} row`} title={`Clear the ${def.label} row`}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ on, children, ...r }: { on?: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={'dp-chip' + (on ? ' on' : '')} aria-pressed={on} {...r}>{children}</button>
}

function Main() {
  const D = useDrums()
  const bpm = useMaster((s) => s.bpm)
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const h = window.setTimeout(() => setSure(false), 3000); return () => clearTimeout(h) }, [sure])
  return (
    <div className="dp-main">
        <button type="button" className={'dp-big play' + (D.running ? ' on' : '')} aria-pressed={D.running} onClick={() => { unlockDrums(); togglePlay() }} title="Start / stop the beat">{D.running ? '■ STOP' : '▶ PLAY'}</button>
        <button type="button" className={'dp-big rec' + (D.rec ? ' on' : '')} aria-pressed={D.rec} onClick={() => { unlockDrums(); toggleRec() }} title="Record: while the beat plays, pads you hit are added to the pattern">● REC</button>
        <button type="button" className={'dp-big fill' + (D.fill ? ' on' : '')} aria-pressed={D.fill} title="FILL: hold it for a fast roll that gets louder. It plays over the beat and is never recorded. (Controller: hold PAD MODE and hold pad B4.)"
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); unlockDrums(); startFill() }} onPointerUp={stopFill} onPointerCancel={stopFill} onLostPointerCapture={stopFill}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startFill() } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stopFill() }} onBlur={stopFill}>FILL</button>
        <Chip onClick={undoPass} disabled={!D.canUndo} title="Undo the last recording or clear">↶ Undo</Chip>
        {sure ? <><Chip onClick={() => { clearPattern(); setSure(false) }} title="Yes, clear everything">Clear all?</Chip><Chip onClick={() => setSure(false)}>No</Chip></> : <Chip onClick={() => setSure(true)} title="Clear every drum">Clear all</Chip>}
        <span className="dp-bpm" role="group" aria-label="Tempo">
          <button type="button" className="dp-chip" onClick={() => setBpm(bpm - 1)} aria-label="Slower">−</button>
          <b aria-live="off">{Math.round(bpm)}</b><small>bpm</small>
          <button type="button" className="dp-chip" onClick={() => setBpm(bpm + 1)} aria-label="Faster">+</button>
          <Chip onClick={() => tapTempo()} title="Tap this in time to set the tempo">TAP</Chip>
        </span>
      </div>
  )
}

function Opts() {
  const D = useDrums()
  const tw = D.tweak[D.lastVoice]
  return (
    <div className="dp-ctl">
      <div className="dp-opts">
        <span className="dp-grp" role="group" aria-label="Pattern banks">Pattern {Array.from({ length: N_BANKS }, (_, i) => (
          <button key={i} type="button" className={'dp-chip bank' + (D.bank === i ? ' on' : '') + (D.queued === i ? ' q' : '')} aria-pressed={D.bank === i} onClick={() => selectBank(i)}
            title={`Pattern ${BANK_NAMES[i]}${D.banksUsed[i] ? '' : ' (empty)'}. ${D.running ? 'It starts at the end of the bar.' : 'Switches now.'} On the controller: hold PAD MODE and tap pad A${i + 1}.`}>{BANK_NAMES[i]}{D.banksUsed[i] ? ' ●' : ''}</button>
        ))}</span>
        <Chip on={D.chain} onClick={() => setChain(!D.chain)} title="Chain: the patterns that have beats in them play one after another, switching at the bar line. (Controller: PAD MODE + B1)">Chain</Chip>
        <Chip onClick={copyBar12} title="Copy bar 1 onto bar 2 and make the pattern two bars long, ready to vary. (Controller: PAD MODE + B2)">Copy bar 1 → 2</Chip>
        {(D.mute.some(Boolean) || D.solo.some(Boolean)) && <Chip onClick={clearMuteSolo} title="Every drum back on. (Controller: PAD MODE + B3)">All drums on</Chip>}
      </div>
      <div className="dp-opts">
        <label className="dp-sl" title="Swing: push every second 16th note late for a bouncy feel">Swing <input type="range" min={0} max={60} step={1} value={Math.round(D.swing * 100)} onChange={(e) => setSwing(Number(e.target.value) / 100)} /><i>{Math.round(D.swing * 100)}%</i></label>
        <label className="dp-sl" title="Drum volume">Volume <input type="range" min={0} max={100} value={Math.round(D.vol * 100)} onChange={(e) => setVol(Number(e.target.value) / 100)} /></label>
        <label className="dp-sl" title="How loud the beat plays compared with the pads you hit">Beat <input type="range" min={0} max={100} value={Math.round(D.patVol * 100)} onChange={(e) => setPatVol(Number(e.target.value) / 100)} /></label>
      </div>
      <div className="dp-opts">
        <span className="dp-grp" role="group" aria-label="Drum kit">Kit {KITS.map((k, i) => <Chip key={k.id} on={D.kit === i} title={k.blurb} onClick={() => { unlockDrums(); setKit(i); previewVoice(0) }}>{k.name}</Chip>)}</span>
        <span className="dp-grp" role="group" aria-label="Pattern length">Length <Chip on={D.pat.len === 16} onClick={() => setBars(1)}>1 bar</Chip><Chip on={D.pat.len === 32} onClick={() => setBars(2)}>2 bars</Chip></span>
        <span className="dp-grp" role="group" aria-label="Note repeat">Roll {REPEAT_NAMES.map((n, i) => <Chip key={n} on={D.repeat === i} title="Hold a pad and it keeps hitting in time" onClick={() => setRepeat(i)}>{n}</Chip>)}</span>
      </div>
      <div className="dp-opts">
        <span className="dp-grp" role="group" aria-label="Starter beats">Start with {STARTERS.map((s) => <Chip key={s.id} onClick={() => { unlockDrums(); loadStarter(s.id) }} title={`${s.name}, ${s.bpm} bpm`}>{s.name}</Chip>)}</span>
      </div>
      <details className="dp-more">
        <summary>Shape the {VOICES[D.lastVoice].label.toLowerCase()} sound</summary>
        <div className="dp-opts">
          <label className="dp-sl">Pitch <input type="range" min={-100} max={100} value={Math.round(tw.pitch * 100)} onChange={(e) => setTweak(D.lastVoice, { pitch: Number(e.target.value) / 100 })} /></label>
          <label className="dp-sl">Decay <input type="range" min={0} max={100} value={Math.round(tw.decay * 100)} onChange={(e) => setTweak(D.lastVoice, { decay: Number(e.target.value) / 100 })} /></label>
          <label className="dp-sl">Tone <input type="range" min={0} max={100} value={Math.round(tw.tone * 100)} onChange={(e) => setTweak(D.lastVoice, { tone: Number(e.target.value) / 100 })} /></label>
          <small>Hit a pad first, then shape it.</small>
        </div>
      </details>
    </div>
  )
}

function DrumPicture() {
  const v = useDrumView()
  const synth = useSurface((s) => s.on)
  const loop = useLoopPage((s) => s.on)
  const page = currentPage(synth, loop, v.on)
  const now = performance.now()
  const note = useDrums((s) => s.note)
  const ctl = Object.fromEntries(Object.entries(v.values).map(([k, x]) => [k, { v: x, n: 1 }]))
  const hot = Object.fromEntries(Object.entries(v.touched).filter(([, t]) => now - t < 600).map(([k]) => [k, true]))
  return (
    <div className="dp-pic">
      <div className="dp-pic-head">
        <Chip on={page === 'drums'} onClick={() => setControllerPage(page === 'drums' ? 'dj' : 'drums')}>{page === 'drums' ? '🥁 Controller is on the Drums page' : '🥁 Put the controller on the Drums page'}</Chip>
        <small>{note || 'Tap the pads. PLAY starts the beat, REC records what you tap.'}</small>
      </div>
      <ControllerPic ctl={ctl} labels={drumLabels()} ghost={v.ghost} hot={hot} interactive title="DRUMS" onSend={(id, val) => drumInput(id, val)} />
    </div>
  )
}

/** the whole drum machine */
function Help() {
  return (
    <details className="dp-help">
      <summary title="Every control on the DJ controller when it is the drum machine">How to drum on the controller</summary>
      <p className="dp-help-in">Set the DJ controller to <b>Drums</b> in the devices menu. The left four pads (deck A) and right four pads (deck B) match the pads on screen.</p>
      <dl>{HELP_MAP.map((h) => <div key={h.keys}><dt>{h.keys}</dt><dd>{h.does}</dd></div>)}</dl>
      <p className="dp-help-in">The foot pedal plays the KICK while the drum pads are open (set it to Automatic or Kick drum).</p>
    </details>
  )
}

function Status() {
  const D = useDrums()
  const bpm = useMaster((s) => s.bpm)
  const P = { edit: useDrumPage((s) => s.edit), editVoice: useDrumPage((s) => s.editVoice), editPage: useDrumPage((s) => s.editPage), mods: useDrumPage((s) => s.mods) }
  const line = statusLine({ running: D.running, rec: D.rec, bank: D.bank, queued: D.queued, chain: D.chain, kitName: KITS[D.kit].name, bpm, edit: !!P.edit, editVoice: P.editVoice ?? 0, page: Math.min(P.editPage ?? 0, pagesOf(D.pat.len) - 1), pages: pagesOf(D.pat.len),
    muted: D.mute.filter(Boolean).length, solo: D.solo.filter(Boolean).length, fill: D.fill })
  const hint = hintFor(P.mods ?? { padmode: false, cue: false, sync: false, play: false }, !!P.edit)
  return (
    <div className="dp-status" role="status" aria-live="polite">
      <b className={D.rec ? 'rec' : D.running ? 'go' : ''}>{line}</b>
      <small>{hint || D.note || 'Tap a pad to hear it. PLAY starts a beat, REC adds what you tap.'}</small>
    </div>
  )
}

export function DrumPads({ onClose }: { onClose?: () => void }) {
  const [pic, setPic] = useState(false)
  useEffect(() => { drumsOpen(1); return () => drumsOpen(-1) }, [])
  return (
    <div className="dp" role="region" aria-label="Drum pads">
      <header className="dp-head">
        <h3>🥁 Drum pads</h3>
        <Status />
        <Chip on={pic} onClick={() => setPic(!pic)} title="Show the drawn DJ controller">controller</Chip>
        {onClose && <button type="button" className="dp-chip" onClick={onClose} title="Back to the piano">✕ Close</button>}
      </header>
      <div className="dp-body">
        <div className="dp-left"><Pads /><Main /></div>
        <StepGrid />
      </div>
      <Opts />
      <Help />
      {pic && <DrumPicture />}
    </div>
  )
}

/** Kid-mode mount: docked over the piano visuals while the Drums page is on (Boss mode has a DRUMS screen instead). */
export function DrumsDock() {
  const on = useDrumPage((s) => s.on)
  const screen = useScreen((s) => s.screen)
  const mode = useProfile((s) => s.mode)
  if (!on || screen !== 'play' || mode === 'dad') return null
  return <div className="dp-dock"><DrumPads onClose={() => setControllerPage('dj')} /></div>
}

/** Boss-mode rail screen */
export function DrumsScreen() { return <div className="bx-screen"><DrumPads /></div> }
