// The piano's other pedals, besides the sustain (damper) pedal that features/pedal already runs:
//   soft (una corda)  CC 67   quieter and mellower notes (velocity down here, tone darkened by the Pedalboard)
//   sostenuto         CC 66   only the keys held down when you press it keep ringing
//   expression        CC 11   a smooth swell: output level, never above 1x
//   volume            CC 7    channel volume, same idea
// half pedal (CC 64 below the halfway point) is handled in features/pedal/pedal.ts through setHalfSustain.
// Any of them can also be driven from a USB foot switch (pedal actions) or from the screen (Pedalboard panel).
import { create } from 'zustand'
import { setSoftPedal, setSostenuto as noteSostenuto } from '../../music/localNotes'
import { subscribe as subscribeMidi } from '../../midi/router'

export interface PianoPedals { soft: number; sostenuto: boolean; expr: number; vol: number; /** last CC seen, for the panel */ seen: number[] }
const hot = import.meta.hot?.data as { pp?: { store: ReturnType<typeof make>; off?: () => void } } | undefined
function make() { return create<PianoPedals>()(() => ({ soft: 0, sostenuto: false, expr: 1, vol: 1, seen: [] })) }
const H = hot?.pp ?? { store: make(), off: undefined as (() => void) | undefined }
export const usePianoPedals = H.store

export function setSoft(level: number) { const v = Math.min(1, Math.max(0, level)); setSoftPedal(v); usePianoPedals.setState({ soft: v }) }
export function setSostenuto(down: boolean) { noteSostenuto(down); usePianoPedals.setState({ sostenuto: down }) }
export function setExpression(v: number) { usePianoPedals.setState({ expr: Math.min(1, Math.max(0, v)) }) }
export function setVolumePedal(v: number) { usePianoPedals.setState({ vol: Math.min(1, Math.max(0, v)) }) }
/** the smooth level curve: v*v, so the bottom half of the pedal is gentle. Never above 1. */
export const swell = (v: number) => v * v

function onMidi(d: Uint8Array) {
  if (d.length < 3 || (d[0] & 0xf0) !== 0xb0) return
  const cc = d[1], v = d[2]
  const mark = () => { const s = usePianoPedals.getState().seen; if (!s.includes(cc)) usePianoPedals.setState({ seen: [...s, cc] }) }
  if (cc === 67) { mark(); setSoft(v / 127) }
  else if (cc === 66) { mark(); setSostenuto(v >= 64) }
  else if (cc === 11) { mark(); setExpression(v / 127) }
  else if (cc === 7) { mark(); setVolumePedal(v / 127) }
}
H.off?.()
H.off = subscribeMidi('piano', (d) => onMidi(d))

if (import.meta.hot) {
  import.meta.hot.data.pp = H
  import.meta.hot.dispose(() => { H.off?.(); H.off = undefined })
  import.meta.hot.accept()
}
