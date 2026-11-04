// Mimic "in the style of" players: jazz and modern musicians. DATA ONLY (types are imported as types, so there is no import cycle with src/music/styles.ts,
// which spreads PEOPLE_STYLES into STYLES, PEOPLE_QUAL into QUAL and PEOPLE_DET into its trait detectors).
//
// COPYRIGHT RULE: a person's name labels a STYLE: their habits (mode, space, rhythm feel, register, timbre, favourite moves). We never store, quote or
// re-create anyone's recorded solos or post-1930 melodies. Every phrase is generated from rules and original; styles.ts also re-rolls any phrase that
// matches a melody in the songs library. All of them are kind 'style', so there is no "real phrase" quoting for these.
import type { Chord, PlayedNote, StyleDef } from '../../music/styles'

const ch = (root: number, q: string): Chord => ({ root, q })
const mod = (n: number, m: number) => ((n % m) + m) % m

/** extra chord qualities: 'mk' = a crunchy scale with neighbouring notes a half step and a whole step apart (lots of seconds) */
export const PEOPLE_QUAL: Record<string, { tones: number[]; scale: number[] }> = {
  mk: { tones: [0, 4, 7, 10], scale: [0, 1, 2, 4, 6, 7, 9, 10] },
}

const ICON: Record<string, string> = {
  miles: 'M3 16 H8 M11 16 H13 M16 9 H21 M3 20 H21 M12 4 V9', // long tones, space, one high note
  coltrane: 'M3 19 L5 14 L7 17 L9 11 L11 15 L13 8 L15 12 L17 5 L19 10 L21 3', // climbing runs
  monk: 'M4 18 L8 6 L10 17 L14 5 L16 18 M18 8 L20 8', // angular leaps
  ellington: 'M4 20 V8 M8 20 V6 M12 20 V10 M16 20 V6 M20 20 V8 M4 8 H20', // big block chords
  armstrong: 'M3 17 C6 6 9 6 11 12 C13 18 16 4 21 7', // high bending line
  ella: 'M3 14 C5 6 7 6 9 14 S13 22 15 14 S19 6 21 12', // bouncing scat
  hancock: 'M4 20 V12 M9 20 V7 M14 20 V15 M19 20 V9 M4 12 L9 7 L14 15 L19 9', // jazz-funk stabs
  brubeck: 'M3 8 H5 M7 8 H9 M11 8 H13 M3 14 H5 M7 14 H9 M3 20 H5 M7 20 H9 M11 20 H13 M15 20 H17 M19 20 H21', // groups of 3 + 2
  stevie: 'M3 18 L6 8 L9 18 L12 8 L15 18 L18 8 L21 18', // clavinet zig-zag
  basie: 'M4 18 H6 M10 12 H12 M16 18 H18 M20 8 H21', // a few well-placed notes
}

export type StyleGroup = 'classical' | 'jazz' | 'pop'
export const GROUP_LABEL: Record<StyleGroup, string> = { classical: 'Classical', jazz: 'Jazz', pop: 'Pop & more' }
/** which picker group each style is in (styles.ts ids + the new ones) */
export const STYLE_GROUPS: Record<string, StyleGroup> = {
  bach: 'classical', mozart: 'classical', chopin: 'classical', debussy: 'classical', satie: 'classical', joplin: 'classical',
  gershwin: 'jazz', cooljazz: 'jazz', bebop: 'jazz', blues: 'jazz', boogie: 'jazz', bossa: 'jazz',
  miles: 'jazz', coltrane: 'jazz', monk: 'jazz', ellington: 'jazz', armstrong: 'jazz', ella: 'jazz', basie: 'jazz', brubeck: 'jazz', hancock: 'jazz',
  funk: 'pop', minimal: 'pop', synthpop: 'pop', gospel: 'pop', stevie: 'pop',
}
export const groupOf = (id: string): StyleGroup => STYLE_GROUPS[id] ?? 'pop'

const NONE = { grace: 0, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }

export const PEOPLE_STYLES: StyleDef[] = [
  {
    id: 'miles', name: 'Miles Davis (cool & modal)', emoji: '🎺', icon: ICON.miles, kind: 'style', era: '1950s-60s', mode: 'dorian', bpm: 84, bpb: 4,
    blurb: 'Miles left lots of space: fewer notes, long tones, a soft muted-trumpet sound and one mode (Dorian). Cool means playing less.',
    prog: [ch(0, 'm7'), ch(0, 'm7'), ch(0, 'm7'), ch(0, 'm7'), ch(0, 'm7'), ch(0, 'm7'), ch(0, 'm7'), ch(1, 'm7')],
    feel: { swingUnit: 0.5, swing: 1.7, sync: 0.12, density: 0.6, rest: 0.7, grid: 0.5, legato: 1.0, durs: [[1, 0.35], [2, 0.4], [3, 0.25]] },
    lens: [[6, 0.4], [8, 0.6]], devs: [['fragment', 0.4], ['repeat', 0.3], ['sequence', 0.2], ['invert', 0.1]], range: [60, 84], ctSnap: 0.5,
    orn: { ...NONE, grace: 0.12 }, blues: [], dyn: 'swell', vel: [42, 70], rubato: 0, cadence: 'balanced',
    patch: { wave: 'sawtooth', wave2: 'square', detune: 3, cutoff: 1250, res: 7, fenv: 450, a: 0.035, d: 0.25, s: 0.75, r: 0.4, level: 0.5, vib: { rate: 4.2, depth: 11, delay: 0.5 } },
    comp: 'sparse',
    traits: [
      { id: 'dorian', label: 'Dorian mode', hint: 'Use the flat 3rd and flat 7th of your home note (a minor-ish, open sound).' },
      { id: 'space', label: 'Leave space', hint: 'Rest between phrases. Silence is cool.' },
      { id: 'longNotes', label: 'Long, soft notes', hint: 'Hold a few notes for a second or more.' }],
  },
  {
    id: 'coltrane', name: 'John Coltrane (fast scale runs)', emoji: '🎷', icon: ICON.coltrane, kind: 'style', era: '1950s-60s', mode: 'major', bpm: 132, bpb: 4,
    blurb: 'Coltrane packed fast streams of scale notes into every beat ("sheets of sound") while the chords jumped a major third at a time.',
    prog: [ch(0, 'M7'), ch(8, 'd7'), ch(8, 'M7'), ch(4, 'd7'), ch(4, 'M7'), ch(0, 'd7')],
    feel: { swingUnit: 0.25, swing: 1.1, sync: 0.05, density: 4, rest: 0.03, grid: 0.25, legato: 0.92, durs: [[0.25, 0.75], [0.5, 0.2], [1, 0.05]] },
    lens: [[4, 0.4], [8, 0.6]], devs: [['sequence', 0.55], ['invert', 0.15], ['retro', 0.15], ['repeat', 0.15]], range: [52, 91], ctSnap: 0.55,
    orn: { ...NONE, approach: 0.25 }, blues: [], dyn: 'accent', vel: [60, 90], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'square', detune: 9, cutoff: 2300, res: 2.5, fenv: 1700, a: 0.012, d: 0.15, s: 0.65, r: 0.12, level: 0.5, vib: { rate: 5.6, depth: 20, delay: 0.3 } },
    comp: 'walk',
    traits: [
      { id: 'run', label: 'Scale run', hint: 'Play 5 or more notes in a row stepping up or down.' },
      { id: 'fast', label: 'Sheets of sound', hint: 'Keep 5 or more very quick notes going.' },
      { id: 'repeat', label: 'Move the pattern', hint: 'Play a little pattern, then again starting on another note.' }],
  },
  {
    id: 'monk', name: 'Thelonious Monk (angular & crunchy)', emoji: '🎹', icon: ICON.monk, kind: 'style', era: '1940s-60s', mode: 'major', bpm: 108, bpb: 4,
    blurb: 'Monk played short, jumpy notes with surprising gaps and crunchy neighbour notes a half step apart. Wrong-sounding on purpose, then it clicks.',
    prog: [ch(0, 'mk'), ch(0, 'wt'), ch(5, 'mk'), ch(0, 'wt')],
    feel: { swingUnit: 0.5, swing: 1.5, sync: 0.4, density: 1.4, rest: 0.4, grid: 0.5, legato: 0.45, durs: [[0.5, 0.45], [1, 0.35], [1.5, 0.2]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['repeat', 0.4], ['fragment', 0.3], ['invert', 0.2], ['sequence', 0.1]], range: [50, 86], ctSnap: 0.3,
    orn: { ...NONE, grace: 0.55 }, blues: [], dyn: 'accent', vel: [56, 96], rubato: 0,
    patch: { wave: 'triangle', wave2: 'square', detune: 5, cutoff: 3400, res: 0.8, fenv: 2600, a: 0.002, d: 0.4, s: 0.05, r: 0.14, level: 0.5 },
    comp: 'sparse',
    traits: [
      { id: 'crunch', label: 'Crunchy seconds', hint: 'Play two neighbour keys right next to each other, close together in time.' },
      { id: 'leaps', label: 'Angular jumps', hint: 'Jump by big steps (a fourth or more) a couple of times.' },
      { id: 'space', label: 'Surprising gaps', hint: 'Stop for a moment, then come back in.' }],
  },
  {
    id: 'ellington', name: 'Duke Ellington (swing & big chords)', emoji: '🎩', icon: ICON.ellington, kind: 'style', era: '1930s-50s', mode: 'major', bpm: 120, bpb: 4,
    blurb: 'Ellington led a big band: a strong swing, rich stacked chords and a tune that rides on top of the horns.',
    prog: [ch(0, 'M7'), ch(5, 'M7'), ch(0, 'M7'), ch(7, 'd7'), ch(9, 'm7'), ch(2, 'm7'), ch(7, 'd7'), ch(0, 'M7')],
    feel: { swingUnit: 0.5, swing: 1.9, sync: 0.25, density: 1.7, rest: 0.12, grid: 0.5, legato: 0.88, durs: [[0.5, 0.4], [1, 0.35], [2, 0.15], [1.5, 0.1]] },
    lens: [[4, 0.4], [8, 0.6]], devs: [['sequence', 0.35], ['repeat', 0.3], ['fragment', 0.2], ['invert', 0.15]], range: [55, 88], ctSnap: 0.6,
    orn: { ...NONE, grace: 0.15, blue: 0.12 }, blues: [3, 10], dyn: 'arch', vel: [58, 88], rubato: 0, cadence: 'tonic',
    patch: { wave: 'sawtooth', wave2: 'square', detune: 12, cutoff: 2700, res: 1, fenv: 1200, a: 0.02, d: 0.3, s: 0.6, r: 0.2, level: 0.45, vib: { rate: 5, depth: 14, delay: 0.3 } },
    comp: 'gospel',
    traits: [
      { id: 'swing', label: 'Swing the eighths', hint: 'Play long-short, long-short.' },
      { id: 'chords', label: 'Big chords', hint: 'Press 3 notes at once, twice.' },
      { id: 'steady', label: 'Steady groove', hint: 'Keep your timing even, like a band leader.' }],
  },
  {
    id: 'armstrong', name: 'Louis Armstrong (hot trumpet)', emoji: '🎺', icon: ICON.armstrong, kind: 'style', era: '1920s-60s', mode: 'major', bpm: 108, bpb: 4,
    blurb: 'Armstrong played bright, singing trumpet lines: bending blue notes, high held notes and a happy, hot swing.',
    prog: [ch(0, 'M'), ch(0, 'M'), ch(5, 'M'), ch(0, 'M'), ch(7, 'd7'), ch(7, 'd7'), ch(0, 'M'), ch(0, 'M')],
    feel: { swingUnit: 0.5, swing: 1.8, sync: 0.3, density: 1.5, rest: 0.18, grid: 0.5, legato: 0.92, durs: [[0.5, 0.35], [1, 0.3], [2, 0.2], [1.5, 0.15]] },
    lens: [[4, 0.4], [8, 0.6]], devs: [['repeat', 0.35], ['sequence', 0.3], ['fragment', 0.2], ['invert', 0.15]], range: [58, 88], ctSnap: 0.55,
    orn: { ...NONE, grace: 0.2, blue: 0.5 }, blues: [3, 10], dyn: 'swell', vel: [64, 96], rubato: 0, cadence: 'tonic',
    patch: { wave: 'square', wave2: 'sawtooth', detune: 5, cutoff: 3600, res: 2, fenv: 2200, a: 0.03, d: 0.12, s: 0.75, r: 0.2, level: 0.42, vib: { rate: 5.8, depth: 28, delay: 0.2 } },
    comp: 'oompah',
    traits: [
      { id: 'blue', label: 'Blue notes', hint: 'Use the flat 3rd or flat 7th of your home note.' },
      { id: 'longNotes', label: 'A high held note', hint: 'Hold one note and let it sing.' },
      { id: 'swing', label: 'Hot swing', hint: 'Play bouncy long-short pairs.' }],
  },
  {
    id: 'ella', name: 'Ella Fitzgerald (scat bounce)', emoji: '🎤', icon: ICON.ella, kind: 'style', era: '1930s-60s', mode: 'major', bpm: 128, bpb: 4,
    blurb: 'Ella sang scat: bouncy made-up syllables that skip up and down a tune. Here a voice-like sound hops around the chords.',
    prog: [ch(0, 'M7'), ch(9, 'm7'), ch(2, 'm7'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1.8, sync: 0.35, density: 2.6, rest: 0.1, grid: 0.25, legato: 0.6, durs: [[0.5, 0.45], [0.25, 0.3], [1, 0.2], [1.5, 0.05]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['sequence', 0.35], ['invert', 0.25], ['repeat', 0.25], ['retro', 0.15]], range: [57, 88], ctSnap: 0.5,
    orn: { ...NONE, grace: 0.3, approach: 0.15 }, blues: [], dyn: 'accent', vel: [58, 90], rubato: 0, cadence: 'tonic',
    patch: { wave: 'sawtooth', wave2: 'triangle', detune: 4, cutoff: 1550, res: 4.5, fenv: 1400, a: 0.03, d: 0.15, s: 0.7, r: 0.18, level: 0.5, vib: { rate: 5.5, depth: 20, delay: 0.15 } },
    comp: 'walk',
    traits: [
      { id: 'scat', label: 'Scat bounce', hint: 'Play quick notes that hop up and down.' },
      { id: 'swing', label: 'Swing', hint: 'Play long-short pairs.' },
      { id: 'ornament', label: 'A little flourish', hint: 'Add a very quick extra note before a beat.' }],
  },
  {
    id: 'basie', name: 'Count Basie (a few notes, big swing)', emoji: '🥁', icon: ICON.basie, kind: 'style', era: '1930s-50s', mode: 'major', bpm: 138, bpb: 4,
    blurb: 'Basie showed that less is more: just a few well-placed piano plinks, with the swing doing the talking.',
    prog: [ch(0, 'd7'), ch(0, 'd7'), ch(5, 'd7'), ch(0, 'd7'), ch(7, 'd7'), ch(5, 'd7'), ch(0, 'd7'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 2, sync: 0.35, density: 0.8, rest: 0.55, grid: 0.5, legato: 0.5, durs: [[0.5, 0.4], [1, 0.45], [2, 0.15]] },
    lens: [[4, 0.7], [8, 0.3]], devs: [['repeat', 0.4], ['fragment', 0.35], ['sequence', 0.25]], range: [58, 88], ctSnap: 0.5,
    orn: { ...NONE, grace: 0.25, blue: 0.3 }, blues: [3], dyn: 'accent', vel: [54, 90], rubato: 0, cadence: 'tonic',
    patch: { wave: 'triangle', wave2: 'sine', detune: 3, cutoff: 4000, res: 0.6, fenv: 2200, a: 0.002, d: 0.3, s: 0.05, r: 0.2, level: 0.5 },
    comp: 'walk',
    traits: [
      { id: 'space', label: 'Plenty of space', hint: 'Play a few notes and let the quiet swing.' },
      { id: 'swing', label: 'Big swing', hint: 'Play long-short pairs.' },
      { id: 'blue', label: 'A blue note', hint: 'Slip in the flat 3rd or flat 7th.' }],
  },
  {
    id: 'brubeck', name: 'Dave Brubeck (jazz in 5/4)', emoji: '🖐️', icon: ICON.brubeck, kind: 'style', era: '1950s-60s', mode: 'minor', bpm: 152, bpb: 5,
    blurb: 'Brubeck loved odd time. Five beats in a bar, felt as 1-2-3 then 1-2, with a lilting minor tune on top.',
    prog: [ch(0, 'm'), ch(0, 'm'), ch(0, 'm'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1.4, sync: 0.2, density: 1.5, rest: 0.18, grid: 0.5, legato: 0.88, durs: [[0.5, 0.3], [1, 0.4], [1.5, 0.2], [2, 0.1]] },
    lens: [[5, 0.5], [10, 0.5]], devs: [['repeat', 0.35], ['sequence', 0.35], ['fragment', 0.2], ['invert', 0.1]], range: [55, 86], ctSnap: 0.55,
    orn: { ...NONE, grace: 0.1 }, blues: [], dyn: 'arch', vel: [56, 84], rubato: 0, cadence: 'tonic',
    patch: { wave: 'triangle', wave2: 'sawtooth', detune: 6, cutoff: 3000, res: 1.2, fenv: 1600, a: 0.01, d: 0.4, s: 0.3, r: 0.22, level: 0.5, vib: { rate: 5, depth: 12, delay: 0.4 } },
    comp: 'five',
    traits: [
      { id: 'five', label: 'Count to five', hint: 'Play a group of 5 even notes (1-2-3-4-5), pause, and do it again.' },
      { id: 'repeat', label: 'Repeat the lilt', hint: 'Play a small pattern twice.' },
      { id: 'space', label: 'Breathe between phrases', hint: 'Leave a gap before the next one.' }],
  },
  {
    id: 'hancock', name: 'Herbie Hancock (jazz-funk)', emoji: '🎛️', icon: ICON.hancock, kind: 'style', era: '1960s-70s', mode: 'dorian', bpm: 104, bpb: 4,
    blurb: 'Hancock mixed jazz harmony with funk grooves: electric-piano stabs, off-beat jumps and open, floating chords.',
    prog: [ch(0, 'm7'), ch(0, 'm7'), ch(5, 'm7'), ch(5, 'd9'), ch(0, 'm7'), ch(0, 'm7'), ch(3, 'M7'), ch(7, 'm7')],
    feel: { swingUnit: 0.25, swing: 1.2, sync: 0.5, density: 2.4, rest: 0.3, grid: 0.25, legato: 0.6, durs: [[0.25, 0.45], [0.5, 0.3], [1, 0.2], [0.75, 0.05]] },
    lens: [[4, 0.6], [8, 0.4]], devs: [['repeat', 0.4], ['sequence', 0.3], ['fragment', 0.3]], range: [50, 86], ctSnap: 0.45,
    orn: { ...NONE, grace: 0.1, approach: 0.1 }, blues: [], dyn: 'accent', vel: [54, 92], rubato: 0,
    patch: { wave: 'sine', wave2: 'triangle', detune: 3, cutoff: 5000, res: 0.6, fenv: 2000, a: 0.004, d: 0.6, s: 0.15, r: 0.25, level: 0.5, fm: { ratio: 1, index: 2.2, decay: 0.6 } },
    comp: 'funk',
    traits: [
      { id: 'dorian', label: 'Dorian color', hint: 'Use the flat 3rd and flat 7th of your home note.' },
      { id: 'sync', label: 'Off-beat stabs', hint: 'Play short notes that land between the beats.' },
      { id: 'repeat', label: 'Lock a groove', hint: 'Repeat a short pattern.' }],
  },
  {
    id: 'stevie', name: 'Stevie Wonder (clavinet funk)', emoji: '🕶️', icon: ICON.stevie, kind: 'style', era: '1970s', mode: 'dorian', bpm: 108, bpb: 4,
    blurb: 'Stevie Wonder built grooves on a buzzy clavinet: tight 16th-note riffs with a singable hook on top.',
    prog: [ch(0, 'm7'), ch(5, 'd9'), ch(0, 'm7'), ch(3, 'M7')],
    feel: { swingUnit: 0.25, swing: 1.1, sync: 0.6, density: 3, rest: 0.3, grid: 0.25, legato: 0.4, durs: [[0.25, 0.6], [0.5, 0.3], [0.75, 0.1]] },
    lens: [[4, 0.7], [8, 0.3]], devs: [['repeat', 0.55], ['fragment', 0.25], ['sequence', 0.2]], range: [48, 84], ctSnap: 0.5,
    orn: { ...NONE, grace: 0.15, approach: 0.08 }, blues: [], dyn: 'accent', vel: [58, 96], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'square', detune: 4, cutoff: 2600, res: 7, fenv: 4000, a: 0.001, d: 0.1, s: 0.05, r: 0.05, level: 0.4 },
    comp: 'funk',
    traits: [
      { id: 'sync', label: 'Syncopated 16ths', hint: 'Play short notes between the beats.' },
      { id: 'repeat', label: 'Riff it', hint: 'Lock a short pattern and repeat it.' },
      { id: 'space', label: 'Short and punchy', hint: 'Play short notes with gaps (staccato).' }],
  },
]

/** extra trait detectors (merged into the ones in styles.ts) */
const iois = (s: PlayedNote[]) => s.slice(1).map((n, i) => n.t - s[i].t).filter((x) => x > 0.03)
export const PEOPLE_DET: Record<string, (s: PlayedNote[], home: number) => boolean> = {
  // two neighbour notes (a half step or a whole step) struck almost together, or a half step right after another quickly, at least twice
  crunch: (s) => { let c = 0; for (let i = 1; i < s.length; i++) { const d = Math.abs(s[i].note - s[i - 1].note), dt = s[i].t - s[i - 1].t; if ((d === 1 || d === 2) && dt <= 0.12) c++ } return c >= 1 },
  leaps: (s) => { let c = 0; for (let i = 1; i < s.length; i++) if (Math.abs(s[i].note - s[i - 1].note) >= 5) c++; return c >= 2 },
  // a group of 5 (or 10) quick, fairly even notes with a gap before and after
  five: (s) => {
    const groups: PlayedNote[][] = []; let cur: PlayedNote[] = []
    for (let i = 0; i < s.length; i++) { if (i > 0 && s[i].t - s[i - 1].t > 0.65) { groups.push(cur); cur = [] } cur.push(s[i]) }
    if (cur.length) groups.push(cur)
    return groups.some((g) => g.length === 5 || g.length === 10)
  },
  // quick notes that change direction several times (hopping)
  scat: (s) => { const x = iois(s); if (x.length < 5 || x.filter((v) => v <= 0.4).length < 5) return false; let turns = 0, dir = 0; for (let i = 1; i < s.length; i++) { const d = Math.sign(s[i].note - s[i - 1].note); if (d && dir && d !== dir) turns++; if (d) dir = d } return turns >= 3 },
}
void mod
