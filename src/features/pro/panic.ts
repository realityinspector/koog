// PANIC: all notes off everywhere (synth, emulators, zones, DJ, band, drums). Volume and mute stay as they are.
import { getSynth, setHold } from '../synth-history/engine'
import { liveEngines } from '../synth-history/emu/bus'
import { getActiveInstrument } from '../../music/instrument'
import { zonesAllOff } from '../../music/zones'
import { panic as djPanic } from '../dj/engine'
import { panic as bandPanic } from '../smartband/engine'
import { stop as beatsStop } from '../beats/engine'
import { sendMidi } from '../../midi/connection'

export function panicAll() {
  const run = (f: () => void) => { try { f() } catch { /* keep going */ } }
  run(() => getSynth().panic()); run(() => setHold(false))
  run(() => getActiveInstrument()?.allOff?.())
  run(() => liveEngines().forEach((e) => e.allOff()))
  run(zonesAllOff); run(djPanic); run(bandPanic); run(beatsStop)
  run(() => { for (let ch = 0; ch < 16; ch++) sendMidi([0xb0 | ch, 123, 0]) })
}
