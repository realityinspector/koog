import { useAppStore } from '../store/appStore'

export function MidiStatus() {
  const s = useAppStore()
  return (
    <section>
      <h2>MIDI</h2>
      <span className={s.midiConnected ? 'dot on' : 'dot'} />
      {!s.midiSupported
        ? 'Web MIDI not supported in this browser'
        : s.midiError
          ? `Error: ${s.midiError}`
          : s.midiConnected
            ? `Connected: ${s.midiInputName} (out: ${s.midiOutputName ?? 'none'})`
            : 'No device connected'}
    </section>
  )
}
