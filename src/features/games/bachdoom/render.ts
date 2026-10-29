// The raycaster: textured walls + floor + ceiling, distance fog, and z-buffered billboard sprites,
// all drawn into one low-resolution ImageData that the component scales up with smoothing off.
// Buffers are allocated once (per size), never inside the per-pixel loops.
import { TEX } from './types'
import type { Img, Textures } from './types'
import { CEIL_KINDS, FLOOR_KINDS, WALL_KINDS } from './types'
import type { LevelMap } from './levels'

export interface Billboard {
  x: number; y: number
  /** height of the sprite's bottom above the floor, and its world height (wall = 1) */
  z: number; h: number
  img: Img
  flip: boolean
  /** 0..1 amount of tint colour mixed in */
  tint: number; tr: number; tg: number; tb: number
  /** glowing things ignore fog darkening */
  glow: boolean
}
export const newBillboard = (): Billboard => ({ x: 0, y: 0, z: 0, h: 1, img: null as unknown as Img, flip: false, tint: 0, tr: 255, tg: 255, tb: 255, glow: false })

const PLANE = 0.86 // half-width of the camera plane: ~85 degree field of view
const VSCALE = 0.78 // vertical focal length relative to the horizontal one (a squat, wide view fits the stage)
const CAMH = 0.5

export class View {
  iw = 0; ih = 0
  canvas: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private data: ImageData | null = null
  private buf!: Uint32Array
  zbuf = new Float32Array(1)
  private order = new Int32Array(256)
  private depth = new Float32Array(256)
  private map: LevelMap | null = null
  private walls: Uint32Array[] = []
  private floors: Uint32Array[] = []
  private ceils: Uint32Array[] = []
  private wh = 1
  private fr = 20; private fg = 20; private fb = 30; private fogDist = 15
  // camera of the last frame (for project())
  private cx = 0; private cy = 0; private dx = 1; private dy = 0; private px = 0; private py = 1
  hf = 1; f = 1; horizon = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.g = this.canvas.getContext('2d', { alpha: false })!
  }

  resize(iw: number, ih: number) {
    iw = Math.max(16, iw | 0); ih = Math.max(16, ih | 0)
    if (iw === this.iw && ih === this.ih && this.data) return
    this.iw = iw; this.ih = ih
    this.canvas.width = iw; this.canvas.height = ih
    this.data = this.g.createImageData(iw, ih)
    this.buf = new Uint32Array(this.data.data.buffer)
    this.zbuf = new Float32Array(iw)
    this.hf = iw / (2 * PLANE)
    this.f = this.hf * VSCALE
  }

  setLevel(map: LevelMap, tex: Textures) {
    this.map = map
    this.walls = WALL_KINDS.map((k) => tex.walls[k])
    this.floors = FLOOR_KINDS.map((k) => tex.floors[k])
    this.ceils = CEIL_KINDS.map((k) => tex.ceils[k])
    this.fr = map.spec.fog[0]; this.fg = map.spec.fog[1]; this.fb = map.spec.fog[2]
    this.fogDist = map.spec.fogDist
    this.wh = map.spec.wallH ?? 1
  }

  /** screen position (internal pixels) of a world point after the last render; returns the pixels-per-world-unit scale, or 0 if behind */
  project(wx: number, wy: number, wz: number, out: { x: number; y: number; d: number }): number {
    const dx = wx - this.cx, dy = wy - this.cy
    const inv = 1 / (this.px * this.dy - this.dx * this.py)
    const tx = inv * (this.dy * dx - this.dx * dy)
    const ty = inv * (-this.py * dx + this.px * dy)
    if (ty < 0.15) return 0
    const sc = this.f / ty
    out.x = (this.iw / 2) * (1 + tx / ty)
    out.y = this.horizon + (CAMH - wz) * sc
    out.d = ty
    return sc
  }

  render(cx: number, cy: number, ang: number, bob: number, list: Billboard[], n: number) {
    const map = this.map
    if (!map || !this.data) return
    const w = this.iw, h = this.ih, buf = this.buf, f = this.f, mw = map.w, mh = map.h
    const cells = map.cells
    const dirX = Math.cos(ang), dirY = Math.sin(ang)
    const plX = -dirY * PLANE, plY = dirX * PLANE
    const horizon = Math.round(h / 2 + bob)
    this.cx = cx; this.cy = cy; this.dx = dirX; this.dy = dirY; this.px = plX; this.py = plY; this.horizon = horizon
    const fr = this.fr, fg = this.fg, fb = this.fb, fogDist = this.fogDist, wh = this.wh
    const fogCol = 0xff000000 | (fb << 16) | (fg << 8) | fr

    // ---- floor and ceiling, one row at a time
    for (let y = 0; y < h; y++) {
      const rel = y - horizon
      if (rel === 0) { buf.fill(fogCol, y * w, y * w + w); continue }
      const floor = rel > 0
      const rowDist = ((floor ? CAMH : wh - CAMH) * f) / Math.abs(rel)
      const ft = Math.min(1, Math.max(0, (rowDist - 1.5) / (fogDist - 1.5)))
      if (ft >= 0.995) { buf.fill(fogCol, y * w, y * w + w); continue }
      const a = (1 - ft) * (floor ? 0.95 : 0.8)
      const lum = (a * 256) | 0
      const fR = (fr * ft) | 0, fG = (fg * ft) | 0, fB = (fb * ft) | 0
      let fx = cx + (dirX - plX) * rowDist, fy = cy + (dirY - plY) * rowDist
      const sx = (rowDist * 2 * plX) / w, sy = (rowDist * 2 * plY) / w
      const tex = floor ? this.floors : this.ceils
      const ids = floor ? map.floorId : map.ceilId
      let o = y * w
      for (let x = 0; x < w; x++, fx += sx, fy += sy, o++) {
        const ix = fx | 0, iy = fy | 0
        if (fx < 0 || fy < 0 || ix >= mw || iy >= mh) { buf[o] = fogCol; continue }
        const t = tex[ids[iy * mw + ix]]
        const c = t[(((fy - iy) * TEX) & (TEX - 1)) * TEX + (((fx - ix) * TEX) & (TEX - 1))]
        buf[o] = 0xff000000 | ((((((c >> 16) & 255) * lum) >> 8) + fB) << 16) | ((((((c >> 8) & 255) * lum) >> 8) + fG) << 8) | ((((c & 255) * lum) >> 8) + fR)
      }
    }

    // ---- walls: one DDA ray per screen column
    for (let x = 0; x < w; x++) {
      const camX = (2 * x) / w - 1
      const rdx = dirX + plX * camX, rdy = dirY + plY * camX
      let mx = cx | 0, my = cy | 0
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy)
      let stepX = 1, stepY = 1, sdx: number, sdy: number
      if (rdx < 0) { stepX = -1; sdx = (cx - mx) * ddx } else sdx = (mx + 1 - cx) * ddx
      if (rdy < 0) { stepY = -1; sdy = (cy - my) * ddy } else sdy = (my + 1 - cy) * ddy
      let side = 0, hit = 0
      for (let i = 0; i < 64; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0 } else { sdy += ddy; my += stepY; side = 1 }
        if (mx < 0 || my < 0 || mx >= mw || my >= mh) { hit = 1; break }
        const v = cells[my * mw + mx]
        if (v > 0) { hit = v; break }
      }
      const perp = side === 0 ? sdx - ddx : sdy - ddy
      const dist = Math.max(0.05, perp)
      this.zbuf[x] = dist
      const tex = this.walls[Math.max(0, hit - 1)] ?? this.walls[0]
      let wallX = side === 0 ? cy + dist * rdy : cx + dist * rdx
      wallX -= Math.floor(wallX)
      let tx = (wallX * TEX) | 0
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TEX - 1 - tx
      const unit = f / dist
      const lineH = unit * wh
      const top = horizon - (wh - CAMH) * unit
      let y0 = Math.ceil(top), y1 = Math.floor(top + lineH)
      const ft = Math.min(1, Math.max(0, (dist - 1.5) / (fogDist - 1.5)))
      const lum = (((1 - ft) * (side ? 0.72 : 1)) * 256) | 0
      const fR = (fr * ft) | 0, fG = (fg * ft) | 0, fB = (fb * ft) | 0
      const step = TEX / lineH
      let tpos = (Math.max(0, y0) - top) * step
      if (y0 < 0) y0 = 0
      if (y1 >= h) y1 = h - 1
      let o = y0 * w + x
      for (let y = y0; y <= y1; y++, o += w, tpos += step) {
        const c = tex[(tpos & (TEX - 1)) * TEX + tx]
        buf[o] = 0xff000000 | ((((((c >> 16) & 255) * lum) >> 8) + fB) << 16) | ((((((c >> 8) & 255) * lum) >> 8) + fG) << 8) | ((((c & 255) * lum) >> 8) + fR)
      }
    }

    // ---- billboards, far to near
    if (n > this.order.length) { this.order = new Int32Array(n * 2); this.depth = new Float32Array(n * 2) }
    const inv = 1 / (plX * dirY - dirX * plY)
    let m = 0
    for (let i = 0; i < n; i++) {
      const b = list[i]
      const dx = b.x - cx, dy = b.y - cy
      const ty = inv * (-plY * dx + plX * dy)
      if (ty < 0.2 || ty > fogDist + 2) continue
      // insertion sort by depth, farthest first
      let j = m++
      while (j > 0 && this.depth[j - 1] < ty) { this.order[j] = this.order[j - 1]; this.depth[j] = this.depth[j - 1]; j-- }
      this.order[j] = i; this.depth[j] = ty
    }
    for (let k = 0; k < m; k++) {
      const b = list[this.order[k]], ty = this.depth[k]
      const dx = b.x - cx, dy = b.y - cy
      const tx = inv * (dirY * dx - dirX * dy)
      const img = b.img
      const sh = (b.h * f) / ty
      const sw = (sh * img.w) / img.h
      const scx = (w / 2) * (1 + tx / ty)
      const bottom = horizon + ((CAMH - b.z) * f) / ty
      const top = bottom - sh
      const left = scx - sw / 2
      const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(w - 1, Math.floor(left + sw) - 1)
      if (x1 < x0) continue
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(h - 1, Math.floor(bottom) - 1)
      if (y1 < y0) continue
      const ft = b.glow ? 0 : Math.min(1, Math.max(0, (ty - 1.5) / (fogDist - 1.5)))
      const lum = ((1 - ft * 0.9) * 256) | 0
      const fR = (fr * ft * 0.9) | 0, fG = (fg * ft * 0.9) | 0, fB = (fb * ft * 0.9) | 0
      const ta = (b.tint * 256) | 0, tr = b.tr, tg = b.tg, tb = b.tb
      const iw = img.w, ihh = img.h, px = img.px
      const cs = iw / sw, rs = ihh / sh
      for (let x = x0; x <= x1; x++) {
        if (ty > this.zbuf[x] + 0.05) continue
        let u = ((x + 0.5 - left) * cs) | 0
        if (u >= iw) u = iw - 1
        if (b.flip) u = iw - 1 - u
        for (let y = y0; y <= y1; y++) {
          let v = ((y + 0.5 - top) * rs) | 0
          if (v >= ihh) v = ihh - 1
          const c = px[v * iw + u]
          if ((c >>> 24) < 128) continue
          let r = (c & 255), g = (c >> 8) & 255, bl = (c >> 16) & 255
          if (ta) { r += ((tr - r) * ta) >> 8; g += ((tg - g) * ta) >> 8; bl += ((tb - bl) * ta) >> 8 }
          buf[y * w + x] = 0xff000000 | (((((bl * lum) >> 8) + fB)) << 16) | (((((g * lum) >> 8) + fG)) << 8) | (((r * lum) >> 8) + fR)
        }
      }
    }
    this.g.putImageData(this.data, 0, 0)
  }
}
