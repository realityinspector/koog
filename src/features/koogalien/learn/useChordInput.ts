// A hook: listen to the keys, pads, DJ pads and MIDI, gather notes pressed together into chords, and call `onChord` with each one.
import { useEffect, useRef } from 'react'
import { onToken, startKode } from '../../../kode/tokens'
import { degreeOfToken, emptyWin, flush, press, CHORD_MS, type Win } from '../../../koogalien/learn/chordWindow'
import type { Chord, Degree } from '../../../koogalien/data/types'

/** `feed` lets on-screen pads join the same chord window as real keys */
export function useChordInput(onChord: (c: Chord) => void, enabled: boolean): { feed: (d: Degree) => void } {
  const cb = useRef(onChord)
  cb.current = onChord
  const win = useRef<Win>(emptyWin())
  const timer = useRef<number>(0)
  const arm = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const f = flush(win.current, Infinity)
      win.current = f.win
      if (f.chord) cb.current(f.chord)
    }, CHORD_MS + 10)
  }
  const feed = (d: Degree) => { win.current = press(win.current, d, performance.now()); arm() }
  const feedRef = useRef(feed)
  feedRef.current = feed
  useEffect(() => {
    if (!enabled) return
    const stop = startKode()
    const off = onToken((t) => { const d = degreeOfToken(t); if (d) feedRef.current(d) })
    return () => { off(); stop(); window.clearTimeout(timer.current); win.current = emptyWin() }
  }, [enabled])
  return { feed: (d) => feedRef.current(d) }
}
