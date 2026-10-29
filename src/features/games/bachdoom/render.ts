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
  /** horizontal squash/stretch (1 = normal) */
  ws: number
}
export const newBillboard = (): Billboard => ({ x: 0, y: 0, z: 0, h: 1, img: null as unknown as Img, flip: false, tint: 0, tr: 255, tg: 255, tb: 255, glow: false, ws: 1 })

const PLANE = 0.86 // half-width of the camera plane: ~85 degree field of view
const VSCALE = 0.78 // vertical focal length relative to the horizontal one (a squat, wide view fits the stage)
const CAMH = 0.5
const LS = 4 // light-map texels per cell

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
  // baked light map: LS texels per cell, packed 0xBBGGRR amounts added to the surface's brightness (0..255 = 0..1)
  private lm = new Uint32Array(1); private lw = 1; private lh = 1
  /** set true (prefers-reduced-motion) to hold the torch light steady */
  still = false
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
    this.bakeLight(map)
  }

  /** one-off per level: sum every light (torches, candelabras, stained-glass patches) plus the level's ambient wash into a texel grid */
  private bakeLight(map: LevelMap) {
    const mw = map.w, mh = map.h, lw = mw * LS, lh = mh * LS, n = lw * lh
    const ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n)
    const amb = map.spec.ambient ?? [0, 0, 0]
    for (let ty = 0; ty < lh; ty++) for (let tx = 0; tx < lw; tx++) {
      if (map.cells[((ty / LS) | 0) * mw + ((tx / LS) | 0)] !== 0) continue
      const i = ty * lw + tx
      ar[i] = amb[0]; ag[i] = amb[1]; ab[i] = amb[2]
    }
    for (const l of map.lights) {
      const x0 = Math.max(0, Math.floor((l.x - l.rad) * LS)), x1 = Math.min(lw - 1, Math.ceil((l.x + l.rad) * LS))
      const y0 = Math.max(0, Math.floor((l.y - l.rad) * LS)), y1 = Math.min(lh - 1, Math.ceil((l.y + l.rad) * LS))
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (map.cells[((ty / LS) | 0) * mw + ((tx / LS) | 0)] !== 0) continue
        const d = Math.hypot((tx + 0.5) / LS - l.x, (ty + 0.5) / LS - l.y) / l.rad
        if (d >= 1) continue
        const k = Math.pow(1 - d, l.pow), i = ty * lw + tx
        ar[i] += l.r * k; ag[i] += l.g * k; ab[i] += l.b * k
      }
    }
    const lm = new Uint32Array(n)
    for (let i = 0; i < n; i++) lm[i] = (Math.min(190, ar[i]) | 0) | ((Math.min(190, ag[i]) | 0) << 8) | ((Math.min(190, ab[i]) | 0) << 16)
    this.lm = lm; this.lw = lw; this.lh = lh
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
    // torch light breathes very slowly (about +-4%), and not at all with reduced motion
    const tt = performance.now() / 1000
    const fl = this.still ? 256 : (256 + 7 * Math.sin(tt * 1.3) + 4 * Math.sin(tt * 2.1 + 1)) | 0
    const lm = this.lm, lw = this.lw, lh = this.lh

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
      const lsh = floor ? 0 : 2
      let o = y * w
      for (let x = 0; x < w; x++, fx += sx, fy += sy, o++) {
        const ix = fx | 0, iy = fy | 0
        if (fx < 0 || fy < 0 || ix >= mw || iy >= mh) { buf[o] = fogCol; continue }
        const t = tex[ids[iy * mw + ix]]
        const c = t[(((fy - iy) * TEX) & (TEX - 1)) * TEX + (((fx - ix) * TEX) & (TEX - 1))]
        const l = lm[((fy * LS) | 0) * lw + ((fx * LS) | 0)]
        const lr = (((l & 255) * fl) >> 8) >> lsh, lg = ((((l >> 8) & 255) * fl) >> 8) >> lsh, lb = ((((l >> 16) & 255) * fl) >> 8) >> lsh
        let r = (((c & 255) * (lum + lr)) >> 8) + fR, g = ((((c >> 8) & 255) * (lum + lg)) >> 8) + fG, bl = ((((c >> 16) & 255) * (lum + lb)) >> 8) + fB
        if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255
        buf[o] = 0xff000000 | (bl << 16) | (g << 8) | r
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
      let lx = ((cx + rdx * (perp - 0.15)) * LS) | 0, ly = ((cy + rdy * (perp - 0.15)) * LS) | 0
      if (lx < 0) lx = 0; else if (lx >= lw) lx = lw - 1
      if (ly < 0) ly = 0; else if (ly >= lh) ly = lh - 1
      const wl = lm[ly * lw + lx]
      const lumR = lum + (((wl & 255) * fl) >> 8), lumG = lum + ((((wl >> 8) & 255) * fl) >> 8), lumB = lum + ((((wl >> 16) & 255) * fl) >> 8)
      let tpos = (Math.max(0, y0) - top) * step
      if (y0 < 0) y0 = 0
      if (y1 >= h) y1 = h - 1
      let o = y0 * w + x
      for (let y = y0; y <= y1; y++, o += w, tpos += step) {
        const c = tex[(tpos & (TEX - 1)) * TEX + tx]
        let r = (((c & 255) * lumR) >> 8) + fR, g = ((((c >> 8) & 255) * lumG) >> 8) + fG, bl = ((((c >> 16) & 255) * lumB) >> 8) + fB
        if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255
        buf[o] = 0xff000000 | (bl << 16) | (g << 8) | r
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
      const sw = (sh * img.w * b.ws) / img.h
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
      let sr = lum, sg = lum, sb = lum
      if (!b.glow) {
        let lx = (b.x * LS) | 0, ly = (b.y * LS) | 0
        if (lx < 0) lx = 0; else if (lx >= lw) lx = lw - 1
        if (ly < 0) ly = 0; else if (ly >= lh) ly = lh - 1
        const bl0 = lm[ly * lw + lx]
        sr += ((bl0 & 255) * fl) >> 8; sg += (((bl0 >> 8) & 255) * fl) >> 8; sb += (((bl0 >> 16) & 255) * fl) >> 8
      }
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
          r = ((r * sr) >> 8) + fR; g = ((g * sg) >> 8) + fG; bl = ((bl * sb) >> 8) + fB
          if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255
          buf[y * w + x] = 0xff000000 | (bl << 16) | (g << 8) | r
        }
      }
    }
    this.g.putImageData(this.data, 0, 0)
  }
}
