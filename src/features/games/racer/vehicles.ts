// Koogalien Racer vehicles. Each one is picked by a phrase-key in the garage: play its note four times (any octave), or tap its pad four times.
// Pure data (no DOM): the look is drawn in draw.ts, the hum is made in engine.ts from `hum`.
export interface Vehicle {
  id: string
  name: string
  emoji: string
  /** pitch class of the phrase-key: C = 0 */
  pc: number
  /** pad lane (0 = pad 1) of the phrase-key for drum pads and DJ controllers */
  lane: number
  blurb: string
  /** engine hum: oscillator type, base Hz at a standstill, extra Hz at full speed, wobble (Hz of a slow vibrato), loudness 0..1 */
  hum: { wave: OscillatorType; base: number; speed: number; wobble: number; vol: number }
  /** road half-width multiplier: the snail is forgiving */
  half: number
  color: string
  accent: string
}
export const VEHICLES: Vehicle[] = [
  { id: 'bee', name: 'Bee Buggy', emoji: '🐝', pc: 0, lane: 0, blurb: 'Buzzy and quick', hum: { wave: 'sawtooth', base: 150, speed: 70, wobble: 28, vol: 0.5 }, half: 1, color: '#ffd23f', accent: '#2b2118' },
  { id: 'family', name: 'Family Car', emoji: '🚗', pc: 2, lane: 1, blurb: 'Steady and friendly', hum: { wave: 'triangle', base: 70, speed: 50, wobble: 0, vol: 0.6 }, half: 1, color: '#4f8cff', accent: '#dce9ff' },
  { id: 'monster', name: 'Monster Truck', emoji: '🛻', pc: 4, lane: 2, blurb: 'Big wheels, deep rumble', hum: { wave: 'square', base: 42, speed: 30, wobble: 5, vol: 0.4 }, half: 1, color: '#e0472d', accent: '#222' },
  { id: 'rocket', name: 'Rocket Racer', emoji: '🚀', pc: 5, lane: 3, blurb: 'Whooshy, with flames', hum: { wave: 'sawtooth', base: 110, speed: 140, wobble: 9, vol: 0.4 }, half: 1, color: '#e8eef7', accent: '#ff6b3d' },
  { id: 'snail', name: 'Snail Cruiser', emoji: '🐌', pc: 7, lane: 4, blurb: 'Slow, wide and forgiving', hum: { wave: 'sine', base: 60, speed: 20, wobble: 3, vol: 0.6 }, half: 1.3, color: '#9ad36a', accent: '#8a5a2b' },
  { id: 'kart', name: 'Go-Kart', emoji: '🏎️', pc: 9, lane: 5, blurb: 'Zippy and twitchy', hum: { wave: 'square', base: 190, speed: 90, wobble: 0, vol: 0.3 }, half: 1, color: '#ff4fa3', accent: '#fff' },
  { id: 'icecream', name: 'Ice-Cream Truck', emoji: '🍦', pc: 11, lane: 6, blurb: 'Jingly and sweet', hum: { wave: 'triangle', base: 85, speed: 45, wobble: 6, vol: 0.55 }, half: 1, color: '#fff2d9', accent: '#ff8fb3' },
]
export const vehicleById = (id: string | null | undefined): Vehicle => VEHICLES.find((v) => v.id === id) ?? VEHICLES[1]
/** the vehicle a phrase-key names ({kind:'pc'|'lane'}, from kodeCore.repeatedKey) */
export function vehicleForKey(k: { kind: 'pc' | 'lane'; value: number } | null): Vehicle | null {
  if (!k) return null
  return VEHICLES.find((v) => (k.kind === 'pc' ? v.pc === k.value : v.lane === k.value)) ?? null
}
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const keyName = (v: Vehicle) => NAMES[v.pc]
