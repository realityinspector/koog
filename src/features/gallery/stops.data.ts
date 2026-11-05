// The Koog gallery: a self-playing tour of every feature, as plain data.
// PURE: no browser, React or store imports (types only), so Node, the build scripts and the API/MCP server can import it.
// The browser side (runner.ts) reads this list; a stop's link state goes through the same link layer as every other canonical link.
import type { KoogState } from '../../links/links'

export type Room = 'Play' | 'Feel' | 'Learn' | 'Games' | 'History' | 'Studio'
export const ROOMS: Room[] = ['Play', 'Feel', 'Learn', 'Games', 'History', 'Studio']

/** What the ghost pianist plays. Phrase text: `C4:.5 E4 G4:1 R:1 [C4,E4,G4]:2` (note:beats, the beat count sticks until changed, R = rest, [..] = chord). */
export type Perf =
  | { k: 'none' }
  | { k: 'notes'; seq: string; bpm: number; vel?: number; loop?: boolean; gap?: number }
  | { k: 'song'; id: string; vel?: number }
  | { k: 'guide'; seq: string; bpm: number } // plays whatever the game or lesson lights up next; calm phrase while nothing is lit
  | { k: 'challenge'; seq: string; bpm: number }
  | { k: 'learn' }

/** a button the gallery presses for you (a UI step that is not a note) */
export interface UiStep { sel: string; text?: string; after?: number /* ms to wait afterwards */ }

export interface Stop {
  id: string
  room: Room
  title: string
  /** minimum time on this stop, in seconds (a stop with a full song is long enough for the whole song) */
  seconds: number
  /** the placard: what it is, in plain words */
  says: string
  /** the placard: what a kid learns */
  learns: string
  /** exactly where the app goes (the same canonical link state as #/...) */
  state: KoogState
  perf: Perf
  ui?: UiStep[]
  link?: { label: string; href: string }
}

const SCALE = 'C4:.5 D4 E4 F4 G4 A4 B4 C5:1 B4:.5 A4 G4 F4 E4 D4 C4:1.5'
const ARP = 'C4:.5 E4 G4 C5 G4 E4 C4 E4 G4 C5:.5 E5 C5 G4 E4 C4:2'
const SLOW = 'E4:1 G4:1 A4:1 G4:2 E4:1 D4:1 C4:2 R:1'
const PENT = 'C4:.5 D4 E4 G4 A4 G4 E4 D4 C4:1 E4:.5 G4 A4 C5:1 A4:.5 G4 E4:1 C4:2'
const LOW = 'C3:.5 C3 G3 C3 Bb3:.5 C3 G3 C3 F3:.5 F3 C4 F3 G3:.5 G3 D4 G3'
const AMIN = 'A3:.5 C4 E4 A4 E4 C4 A3:1 G3:.5 B3 D4 G4 D4 B3 G3:1'

const play = (visual?: string, palette?: string, extra: Partial<KoogState> = {}): KoogState => ({ screen: 'play', visual, palette, ...extra })
const scene = (id: string, title: string, visual: string, palette: string, says: string, learns: string, seq = SCALE): Stop =>
  ({ id, room: 'Play', title, seconds: 7, says, learns, state: play(visual, palette), perf: { k: 'notes', seq, bpm: 84, vel: 68, loop: true, gap: 2 } })
const emu = (id: string, title: string, says: string, learns: string, seq: string, bpm = 80): Stop =>
  ({ id: 'synth-' + id, room: 'History', title, seconds: 9, says, learns, state: { screen: 'synth', item: id }, perf: { k: 'notes', seq, bpm, vel: 72, loop: true, gap: 2 } })
const chal = (id: string, title: string, says: string, learns: string, seconds = 10): Stop =>
  ({ id: 'challenge-' + id, room: 'Games', title, seconds, says, learns, state: { screen: 'challenges', item: id }, perf: { k: 'challenge', seq: PENT, bpm: 90 } })

export const STOPS: Stop[] = [
  // ---------------------------------------------------------------- Room 1: Play
  { id: 'play-hello', room: 'Play', title: 'Free play', seconds: 10, state: play(), perf: { k: 'notes', seq: ARP, bpm: 84, vel: 66, loop: true, gap: 2 },
    says: 'Every key you press lights up the display. Nothing to learn first: just play.', learns: 'Hearing and seeing sound at the same time.' },
  scene('play-ripples', 'Ripples', 'ripples', 'ocean', 'Each note drops a pebble in the water. Ripples travel and cross each other.', 'Louder notes make bigger ripples.'),
  scene('play-rise', 'Rising bars', 'rise', 'candy', 'Every note grows a bar. High notes are tall, low notes are short.', 'Where a note sits on the keys: low to high.', SLOW),
  scene('play-fire', 'Fire', 'fire', 'sunset', 'Notes light little flames, and playing steadily keeps the fire going.', 'Playing steadily makes music feel alive.', ARP),
  scene('play-ghosts', 'Ghosts', 'ghost', 'night', 'Spooky friends float up for every note you play.', 'Slow, low notes sound spooky.', AMIN),
  scene('play-mail', 'Mail', 'mail', 'galaxy', 'Each note pops out of an envelope with its letter name on it.', 'Note names, A to G.', SLOW),
  scene('play-confetti', 'Confetti', 'confetti', 'rainbow', 'A party for every note, in gentle bursts.', 'Playing in key sounds like a party.', SCALE),
  scene('play-zombies', 'Zombies', 'zombie', 'night', 'Friendly zombies shuffle in and wobble to your notes.', 'Rhythm: notes spaced evenly feel like a walk.', PENT),
  scene('play-dancer', 'Dancer', 'dancer', 'candy', 'A little dancer moves to the mood: happy music is bouncy, sad music is a slow sway, chords make big moves. He travels across the stage as your notes go up and down, and you can give him a name with the Name him button.', 'Music has moods, and you can dance them.', ARP),
  { id: 'play-spicy', room: 'Play', title: 'In key or spicy', seconds: 10, state: play('fireworks', 'rainbow'),
    perf: { k: 'notes', seq: 'C4:.5 E4 G4 E4 C5:1 F#4:.5 G4:1 R:.5 D4:.5 F4 A4 F4 D5:1 G#4:.5 A4:1 R:1', bpm: 90, vel: 70, loop: true, gap: 2 },
    says: 'Notes that belong to the key burst gold. A note from outside the key goes "spicy".', learns: 'What a key is, and how an odd note makes tension.' },
  { id: 'judge-cadence', room: 'Play', title: 'Cadence!', seconds: 13, state: play('fireworks', 'sunset'),
    perf: { k: 'notes', seq: 'C4:.5 E4 G4 C5:1 R:2 [C4,E4,G4]:1 [C4,F4,A4]:1 [B3,D4,G4]:1 [C4,E4,G4,C5]:3 R:3', bpm: 84, vel: 70, loop: true, gap: 1 },
    says: 'End a phrase back home, on the tonic, and Koog calls it out: Cadence!', learns: 'Music has a home note, and phrases feel finished when they return to it.' },
  { id: 'judge-motif', room: 'Play', title: 'Motif!', seconds: 13, state: play('ripples', 'ocean'),
    perf: { k: 'notes', seq: 'E4:.5 G4 F4 A4:1 R:.5 G4:.5 B4 A4 C5:1 R:.5 A4:.5 C5 B4 D5:1 R:1 C5:2 R:2', bpm: 90, vel: 70, loop: true, gap: 1 },
    says: 'Repeat a little pattern, even starting on a different note, and Koog spots the motif.', learns: 'A small idea, repeated, is how songs get memorable.' },
  { id: 'judge-tension', room: 'Play', title: 'Tension and release', seconds: 13, state: play('fire', 'sunset'),
    perf: { k: 'notes', seq: 'C4:.5 D4 E4 G4:1 F#4:1.5 G4:2 R:1 E4:.5 F4 G4 A4:1 G#4:1.5 A4:2 R:2', bpm: 84, vel: 68, loop: true, gap: 1 },
    says: 'A note that does not fit pulls like a stretched elastic band. Resolving it lets go.', learns: 'Tension and release: why some notes want to move.' },
  { id: 'judge-boom', room: 'Play', title: 'BOOM charge', seconds: 24, state: play('fireworks', 'galaxy'),
    perf: { k: 'notes', seq: 'C4:.5 E4 G4 E4 C4 E4 G4 C5 B4 G4 D4 G4 B4 D5 C5 G4 E4 C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4 E4 G4 C5 G4 E4 C4:1 R:2 [C3,D3,E3,F3,G3]:2 R:6', bpm: 108, vel: 72 },
    says: 'Playing in key fills the BOOM meter. Charged up, one big forearm slam becomes a giant finale.', learns: 'Playing well earns you the fun part.' },
  { id: 'play-sheet', room: 'Play', title: 'Sheet music', seconds: 12, state: play('rise', 'candy', { sheet: true }),
    perf: { k: 'notes', seq: 'C4:1 E4 G4 E4 F4 A4 C5:2 G4:1 E4 C4 E4 D4 B3 C4:2', bpm: 80, vel: 68, loop: true, gap: 2 },
    says: 'The staff along the bottom writes down what you play, as you play it.', learns: 'Reading notes on the staff.' },

  // ---------------------------------------------------------------- Room 2: Feel
  { id: 'feel-vibes-minor', room: 'Feel', title: 'Vibes: minor', seconds: 20, state: play('vibes', 'night', { key: { tonic: 9, scale: 'minor' } }),
    perf: { k: 'notes', seq: '[A2,A3,C4,E4]:2 [D3,A3,D4,F4]:2 [E3,G#3,B3,E4]:2 [A2,A3,C4,E4]:4 R:2', bpm: 56, vel: 62, loop: true, gap: 1 },
    says: 'The face shows the mood of the music. Slow, minor chords look a little sad.', learns: 'Minor sounds sad or moody.' },
  { id: 'feel-vibes-major', room: 'Feel', title: 'Vibes: major', seconds: 20, state: play('vibes', 'candy'),
    perf: { k: 'notes', seq: '[C3,C4,E4,G4]:1 [F3,A3,C4,F4]:1 [G3,B3,D4,G4]:1 [C3,C4,E4,G4,C5]:2 R:1 [C3,C4,E4,G4]:1 [G3,B3,D4,G4]:1 [C3,E4,G4,C5]:2', bpm: 96, vel: 72, loop: true, gap: 1 },
    says: 'Brighter, bouncier chords turn the face happy.', learns: 'Major sounds happy and bright.' },
  { id: 'feel-mentor', room: 'Feel', title: 'Mentor', seconds: 24, state: play('fireworks', 'rainbow', { modes: ['mentor'] }),
    perf: { k: 'song', id: 'ode', vel: 72 },
    says: 'A little synth robot in the front row. It spots tunes you play, like Ode to Joy, and says which composer wrote them. Its tips are honest: it names what to fix, and how.', learns: 'Recognising famous melodies and patterns, and hearing a critique that helps.' },
  { id: 'feel-band', room: 'Feel', title: 'Smart Band', seconds: 16, state: play('confetti', 'rainbow', { modes: ['band'] }),
    perf: { k: 'notes', seq: 'C4:1 E4 G4 E4 F4 A4 G4:2 E4:1 D4 C4:2 R:1', bpm: 96, vel: 70, loop: true, gap: 1 },
    says: 'Play a melody and a backing band guesses the chords and joins in with pad, bass and light drums.', learns: 'Chords: how notes stack up underneath a tune.' },
  { id: 'feel-mimic', room: 'Feel', title: 'Mimic', seconds: 18, state: play('ripples', 'galaxy', { modes: ['mimic'] }),
    perf: { k: 'notes', seq: 'E4:.5 G4 A4 G4:1 R:5 C4:.5 E4 G4 C5:1 R:5', bpm: 84, vel: 70, loop: true, gap: 1 },
    says: 'Play a short phrase, then pause. Koog answers in a famous style.', learns: 'Musical styles, and call and response.' },
  { id: 'feel-duo', room: 'Feel', title: 'DJ + Piano', seconds: 14, state: play('fire', 'sunset', { modes: ['duo'] }),
    perf: { k: 'notes', seq: AMIN, bpm: 100, vel: 68, loop: true, gap: 1 },
    says: 'A friend DJs on two decks while you play. The DJ sets the beat and the key.', learns: 'Playing together, in time.' },
  { id: 'feel-patch', room: 'Feel', title: 'Patch drawer', seconds: 14, state: play('ripples', 'ocean'),
    perf: { k: 'notes', seq: SLOW, bpm: 80, vel: 68, loop: true, gap: 1 }, ui: [{ sel: '.vb-patch', after: 800 }],
    says: 'A synthesizer drawn as a patch: oscillator, filter and amplifier, joined by cables. It changes how the visuals look.', learns: 'How a synthesizer makes and shapes a sound.' },
  { id: 'feel-quests', room: 'Feel', title: 'Patch Quests', seconds: 14, state: play('rise', 'galaxy'),
    perf: { k: 'notes', seq: ARP, bpm: 80, vel: 66, loop: true, gap: 1 }, ui: [{ sel: '.vb-patch', after: 600 }, { sel: '.pd-tab', text: 'Quests', after: 600 }],
    says: 'Guided lessons like "make it dark" and "slide like a ghost". Each one tells you what to watch.', learns: 'Cutoff, resonance and release, by ear.' },
  { id: 'feel-devices', room: 'Feel', title: 'Keyboards and devices', seconds: 10, state: play('ripples', 'ocean'),
    perf: { k: 'notes', seq: SLOW, bpm: 72, vel: 62, loop: true, gap: 1 }, ui: [{ sel: '.kg-dev-chip', after: 400 }],
    says: 'Plug in any USB keyboard and Koog finds it. A DJ controller can join too, with a role of its own.', learns: 'Real instruments plug in: no setup needed.' },
  { id: 'feel-drums', room: 'Feel', title: 'Drum pads', seconds: 14, state: play('ripples', 'sunset'),
    perf: { k: 'notes', seq: 'C4:.5 R:.5 E4:.5 R:.5 G4:.5 R:.5 E4:.5 R:.5', bpm: 100, vel: 64, loop: true, gap: 1 },
    ui: [{ sel: '.kg-dev-chip', after: 400 }, { sel: '.kg-dev-pop button', text: 'Drum pads', after: 600 }, { sel: '.kg-dev-chip', after: 600 }],
    says: 'Turn your keyboard or a controller into drum pads: hit a pad for a sound, or draw a looping beat on the step grid. In grown-up Boss mode it is the DRUMS tab, and the DJ controller can switch to Drums too.', learns: 'Rhythm: building a beat one step at a time.' },
  { id: 'feel-pedal', room: 'Feel', title: 'Foot pedal', seconds: 10, state: play('ripples', 'sunset'),
    perf: { k: 'notes', seq: '[C4,E4,G4]:3 [F3,A3,C4]:3 [G3,B3,D4]:3 [C4,E4,G4,C5]:4', bpm: 66, vel: 62 }, ui: [{ sel: '.kg-dev-chip', after: 400 }],
    says: 'Any USB foot pedal works. Open the devices menu, tap Set up a USB foot pedal and press the pedal once. Then pick its job: hold notes like a piano pedal, or run the looper.', learns: 'How a piano pedal blends notes together.' },

  // ---------------------------------------------------------------- Room 3: Learn
  { id: 'learn-ode', room: 'Learn', title: 'Song: Ode to Joy (Wait)', seconds: 24, state: { screen: 'songs', item: 'ode' },
    perf: { k: 'song', id: 'ode', vel: 74 }, ui: [{ sel: '.sg .play button.btn', text: 'Play', after: 600 }],
    says: 'In Wait mode the song pauses until you find the right note. No rush, no wrong turns. The falling notes get the whole screen, with one line of words above them.', learns: 'Finding notes and following a melody.' },
  { id: 'learn-mary-flow', room: 'Learn', title: 'Song: Mary (Flow)', seconds: 32, state: { screen: 'songs', item: 'mary', songMode: 'flow' },
    perf: { k: 'song', id: 'mary', vel: 72 }, ui: [{ sel: '.sg .play button.btn', text: 'Play', after: 200 }],
    says: 'In Flow mode a backing beat keeps time, and the song keeps moving with you.', learns: 'Keeping time with a steady beat.' },
  { id: 'learn-ladder-listen', room: 'Learn', title: 'Learn it: listen', seconds: 10, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 1, rung: 1 },
    perf: { k: 'learn' }, says: 'Learn it teaches a song a few notes at a time, up a ladder. Step one: just listen.', learns: 'Listening before playing.' },
  { id: 'learn-ladder-follow', room: 'Learn', title: 'Learn it: follow', seconds: 12, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 1, rung: 2 },
    perf: { k: 'learn' }, says: 'Next, the glowing key shows you where to go.', learns: 'Matching notes to keys.' },
  { id: 'learn-ladder-echo', room: 'Learn', title: 'Learn it: echo', seconds: 14, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 2, rung: 3 },
    perf: { k: 'learn' }, says: 'Hear the phrase, then play it back.', learns: 'Echoing what you hear.' },
  { id: 'learn-ladder-memory', room: 'Learn', title: 'Learn it: memory', seconds: 14, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 2, rung: 4 },
    perf: { k: 'learn' }, says: 'The keys stop glowing. Now it is in your memory, and your fingers.', learns: 'Memorising music: the way real players learn.' },
  { id: 'learn-ladder-timed', room: 'Learn', title: 'Learn it: in time', seconds: 14, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 3, rung: 5 },
    perf: { k: 'learn' }, says: 'Now the beat matters: play the phrase on the beat, with the click.', learns: 'Keeping a steady pulse.' },
  { id: 'learn-ladder-blind', room: 'Learn', title: 'Learn it: no sheet', seconds: 14, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 3, rung: 6 },
    perf: { k: 'learn' }, says: 'The notes fade off the staff. You play it from memory alone.', learns: 'Playing without reading.' },
  { id: 'learn-ladder-hands', room: 'Learn', title: 'Learn it: both hands', seconds: 14, state: { screen: 'songs', item: 'ode', songMode: 'learn', phrase: 3, rung: 7 },
    perf: { k: 'learn' }, says: 'The last rung adds the left hand: a chord under the tune.', learns: 'Two hands, two jobs.' },
  { id: 'songs-record', room: 'Learn', title: 'My Songs: record your own', seconds: 14, state: { screen: 'songs' },
    perf: { k: 'notes', seq: 'E4:.5 G4 C5:1 G4:.5 E4 C4:1 R:1', bpm: 84, vel: 66, loop: true, gap: 2 },
    ui: [{ sel: 'button.btn-ghost', text: 'My Songs', after: 500 }, { sel: '.ms-head button', text: 'Record', after: 500 }],
    says: 'Make up a tune on the keyboard, press record, and it becomes a song of your own that you can play back and practise.', learns: 'Composing: your music, written down.' },
  { id: 'song-lofi', room: 'Learn', title: 'Song: Rainy Window Homework', seconds: 27, state: { screen: 'songs', item: 'pop-lofi' },
    perf: { k: 'song', id: 'pop-lofi', vel: 70 }, ui: [{ sel: '.sg .play button.btn', text: 'Play', after: 600 }],
    says: 'A cozy original song written for Koog. Original pop songs sit next to the classics.', learns: 'Modern songs use the same building blocks as old ones.' },
  { id: 'song-gymnopedie', room: 'Learn', title: 'Song: Gymnopedie', seconds: 32, state: { screen: 'songs', item: 'gymnopedie' },
    perf: { k: 'song', id: 'gymnopedie', vel: 66 }, ui: [{ sel: '.sg .play button.btn', text: 'Play', after: 600 }],
    says: 'Slow, floating piano music from 1888. The classical room is full of pieces like it.', learns: 'Slow music is brave: every note has to count.' },
  { id: 'song-prelude', room: 'Learn', title: 'Song: Bach, Prelude in C', seconds: 76, state: { screen: 'songs', item: 'prelude' },
    perf: { k: 'song', id: 'prelude', vel: 70 }, ui: [{ sel: '.sg .play button.btn', text: 'Play', after: 600 }],
    says: 'Bach wrote this nearly 300 years ago. It is one chord after another, spelled out note by note.', learns: 'Chords can be played as a flowing pattern.' },
  { id: 'beats-groove', room: 'Learn', title: 'Beats', seconds: 16, state: { screen: 'beats', item: 'funk' },
    perf: { k: 'notes', seq: 'C4:.5 R:.5 Eb4:.5 G4:.5 R:.5 Bb4:.5 G4:.5 Eb4:.5 C4:1 R:1', bpm: 100, vel: 66, loop: true, gap: 1 },
    says: 'Eight original grooves made in the browser. Pick one and jam over it; Koog keeps you in key.', learns: 'The pocket: playing with a groove.' },
  // ---------------------------------------------------------------- Room 4: Games (challenges, then the four games)
  chal('climb', 'Scale Climber', 'Up the scale and back down, one glowing note at a time.', 'The notes of a scale, in order.'),
  chal('stay', 'Stay in Key', '30 notes with no spicy ones. Improvise freely.', 'Staying inside a key.'),
  chal('echo', 'Echo Me', 'Watch a melody that grows each round, then play it back.', 'Musical memory.'),
  chal('chords', 'Chord Builder', 'Hold the named chord with all its notes at once.', 'How chords are built.'),
  chal('speed', 'Speed Run', 'How many in-key notes in 15 seconds?', 'Quick fingers, still in key.'),
  chal('detective', 'Note Detective', 'A note name appears. Track it down on the keys.', 'Where every note lives.'),
  chal('interval', 'Interval Jumper', 'Leap a 3rd, 5th or octave above the shown note.', 'Intervals: the distance between notes.'),
  chal('rhythm', 'Rhythm Copy', 'Tap the dot pattern. The gaps matter, not the notes.', 'Rhythm, separate from pitch.'),
  chal('black', 'Black Keys Only', '25 notes and zero white keys. It is impossible to sound bad.', 'The pentatonic scale, by accident.'),
  chal('mirror', 'Mirror Mode', 'Flip each note around the middle D.', 'Symmetry on the keyboard.'),
  chal('dynamics', 'Loud and Soft', 'Whisper or thunder, on request.', 'Dynamics: your touch is the controller.'),
  chal('majmin', 'Major or Minor?', 'Hear a chord and say whether it sounds happy or moody.', 'Telling major from minor by ear.'),
  chal('gliss', 'Glissando Dash', 'Sweep every white key, low to high.', 'Glissando: the fast slide up the keys.'),
  chal('boss', 'Boss Level', 'Five random mini-tasks back to back.', 'Putting it all together.', 13),
  chal('daily', 'Daily Challenge', 'One challenge per day, the same for everyone.', 'A little practice every day.'),
  { id: 'game-zombies', room: 'Games', title: 'Zombie Lanes', seconds: 20, state: { screen: 'games', item: 'zombies' },
    perf: { k: 'guide', seq: PENT, bpm: 80 }, ui: [{ sel: '.zl-btn.go', after: 800 }],
    says: 'Zombies walk down lanes lined up with your keys. Play the note on the sign to blast them.', learns: 'Where every note lives.' },
  { id: 'game-jiujitsu', room: 'Games', title: 'Jiu-Jitsu Flow', seconds: 20, state: { screen: 'games', item: 'jiujitsu' },
    perf: { k: 'guide', seq: PENT, bpm: 80 }, ui: [{ sel: '.bj-btn.go', after: 800 }],
    says: 'Echo your training partner\'s phrases on the beat to move up the positions and earn belts.', learns: 'Call and response, and keeping the flow.' },
  { id: 'game-fashion', room: 'Games', title: 'Runway Remix', seconds: 14, state: { screen: 'games', item: 'fashion' },
    perf: { k: 'notes', seq: SLOW, bpm: 80, vel: 66, loop: true, gap: 1 },
    says: 'Style a model through six eras of music, then play the era\'s piece on the beat so they strut the runway.', learns: 'Musical eras and style.' },
  { id: 'game-bachdoom', room: 'Games', title: 'BachDoom', seconds: 28, state: { screen: 'games', item: 'bachdoom', level: 'e1m1' },
    perf: { k: 'guide', seq: PENT, bpm: 80 }, ui: [{ sel: '.bd-start', after: 1200 }],
    says: 'A retro first-person shooter where the music is the ammo. Clashing-note demons only fall to real notes. (A fan-made parody.)', learns: 'Playing real pieces, in time.' },

  // ---------------------------------------------------------------- Room 5: History
  { id: 'synth-timeline', room: 'History', title: 'Synth instruments and history', seconds: 10, state: { screen: 'synth' },
    perf: { k: 'notes', seq: SLOW, bpm: 72, vel: 62, loop: true, gap: 1 },
    says: 'Two views: Instruments, ten playable Koog synths, and Timeline, a year-by-year story from the 1920s to modular synths today, with a quiz.', learns: 'How electronic instruments changed music.' },
  emu('airhands', 'Koog Air', 'Played without touching it, by moving your hands in the air. (Koog\'s own take, inspired by the first electronic instruments.)', 'Pitch can slide, not just step.', 'E4:2 G4:2 A4:3 G4:1 E4:2 D4:2 C4:4', 70),
  emu('ribbon', 'Koog Ribbon', 'A ribbon-and-ring instrument for gliding, voice-like notes, inspired by early electronic concert instruments.', 'Early electronic music was made for concert halls.', SLOW, 70),
  emu('wheelhouse', 'Koog Wheelhouse', 'A warm, humming drawbar organ, inspired by the tonewheel organs behind jazz, gospel and rock.', 'Drawbars: mixing harmonics to make a tone.', '[C3,E3,G3,C4]:3 [F3,A3,C4,F4]:3 [G3,B3,D4,G4]:3 [C3,E3,G3,C4]:3', 72),
  emu('tapechoir', 'Koog Tape Choir', 'A tape-style keyboard of strings, choirs and flutes, inspired by the tape-replay keyboards of the 1960s.', 'Sampling started with tape.', 'C4:2 E4:2 G4:3 E4:1 D4:2 F4:2 E4:4', 66),
  emu('ladder', 'Koog Ladder', 'A fat analog-style mono synth for bass and soaring leads, inspired by the first portable analog synths.', 'Oscillators, filters and envelopes.', LOW, 96),
  emu('patchbay', 'Koog Patchbay', 'A semi-modular synth: sliders, switches and a patch bay, inspired by the 1970s.', 'Signal flow: where the sound goes.', 'C4:.5 E4 G4 C5 B4 G4 E4 C4 D4 F4 A4 D5 C5 A4 F4 D4', 100),
  emu('squelch', 'Koog Squelch', 'A little bass box with a step sequencer and a squelchy filter, inspired by the 1980s.', 'Step sequencing: building a pattern.', 'C2:.5 C2 C3 C2 Eb2 C2 G2 C2 F2:.5 F2 F3 F2 G2:.5 G2 D3 G2', 110),
  emu('five', 'Koog Five', 'A five-voice synth for chords, inspired by the first programmable polysynths.', 'Polyphony: many notes at once.', '[C4,E4,G4]:2 [A3,C4,E4]:2 [F3,A3,C4]:2 [G3,B3,D4]:2', 80),
  emu('shimmer', 'Koog Shimmer', 'A friendly chorus synth for lush pads, inspired by the early 1980s.', 'Chorus: two copies slightly apart sound wide.', '[C4,E4,G4]:3 [G3,B3,D4]:3 [A3,C4,E4]:3 [F3,A3,C4]:3', 70),
  emu('bellfm', 'Koog Bell FM', 'Glassy bells and electric pianos made by one wave bending another.', 'FM: sounds from waves that wiggle waves.', 'E5:.5 G5 E5 C5 D5:1 B4:.5 C5:1.5 R:1 E5:.5 G5 A5 G5:1 E5:2', 90),
  { id: 'log-behind', room: 'History', title: 'Behind the scenes', seconds: 10, state: { screen: 'log' },
    perf: { k: 'notes', seq: SLOW, bpm: 72, vel: 60, loop: true, gap: 1 },
    says: 'A live build log, in middle-school language. Kids send feature ideas and get replies.', learns: 'How software gets made, one request at a time.' },

  // ---------------------------------------------------------------- Room 6: Studio (Boss mode)
  { id: 'boss-studio', room: 'Studio', title: 'Boss studio', seconds: 14, state: { mode: 'boss', screen: 'play' },
    perf: { k: 'notes', seq: ARP, bpm: 84, vel: 66, loop: true, gap: 1 },
    says: 'Boss mode is a lean studio for grown-ups: master clock, mixer, sound rack and routing.', learns: 'How a signal moves through a studio.' },
  { id: 'boss-dj', room: 'Studio', title: 'Boss: DJ decks', seconds: 12, state: { mode: 'boss', screen: 'dj' },
    perf: { k: 'notes', seq: AMIN, bpm: 90, vel: 64, loop: true, gap: 1 },
    says: 'Two decks, a crossfader and effects.', learns: 'Beat matching and mixing.' },
  { id: 'boss-loops', room: 'Studio', title: 'Boss: loop station', seconds: 16, state: { mode: 'boss', screen: 'loops' },
    perf: { k: 'notes', seq: 'C3:1 G3 C4 G3 A2 E3 A3 E3 F2 C3 F3 C3 G2 D3 G3 D3', bpm: 84, vel: 64, loop: true, gap: 1 },
    says: 'One big button: tap to record, tap to loop, tap to add a layer, double-tap to stop, hold to undo. A metronome keeps time, every layer has its own sound, and you can mute or remove any layer.', learns: 'Layering: one player, many parts, all in time.' },
  { id: 'boss-synths', room: 'Studio', title: 'Boss: synth rack', seconds: 12, state: { mode: 'boss', screen: 'synth' },
    perf: { k: 'notes', seq: SLOW, bpm: 76, vel: 64, loop: true, gap: 1 },
    says: 'Every emulator in one rack, ready to play.', learns: 'Choosing a sound for the music.' },
  { id: 'boss-scenes', room: 'Studio', title: 'Boss: scenes', seconds: 12, state: { mode: 'boss', screen: 'scenes' },
    perf: { k: 'notes', seq: ARP, bpm: 84, vel: 64, loop: true, gap: 1 },
    says: 'Eight saved scenes: a whole setup, one tap away.', learns: 'Getting ready for a performance.' },
  { id: 'end-teacher', room: 'Studio', title: 'Teaching with Koog', seconds: 14, state: play('fireworks', 'rainbow'),
    perf: { k: 'notes', seq: 'C4:1 E4 G4 C5:2 G4:1 E4 C4:2 R:2', bpm: 66, vel: 64, loop: true, gap: 1 },
    link: { label: 'Open the teacher demo', href: '/teacher/' },
    says: 'There is a teacher demo too: lesson ideas and a classroom walkthrough built around Koog. And the Gallery button in the top bar brings this tour back any time, or starts calm Art Gallery mode.', learns: 'Music class that kids can hear and see.' },
  // Phrase Match
  { id: 'game-memory', room: 'Games', title: 'Phrase Match', seconds: 14, state: { screen: 'games', item: 'memory' },
    perf: { k: 'notes', seq: 'C4:1 D4 E4 G4:2 R:1 E4:1 D4 C4 E4:2', bpm: 80, vel: 64, loop: true, gap: 1 },
    says: 'A memory card game for tunes. Flip a card to hear its phrase, find the twin, then play it back on the keys to win the pair.', learns: 'Remembering melodies by ear.' },
  // Art Gallery skip, pick, play-along and the holiday galleries
  { id: 'end-art', room: 'Studio', title: 'Art Gallery mode', seconds: 14, state: play('ripples', 'sunset'),
    perf: { k: 'notes', seq: 'E4:1 G4 A4:2 G4:1 E4 D4:2 C4:1 D4 E4:2 R:1', bpm: 66, vel: 62, loop: true, gap: 1 },
    says: 'Art Gallery mode is the calm full-screen show. Skip jumps to the next piece, the picker jumps to any piece, and it keeps going while you play: your notes make the art move and the music makes room. There are Thanksgiving and Christmas versions too, with falling leaves or snow and glowing lights.',
    learns: 'The same notes can make a picture. Space pauses, the right arrow skips, Esc leaves.' },
  // Drum machine: banks, step edit, fill. Mimic: jazz players
  { id: 'end-drum-edit', room: 'Feel', title: 'Drum machine: patterns, fills, step edit', seconds: 16, state: play('ripples', 'sunset'),
    ui: [{ sel: '.kg-dev-chip', after: 400 }, { sel: '.kg-dev-pop button', text: 'Drum pads', after: 600 }, { sel: '.kg-dev-chip', after: 600 }],
    perf: { k: 'notes', seq: 'C4:1 R:1 C4:1 R:1', bpm: 100, vel: 60, loop: true, gap: 1 },
    says: 'The drum pads copy the DJ controller: deck A pads on the left, deck B on the right. Keep four patterns (A to D) and switch at the bar line, mute or solo a drum, mark a louder accent step, copy bar 1 to bar 2 and hold FILL for a roll. On the controller, PAD MODE turns the pads into steps. The foot pedal plays the kick.',
    learns: 'How a drum machine works: patterns, accents and fills are what make a beat feel alive.' },
  { id: 'end-mimic-players', room: 'Feel', title: 'Mimic: play like the jazz greats', seconds: 16, state: play('ripples', 'galaxy', { modes: ['mimic'] }),
    perf: { k: 'notes', seq: 'D4:1 F4 A4 C5:2 R:2', bpm: 80, vel: 60, loop: true, gap: 2 },
    says: 'Mimic can answer you in the style of Miles Davis (space and long tones), John Coltrane (fast runs), Thelonious Monk (crunchy neighbour notes), Duke Ellington, Louis Armstrong, Ella Fitzgerald and more. It copies the habits, never their recordings.',
    learns: 'A style is a set of habits: which notes, how much space, how the rhythm swings.' },
  // Holiday songs and the two memorization games
  { id: 'holiday-songs', room: 'Learn', title: 'Holiday songs', seconds: 14, state: { screen: 'songs' },
    perf: { k: 'notes', seq: 'G4:1.5 A4:.5 G4:1 E4:3 G4:1.5 A4:.5 G4:1 E4:3', bpm: 66, vel: 60, loop: true, gap: 2 },
    says: 'The Holiday tab has Thanksgiving and Christmas songs: Over the River, We Gather Together, Silent Night, Joy to the World, Jingle Bells and more. They all work with Wait, Flow and Learn it, and every one is public domain.',
    learns: 'Old songs belong to everyone, and holiday tunes are great practice because you already hear them in your head.' },
  { id: 'game-feast', room: 'Games', title: 'Harvest Feast', seconds: 16, state: { screen: 'games', item: 'feast' },
    perf: { k: 'notes', seq: 'D4:1 G4 G4 G4 A4 B4 G4:2 R:1', bpm: 84, vel: 62, loop: true, gap: 1 },
    says: 'Pick a Thanksgiving song and climb six rungs: hunt and peck, follow, echo, memory, play the whole song, and master. Every phrase you nail puts a dish on the table, and playing the whole song from memory serves the turkey.',
    learns: 'You memorize in steps: first with help, then less help, then none.' },
  { id: 'game-tree', room: 'Games', title: 'Light the Tree', seconds: 16, state: { screen: 'games', item: 'tree' },
    perf: { k: 'notes', seq: 'G4:1.5 A4:.5 G4:1 E4:3 G4:1.5 A4:.5 G4:1 E4:3', bpm: 66, vel: 60, loop: true, gap: 1 },
    says: 'Pick a Christmas song and climb the same six rungs, all the way to the whole song from memory. Every phrase you nail hangs an ornament and lights the tree, and when you can play the whole song from memory a star goes on top. A peek in the memory level costs you a star.',
    learns: 'The echo level trains your ear: hear a phrase, then play it back.' },
  { id: 'looper-pedal-boost', room: 'Studio', title: 'Pedal looper, M metronome, Boost', seconds: 14, state: play('fireworks', 'rainbow'),
    perf: { k: 'notes', seq: 'C3:1 G3 C4 G3 A2 E3 A3 E3 F2 C3 F3 C3 G2 D3 G3 D3', bpm: 84, vel: 64, loop: true, gap: 1 },
    says: 'A foot pedal can run the looper with one tap: tap to record, tap to loop, two quick taps to stop, hold two seconds to clear (with a five second Undo). Press M anywhere for a metronome click (Shift+M while the computer keys play notes). And Boost lifts the volume for quiet laptop speakers, never for headphones.', learns: 'Keeping time, and how loud is too loud.' },
  { id: 'pedalboard-stomp', room: 'Studio', title: 'Pedalboard and piano pedals', seconds: 16, state: play('ripples', 'sunset'),
    perf: { k: 'notes', seq: 'C4:1 E4 G4 C5:2 G4:1 E4 C4:2', bpm: 90, vel: 64, loop: true, gap: 1 },
    says: 'Open the Pedalboard from the Devices menu or ✨ Modes. Each pedal is a stompbox: Fuzz, Echo, Chorus, Jet, Swirl, Wobble, Quack, Octave, Squeeze and Reverb. Stomp one on, turn its knobs, drag to change the order, or try a preset like Space or Underwater. A USB foot pedal can stomp the selected one, and a keyboard pedal can be the soft pedal, the sostenuto or an expression swell.',
    learns: 'Signal chains: sound flows through each effect in order, so Fuzz then Echo is very different from Echo then Fuzz.' },
  { id: 'dancer-eggs', room: 'Play', title: 'Dancer easter eggs', seconds: 14, state: play('dancer', 'candy'),
    perf: { k: 'notes', seq: 'C4:1 G3:.5 G3:.5 A3:1 G3:2 B3:1 C4:2 R:2 G4:.75 G4:.25 A4:1 G4:1 C5:1 B4:2', bpm: 100, vel: 70, loop: true, gap: 2 },
    says: 'The Dancer has secret tunes. Play Shave and a Haircut and he grows a foam beard, play Happy Birthday and he gets a cake, play a whole scale and he turns into a fish. There are 26 to find, from Ode to Joy to Jingle Bells (Santa!). Tap the Eggs button to see them all, and play any one you have found.',
    learns: 'Recognising a tune by its intervals: the jumps between notes stay the same in every key, so one pattern matches the song anywhere on the keyboard.' },
  { id: 'loops-to-code', room: 'Studio', title: 'Your loop as code', seconds: 14, state: play('ripples', 'sunset'),
    perf: { k: 'notes', seq: 'C4:1 E4 G4 E4 C4:1 G4 E4:2', bpm: 100, vel: 64, loop: true, gap: 1 },
    says: 'Every loop and drum beat has a </> Code button. Copy for Sonic Pi puts your loop on the clipboard as a live_loop you can paste in and run; Open in Strudel opens a free in-browser coding page with your music already typed in. Change one number, run it again, and hear what it did. Sonic Pi and Strudel are free tools made for learning.',
    learns: 'A loop is a list of notes and waits, so music and code are the same idea. Live coding means changing the list while it plays.' },
  { id: 'perf-monitor', room: 'Studio', title: 'Is Koog keeping up?', seconds: 12, state: { mode: 'boss', screen: 'play' },
    perf: { k: 'notes', seq: 'C4 E4 G4 C5 G4 E4', bpm: 96, vel: 64, loop: true, gap: 1 },
    says: 'In Boss mode the small clock button in the bottom-left corner opens the Perf monitor. It times every frame, the gap between pressing a key and hearing it, and the audio itself, for each screen you visit, then colors them green, yellow or red against a budget. Copy report puts the numbers on the clipboard. It all stays on this device: nothing is sent anywhere.',
    learns: 'Latency is the delay between doing something and getting the result. Under about 10 milliseconds between a key and its sound feels instant, and at 60 frames a second each picture has 16 milliseconds to be drawn.' },
  { id: 'koog-kode', room: 'Studio', title: 'Koog Kode: code your music', seconds: 18, state: { screen: 'kode' },
    perf: { k: 'notes', seq: 'C4:1 E4 G4 E4 C4 E4 G4 C5:2', bpm: 100, vel: 62, loop: true, gap: 1 },
    says: 'Open it from ✨ Modes. Type notes "c e g e" and press Run: it plays, and every line you add is another layer on the same beat. Edit it while it plays and the change lands at the next bar line. Drums use names like kick and snare, [ ] squeezes steps together and < > picks a new one each bar. Press Write it for me, play a phrase on any instrument, and Koog writes the code for it.',
    learns: 'Code is just instructions in a tiny language. Here the instructions are music, and a computer can only follow them exactly as written.' },
  { id: 'game-racer', room: 'Games', title: 'Koogalien Racer', seconds: 16, state: { screen: 'games', item: 'racer' },
    perf: { k: 'notes', seq: 'E4:1 D4 C4 D4 E4:2 R:1', bpm: 72, vel: 62, loop: true, gap: 1 },
    says: 'The road is a tune. Hear a short phrase, play it back on the beat, and a car drives what you played: a note higher bends the road right, lower bends it left, the same note goes straight. A wrong note steers you off the road into a pond or hay bales, and the game tells you which note it was. Pick your vehicle by playing its note four times, or tap a drum pad four times. It works with keys, drum pads, a DJ controller and a foot pedal.',
    learns: 'A melody is a shape in time: the size of each jump between notes is what makes the tune go up, down or stay put.' },
  { id: 'koog-store', room: 'Studio', title: 'The app store for Kode apps', seconds: 16, state: { screen: 'play' },
    perf: { k: 'notes', seq: 'C4:1 E4 G4 C5 G4 E4 C4:2', bpm: 104, vel: 62, loop: true, gap: 1 },
    says: 'Tap the 🏪 button at the top (or ✨ Modes, or the Gallery menu) to open the store. Apps sit on shelves like Kode apps, Learn a song and Games. Each card shows the coding ideas it teaches, which of your instruments work with it, and how long it takes. Open one, and the coding powers you use there light up on your 🏅 My coding powers wall. Everything is free and built in: nothing to download, nothing to buy.',
    learns: 'Every program is built from a few big ideas: sequences, loops, functions, events and more. Each time you use one in an app, the store notices and gives you the badge.' },
  { id: 'my-motifs', room: 'Studio', title: 'My Motifs: save a phrase as a function', seconds: 16, state: { screen: 'play' },
    perf: { k: 'notes', seq: 'C4:1 E4 G4 E4 D4 F4 A4 F4', bpm: 100, vel: 62, loop: true, gap: 1 },
    says: 'Play a short phrase, then stomp the pedal or press Save motif, and Koog saves it with an emoji and a name. Its call sign is the first two notes with the second held: play it higher and the whole motif plays higher, hold the pedal for double speed, play harder for louder. Find it in the Koog App Store as My Motifs.',
    learns: 'A function is a named bit of code you can run again. The pitch, speed and loudness you choose are its parameters, and a motif that calls itself like a round is recursion.' },
  { id: 'koog-alien', room: 'Studio', title: 'Meet the Koog Alien', seconds: 12, state: { screen: 'play' },
    perf: { k: 'notes', seq: 'C4:1 G4 A4 C5:2 R:1', bpm: 92, vel: 60, loop: true, gap: 1 },
    says: 'This is the Koog Alien, Koog\'s mascot. It came from planet Koog to learn Earth music, and it waves when you pick who is playing and cheers when you earn a badge. Its antennae end in little synth knobs and its belly is a tiny piano.',
    learns: 'A good guide character makes a new language feel friendly. The Koog Alien will teach you to speak Koogalien, a language made of notes.' },
  { id: 'game-pads', room: 'Games', title: 'Game pads', seconds: 14, state: { screen: 'games' },
    perf: { k: 'notes', seq: 'C4:.5 D4:.5 E4:.5 F4:.5 G4:1 R:.5', bpm: 100, vel: 70, loop: true, gap: 1 },
    ui: [{ sel: '.kg-dev-chip', after: 400 }, { sel: '.kg-dev-pop button', text: 'Game pads', after: 700 }, { sel: '.kg-dev-chip', after: 600 }],
    says: 'Your DJ controller can play games. Turn on Game pads and its 8 pads become real notes: low four on the left deck, high four on the right. Pick Follow the game and the pad that lights up is always the next note, so you can play any song or game by hitting the lit pad. JOG A moves the pads an octave, PLAY starts. No controller? Eight big pads show up on screen.', learns: 'A scale is a ladder of notes; the pads are its rungs, from the home note up to the octave.' },
  { id: 'game-kode-powers', room: 'Games', title: 'Kode powers in the games', seconds: 16, state: { screen: 'games' },
    perf: { k: 'notes', seq: 'C4:.5 E4:.5 G4:1 C5:1 G4:.5 E4:.5 C4:1 R:.5', bpm: 104, vel: 62, loop: true, gap: 1 },
    says: 'Five games hide a Kode power card on their menus, switched off until you want it. BachDoom turns your saved motifs into spells: play a call sign below the tune to cast it, higher hits harder. Zombie Lanes lets you program a helper turret with a lane pattern, a repeat and an event rule. Jiu-Jitsu Flow saves a chain of positions as a combo you can drill three times. Runway Remix saves a look with blanks the chord fills in, and runs a three-look show. Phrase Match names each tune you win, like a = "c e g", then asks you to play b a b.',
    learns: 'Functions, parameters, loops, sequences, events and variables are the same ideas in every language. Here you meet each one by playing.' },
  { id: 'koogalien', room: 'Studio', title: 'Learn Koogalien', seconds: 14, state: { screen: 'play' },
    perf: { k: 'notes', seq: 'C4:.5 A4:1 R:.5 C4:.5 G4:.5 C5:1 R:1', bpm: 84, vel: 60, loop: true, gap: 1 },
    says: 'Koogalien is the alien language the Koog Alien speaks, and it is made of notes. A word is a chord: press hello (do and la) and world (do, sol and high do) with a rest between, and Koog writes say hello world. in code, shows the English, and plays it back. Open the Koog App Store, pick Koogalien, and use the Dictionary to look words up or the Echo Game to practise them.',
    learns: 'A language is a set of agreed shapes that mean things, and code is one too. Words that come back just before you forget them, called spaced repetition, are how your brain keeps them for good.' },
  { id: 'koreographer', room: 'Studio', title: 'Koreographer: program a dancer', seconds: 16, state: { screen: 'play' },
    perf: { k: 'notes', seq: 'C4:1 G4 E4:2 C4:1 G4 E4:2', bpm: 100, vel: 62, loop: true, gap: 1 },
    link: { label: 'Open Koreographer', href: '#/apps/choreographer' },
    says: 'Open the Koog Store and pick Koreographer. Play a short tune, say it means Spin, and you have taught the dancer a function. Then build a routine: tap moves to line them up, wrap one in a repeat, add a when rule (when the kick hits, jump) and an if / else (a high note waves left, a low note waves right). Press Perform and he dances to the beat while each block lights up like a debugger; Step goes one move at a time. Twelve puzzles, and you can save a dance or share it as a link.',
    learns: 'A function is a name plus what it does, a loop repeats, an event waits for something to happen, and an if / else chooses. Programs are those four ideas in different clothes.' },
]

/** the tour's total length in seconds */
export const TOTAL_SECONDS = STOPS.reduce((n, s) => n + s.seconds, 0)
export const stopIndex = (id: string) => STOPS.findIndex((s) => s.id === id)
/** a plain list for links and agents */
export const STOP_LIST = STOPS.map((s) => ({ id: s.id, room: s.room, title: s.title, seconds: s.seconds }))
