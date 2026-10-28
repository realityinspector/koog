# Koog

> **Inspired by Moog, coded with Loog, it's... Koog!**

Koog is a piano playground for kids that runs in the browser. Plug in any USB-MIDI keyboard and every note sets off fireworks. You also get challenges, songs to learn, a drum machine and a recorder. A live "behind the scenes" log explains how the app itself gets built.

**Why "Koog"?** Moog → Loog moves one letter back in the alphabet (M → L). Loog → Koog moves one more (L → K). It also sounds a bit like "code".

> Made by a developer who plays on a Loog Piano. Koog has **no affiliation** with Loog Guitars or Moog Music and isn't endorsed by either. Their names and trademarks belong to their owners. Koog works with any class-compliant USB-MIDI keyboard, and with the computer keyboard if you have no MIDI keyboard.

## What's in it

| | |
|---|---|
| **Visualizer** | Fireworks, ripples or rising bars. In-key notes burst gold; "spicy" out-of-key notes go smoky. Chord mandalas, streak rockets, 5 background themes. |
| **Harmony HUD** | Pick a key or let Koog detect it. Shows an in-key meter, your streak and chord names. |
| **Challenges** | 15 games: intervals, echo, black keys only, mirror mode, loud & soft, major or minor, a boss level and a daily challenge. Earns badges and personal bests. |
| **Songs** | Public-domain pieces only, from Tetris (Korobeiniki) and The Entertainer to Für Elise. *Wait* mode pauses for you; *Flow* mode keeps the beat. |
| **My Songs** | Record yourself and play it back as a falling-notes song. |
| **Beat Machine** | 8 original grooves, all synthesized in the browser, plus a jam score. |
| **Synth history** | How Moog and the analog synthesizer changed music. *(in progress)* |
| **Build log + request bar** | Kids type feature requests. The build log explains each change in middle-school language: what a bug is, what shipping means, and so on. |
| **Kid mode / Dad mode** | Each kid signs in with their own short code word. Dad mode shows the dev tools. *(in progress)* |

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

- **Eventually: teach modular synthesizer patches too.** Oscillators, filters, envelopes and patch cables, starting from the synth-history module.
- Measure real keyboards (range, velocity curve, latency) and adapt songs to fit.
- Check every song by ear. Some were transcribed from memory.

## How it was built

Koog was built live with [Claude Code](https://claude.com/claude-code) and a swarm of sub-agents while a kid played it. Every change hot-swapped with no page reload. Their feature requests came in through the request bar, and the build log narrated each one. [docs/DEVELOPING.md](docs/DEVELOPING.md) has the rules that keep edits from resetting the page.

## License

[MIT](LICENSE)
