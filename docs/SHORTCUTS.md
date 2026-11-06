# Koog keyboard and pedal map

One place that says which key does what, where it is active, and which file owns it. Keep it true: when you add a global key
handler, add a row to `src/ui/shortcutTable.ts` (a fixture, `npm run check:shortcuts`, fails on two rows with the same combo in the same
context), register it with `registerShortcut()` from `src/ui/shortcuts.ts` when you can, and add a row here.

## The rule
- **Plain M is the piano note B. It never touches the metronome.**
- **Shift+M is the metronome, on every screen, always.** The typing piano ignores Shift+M, so it never plays a note.
- Ctrl/Cmd/Alt never trigger a shortcut that did not ask for them.
- The looper (Space, the pedal, a controller left on the Loop page) acts **only while the looper is on screen** (the Looper dock or the Boss LOOPS screen).
  The one exception is the opt-in setting "Pedal always runs the looper" in the pedal setup (off by default).

## Keys
| Key | Action | Active when | Owner |
|---|---|---|---|
| Z S X D C V G B H N J **M** , L . ; / | Piano notes, lower row from C3 (M = B) | "Keys play notes" is on; not in a text box | `src/music/typing.ts` |
| Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P [ = ] | Piano notes, upper row from C4 | same | `src/music/typing.ts` |
| Left / Right arrow | Typing-piano octave down / up | Keys play notes on, tour closed | `src/music/typing.ts` |
| **Shift+M** | Metronome on / off (toast) | everywhere except text boxes | `src/features/loopstation/metroKey.ts` via `src/ui/shortcuts.ts` |
| **Shift+EASTER** | Easter-egg cheat sheet (hold Shift and type the word; five eggs a page) | everywhere except text boxes | `src/features/vibes/eggCheat.ts` |
| Space | The looper big button (tap / hold gestures of the classic style) | only while a looper panel is visible; not in text boxes or on a foreign button | `src/features/loopstation/SimpleLooper.tsx` via `src/ui/shortcuts.ts` |
| Enter on the focused big button | Same big button | the button has focus | `src/features/loopstation/SimpleLooper.tsx` |
| Learned pedal key / MIDI CC 64 | The foot pedal (see below) | always listening; the job depends on context | `src/features/pedal/pedal.ts` |
| Left / Right arrow, Esc | Tour: back / next / close | tour card open (captures the keys first) | `src/features/tour/Tour.tsx` |
| Space, Left / Right arrow, Esc | Gallery mode: pause, skip, leave (every other key plays) | gallery mode running | `src/features/gallery/runner.ts` |
| Ctrl/Cmd+Enter | Run the Koog Kode program | focus in the Kode editor | `src/features/kode/KodeEditor.tsx` |
| Enter | "Next" in the Koogalien games (also the pedal) | a Koogalien game is open | `src/features/koogalien/games/hooks.ts` |
| Esc | Close the open panel (Modes, Pro, Pedalboard, Audio, Visualizer, Key popover, App Store, Egg gallery, Devices, Mimic, Gallery button); from a mode other than PLAY go home | that panel is open | each panel; `src/layout/Instrument.tsx` |
| Enter / Space on a focused pad or button | Presses it (drum pads, Pedalboard stomp) | the control has focus | `src/features/drumpads/DrumPads.tsx`, `src/features/pedalboard/Pedalboard.tsx` |
| Any key | Wakes the audio context (no action of its own) | always | `src/music/localNotes.ts`, `src/features/dj/engine.ts`, `src/links/sync.ts` |

## The foot pedal: what "Automatic" does
`pedalJob()` in `src/features/pedal/pedal.ts` is the only place that decides. With the action on **Automatic** it resolves, in order:
1. the Drums page is open -> **kick** drum
2. a looper panel is visible (Looper dock or Boss LOOPS) -> **loop** (the big button, Simple or Classic style)
3. otherwise -> **sustain** (hold the notes)

Then, in addition, any press raises `usePedal.down`; that is the **game start / next** signal and is read through the Kode token layer
(`src/kode/tokens.ts`, source `pedal`) by Phrase Racer (GO), Koreographer, the Koogalien games (Next), My Motifs, and directly by the holiday games
(Light the Tree / Harvest Feast: begin / next level). So in a game the pedal sustains your notes AND starts or advances the game; it never touches the looper
because the looper is not on screen there.

Fixed actions (Pedal setup): Sustain, Loop station, Beat (start/stop the master clock), Kick, Soft, Sostenuto, Pedalboard stomp, Off.
**Loop station** now also needs the looper on screen (it falls back to sustain otherwise) unless "Pedal always runs the looper" is ticked.
A MIDI sustain pedal (CC 64) takes the same path as the learned key.

## Game pads PLAY (and other controller buttons)
PLAY on the Game pads page calls `pressStart()` in `src/features/padplay/padplay.ts`. That emits **its own start signal**
(`src/features/pedal/startSignal.ts`), which the token layer and the holiday games listen to. It no longer flips `usePedal.down`, so it can never look like a pedal tap.
It also clicks the Songs Play button and the big Start/GO buttons of the other games.

## A controller on the Loop page
Hardware with the device role `loop` is routed to `src/features/loopstation/loopSurface.ts`. Its messages are ignored unless a looper is on screen
(or "Pedal always runs the looper" is on). The drawn on-screen controller is itself part of the visible looper, so it always works.

## Adding a shortcut
```ts
import { registerShortcut } from '../../ui/shortcuts'
const off = registerShortcut({ id: 'my-thing', key: 'KeyK', shift: true, when: () => panelOpen(), run: () => doIt(), owner: 'MyPanel (Shift+K)' })
// call off() on unmount / import.meta.hot.dispose
```
`registerShortcut` ignores text boxes and key repeat, requires Shift/Ctrl/Alt to match exactly, and (in dev) logs a console warning if two
shortcuts on the same combo are ever active at once.
