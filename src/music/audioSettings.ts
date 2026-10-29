// App-wide sound settings, shown in the top strip. Every audio engine (Koog synth, Smart Band, beats,
// emulators) must follow these: volume 0..1 scales its master gain (under its own safety cap), and
// muted forces 0. computerSound = the MIDI keyboard also plays through the computer's speakers.
// STABLE API: useAudioSettings with { volume, muted, computerSound }, setVolume, setMuted, setComputerSound,
// outputScale() -> 0..1 to multiply into a master gain.
import { create } from 'zustand'

export interface AudioSettings { volume: number; muted: boolean; computerSound: boolean }
const KEY = 'koog.audio'
function load(): AudioSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { volume: typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : 0.7, muted: !!v.muted, computerSound: !!v.computerSound }
  } catch { return { volume: 0.7, muted: false, computerSound: false } }
}
function make() { return create<AudioSettings>()(() => load()) }
export const useAudioSettings = (import.meta.hot?.data.audioSettings as ReturnType<typeof make> | undefined) ?? make()

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(useAudioSettings.getState())) } catch { /* ignore */ } }
export const setVolume = (v: number) => { useAudioSettings.setState({ volume: Math.min(1, Math.max(0, v)) }); save() }
export const setMuted = (m: boolean) => { useAudioSettings.setState({ muted: m }); save() }
export const setComputerSound = (on: boolean) => { useAudioSettings.setState({ computerSound: on }); save() }
/** multiply this into an engine's master gain */
export const outputScale = () => { const s = useAudioSettings.getState(); return s.muted ? 0 : s.volume }

if (import.meta.hot) {
  import.meta.hot.data.audioSettings = useAudioSettings
  import.meta.hot.accept()
}
