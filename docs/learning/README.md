# Koog learning research (2026-10-27)

Not legal advice. Each file marks what was verified (fetched) vs from memory.

## Index
- [pedagogy.md](pedagogy.md): teaching a 4-10 year old over MIDI, what apps do, fitting 37 keys, 27 design rules.
- [songs-and-sources.md](songs-and-sources.md): legal sheet music, MIDI and audio sources, pop-song copyright reality, ~25 public-domain starter songs.
- [visualizers.md](visualizers.md): rendering engines, fun visual ideas, performance, photosensitivity safety, stack recommendation.
- [midi/](midi/): 4 Mutopia public-domain MIDI files; see [midi/LICENSES.md](midi/LICENSES.md).

## Top 10 actionable recommendations
1. **Strict on which note, lenient on when.** Wait-for-correct-note mode never times out. Timed modes use wide windows for under-7s (about +/-250 ms) and never show a "miss".
2. **Short, varied activities.** 1-3 minutes each. Cap sessions at about 10-15 minutes (ages 4-5) up to 20-30 (ages 8-10), wind down gently and end on a mastered song.
3. **Reward collecting, not avoiding loss.** Use "days this week" instead of breakable streaks, and praise effort. When a child fails repeatedly, slow down, shorten the phrase or demo it.
4. **Fixed pitch colours plus fading finger numbers.** With no key lights, draw an on-screen keyboard that shows the target key.
5. **Detect the keyboard range at runtime and transpose songs to fit.** Keyboard ranges vary (25, 37, 49, 61 keys). Prefer songs spanning an octave or less in C, G or F major.
6. **Build songs from public-domain melodies you author or sequence yourself.** Most nursery tunes have no clean MIDI online. The 4 bundled Mutopia files are a start.
7. **Avoid unlicensed pop MIDI and sheet music.** This includes BitMidi/FreeMidi-style sites, Lakh MIDI (CC BY 4.0 on the compilation only) and many MuseScore pop uploads. Legal pop routes: works published 1930 or earlier (PD in the US as of 2026), licensed services, or private by-ear arrangements that you never ship.
8. **Happy Birthday is safe to include in the US.** The 2016 settlement put it in the public domain.
9. **Visualizer: raw Canvas 2D behind a `Renderer` interface, with PixiJS 8 (MIT) as the upgrade path.** Draw outside React: MIDI event into a ring buffer, pooled particles, a DPR cap. Build order: velocity-scaled bursts, then rising bars and trails, then ripples and a creature.
10. **Photosensitivity safety by default.** Limit flashes to at most 3 per second (WCAG 2.3.1), avoid red flashes and large flashing areas, honour `prefers-reduced-motion`, offer a calm-mode toggle, and use a colour-blind-safe palette. Use `event.timeStamp` for latency-sensitive timing.

## Open questions to check on your keyboard
MIDI note range, velocity curve, and latency over USB vs Bluetooth.
