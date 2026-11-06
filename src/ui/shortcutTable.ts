// The DECLARED global keyboard shortcuts (pure data, no DOM): the source for docs/SHORTCUTS.md and the collision check
// in scripts/shortcut-fixtures.ts. Two entries with the same combo AND the same context are a bug: one key press would
// do two jobs. A different context means "never active at the same time" (e.g. the looper panel vs a game).
// When you add a global key handler, add a row here (and register it with registerShortcut in src/ui/shortcuts.ts if you can).
export interface ShortcutRow {
  /** human combo, e.g. "Shift+M", "Space", "Ctrl/Cmd+Enter" */
  combo: string
  /** where it is active; same combo + same context = collision */
  context: string
  action: string
  /** the file that owns the handler */
  owner: string
}

export const SHORTCUTS: ShortcutRow[] = [
  { combo: 'M', context: 'keys-play-notes', action: 'Piano note B (lower row)', owner: 'src/music/typing.ts' },
  { combo: 'Shift+M', context: 'everywhere', action: 'Metronome on / off (never plays a note)', owner: 'src/features/loopstation/metroKey.ts' },
  { combo: 'Shift+EASTER', context: 'everywhere', action: 'Open the easter-egg cheat sheet (five at a time)', owner: 'src/features/vibes/eggCheat.ts' },
  { combo: 'Z S X D C V G B H N J , L . ; /', context: 'keys-play-notes', action: 'Piano notes, lower row from C3', owner: 'src/music/typing.ts' },
  { combo: 'Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P [ = ]', context: 'keys-play-notes', action: 'Piano notes, upper row from C4', owner: 'src/music/typing.ts' },
  { combo: 'ArrowLeft / ArrowRight', context: 'keys-play-notes', action: 'Octave down / up for the typing piano', owner: 'src/music/typing.ts' },
  { combo: 'Space', context: 'looper-visible', action: 'The looper big button (classic gestures)', owner: 'src/features/loopstation/SimpleLooper.tsx' },
  { combo: 'Pedal key (learned) / MIDI CC64', context: 'pedal', action: 'The foot pedal; the job comes from pedalJob() in src/features/pedal/pedal.ts', owner: 'src/features/pedal/pedal.ts' },
  { combo: 'ArrowLeft / ArrowRight / Space / Esc', context: 'gallery-tour', action: 'Tour: previous / next, pause, close', owner: 'src/features/tour/Tour.tsx' },
  { combo: 'ArrowLeft / ArrowRight / Space / Esc', context: 'gallery-runner', action: 'Gallery runner: back / forward / pause / leave', owner: 'src/features/gallery/runner.ts' },
  { combo: 'Ctrl/Cmd+Enter', context: 'koog-kode', action: 'Run the Koog Kode program', owner: 'src/features/kode' },
  { combo: 'Esc', context: 'panels', action: 'Close the open popover / panel', owner: 'various panels' },
]
