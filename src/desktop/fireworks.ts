// Desktop fork of the firework hot path. The shapes stay; the per-frame spawn rate drops.

/** One lingering ember per rocket frame on the desktop. The web path keeps an ember on every substep. */
export function spawnRocketEmber(step: number, steps: number, desktop: boolean): boolean {
  if (!desktop) return true
  return step === steps - 1
}

/** Extra gold sparks behind a rocket. Desktop waits until the frame budget is comfortable. */
export function rocketGlitter(quality: number, desktop: boolean): boolean {
  return desktop ? quality > 0.85 : quality > 0.5
}

/** Trail crumbs behind a shell. Desktop spawns them only while frames are on budget. */
export function trailOn(quality: number, desktop: boolean): boolean {
  return desktop ? quality > 0.92 : quality > 0.7
}

/** Held-note glow stamped from the pre-rendered dot, instead of a new radial gradient every frame. */
export function drawHeldGlow(ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number, sprite: CanvasImageSource) {
  const r = 18 + velocity * 30
  ctx.globalAlpha = 0.55
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}
