// The DJ controller map: ONE table, plus an optional localStorage override ('koog.dj.map').
// Calibrated on a Numark Mixtrack Go (from mixtrack-academy/data/mapping.json). Keys are "kind:channel:number"
// with 0-indexed channels. Deck B is DERIVED from deck A (channel + 1 for channels 0 and 4): not verified on hardware.
// Override format: { "learned": { "play.A": "note:0:0", "xfade": "cc:15:8", ... }, "ledOff": ["pad1.A"], "padStep": 4 } (only the keys you want to change).
// Calibration (calibrate.ts) learns BOTH decks explicitly ("play.B" etc. win over the derived one) and saves one map per controller name
// in 'koog.dj.maps'; the active one is mirrored into 'koog.dj.map'. ledOff lists buttons whose LED must not be driven; padStep is the
// note shift the pads make per PAD MODE press (0 = the pads send the same notes in every mode).
// STABLE API: decode(bytes) -> DjAction | null, keyFor(id), ledBytes(id, on), MAP_DEFAULT.

export type DeckId = 'A' | 'B'
export type CtrlBase = 'play' | 'cue' | 'sync' | 'padmode' | 'pad1' | 'pad2' | 'pad3' | 'pad4' | 'jog' | 'jogtouch' | 'vol' | 'tempo' | 'hi' | 'mid' | 'low'
export type GlobalId = 'xfade' | 'cuegain'
export type CtrlKind = 'button' | 'jog' | 'slider'

export const CTRL_KIND: Record<CtrlBase | GlobalId, CtrlKind> = {
  play: 'button', jogtouch: 'button', cue: 'button', sync: 'button', padmode: 'button', pad1: 'button', pad2: 'button', pad3: 'button', pad4: 'button',
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
export interface MapExtra { ledOff?: string[]; padStep?: number }
export function loadExtra(): MapExtra {
  try {
    const v = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null')
    return v ? { ledOff: Array.isArray(v.ledOff) ? v.ledOff : [], padStep: typeof v.padStep === 'number' ? v.padStep : 0 } : {}
  } catch { return {} }
}
const changeListeners = new Set<() => void>()
/** called whenever the active map changes (calibration saved, reset, imported) */
export const onMapChange = (fn: () => void) => { changeListeners.add(fn); return () => { changeListeners.delete(fn) } }
/** Save an override (merged over the default) and rebuild. Pass null to clear. */
export function setMapOverride(learned: Record<string, string> | null, extra?: MapExtra) {
  try { if (learned) localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ learned, ...(extra ?? {}) })); else localStorage.removeItem(OVERRIDE_KEY) } catch { /* ignore */ }
  table = null
  for (const f of [...changeListeners]) { try { f() } catch { /* ignore */ } }
}

// ---------- one saved map per controller name ----------
const MAPS_KEY = 'koog.dj.maps'
export interface ControllerMap extends MapExtra { learned: Record<string, string>; ledTested?: boolean }
export function loadControllerMaps(): Record<string, ControllerMap> {
  try { const v = JSON.parse(localStorage.getItem(MAPS_KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
/** Save a controller's map under its MIDI port name AND make it the active one. */
export function saveControllerMap(name: string, m: ControllerMap) {
  const all = loadControllerMaps(); all[name] = m
  try { localStorage.setItem(MAPS_KEY, JSON.stringify(all)) } catch { /* ignore */ }
  setMapOverride(m.learned, { ledOff: m.ledOff ?? [], padStep: m.padStep ?? 0 })
}
/** Make the saved map for this controller active. false when nothing is saved for it. */
export function activateControllerMap(name: string): boolean {
  const m = loadControllerMaps()[name]
  if (!m) return false
  setMapOverride(m.learned, { ledOff: m.ledOff ?? [], padStep: m.padStep ?? 0 })
  return true
}
/** Forget the saved map for a controller (or all) and go back to the built-in defaults. */
export function resetControllerMap(name?: string) {
  const all = loadControllerMaps()
  if (name) delete all[name]
  try { if (name && Object.keys(all).length) localStorage.setItem(MAPS_KEY, JSON.stringify(all)); else localStorage.removeItem(MAPS_KEY) } catch { /* ignore */ }
  setMapOverride(null)
}
/** The merged table as id -> key ("play.A" -> "note:0:0"), derived decks included. */
export function currentMap(): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [id, key] of T().keyOf) o[id] = key
  return o
}
/** Which control ids use this key right now ("note:0:0")? Includes tempo LSB keys as "<id>~fine". */
export function idsForKey(key: string): string[] {
  const t = T(), out: string[] = []
  for (const [id, k] of t.keyOf) if (k === key) out.push(id)
  const who = t.byKey.get(key)
  if (who && !out.includes(who.deck ? `${who.base}.${who.deck}` : who.base)) out.push(who.deck ? `${who.base}.${who.deck}` : who.base)
  const f = t.fineOf.get(key)
  if (f) out.push(`${f.base}.${f.deck}~fine`)
  return out
}
/** is this button's LED switched off (it was found not to light up)? */
export const ledIsOff = (id: string) => (loadExtra().ledOff ?? []).includes(id)
/** keys that are the fine (LSB) twin of a control, e.g. tempo CC+32 */
export const fineKeyOf = (key: string): string | null => (key.startsWith('cc:') ? `cc:${key.split(':')[1]}:${Number(key.split(':')[2]) + 32}` : null)
export const isFineControl = (base: string) => !!FINE[base]
export const describeKey = (key: string): string => {
  const [kind, ch, n] = key.split(':')
  return `${kind === 'note' ? 'Note' : 'CC'} ${n}, ch ${Number(ch) + 1}`
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
  const step = loadExtra().padStep ?? 0
  if (step) {
    for (const [key, who] of [...byKey]) {
      if (!/^pad[1-4]$/.test(who.base) || !key.startsWith('note:')) continue
      const [, ch, n] = key.split(':')
      for (let k = 1; k <= 3; k++) { const alias = `note:${ch}:${Number(n) + k * step}`; if (!byKey.has(alias)) byKey.set(alias, who) }
    }
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
  if (!key || !key.startsWith('note:') || ledIsOff(id)) return null
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
