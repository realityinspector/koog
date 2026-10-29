// BachDoom shared contract. Pure types and constants (no state).
// Pixel format everywhere: Uint32Array of 0xAABBGGRR (the byte order of ImageData on little-endian machines),
// so a row can be copied straight into an ImageData's Uint32 view. alpha 0 = transparent.

export interface Img { w: number; h: number; px: Uint32Array }

/** wall / floor / ceiling textures are TEX x TEX, fully opaque, and tile seamlessly */
export const TEX = 64

export type WallKind = 'brick' | 'pipes' | 'glass' | 'wood' | 'velvet' | 'marble'
export const WALL_KINDS: WallKind[] = ['brick', 'pipes', 'glass', 'wood', 'velvet', 'marble']
export type FloorKind = 'flag' | 'checker' | 'carpet' | 'planks'
export const FLOOR_KINDS: FloorKind[] = ['flag', 'checker', 'carpet', 'planks']
export type CeilKind = 'vault' | 'beams' | 'gold'
export const CEIL_KINDS: CeilKind[] = ['vault', 'beams', 'gold']

export interface Textures {
  walls: Record<WallKind, Uint32Array>
  floors: Record<FloorKind, Uint32Array>
  ceils: Record<CeilKind, Uint32Array>
}

/** one cartoon demon design: 4 frames, all the same size (48 x 64), facing the camera, feet at the bottom edge */
export interface DemonSet { walk: [Img, Img]; attack: Img; hurt: Img }
export type DemonKind = 'imp' | 'grumble' | 'squeak'
export interface Sprites {
  demons: Record<DemonKind, DemonSet>
  /** the Cacophodemon, 96 x 96 */
  boss: { idle: [Img, Img]; attack: Img; hurt: Img }
  /** golden music-note pickup / particle, 16 x 16 */
  note: [Img, Img]
  /** slow "dissonance orb" the boss lobs, 24 x 24, 2 frames */
  orb: [Img, Img]
  /** the BFG's big glowing orb, 64 x 64, 2 frames */
  bfg: [Img, Img]
  /** gun smoke puff for misfires, 24 x 24, 3 frames growing */
  smoke: [Img, Img, Img]
  /** decor, drawn as billboards. column 32 x 64, candles 24 x 48, bust 32 x 56, stand 28 x 40 */
  props: { column: Img; candles: Img; bust: Img; stand: Img; torch: [Img, Img]; banner: Img }
}

/** Bach's status-bar face, 32 x 32 each */
export interface Face { center: Img; left: Img; right: Img; grin: Img; hurt: Img; sweaty: Img; dizzy: Img }
/** the pipe-organ gun seen from behind, bottom centre of the screen, 80 x 56 each */
export interface Gun { idle: Img; fire: [Img, Img]; jam: Img }
