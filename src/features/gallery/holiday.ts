// Holiday playlists for Art Gallery mode (#/gallery/art/thanksgiving and #/gallery/art/christmas), as plain data.
// Songs: the public-domain holiday list (songs/holidaySongs.ts) when it exists, otherwise tunes already in the song catalog.
// Only traditional tunes or music published in the US in 1930 or earlier. Pictures are the calm ones, so nothing flashes.
import { SONGS, type Song } from '../songs/songs'
import { HOLIDAY_SONGS, HOLIDAY_ORDER } from '../songs/holidaySongs'
import type { Piece } from './art.data'

export type Season = 'thanksgiving' | 'christmas'
export const isSeason = (s: unknown): s is Season => s === 'thanksgiving' || s === 'christmas'

export const SEASONS: Record<Season, { title: string; blurb: string; hash: string; button: string }> = {
  thanksgiving: { title: 'Thanksgiving Art Gallery', hash: '#/gallery/art/thanksgiving', button: 'Thanksgiving',
    blurb: 'Falling leaves, glowing lights and calm harvest tunes. The pictures drift by in autumn gold, over and over.' },
  christmas: { title: 'Christmas Art Gallery', hash: '#/gallery/art/christmas', button: 'Christmas',
    blurb: 'Soft snow, twinkling lights and calm old carols. Red, green and gold pictures drift by, over and over.' },
}

/** every holiday song the gallery plays, in the shared list's order */
export function songsFor(kind: Season): Song[] {
  return HOLIDAY_ORDER[kind].map((id) => HOLIDAY_SONGS.find((s) => s.id === id)).filter((s): s is Song => !!s)
}

const LOOKS: Record<Season, { visual: string; palette: string; line: string }[]> = {
  thanksgiving: [
    { visual: 'ripples', palette: 'sunset', line: 'Every note drops a pebble of amber light. Leaves drift past the window.' },
    { visual: 'rise', palette: 'sunset', line: 'Tall bars of harvest gold grow with the tune.' },
    { visual: 'fire', palette: 'sunset', line: 'A warm hearth fire that follows the music.' },
    { visual: 'ghost', palette: 'sunset', line: 'Soft shapes rise from the glow, like steam from a pie.' },
    { visual: 'mail', palette: 'sunset', line: 'Little letters of thanks, one for every note.' },
  ],
  christmas: [
    { visual: 'ripples', palette: 'night', line: 'Every note drops a pebble of light on a snowy pond.' },
    { visual: 'rise', palette: 'night', line: 'Bars of red, green and gold rise like candles.' },
    { visual: 'ghost', palette: 'night', line: 'Soft winter shapes drift out of the dark.' },
    { visual: 'fire', palette: 'sunset', line: 'A cosy fire, and a song to go with it.' },
    { visual: 'mail', palette: 'night', line: 'Cards are arriving, each one with a letter name.' },
  ],
}

/** the playlist for a season: one piece per song, pictures taking turns */
export function holidayPieces(kind: Season): Piece[] {
  const looks = LOOKS[kind]
  return songsFor(kind).map((s, i) => {
    const l = looks[i % looks.length]
    // keep the busiest passage under about 3 notes a second: calm, and never a flash
    const fastest = Math.min(...s.notes.filter((n) => n.note != null).map((n) => n.beats))
    const speed = Math.max(0.6, Math.min(1, 3 / ((s.bpm / 60) / fastest)))
    return { id: `${kind}-${s.id}`, room: 'Play', season: kind, title: s.title.replace(/\s*\((opening|theme)\)$/i, ''), line: l.line,
      state: { screen: 'play', visual: l.visual, palette: l.palette }, perf: { k: 'song', id: s.id, vel: 58 }, seconds: 18, speed } as Piece
  })
}

/** a song by id: the main catalog, then the holiday list */
export const findSong = (id: string): Song | undefined => SONGS.find((s) => s.id === id) ?? HOLIDAY_SONGS.find((s) => s.id === id)
