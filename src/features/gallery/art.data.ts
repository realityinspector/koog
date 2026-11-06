// Art Gallery mode: the lean-back, full-screen loop, as plain data.
// PURE: no browser, React or store imports (types only), so Node, the build scripts and the API/MCP server can import it.
//
// Each piece is one slow "painting": a screen of the app, one calm piece of music played in full by the ghost pianist,
// and a one-line wall label. Pieces borrow a gallery stop's set-up (`from`) and override what they need.
//
// Rules for this list (checked by hand, please keep them):
//   - Music: only traditional or pre-1930 pieces from the song catalog (no Koog Originals, nothing newer).
//   - Calm: songs whose fastest notes are at most ~3.6 per second; the bursting pictures (fireworks, confetti, fire)
//     only get songs at 2.8 notes per second or slower, so nothing flashes more than 3 times a second.
//   - No full-screen game or grown-up studio screens (busy, with buttons), and no brand names in titles or lines.
import type { KoogState } from '../../links/links'
import type { Perf, Room, UiStep } from './stops.data'

export interface Piece {
  id: string
  room: Room
  /** the wall label */
  title: string
  line: string
  /** a gallery stop to borrow state, performance and button presses from */
  from?: string
  state?: Partial<KoogState>
  perf?: Perf
  ui?: UiStep[]
  /** minimum seconds on screen (a song stays until it has finished) */
  seconds?: number
  /** holiday playlists: the wall label says the season instead of a room */
  season?: 'thanksgiving' | 'christmas'
  /** playback speed of a song (1 = as written) */
  speed?: number
}

export const ART_ROOMS: Room[] = ['Play', 'Feel', 'Learn', 'History']

const scene = (id: string, title: string, visual: string, palette: string, song: string, line: string, extra: Partial<KoogState> = {}): Piece =>
  ({ id, room: 'Play', title, line, state: { screen: 'play', visual, palette, ...extra }, perf: { k: 'song', id: song, vel: 62 }, seconds: 16 })
const sound = (id: string, title: string, snd: string, preset: string, visual: string, palette: string, song: string, line: string): Piece =>
  ({ id, room: 'History', title, line, state: { screen: 'play', visual, palette, sound: snd, preset }, perf: { k: 'song', id: song, vel: 62 }, seconds: 16 })
const songScreen = (id: string, title: string, song: string, line: string, mode?: 'flow'): Piece =>
  ({ id, room: 'Learn', title, line, state: { screen: 'songs', item: song, songMode: mode }, perf: { k: 'song', id: song, vel: 64 },
    ui: [{ sel: '.sg .play button.btn', text: 'Play', after: mode === 'flow' ? 200 : 600 }], seconds: 16 })

export const PIECES: Piece[] = [
  // ---------------------------------------------------------------- Play: the pictures your notes make
  scene('art-ripples', 'Ripples', 'ripples', 'ocean', 'gymnopedie', 'Every note drops a pebble of light. The rings travel, cross and fade.'),
  scene('art-rise', 'Rising bars', 'rise', 'candy', 'bluedanube', 'High notes grow tall, low notes stay close to the floor.'),
  scene('art-ghosts', 'Ghosts', 'ghost', 'night', 'moonlight', 'Slow, low notes call soft shapes out of the dark.'),
  scene('art-fireworks', 'Fireworks', 'fireworks', 'galaxy', 'canon', 'Notes that belong to the key bloom gold over the city.'),
  scene('art-mail', 'Mail', 'mail', 'sunset', 'lune', 'Each note arrives in an envelope with its letter name on it.'),
  scene('art-fire', 'Fire', 'fire', 'sunset', 'grace', 'Steady playing keeps the little flames alive.'),
  scene('art-confetti', 'Confetti', 'confetti', 'rainbow', 'oldmac', 'A small party for every note, in gentle bursts.'),
  scene('art-zombies', 'Zombies', 'zombie', 'night', 'saints', 'Friendly zombies shuffle in and sway to the beat.'),
  scene('art-dancer', 'Dancer', 'dancer', 'candy', 'oldmac', 'A little dancer feels the mood: bright tunes make him bounce, and a cadence makes him bow.'),
  scene('art-sheet', 'Sheet music', 'rise', 'galaxy', 'minuet', 'The staff writes down every note, as it is played.', { sheet: true }),

  // ---------------------------------------------------------------- Feel: music has moods, and friends
  { id: 'art-vibes-minor', room: 'Feel', title: 'Vibes: minor', line: 'The face reads the mood. Minor music looks thoughtful.',
    state: { screen: 'play', visual: 'vibes', palette: 'night', key: { tonic: 9, scale: 'minor' } }, perf: { k: 'song', id: 'greensleeves', vel: 60 }, seconds: 18 },
  { id: 'art-vibes-major', room: 'Feel', title: 'Vibes: major', line: 'Bright, major music turns the face sunny.',
    state: { screen: 'play', visual: 'vibes', palette: 'candy', key: { tonic: 4, scale: 'major' } }, perf: { k: 'song', id: 'morning', vel: 62 }, seconds: 18 },
  { id: 'art-band', room: 'Feel', title: 'Smart Band', line: 'A backing band listens to the tune and joins in underneath it.',
    state: { screen: 'play', visual: 'ripples', palette: 'galaxy', modes: ['band'] }, perf: { k: 'song', id: 'ode', vel: 62 }, seconds: 18 },
  { id: 'art-mimic', room: 'Feel', title: 'Mimic', line: 'Play a short phrase and pause. Koog answers it in a famous style.', from: 'feel-mimic',
    state: { visual: 'ripples', palette: 'night' }, seconds: 22 },

  // ---------------------------------------------------------------- Learn: songs, note by note
  songScreen('art-song-habanera', 'Songs: Wait mode', 'habanera', 'Falling notes show what comes next, and the song waits for every key.'),
  songScreen('art-song-mary', 'Songs: Flow mode', 'mary', 'The song keeps time, and the words light up as they are sung.', 'flow'),
  songScreen('art-song-gymnopedie', 'Slow music', 'gymnopedie', 'Floating piano music from 1888. Every note has room to ring.'),

  // ---------------------------------------------------------------- History: sounds from the synth time machine
  sound('art-organ', 'Drawbar organ', 'organ', 'Cathedral full', 'ripples', 'sunset', 'jesu', 'A warm, humming organ in the style of the 1930s, built in code.'),
  sound('art-strings', 'Tape strings', 'strings', 'Koog moonlit strings', 'rise', 'ocean', 'newworld', 'A tape-style keyboard in the spirit of the 1960s, built in code.'),
  sound('art-bells', 'FM bells', 'bell', 'Koog glass bell', 'ripples', 'night', 'twinkle', 'Glassy bells, made by one sound wave bending another.'),
  sound('art-pad', 'Lush pad', 'pad', 'Koog moon shimmer', 'ghost', 'galaxy', 'brahms', 'A soft 1980s synth sound, like a warm cloud under the tune.'),
]

export const pieceIndex = (id: string) => PIECES.findIndex((p) => p.id === id)
