// Desktop-only picture and audio budgets. The browser build keeps the original numbers.
// The Mac app runs the audio callback inside this process, so a heavy canvas frame
// delays the next note. These helpers are the fork for that.

/** True inside the Electron shell. A browser tab on this checkout stays on the web path. */
export function desktopOn(): boolean {
  return typeof window !== 'undefined' && !!window.koogDesktop
}

/** Backing-store scale for the play picture. Desktop stays at 1 CSS pixel: the sprites are already soft, and 1.5× fills 2.25× the pixels. */
export function vizBackingScale(dpr: number, desktop: boolean): number {
  const safe = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return desktop ? 1 : Math.min(1.5, safe)
}

/** Opaque, unsynced canvas on the desktop. The picture paints its own background, so page alpha is unused. */
export function openVizContext(canvas: HTMLCanvasElement, desktop: boolean): CanvasRenderingContext2D {
  if (!desktop) return canvas.getContext('2d')!
  return canvas.getContext('2d', { alpha: false, desynchronized: true }) ?? canvas.getContext('2d')!
}

/** 60 Hz cap. Motion in the visualizer advances once per paint, so 120 Hz both costs double and plays the bursts too fast. */
export function vizFrameDue(now: number, lastPaint: number, desktop: boolean): boolean {
  if (!desktop || lastPaint <= 0) return true
  return now - lastPaint >= 15.5
}

/** Shed sparks before a frame runs long. Desktop steps down faster because the audio callback shares the process. Airplane holds the picture under the sound. */
export function nextVizQuality(quality: number, frameEma: number, desktop: boolean, air = false): number {
  if (desktop && air) {
    if (frameEma > 17) return Math.max(0.45, quality - 0.12)
    if (frameEma < 16) return Math.min(0.85, quality + 0.01)
    return Math.min(quality, 0.85)
  }
  if (desktop) {
    if (frameEma > 18) return Math.max(0.4, quality - 0.08)
    if (frameEma < 16.2) return Math.min(1, quality + 0.01)
    return quality
  }
  if (frameEma > 21) return Math.max(0.35, quality - 0.02)
  if (frameEma < 17.5) return Math.min(1, quality + 0.005)
  return quality
}

/** Peak meters read the time domain only. 256 frames is a quarter of the old 1024-point copy on the audio thread. */
export function meterFftSize(desktop: boolean): number {
  return desktop ? 256 : 1024
}
