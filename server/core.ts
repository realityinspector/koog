// The Koog helper logic, shared by the REST API and the MCP tools. Pure functions over the catalog:
// no I/O, no state, nothing stored. Erasable TypeScript only (Node runs this file directly).
import { CATALOG, CURRICULUM, KINDS, CONCEPT_IDS, OPTIONS, findActivity, findAmbiguous, findConcept, validateState, type Activity, type Concept } from '../src/links/catalog.ts'
import { DEFAULT_ORIGIN, SCREENS, SONG_MODES, parseHash, slugToKey, toUrl, type KoogState, type HelperMode, type Screen, type SongMode } from '../src/links/links.ts'

export const REPO_URL = 'https://github.com/realityinspector/koog'
export const APP_URL = DEFAULT_ORIGIN

/** Thrown for bad input; the HTTP layer turns it into a 400 with this message. */
export class BadInput extends Error {}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const slim = (a: Activity) => ({ id: a.id, kind: a.kind, title: a.title, blurb: a.blurb, concepts: a.concepts, ages: a.ages, minutes: a.minutes, level: a.level, needsKeyboard: a.needsKeyboard, link: a.link })

// ---------------- input cleaning ----------------

export function cleanAge(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < 2 || n > 120) throw new BadInput('age must be a number of years, 2 to 120')
  return Math.round(n)
}
export function cleanMinutes(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) throw new BadInput('minutes must be a positive number')
  return clamp(Math.round(n), 3, 90)
}
export function cleanBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'boolean') return v
  const t = String(v).toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(t)) return true
  if (['0', 'false', 'no', 'n'].includes(t)) return false
  throw new BadInput('expected true or false')
}
export function cleanList(v: unknown, max = 12): string[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  return arr.map((x) => String(x).trim().toLowerCase().slice(0, 60)).filter(Boolean).slice(0, max)
}

// ---------------- interests -> activities ----------------

const INTEREST_HINTS: [RegExp, string[]][] = [
  [/spook|scar|halloween|ghost|haunt|monster|creep/, ['song-pop-spooky', 'song-toccata', 'song-king', 'visual-ghost', 'level-e1m3']],
  [/zombie/, ['game-zombies', 'visual-zombie']],
  [/doom|shoot|video ?game|gam(e|ing)|minecraft|fortnite|roblox|battle|boss|fight|dragon/, ['game-bachdoom', 'game-zombies', 'challenge-boss', 'song-pop-boss']],
  [/karate|judo|jiu|martial|wrestl|sport|belt/, ['game-jiujitsu']],
  [/fashion|dress|style|model|runway|cloth/, ['game-fashion']],
  [/dance|disco|party|pop|edm|tiktok|radio|sing/, ['song-pop-dance', 'song-pop-edm', 'beat-disco', 'beat-pop']],
  [/drum|beat|rhythm|hip ?hop|rap|groove|funk/, ['beat-funk', 'beat-boombap', 'challenge-rhythm', 'song-pop-funk']],
  [/chill|lo-?fi|calm|relax|sleep|quiet|cozy/, ['beat-lofi', 'song-pop-lofi', 'song-gymnopedie', 'song-brahms']],
  [/robot|space|sci-?fi|alien|future|synth|electronic|moog|retro|machine/, ['synth-theremin', 'synth-moog', 'synth-tb303', 'helper-mentor']],
  [/histor|old|invent/, ['synth-theremin', 'synth-moog', 'helper-mimic']],
  [/classical|bach|beethoven|mozart|orchestra|composer|piano/, ['song-ode', 'song-minuet', 'song-elise', 'game-bachdoom']],
  [/anim|farm|cow|pet|dog|cat/, ['song-oldmac', 'song-cucaracha', 'song-mary']],
  [/christmas|holiday|winter|carol/, ['song-jingle', 'song-deckhalls', 'song-wewish']],
  [/birthday/, ['song-bday']],
  [/sad|happy|feel|emotion|mood|art|draw|color|colour/, ['helper-vibes', 'visual-vibes', 'challenge-majmin']],
  [/puzzle|math|memory|brain|logic|code|coding|science/, ['challenge-echo', 'challenge-mirror', 'challenge-interval', 'song-canon']],
  [/firework|sparkle|light|explo/, ['visual-fireworks', 'visual-confetti']],
  [/speed|fast|race|run/, ['challenge-speed', 'challenge-gliss', 'song-bumblebee']],
  [/tetris|russia/, ['song-korobeiniki']],
  [/band|jam|play along|accompan/, ['helper-band']],
  [/read|sheet|notation|school/, ['play-sheet', 'challenge-detective']],
]

/** ids of activities matching free-text interests: one per interest in turn, best match first. */
export function interestPicks(interests: string[]): string[] {
  const lists = interests.map((w) => {
    const ids: string[] = []
    const add = (id: string) => { if (!ids.includes(id) && findActivity(id)) ids.push(id) }
    for (const [re, hit] of INTEREST_HINTS) if (re.test(w)) hit.forEach(add)
    // fall back to plain words in titles, blurbs and composers (e.g. "tetris", "bach")
    if (!ids.length && w.length >= 4) for (const a of CATALOG.activities) if (`${a.title} ${a.blurb} ${a.meta?.by ?? ''}`.toLowerCase().includes(w)) add(a.id)
    return ids
  })
  const out: string[] = []
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && !out.includes(l[i])) out.push(l[i])
  return out
}

// ---------------- text per activity ----------------

const sentence = (t: string) => (/^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t)

const HOW: Record<Activity['kind'], string> = {
  play: 'Open the link and click anywhere on the page once so the sound turns on. Then let them press keys. There is no wrong note here. Ask what happens when they hit a gold one.',
  song: 'Open the link. Koog lights the next key to press, starting with the first few notes. Let them repeat each little phrase as many times as they like and stop while they are still smiling.',
  challenge: 'Open the link; the goal is on the screen. They can retry as often as they like. Sit beside them for the first round, then let them go solo.',
  game: 'Open the link and pick it from the menu if it asks. The first minute is a tutorial. Cheer for correct, in-time notes, because that is what scores.',
  level: 'Open the link; it starts that BachDoom level. The melody is the ammo: each demon is a note of the tune. Help them find the first note, then let them play.',
  beat: 'Open the link; a groove starts playing. Let them tap along or play any keys on top, and see if they can stay on the beat.',
  synth: 'Open the link to get a playable copy of the instrument. Turn a knob while holding a key and ask them what changed.',
  visual: 'Open the link and let them play. Ask them to find one note that looks different from the others.',
  helper: 'Open the link; this helper is already switched on. Let them play around and read out what Koog says it noticed.',
}
export function parentSays(a: Activity): string { return `${HOW[a.kind]} About ${a.minutes} minutes.${a.note ? ' Note: ' + a.note : ''}` }
export function kidSays(a: Activity): string {
  const lead: Record<Activity['kind'], string> = {
    play: "Let's play with the keys!", song: `Let's learn ${a.title}!`, challenge: `Ready for ${a.title}?`, game: `Let's play ${a.title}!`, level: `Let's take on ${a.title.replace('BachDoom: ', '')}!`,
    beat: `Let's play along with ${a.title.replace(' (beat)', '')}!`, synth: `Let's try the ${a.title}!`, visual: "Let's make some sparkles!", helper: `Let's switch on ${a.title.split(' (')[0]}!`,
  }
  return `${lead[a.kind]} ${a.blurb}`
}
function step(a: Activity, minutes: number) {
  const c = findConcept(a.concepts[0])
  return {
    title: a.title, minutes, why: c ? `${c.title}: ${sentence(c.parent)}` : a.concepts[0], concept: a.concepts[0],
    parent_says: parentSays(a), kid_says: kidSays(a), link: a.link, id: a.id,
  }
}

// ---------------- get_started ----------------

export interface StartInput { age?: number; minutes?: number; has_usb_keyboard?: boolean; interests?: string[] }

const levelCap = (age: number) => (age <= 5 ? 1 : age <= 7 ? 2 : 3) // a first session stays gentle at any age
const fits = (a: Activity, age: number) => a.ages[0] <= age && age <= a.ages[1] && a.level <= levelCap(age)

export function setupNote(hasUsbKeyboard?: boolean) {
  return {
    browser: 'Use Chrome or Edge on a computer (a laptop is fine). Open the first link; it opens Koog in exactly the right place.',
    keys: 'No keyboard is needed: the computer keys play notes. Bottom letter row (Z S X D C V G B H N J M) is the lower octave, the Q row (Q 2 W 3 E R 5 T 6 Y 7 U) is the upper octave, and the left and right arrow keys shift octaves.',
    sound: 'Turn the volume up (headphones are kind to everyone nearby). Click once anywhere on the page to enable sound, because browsers keep audio off until you do.',
    usb_keyboard: hasUsbKeyboard
      ? `The hosted demo plays with the computer keys only. To use your USB keyboard, run Koog locally (free and open source): ${REPO_URL}`
      : `For a USB keyboard or pedal, run Koog locally instead of the web demo: ${REPO_URL}`,
    privacy: 'There are no accounts and nothing about your child is sent anywhere. Their progress is saved only in their own browser on this computer.',
  }
}

export function getStarted(input: StartInput) {
  const age = input.age ?? 8
  const total = input.minutes ?? 15
  const interests = input.interests ?? []
  const picks = interestPicks(interests).map((id) => findActivity(id)!).filter((a) => fits(a, age))
  const base = CURRICULUM.map((id) => findActivity(id)!).filter((a) => fits(a, age))
  const nat = (a: Activity) => Math.min(a.minutes, 8)
  // order: warm-up, one gentle skill step, then what they love, then the rest of the beginner path
  const chosen: Activity[] = []
  const take = (a?: Activity) => { if (a && !chosen.includes(a)) chosen.push(a) }
  take(base.find((a) => a.id === 'play-free'))
  take(base.find((a) => !chosen.includes(a) && a.level <= (age <= 6 ? 1 : 2) && a.kind !== 'play'))
  const fun = total >= 8 ? picks.slice(0, total >= 25 ? 3 : total >= 12 ? 2 : 1) : []
  fun.forEach(take)
  for (const a of base) take(a)
  const maxSteps = clamp(Math.round(total / 5) + 1, 2, 6)
  const plan: Activity[] = []
  let used = 0
  for (const a of chosen) {
    if (plan.length >= maxSteps || (plan.length >= 2 && used + nat(a) > total + 1)) continue
    plan.push(a); used += nat(a)
  }
  // top up the last step if time is left over (at most 2 extra minutes), trim it if we are over
  const steps = plan.map((a, i) => step(a, nat(a) + (i === plan.length - 1 ? clamp(total - used, -(nat(a) - 2), 2) : 0)))
  const missing: string[] = []
  if (input.age === undefined) missing.push('How old is your child? (I assumed 8.)')
  if (input.minutes === undefined) missing.push('How many minutes do you have right now? (I assumed 15.)')
  if (input.has_usb_keyboard === undefined) missing.push('Do you have a USB or MIDI keyboard? (The demo works without one.)')
  if (!interests.length) missing.push('What does your child love: games, spooky things, dancing, animals, robots, drums? (I picked a gentle default.)')
  return {
    assumptions: { age, minutes: total, has_usb_keyboard: input.has_usb_keyboard ?? false, interests },
    follow_up_questions: missing,
    session_plan: {
      total_minutes: steps.reduce((n, x) => n + x.minutes, 0),
      steps,
      wrap_up: 'Ask your child to show you their favourite moment, and tell them what you heard. A good first session ends while they still want more; the same links work any day.',
    },
    first_time_setup: setupNote(input.has_usb_keyboard),
    // a hands-free tour of every feature: good for a first look together, or for a parent to preview Koog
    gallery: { link: toUrl({ screen: 'gallery' }), minutes: 18, what: 'A self-playing gallery: Koog tours every feature by itself with pleasant music. Click "Start the gallery" once; press any key to take over.' },
    note_for_the_ai: 'Read the plan to the parent in your own words, give them the links as plain URLs, and offer the kid_says lines to read aloud. Do not promise results; Koog is a practice companion, not a teacher.',
  }
}

// ---------------- activities / concepts ----------------

export interface ListInput { kind?: string; concept?: string; age?: number; max_minutes?: number; limit?: number; offset?: number }
export function listActivities(q: ListInput) {
  if (q.kind && !(KINDS as readonly string[]).includes(q.kind)) throw new BadInput(`kind must be one of: ${KINDS.join(', ')}`)
  if (q.concept && !(CONCEPT_IDS as readonly string[]).includes(q.concept)) throw new BadInput(`concept must be one of: ${CONCEPT_IDS.join(', ')}`)
  const all = CATALOG.activities.filter((a) =>
    (!q.kind || a.kind === q.kind) && (!q.concept || a.concepts.includes(q.concept as never)) &&
    (q.age === undefined || (a.ages[0] <= q.age && q.age <= a.ages[1])) && (q.max_minutes === undefined || a.minutes <= q.max_minutes))
  const limit = clamp(q.limit ?? 25, 1, 50), offset = Math.max(0, q.offset ?? 0)
  const page = all.slice(offset, offset + limit)
  return { total: all.length, offset, returned: page.length, ...(offset + page.length < all.length ? { next_offset: offset + page.length } : {}), kinds: KINDS, activities: page.map(slim) }
}

export function getActivity(id: string) {
  const a = findActivity(id)
  if (!a) {
    const amb = findAmbiguous(id)
    if (amb.length > 1) throw new BadInput(`"${id}" matches several activities: ${amb.map((x) => x.id).join(', ')}`)
    throw new BadInput(`No activity "${id}". Use list_activities to see ids such as song-ode, challenge-echo, game-bachdoom.`)
  }
  const related = CATALOG.activities.filter((x) => x.id !== a.id && x.concepts.includes(a.concepts[0])).slice(0, 4).map((x) => x.id)
  return { ...a, parent_says: parentSays(a), kid_says: kidSays(a), concept_details: a.concepts.map((c) => findConcept(c)?.title), related }
}

export function listConcepts() { return { concepts: CATALOG.concepts.map((c) => ({ id: c.id, title: c.title, kid: c.kid, link: c.link })) } }
export function getConcept(id: string): Concept & { activities: ReturnType<typeof slim>[] } {
  const c = findConcept(id)
  if (!c) throw new BadInput(`Unknown concept "${id}". Choose one of: ${CONCEPT_IDS.join(', ')}`)
  return { ...c, activities: CATALOG.activities.filter((a) => a.concepts[0] === c.id || c.examples.includes(a.id)).slice(0, 8).map(slim) }
}

// ---------------- links ----------------

export interface LinkInput {
  screen?: string; item?: string; song_mode?: string; rung?: number; phrase?: number; level?: string
  key?: string; visual?: string; palette?: string; sound?: string; modes?: string[] | string; sheet?: boolean
}
export function makeLink(i: LinkInput) {
  const problems: string[] = []
  const screen = (i.screen ?? 'play').toLowerCase()
  if (!(SCREENS as readonly string[]).includes(screen)) return { ok: false, url: null, problems: [`Unknown screen "${i.screen}". Choose one of: ${SCREENS.join(', ')}`], valid_screens: SCREENS }
  const st: KoogState = { screen: screen as Screen }
  if (i.item) st.item = String(i.item).toLowerCase()
  if (i.song_mode) { if ((SONG_MODES as readonly string[]).includes(i.song_mode)) st.songMode = i.song_mode as SongMode; else problems.push(`Unknown song_mode "${i.song_mode}" (wait, flow or learn)`) }
  if (i.rung !== undefined) st.rung = Number(i.rung)
  if (i.phrase !== undefined) st.phrase = Number(i.phrase)
  if (i.level) st.level = String(i.level).toLowerCase()
  if (i.key) { const k = slugToKey(i.key); if (k) st.key = k; else problems.push(`Bad key "${i.key}" (try c-major, a-minor, f-sharp-major or auto)`) }
  if (i.visual) st.visual = String(i.visual).toLowerCase()
  if (i.palette) st.palette = String(i.palette).toLowerCase()
  if (i.sound) st.sound = String(i.sound).toLowerCase()
  const modes = cleanList(i.modes)
  if (modes.length) st.modes = modes as HelperMode[]
  if (i.sheet) st.sheet = true
  problems.push(...validateState(st))
  const url = toUrl(st)
  const back = parseHash(url)
  problems.push(...back.problems)
  return { ok: problems.length === 0, url, problems, hint: problems.length ? 'Fix the problems and call again. The url may not open what you intended until they are gone.' : 'Canonical Koog link. Give it to the parent as plain text.' }
}
export function linkFromQuery(q: URLSearchParams): LinkInput {
  const n = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined)
  return {
    screen: q.get('screen') ?? undefined, item: q.get('item') ?? undefined, song_mode: q.get('song_mode') ?? q.get('mode') ?? undefined, rung: n('rung'), phrase: n('phrase'),
    level: q.get('level') ?? undefined, key: q.get('key') ?? undefined, visual: q.get('visual') ?? undefined, palette: q.get('palette') ?? undefined, sound: q.get('sound') ?? undefined,
    modes: q.get('modes') ?? undefined, sheet: cleanBool(q.get('sheet')),
  }
}

// ---------------- next steps ----------------

export function nextSteps(done: string[], age?: number) {
  const known: Activity[] = [], unknown: string[] = []
  for (const d of done) { const a = findActivity(d); if (a) known.push(a); else unknown.push(d) }
  const doneIds = new Set(known.map((a) => a.id))
  const seen = new Set(known.flatMap((a) => a.concepts))
  const okAge = (a: Activity) => age === undefined || (a.ages[0] <= age + 1 && age <= a.ages[1])
  const todo = (a: Activity) => !doneIds.has(a.id) && okAge(a)
  // 1) the curriculum, in order; 2) anything else that is new, easiest first
  let pool = CURRICULUM.map((id) => findActivity(id)!).filter(todo)
  const maxDone = known.reduce((m, a) => Math.max(m, a.level), 0)
  pool = pool.filter((a) => a.level <= maxDone + 1 || pool.indexOf(a) < 2)
  if (pool.length < 3) pool = [...pool, ...CATALOG.activities.filter((a) => todo(a) && !pool.includes(a)).sort((x, y) => x.level - y.level)]
  const picks = pool.slice(0, 3)
  return {
    done: known.map((a) => a.id), unknown_ids: unknown,
    concepts_touched: [...seen],
    suggestions: picks.map((a) => {
      const fresh = a.concepts.filter((c) => !seen.has(c))
      const why = fresh.length ? `New idea: ${findConcept(fresh[0])?.title}.` : `More practice with ${findConcept(a.concepts[0])?.title.toLowerCase()}.`
      return { ...slim(a), why, parent_says: parentSays(a), kid_says: kidSays(a) }
    }),
    ...(picks.length === 0 ? { message: 'They have done everything in the beginner path. Use list_activities to pick any song, level or synth, or run Koog locally for USB keyboards.' } : {}),
  }
}

export const catalogJson = () => ({ ...CATALOG, curriculum: CURRICULUM, options: OPTIONS, app: APP_URL })
