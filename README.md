# Koog

> **Inspired by Moog, coded with Loog, it's... Koog!**

Koog is a smart synthesizer and piano playground for kids that runs in the browser. Plug in any USB-MIDI keyboard and every note sets off fireworks. You also get challenges, songs to learn, a drum machine and a recorder. A live "behind the scenes" log explains how the app itself gets built.

**Why "Koog"?** Moog → Loog moves one letter back in the alphabet (M → L). Loog → Koog moves one more (L → K). It also sounds a bit like "code".

> Made by a developer who plays on a Loog Piano. Koog has **no affiliation** with Loog Guitars or Moog Music and isn't endorsed by either. Their names and trademarks belong to their owners. Koog works with any class-compliant USB-MIDI keyboard, and with the computer keyboard if you have no MIDI keyboard.

## What's in it

Koog is laid out like one instrument: a big **display**, a rail of lit **mode buttons**, and a glowing **keybed** that mirrors your keyboard, between walnut end cheeks.

| Mode | |
|---|---|
| **PLAY** | The visualizer fills the display: fireworks, ripples, rising bars or 🔥 fire. In-key notes burst gold and out-of-key notes go "spicy". Smart readouts show the detected key, chord, in-key % and streak. |
| **🎛️ Patch** (inside PLAY) | A Moog-style patch on the display: VCO → VCF → VCA, with ENV and a cable-patching game. The patch drives the visuals: the waveform sets particle shape, filter cutoff sets brightness, resonance adds halos, and release sets the trails. You can also play your keyboard through the synth. |
| **🤖 Smart Band** (inside PLAY) | Turn it on and play a melody. It guesses the chord your notes fit, follows your tempo, and plays pad, bass and light drums along with you. It uses a small readable rule set in `src/features/smartband/harmonizer.ts`, not a black box. |
| **🧩 Patch Quests** (in the Patch drawer) | Guided synth-patching lessons, such as "make it dark", "make it scream" and "slide like a theremin". Each one tells you what to watch in the visuals as the sound changes. |
| **SONGS** | 🎧 Koog Originals (original pop songs written for this project), 🔥 public-domain Bangers and warm-ups. *Wait* mode pauses for you; *Flow* mode keeps time with a backing beat. Includes a My Songs recorder. |
| **CHALLENGE** | 15 games, including intervals, echo, black keys only, mirror mode, major or minor, a boss level and a daily challenge. Earns badges, personal bests and confetti. |
| **BEATS** | 8 original grooves synthesized in the browser, plus a jam score. |
| **SYNTH** | How Moog and the analog synthesizer changed music: a timeline from the 1920 theremin to Eurorack, a quiz, and a playable synth front panel. |
| **LOG** | A live "behind the scenes" build log in middle-school language. Kids send feature requests with 💡 Idea and get replies as pop-ups. |
| **Kid / Dad mode** | Each kid signs in with a short code word. Dad mode (press and hold) adds a DEV screen with MIDI, pre-flight and test tools. |

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

## Songs and copyright

Koog only ships music that is public domain in the US: published in 1930 or earlier, or traditional. Kids will ask for current pop songs. Those are copyrighted, so the Beat Machine and My Songs recorder let them make their own instead. Sources and reasoning are in [docs/learning](docs/learning/).

## Roadmap

- **Eventually: teach modular synthesizer patches too.** Oscillators, filters, envelopes and patch cables. Patch Quests and LFO patching (vibrato, wah and tremolo, routed with a cable) are the first steps. Next up: more modules and free-form cable routing.
- Measure real keyboards (range, velocity curve, latency) and adapt songs to fit.
- Check every song by ear. Some were transcribed from memory.

## How it was built

Koog was built live with [Claude Code](https://claude.com/claude-code) and a swarm of sub-agents while a kid played it. Every change hot-swapped with no page reload. Their feature requests came in through the request bar, and the build log narrated each one. [docs/DEVELOPING.md](docs/DEVELOPING.md) has the rules that keep edits from resetting the page.

## License

[MIT](LICENSE)
