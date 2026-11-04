// What each screen hands to the "</> Code" menu. Reads the live engines; the exporters themselves are pure (src/kode/export).
import { drumsToSonicPi, drumsToStrudel, layersToSonicPi, layersToStrudel, songToSonicPi, songToStrudel, type SongLike } from '../../kode/export'
import type { CodeSource } from './CodeMenu'
import { exportTracks } from '../loopstation/loopEngine'
import { useDrums } from '../drumpads/drumEngine'
import { isEmpty } from '../drumpads/drumCore'
import { getBpm } from '../../music/masterClock'

export function loopCode(): CodeSource | null {
  const { tracks, len, bpm } = exportTracks()
  const layers = tracks.filter((t) => t.channel !== 9).map((t) => ({ name: t.name, notes: t.notes }))
  if (!layers.length) return null
  return { sonic: layersToSonicPi(layers, bpm, len), strudel: layersToStrudel(layers, bpm, len) }
}
export function drumCode(): CodeSource | null {
  const pat = useDrums.getState().pat, bpm = getBpm()
  if (isEmpty(pat)) return null
  return { sonic: drumsToSonicPi(pat, bpm), strudel: drumsToStrudel(pat, bpm) }
}
export function songCode(song: SongLike): CodeSource | null {
  if (!song.notes.some((n) => n.note != null)) return null
  return { sonic: songToSonicPi(song), strudel: songToStrudel(song) }
}
