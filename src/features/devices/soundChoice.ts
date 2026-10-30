// "Change instruments": what the piano plays through. Builds a headless emulator engine (no panel needed;
// the AudioContext is created lazily on the first note/gesture) and registers it with setActiveInstrument.
// Choice is saved per kid (pload/psave 'sound.v1'). Opening an emulator panel still overrides it while open.
import { create } from 'zustand'
import { setActiveInstrument, onInstrumentChange, getActiveInstrument } from '../../music/instrument'
import { createEngine, type Engine } from '../synth-history/emu/core'
import { getEmu } from '../synth-history/emu'
import { onProfileChange, pload, psave } from '../../profile/profile'

export interface SoundChoice { id: string; label: string; icon: string; emu?: string; preset?: string }
export const SOUNDS: SoundChoice[] = [
  { id: 'koog', label: 'Koog synth', icon: '🎹' },
  { id: 'organ', label: 'Organ', icon: '⛪', emu: 'hammond', preset: 'Smoky lounge' },
  { id: 'moog', label: 'Moog-style', icon: '🎛️', emu: 'moog', preset: 'Carlos-style lead' },
  { id: 'epiano', label: 'Electric piano (FM)', icon: '✨', emu: 'dx', preset: 'Glassy e-piano' },
  { id: 'bell', label: 'Bells (FM)', icon: '🔔', emu: 'dx', preset: 'Tubular bell' },
  { id: 'strings', label: 'Strings (tape)', icon: '🎻', emu: 'mellotron', preset: 'Dreamy strings' },
  { id: 'choir', label: 'Choir (tape)', icon: '🎶', emu: 'mellotron', preset: 'Old choir' },
  { id: 'pad', label: 'Lush pad', icon: '☁️', emu: 'juno', preset: 'Lush pad' },
  { id: 'brass', label: 'Brass stab', icon: '🎺', emu: 'prophet', preset: 'Brass stab' },
]
const KEY = 'sound.v1'

type Hot = { store?: ReturnType<typeof make>; engine?: { e: Engine | null; inst: ReturnType<typeof getActiveInstrument> }; off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ id: string }>()(() => ({ id: 'koog' })) }
export const useSound = hot.store ?? make()
const cur = hot.engine ?? { e: null as Engine | null, inst: null as ReturnType<typeof getActiveInstrument> }

function dropEngine() {
  if (cur.inst && getActiveInstrument() === cur.inst) setActiveInstrument(null)
  if (cur.e) { try { cur.e.allOff(); cur.e.dispose() } catch { /* ignore */ } }
  cur.e = null; cur.inst = null
}

function apply(id: string) {
  const ch = SOUNDS.find((s) => s.id === id) ?? SOUNDS[0]
  dropEngine()
  useSound.setState({ id: ch.id })
  const spec = ch.emu ? getEmu(ch.emu) : undefined
  if (!spec) return
  const e = createEngine(spec)
  const p = spec.presets.find((x) => x.name === ch.preset) ?? spec.presets[0]
  if (p) for (const c of spec.ctls) e.set(c.key, p.values[c.key] ?? c.def)
  cur.e = e
  cur.inst = { id: 'sound:' + ch.id, name: ch.label, noteOn: (n, v) => e.noteOn(n, v), noteOff: (n) => e.noteOff(n), allOff: () => e.allOff(), unlock: () => e.unlock() }
  setActiveInstrument(cur.inst)
}

/** Pick a sound for the piano (saved for the active kid). */
export function chooseSound(id: string) { psave(KEY, id); apply(id) }

hot.off?.()
const offProfile = onProfileChange(() => apply(pload<string>(KEY, 'koog')))
// when an emulator panel closes it sets the instrument to null: put the kid's choice back
const offInst = onInstrumentChange((i) => {
  if (i === null && useSound.getState().id !== 'koog' && cur.e) queueMicrotask(() => { if (!getActiveInstrument() && cur.inst) setActiveInstrument(cur.inst) })
})
apply(pload<string>(KEY, 'koog'))

if (import.meta.hot) {
  import.meta.hot.data.store = useSound
  import.meta.hot.data.engine = cur
  import.meta.hot.data.off = () => { offProfile(); offInst() }
  import.meta.hot.accept()
}
