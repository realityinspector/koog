<p align="center"><img src="docs/images/koog-banner.svg" alt="KOOG logo: sunset-chrome letters where both O's are synth knobs, above the words The Koding Synth for Kids" width="760"></p>

# Koog

> **Inspired by Moog, coded with Loog, it's... Koog!**

**KOOG is the Koding Synth for Kids:** we make interactive games through classical music.
*The emotionally aware synth. The curriculum aware synth. The superintelligent synth.*

### ▶ Try it now: **[koog-demo.fly.dev](https://koog-demo.fly.dev)**

No install, no sign-up. Plays with the computer keyboard in Chrome or Edge. The **[teacher demo](https://koog-demo.fly.dev/teacher/)** shows a class what Koog does, live, and the **[gallery](https://koog-demo.fly.dev/#/gallery)** is a self-playing, ~18-minute tour of every feature with music. **[Art Gallery mode](https://koog-demo.fly.dev/#/gallery/art)** turns it into full-screen moving art for a TV or projector. For USB keyboards and pedals, [run it on your own computer](#setting-it-up).

**Koog is a free, open-source piano and synthesizer app that listens to a child play and turns what it hears into music lessons.** When a student ends a phrase on the home note, Koog says *"Cadence!"* and the fireworks bloom. When they repeat a pattern, it says *"Motif!"* Free play becomes music literacy, and nobody has to stop and lecture.

It runs in Chrome or Edge on any computer. Plug in any USB-MIDI keyboard, or play on the computer keyboard. It has no accounts, no ads, no tracking and no cost.

![Koog's main screen: a student plays and the display shows the key (C major), the chord, a "Music Power" meter, a streak counter, and a coach caption reading "Cadence! You ended on the home note."](docs/images/01-play.jpg)

---

## For teachers and parents: Koog in 60 seconds

| | |
|---|---|
| **Who it's for** | Beginners, roughly ages 6–13, at home, in a lesson, or at a station in a music lab. It also works for a child who only wants to bang on the keys. |
| **What it teaches** | Keys and scales, chords, steady pulse, phrases and cadences, motifs, tension and release, reading a grand staff, memorizing music, and some music history (synthesizers from 1920 to 1983). |
| **How** | Every note goes through one "listening judge". It names the musical idea the student just played, in kid language, and rewards it right away in the visuals and games. |
| **What it asks of you** | Nothing to install for students. A grown-up runs one command on a computer and opens a browser tab. Progress is saved per student on that computer. |
| **Cost and privacy** | Free (MIT license). Everything runs locally in the browser. No accounts, no data leaves the computer. |

![How Koog teaches: 1. the student plays, 2. Koog listens for key, chord, rhythm, melody shape, phrases and mood, 3. it names the idea ("Cadence!", "Motif!", "Tension → release!"), 4. it rewards it with bigger fireworks, game power-ups, stars or a mentor's kind comment, so the student plays more of what good music is made of.](docs/images/how-it-works.svg)

## What students learn, and where

| Music concept | How Koog teaches it | Where |
|---|---|---|
| **Keys and scales** | In-key notes burst gold; out-of-key notes look "spicy". The display shows the key it hears. | PLAY, every game |
| **Tension and release** | A "wrong" note that steps back into the key earns a gold *Release!* bloom, so dissonance becomes a tool, not a mistake. | PLAY, Mentor |
| **Phrases and cadences** | Ending a phrase on the home note triggers *Cadence!*: "that's how music says *end of sentence*". | PLAY, BachDoom |
| **Motifs and form** | Repeating a pattern, even starting on another note, triggers *Motif!*, with a nod to Beethoven's Fifth. | PLAY, Mentor |
| **Steady pulse** | Even rhythms make the fireworks fly straight; games give double points on the beat. | PLAY, GAMES, BEATS |
| **Chords and mood** | Vibes mode turns chords into a face: A minor looks sad, C major looks happy. "Make it spooky" is a challenge. | Vibes |
| **Reading music** | A grand staff follows along: single notes, easy chords, or a full left-hand part. Hits turn green. | Sheet, SONGS |
| **Memorizing a piece** | Songs are cut into 2–3-note phrases that climb a 7-rung ladder (below). | SONGS → 🧠 Learn it |
| **Dynamics and control** | Forearm slams *fizzle*, until about 16 good notes charge ⚡ BOOM. Then the same slam is a giant finale. Students learn noise has a time and place. | Everywhere |
| **Style and history** | Hear your phrase answered in Baroque, ragtime, blues and more; play Koog's own emulators, each inspired by a family of historic synthesizers. | Mimic, SYNTH |

### A tour in pictures

| | |
|---|---|
| ![Vibes mode: the student plays an A minor chord and a large crying face appears with the label SAD, alongside a sad-to-happy mood map.](docs/images/02-vibes.jpg) | ![Mentor mode: the student plays Ode to Joy in G during free play, and a friendly retro synth robot in the corner says "Was that Ode to Joy?! In G, sneaky."](docs/images/05-mentor.jpg) |
| **Vibes:** chords become feelings. Minor chords look sad, major chords happy. Students hear *why* music sounds the way it does. | **Mentor:** an encouraging audience member that names what the student did (motif, sequence, cadence) and spots tunes they've learned, even played in a new key. It gives one kind tip at a time. |
| ![Sheet music mode: a grand staff under the display shows Ode to Joy with chord symbols above; played notes turn green and a gold cursor marks the current note.](docs/images/04-sheet.jpg) | ![The Learn it screen for Ode to Joy: phrase 1 of 10 with note bubbles E, E, F, the instruction "Listen and watch the keys light up", and seven rungs from Listen to Both hands.](docs/images/03-learn.jpg) |
| **Sheet music:** a play-along grand staff at three levels (single notes, easy chords, full). It also writes down what a student improvises. | **Learn it:** the phrase trainer. The next key glows on the keyboard; each rung removes one support. |
| ![BachDoom: a retro pixel-art hall with demons labelled C4, D4 and E4, a pipe-organ gun, and the text "WAVE 1/5: FOLLOW, WATCH AND LISTEN".](docs/images/06-bachdoom.jpg) | ![The synth history rack: timeline cards by year: an antenna instrument (1920), a ring-and-ribbon instrument (1928), a tonewheel organ (1935), a tape keyboard (1963), voltage-controlled modular synths (1964), semi-modular synths (1971) and more.](docs/images/07-history.jpg) |
| **Games:** in BachDoom the melody *is* the ammo. Each demon is a note of the phrase, so winning means playing Ode to Joy, a minuet, and finally Bach's Prelude in C. | **History:** a timeline of electronic instruments from 1920 to 1983. Each one is playable and linked to a classical piece to learn. |

## How memorization works: the phrase ladder

![The phrase ladder: Listen (hear it, keys light), Follow (play the lit keys), Echo (hear it, then play it back), Memory (no lit keys), In time (on the beat), No sheet (the notes fade from the staff), Both hands (add the left-hand chord).](docs/images/phrase-ladder.svg)

Each student's progress on every phrase is saved, and phrases they haven't practised for a day come back for review. Mistakes show as specific, kind feedback ("too early", "that was D, you needed E"), never as shame. The same mastery record powers the games, so practising in BachDoom counts in SONGS too.

## Teaching ideas it's built on

Koog doesn't claim to be research-validated. It borrows well-known ideas from music teaching and learning science. Notes and sources are in [docs/learning/pedagogy.md](docs/learning/pedagogy.md).

- **Sound before symbol** (Kodály, Suzuki): listen and echo first; sheet music is optional and added gradually.
- **Scaffolding that fades:** lit keys, note names and the staff are removed one at a time, not all at once.
- **Chunking and spaced review:** 2–3-note phrases chain into lines; older phrases resurface for review.
- **Immediate, specific feedback:** the moment is named within a split second of playing it.
- **Name the concept, then let them play:** each lesson caption appears in full the first 3 times, then shrinks to a one-word label.
- **Play as the motivation:** games reward musical skill (in key, in time, in order), not button-mashing.

## Ideas for a lesson

- **Warm-up (5 min):** free play in PLAY. Ask, *"Can you make Koog say 'Cadence'?"* Students discover that ending on the home note feels finished.
- **Mood lab (10 min):** turn on Vibes. *"Make it sad. Now make it happy. What changed?"* (Major vs. minor, high vs. low, fast vs. slow.)
- **Memorize a tune (15 min):** SONGS → *Ode to Joy* → 🧠 Learn it. Students climb from Listen to Memory on the first few phrases.
- **Reward round:** a few minutes of BachDoom or Zombie Lanes. Only correct, in-time notes score.

## Ask an AI to get your kid started

Koog has a small API and a remote [MCP](https://modelcontextprotocol.io) server, so a parent can tell ChatGPT, Claude or Grok "my 7-year-old loves zombies, we have 15 minutes" and get back a short plan, links that open Koog in exactly the right place, instructions for you and a line to read to your kid. It asks a couple of questions first (age, minutes, whether you have a USB keyboard, what your kid likes).

It is stateless: no accounts, nothing about your child is stored or logged. Progress stays in your kid's own browser. Endpoints and the link format are in [docs/api.md](docs/api.md).

- **Claude:** in Settings, open Connectors (some versions say Customize, then Connectors), choose *Add custom connector*, and enter `https://koog-demo.fly.dev/mcp`. No sign-in is needed. Where your plan supports custom connectors; on Team and Enterprise plans an owner adds it for the organization.
- **ChatGPT:** where your plan supports custom connectors, turn on Developer mode (Settings, Connectors, Advanced), then create a connector with the URL `https://koog-demo.fly.dev/mcp` and no authentication. Or build a custom GPT and import `https://koog-demo.fly.dev/openapi.json` as an Action.
- **Grok:** add it as a remote MCP tool through the xAI API (`server_url` = `https://koog-demo.fly.dev/mcp`), or just paste `https://koog-demo.fly.dev/llms.txt` into a chat and ask it to follow the instructions.

Menus change often; if yours differs, look for "custom connector" or "MCP server" in the product's help. Any other MCP client can use the same URL (Streamable HTTP, stateless). Without any AI, `curl "https://koog-demo.fly.dev/api/start?age=7&minutes=15&interests=zombies"` gives the same plan as JSON.

Run it yourself with `npm run server` (port 8787). Deploying the demo with `npm run deploy:fly` ships the API beside the static site.

## Setting it up

![Setup at home: one computer with Chrome or Edge, an optional USB-MIDI keyboard, and speakers or headphones. 1. Install Node, then run npm install and npm start. 2. Plug in the keyboard, or use the computer keys. 3. Open Koog in Chrome at localhost:5173. 4. Each kid picks a code word, so siblings keep their own stars.](docs/images/setup-home.svg)

![Setup in a classroom or computer lab: build Koog once (npm run build) and put the dist folder on the school's HTTPS web server, or run npm start on each computer. Each station has a computer, an optional USB-MIDI keyboard and headphones. The teacher projects Koog to demo a move. Web MIDI needs HTTPS or localhost, and progress is saved per code word on each computer.](docs/images/setup-classroom.svg)

**Hosting for a whole room:** `npm run build` makes a folder of plain static files (`dist/`). Any HTTPS web server can serve it, and stations just open the address in Chrome or Edge. Nothing runs on the server, and no student data is sent to it. (The 💡 Idea box needs the local request inbox, so it's only for home setups.)

### Web demo and teacher demo

`npm run build:web` makes `dist-web/`, a copy of Koog for showing it off. Any static HTTPS host (GitHub Pages, for example) can serve it, at any path.

- It opens on a landing page with two choices: play Koog, or the teacher demo. There's no sign-in; the Fly.io setup rate-limits each visitor so the free demo can't be spammed.
- It supports only the computer keyboard. For USB keyboards, pedals and controllers, run Koog on your own computer.
- It's live at https://koog-demo.fly.dev. To deploy your own copy to Fly.io: `npm run deploy:fly` (config in `deploy/`; only the built files are uploaded, served by nginx).
- The teacher demo lives at `/teacher/` and also works locally at http://localhost:5173/teacher/. It's made for a projector: a drawing of a student at a keyboard plugged into a laptop, turned so the class sees the screen. The screen is Koog running live, and numbered labels explain each step (key press, MIDI message, what Koog hears) and what the student is learning.

![Teacher demo: a drawn student plays a small red keyboard plugged into a laptop. The laptop screen shows Koog live, and numbered labels explain the key press, the MIDI message on the cable, what Koog hears (C major chord) and what the student is learning (C, E and G make C major).](docs/images/08-teacher-demo.jpg)


## Practical details

- **Setup:** a computer with Chrome or Edge, and optionally any class-compliant USB-MIDI keyboard. No keyboard? The on-screen keys and the computer keyboard (`Z S X D C…`) work too.
- **Links to anything:** every screen, song, game, challenge, key and helper has its own link (for example `#/songs/ode/learn?rung=2` or `#/play?key=a-minor&modes=mentor,vibes`). The address bar follows along as you play, and the link button in the top bar copies it. The format is in [docs/api.md](docs/api.md).
- **Foot pedal (optional):** any single USB foot switch that types a key (most USB "HID" pedals sold for transcription or push-to-talk). Open the devices menu, tap *Set up a USB foot pedal* and press the pedal once. It can then hold notes like a piano's sustain pedal, run the loop station (tap to record, play or overdub, hold to clear), or start and stop the beat. If pressing the pedal clicks the mouse instead, use the pedal's own setup app to make it send a key.
- **Students:** each student picks a short code word, so siblings or classmates sharing a computer keep separate progress. These are not secure logins (see below).
- **Hearing and eyesight safety:** volume is capped with a limiter, a panic button stops all sound, visual effects stay at 3 flashes per second or fewer, and Koog respects the computer's "reduce motion" setting.
- **Copyright-safe music:** every song is public domain in the US (published by 1930, or traditional) or written for Koog. Later musical styles are imitated in general terms only.
- **Limitations:** Koog was built for one family's living room and hasn't been tested in a classroom. It needs Chrome or Edge (for Web MIDI). Some songs were transcribed by ear and are still being checked. It's a practice companion, not a replacement for a teacher.

---

## Full feature list

<details>
<summary>Every mode and tool, for the curious</summary>

Koog is laid out like one instrument: a big **display**, a rail of lit **mode buttons**, and a glowing **keybed** that mirrors your keyboard, between walnut end cheeks.

| Mode | |
|---|---|
| **PLAY** | The visualizer fills the display: fireworks, ripples, rising bars, 🔥 fire, 👻 ghosts, 💌 mail (each note's letter pops out of an envelope), 🎉 confetti or 🧟 zombies. New scenes plug in through a small interface in `src/features/visualizer/scenes.ts`. In-key notes burst gold and out-of-key notes go "spicy". Smart readouts show the detected key, chord, in-key % and streak. |
| **🎛️ Patch** (inside PLAY) | A classic analog-style patch on the display: VCO → VCF → VCA, with ENV and a cable-patching game. The patch drives the visuals: the waveform sets particle shape, filter cutoff sets brightness, resonance adds halos, and release sets the trails. You can also play your keyboard through the synth. |
| **🤖 Smart Band** (inside PLAY) | Turn it on and play a melody. It guesses the chord your notes fit, follows your tempo, and plays pad, bass and light drums along with you. It uses a small readable rule set in `src/features/smartband/harmonizer.ts`, not a black box. |
| **🧩 Patch Quests** (in the Patch drawer) | Guided synth-patching lessons, such as "make it dark", "make it scream" and "slide like a ghost". Each one tells you what to watch in the visuals as the sound changes. |
| **🎓 The judge** (everywhere) | Every note is graded for KEY, BEAT and STYLE, and the judge spots *tension → release*, *motifs*, *cadences* and forearm *tone clusters*. Visuals react: good playing launches big, steady fireworks, and slams fizzle… unless you've charged **⚡ BOOM** by playing in key. Then the same slam is a giant finale. The rules are in `src/music/judge.ts`, and the design is in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md). |
| **🎮 GAMES** | **Jiu-Jitsu Flow:** echo your training partner's phrases on the beat to move up the positions (real competition points, belts from white to black, and the tap-out lesson). **Runway Remix:** style a model through six eras of music (chords pick the colour palette on the circle of fifths), then play the era's piece to strut the runway. **Zombie Lanes:** zombies walk down lanes lined up with your keys; play the note on the sign to blast them. **BachDoom:** a retro first-person rail shooter where the piece *is* the ammo. Final boss: Bach's Prelude in C (WTC I). A fan-made parody, not affiliated with id Software. |
| **SONGS** | 🎻 Classical (Bach, Beethoven, Grieg, Satie, Dvořák, Vivaldi, Strauss and more), 🎧 Koog Originals (original pop songs written for this project), 🔥 public-domain Bangers and warm-ups. *Wait* mode pauses for you; *Flow* mode keeps time with a backing beat. Includes a My Songs recorder. |
| **CHALLENGE** | 15 games, including intervals, echo, black keys only, mirror mode, major or minor, a boss level and a daily challenge. Earns badges, personal bests and confetti. |
| **BEATS** | 8 original grooves synthesized in the browser, plus a jam score. |
| **SYNTH** | Two views. **🎹 Instruments** is a rack of Koog's ten playable instruments, each with its type and a **▶ Play** button: Koog Air (hands-in-the-air pitch), Koog Ribbon (ring-and-ribbon glide), Koog Wheelhouse (drawbar organ), Koog Tape Choir (tape-style keyboard, synthesized; no recordings), Koog Ladder (analog mono synth), Koog Patchbay (semi-modular), Koog Squelch (step-sequenced bass), Koog Five (programmable polysynth), Koog Shimmer (chorus polysynth) and Koog Bell FM (digital FM). **🕰 Timeline** is a year-by-year story of how electronic music began, from 1920 to the small-format modular revival, with a quiz; it names no companies, products or people, only years and what changed, and each card links to a Koog instrument from that family. Deep links: `#/synth` and `#/synth/timeline`. Each instrument links a classical piece to learn. They are Koog's original designs, not copies of any maker's instrument. |
| **LOG** | A live "behind the scenes" build log in middle-school language. Kids send feature requests with 💡 Idea and get replies as pop-ups. |
| **🔊 SYNTHESIZER ON/OFF, volume, mute** (top strip) | The volume and mute apply to every sound in the app. SYNTHESIZER ON also plays your MIDI keyboard through the computer, using the Koog synth or whichever emulator is open. |
| **⌨️ Musical typing** | No MIDI keyboard? Use the computer keys in the standard two-row layout: `Z S X D C…` for the lower octave and `Q 2 W 3 E…` for the upper octave. ← → shift octaves. "Show computer keys" labels the on-screen keys. |
| **🎼 Sheet music** (top strip) | A play-along grand staff along the bottom of the display. It follows whatever piece the songs, games or emulators are playing: hits turn green, misses turn red. In free play it writes down what you play. |
| **🎧 DUO (DJ + piano)** | Plug in a DJ controller (made for the Numark Mixtrack Go) and a piano at the same time. 🎛️ Devices gives each one a role. The DJ's decks set the key and the beat for the piano player, and good piano playing fires DJ effects back. 🎹 Sound swaps the piano's instrument (organ, analog-style, FM electric piano, tape strings and more). |
| **🎛️ Controller Mode** | Switch the DJ controller to 🎛️ Synth and it becomes the control surface for the piano. The crossfader controls the filter cutoff, and the knobs, faders, jogs and pads drive the Koog synth or the open emulator's own parameters. It has soft takeover, MIDI learn, and on-screen labels for every control. |
| **🎼 Sheet levels** | Single notes, Easy chords (chord symbols and left-hand roots) or Full (an arranged left-hand part). SONGS grades the left hand too. |
| **🔁 Loop station** (✨ Modes → 🔁 Looper, or Boss mode `#/boss/loops`) | One big button, like a classic looper pedal: tap to record, tap to loop, tap to overdub, double-tap to stop, hold 2 seconds to undo or redo. A metronome and count-in keep time, loops snap to whole bars (or set the tempo from the first loop), each layer has its own sound, and any layer can be muted or removed. A foot pedal can run it too. |
| **🦶 Pedal looper, 🔔 M metronome, 🔊 Boost** | A foot pedal runs the looper in Simple style: one tap records, one tap loops it, tap again to layer, two quick taps stop everything, hold 2 seconds to clear (with a 5 second Undo). Classic (hold = undo) is a setting in the pedal setup. Press **M** anywhere for a metronome click on the master clock (**Shift+M** while *Keys play notes* is on; M is the note B then). **Boost** next to the volume slider adds +6 dB for quiet laptop speakers (after a warning; it never persists and turns off after an hour). The looper hands notes to the synth ahead of time on the audio clock (sample-accurate), and its timers run in a Web Worker, so timing holds when the tab is busy or hidden. Timing science: the first loop's closing press is given back the ~40 ms a foot presses early (a NUDGE slider in Boss mode fine-tunes it), a press just after a bar line is forgiven by time not beats, held notes are never cut by their own next-cycle hit, and tap tempo ignores a stray or missed tap. |
| **🦶 Pedalboard** (Devices menu > Open the Pedalboard, or ✨ Modes > Pedalboard) | Eleven stompbox pedals on the instrument sound: Fuzz, Echo (can sync to the beat), Chorus, Jet (flanger), Swirl (phaser), Wobble (tremolo), Quack (auto-wah), Octave (adds the note an octave down/up), Squeeze (compressor), Reverb and a Looper footswitch. Each has a plain one-line blurb, 1-3 knobs and a big footswitch (20 ms crossfade, no clicks). Drag or use the arrows to re-order; presets Clean, Rock, Space, Underwater; saved per player. Safe by design: the board sits before the channel cap and the limiter, feedback is capped below runaway, fuzz is level-compensated and a soft ceiling keeps the chain under full scale. Piano pedals: a keyboard or foot pedal can send soft (CC 67, quieter and mellower), sostenuto (CC 66), expression (CC 11) and volume (CC 7); a sustain pedal pressed halfway (CC 64 below 64) gives a half pedal. The USB foot pedal action 'Foot pedal stomps: <pedal>' toggles the selected effect. The Devices menu also has a Timing meter: sound-out delay, input wobble, a Bluetooth-sound warning, a tap test and a per-device timing offset (scoring and recording only). |
| **🥁 Drum pads** (✨ Modes → 🥁 Drum pads, or Boss mode `#/boss/drums`) | Eight drum pads (kick, snare, two hi-hats, clap, two toms, rim) in three kits, and a 16-step beat that loops. Tap a pad to hear it, press REC and your hits snap onto the grid, or click steps to draw a beat. Tap tempo, swing, roll and four starter beats. A DJ controller becomes a pad drum machine: set its role to 🥁 Drums in the devices menu (PLAY starts, CUE records, SYNC taps the tempo). Four patterns A-D (switch at the bar line, or chain), per-drum mute and solo, accent steps, copy bar 1 to 2, a hold-to-roll FILL, and a hardware step editor (PAD MODE turns the pads into steps). The on-screen pads mirror the controller: deck A left, deck B right, brighter when hit harder. The foot pedal plays the KICK while the drum pads are open. The panel has a "How to drum on the controller" help card. |
| **🧑‍💻 Koog Kode** (✨ Modes → 🧑‍💻 Koog Kode, or `#/kode`) | A tiny, safe pattern language that makes music. Type `notes "c e g e"`, `drums "kick ~ snare ~"`, `tempo 100`, `sound "ladder"`, `loud 0.8`; `~` rests, `[c e]` squeezes, `[c,e,g]` chords, `<c d>` alternates each bar, `c*2` repeats, `#` comments. Every line is a loop layer (up to 8) on the shared beat; Ctrl/Cmd+Enter or ▶ makes edits land at the next bar line with no click, ■ stops, the playing step glows in the code, and mistakes get a friendly message pointing at the exact character. **📼 Write it for me** listens to the next phrase on any instrument (keys, drum pads, DJ controller, foot pedal) and writes the line, quantised to the tempo grid; **🔁 Use my loop** turns Looper layers and the drum pattern into code; 8 starter examples. No eval and no general code runs: just a tokenizer, a parser and a player with length and depth limits (`npm run check:kode`). |
| **</> Code export** (the `</> Code` button in the Looper and Drum pads) | Turns your loop or beat into text for two free live-coding tools from the education world: **Copy for Sonic Pi** (a `live_loop` per layer with `play`, `amp:`, `release:` and a padded `sleep` so the loop closes exactly; a beat becomes `ring` + `tick`) and **Open in Strudel** (mini-notation like `note("c4@8 e4@8")` and `s("bd ~ sd ~")`, opened from a `strudel.cc/#...` link). Pure exporters live in `src/kode/export`; Koog never sends code anywhere, the kid pastes or opens it. Test: `npm run check:export`. |
| **🖼 Gallery** (top bar) | The Gallery button opens a self-playing guided tour of every feature (about 18 minutes, `#/gallery`) or Art Gallery mode, a calm full-screen loop for a TV (`#/gallery/art`). Art Gallery has Skip (→), a piece picker and Space to pause, keeps running while you play (your notes move the art and its music ducks), and Esc leaves. Thanksgiving and Christmas versions (`#/gallery/art/thanksgiving`, `#/gallery/art/christmas`) add falling leaves or snow, string lights and holiday songs. |
| **🕺 Dancer** (a PLAY visual) | A little dancer who moves to the mood of your music and travels across the stage as your pitch rises and falls. Tap *Name him* to give him a name; the captions use it. |
| **🥚 Dancer easter eggs** (PLAY visual: Dancer, then the *Eggs* button) | 26 secret tunes make the Dancer do surprises: Shave and a Haircut gives a foam beard, Happy Birthday a cake, a full scale turns him into a fish, and there are costumes for Ode to Joy, Twinkle, a tower clock tune and more, plus holiday ones (Jingle Bells makes him Santa, Silent Night brings snow). Tunes are matched by their intervals, so any key works. The Eggs gallery shows what you have found (saved per player) with a *Play it* button; unfound eggs show a hint. |
| **🏢 Boss mode** (Dad mode) | A lean studio for grown-ups, with the visualizer and the kid features off. The rail is STUDIO (master clock, mixer, sound rack, routing; the MIDI monitor is under diag), DJ, LOOPS, DRUMS, SYNTHS and SCENES (8 scenes), plus a Stage performance view. Includes the keyboard split and layers and the 🔁 loop station (see above): up to 8 layers of recorded notes and knob moves, controllable from the DJ controller, exportable as MIDI. |
| **🃏 Phrase Match** | A memory card game in GAMES. Flip cards to hear short tunes cut from Koog's public-domain songs, find the twin, then play the tune back on the keys to win the pair (hint keys light on Easy). Easy 2x3, Medium 3x4, Hard 4x4 with look-alike decoy tunes, plus an Ear-only mode with no pictures. Scored by flips and time, with stars and a best per level saved per kid. |
| **🦃 Harvest Feast / 🎄 Light the Tree** | Memorize a Thanksgiving or Christmas song in GAMES (`#/games/feast`, `#/games/tree`). Six rungs per song: Hunt & Peck (next key glows, sheet music shown, no timer), Follow (glow fades), Echo (hear it, play it back, replay free), Memory (phrase by phrase, no hints, a peek costs a star), Play full (the whole song from memory at your own pace; a slip just waits) and Master (the whole song in time with a gentle backing). Every level opens with a goal and a Start button with a 3-2-1; the keybed lights the next key (upcoming keys dimmer, green for right, red for a slip) and the shared sheet music follows along. Each rung unlocks the next, progress and stars are saved per player per song, every phrase you nail flies an ornament onto the tree or lands a dish on the table, and Play full puts the star on the tree or serves the turkey. The songs live in the **🎄 Holiday** tab of SONGS. |
| **🏪 Koog Store** (🏪 in the top bar, ✨ Modes, the Gallery menu, Boss mode's corner button, or `#/apps`) | An in-app shelf of Koog Kode apps for kids: a rotating Featured banner, shelves (Kode apps, Learn a song, Games, Coming soon), cards with the coding ideas each app teaches (🔁 Loops, 🧩 Functions, 🔀 If/else...), which inputs work (🎹 🥁 🎧 🦶 👆), ages and minutes, and Open. Each app has a page with pictures, What you'll learn, Works with and your progress. **My apps** shows what you opened last with Continue; **🏅 My coding powers** is a wall of the 11 coding ideas, locked until you use them in an app (it says which app teaches each one). Free and built in: no downloads, no payments, no accounts, no network. The visible name is one constant (`STORE_NAME` in `src/kode/kore/brand.ts`). Links: `#/apps`, `#/apps/<appId>`, `#/apps/mine`, `#/apps/badges`. Code: `src/features/appstore`. |
| **🏁 Koogalien Racer** | The first Koog Kode game, in GAMES (`#/games/racer`). The track is a timeline: hear a phrase from one of Koog's public-domain songs, play it back on the beat, and a car drives what you played (higher bends the road right, lower bends it left, a wrong note goes off the road into a pond, hay bales, chickens or a spin-out, with a note saying which note it was). Four worlds (meadow, desert canyon, snowy mountain, space highway) of three tracks; hints fade as you climb; "Hear it again" is free on early tracks. Pick a vehicle by playing its note four times (C bee, D family car, E monster truck, F rocket, G snail, A go-kart, B ice-cream truck) or tapping its pad four times. Works with piano, drum pads, a DJ controller and a foot pedal (starts the race). See `docs/KOOG_KODE.md`. |
| **🧠 Phrase memory** | In SONGS, *Learn it* teaches a song in 2–3-note phrases up a ladder (listen → follow → echo → memory → timed → blind → hands), then chains phrases into lines and the whole song. Mastery is saved per kid and shared with the games: BachDoom phrase waves (Galaga-style dives on the phrase rhythm; Episode 0: Boot Camp), Zombie Lanes conga lines, Jiu-Jitsu calls and Runway phrase walks. Sheet music shows phrase brackets and fades notes in memory mode. |
| **🎓 Mentor** | An optional front-row synth robot (chrome dome, LED eyes, a sine-wave mouth) that names what you play (motif, sequence, inversion, cadence, I–V–vi–IV, modulation…), spots quotes of public-domain tunes (and names the composer) and of your learned phrases, gives honest critiques that name the problem and the fix, and shows a highlights reel. |
| **😀 Vibes** | The mood of the music as a face: chords, progressions, contour, register, tempo and dynamics drive valence and arousal, plus a "Make it spooky" challenge. |
| **🎭 Mimic** | Koog answers your phrase in a style (Baroque, Classical, Romantic, Impressionist, ragtime, blues, boogie, cool jazz, bebop, funk, minimalism, synth-pop, gospel, bossa nova) or in the style of jazz and modern players (Miles Davis, John Coltrane, Thelonious Monk, Duke Ellington, Louis Armstrong, Ella Fitzgerald, Count Basie, Dave Brubeck in 5/4, Herbie Hancock, Stevie Wonder), grouped Classical / Jazz / Pop & more or restyles your playing. Public-domain composers can be quoted. Later idioms are style emulation only, with original phrases, and are not affiliated with any artist. |
| **⏱ Perf monitor** | Grown-ups only: in Boss mode (and in dev) a small ⏱ Perf button shows frame time, key-to-sound latency, event-loop lag, long tasks, audio glitches and JS heap for the screen, scene, docks and helpers you are in now, colored against budgets, with a table of every state visited and a Copy report (JSON) button. Samples only; nothing leaves the device. `npm run check:perf` sweeps the main states headless and fails if one is far over budget (table in `scripts/shots/perf/SWEEP.md`). |
| **Kid / Dad mode** | Each kid signs in with a short code word. Dad mode (press and hold) adds a DEV screen with MIDI, pre-flight and test tools. |

</details>

**The logo** is an original design: sunset-chrome letters with both O's drawn as synth knobs.

**Why "Koog"?** Moog → Loog moves one letter back in the alphabet (M → L). Loog → Koog moves one more (L → K). It also sounds a bit like "code".

> Made by a developer who plays on a Loog Piano. Koog has **no affiliation** with Loog Guitars or Moog Music and isn't endorsed by either. Their names and trademarks belong to their owners. Koog works with any class-compliant USB-MIDI keyboard, and with the computer keyboard if you have no MIDI keyboard.

## Quick start

Needs Node 20+ and Chrome or Edge (Web MIDI).

```sh
npm install
npm start      # dev server on :5173 + request inbox on :5174, runs pre-flight, opens Chrome (macOS)
npm stop       # stops both
```

Or run only the app with `npm run dev` and open http://localhost:5173. See [docs/keyboard](docs/keyboard/README.md) to connect a keyboard.

## Kids' profiles are not security

Koog runs entirely on your computer. It has no accounts, no server-side data, no analytics and no ads. Each kid picks a short code word (like `tiger` or `m`) so siblings don't overwrite each other's badges. Progress is stored in the browser's localStorage under that word. Anyone at the keyboard can switch profiles. That's deliberate: the profiles keep siblings separate on one computer and don't protect anything from the internet.

## Safety

- The browser synth defaults to low volume, with a hard cap and a limiter. A panic button sends All Notes Off.
- Visual effects stay at 3 or fewer flashes per second and respect `prefers-reduced-motion`.
- Pre-flight warns if the Mac's output volume is above 70%.

## Testing

Every screen has been played end to end by test scripts in a muted headless browser (`scripts/screenshot.mjs`), and the logic checks run with `npm run check:catalog`, `check:listen`, `check:mentor`, `check:loops` and `check:drums`. Run `npm run typecheck` and `npm run build:web` before a deploy.

## Songs and copyright

Koog only ships music that is public domain in the US: published in 1930 or earlier, or traditional. Kids will ask for current pop songs. Those are copyrighted, so the Beat Machine and My Songs recorder let them make their own instead. Sources and reasoning are in [docs/learning](docs/learning/).

## Roadmap

- Try the drum pads, looper and foot pedal on real hardware (so far they are tested with simulated MIDI and a muted browser).
- **Eventually: teach modular synthesizer patches too.** Oscillators, filters, envelopes and patch cables. Patch Quests and LFO patching (vibrato, wah and tremolo, routed with a cable) are the first steps. Next up: more modules and free-form cable routing.
- Measure real keyboards (range, velocity curve, latency) and adapt songs to fit.
- Check every song by ear. Some were transcribed from memory.

## How it was built

Koog was built live with [Claude Code](https://claude.com/claude-code) and a swarm of sub-agents while a kid played it. Every change hot-swapped with no page reload. Their feature requests came in through the request bar, and the build log narrated each one. [docs/DEVELOPING.md](docs/DEVELOPING.md) has the rules that keep edits from resetting the page.

## License

[MIT](LICENSE)
