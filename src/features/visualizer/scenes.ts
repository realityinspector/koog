// Plug-in visual "scenes" (mail, confetti, zombies, ...). Each scene is a self-contained module
// that the engine hands notes to. Keeps engine.ts from growing a branch per mode.
// Data/type-only module: no HMR self-accept (importers re-run when it changes).

export type SceneKind = 'tonic' | 'in' | 'spicy'

export interface Scene {
  /** true if the scene paints its own background (then the theme gradient is skipped) */
  ownBackdrop: boolean
  resize(w: number, h: number): void
  /** x = the key's lane on screen, v = velocity 0..1, hue = the note's colour (circle of fifths), name = 'C', 'F#', ... */
  noteOn(note: number, x: number, v: number, kind: SceneKind, hue: number, name: string): void
  noteOff(note: number): void
  /** called when 3+ in-key notes are held together (at most every ~600 ms) */
  chord?(xs: number[]): void
  clear(): void
  /** paints the whole canvas each frame. Only called when ownBackdrop is true. */
  drawBackdrop?(ctx: CanvasRenderingContext2D, now: number): void
  /** draw on top of the backdrop. ctx transform is already CSS-pixel scaled. Leave ctx state as you found it. */
  draw(ctx: CanvasRenderingContext2D, now: number, quality: number): void
}

export type SceneFactory = (reduced: boolean) => Scene
