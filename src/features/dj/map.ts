// The DJ controller map: ONE table, plus an optional localStorage override ('koog.dj.map').
// Calibrated on a Numark Mixtrack Go (from mixtrack-academy/data/mapping.json). Keys are "kind:channel:number"
// with 0-indexed channels. Deck B is DERIVED from deck A (channel + 1 for channels 0 and 4): not verified on hardware.
// Override format: { "learned": { "play.A": "note:0:0", "xfade": "cc:15:8", ... } } (only the keys you want to change).
// STABLE API: decode(bytes) -> DjAction | null, keyFor(id), ledBytes(id, on), MAP_DEFAULT.

export type DeckId = 'A' | 'B'
export type CtrlBase = 'play' | 'cue' | 'sync' | 'padmode' | 'pad1' | 'pad2' | 'pad3' | 'pad4' | 'jog' | 'vol' | 'tempo' | 'hi' | 'mid' | 'low'
export type GlobalId = 'xfade' | 'cuegain'
export type CtrlKind = 'button' | 'jog' | 'slider'

export const CTRL_KIND: Record<CtrlBase | GlobalId, CtrlKind> = {
  play: 'button', cue: 'button', sync: 'button', padmode: 'button', pad1: 'button', pad2: 'button', pad3: 'button', pad4: 'button',
  jog: 'jog', vol: 'slider', tempo: 'slider', hi: 'slider', mid: 'slider', low: 'slider', xfade: 'slider', cuegain: 'slider',
}

/** The calibrated table. Deck A ids end in ".A"; globals have no suffix. */
export const MAP_DEFAULT: Record<string, string> = {
  'play.A': 'note:0:0', 'cue.A': 'note:0:1', 'sync.A': 'note:0:2', 'padmode.A': 'note:4:0',
  'pad1.A': 'note:4:20', 'pad2.A': 'note:4:21', 'pad3.A': 'note:4:22', 'pad4.A': 'note:4:23',
  'jog.A': 'cc:0:6', 'vol.A': 'cc:0:9', 'tempo.A': 'cc:0:41', 'hi.A': 'cc:0:22', 'low.A': 'cc:0:26',
  xfade: 'cc:15:8', cuegain: 'cc:15:10',
}
/** Only the tempo fader is 14-bit: its LSB comes on CC + 32 (everything else here is 7-bit; note CC41 is also vol's CC+32). */
const FINE: Record<string, true> = { tempo: true }

export interface DjAction { id: CtrlBase | GlobalId; deck: DeckId | null; value: number; fine?: boolean }

const OVERRIDE_KEY = 'koog.dj.map'
const deriveB = (key: string) => {
  const [kind, ch, n] = key.split(':')
  return ch === '0' || ch === '4' ? `${kind}:${Number(ch) + 1}:${n}` : null
}

interface Table { byKey: Map<string, { base: CtrlBase | GlobalId; deck: DeckId | null }>; keyOf: Map<string, string>; fineOf: Map<string, { base: CtrlBase; deck: DeckId }> }
let table: Table | null = null

export function loadOverride(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null')
    return v && typeof v.learned === 'object' ? v.learned : {}
  } catch { return {} }
}
/** Save an override (merged over the default) and rebuild. Pass null to clear. */
export function setMapOverride(learned: Record<string, string> | null) {
  try { if (learned) localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ learned })); else localStorage.removeItem(OVERRIDE_KEY) } catch { /* ignore */ }
  table = null
}

function build(): Table {
  const learned = { ...MAP_DEFAULT, ...loadOverride() }
  const byKey: Table['byKey'] = new Map()
  const keyOf = new Map<string, string>()
  const fineOf: Table['fineOf'] = new Map()
  for (const [id, key] of Object.entries(learned)) {
    const [base, dl] = id.split('.') as [CtrlBase | GlobalId, string | undefined]
    if (!(base in CTRL_KIND)) continue
    if (dl === 'A') {
      byKey.set(key, { base, deck: 'A' }); keyOf.set(id, key)
      const b = deriveB(key)
      // an explicit "<id>.B" in the table wins over the derived one
      if (b && !learned[`${base}.B`]) { byKey.set(b, { base, deck: 'B' }); keyOf.set(`${base}.B`, b) }
    } else if (dl === 'B') { byKey.set(key, { base, deck: 'B' }); keyOf.set(id, key) }
    else if (!dl) { byKey.set(key, { base, deck: null }); keyOf.set(id, key) }
  }
  for (const [key, who] of byKey) {
    if (!who.deck || !FINE[who.base] || !key.startsWith('cc:')) continue
    const [, ch, n] = key.split(':')
    fineOf.set(`cc:${ch}:${Number(n) + 32}`, { base: who.base as CtrlBase, deck: who.deck })
  }
  return { byKey, keyOf, fineOf }
}
const T = () => (table ??= build())

/** "note:0:0" for an id like "play.A" / "pad1.B" / "xfade", or null. */
export const keyFor = (id: string) => T().keyOf.get(id) ?? null

/** LED message for a control id (note controls only). Unverified on hardware: note-on, same note, 127 or 0. */
export function ledBytes(id: string, on: boolean): number[] | null {
  const key = keyFor(id)
  if (!key || !key.startsWith('note:')) return null
  const [, ch, n] = key.split(':').map(Number)
  return [0x90 | ch, n, on ? 127 : 0]
}

/**
 * Raw MIDI bytes -> logical action. Buttons give value 1/0, sliders 0..1, jog signed ticks.
 * The jog is relative: val < 64 ? val : val - 128. Tempo MSB/LSB are combined by the engine through `fine`.
 */
export function decode(data: ArrayLike<number>): DjAction | null {
  const st = data[0] ?? 0, d1 = data[1] ?? 0, d2 = data[2] ?? 0
  const type = st & 0xf0, ch = st & 0x0f
  let key: string, val: number, kind: 'note' | 'cc'
  if (type === 0x90 || type === 0x80) { key = `note:${ch}:${d1}`; kind = 'note'; val = type === 0x90 && d2 > 0 ? 1 : 0 }
  else if (type === 0xb0) { key = `cc:${ch}:${d1}`; kind = 'cc'; val = d2 }
  else return null
  const t = T()
  const fine = kind === 'cc' ? t.fineOf.get(key) : undefined
  if (fine) return { id: fine.base, deck: fine.deck, value: val, fine: true }
  const who = t.byKey.get(key)
  if (!who) return null
  const k = CTRL_KIND[who.base]
  if (k === 'jog') return { id: who.base, deck: who.deck, value: val < 64 ? val : val - 128 }
  if (k === 'button') return kind === 'note' ? { id: who.base, deck: who.deck, value: val } : null
  return kind === 'cc' ? { id: who.base, deck: who.deck, value: val / 127 } : null
}
