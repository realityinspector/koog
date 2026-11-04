// The Koog activity catalog: every song, challenge, game, level, beat, synth, visual and helper a grown-up
// (or an AI helping one) can point a kid at, each with the concepts it teaches and a canonical link.
// PURE DATA + tiny helpers: no browser APIs, no imports except links.ts and the generated JSON, so Node runs it as is.
//
// The raw id inventory (src/links/catalog.data.json) is generated from the app source by
// scripts/build-catalog.ts (`npm run check:catalog` fails when the ids drift). The teaching metadata
// (concepts, ages, minutes, level, kid-friendly wording) is curated below.
import { toUrl, parseHash, SONG_MODES, type KoogState } from './links.ts'
import data from './catalog.data.json' with { type: 'json' }

export const CONCEPT_IDS = [
  'notes', 'keys-scales', 'chords', 'rhythm-pulse', 'phrases-cadences', 'motifs-form', 'tension-release',
  'mood-emotion', 'reading-music', 'memorizing', 'dynamics', 'style-history', 'ear-training',
] as const
export type ConceptId = (typeof CONCEPT_IDS)[number]
export const KINDS = ['song', 'challenge', 'game', 'level', 'beat', 'synth', 'visual', 'helper', 'play'] as const
export type Kind = (typeof KINDS)[number]

export interface Activity {
  id: string
  kind: Kind
  title: string
  /** one kid-friendly line */
  blurb: string
  concepts: ConceptId[]
  /** [min, max] age in years */
  ages: [number, number]
  /** a sensible length of one go, in minutes */
  minutes: number
  /** 1 (first day) to 5 (a real stretch) */
  level: 1 | 2 | 3 | 4 | 5
  /** false for everything: the computer keyboard works */
  needsKeyboard: false
  /** canonical Koog link, built with toUrl() */
  link: string
  /** facts such as composer, year, key, bpm */
  meta?: Record<string, string | number>
  /** one honest caveat for the grown-up */
  note?: string
}

export interface Concept {
  id: ConceptId
  title: string
  /** what a parent should know */
  parent: string
  /** what to say to a kid */
  kid: string
  /** a link that shows the idea */
  link: string
  /** activity ids that teach it best */
  examples: string[]
}

type Row = Record<string, string | number | boolean | undefined>
const D = data as unknown as {
  songs: Row[]; challenges: Row[]; games: Row[]; levels: Row[]; beats: Row[]; emulators: Row[]
  visuals: Row[]; palettes: Row[]; sounds: Row[]; helpers: string[]
}
const s = (v: unknown) => String(v)
const lv = (n: number): Activity['level'] => Math.max(1, Math.min(5, Math.round(n))) as Activity['level']
const U = (st: KoogState) => toUrl(st)

// ---------- curated teaching metadata (keyed by source id; `validateCatalog` fails on stale keys) ----------

const CHALLENGE_CONCEPTS: Record<string, ConceptId[]> = {
  climb: ['keys-scales', 'notes'], stay: ['keys-scales'], echo: ['memorizing', 'ear-training'], chords: ['chords', 'notes'],
  speed: ['keys-scales', 'rhythm-pulse'], detective: ['notes', 'reading-music'], interval: ['ear-training', 'notes'],
  rhythm: ['rhythm-pulse'], black: ['keys-scales', 'mood-emotion'], mirror: ['notes', 'keys-scales'], dynamics: ['dynamics'],
  majmin: ['ear-training', 'chords', 'mood-emotion'], gliss: ['notes'], boss: ['notes', 'keys-scales', 'rhythm-pulse'], daily: ['notes', 'keys-scales'],
}
const GAME_META: Record<string, { concepts: ConceptId[]; age: number; level: number }> = {
  zombies: { concepts: ['notes', 'reading-music'], age: 5, level: 2 },
  jiujitsu: { concepts: ['rhythm-pulse', 'ear-training', 'phrases-cadences'], age: 7, level: 3 },
  fashion: { concepts: ['style-history', 'chords'], age: 7, level: 3 },
  memory: { concepts: ['memorizing', 'ear-training', 'phrases-cadences'], age: 6, level: 2 },
  feast: { concepts: ['memorizing', 'notes', 'phrases-cadences'], age: 6, level: 2 },
  tree: { concepts: ['memorizing', 'notes', 'phrases-cadences'], age: 6, level: 2 },
  bachdoom: { concepts: ['memorizing', 'phrases-cadences', 'rhythm-pulse'], age: 8, level: 4 },
}
const EMU_META: Record<string, { concepts: ConceptId[]; blurb: string }> = {
  airhands: { concepts: ['style-history', 'ear-training'], blurb: 'Play an instrument you never touch: slide your pointer through the air to bend the pitch.' },
  ribbon: { concepts: ['style-history'], blurb: 'A voice-like electronic instrument played by sliding a ring or ribbon.' },
  wheelhouse: { concepts: ['style-history'], blurb: 'A pipeless drawbar organ: slide the drawbars to mix the sound like a recipe.' },
  tapechoir: { concepts: ['style-history'], blurb: 'A tape-style keyboard where one machine sounds like strings, flutes or a choir.' },
  ladder: { concepts: ['style-history'], blurb: 'A classic analog-style synth: oscillator, filter and envelope, wired together.' },
  patchbay: { concepts: ['style-history'], blurb: 'A semi-modular synth with sliders you can rewire, great for finding out how sound is built.' },
  squelch: { concepts: ['rhythm-pulse', 'style-history'], blurb: 'A step-sequenced bass box with a squelchy filter, the sound behind acid dance music.' },
  five: { concepts: ['style-history', 'chords'], blurb: 'A five-voice synth that plays chords and remembers its sounds.' },
  shimmer: { concepts: ['style-history', 'chords'], blurb: 'Easy and lush: one knob for each job and a shimmery chorus.' },
  bellfm: { concepts: ['style-history'], blurb: 'Digital FM sound: glassy electric pianos and bells.' },
}
const HELPERS: Record<string, { title: string; blurb: string; concepts: ConceptId[]; level: number; age: number }> = {
  mentor: { title: 'Mentor (a robot audience)', blurb: 'A friendly synth robot names what you just played: motif, cadence, and more.', concepts: ['motifs-form', 'phrases-cadences', 'tension-release'], level: 1, age: 5 },
  vibes: { title: 'Vibes (chords become a face)', blurb: 'Play a chord and a face shows the mood: A minor looks sad, C major looks happy.', concepts: ['mood-emotion', 'chords'], level: 1, age: 5 },
  mimic: { title: 'Mimic (answer in a style)', blurb: 'Play a phrase and Koog answers it in Baroque, ragtime, blues and more.', concepts: ['style-history', 'phrases-cadences'], level: 2, age: 7 },
  band: { title: 'Smart Band (it plays along)', blurb: 'Play a melody and a band guesses the chords and plays pad, bass and drums with you.', concepts: ['chords', 'rhythm-pulse'], level: 2, age: 6 },
}
/** DUO needs a DJ controller, so it is a valid link option but never recommended. */
const UNLISTED_HELPERS = ['duo']

// ---------- build the activities ----------

function songActivities(): Activity[] {
  return D.songs.map((r) => {
    const id = s(r.id), tier = s(r.tier), diff = Number(r.difficulty), notes = Number(r.notes), key = s(r.key)
    const concepts: ConceptId[] = ['memorizing', 'notes']
    if (tier === 'pop' || r.beatsPerBar !== 4) concepts.push('rhythm-pulse')
    if (tier === 'pop' || key.endsWith('minor')) concepts.push('mood-emotion')
    if (tier === 'classical' || tier === 'bang') concepts.push('style-history')
    const hook = r.hook ? s(r.hook) : ''
    const blurb = hook ? hook[0].toUpperCase() + hook.slice(1) + (/[.!?]$/.test(hook) ? '' : '.') : `${s(r.origin).replace(/ \(.*\)$/, '')}, ${s(r.year)}. Learn it a few notes at a time, then play the whole tune.`
    const learn = tier !== 'pop'
    return {
      id: 'song-' + id, kind: 'song', title: s(r.title), blurb, concepts: [...new Set(concepts)].slice(0, 4) as ConceptId[],
      ages: [[5, 6, 8, 10, 12][diff - 1] ?? 8, 99], minutes: Math.max(5, Math.min(15, 5 + Math.round(notes / 10))), level: lv(diff), needsKeyboard: false,
      link: U({ screen: 'songs', item: id, ...(learn ? { songMode: 'learn' as const } : {}) }),
      meta: { by: s(r.origin), year: s(r.year), key, bpm: Number(r.bpm), tier },
      ...(learn ? {} : { note: 'A Koog original: opens ready to play. Try wait mode (it pauses for you) first.' }),
    } satisfies Activity
  })
}

function challengeActivities(): Activity[] {
  return D.challenges.map((r) => {
    const id = s(r.id), d = Number(r.difficulty)
    return {
      id: 'challenge-' + id, kind: 'challenge', title: s(r.title), blurb: s(r.desc), concepts: CHALLENGE_CONCEPTS[id] ?? ['notes'],
      ages: [d === 1 ? 5 : d === 2 ? 6 : 8, 99], minutes: id === 'boss' ? 5 : 3, level: lv(id === 'boss' ? 4 : d), needsKeyboard: false,
      link: U({ screen: 'challenges', item: id }),
      ...(id === 'dynamics' ? { note: 'Loud and soft is most meaningful on a touch-sensitive USB keyboard; computer keys all play at one strength.' } : {}),
    } satisfies Activity
  })
}

function gameActivities(): Activity[] {
  const games: Activity[] = D.games.map((r) => {
    const id = s(r.id), m = GAME_META[id]
    return {
      id: 'game-' + id, kind: 'game', title: s(r.title), blurb: s(r.blurb), concepts: m?.concepts ?? ['notes'], ages: [m?.age ?? 7, 99],
      minutes: 8, level: lv(m?.level ?? 3), needsKeyboard: false, link: U({ screen: 'games', item: id }), meta: { skill: s(r.skill) },
    } satisfies Activity
  })
  const levels: Activity[] = D.levels.map((r) => {
    const id = s(r.id), ep = Number(r.episode), phrase = r.phrase === true, boss = r.boss === true
    return {
      id: 'level-' + id.toLowerCase(), kind: 'level', title: 'BachDoom: ' + s(r.name), blurb: s(r.blurb),
      concepts: phrase ? ['memorizing', 'phrases-cadences'] : ['memorizing', 'rhythm-pulse', 'reading-music'],
      ages: [ep === 0 ? 7 : 8, 99], minutes: phrase ? 4 : 7, level: lv(ep === 0 ? 2 : ep === 1 ? (boss ? 4 : 3) : boss ? 5 : 4), needsKeyboard: false,
      link: U({ screen: 'games', item: 'bachdoom', level: id }), meta: { song: s(r.songId), episode: ep },
    } satisfies Activity
  })
  return [...games, ...levels]
}

function beatActivities(): Activity[] {
  return D.beats.map((r) => ({
    id: 'beat-' + s(r.id), kind: 'beat', title: s(r.title) + ' (beat)', blurb: s(r.blurb), concepts: ['rhythm-pulse'], ages: [4, 99], minutes: 5, level: 1,
    needsKeyboard: false, link: U({ screen: 'beats', item: s(r.id) }), meta: { bpm: Number(r.bpm) },
  } satisfies Activity))
}

function synthActivities(): Activity[] {
  return D.emulators.map((r) => {
    const id = s(r.id), m = EMU_META[id]
    return {
      id: 'synth-' + id, kind: 'synth', title: s(r.title), blurb: m?.blurb ?? s(r.blurb), concepts: m?.concepts ?? ['style-history'], ages: [7, 99], minutes: 5, level: 2,
      needsKeyboard: false, link: U({ screen: 'synth', item: id }), meta: { year: s(r.year) },
      note: 'A playable, synthesized emulation for learning; not the original instrument.',
    } satisfies Activity
  })
}

function playActivities(): Activity[] {
  const free: Activity = {
    id: 'play-free', kind: 'play', title: 'Free play', blurb: 'Press any keys. Notes that fit the key burst gold; Koog says what it hears.',
    concepts: ['keys-scales', 'notes'], ages: [4, 99], minutes: 3, level: 1, needsKeyboard: false, link: U({ screen: 'play' }),
  }
  const sheet: Activity = {
    id: 'play-sheet', kind: 'play', title: 'Free play with sheet music', blurb: 'A music staff follows along and writes down what you play.',
    concepts: ['reading-music', 'notes'], ages: [6, 99], minutes: 5, level: 2, needsKeyboard: false, link: U({ screen: 'play', sheet: true }),
  }
  const visuals: Activity[] = D.visuals.map((r) => {
    const id = s(r.id)
    return {
      id: 'visual-' + id, kind: 'visual', title: 'Free play: ' + s(r.label), blurb: id === 'vibes' ? 'Chords turn into a face that shows the mood.' : id === 'dancer' ? 'A little dancer moves to the mood of your music: happy is bouncy, sad is a slow sway.' : `Play and watch the ${s(r.label).toLowerCase()} react to every note.`,
      concepts: id === 'vibes' ? ['mood-emotion', 'chords'] : id === 'dancer' ? ['mood-emotion', 'rhythm-pulse'] : ['keys-scales', 'notes'], ages: [4, 99], minutes: 4, level: 1, needsKeyboard: false, link: U({ screen: 'play', visual: id }),
    } satisfies Activity
  })
  const helpers: Activity[] = D.helpers.filter((h) => !UNLISTED_HELPERS.includes(h)).map((h) => {
    const m = HELPERS[h]
    return {
      id: 'helper-' + h, kind: 'helper', title: m.title, blurb: m.blurb, concepts: m.concepts, ages: [m.age, 99], minutes: 5, level: lv(m.level), needsKeyboard: false,
      link: U({ screen: 'play', modes: [h as 'mentor'] }),
    } satisfies Activity
  })
  return [free, sheet, ...visuals, ...helpers]
}

const activities: Activity[] = [...playActivities(), ...challengeActivities(), ...songActivities(), ...beatActivities(), ...gameActivities(), ...synthActivities()]

// ---------- concepts ----------

const byId = new Map(activities.map((a) => [a.id, a]))
const L = (id: string) => byId.get(id)?.link ?? ''

const concepts: Concept[] = [
  { id: 'notes', title: 'Notes on the keyboard', link: L('challenge-detective'), examples: ['challenge-detective', 'game-zombies', 'challenge-climb'],
    parent: 'Knowing where each note lives and what it is called. Koog shows the note name as you play, and games such as Note Detective and Zombie Lanes make you find notes by name.',
    kid: 'Every key has a name: A, B, C, D, E, F, G, and then the names start over. Can you find them all?' },
  { id: 'keys-scales', title: 'Keys and scales', link: U({ screen: 'play', key: { tonic: 0, scale: 'major' } }), examples: ['play-free', 'challenge-climb', 'challenge-stay'],
    parent: 'A key is the small family of notes a tune lives in, and a scale lists them in order. Koog listens for the key you are playing in. In-key notes burst gold and out-of-key notes look "spicy" (not wrong, just daring), so a child feels the key before they know the word.',
    kid: 'Some notes are best friends and sound great together. Play in the key and the notes glow gold. The spicy ones are the brave ones.' },
  { id: 'chords', title: 'Chords', link: L('challenge-chords'), examples: ['challenge-chords', 'helper-vibes', 'helper-band'],
    parent: 'Chords are several notes sounded together. Koog names the chord it hears, Chord Builder asks the child to hold a named chord, and Vibes shows the chord as a mood.',
    kid: 'Press three keys together and you have a chord. Different chords feel different: bright, sad, big or sneaky.' },
  { id: 'rhythm-pulse', title: 'Steady pulse and rhythm', link: L('beat-pop'), examples: ['beat-pop', 'challenge-rhythm', 'game-jiujitsu'],
    parent: 'Feeling a steady beat and playing in time with it. Even rhythms make the fireworks fly straight, the games give double points for notes on the beat, and the Beats screen has eight original grooves to play along with.',
    kid: 'Music has a heartbeat. Tap along with it, then try to play right on the beat so your fireworks fly straight.' },
  { id: 'phrases-cadences', title: 'Phrases and cadences', link: L('helper-mentor'), examples: ['helper-mentor', 'game-bachdoom', 'play-free'],
    parent: 'A phrase is a musical sentence and a cadence is how it ends. When a child finishes a phrase on the home note, Koog says "Cadence!" and the fireworks bloom, which teaches "that is how music says end of sentence" without a lecture.',
    kid: 'Music talks in sentences. End on the home note and it sounds finished, like a full stop. Koog will shout "Cadence!"' },
  { id: 'motifs-form', title: 'Motifs and form', link: L('song-beethoven5'), examples: ['helper-mentor', 'song-beethoven5', 'song-invention1'],
    parent: 'A motif is a short pattern that gets repeated. Koog says "Motif!" when the child repeats a pattern, even starting on another note, with a nod to Beethoven\'s Fifth. Composers build whole pieces from one small idea.',
    kid: 'A motif is a tiny tune you say again, like da-da-da-DAAH. Repeat a pattern and Koog will spot it.' },
  { id: 'tension-release', title: 'Tension and release', link: L('helper-mentor'), examples: ['helper-mentor', 'play-free'],
    parent: 'A note that does not fit feels tense, and stepping back into the key feels like relief. Koog gives a gold "Release!" bloom when a "wrong" note resolves, so dissonance becomes a tool rather than a mistake.',
    kid: 'A spicy note is like holding your breath. Step back to a note that fits and you get to breathe out. That is a Release!' },
  { id: 'mood-emotion', title: 'Mood and emotion in music', link: L('helper-vibes'), examples: ['helper-vibes', 'challenge-majmin', 'challenge-black'],
    parent: 'Why music feels happy, sad or spooky. Vibes mode turns chords into a face (A minor looks sad, C major looks happy), and asking "make it spooky" invites a child to experiment with major and minor, high and low, fast and slow.',
    kid: 'Chords have feelings. Play one and watch the face. Can you make it sad? Now make it happy. What changed?' },
  { id: 'reading-music', title: 'Reading music', link: L('play-sheet'), examples: ['play-sheet', 'challenge-detective'],
    parent: 'Koog can show a grand staff that follows along at three levels: single notes, easy chords or a fuller left-hand part. Hits turn green, and in free play it writes down what the child plays. Sheet music is optional and added gradually.',
    kid: 'Those lines and dots are music written down. Play a note and watch it turn green on the page.' },
  { id: 'memorizing', title: 'Memorizing a piece', link: U({ screen: 'songs', item: 'ode', songMode: 'learn' }), examples: ['song-ode', 'song-lune', 'game-bachdoom'],
    parent: 'In Songs, "Learn it" cuts a song into phrases of two or three notes and climbs a 7-rung ladder: listen, follow, echo, memory, in time, no sheet, both hands. Progress is saved in the browser on that computer, and old phrases come back for review.',
    kid: 'Learn a tune a few notes at a time. First you listen, then you follow the glowing keys, and soon you can play it with your eyes closed.' },
  { id: 'dynamics', title: 'Dynamics and control', link: L('challenge-dynamics'), examples: ['challenge-dynamics', 'play-free'],
    parent: 'Loud and soft, and knowing when each fits. In Koog a forearm slam fizzles until about 16 good notes charge the BOOM meter, then the same slam is a giant finale, so children learn noise has a time and place. Touch-sensitive keyboards show the difference best.',
    kid: 'Soft notes whisper and loud notes thunder. Play nicely to charge the BOOM meter, then let it rip.' },
  { id: 'style-history', title: 'Style and music history', link: L('synth-ladder'), examples: ['synth-ladder', 'synth-airhands', 'helper-mimic'],
    parent: 'Mimic answers a phrase in styles such as Baroque, ragtime and blues, and the Synth screen is a timeline of electronic instruments from 1920 to 1983, each playable as a synthesized emulation and linked to a classical piece.',
    kid: 'Music sounds different in every era. Hear your tune in a new style, or play the strange instruments people invented long ago.' },
  { id: 'ear-training', title: 'Ear training', link: L('challenge-majmin'), examples: ['challenge-majmin', 'challenge-echo', 'challenge-interval'],
    parent: 'Hearing what a sound is. Major or Minor asks the child to tell a happy chord from a moody one, Echo Me plays a melody that grows each round for the child to copy, and Interval Jumper asks for leaps of a given size.',
    kid: 'Close your eyes and listen. Can you tell a happy chord from a moody one, or copy a tune you just heard?' },
]

// ---------- options a link may use ----------

const ids = (rows: Row[]) => rows.map((r) => s(r.id))
export const OPTIONS = {
  visuals: ids(D.visuals), palettes: ids(D.palettes), sounds: ids(D.sounds), helpers: [...D.helpers],
  songs: ids(D.songs), challenges: ids(D.challenges), games: ids(D.games), levels: ids(D.levels).map((x) => x.toLowerCase()),
  beats: ids(D.beats), synths: ids(D.emulators),
}

/** The order a beginner meets things. next_steps and get_started follow it. */
export const CURRICULUM = [
  'play-free', 'challenge-black', 'challenge-detective', 'song-lune', 'helper-mentor', 'challenge-climb', 'song-ode', 'beat-pop',
  'challenge-rhythm', 'helper-vibes', 'challenge-majmin', 'song-buns', 'challenge-chords', 'play-sheet', 'song-twinkle', 'challenge-echo',
  'game-zombies', 'level-e0m1', 'level-e0m2', 'level-e0m3', 'song-minuet', 'game-bachdoom', 'challenge-dynamics', 'helper-band',
  'synth-airhands', 'helper-mimic', 'challenge-interval', 'game-jiujitsu', 'song-canon', 'synth-ladder', 'level-e1m1', 'game-fashion', 'song-prelude',
]

export const CATALOG = {
  name: 'Koog activity catalog',
  version: 1,
  activities,
  concepts,
  concept_ids: [...CONCEPT_IDS],
  kinds: [...KINDS],
  options: OPTIONS,
}

// ---------- lookups and validation ----------

export function findActivity(id: string): Activity | undefined {
  const k = id.trim().toLowerCase()
  const hit = byId.get(k)
  if (hit) return hit
  const m = findAmbiguous(k) // a bare source id such as "ode" works when only one activity ends with it
  return m.length === 1 ? m[0] : undefined
}
export function findAmbiguous(id: string): Activity[] {
  const k = id.trim().toLowerCase()
  return byId.has(k) ? [] : activities.filter((a) => a.id.endsWith('-' + k))
}
export const findConcept = (id: string): Concept | undefined => concepts.find((c) => c.id === id.trim().toLowerCase())

/** Problems with a link state against the catalog (empty = fine). Complements parseHash, which checks syntax only. */
export function validateState(st: KoogState): string[] {
  const p: string[] = []
  const oneOf = (v: string, list: string[], what: string) => { if (!list.includes(v.toLowerCase())) p.push(`Unknown ${what} "${v}". ${list.length > 16 ? `Use list_activities (or GET /api/activities) to see valid ids, for example: ${list.slice(0, 6).join(', ')}` : `Choose one of: ${list.join(', ')}`}`) }
  if (st.mode === 'boss') p.push('Boss mode is for grown-ups; use kid mode for children')
  const lists: Record<string, string[] | undefined> = { songs: OPTIONS.songs, challenges: OPTIONS.challenges, games: OPTIONS.games, beats: OPTIONS.beats, synth: OPTIONS.synths }
  if (st.item && st.mode !== 'boss') {
    const list = lists[st.screen]
    if (!list) p.push(`The ${st.screen} screen does not take an item`)
    else oneOf(st.item, list, st.screen === 'synth' ? 'synth' : st.screen.replace(/s$/, ''))
  }
  if (st.songMode && !(SONG_MODES as readonly string[]).includes(st.songMode)) p.push(`Unknown song mode "${st.songMode}"`)
  if (st.songMode && st.screen !== 'songs') p.push('songMode only applies to songs')
  if ((st.rung || st.phrase) && st.songMode !== 'learn') p.push('rung and phrase only apply to song links in learn mode')
  if (st.level) { if (st.screen !== 'games' || st.item !== 'bachdoom') p.push('level only applies to the bachdoom game'); oneOf(st.level, OPTIONS.levels, 'BachDoom level') }
  if (st.visual) oneOf(st.visual, OPTIONS.visuals, 'visual')
  if (st.palette) oneOf(st.palette, OPTIONS.palettes, 'palette')
  if (st.sound) oneOf(st.sound, OPTIONS.sounds, 'sound')
  for (const m of st.modes ?? []) oneOf(m, OPTIONS.helpers, 'helper mode')
  if (st.rung && (st.rung < 1 || st.rung > 7)) p.push('rung is 1 to 7')
  return p
}

/** Internal consistency: unique ids, real concepts, every link parses and points at real ids, nothing in the source is left out. */
export function validateCatalog(): string[] {
  const p: string[] = []
  const seen = new Set<string>()
  for (const a of activities) {
    if (seen.has(a.id)) p.push('duplicate activity id ' + a.id)
    seen.add(a.id)
    if (!a.concepts.length || a.concepts.some((c) => !(CONCEPT_IDS as readonly string[]).includes(c))) p.push(`${a.id}: bad concepts`)
    if (a.ages[0] > a.ages[1] || a.minutes < 1) p.push(`${a.id}: bad ages or minutes`)
    const r = parseHash(a.link)
    if (!r.state || r.problems.length) p.push(`${a.id}: link does not parse (${r.problems.join('; ')})`)
    else for (const x of validateState(r.state)) p.push(`${a.id}: ${x}`)
    if (!a.blurb || /lo{2}g/i.test(a.title + a.blurb)) p.push(`${a.id}: bad blurb`)
  }
  for (const c of concepts) {
    if (!c.link || !c.parent || !c.kid) p.push(`concept ${c.id} incomplete`)
    for (const e of c.examples) if (!byId.has(e)) p.push(`concept ${c.id}: unknown example ${e}`)
    const r = parseHash(c.link)
    if (!r.state || r.problems.length || validateState(r.state).length) p.push(`concept ${c.id}: bad link`)
  }
  for (const c of CONCEPT_IDS) if (!concepts.some((x) => x.id === c)) p.push('missing concept ' + c)
  for (const id of CURRICULUM) if (!byId.has(id)) p.push('curriculum: unknown activity ' + id)
  // curated tables must not hold keys the source no longer has
  const stale = (tbl: Record<string, unknown>, list: string[], what: string) => { for (const k of Object.keys(tbl)) if (!list.includes(k)) p.push(`stale ${what} metadata key "${k}"`) }
  stale(CHALLENGE_CONCEPTS, OPTIONS.challenges, 'challenge'); stale(GAME_META, OPTIONS.games, 'game'); stale(EMU_META, OPTIONS.synths, 'synth'); stale(HELPERS, OPTIONS.helpers, 'helper')
  for (const [k, list] of [['challenges', OPTIONS.challenges], ['games', OPTIONS.games], ['songs', OPTIONS.songs], ['levels', OPTIONS.levels], ['beats', OPTIONS.beats], ['synths', OPTIONS.synths], ['visuals', OPTIONS.visuals]] as const)
    if (list.length === 0) p.push('no ' + k)
  for (const h of OPTIONS.helpers) if (!HELPERS[h] && !UNLISTED_HELPERS.includes(h)) p.push(`helper "${h}" has no metadata (add it to HELPERS or UNLISTED_HELPERS)`)
  // every level's song must exist
  for (const l of D.levels) if (!OPTIONS.songs.includes(s(l.songId))) p.push(`level ${l.id}: song ${l.songId} not in songs`)
  return p
}
