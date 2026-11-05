import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './padplay.css'
import { ControllerPic } from '../dj/Controller'
import { useDevices } from '../../music/devices'
import { useScreen } from '../../layout/screenStore'
import { PAD_IDS, padLabelMap, padName } from './padCore'
import { gameInput, padHit, padLift, setGamePads, setMap, setOctave, usePadPlay } from './padplay'

function Pad({ i }: { i: number }) {
  const label = usePadPlay((s) => s.labels[i]), lit = usePadPlay((s) => s.targetPads.includes(i)), down = usePadPlay((s) => s.down[i])
  const on = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); padHit(i, 100) }
  const off = () => padLift(i)
  return (
    <button type="button" className={'gp-pad' + (lit ? ' lit' : '') + (down ? ' down' : '')} style={{ ['--h' as string]: 200 + i * 20 }} onPointerDown={on} onPointerUp={off} onPointerCancel={off} onLostPointerCapture={off}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); padHit(i, 100) } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') padLift(i) }} onBlur={off}
      aria-label={`Pad ${padName(i)}, note ${label}${lit ? ', play this one next' : ''}`} title={`Pad ${padName(i)} plays ${label}${lit ? '. This is the one to play next.' : ''}`}>
      <span className="gp-n" aria-hidden>{padName(i)}</span>
      <span className="gp-l">{label}</span>
    </button>
  )
}

const Chip = ({ on, children, ...r }: { on?: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={'gp-chip' + (on ? ' on' : '')} aria-pressed={on} {...r}>{children}</button>

/** the 8 big game pads (touch / mouse), the map switch, octave and the drawn controller with its note labels */
export function GamePadsDock() {
  const s = usePadPlay()
  const hw = useDevices((d) => d.devices.some((x) => x.connected && x.role === 'gamepads'))
  const [pic, setPic] = useState(false)
  const [small, setSmall] = useState(false)
  const [top, setTop] = useState(() => { try { return localStorage.getItem('koog.padplay.top') === '1' } catch { return false } })
  const flip = () => { const t = !top; setTop(t); try { localStorage.setItem('koog.padplay.top', t ? '1' : '0') } catch { /* ignore */ } }
  if (!s.on) return null
  const ctl = Object.fromEntries(PAD_IDS.map((id, i) => [id, { v: s.down[i] || s.targetPads.includes(i) ? 1 : 0, n: 1 }]))
  const hotIds = Object.fromEntries(PAD_IDS.filter((id) => performance.now() - (s.touched[id] ?? -1e9) < 600).map((id) => [id, true]))
  return (
    <div className={'gp-dock' + (small ? ' small' : '') + (hw && !pic ? ' slim' : '') + (top ? ' top' : '')} role="region" aria-label="Game pads">
      <header className="gp-head">
        <b>🎮 Game pads</b>
        <span className="gp-grp" role="group" aria-label="What the pads play">
          <Chip on={s.map === 'scale'} onClick={() => setMap('scale')} title="The 8 pads are the 8 notes of the key, low to high">Scale</Chip>
          <Chip on={s.map === 'follow'} onClick={() => setMap('follow')} title="The pad that lights up is always the next note the game wants. Hit the lit pad to play any song or game.">Follow the game</Chip>
        </span>
        <span className="gp-grp" role="group" aria-label="Octave">
          <Chip onClick={() => setOctave(s.oct - 1)} disabled={s.oct <= -2} title="Pads one octave lower (JOG A on the controller)" aria-label="Octave down">−</Chip>
          <small aria-live="off">oct {s.oct > 0 ? '+' : ''}{s.oct}</small>
          <Chip onClick={() => setOctave(s.oct + 1)} disabled={s.oct >= 2} title="Pads one octave higher (JOG A on the controller)" aria-label="Octave up">+</Chip>
        </span>
        <Chip on={pic} onClick={() => setPic(!pic)} title="Show the drawn DJ controller with the note on each pad">controller</Chip>
        <Chip onClick={flip} aria-label={top ? 'Move the pads to the bottom' : 'Move the pads to the top'} title={top ? 'Move the pads to the bottom of the screen' : 'Move the pads to the top, out of the way of the bottom of the game'}>{top ? '⇩' : '⇧'}</Chip>
        <Chip onClick={() => setSmall(!small)} aria-label={small ? 'Show the pads' : 'Hide the pads'} title={small ? 'Show the pads' : 'Tuck the pads away'}>{small ? '▴' : '▾'}</Chip>
        <Chip onClick={() => { setGamePads(false) }} title="Turn Game pads off">✕ Off</Chip>
      </header>
      {!small && <>
        <div className="gp-pads" role="group" aria-label="Eight game pads, low notes on the left">
          {PAD_IDS.map((_, i) => <Pad key={i} i={i} />)}
        </div>
        <small className="gp-hint">{s.note || 'Hit the pads to play notes. PLAY = Start, CUE = hear again, SYNC = back, JOG A = octave.'}</small>
        {pic && <div className="gp-pic"><ControllerPic ctl={ctl} labels={padLabelMap(s.labels, s.oct, s.map)} hot={hotIds} interactive title="GAMES" onSend={(id, v) => gameInput(id, v, 100)} /></div>}
      </>}
    </div>
  )
}

/** a small nudge in the Games menu when a DJ controller is plugged in and Game pads is off */
export function GamePadsHint() {
  const screen = useScreen((s) => s.screen), game = useScreen((s) => s.game)
  const has = useDevices((d) => d.devices.some((x) => x.connected && ['dj', 'surface', 'loop', 'drums'].includes(x.role)))
  const on = usePadPlay((s) => s.on)
  if (screen !== 'games' || game || !has || on) return null
  return (
    <div className="gp-nudge" role="note">
      <span>🎮 Your DJ controller can play games: turn on Game pads</span>
      <button type="button" className="gp-chip" onClick={() => setGamePads(true)} title="The 8 pads become notes for every game and song">Turn on</button>
    </div>
  )
}

/** Mounts the dock and the nudge on top of the game / mode screens (they cover the normal overlay): into the display, above the screens, below the glass. */
export function GamePadsLayer() {
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => { setHost(document.querySelector('.kg-display')) }, [])
  if (!host) return null
  return createPortal(<><GamePadsDock /><GamePadsHint /></>, host)
}
