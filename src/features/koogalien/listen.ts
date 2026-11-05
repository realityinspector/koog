// Wires the devices into the Koogalien store: Kode tokens (keys, pads, DJ pads, pedal, on-screen pads), mod wheel / pitch bend,
// and a small clock tick so a rest can close a word. Returns one stop function. Kept out of store.ts so the store runs under tsx.
import { onToken, startKode } from '../../kode/tokens'
import { startModInput } from './play/modInput'
import { koogalienActions, useKoogalien } from './store'
import type { KoogalienHost } from '../../koogalien/ports'

export function startListening(host: KoogalienHost): () => void {
  const stopKode = startKode()
  const off = onToken((t) => koogalienActions.feedToken(t))
  const stopMod = startModInput((s) => koogalienActions.feedMod(s))
  let lastWobble = 0
  const timer = window.setInterval(() => {
    koogalienActions.tick(host.now())
    // the slider is a held value: keep telling the recognizer while it is up (the 250 ms hold rule needs repeats)
    const w = useKoogalien.getState().wobble
    if (w > 0 || lastWobble > 0) koogalienActions.feedMod({ kind: 'slider', value: w, t: host.now() })
    lastWobble = w
  }, 120)
  return () => { off(); stopKode(); stopMod(); window.clearInterval(timer) }
}

if (import.meta.hot) import.meta.hot.accept()
