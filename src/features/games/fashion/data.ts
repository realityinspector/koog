// Runway Remix: eras, wardrobe, colour <-> harmony rules, judge commentary and the per-kid save.
// Pure data and helpers, no module-level state.
import { PC_NAMES, pc, type Key } from '../../../music/theory'
import { SONGS, type Song } from '../../songs/songs'
import { pload, psave } from '../../../profile/profile'

export type Phase = 'eras' | 'style' | 'runway' | 'results' | 'lookbook'
export const CATS = ['hats', 'tops', 'bottoms', 'shoes', 'acc'] as const
export type Cat = (typeof CATS)[number]
export const CAT_INFO: Record<Cat, { label: string; icon: string }> = {
  hats: { label: 'HATS', icon: '🎩' }, tops: { label: 'TOPS', icon: '👕' }, bottoms: { label: 'BOTTOMS', icon: '👖' },
  shoes: { label: 'SHOES', icon: '👞' }, acc: { label: 'EXTRAS', icon: '💍' },
}

export type Fabric = 'plain' | 'brocade' | 'stripe' | 'sequin' | 'holo' | 'lace' | 'velvet'
export type Role = 'main' | 'accent' | 'trim' | 'dark' | 'light' | 'white'
/** One wardrobe item. `shape` picks the drawing; `p` are its tuning numbers (see sprites.ts). */
export interface Item { id: string; name: string; shape: string; fabric?: Fabric; role?: Role; sig?: boolean; p?: Record<string, number> }

const PLAIN: Record<Cat, Item> = {
  hats: { id: 'nohat', name: 'No hat', shape: 'none' },
  tops: { id: 'tee', name: 'Simple top', shape: 'tee', role: 'main' },
  bottoms: { id: 'pants', name: 'Simple pants', shape: 'pants', role: 'dark' },
  shoes: { id: 'shoe', name: 'Simple shoes', shape: 'flat', role: 'dark' },
  acc: { id: 'noacc', name: 'No extras', shape: 'none' },
}

export interface Era {
  id: string; name: string; years: string; icon: string
  /** backdrop top / bottom, and the lit-up accent */
  bg: [string, string]; glow: string
  fashion: string
  fact: string
  pieces: string[]
  items: Record<Cat, Item[]>
}

export const ERAS: Era[] = [
  {
    id: 'baroque', name: 'Baroque', years: '1600–1750', icon: '🕰️', bg: ['#2a1745', '#7d4a74'], glow: '#ffd76c',
    fashion: 'brocade coats, powdered wigs, lace',
    fact: 'Baroque music is full of fancy decorations (trills!), just like brocade coats and lace cuffs. Fancy detail everywhere!',
    pieces: ['minuet', 'jesu', 'hornpipe', 'spring', 'canon', 'toccata'],
    items: {
      hats: [
        { id: 'wig', name: 'Powdered wig', shape: 'wig', role: 'white', sig: true },
        { id: 'tricorn', name: 'Tricorn hat', shape: 'tricorn', role: 'main' },
        { id: 'plume', name: 'Plumed hat', shape: 'plume', role: 'accent' },
      ],
      tops: [
        { id: 'brocadecoat', name: 'Brocade coat', shape: 'coat', fabric: 'brocade', role: 'main', sig: true, p: { len: 52, tails: 1, collar: 0 } },
        { id: 'vest', name: 'Silk vest', shape: 'vest', role: 'accent', fabric: 'velvet' },
        { id: 'jabot', name: 'Lace jabot blouse', shape: 'blouse', role: 'white', fabric: 'lace', p: { ruffle: 1 } },
      ],
      bottoms: [
        { id: 'breeches', name: 'Knee breeches', shape: 'breeches', role: 'main', sig: true },
        { id: 'hoop', name: 'Wide hoop skirt', shape: 'skirt', fabric: 'brocade', role: 'accent', p: { flare: 2.1, len: 0.92 } },
        { id: 'silk', name: 'Silk skirt', shape: 'skirt', role: 'main', fabric: 'velvet', p: { flare: 1.5, len: 0.9 } },
      ],
      shoes: [
        { id: 'buckle', name: 'Buckle shoes', shape: 'buckle', role: 'dark', sig: true },
        { id: 'redheel', name: 'Red heels', shape: 'heel', role: 'accent' },
        { id: 'slipper', name: 'Silk slippers', shape: 'flat', role: 'light' },
      ],
      acc: [
        { id: 'fan', name: 'Hand fan', shape: 'fan', role: 'accent', sig: true },
        { id: 'cuffs', name: 'Lace cuffs', shape: 'cuffs', role: 'white', fabric: 'lace' },
        { id: 'cane', name: 'Fancy cane', shape: 'cane', role: 'trim' },
      ],
    },
  },
  {
    id: 'classical', name: 'Classical', years: '1750–1820', icon: '🎻', bg: ['#1c2c4e', '#7b93bb'], glow: '#fff1b0',
    fashion: 'empire waists, tailcoats',
    fact: 'Classical music got clean and balanced, and so did fashion: simple empire waists and neat tailcoats with nothing wasted.',
    pieces: ['k545', 'elise', 'ode', 'turkish', 'nachtmusik', 'surprise'],
    items: {
      hats: [
        { id: 'regbonnet', name: 'Regency bonnet', shape: 'bonnet', role: 'main', sig: true },
        { id: 'bicorne', name: 'Bicorne hat', shape: 'bicorne', role: 'dark' },
        { id: 'featherband', name: 'Feather headband', shape: 'band', role: 'accent' },
      ],
      tops: [
        { id: 'tailcoat', name: 'Tailcoat', shape: 'coat', role: 'dark', sig: true, p: { len: 44, tails: 1, collar: 1 } },
        { id: 'empirebodice', name: 'Empire bodice', shape: 'bodice', role: 'main', fabric: 'velvet', p: { len: 20, v: 1 } },
        { id: 'waistcoat', name: 'Ruffled waistcoat', shape: 'vest', role: 'accent', p: { ruffle: 1 } },
      ],
      bottoms: [
        { id: 'empireskirt', name: 'Empire skirt', shape: 'skirt', role: 'main', sig: true, p: { flare: 1.35, len: 1, high: 1 } },
        { id: 'trousers', name: 'Fitted trousers', shape: 'pants', role: 'light' },
        { id: 'cbreeches', name: 'Riding breeches', shape: 'breeches', role: 'light' },
      ],
      shoes: [
        { id: 'ballet', name: 'Ballet slippers', shape: 'flat', role: 'main', sig: true },
        { id: 'riding', name: 'Riding boots', shape: 'boot', role: 'dark' },
        { id: 'cbuckle', name: 'Buckle shoes', shape: 'buckle', role: 'dark' },
      ],
      acc: [
        { id: 'gloves', name: 'Long gloves', shape: 'gloves', role: 'white', sig: true },
        { id: 'parasol', name: 'Parasol', shape: 'parasol', role: 'accent' },
        { id: 'cravat', name: 'Cravat', shape: 'cravat', role: 'white' },
      ],
    },
  },
  {
    id: 'romantic', name: 'Romantic', years: '1820–1900', icon: '🌹', bg: ['#3a1730', '#a2475c'], glow: '#ffb3c8',
    fashion: 'Victorian silhouettes, top hats',
    fact: 'Romantic composers wrote big feelings, and clothes got dramatic too: tall top hats, swishy skirts and capes for the big finale.',
    pieces: ['swanlake', 'sugarplum', 'morning', 'bluedanube', 'king', 'brahms'],
    items: {
      hats: [
        { id: 'tophat', name: 'Top hat', shape: 'tophat', role: 'dark', sig: true },
        { id: 'ribbonbonnet', name: 'Ribbon bonnet', shape: 'bonnet', role: 'accent' },
        { id: 'velvetcap', name: 'Velvet cap', shape: 'flatcap', role: 'main', fabric: 'velvet' },
      ],
      tops: [
        { id: 'frock', name: 'Frock coat', shape: 'coat', role: 'dark', fabric: 'velvet', sig: true, p: { len: 56, tails: 0, collar: 1 } },
        { id: 'bustlebodice', name: 'Fitted bodice', shape: 'bodice', role: 'main', p: { len: 34, v: 0, high: 1 } },
        { id: 'velvetvest', name: 'Velvet waistcoat', shape: 'vest', role: 'accent', fabric: 'velvet' },
      ],
      bottoms: [
        { id: 'bustle', name: 'Bustle skirt', shape: 'skirt', role: 'main', sig: true, fabric: 'velvet', p: { flare: 1.7, len: 1, bustle: 1 } },
        { id: 'long', name: 'Long trousers', shape: 'pants', role: 'dark', fabric: 'stripe' },
        { id: 'ballgown', name: 'Ball gown skirt', shape: 'skirt', role: 'accent', p: { flare: 2.2, len: 1 } },
      ],
      shoes: [
        { id: 'buttonboot', name: 'Button boots', shape: 'boot', role: 'dark', sig: true },
        { id: 'dance', name: 'Dancing shoes', shape: 'heel', role: 'main' },
        { id: 'oxford', name: 'Oxfords', shape: 'oxford', role: 'dark' },
      ],
      acc: [
        { id: 'watch', name: 'Pocket watch', shape: 'watch', role: 'trim', sig: true },
        { id: 'cape', name: 'Dramatic cape', shape: 'cape', role: 'main', fabric: 'velvet' },
        { id: 'lparasol', name: 'Lace parasol', shape: 'parasol', role: 'white', fabric: 'lace' },
      ],
    },
  },
  {
    id: 'belle', name: 'Belle Époque / Ragtime', years: '1890–1915', icon: '🎹', bg: ['#16424a', '#74b3a0'], glow: '#ffe8a3',
    fashion: 'boaters, S-curve gowns',
    fact: 'Ragtime has bouncy off-beat rhythms, and the style matched: a jaunty straw boater and a gown with a swishy S-curve.',
    pieces: ['entertainer', 'mapleleaf', 'gymnopedie', 'susanna'],
    items: {
      hats: [
        { id: 'boater', name: 'Straw boater', shape: 'boater', role: 'light', sig: true },
        { id: 'bighat', name: 'Big feathered hat', shape: 'bighat', role: 'accent' },
        { id: 'newsboy', name: 'Newsboy cap', shape: 'flatcap', role: 'main' },
      ],
      tops: [
        { id: 'lacetop', name: 'High lace collar', shape: 'blouse', role: 'white', fabric: 'lace', sig: true, p: { ruffle: 1, high: 1 } },
        { id: 'blazer', name: 'Striped blazer', shape: 'coat', role: 'main', fabric: 'stripe', p: { len: 34, tails: 0, collar: 1 } },
        { id: 'shirtwaist', name: 'Puff-sleeve shirt', shape: 'blouse', role: 'accent', p: { puff: 1 } },
      ],
      bottoms: [
        { id: 'scurve', name: 'S-curve gown skirt', shape: 'skirt', role: 'main', sig: true, p: { flare: 1.45, len: 1, bustle: 0.5 } },
        { id: 'plaid', name: 'Checked trousers', shape: 'pants', role: 'light', fabric: 'stripe' },
        { id: 'trumpet', name: 'Trumpet skirt', shape: 'skirt', role: 'accent', fabric: 'velvet', p: { flare: 1.25, len: 0.95 } },
      ],
      shoes: [
        { id: 'spats', name: 'Spats', shape: 'oxford', role: 'dark', sig: true },
        { id: 'laceboot', name: 'Lace-up boots', shape: 'boot', role: 'main' },
        { id: 'maryjane', name: 'Mary Janes', shape: 'heel', role: 'dark', p: { strap: 1 } },
      ],
      acc: [
        { id: 'bowtie', name: 'Bow tie', shape: 'bowtie', role: 'accent', sig: true },
        { id: 'bparasol', name: 'Parasol', shape: 'parasol', role: 'accent' },
        { id: 'bcane', name: 'Walking cane', shape: 'cane', role: 'dark' },
      ],
    },
  },
  {
    id: 'jazz', name: 'Jazz Age', years: '1920s', icon: '🎷', bg: ['#17142e', '#6a4a1c'], glow: '#ffd24a',
    fashion: 'flapper dresses, cloche hats, pinstripes',
    fact: 'Jazz is all about swing and surprise, and flapper fringe swings in time with the dance. Even the suits had stripes with rhythm!',
    pieces: ['rhapsody', 'saints', 'entertainer'],
    items: {
      hats: [
        { id: 'cloche', name: 'Cloche hat', shape: 'cloche', role: 'main', sig: true },
        { id: 'headband', name: 'Feather headband', shape: 'band', role: 'accent' },
        { id: 'fedora', name: 'Fedora', shape: 'fedora', role: 'dark' },
      ],
      tops: [
        { id: 'beaded', name: 'Beaded top', shape: 'bodice', role: 'main', fabric: 'sequin', sig: true, p: { len: 38, v: 0, drop: 1 } },
        { id: 'pinjacket', name: 'Pinstripe jacket', shape: 'coat', role: 'dark', fabric: 'stripe', p: { len: 40, tails: 0, collar: 1 } },
        { id: 'dropwaist', name: 'Drop-waist top', shape: 'bodice', role: 'accent', p: { len: 40, v: 1, drop: 1 } },
      ],
      bottoms: [
        { id: 'fringe', name: 'Fringe flapper skirt', shape: 'skirt', role: 'main', fabric: 'sequin', sig: true, p: { flare: 1.3, len: 0.55, fringe: 1 } },
        { id: 'pinpants', name: 'Pinstripe trousers', shape: 'pants', role: 'dark', fabric: 'stripe' },
        { id: 'widelegs', name: 'Wide-leg trousers', shape: 'pants', role: 'accent', p: { wide: 1 } },
      ],
      shoes: [
        { id: 'tstrap', name: 'T-strap heels', shape: 'heel', role: 'main', sig: true, p: { strap: 1 } },
        { id: 'twotone', name: 'Two-tone oxfords', shape: 'oxford', role: 'dark' },
        { id: 'jspats', name: 'Spats', shape: 'oxford', role: 'light' },
      ],
      acc: [
        { id: 'pearls', name: 'Long pearls', shape: 'pearls', role: 'white', sig: true },
        { id: 'boa', name: 'Feather boa', shape: 'boa', role: 'accent' },
        { id: 'clutch', name: 'Sparkly clutch', shape: 'bag', role: 'trim' },
      ],
    },
  },
  {
    id: 'future', name: 'Koog Future', years: 'tomorrow', icon: '🚀', bg: ['#0b0630', '#3b1b8c'], glow: '#6ff7ff',
    fashion: 'neon, holographic',
    fact: 'Electronic music is made by synths, so the clothes glow like synth lights and shine like holograms.',
    pieces: ['pop-edm', 'pop-dance', 'pop-hyper', 'pop-lofi', 'pop-static', 'pop-funk', 'pop-boss', 'pop-spooky'],
    items: {
      hats: [
        { id: 'visor', name: 'Neon visor', shape: 'visor', role: 'accent', sig: true },
        { id: 'holocrown', name: 'Holo crown', shape: 'crown', fabric: 'holo', role: 'main' },
        { id: 'antenna', name: 'Antenna headband', shape: 'antenna', role: 'trim' },
      ],
      tops: [
        { id: 'holojacket', name: 'Holo jacket', shape: 'coat', fabric: 'holo', role: 'main', sig: true, p: { len: 38, tails: 0, collar: 1 } },
        { id: 'neonvest', name: 'Light-up vest', shape: 'vest', fabric: 'sequin', role: 'accent' },
        { id: 'hoodie', name: 'Cropped hoodie', shape: 'bodice', role: 'trim', p: { len: 26, v: 0, hood: 1 } },
      ],
      bottoms: [
        { id: 'leggings', name: 'Neon leggings', shape: 'pants', role: 'accent', fabric: 'sequin', sig: true, p: { slim: 1 } },
        { id: 'holoskirt', name: 'Holo skirt', shape: 'skirt', fabric: 'holo', role: 'main', p: { flare: 1.25, len: 0.6 } },
        { id: 'cargo', name: 'Cargo pants', shape: 'pants', role: 'dark', p: { wide: 1 } },
      ],
      shoes: [
        { id: 'sneaker', name: 'Neon sneakers', shape: 'sneaker', role: 'accent', sig: true },
        { id: 'hover', name: 'Hover boots', shape: 'hover', role: 'trim' },
        { id: 'platform', name: 'Platform boots', shape: 'platform', role: 'main' },
      ],
      acc: [
        { id: 'shades', name: 'Holo shades', shape: 'shades', role: 'trim', fabric: 'holo', sig: true },
        { id: 'orbs', name: 'Floating light orbs', shape: 'orbs', role: 'accent' },
        { id: 'techcape', name: 'Glow cape', shape: 'cape', fabric: 'holo', role: 'main' },
      ],
    },
  },
]
export const eraById = (id: string) => ERAS.find((e) => e.id === id) ?? ERAS[0]
/** option list for a category: index 0 is the plain starter, then the era's pieces. */
export const optionsOf = (era: Era, cat: Cat): Item[] => [PLAIN[cat], ...era.items[cat]]

// ---------------- models ----------------
export interface Model { name: string; skin: string; hair: string; style: string; body: number; eyes: string }
export const MODELS: Model[] = [
  { name: 'Ari', skin: '#f1c9a5', hair: '#6b3f1f', style: 'bob', body: 0, eyes: '#3b2a1e' },
  { name: 'Zuri', skin: '#7a4a2e', hair: '#1c120d', style: 'afro', body: 1, eyes: '#241510' },
  { name: 'Mei', skin: '#e8be94', hair: '#14100e', style: 'bun', body: 2, eyes: '#1d1410' },
  { name: 'Kofi', skin: '#4a2c1c', hair: '#120b08', style: 'buzz', body: 3, eyes: '#1a0f0a' },
  { name: 'Luz', skin: '#c68a5c', hair: '#3a1c10', style: 'long', body: 1, eyes: '#2a1a10' },
  { name: 'Noor', skin: '#a56b44', hair: '#c4a35a', style: 'wrap', body: 0, eyes: '#2a1a10' },
  { name: 'Sam', skin: '#ffd9bf', hair: '#d9602a', style: 'pixie', body: 2, eyes: '#2f5a7a' },
  { name: 'Priya', skin: '#8d5a3a', hair: '#1a0f0a', style: 'braids', body: 3, eyes: '#241510' },
]
export const BODIES = [
  { sw: 20, ww: 14, hw: 17 }, { sw: 22, ww: 18, hw: 23 }, { sw: 18, ww: 12, hw: 15 }, { sw: 25, ww: 21, hw: 24 },
]

// ---------------- colour <-> harmony ----------------
export type Quality = 'major' | 'minor' | '7' | 'maj7' | 'm7' | 'dim' | 'aug' | 'sus'
export interface Pal { root: number; q: Quality }
const FIFTH_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']
export const WHEEL_LABEL = (p: number) => FIFTH_NAMES[p % 12]
/** where a root sits on the circle of fifths: C=0, G=1, D=2 ... F=11 */
export const fifthPos = (root: number) => (pc(root) * 7) % 12
/** hue for a circle-of-fifths position: neighbours get neighbouring hues (analogous colours). */
export const hueOfPos = (p: number) => (55 + p * 30) % 360
export const isMoody = (q: Quality) => q === 'minor' || q === 'm7' || q === 'dim'
export interface Colors { main: string; accent: string; trim: string; dark: string; light: string; white: string; mood: string }

export function palColors(p: Pal): Colors {
  const h = hueOfPos(fifthPos(p.root))
  let s = 78, l = 56
  if (p.q === 'minor') { s = 44; l = 34 } else if (p.q === 'm7') { s = 46; l = 42 } else if (p.q === 'dim') { s = 22; l = 30 }
  else if (p.q === '7') { s = 88; l = 50 } else if (p.q === 'maj7') { s = 62; l = 72 } else if (p.q === 'sus') { s = 36; l = 62 } else if (p.q === 'aug') { s = 92; l = 62 }
  const hs = (hh: number, ss: number, ll: number) => `hsl(${(hh + 360) % 360} ${ss}% ${ll}%)`
  return {
    main: hs(h, s, l), accent: hs(h + 30, s, Math.min(78, l + 8)), trim: hs(h - 30, Math.min(95, s + 6), Math.min(80, l + 14)),
    dark: hs(h, Math.min(60, s), Math.max(14, l * 0.42)), light: hs(h, Math.min(70, s), Math.min(90, l + 34)), white: '#f7f1e6',
    mood: p.q === 'minor' || p.q === 'm7' ? 'moody' : p.q === 'dim' ? 'mysterious' : p.q === 'maj7' ? 'dreamy' : p.q === 'sus' ? 'airy' : 'bright',
  }
}

/** "C major", "A minor", "G7", "F maj7", "D minor 7", "E dim" ... -> Pal (or null). */
export function parseChord(name: string | null): Pal | null {
  if (!name) return null
  let root = -1, rest = ''
  const sorted = PC_NAMES.map((n, i) => ({ n, i })).sort((a, b) => b.n.length - a.n.length)
  for (const { n, i } of sorted) if (name.startsWith(n)) { root = i; rest = name.slice(n.length).trim(); break }
  if (root < 0) return null
  const q: Quality = rest === 'minor' ? 'minor' : rest === 'minor 7' || rest === 'm7' ? 'm7' : rest === '7' ? '7' : rest === 'maj7' ? 'maj7' : rest === 'dim' ? 'dim' : rest === 'aug' ? 'aug' : rest.startsWith('sus') ? 'sus' : 'major'
  return { root, q }
}
export const palName = (p: Pal) => PC_NAMES[p.root] + (p.q === 'major' ? ' major' : p.q === 'minor' ? ' minor' : p.q === 'm7' ? ' minor 7' : p.q === 'dim' ? ' dim' : p.q === 'aug' ? ' aug' : p.q === 'sus' ? ' sus' : p.q)
export const homePal = (k: Key): Pal => ({ root: k.tonic, q: k.scale === 'minor' ? 'minor' : 'major' })
/** steps apart on the circle of fifths (0..6) */
export const fifthDist = (a: number, b: number) => { const d = Math.abs(fifthPos(a) - fifthPos(b)); return Math.min(d, 12 - d) }
export const palMatch = (p: Pal, key: Key) => [1, 0.92, 0.78, 0.64, 0.55, 0.5, 0.5][fifthDist(p.root, key.tonic)]

/** the wheel caption: names the neighbours and why they match */
export function wheelCaption(p: Pal): string {
  const pos = fifthPos(p.root)
  const left = WHEEL_LABEL((pos + 11) % 12), right = WHEEL_LABEL((pos + 1) % 12)
  const me = palName(p)
  return `${me} sits between ${left} and ${right} on the circle of fifths. Chords that sit next to each other sound good together, just like colours next to each other on the colour wheel.`
}

// ---------------- pieces ----------------
export interface Piece { id: string; title: string; song: Song }
export function piecesFor(era: Era): Piece[] {
  const out: Piece[] = []
  const seen = new Set<string>()
  for (const id of era.pieces) {
    const s = SONGS.find((x) => x.id === id)
    if (s && !seen.has(id) && s.notes.some((n) => n.note != null)) { seen.add(id); out.push({ id, title: s.title, song: s }) }
    if (out.length >= 4 && era.id !== 'future') break
  }
  if (!out.length) for (const id of ['ode', 'minuet', 'twinkle', 'entertainer']) {
    const s = SONGS.find((x) => x.id === id)
    if (s) out.push({ id, title: s.title, song: s })
  }
  return out
}

export interface RunNote { note: number | null; beats: number }
/** the runway part of a song: the first ~24 sounding notes, ended on a phrase break */
export function runwayNotes(song: Song, maxNotes = 24): RunNote[] {
  const out: RunNote[] = []
  let count = 0
  for (const n of song.notes) {
    out.push({ note: n.note, beats: n.beats })
    if (n.note != null) count++
    if (count >= maxNotes) {
      if (n.beats >= 1.5 || out.length >= song.notes.length) break
      if (count >= maxNotes + 6) break
    }
  }
  while (out.length && out[out.length - 1].note == null) out.pop()
  return out
}

// ---------------- scoring + judges ----------------
export interface RunStats {
  total: number; hits: number; wrong: number
  rhythmOn: number; rhythmN: number
  inKey: number; allNotes: number
  homeFinish: boolean
  booms: number; fizzles: number; cadences: number; motifs: number
}
export const newStats = (total: number): RunStats => ({ total, hits: 0, wrong: 0, rhythmOn: 0, rhythmN: 0, inKey: 0, allNotes: 0, homeFinish: false, booms: 0, fizzles: 0, cadences: 0, motifs: 0 })

export interface Look { era: string; items: number[]; pal: Pal; model: number; piece: string }
export function eraScore(l: Look): number {
  const era = eraById(l.era)
  let filled = 0, sigs = 0
  CATS.forEach((c, i) => { const idx = l.items[i]; if (idx > 0) { filled++; if (era.items[c][idx - 1]?.sig) sigs++ } })
  return 0.3 + 0.5 * (filled / 5) + 0.2 * (sigs / 5)
}
export interface Scores { style: number; rhythm: number; harmony: number; era: number; pal: number }
export function computeScores(l: Look, st: RunStats, key: Key): Scores {
  const era = eraScore(l)
  const pal = palMatch(l.pal, key)
  const style = Math.min(1, 0.55 * era + 0.45 * pal + Math.min(0.1, st.cadences * 0.04 + st.motifs * 0.03))
  const rhythm = st.rhythmN > 0 ? st.rhythmOn / st.rhythmN : 0.6
  const harmony = st.allNotes > 0 ? st.inKey / st.allNotes : 0.6
  return { style, rhythm, harmony, era, pal }
}
export const starsOf = (s: number) => Math.max(2, Math.min(5, Math.round(1 + s * 4.2)))

export interface JudgeSay { who: 'STYLE' | 'RHYTHM' | 'HARMONY'; name: string; stars: number; say: string; tip: string }
/** Kind, specific compliments and one gentle tip each. Never about bodies, only about choices. */
export function judgeSay(l: Look, st: RunStats, key: Key, sc: Scores): JudgeSay[] {
  const era = eraById(l.era)
  const c = palColors(l.pal)
  const sigItem = CATS.map((cat, i) => (l.items[i] > 0 && era.items[cat][l.items[i] - 1]?.sig ? era.items[cat][l.items[i] - 1] : null)).find(Boolean)
  const blank = CATS.findIndex((_, i) => l.items[i] === 0)
  // STYLE
  const eraLine = sigItem ? `${sigItem.name} says ${era.name} loud and clear!` : `Nice mix of ${era.name} pieces!`
  const palLine = c.mood === 'moody' ? 'Love that minor-key palette, so moody and deep!' : c.mood === 'dreamy' ? 'Those dreamy pastel colours float like a maj7 chord!' : c.mood === 'bright' ? 'Those bright major colours are pure sunshine!' : `That ${c.mood} palette is a bold choice!`
  const styleTip = sc.pal < 0.8 ? `Try colours from ${PC_NAMES[key.tonic]}, the home chord, or its neighbours on the wheel to match the music.`
    : blank >= 0 ? `Try adding a ${CAT_INFO[CATS[blank]].label.toLowerCase().replace(/s$/, '')} piece to complete the ${era.name} look!` : 'Try the other era pieces next time for a brand new look!'
  const styleSay = sc.pal >= 0.9 ? `${eraLine} ${palLine} And your colours match the song's home key.` : `${eraLine} ${palLine}`
  // RHYTHM
  const rhy = sc.rhythm
  const rSay = rhy >= 0.8 ? 'Steady as a metronome! Your model landed every step right on the beat.' : rhy >= 0.55 ? 'A lovely, confident strut. Most steps landed right on the beat!' : st.hits >= 4 ? 'You kept going and finished the whole walk. That takes real nerve!' : 'You stepped out onto the runway. Brave start!'
  const rTip = rhy >= 0.8 ? 'Try a faster piece next for an even bigger challenge!' : 'Try counting 1-2-3-4 out loud and step on each number.'
  // HARMONY
  const hm = sc.harmony
  const hSay = hm >= 0.92 ? 'Every note belonged to the key. So smooth and clean!' : hm >= 0.7 ? 'Almost every note fit the key. Great ear!' : 'You found lots of notes that fit the key, and you kept playing. Nice recovery!'
  const hTip = st.homeFinish ? 'That last note landed on the home key, a perfect finish pose!' : 'Try landing the last note on the home key for a big finish pose!'
  return [
    { who: 'STYLE', name: 'Ms. Sparkle', stars: starsOf(sc.style), say: styleSay, tip: styleTip },
    { who: 'RHYTHM', name: 'Mr. Tempo', stars: starsOf(sc.rhythm), say: rSay, tip: rTip },
    { who: 'HARMONY', name: 'Dr. Harmony', stars: starsOf(sc.harmony), say: hSay, tip: hTip },
  ]
}

// ---------------- save ----------------
export interface SavedLook extends Look { id: number; stars: number; t: number }
export interface Save { v: 1; unlocked: string[]; looks: SavedLook[]; best: Record<string, number>; model: number }
const DEF: Save = { v: 1, unlocked: ['baroque'], looks: [], best: {}, model: 0 }
export function loadSave(): Save {
  const s = pload<Partial<Save>>('fashion', {})
  const unlocked = Array.isArray(s.unlocked) && s.unlocked.length ? s.unlocked.filter((x) => ERAS.some((e) => e.id === x)) : DEF.unlocked
  return { v: 1, unlocked: unlocked.includes('baroque') ? unlocked : ['baroque', ...unlocked], looks: Array.isArray(s.looks) ? s.looks.slice(0, 24) : [], best: s.best && typeof s.best === 'object' ? s.best : {}, model: typeof s.model === 'number' ? s.model % MODELS.length : 0 }
}
export const saveSave = (s: Save) => psave('fashion', s)
export const MAX_LOOKS = 24
