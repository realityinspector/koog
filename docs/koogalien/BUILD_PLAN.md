# Koogalien v1 build plan: 4 parallel builders

Read first: `docs/koogalien/ARCHITECTURE.md`, `docs/koogalien/CURRICULUM.md`, `docs/koogalien/LANGUAGE.md` (planner 1; authoritative for chords, words, spell mode, closers and tone; a later change to it only touches `src/koogalien/data/*` and its fixtures), `docs/DEVELOPING.md`, `docs/KOOG_KODE.md` and `docs/KODING_KORE.md` when present, and the shared BRIEF.md (the lead gives each builder its path).

Naming: **Koogalien** is the language (`src/koogalien/`) AND the module/app that teaches it (`src/features/koogalien/`). **The Koog Alien** is the single mascot who hosts the module (SVG component in `src/brand/mascot/`, built by another agent; UI reaches it ONLY through `src/features/koogalien/ui/Host.tsx`, owned by C). **Koogaliens** (plural) are the voices that speak it (Pip, Dro, Zee). The visible app name is one constant, `KOOGALIEN_NAME`, in `src/features/koogalien/brand.ts` (C).

## v1 scope (must all work)
1. Write "hello world" by playing; see it as Koogalien code `say hello world.`; hear it back; read the English. All four, aligned, from one `Sentence`.
2. A Dictionary / Explorer (browse, search by English, play-to-look-up, hear, ladder badge).
3. One learning game: **Echo Game** (the Koog Alien and a Koogalien voice say a word or short sentence, the kid plays it back; ladder rungs 1 to 4 for words; spaced repetition schedules the next words).
4. An App Store listing (Kore app `koogalien`).
5. A small modulation slice: ONE meaning, `wobble` (LFO) = excited, end to end: encoder emits it, playback drives the synth LFO, recognizer reads it from the mod wheel (CC1) or an on-screen slider. Other `ModName`s exist in the types and are v2. If time is short this slice is the first thing cut, but the interfaces stay.
Out of v1: units 4 to 9 as guided content (the engine supports them, builders must not block them), functions in Koogalien code, filter/glide/tremolo meanings, real Koogalien art beyond emoji plus a simple SVG blob.

## Ownership summary (strict)
| Builder | Owns (create/edit freely) | Check scripts |
|---|---|---|
| A Core | `src/koogalien/data/**`, `src/koogalien/engine/**`, `src/koogalien/ports.ts`, `scripts/koogalien-fixtures.ts` | `check:koogalien` |
| B Lang + Play | `src/koogalien/lang/**`, `src/features/koogalien/play/**`, `scripts/koogalien-lang-fixtures.ts`, `scripts/koogalien-play-fixtures.ts` | `check:koogalienlang`, `check:koogalienplay` |
| C Writer + Shell | `src/features/koogalien/KoogalienApp.tsx`, `host.ts`, `store.ts`, `brand.ts`, `Writer.tsx`, `koogalien.css`, `src/features/koogalien/ui/**`, `src/features/koogalien/ribbon/**`, `scripts/koogalien-ui-fixtures.ts`, `scripts/shots/koogalien-*.json` | `check:koogalienui` |
| D Learn + Dictionary + Store | `src/koogalien/learn/**`, `src/features/koogalien/dictionary/**`, `src/features/koogalien/learn/**`, `src/features/koogalien/listing.ts`, `scripts/koogalien-learn-fixtures.ts` | `check:koogalienlearn` |

No two builders edit the same file. Anything not listed is not yours.

## Shared files, additive only (re-read right before editing; others edit concurrently)
- `package.json`: scripts only. Each builder adds ONLY its own `check:koogalien*` line(s) next to `check:kode` using `npx --no-install tsx scripts/<file>.ts`. A also adds a single `check:koogalienall` chained line at the end of the build (the lead can run it).
- `src/links/links.ts`, `src/links/catalog.ts`: D adds the `#/koogalien` route and entry; then `npm run build:catalog` and `npm run check:catalog` (D only).
- `src/features/gallery/stops.data.ts`: D appends ONE tour stop at the END.
- `README.md`: D adds one feature-table row. A adds a short "Koogalien data" line in the same table only if D lacks it (ask by leaving a note in the report; do not double edit).
- `src/kode/kore/apps.ts` (owned by the Kore agent): D adds one `registerApp`/list entry ONLY if the Kore agent says to, otherwise registers through `src/features/koogalien/listing.ts` imported by the adapter, and reports it. The adapter fallback in `src/features/appstore/koreAdapter.ts` is not touched.
- `src/App.tsx` / route table: C adds the `#/koogalien` lazy mount in one additive line, if routing is not already provided by the Kore app route.
- Nobody edits `src/features/buildlog/entries.ts`. Each builder gives the lead one kid-facing build-log line in the report.

## House rules (every builder)
- Live HMR into a child's tab: every save compiles; write files complete. Never kill servers or the port-3000 process; never touch the kid's Chrome tab. Test only in the headless harness: `node scripts/screenshot.mjs steps.json outDir` (steps `{nav, wait, js, shot, viewport}`), fake MIDI with `__routeForTest` from `src/midi/connection.ts`, local notes with `playLocal` in `src/music/localNotes.ts`.
- Test real results (engine state, saved data, scheduled notes, gains/peaks), not just pictures. Read PNGs at 1280x800 and 390x844.
- One kind of export per file (components-only `.tsx`, others `.ts`), `import.meta.hot.accept(` literal, long-lived state in `import.meta.hot.data` or zustand, per-kid data through `pload/psave` only (never `localStorage` for progress). Case-insensitive filesystem: no two files differing by case.
- Pure modules (`src/koogalien/**`) import nothing from React, DOM, zustand or audio. Type-only imports from `src/kode/**` are fine. They carry `// Pure: tested by scripts/<x>.ts`.
- No network, no eval, no `Function`. Volume caps and limiter stay on; sound only through the Kore/host capped channel and `panic.ts`. At most 3 flashes/s, no full-screen flashes, reduced motion respected. No brand names in UI. Songs/music: nothing copyrighted.
- Do not commit, push, deploy, or run working-tree-changing git commands. Scratch files go in the scratchpad directory the lead names (never in the repo).
- Before reporting: `npm run typecheck`, `npm run check:catalog`, `npm run check:listen`, `npm run check:mentor`, `npm run check:loops`, `npm run check:drums`, `npm run -s build:web`, plus your own `check:koogalien*`. Errors in files you don't own: report and move on.
- Make it reachable and documented: tour stop (D), tooltip/help line (each UI builder), README row (D).
- Report under 50 lines: what you built and how a kid reaches it, PASS/FAIL tests with numbers, files changed (shared files called out), caveats, one kid-facing build-log line (middle-school tone, explain the real concept), screenshot paths.

## Order of operations
1. **T0 (A, first 30 minutes)**: write `src/koogalien/data/types.ts` and `src/koogalien/ports.ts` EXACTLY as below, and stub every function in the interface section (bodies `throw new Error('not implemented')` is NOT allowed since HMR may import them; return empty/safe values instead). Create placeholder `alphabet.ts`, `lexicon.ts`, `aliens.ts` with the hello/world entries so everyone can run against something. Add `check:koogalien` script. B, C and D may start immediately against the signatures in this doc and their own fakes; they poll for these files (`ls src/koogalien/data/types.ts`) before the first typecheck. Nobody edits `types.ts` or `ports.ts` except A; others request additive changes in their report or a note file in the scratchpad (A merges).
2. **T1**: A finishes the real data (from LANGUAGE.md), `translate`, `encode`, `recognize`, `match`, `gloss`. B finishes `parse/print/lower/toKode`, `playScore`, `modInput`. In parallel C builds `host`, `store`, `Writer`, `ribbon`, `describe`. D builds `srs`, `ladder adapter`, Dictionary, Echo Pip, listing.
3. **T2 (integration, all)**: C wires Writer to A's recognizer and B's print/play; D's Dictionary and game mounted into C's shell via `import.meta.glob` lazy tabs (so it compiles when D's files are late). Each builder runs the shared flow test below.
4. **Lead**: `npm run check:koogalienall`, full checks, then commit.

## Shared types (A writes these verbatim to `src/koogalien/data/types.ts`)
Built on LANGUAGE.md: the atom is a CHORD of scale degrees 1 to 8 (do re mi fa sol la si do'; white keys C to C' or pads 1 to 8).
```ts
// Pure: shared Koogalien types. Only builder A edits this file.
export const KOOGALIEN_VERSION = 1

export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
/** a sorted, de-duplicated set of 1..4 degrees pressed together (1 degree alone = a digit outside spell mode) */
export type Chord = readonly Degree[]

/** the sound-shaping layer. v1 uses only 'wobble' (excited); the rest are reserved so the types never change. */
export type ModName = 'wobble' | 'sweep' | 'bend' | 'tremolo' | 'filter'
export interface ModSpec { name: ModName; /** 0..1 */ depth: number }
export type Loudness = 'soft' | 'normal' | 'loud'
export interface Tone { loud: Loudness; mods: ModSpec[] }

export type WordKind = 'greeting' | 'noun' | 'verb' | 'pronoun' | 'feeling' | 'question' | 'color' | 'number' | 'connector' | 'name' | 'code' | 'closer' | 'control'
export type Ending = '.' | '?' | '!'

export interface LexEntry {
  id: string           // stable lowercase id; closers are 'period' | 'question' | 'shout'
  en: string           // the English it reads as ('.' for the period closer)
  emoji: string
  kind: WordKind
  chord: Chord         // 1..4 degrees; the single-degree chords are reserved for digits
  tier: 1 | 2 | 3      // LANGUAGE.md tiers
  unit: number         // curriculum unit that introduces it (1..9)
  alt?: string[]       // other English words that map here
}

/** a letter in spell mode: a row note (1..7) then a column note (1..4) */
export interface Glyph { ch: string; row: number; col: number; unit: number }

/** one thing in a sentence */
export type SlotKind = 'word' | 'digit' | 'spelled' | 'unknown'
export interface WordSlot {
  kind: SlotKind
  /** lexicon id when kind === 'word' */
  id: string | null
  /** English text as it reads: 'hello', '3', 'MAYA' (spelled keeps the case of the source) */
  en: string
  /** the chords as played or encoded (a spelled word: spell chord, then the single notes, as degrees) */
  chords: Chord[]
  tone: Tone
  /** 0..1: how sure the recognizer is. 1 for words made by code or text */
  confidence: number
  alts?: { id: string; confidence: number }[]
  status: 'ok' | 'maybe' | 'unknown'
}

/** THE hub value. Every view is a pure function of this. */
export interface Sentence { v: number; words: WordSlot[]; end: Ending; alien?: string }

export interface Koogalien {  // a voice
  id: string; name: string; emoji: string
  patch: Record<string, number | string>   // partial synth params applied while this voice speaks
  centre: number                            // MIDI note of the voice's do
  greeting: string                          // Koogalien code, e.g. 'say hello.'
}

export interface Diag { message: string; start: number; end: number; line: number; col: number; hint?: string }

/** timing: one beat = one quarter note */
export interface ChordEvent { word: number; degrees: Chord; midi: number[]; at: number; dur: number; vel: number }
export interface ModEvent { word: number; mod: ModSpec; at: number; dur: number }
export interface Score { v: number; bpm: number; beats: number; chords: ChordEvent[]; mods: ModEvent[]; wordStarts: number[]; /** beat where a '?' lifts the last word */ liftAt?: number }

export interface EncodeOpts { bpm: number; homeC?: number; chordBeats?: number; wordGapBeats?: number; alien?: string; velCap?: number }

/** what the recognizer reads besides tokens */
export interface ModSample { kind: 'wheel' | 'bend' | 'knob' | 'slider'; /** 0..1 (bend -1..1) */ value: number; t: number }

export interface DecodeOpts {
  bpm: number
  homeC: number            // MIDI note of do. default 60
  chordMs: number          // default 70
  wordGapBeats: number     // default 1
  wordGapFloorMs: number   // default 400 (free time)
  sentenceGapBeats: number // default 2
  slowChordMs: number      // default 1000
  modHoldMs: number        // default 250
  modThreshold: number     // default 0.4
  known?: ReadonlySet<string>
}
export const DEFAULT_DECODE: DecodeOpts = { bpm: 100, homeC: 60, chordMs: 70, wordGapBeats: 1, wordGapFloorMs: 400, sentenceGapBeats: 2, slowChordMs: 1000, modHoldMs: 250, modThreshold: 0.4 }

export const LIMITS = { lettersPerSpell: 20, wordsPerSentence: 32, codeChars: 400, shareChars: 400, outbox: 50 } as const
```
Do NOT import `KodeToken` into this file; `recognize.ts` imports it as a type from `src/kode/kodeCore`.

### Ports (A writes to `src/koogalien/ports.ts`; C implements in `host.ts`)
```ts
import type { ModSpec } from './data/types'
export interface SoundPort {
  bpm(): number
  /** current clock beat (the same timeline whenBeat uses) */
  nowBeat(): number
  note(midi: number, vel: number, whenBeat: number, durBeats: number): void
  drum(lane: number, vel: number, whenBeat: number): void
  /** stop everything this port scheduled; idempotent */
  stopAll(): void
}
export interface ModPort {
  apply(mod: ModSpec, whenBeat: number): void
  release(mod: ModSpec, whenBeat: number): void
  patch(alienId: string | null): void   // apply (or restore, null) a Koogalien voice patch
}
export interface ProgressPort { load<T>(key: string, fallback: T): T; save<T>(key: string, value: T): void }
export interface ConceptPort { mark(id: 'sequence' | 'function' | 'parameter' | 'event' | 'condition' | 'variable' | 'debug' | 'loop'): void }
export interface KoogalienHost {
  sound: SoundPort; mods: ModPort; progress: ProgressPort; concepts: ConceptPort
  guide: { show(notes: number[]): void; clear(): void }
  celebrate(kind?: string): void
  now(): number            // ms, injectable for tests
  exit(): void
}
```

## Function signatures (full)

### Builder A (`src/koogalien/data/`, `src/koogalien/engine/`)
```ts
// data/lexicon.ts, alphabet.ts, tone.ts, aliens.ts, version.ts
export const LEXICON: readonly LexEntry[]                      // ported from LANGUAGE.md section 5
export const ALPHABET: readonly Glyph[]                        // 26 letters, rows ABCD EFGH IJKL MNOP QRST UVWX YZ
export const ALIENS: readonly Koogalien[]                      // Pip, Dro, Zee
export const SPELL_ID = 'spell'                                // chord 1+2
export const SPELL_END: Chord                                  // [5, 8]
export const BACKSPACE: Degree                                 // 8, a lone note in spell mode
export const lexById: (id: string) => LexEntry | undefined
export const lexByEnglish: (en: string) => LexEntry | undefined   // checks en and alt, case-insensitive
export const lexByChord: (c: Chord) => LexEntry | undefined
export const glyphByChar: (ch: string) => Glyph | undefined
export const glyphByPair: (row: number, col: number) => Glyph | undefined
export const alienById: (id: string) => Koogalien | undefined
export const MOD_MEANINGS: readonly { name: ModName; sources: ('wheel'|'bend'|'knob'|'slider')[]; en: string }[]
export function degreeOf(midi: number, homeC: number): Degree | null     // null for black keys
export function midiOfDegree(d: Degree, homeC: number): number
export const chordKey: (c: Chord) => string                              // '1+6'

// engine/translate.ts   English -> Sentence
export function translate(text: string, known?: ReadonlySet<string>): Sentence
// engine/gloss.ts
export function gloss(s: Sentence): string                      // 'hello world.'-style English line, e.g. 'hello world'
export function sameSentence(a: Sentence, b: Sentence): boolean // ignores confidence/alts
// engine/encode.ts      Sentence -> Score
export function encode(s: Sentence, o: EncodeOpts): Score
// engine/match.ts
export function chordDistance(a: Chord, b: Chord): number       // 0..1 Jaccard distance
export function matchChord(c: Chord, known?: ReadonlySet<string>): { id: string; confidence: number }[]   // best first, max 3
// engine/recognize.ts   tokens -> Sentence (incremental and pure)
import type { KodeToken } from '../../kode/kodeCore'
export type RecInput =
  | { type: 'token'; token: KodeToken }
  | { type: 'mod'; sample: ModSample }
  | { type: 'commit'; t: number }          // chord-builder commit (pedal tap or OK pad)
  | { type: 'tick'; t: number }
export interface RecState { readonly _: unknown }   // opaque, plain data
export type RecOut =
  | { type: 'chord'; chord: Chord }                              // a chord closed (live feedback)
  | { type: 'letter'; ch: string }                               // spell mode: a letter completed
  | { type: 'word'; word: WordSlot; index: number }
  | { type: 'sentence'; sentence: Sentence }
export function newRecState(o?: Partial<DecodeOpts>): RecState
export function step(s: RecState, i: RecInput): { state: RecState; out: RecOut[] }
export function pending(s: RecState): { chords: Chord[]; words: WordSlot[]; spelling: boolean; half: Degree | null }
export function decodeAll(tokens: readonly KodeToken[], mods?: readonly ModSample[], o?: Partial<DecodeOpts>): Sentence
```
A implements exactly the behaviour in ARCHITECTURE.md section 3 and the input rules in LANGUAGE.md section 2.

### Builder B (`src/koogalien/lang/`, `src/features/koogalien/play/`)
```ts
// koogalien/lang/parse.ts
export interface Program { src: string; sentence: Sentence | null; vars: Record<string, Sentence>; errors: Diag[] }
export function parse(src: string, known?: ReadonlySet<string>): Program
// koogalien/lang/print.ts
export function print(s: Sentence): string      // canonical: `say hello world.`; spelled/unknown words in quotes: `say hello "Maya".`; mods as `~wobble` after the word
export function printWord(w: WordSlot): string
// koogalien/lang/lower.ts
export function lower(p: Program): Sentence      // joins say lines and vars in order
// koogalien/lang/share.ts
export function toShare(s: Sentence): string     // 'v1~' + encodeURIComponent(print(s)); <= LIMITS.shareChars or throws RangeError
export function fromShare(code: string): Program // never throws
// koogalien/lang/toKode.ts
export function toKode(score: Score): string    // `notes "c4 e4 g4 ~ a4"`-style lines for the Koog Kode editor
// koogalien/lang/suggest.ts
export function closestWord(en: string): { id: string; en: string } | null   // edit distance <= 2

// features/koogalien/play/playScore.ts
export interface PlayHandle { stop(): void; done: Promise<void> }
export function playScore(score: Score, host: Pick<KoogalienHost, 'sound' | 'mods' | 'now'>, o?: { alien?: string; onWord?: (i: number) => void; lookaheadMs?: number }): PlayHandle
// features/koogalien/play/modInput.ts
export function startModInput(on: (s: ModSample) => void): () => void   // MIDI CC1 + pitch bend; additive wiring
export function emitMod(s: ModSample): void                                // on-screen slider path, same stream
```
Syntax v1 (canonical in ARCHITECTURE.md section 4): `say <words and digits> <closer>`, quotes spell a name, `let name = ...`, `say name`, `# comment`, `~wobble` after a word. Limits from `LIMITS`; an unknown word gives a `Diag` with `hint` from `closestWord`, and bare unknown words are NOT auto-spelled (the kid must quote them, which teaches spell mode).

### Builder C (`src/features/koogalien/`)
```ts
// store.ts (zustand; instance kept in import.meta.hot.data)
export interface KoogalienState {
  tab: 'write' | 'dictionary' | 'learn'
  sentence: Sentence | null
  listening: { chords: Chord[]; words: WordSlot[]; spelling: boolean; half: Degree | null }
  code: string
  playingWord: number | null
  alien: string
  bpm: number
  wobble: number                 // on-screen mod slider 0..1
  chordBuilder: boolean          // accessibility mode: keys stay lit until commit
  status: string
}
export const useKoogalien: ReturnType<typeof create<KoogalienState>>
export const koogalienActions: {
  startListening(host: KoogalienHost): () => void   // startKode() + onToken + startModInput; returns stop
  clear(): void
  setCode(src: string): void                         // parse -> sentence
  hear(host: KoogalienHost): PlayHandle | null
  boundary(kind: 'word' | 'end'): void               // on-screen Space / End buttons
  commit(): void                                      // chord-builder OK
  confirmAlt(wordIndex: number, id: string): void     // resolves a 'maybe'
  setAlien(id: string): void
}
// ribbon/describe.ts (pure)
export function describeSentence(s: Sentence): string
export function describeWord(w: WordSlot, i: number): string
// ui/Host.tsx: the ONLY file that touches the mascot component
export type HostPose = 'wave' | 'listen' | 'teach' | 'cheer' | 'puzzled' | 'sleep'
export function KoogAlienHost(p: { pose: HostPose; say?: string; size?: number }): JSX.Element   // uses src/brand/mascot via import.meta.glob; emoji fallback
// components
export default function KoogalienApp(p: { kore: unknown }): JSX.Element     // lazy default export
export function Writer(p: { host: KoogalienHost }): JSX.Element
export function SentenceRibbon(p: { sentence: Sentence | null; playing: number | null; listening?: { chords: Chord[] }; compact?: boolean }): JSX.Element
// host.ts
export function makeHost(kore: unknown | null): KoogalienHost    // wraps Kore; falls back to src/music + audioClock when Kore is absent
```
Shell tabs: Write | Dictionary | Learn. Dictionary and Learn load with `import.meta.glob('./dictionary/Dictionary.tsx')` and `import.meta.glob('./learn/EchoGame.tsx')` (lazy; a "coming soon" card if the glob is empty) so the shell compiles whether or not D has landed.

### Builder D (`src/koogalien/learn/`, `src/features/koogalien/dictionary|learn|listing.ts`)
```ts
// koogalien/learn/srs.ts (pure)
export interface Card { id: string; box: 1|2|3|4|5; due: number /* ms epoch */; seen: number; right: number }
export const BOX_DAYS: readonly [0,1,3,7,14]
export function newCard(id: string, now: number): Card
export function review(c: Card, correct: boolean, now: number): Card
export function due(cards: readonly Card[], now: number, limit: number): Card[]
// koogalien/learn/ladder.ts (pure) rungs for words
export type Rung = 'hunt' | 'follow' | 'echo' | 'memory' | 'full' | 'master'
export const RUNGS: readonly Rung[]
export interface WordProg { rung: Rung | null; stars: number; best: number }
export function nextRung(p: WordProg, passed: boolean, stars: number): WordProg
export function isLearned(p: WordProg): boolean   // reached echo
export function isKnown(p: WordProg): boolean     // passed master
export function unitUnlocked(unit: number, prog: Record<string, WordProg>): boolean
// koogalien/learn/checks.ts (pure)
export function judgeWord(played: Chord, want: LexEntry): { ok: boolean; confidence: number }
export function pickRound(unit: number, cards: readonly Card[], now: number, n: number, seed: number): LexEntry[]
// features/koogalien/dictionary/Dictionary.tsx  default export: (p:{host:KoogalienHost}) => JSX.Element
// features/koogalien/learn/EchoGame.tsx         default export: (p:{host:KoogalienHost}) => JSX.Element
// features/koogalien/listing.ts                 export const KOOGALIEN_APP; export function registerKoogalien(): void
```
Progress key `'koogalien'` via `host.progress`: `{ v:1, words: Record<string, WordProg>, cards: Card[], sentences: number, stars: number }`.

## Builder prompts (paste as-is; each is self-contained with the sections above)

### Prompt A: Core language engine
You are Builder A for Koogalien v1 in the Koog repo. Read docs/koogalien/{ARCHITECTURE,CURRICULUM,LANGUAGE,BUILD_PLAN}.md, docs/DEVELOPING.md and the shared BRIEF.md (the lead gives you its path). You own `src/koogalien/data/**`, `src/koogalien/engine/**`, `src/koogalien/ports.ts`, `scripts/koogalien-fixtures.ts`. FIRST (within 30 minutes): write `types.ts` and `ports.ts` exactly as in BUILD_PLAN, plus safe stubs (return empty values; never throw) for every signature under "Builder A", and add `check:koogalien` to package.json (additive). Then implement: the data ported from LANGUAGE.md (full lexicon table, closers, 26 letters, 3 voices Pip/Dro/Zee with distinct synth patches, MOD_MEANINGS with `wobble`), `degreeOf`, `translate`, `gloss`, `encode`, `chordDistance`/`matchChord`, and the pure `recognize` reducer (chord window 70 ms, slow chord, chord-builder commit, word boundary by rest or pedal, sentence timeout, closers, digits, spell mode with row/column pairs, backspace, spell-end, confidence 0.85 and 0.5 thresholds, tone and wobble). Fixtures (pure, no DOM): a fixture re-parses the LANGUAGE.md lexicon table and asserts it equals `LEXICON` (no drift); data invariants (unique chords, 1 to 4 degrees, ids stable, all 26 letters reachable, tier-1 words are exactly hello world say I you yes no Koog friend happy love music); `translate("hello world.")`, `encode`, synthesize `KodeToken`s from the Score, `decodeAll` equals the original sentence (round trip) for every lexicon word and 50 seeded random sentences with noise (up to 30 ms jitter inside a chord, 20% velocity change); spelled "maya" round trips; chord window edges (60 ms ok, 150 ms splits); boundaries by rest, pedal, double pedal; pad lanes behave as keys; black keys ignored; a one-key miss gives `maybe` with alts and garbage gives `unknown`; wobble from CC1 above 0.4 for 250 ms attaches to the word; 10,000 random tokens finish in under 200 ms. Acceptance: `npm run check:koogalien` PASS, typecheck clean, no DOM or audio imports, seeded and deterministic. Report per the house rules.

### Prompt B: Code language + hear-it-back
You are Builder B for Koogalien v1 in the Koog repo. Read the same docs. You own `src/koogalien/lang/**`, `src/features/koogalien/play/**` (includes `modInput.ts`), `scripts/koogalien-lang-fixtures.ts`, `scripts/koogalien-play-fixtures.ts`. Wait for A's `src/koogalien/data/types.ts` (poll `ls`); until then code against the BUILD_PLAN signatures. Implement `parse`, `print`, `lower`, `share`, `toKode`, `suggest`, `playScore`, `startModInput`, `emitMod`. Parser: hand-written, no eval, no catastrophic regexes, honours `LIMITS`, friendly `Diag` with positions and `hint`. `playScore` schedules everything up front through `host.sound.note(midi, vel, whenBeat, dur)` (never chained setTimeout), caps velocity at 0.85 and polyphony at 6, applies the voice patch first and restores it on stop or end, drives `ModPort.apply/release` for `wobble` spans, lifts the last word on a `?` using `score.liftAt`, calls `onWord` from a lookahead timer reading `host.now()`, and `stop()` cancels via `sound.stopAll()`. `startModInput` listens to MIDI CC1 (value/127) and pitch bend (0xE0) through the existing MIDI routing (additive; no edits to connection.ts unless a tiny hook is unavoidable, then report it) and to `emitMod`. Fixtures: `print(parse(print(s))) === print(s)` for 100 random sentences; error cases with exact positions and hints; `let`/`say` joins; quoted-name spelling; share link round trip and length cap; `fromShare` never throws on 1,000 garbage strings; a fake `SoundPort`/`ModPort` records calls: hello world notes land at the exact beats, none after `stop()`, velocity at most 0.85, voice patch applied then restored, wobble applied then released on the right beats. Acceptance: `check:koogalienlang` and `check:koogalienplay` PASS; a real audio harness test plays hello world and the host channel peak stays under the cap with the limiter on.

### Prompt C: Writer, ribbon and app shell
You are Builder C for Koogalien v1 in the Koog repo. Read the same docs. You own the shell files in `src/features/koogalien/` (`KoogalienApp.tsx`, `host.ts`, `store.ts`, `brand.ts`, `Writer.tsx`, `koogalien.css`, `ui/**`, `ribbon/**`), `scripts/koogalien-ui-fixtures.ts`, `scripts/shots/koogalien-*.json`. Build the headline flow: the Write tab with a big pad strip (8 pads, also the on-screen way to play), a "Listening..." column showing chords as they arrive (and half a spelled letter), the `SentenceRibbon` (notes row, code row, English row, aligned by word; `maybe` words dashed with "Did you mean?" and tappable alternatives), a code editor that stays in sync both ways, buttons Hear it, Clear, Space (word break), End (closer) and Copy link (B's `toShare`, nothing networked), the chord-builder switch (keys stay lit until OK), a voice picker (Pip/Dro/Zee) and a Wobble slider (calls `emitMod`). The Koog Alien mascot hosts the screen through `ui/Host.tsx` (the only file that imports from `src/brand/mascot/`, via `import.meta.glob` with an emoji fallback): wave on open, listen while chords arrive, cheer on a clean sentence, puzzled on `maybe`/`unknown`; its animation obeys reduced motion and the 3-flash limit. Implement `describeSentence` for screen readers and an `aria-live="polite"` region. Colors from the Okabe-Ito palette plus shape and label per word kind; contrast 4.5:1; highlight is a steady underline, never a blink. Implement `makeHost(kore)` wrapping the Kore SDK (tolerate its absence: fall back to `src/music/masterClock`, `audioClock` and the synth), registering sound with `src/music/panic.ts` and a capped channel in `src/audio/host.ts`. Mark concepts via `host.concepts` as ARCHITECTURE.md section 7. Mount D's tabs by `import.meta.glob`. Fixtures: `describeSentence` snapshots, store tests (token feed to sentence), and harness flows: (1) open `#/koogalien`, play hello (1+6) and world (1+5+8) via `playLocal` with a 1.4-beat rest, assert gloss `hello world`, code row `say hello world.`, English row `hello world`, three rows with equal column counts; (2) Hear it, assert scheduled notes match the Score and `onWord` advances 0 then 1; (3) edit the code to `say hello friend.`, assert the ribbon updates; (4) chord-builder: press 1 then 6 then OK, same result as a chord; (5) a 390x844 screenshot with no horizontal scroll. Acceptance: all flows PASS, `check:koogalienui` PASS, screenshots read critically, no console errors.

### Prompt D: Dictionary, Echo game, SRS, App Store listing
You are Builder D for Koogalien v1 in the Koog repo. Read the same docs. You own `src/koogalien/learn/**`, `src/features/koogalien/dictionary/**`, `src/features/koogalien/learn/**`, `src/features/koogalien/listing.ts`, `scripts/koogalien-learn-fixtures.ts`. Implement the pure SRS (5 Leitner boxes, `BOX_DAYS`, injected `now`), the word ladder (reuse names and pass rules from `src/features/games/holiday/data.ts` and `engine.ts`; use `kore.ladder` through the host only if it exists, otherwise your own `ladder.ts`), `judgeWord` (via A's `matchChord`) and `pickRound`. Dictionary: grid of all words, digits and letters grouped by unit, search by English, play-to-look-up (listens through `startKode`, shows the nearest words with confidence), each card shows emoji, the 8-pad strip with the chord lit, code (`say x.` via B's `print`), English, the "why it sounds right" line from LANGUAGE.md, a Hear It button (B's `playScore`), a ladder badge, and locked/unlocked by unit. EchoGame (the Koog Alien and a Koogalien voice say a word or short sentence, the kid plays it back; rung Echo; scored by `judgeWord`; stars; SRS picks the next words; `host.celebrate` on a perfect round; `concepts.mark('event')` on a correct word; coach lines in kid tone; Hunt & Peck and Follow rungs use `host.guide.show`). Use the mascot only via C's `ui/Host.tsx`. Store progress under key `koogalien` via `host.progress`. Listing: `listing.ts` exports the manifest (`id:'koogalien'`, name from `KOOGALIEN_NAME`, a mascot-or-alien emoji icon, tagline "Learn Koogalien, the alien language: play notes, read words.", concepts sequence/event/variable, inputs keys/drums/dj/pedal/screen, ages [7,99], minutes 10, route `#/koogalien`, status `beta`, lazy component `() => import('../KoogalienApp')`) and `registerKoogalien()`; add it to the Kore registry (`src/kode/kore/apps.ts`, one additive line) or the Store adapter as agreed with the lead. Shared additive edits you OWN: `src/links/links.ts` and `src/links/catalog.ts` (route), then `npm run build:catalog` and `npm run check:catalog`; ONE tour stop appended at the END of `src/features/gallery/stops.data.ts`; ONE README feature-table row. Fixtures: SRS moves on right and wrong, due ordering with an injected clock, `unitUnlocked`, `pickRound` determinism and no repeats, `judgeWord` accepts a chord played with 30 ms jitter and rejects a different word, progress save/load round trip. Harness: open the Dictionary, search "hello", press Hear It, assert notes scheduled; play the Echo game with fake MIDI, assert the card moves box and stars are saved under the player's `koogalien` key; confirm the App Store lists Koogalien. Acceptance: `check:koogalienlearn` and `check:catalog` PASS, 390x844 and 1280x800 screenshots read, tour stop reachable.

## Shared flow test (all builders run it once integrated; C owns the script)
`scripts/shots/koogalien-hello.json`: nav to `#/koogalien`; `js`: `playLocal` the hello chord (pads 1+6 = C and A), wait 1400 ms (at least 1 beat at 100 bpm), `playLocal` the world chord (1+5+8 = C, G, C'), then the period closer (5+8); assert `useKoogalien.getState().sentence` gloss is `hello world`, `print()` is `say hello world.`, `describeSentence` mentions both words, press Hear it, read the scheduled notes from the fake `SoundPort`, assert every velocity <= 0.85 and the first chord lands at beat 0.

## Acceptance for v1 as a whole
- The headline scene works with keys, with pads (drum, DJ and on-screen all map to degrees 1 to 8), with a pedal tap as the word break, and with the on-screen Space/End buttons and chord-builder mode (no hardware needed).
- The Dictionary lists every lexicon word, play-to-look-up finds the right word at confidence >= 0.85 for a clean play.
- The Echo game completes a round and saves progress per player; switching player changes the saved data.
- Koogalien appears in the App Store with a working Open button, hosted by the Koog Alien mascot (or its fallback).
- `npm run check:koogalienall` PASS; `typecheck`, `check:catalog`, listen/mentor/loops/drums, `build:web` PASS.
- Zero network requests (harness request log), zero `eval`/`Function`, peaks under cap, no flash over 3/s, reduced motion works, every sentence has screen-reader text.

## Risks and decisions
- If Kore has not landed, C's `makeHost` fallback keeps everything working; swap to the Kore props later in one file.
- If the mascot component is late, `ui/Host.tsx` shows an emoji badge; nothing else changes.
- LANGUAGE.md is v0 and its section 7 (tone) was not yet written when this was planned; v1 uses loudness plus `wobble` and the types reserve the rest.
- Dictionary and the Echo game mount by glob; if D is late the shell shows "coming soon".
