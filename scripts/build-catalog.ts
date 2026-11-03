// Extracts the raw id/title inventory the API and MCP server need from the app source, and writes
// src/links/catalog.data.json. Several app modules touch browser APIs on import (challenges, levels,
// emulators, visual modes, sounds), so those are read as text; songs, beats and synth history are pure and imported.
//
//   npx tsx scripts/build-catalog.ts            rewrite src/links/catalog.data.json
//   npx tsx scripts/build-catalog.ts --check    fail if the checked-in file is stale (ids drifted) or the catalog is inconsistent
//
// Run `npm run check:catalog` in CI or before deploying.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { keyToSlug, HELPER_MODES } from '../src/links/links.ts'
import { SONGS } from '../src/features/songs/songs.ts'
import { GROOVES } from '../src/features/beats/grooves.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const OUT = root + 'src/links/catalog.data.json'
const read = (p: string) => readFileSync(root + p, 'utf8')

const STR = String.raw`'((?:[^'\\]|\\.)*)'`
const unesc = (s: string) => s.replace(/\\(.)/g, '$1')
/** value of a single-quoted string property inside a chunk of source, or undefined */
function str(chunk: string, prop: string): string | undefined {
  const m = new RegExp(`\\b${prop}:\\s*${STR}`).exec(chunk)
  return m ? unesc(m[1]) : undefined
}
const need = (v: string | undefined, what: string): string => { if (v === undefined) throw new Error('catalog extract: missing ' + what); return v }
const num = (chunk: string, prop: string) => { const m = new RegExp(`\\b${prop}:\\s*(\\d+)`).exec(chunk); return m ? Number(m[1]) : undefined }
/** split a source region into one chunk per `{ id: '...'` object start */
const chunks = (region: string) => region.split(/\n\s*(?=\{ id: ')/).filter((c) => /^\{ id: '/.test(c.trimStart()))

// ---- songs (pure module): difficulty 1-5 from length, range, speed, short notes and accidentals
function songDifficulty(s: (typeof SONGS)[number]): { difficulty: number; notes: number; beats: number } {
  const ns = s.notes.filter((n) => n.note != null) as { note: number; beats: number }[]
  const pcs = s.key.scale === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11]
  const acc = ns.filter((n) => !pcs.includes(((n.note - s.key.tonic) % 12 + 12) % 12)).length
  const midi = ns.map((n) => n.note)
  const range = Math.max(...midi) - Math.min(...midi)
  const shortest = Math.min(...ns.map((n) => n.beats))
  const beats = s.notes.reduce((a, n) => a + n.beats, 0)
  let score = 0.5 + ns.length / 45 + range / 12 + (shortest < 0.5 ? 1 : shortest < 1 ? 0.4 : 0) + acc / 8 + (s.bpm > 125 ? 0.4 : 0)
  if (s.id === 'prelude' || s.id === 'bumblebee') score += 2
  const difficulty = Math.max(1, Math.min(5, Math.round(score)))
  return { difficulty, notes: ns.length, beats: Math.round(beats * 100) / 100 }
}
function songs() {
  return SONGS.map((s) => {
    const d = songDifficulty(s)
    return {
      id: s.id, title: s.title, origin: s.origin, year: s.year, key: keyToSlug(s.key), bpm: s.bpm, tier: s.tier,
      difficulty: d.difficulty, notes: d.notes, beats: d.beats, beatsPerBar: s.beatsPerBar ?? 4,
      ...(s.hook ? { hook: s.hook } : {}), ...(s.mine ? { mine: true } : {}),
    }
  })
}

// ---- challenges (defs.ts imports the app store, so read as text)
function challenges() {
  const src = read('src/features/challenges/defs.ts')
  const region = src.slice(src.indexOf('export const CHALLENGES'))
  return chunks(region).map((c) => ({
    id: need(str(c, 'id'), 'challenge id'), title: need(str(c, 'title'), 'challenge title'),
    desc: need(str(c, 'desc'), 'challenge desc'), difficulty: num(c, 'difficulty') ?? 2,
  }))
}

// ---- games (GamesPanel.tsx is React)
function games() {
  const src = read('src/features/games/GamesPanel.tsx')
  const region = src.slice(src.indexOf('const GAMES'), src.indexOf('interface Prog'))
  return chunks(region).map((c) => ({
    id: need(str(c, 'id'), 'game id'), title: need(str(c, 'title'), 'game title'),
    blurb: need(str(c, 'blurb'), 'game blurb'), skill: need(str(c, 'skill'), 'game skill'),
  }))
}

// ---- BachDoom levels
function levels() {
  const src = read('src/features/games/bachdoom/levels.ts')
  const region = src.slice(src.indexOf('export const LEVELS'))
  return chunks(region.slice(0, region.indexOf('\n]'))).map((c) => ({
    id: need(str(c, 'id'), 'level id'), name: need(str(c, 'name'), 'level name'), songId: need(str(c, 'songId'), 'level songId'),
    episode: /\bepisode:\s*([012])/.test(c) ? Number(/\bepisode:\s*([012])/.exec(c)![1]) : 1,
    phrase: /\bphrase:\s*\{/.test(c), boss: /\bboss:\s*true/.test(c) || /\bfinale:\s*true/.test(c),
    blurb: need(str(c, 'blurb'), 'level blurb'),
  }))
}

const beats = () => GROOVES.map((g) => ({ id: g.id, title: g.name, blurb: g.blurb, bpm: g.bpm }))

// ---- synth emulators: id, name, year, first sentence of the blurb
function emulators() {
  const reg = read('src/features/synth-history/emu/index.ts')
  const order = /EMULATORS: EmuSpec\[\] = \[([^\]]*)\]/.exec(reg)![1].split(',').map((x) => x.trim()).filter(Boolean)
  return order.map((varName) => {
    const src = read(`src/features/synth-history/emu/${varName}.ts`)
    const c = src.slice(src.indexOf(`export const ${varName}: EmuSpec`))
    const blurb = need(str(c, 'blurb'), varName + ' blurb')
    const first = (/^.*?[.!?](?=\s|$)/.exec(blurb)?.[0] ?? blurb)
    return { id: need(str(c, 'id'), varName + ' id'), title: need(str(c, 'name'), varName + ' name'), year: need(str(c, 'year'), varName + ' year'), blurb: first.length > 170 ? first.slice(0, 167) + '...' : first }
  })
}

// ---- visual scenes, palettes (background themes) and piano sounds
function pairs(src: string, from: string, labelProp = 'label') {
  const region = src.slice(src.indexOf(from))
  const body = region.slice(0, region.indexOf('\n]') >= 0 ? region.indexOf('\n]') : 600)
  return [...body.matchAll(new RegExp(`\\{ id: '([a-z0-9-]+)'[^}]*?${labelProp}: '((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map((m) => ({ id: m[1], label: unesc(m[2]).replace(/^\S*\p{Extended_Pictographic}\S*\s+/u, '') }))
}
const visuals = () => pairs(read('src/features/visualizer/VizControls.tsx'), 'export const VISUALS')
const palettes = () => pairs(read('src/features/visualizer/engine.ts'), 'export const THEMES')
const sounds = () => pairs(read('src/features/devices/soundChoice.ts'), 'export const SOUNDS')

export function build() {
  const data = {
    _note: 'Generated by scripts/build-catalog.ts from the app source. Do not edit by hand; run `npx tsx scripts/build-catalog.ts`.',
    songs: songs(), challenges: challenges(), games: games(), levels: levels(), beats: beats(), emulators: emulators(),
    visuals: visuals(), palettes: palettes(), sounds: sounds(), helpers: [...HELPER_MODES],
  }
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && v.length === 0) throw new Error(`catalog extract: ${k} is empty (did the source format change?)`)
  return data
}

const json = (d: unknown) => JSON.stringify(d, null, 1) + '\n'
const fresh = json(build())

if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(OUT, 'utf8') } catch { /* missing */ }
  if (current !== fresh) {
    console.error('src/links/catalog.data.json is out of date with the app source (ids or titles changed).\nRun: npx tsx scripts/build-catalog.ts')
    process.exit(1)
  }
  const { validateCatalog, CATALOG } = await import('../src/links/catalog.ts')
  const problems = validateCatalog()
  if (problems.length) { console.error('Catalog problems:\n - ' + problems.join('\n - ')); process.exit(1) }
  console.log(`catalog ok: ${CATALOG.activities.length} activities, ${CATALOG.concepts.length} concepts, data matches the source`)
} else {
  writeFileSync(OUT, fresh)
  const d = JSON.parse(fresh)
  console.log('wrote src/links/catalog.data.json:', Object.entries(d).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}=${(v as unknown[]).length}`).join(' '))
}
