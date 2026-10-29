// Level data: the five maps (generated from a tiny room recipe), the rail path the camera glides along,
// and the piece each level plays (split into one phrase per demon). Pure functions, no state.
import { SONGS, type SongNote } from '../../songs/songs'
import type { Key } from '../../../music/theory'
import { PRELUDE_C, PRELUDE_PHASES, preludeFigure } from '../../../music/scores'
import { CEIL_KINDS, FLOOR_KINDS, WALL_KINDS } from './types'
import type { CeilKind, DemonKind, FloorKind, WallKind } from './types'

export type PropKind = 'column' | 'candles' | 'bust' | 'stand'
export interface RoomSpec { w: number; d: number; turn: 'L' | 'R' | 'S'; wall: WallKind; far?: WallKind; floor: FloorKind; ceil: CeilKind; props: PropKind[] }
export interface LevelSpec {
  id: string; name: string; songId: string; take?: number; reps?: number; boss?: boolean
  rooms: RoomSpec[]; fog: [number, number, number]; fogDist: number; wallH?: number; demons: DemonKind[]
  blurb: string; fact: string
  /** which episode's tab the level lives under (1 or 2); defaults to 1 */
  episode?: 1 | 2
  /** last level of the episode: shown as BOSS on the title screen, but played as a normal (big) demon fight */
  finale?: boolean
}
export const EPISODES: { n: 1 | 2; name: string }[] = [{ n: 1, name: 'Episode 1: The Cathedral' }, { n: 2, name: 'Episode 2: Symphony of Shadows' }]
export const episodeOf = (l: { episode?: 1 | 2 }): 1 | 2 => l.episode ?? 1

const R = (w: number, d: number, turn: RoomSpec['turn'], wall: WallKind, floor: FloorKind, ceil: CeilKind, props: PropKind[], far?: WallKind): RoomSpec => ({ w, d, turn, wall, floor, ceil, props, far })

export const LEVELS: LevelSpec[] = [
  { id: 'E1M1', name: 'The Practice Room', songId: 'ode', fog: [34, 22, 20], fogDist: 15, demons: ['imp', 'squeak'],
    blurb: 'Warm up! Ode to Joy.', fact: 'Beethoven wrote Ode to Joy when he was almost totally deaf. He heard every note inside his head.',
    rooms: [R(7, 9, 'S', 'wood', 'planks', 'beams', ['stand', 'column']), R(7, 10, 'L', 'wood', 'planks', 'beams', ['bust', 'column']), R(9, 10, 'R', 'brick', 'flag', 'beams', ['stand', 'bust', 'column'], 'wood')] },
  { id: 'E1M2', name: 'The Ballroom', songId: 'minuet', fog: [40, 22, 52], fogDist: 17, wallH: 1.3, demons: ['imp', 'grumble', 'squeak'],
    blurb: 'Dance steps in G: Minuet.', fact: 'A minuet is a dance in three beats: ONE-two-three, ONE-two-three. Fancy people danced it in powdered wigs.',
    rooms: [R(9, 10, 'S', 'marble', 'checker', 'gold', ['column', 'candles']), R(9, 10, 'L', 'velvet', 'carpet', 'gold', ['bust', 'column']), R(9, 11, 'R', 'marble', 'checker', 'gold', ['candles', 'column'], 'velvet'), R(11, 11, 'L', 'velvet', 'carpet', 'gold', ['bust', 'candles', 'column'], 'marble')] },
  { id: 'E1M3', name: 'The Organ Loft', songId: 'toccata', reps: 3, fog: [20, 20, 46], fogDist: 16, demons: ['grumble', 'imp'],
    blurb: 'Bach\'s spooky Toccata, three times.', fact: 'A pipe organ makes sound with moving air. Press a key, a pipe opens, and the longer the pipe, the lower the note.',
    rooms: [R(7, 10, 'S', 'pipes', 'flag', 'vault', ['column', 'candles']), R(9, 10, 'R', 'brick', 'flag', 'vault', ['column', 'bust'], 'pipes'), R(9, 11, 'L', 'pipes', 'planks', 'vault', ['candles', 'column'])] },
  { id: 'E1M4', name: 'Hall of the Mountain King', songId: 'king', fog: [38, 12, 20], fogDist: 16, demons: ['grumble', 'squeak', 'imp'],
    blurb: 'Sneak in, then speed up!', fact: 'Grieg wrote Mountain King for a play. Start soft and sneaky, speed up, get louder: that is called a crescendo.',
    rooms: [R(9, 10, 'S', 'brick', 'flag', 'vault', ['column', 'candles']), R(9, 10, 'R', 'velvet', 'carpet', 'vault', ['column']), R(9, 11, 'L', 'brick', 'flag', 'vault', ['candles', 'column'], 'velvet'), R(11, 11, 'R', 'velvet', 'carpet', 'vault', ['column', 'candles', 'bust'], 'brick')] },
  { id: 'E1M5', name: 'The Well-Tempered Cathedral', songId: 'prelude', boss: true, fog: [26, 16, 50], fogDist: 22, wallH: 2.2, demons: [],
    blurb: 'Boss: the Cacophodemon. Bach\'s Prelude in C.', fact: 'Bach wrote the Well-Tempered Clavier in 1722 to show off a tuning where every key sounds good.',
    rooms: [R(13, 17, 'S', 'glass', 'checker', 'vault', ['column', 'candles'], 'pipes')] },
  // ---- Episode 2: Symphony of Shadows (unlocks after the Cathedral boss) ----
  { id: 'E2M1', episode: 2, name: 'Sunrise Overlook', songId: 'morning', fog: [58, 40, 46], fogDist: 18, wallH: 1.4, demons: ['imp', 'squeak'],
    blurb: 'Grieg\'s Morning Mood. The tune climbs like a sunrise.', fact: 'Grieg wrote Morning Mood for a play, to paint a sunrise. The same tune is played again one step higher, so it feels like the sun rising.',
    rooms: [R(9, 10, 'S', 'wood', 'planks', 'beams', ['column', 'stand']), R(9, 10, 'R', 'marble', 'flag', 'beams', ['bust', 'column']), R(9, 11, 'L', 'wood', 'planks', 'beams', ['stand', 'column'], 'marble')] },
  { id: 'E2M2', episode: 2, name: 'The Opera House', songId: 'habanera', reps: 3, fog: [48, 14, 28], fogDist: 16, demons: ['grumble', 'imp'],
    blurb: 'Bizet\'s Habanera: slide down the keys, black ones too!', fact: 'The Habanera slides down one half step at a time. That is called a chromatic scale, and it uses every key, black and white.',
    rooms: [R(9, 10, 'S', 'velvet', 'carpet', 'gold', ['candles', 'column']), R(9, 10, 'L', 'velvet', 'carpet', 'gold', ['bust', 'candles']), R(11, 11, 'R', 'velvet', 'carpet', 'gold', ['candles', 'column', 'bust'], 'marble')] },
  { id: 'E2M3', episode: 2, name: 'The Sultan\'s Courtyard', songId: 'turkish', reps: 2, fog: [52, 30, 14], fogDist: 17, demons: ['imp', 'grumble', 'squeak'],
    blurb: 'Mozart\'s Turkish March, twice as fast as it sounds.', fact: 'Mozart loved the sound of Turkish military bands, with drums and cymbals. He copied their stomping beat on the piano.',
    rooms: [R(9, 10, 'S', 'brick', 'checker', 'beams', ['column', 'stand']), R(9, 10, 'R', 'marble', 'checker', 'gold', ['column', 'bust']), R(11, 11, 'L', 'brick', 'flag', 'beams', ['candles', 'column'], 'marble')] },
  { id: 'E2M4', episode: 2, name: 'Midnight Soiree', songId: 'nachtmusik', reps: 2, fog: [18, 18, 44], fogDist: 17, wallH: 1.3, demons: ['squeak', 'imp'],
    blurb: 'Mozart\'s Little Night Music. Fancy and quick.', fact: 'Eine kleine Nachtmusik means "A Little Night Music" in German. Mozart wrote it in 1787 for a small group of string players.',
    rooms: [R(9, 10, 'S', 'marble', 'checker', 'gold', ['column', 'candles']), R(9, 10, 'L', 'velvet', 'carpet', 'gold', ['bust', 'column']), R(9, 11, 'R', 'marble', 'checker', 'gold', ['candles', 'column'], 'velvet')] },
  { id: 'E2M5', episode: 2, name: 'The Counterpoint Crypt', songId: 'invention1', reps: 5, fog: [20, 24, 30], fogDist: 15, demons: ['grumble', 'imp', 'squeak'],
    blurb: 'Bach\'s Invention No. 1: one tiny tune, over and over.', fact: 'Bach wrote his Inventions to teach his students to play two melodies at once. This one starts with just seven notes.',
    rooms: [R(7, 10, 'S', 'brick', 'flag', 'vault', ['column', 'candles']), R(9, 10, 'R', 'pipes', 'flag', 'vault', ['column', 'bust']), R(9, 11, 'L', 'brick', 'flag', 'vault', ['candles', 'column'], 'pipes')] },
  { id: 'E2M6', episode: 2, finale: true, name: 'The Moonlit Cathedral', songId: 'moonlight', reps: 2, fog: [14, 18, 48], fogDist: 22, wallH: 2.0, demons: ['grumble', 'imp', 'squeak'],
    blurb: 'Final fight: Beethoven\'s Moonlight Sonata, slow and steady.', fact: 'Beethoven\'s Moonlight Sonata got its name after he died. A poet said it sounded like moonlight on a lake.',
    rooms: [R(11, 12, 'S', 'glass', 'checker', 'vault', ['column', 'candles'], 'pipes'), R(11, 12, 'R', 'marble', 'checker', 'vault', ['column', 'bust']), R(13, 14, 'L', 'glass', 'checker', 'vault', ['column', 'candles', 'bust'], 'pipes')] },
]

export const FACTS_EXTRA = ["A cadence is how music says 'the end of a sentence'.", 'Arpeggio means "harp-style": the notes of a chord played one after another, like Bach\'s Prelude in C.']

// ------------------------------------------------------------------ map
export interface Room {
  spec: RoomSpec
  /** world position (cell units, centre) of the camera while it fights here */
  sx: number; sy: number
  /** unit heading and unit "right" vector */
  hx: number; hy: number; rx: number; ry: number
  ang: number
  /** distance along the path where the camera stops */
  stopS: number
}
export interface Prop { x: number; y: number; kind: PropKind }
export interface LevelMap {
  spec: LevelSpec
  w: number; h: number
  /** 0 = floor, 1.. = wall kind index + 1 */
  cells: Uint8Array; floorId: Uint8Array; ceilId: Uint8Array
  rooms: Room[]
  props: Prop[]
  /** path polyline (x0,y0,x1,y1,...) and cumulative length at each point */
  path: number[]; cum: number[]
}

const G = 200
export function buildMap(spec: LevelSpec): LevelMap {
  const cells = new Uint8Array(G * G).fill(255), floorId = new Uint8Array(G * G), ceilId = new Uint8Array(G * G)
  const wallIdx = (k: WallKind) => WALL_KINDS.indexOf(k) + 1
  const setWall = (x: number, y: number, k: number) => { const i = y * G + x; if (cells[i] === 255) cells[i] = k }
  const carve = (x: number, y: number, f: FloorKind, c: CeilKind) => { const i = y * G + x; cells[i] = 0; floorId[i] = FLOOR_KINDS.indexOf(f); ceilId[i] = CEIL_KINDS.indexOf(c) }

  let en: [number, number] = [G / 2, G / 2]
  let h: [number, number] = [0, -1]
  const rooms: Room[] = []
  const props: Prop[] = []
  const pts: number[][] = []
  const CL = 4 // corridor length
  const cw = (c: [number, number]) => [c[0] + 0.5, c[1] + 0.5]
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

  // a short lead-in corridor behind the first room
  const corridor = (from: [number, number], dir: [number, number], len: number, wall: WallKind) => {
    const lt: [number, number] = [-dir[1], dir[0]]
    for (let s = 0; s < len; s++) for (let j = -2; j <= 2; j++) {
      const x = from[0] + dir[0] * s + lt[0] * j, y = from[1] + dir[1] * s + lt[1] * j
      if (Math.abs(j) <= 1) carve(x, y, 'flag', 'vault'); else setWall(x, y, wallIdx(wall))
    }
  }
  corridor([en[0] - h[0] * CL, en[1] - h[1] * CL], h, CL, 'brick')
  { const p = cw([en[0] - h[0] * CL, en[1] - h[1] * CL]); pts.push([p[0], p[1], -1]) }

  spec.rooms.forEach((rs, i) => {
    const lt: [number, number] = [-h[1], h[0]]
    const hw = (rs.w - 1) / 2
    const far = rs.far ?? rs.wall
    // room shell + floor
    for (let k = -1; k <= rs.d; k++) for (let j = -hw - 1; j <= hw + 1; j++) {
      const x = en[0] + h[0] * k + lt[0] * j, y = en[1] + h[1] * k + lt[1] * j
      if (k >= 0 && k < rs.d && Math.abs(j) <= hw) carve(x, y, rs.floor, rs.ceil)
      else setWall(x, y, wallIdx(k >= rs.d ? far : rs.wall))
    }
    // props: columns hug the side walls, others stand near the far side
    const kinds = rs.props
    if (kinds.includes('column')) for (let k = 2; k < rs.d - 1; k += 3) for (const sj of [-1, 1]) { const p = cw([en[0] + h[0] * k + lt[0] * sj * hw, en[1] + h[1] * k + lt[1] * sj * hw]); props.push({ x: p[0], y: p[1], kind: 'column' }) }
    for (const kind of kinds) {
      if (kind === 'column') continue
      for (const sj of [-1, 1]) {
        const k = Math.max(2, rs.d - 3 - Math.floor(rnd() * 3)), j = sj * Math.max(1, hw - 1 - Math.floor(rnd() * 2))
        const p = cw([en[0] + h[0] * k + lt[0] * j, en[1] + h[1] * k + lt[1] * j]); props.push({ x: p[0], y: p[1], kind })
      }
    }
    const e = cw(en)
    const stop = [e[0] + h[0] * 0.9, e[1] + h[1] * 0.9]
    pts.push([stop[0], stop[1], rooms.length])
    rooms.push({ spec: rs, sx: stop[0], sy: stop[1], hx: h[0], hy: h[1], rx: lt[0], ry: lt[1], ang: Math.atan2(h[1], h[0]), stopS: 0 })
    if (i === spec.rooms.length - 1) return
    // exit + corridor to the next room
    const next = spec.rooms[i + 1]
    const sgn = next.turn === 'L' ? -1 : next.turn === 'R' ? 1 : 0
    let nh: [number, number] = h, X: [number, number]
    const cwall: WallKind = rs.wall === 'glass' || rs.wall === 'pipes' ? 'brick' : rs.wall
    if (sgn === 0) {
      X = [en[0] + h[0] * rs.d, en[1] + h[1] * rs.d]
    } else {
      const kx = rs.d - 3
      nh = [lt[0] * sgn, lt[1] * sgn]
      X = [en[0] + h[0] * kx + lt[0] * sgn * (hw + 1), en[1] + h[1] * kx + lt[1] * sgn * (hw + 1)]
      const a = cw([en[0] + h[0] * kx, en[1] + h[1] * kx]); pts.push([a[0], a[1], -1])
    }
    corridor(X, nh, CL, cwall)
    en = [X[0] + nh[0] * CL, X[1] + nh[1] * CL]
    h = nh
    const c = cw(en); pts.push([c[0], c[1], -1])
  })

  // crop to what was used
  let x0 = G, y0 = G, x1 = 0, y1 = 0
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (cells[y * G + x] !== 255) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  x0 -= 1; y0 -= 1; x1 += 1; y1 += 1
  const w = x1 - x0 + 1, hh = y1 - y0 + 1
  const out = new Uint8Array(w * hh), fo = new Uint8Array(w * hh), co = new Uint8Array(w * hh)
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const sx = x + x0, sy = y + y0
    const v = sx >= 0 && sy >= 0 && sx < G && sy < G ? cells[sy * G + sx] : 255
    out[y * w + x] = v === 255 ? 1 : v
    fo[y * w + x] = sx >= 0 && sy >= 0 && sx < G && sy < G ? floorId[sy * G + sx] : 0
    co[y * w + x] = sx >= 0 && sy >= 0 && sx < G && sy < G ? ceilId[sy * G + sx] : 0
  }
  const path: number[] = [], cum: number[] = []
  let L = 0
  pts.forEach((p, i) => {
    const px = p[0] - x0, py = p[1] - y0
    if (i > 0) L += Math.hypot(px - path[path.length - 2], py - path[path.length - 1])
    path.push(px, py); cum.push(L)
    if (p[2] >= 0) rooms[p[2]].stopS = L
  })
  for (const r of rooms) { r.sx -= x0; r.sy -= y0 }
  for (const p of props) { p.x -= x0; p.y -= y0 }
  return { spec, w, h: hh, cells: out, floorId: fo, ceilId: co, rooms, props, path, cum }
}

/** position and unit direction at path distance s */
export function pathAt(m: LevelMap, s: number, out: { x: number; y: number }) {
  const n = m.cum.length
  s = Math.max(0, Math.min(m.cum[n - 1], s))
  let i = 1
  while (i < n - 1 && m.cum[i] < s) i++
  const a = m.cum[i - 1], b = m.cum[i], t = b > a ? (s - a) / (b - a) : 0
  out.x = m.path[(i - 1) * 2] + (m.path[i * 2] - m.path[(i - 1) * 2]) * t
  out.y = m.path[(i - 1) * 2 + 1] + (m.path[i * 2 + 1] - m.path[(i - 1) * 2 + 1]) * t
}

// ------------------------------------------------------------------ pieces
export interface Chunk { s: number; e: number }
export interface Piece {
  title: string; origin: string; bpm: number
  notes: number[]
  /** expected milliseconds since the previous note (0 for the first) */
  gap: number[]
  /** one phrase per demon (or one per boss phase) */
  chunks: Chunk[]
  /** boss only */
  bars: number
  /** the piece as sheet-music notes (rests included), the score index of each entry of `notes`, key and bar length */
  score: SongNote[]; scoreIdx: number[]; key: Key; beatsPerBar: number
}

export function buildPiece(spec: LevelSpec): Piece {
  if (spec.boss) {
    const notes = PRELUDE_C.flatMap(preludeFigure)
    const sixteenth = (60000 / 72) * 0.25
    return { title: 'Prelude in C', origin: 'J.S. Bach, 1722', bpm: 72, notes, gap: notes.map((_, i) => (i ? sixteenth : 0)), chunks: PRELUDE_PHASES.map(([a, b]) => ({ s: a * 16, e: b * 16 })), bars: PRELUDE_C.length,
      score: notes.map((note) => ({ note, beats: 0.25 })), scoreIdx: notes.map((_, i) => i), key: { tonic: 0, scale: 'major' }, beatsPerBar: 4 }
  }
  const song = SONGS.find((s) => s.id === spec.songId)!
  const base = song.notes.slice(0, spec.take ?? song.notes.length)
  const notes: number[] = [], gap: number[] = [], breaks: number[] = [], score: SongNote[] = [], scoreIdx: number[] = []
  const msPerBeat = 60000 / song.bpm
  let carry = 0 // beats since the previous sounding note started
  let prevBeats = 0
  for (let rep = 0; rep < (spec.reps ?? 1); rep++) {
    if (rep > 0) { carry += 2; score.push({ note: null, beats: 2 }); if (notes.length) breaks.push(notes.length) }
    for (const n of base) {
      if (n.note == null) { carry += n.beats; score.push({ note: null, beats: n.beats }); if (notes.length) breaks.push(notes.length); continue }
      gap.push(notes.length === 0 ? 0 : (prevBeats + carry) * msPerBeat)
      scoreIdx.push(score.length); score.push({ note: n.note, beats: n.beats })
      notes.push(n.note)
      prevBeats = n.beats; carry = 0
    }
  }
  // split into phrases at the rests, and any run over 7 notes into equal parts
  const cuts = [...new Set([0, ...breaks, notes.length])].sort((a, b) => a - b)
  const chunks: Chunk[] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1], len = b - a
    if (len <= 0) continue
    const parts = Math.max(1, Math.ceil(len / 7))
    for (let p = 0; p < parts; p++) chunks.push({ s: a + Math.floor((len * p) / parts), e: a + Math.floor((len * (p + 1)) / parts) })
  }
  return { title: song.title, origin: song.origin, bpm: song.bpm, notes, gap, chunks, bars: 0, score, scoreIdx, key: song.key, beatsPerBar: 4 }
}

/** how many demons per room: spread evenly, extras to the later rooms */
export function roomCounts(chunks: number, rooms: number): number[] {
  const base = Math.floor(chunks / rooms), extra = chunks % rooms
  return Array.from({ length: rooms }, (_, i) => base + (i >= rooms - extra ? 1 : 0))
}
