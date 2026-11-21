// Cache a layer that only changes when its signature changes, then stamp it.
// The key lanes are the same every frame until the key or the canvas size changes.

export function createLayerStamp() {
  let canvas: HTMLCanvasElement | null = null
  let sig = ''
  return function stamp(ctx: CanvasRenderingContext2D, w: number, h: number, key: string, draw: (g: CanvasRenderingContext2D) => void) {
    const bw = Math.max(1, Math.round(w))
    const bh = Math.max(1, Math.round(h))
    if (!canvas || sig !== key || canvas.width !== bw || canvas.height !== bh) {
      sig = key
      canvas ??= document.createElement('canvas')
      canvas.width = bw
      canvas.height = bh
      const g = canvas.getContext('2d')
      if (!g) return
      draw(g)
    }
    ctx.drawImage(canvas, 0, 0, w, h)
  }
}
