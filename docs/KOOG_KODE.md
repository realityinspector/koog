# Koog Kode

**Koding is coding-with-music.** Any musical device can be a way to Kode: a piano keyboard or its on-screen emulator, the drum pads, the DJ controller, a foot pedal, any USB musical gadget. Koog Kode turns all of them into one stream of small events ("Kode tokens") that Kode apps read, so an app never has to care which instrument the player picked.

The first Kode app is **🏁 Koogalien Racer** (`#/games/racer`): the track is a timeline built from a tune, and the player's phrase steers the car. (Koogalien is the musical language of the Koog Aliens; Koogalien Racer is a first taste of reading music as a road.)

## The token model

Code: `src/kode/kodeCore.ts` (pure rules, tested by `npm run check:racer`) and `src/kode/tokens.ts` (live wiring).

```ts
{ src: 'keys' | 'midi' | 'drums' | 'dj' | 'pedal' | 'screen',
  value: number,     // the steering value (see below)
  pitch?: number,    // MIDI note, pitched sources
  lane?: number,     // pad lane 0..7, pad sources
  vel: number,       // 0..1
  t: number }        // performance.now() ms when the player did it
```

| Source | Comes from | value |
| --- | --- | --- |
| `keys` | computer keys and the on-screen keyboard, via `onNote` in `src/music/notes.ts` (read-only) | MIDI note |
| `midi` | a real MIDI keyboard, same feed | MIDI note |
| `drums` | the drum pads (hardware pads and on-screen pads), via `onDrumHit` in `drumEngine.ts`; only live pad hits, never the playing pattern | lane 0..7 |
| `dj` | DJ controller pads and buttons, via `onDjMessage` in `src/music/devices.ts` | lane 0..7 |
| `pedal` | `usePedal` in `src/features/pedal/pedal.ts`, a press (the same pattern the holiday games use to start a level) | 0 |
| `screen` | any on-screen button, via `emitScreen()` | 0 |

**Steering for non-pitched instruments.** Pads are numbered left to right: pads A1-A4 are lanes 0-3 (the left side), pads B1-B4 are lanes 4-7 (the right side). `steerOf(token)` gives a pitch-like number: the MIDI note for piano, `lane x 1.75` semitones for pads, so a hop of one pad is about two semitones. Low or left steers left, high or right steers right, and the same maths drives a piano phrase or a pad phrase.

**Phrase-keys.** `repeatedKey(tokens)` answers "did the player just play the same key (any octave) or the same pad four times?" This is how the garage picks a vehicle: C four times is the Bee Buggy, D the Family Car, and so on; pad 1 four times is the Bee Buggy, pad 2 the Family Car.

## How a Kode app plugs in

```ts
import { startKode, onToken } from '../../kode/tokens'
const stop = startKode()          // listen to the devices (reference counted)
const off = onToken((t) => { /* t.src, t.value, t.pitch, t.lane, t.vel, t.t */ })
// when the app closes: off(); stop()
```

- Time things against the shared clock (`src/music/masterClock.ts`: `beatPos`, `timeOfBeat`) so a Kode app shares the beat with the looper and the drums. A token's `t` is in the same `performance.now()` time base as `timeOfBeat`.
- Use `token.src === 'pedal' | 'screen'` for "start" buttons; they carry no pitch.
- Ignore token kinds you do not want (`kindOf(t)` is `'pitch' | 'lane' | 'button'`).
- Sound goes through a capped channel (`createChannel`) registered with the panic registry, like every Koog sound.
- Save progress with `pload` / `psave`. Keep long-lived state on `import.meta.hot.data`.

## How Koogalien Racer reads the tokens

1. **The track is a timeline.** One beat of road is a fixed distance on the master clock. Each note's interval from the previous note bends the road after its gate: up turns right, down turns left, the same note is straight, a bigger interval is a sharper turn. Pad phrases use the lane instead of the pitch. (`src/features/games/racer/racerCore.ts`)
2. **Round:** LISTEN (the beat and the phrase, gates light up), YOUR TURN (GO button, foot pedal or a short timer starts a count-in, then you play the phrase), RACE (the car drives what you actually played), then stars.
3. **Mistakes steer.** A wrong pitch points the car off the road by the size of the error. Early or late kicks it sideways. Past the edge, a kid-safe mishap plays (pond, hay bales, chickens, spin-out with dizzy stars, a honking cow) and a note says what happened ("Note 3 was E, the road wanted G").
4. **Learning scaffolds.** Hints fade across the ladder (glowing keys and sheet with note names, then glow only while it is played to you, then sheet only, then nothing). Phrases come from Koog's public-domain songs and get longer and harder across four worlds. "Hear it again" is free on early tracks.

## Later: per-user model management (an idea, not built)

A future, **local-only, private-by-design** layer: a small on-device model of each player's phrases, used to apply next-token logic to the way the user jams with Koog. The model would learn which notes and rhythms this player tends to follow with what, so Koog could suggest the next phrase, make a track from the player's own habits, or answer a jam in the player's style. It would live in the browser next to the player's other saved data, never be uploaded, be viewable and deletable by the player, and work without a network. Nothing of this is built yet; the token stream above is the input it would learn from.
