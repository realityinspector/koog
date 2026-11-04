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
    says: 'Guided lessons like "make it dark" and "slide like a theremin". Each one tells you what to watch.', learns: 'Cutoff, resonance and release, by ear.' },
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
  { id: 'synth-timeline', room: 'History', title: 'Synth history', seconds: 10, state: { screen: 'synth' },
    perf: { k: 'notes', seq: SLOW, bpm: 72, vel: 62, loop: true, gap: 1 },
    says: 'A timeline from the 1920 theremin to the modular synths of today, with a quiz. Every card opens a playable emulator.', learns: 'How electronic instruments changed music.' },
  emu('theremin', 'Theremin', 'Played without touching it, by moving your hands in the air. (A synthesized emulation.)', 'Pitch can slide, not just step.', 'E4:2 G4:2 A4:3 G4:1 E4:2 D4:2 C4:4', 70),
  emu('ondes', 'Ondes Martenot', 'An early French electronic keyboard with a ribbon for gliding notes.', 'Early electronic music was made for concert halls.', SLOW, 70),
  emu('hammond', 'Tonewheel organ', 'The warm, humming organ behind a lot of jazz, gospel and rock.', 'Drawbars: mixing harmonics to make a tone.', '[C3,E3,G3,C4]:3 [F3,A3,C4,F4]:3 [G3,B3,D4,G4]:3 [C3,E3,G3,C4]:3', 72),
  emu('mellotron', 'Tape keyboard', 'Every key plays a little loop of recorded tape: strings, choirs and flutes.', 'Sampling started with tape.', 'C4:2 E4:2 G4:3 E4:1 D4:2 F4:2 E4:4', 66),
  emu('moog', 'Modular and mono synth', 'The big analog synth that made fat bass and soaring leads famous.', 'Oscillators, filters and envelopes.', LOW, 96),
  emu('arp', 'Patch-cable synth', 'A semi-modular synth of the 1970s: sliders, switches and cables.', 'Signal flow: where the sound goes.', 'C4:.5 E4 G4 C5 B4 G4 E4 C4 D4 F4 A4 D5 C5 A4 F4 D4', 100),
  emu('tb303', 'Bass line machine', 'A little silver box with a step sequencer, built for bass lines.', 'Step sequencing: building a pattern.', 'C2:.5 C2 C3 C2 Eb2 C2 G2 C2 F2:.5 F2 F3 F2 G2:.5 G2 D3 G2', 110),
  emu('prophet', 'Polysynth', 'The first synth that could play chords and remember its sounds.', 'Polyphony: many notes at once.', '[C4,E4,G4]:2 [A3,C4,E4]:2 [F3,A3,C4]:2 [G3,B3,D4]:2', 80),
  emu('juno', 'Chorus synth', 'A friendly 1980s synth famous for lush pads.', 'Chorus: two copies slightly apart sound wide.', '[C4,E4,G4]:3 [G3,B3,D4]:3 [A3,C4,E4]:3 [F3,A3,C4]:3', 70),
  emu('dx', 'FM synth', 'Glassy bells and electric pianos made by one wave bending another.', 'FM: sounds from waves that wiggle waves.', 'E5:.5 G5 E5 C5 D5:1 B4:.5 C5:1.5 R:1 E5:.5 G5 A5 G5:1 E5:2', 90),
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
]

/** the tour's total length in seconds */
export const TOTAL_SECONDS = STOPS.reduce((n, s) => n + s.seconds, 0)
export const stopIndex = (id: string) => STOPS.findIndex((s) => s.id === id)
/** a plain list for links and agents */
export const STOP_LIST = STOPS.map((s) => ({ id: s.id, room: s.room, title: s.title, seconds: s.seconds }))
