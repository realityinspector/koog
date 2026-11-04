// App-wide sound settings, shown in the top strip. Every audio engine (Koog synth, Smart Band, beats,
// emulators) must follow these: volume 0..1 scales its master gain (under its own safety cap), and
// muted forces 0. computerSound = the MIDI keyboard also plays through the computer's speakers.
// STABLE API: useAudioSettings with { volume, muted, computerSound }, setVolume, setMuted, setComputerSound,
// outputScale() -> 0..1 to multiply into a master gain.
// BOOST (quiet laptop speakers): a temporary +6 dB (x2) lift applied in the shared audio host BEFORE the limiter (src/audio/host.ts), so the
// limiter and every channel's hard cap still stop clipping. It is never saved: a reload, panic, switching player, or BOOST_MAX_MS all turn it off.
import { create } from 'zustand'
import { linkNote } from '../links/bus'
import { useProfile } from '../profile/profile'

/** how long Boost may stay on before it turns itself off (protects ears) */
export const BOOST_MAX_MS = 60 * 60 * 1000
/** the lift: +6 dB */
export const BOOST_GAIN = 2

export interface AudioSettings { volume: number; muted: boolean; computerSound: boolean; /** never saved */ boost: boolean }
const KEY = 'koog.audio'
function load(): AudioSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { volume: typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : 0.7, muted: !!v.muted, computerSound: !!v.computerSound, boost: false }
  } catch { return { volume: 0.7, muted: false, computerSound: false, boost: false } }
}
function make() { return create<AudioSettings>()(() => load()) }
export const useAudioSettings = (import.meta.hot?.data.audioSettings as ReturnType<typeof make> | undefined) ?? make()

const save = () => { try { const { boost: _b, ...rest } = useAudioSettings.getState(); localStorage.setItem(KEY, JSON.stringify(rest)) } catch { /* ignore */ } }
export const setVolume = (v: number) => { useAudioSettings.setState({ volume: Math.min(1, Math.max(0, v)) }); save() }
export const setMuted = (m: boolean) => { useAudioSettings.setState({ muted: m }); save() }
export const setComputerSound = (on: boolean) => { useAudioSettings.setState({ computerSound: on }); save() }
/** multiply this into an engine's master gain */
export const outputScale = () => { const s = useAudioSettings.getState(); return s.muted ? 0 : s.volume }
/** 1, or BOOST_GAIN while Boost is on (the audio host multiplies this into the master gain, before the limiter) */
export const boostGain = () => (useAudioSettings.getState().boost ? BOOST_GAIN : 1)

// Boost: on for at most `limitMs` (default BOOST_MAX_MS), then it turns itself off with a gentle toast. Never persisted.
type BoostHot = { boostTimer?: number; boostEnd?: number; boostUnsub?: () => void }
const bh = (import.meta.hot?.data ?? {}) as BoostHot
export function setBoost(on: boolean, limitMs = BOOST_MAX_MS) {
  clearTimeout(bh.boostTimer); bh.boostTimer = undefined; bh.boostEnd = undefined
  if (on) {
    bh.boostEnd = Date.now() + limitMs
    bh.boostTimer = window.setTimeout(() => { setBoost(false); linkNote('Boost turned off after an hour, to protect ears') }, limitMs)
  }
  if (useAudioSettings.getState().boost !== on) useAudioSettings.setState({ boost: on })
}
/** ms until Boost turns itself off (0 when it is off) */
export const boostLeftMs = () => (useAudioSettings.getState().boost && bh.boostEnd ? Math.max(0, bh.boostEnd - Date.now()) : 0)
// switching player turns Boost off (a different kid, a different pair of ears)
bh.boostUnsub?.()
bh.boostUnsub = useProfile.subscribe((s, p) => { if (s.active !== p.active) setBoost(false) })
if (useAudioSettings.getState().boost && bh.boostEnd) setBoost(true, Math.max(0, bh.boostEnd - Date.now())) // an edit re-arms the timer

if (import.meta.hot) {
  Object.assign(import.meta.hot.data, bh)
  import.meta.hot.data.audioSettings = useAudioSettings
  import.meta.hot.accept()
}
