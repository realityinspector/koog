import { useRef } from 'react'
import { useProfile } from '../../profile/profile'
import { unlockAudio } from '../../music/localNotes'
import { buildLayout } from '../keyboard/layout'
import { ZONE_COLORS, ZONE_SOUNDS, activeIdx, learnSplit, setFocusedZone, setSplitPoint, setZone, setZoneMode, useZones, zoneRange, getFocusedZone, type ZoneMode } from '../../music/zones'
import './split.css'

const MODES: [ZoneMode, string, string][] = [
  ['single', 'Single', 'One sound across the whole keyboard'],
  ['split', 'Split', 'Left hand one sound, right hand another'],
  ['layer', 'Layer', 'Two sounds stacked on every key'],
  ['both', 'Split + layer', 'Left hand one sound, right hand two layered'],
]
const NAMES = ['Left hand', 'Right hand', 'Layer']
const LAYER_NAMES = ['Sound A', 'Sound B', 'Sound C']
const LO = 36, HI = 96
const KEYS = buildLayout(LO, HI)
const zoneName = (mode: ZoneMode, i: number) => (mode === 'layer' ? LAYER_NAMES[i] : NAMES[i])
const noteName = (n: number) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n / 12) - 1)
const edge = (n: number) => { const k = KEYS.find((x) => x.note === Math.max(LO, Math.min(HI, n))); return k ? (k.black ? k.left + k.width / 2 : k.left) : 0 }

/** Keyboard split and layering: a mini keyboard with coloured zones, and a sound / transpose / volume row per zone. Dad and Pro only. */
export function SplitControl({ force = false }: { force?: boolean }) {
  const userMode = useProfile((s) => s.mode)
  const s = useZones()
  const drag = useRef(false)
  if (userMode === 'kid' && !force) return null
  const act = activeIdx(s.mode)
  const canSplit = s.mode === 'split' || s.mode === 'both'
  const focused = getFocusedZone()
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), pct = ((e.clientX - r.left) / r.width) * 100
    const k = KEYS.filter((x) => !x.black).find((x) => pct >= x.left && pct < x.left + x.width) ?? KEYS[KEYS.length - 1]
    setSplitPoint(k.note)
  }
  const bandRow = (i: number) => (s.mode === 'layer' ? i : s.mode === 'both' && i === 2 ? 1 : 0)
  const rows = s.mode === 'layer' || s.mode === 'both' ? 2 : 1
  return (
    <div className="kg-split" role="group" aria-label="Keyboard split and layers">
      <div className="kg-split-modes" role="group" aria-label="Keyboard mode">
        {MODES.map(([m, l, t]) => <button key={m} type="button" title={t} className={s.mode === m ? 'on' : ''} aria-pressed={s.mode === m} onClick={() => { setZoneMode(m); void unlockAudio() }}>{l}</button>)}
      </div>
      {s.mode !== 'single' && (
        <>
          <div className="kg-split-kb" style={{ height: 28 + rows * 16 }}
            onPointerDown={(e) => { if (!canSplit) return; drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); at(e) }}
            onPointerMove={(e) => { if (drag.current) at(e) }} onPointerUp={() => { drag.current = false }} onPointerCancel={() => { drag.current = false }}>
            <div className="kg-split-keys">
              {KEYS.map((k) => <i key={k.note} className={k.black ? 'b' : 'w'} style={{ left: k.left + '%', width: k.width + '%' }} />)}
            </div>
            {act.filter((i) => s.zones[i].on).map((i) => {
              const [lo, hi] = zoneRange(s.mode, s.split, i)
              const l = edge(lo), r = hi >= HI ? 100 : edge(hi + 1)
              return <div key={i} className="kg-split-band" style={{ left: l + '%', width: Math.max(0, r - l) + '%', top: 28 + bandRow(i) * 16, background: ZONE_COLORS[i] }}>{zoneName(s.mode, i)}</div>
            })}
            {canSplit && <div className="kg-split-line" style={{ left: edge(s.split) + '%' }} title={'Split at ' + noteName(s.split)} />}
          </div>
          {canSplit && (
            <div className="kg-split-pt">
              <label>Split at <b>{noteName(s.split)}</b>
                <input type="range" min={36} max={96} value={s.split} aria-label="Split point" onChange={(e) => setSplitPoint(+e.target.value)} />
              </label>
              <button type="button" className={s.learning ? 'on' : ''} aria-pressed={s.learning} onClick={() => { learnSplit(!s.learning); void unlockAudio() }}>
                {s.learning ? 'Press a key...' : 'Learn split: press a key'}
              </button>
            </div>
          )}
          {act.map((i) => {
            const z = s.zones[i]
            return (
              <div key={i} className={'kg-split-zone' + (focused === i ? ' focus' : '') + (z.on ? '' : ' off')} style={{ '--zc': ZONE_COLORS[i] } as React.CSSProperties}>
                <span className="kg-split-chip">{zoneName(s.mode, i)}</span>
                <select aria-label={zoneName(s.mode, i) + ' sound'} value={z.sound} onChange={(e) => { setZone(i, { sound: e.target.value }); void unlockAudio() }}>
                  {ZONE_SOUNDS.map((o) => <option key={o.id} value={o.id}>{o.icon} {o.label}</option>)}
                </select>
                <span className="kg-split-step" title="Octave">Oct
                  <button type="button" aria-label="Octave down" onClick={() => setZone(i, { oct: z.oct - 1 })}>-</button><b>{z.oct > 0 ? '+' : ''}{z.oct}</b>
                  <button type="button" aria-label="Octave up" onClick={() => setZone(i, { oct: z.oct + 1 })}>+</button></span>
                <span className="kg-split-step" title="Semitones">Semi
                  <button type="button" aria-label="Semitone down" onClick={() => setZone(i, { semi: z.semi - 1 })}>-</button><b>{z.semi > 0 ? '+' : ''}{z.semi}</b>
                  <button type="button" aria-label="Semitone up" onClick={() => setZone(i, { semi: z.semi + 1 })}>+</button></span>
                <input type="range" min={0} max={100} value={Math.round(z.vol * 100)} aria-label="Zone volume" title="Zone volume" onChange={(e) => setZone(i, { vol: +e.target.value / 100 })} />
                <button type="button" className={z.on ? '' : 'on'} aria-pressed={!z.on} title="Mute this zone" onClick={() => setZone(i, { on: !z.on })}>{z.on ? 'Mute' : 'Muted'}</button>
                <button type="button" className={focused === i ? 'on' : ''} aria-pressed={focused === i} title="The synth controller knobs steer this zone" onClick={() => setFocusedZone(i)}>Knobs</button>
              </div>
            )
          })}
          <p className="kg-split-note">Opening an instrument panel takes over the whole keyboard until you close it. Layers play a little quieter each so they never get too loud.</p>
        </>
      )}
    </div>
  )
}
