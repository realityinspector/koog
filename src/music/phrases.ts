// Phrase memorization: the shared contract for SONGS, games and the sheet.
// A song is cut into small PHRASES (2-3 notes at first), and each one climbs a SCAFFOLD ladder,
// from "watch the glowing key, one finger" up to "play it from memory, in time, with both hands".
// Phrases then CHAIN into bigger ones (2 -> 4 -> 8 notes -> the whole song).
// Mastery is saved per kid, so practice in one place (SONGS, BachDoom, Zombie Lanes...) counts everywhere.
// STABLE API (the implementation lives in src/music/phraseEngine.ts): see the types below. Extend freely, don't rename.
import type { SongNote } from '../features/songs/songs'

/** the scaffold ladder, easiest first */
export type Rung =
  | 'listen'   // 1. hear it and watch the keys light up (no playing needed)
  | 'follow'   // 2. one finger: play each note while its key is lit (no timing)
  | 'echo'     // 3. hear it once, then play it back with the guide shown briefly
  | 'memory'   // 4. play it with no key guide (the sheet music may show it)
  | 'timed'    // 5. from memory AND in time (rhythm window)
  | 'blind'    // 6. from memory, in time, no sheet either
  | 'hands'    // 7. add the left hand (sheet level Easy/Full, see src/music/sheetLevel.ts)
export const RUNGS: Rung[] = ['listen', 'follow', 'echo', 'memory', 'timed', 'blind', 'hands']

export interface Phrase {
  /** stable id: `${songId}:${start}-${end}` (indices into song.notes, end exclusive) */
  id: string
  songId: string
  start: number
  end: number
  /** the sounding notes (rests dropped), with beat offsets from the phrase start */
  notes: { note: number; beat: number; beats: number }[]
  /** 1 = a tiny phrase (2-3 notes), 2 = two of those chained, 3 = a line, 4 = the whole song */
  size: 1 | 2 | 3 | 4
}

export interface PhraseMastery {
  rung: Rung
  /** clean passes at the current rung (3 in a row climbs a rung) */
  streak: number
  /** last time practised (ms epoch), for spaced review */
  last: number
  /** misses at this rung (shown as "keep going", never as shame) */
  misses: number
  /** ADDED: when the whole ladder (through 'hands') was first completed; undefined until then */
  mastered?: number
}

/** how one attempt at a phrase went, note by note */
export interface NoteResult { expected: number; played: number | null; timingMs: number | null; ok: boolean; why?: 'wrong' | 'early' | 'late' | 'missing' }
export interface Attempt { phraseId: string; rung: Rung; results: NoteResult[]; clean: boolean; /** ADDED: true when cancelled before the end (nothing is recorded) */ cancelled?: boolean }

export type PhraseEvent =
  | { type: 'start'; phrase: Phrase; rung: Rung }
  | { type: 'note'; phrase: Phrase; index: number; result: NoteResult }
  | { type: 'done'; attempt: Attempt }
  | { type: 'climb'; phrase: Phrase; from: Rung; to: Rung }
  | { type: 'chain'; from: Phrase[]; to: Phrase }

/** What src/music/phraseEngine.ts provides (implemented by the core agent). */
export interface PhraseEngineApi {
  /** cut a song into phrases of a size: musically (at rests, long notes and cadences), never mid-beat */
  segment(songId: string, notes: SongNote[], size: Phrase['size'], beatsPerBar?: number): Phrase[]
  /** mastery for the active kid */
  mastery(phraseId: string): PhraseMastery
  /** the next phrase to practise in a song (spaced review + "climb the lowest first") */
  nextPhrase(songId: string, notes: SongNote[], beatsPerBar?: number): { phrase: Phrase; rung: Rung }
  /** run one attempt: listens to src/music/judge.ts onJudge, grades notes against the rung's rules, records mastery */
  attempt(phrase: Phrase, rung: Rung, opts?: { bpm?: number; startAt?: number; timingWindowMs?: number; onEvent?: (e: PhraseEvent) => void }): { cancel(): void; done: Promise<Attempt> }
  /** play the phrase for the kid to hear (through the current instrument), lighting the keybed guide */
  demo(phrase: Phrase, bpm?: number): Promise<void>
  onPhraseEvent(fn: (e: PhraseEvent) => void): () => void
}

// ---- ADDITIONS (core agent) ----
// What the trainer/engine is showing right now. The engine sets it for the length of an attempt (and clears it after).
// Sheet: when `hideSheet` is true, hide the notes for this phrase (blind rung). Games: read `phrase`/`rung`/`index` to follow along.
import { create } from 'zustand'

export interface PhraseViewState {
  /** the phrase being practised, or null when nothing is */
  phrase: Phrase | null
  rung: Rung | null
  /** index (into phrase.notes) of the NEXT note to play */
  index: number
  /** true on the 'blind' rung: do not draw the sheet music for this phrase */
  hideSheet: boolean
  /** keybed agent: true once the kid used the 'peek' hint (a dot on the next key after 2 s of hesitation) in this attempt. The engine should treat the pass as NOT clean and reset it to false at each attempt start. */
  peekUsed?: boolean
}
const VIEW0: PhraseViewState = { phrase: null, rung: null, index: 0, hideSheet: false, peekUsed: false }
function makeView() { return create<PhraseViewState>()(() => ({ ...VIEW0 })) }
export const usePhraseView = (import.meta.hot?.data.phraseView as ReturnType<typeof makeView> | undefined) ?? makeView()
export const setPhraseView = (v: Partial<PhraseViewState>) => usePhraseView.setState(v)
export const clearPhraseView = () => usePhraseView.setState({ ...VIEW0 })

/** extra tunables the engine understands (additive) */
export const CLEAN_TO_CLIMB = 3
export const REVIEW_AFTER_MS = 24 * 3600 * 1000
export const DEFAULT_WINDOW_MS = 120

if (import.meta.hot) {
  import.meta.hot.data.phraseView = usePhraseView
  import.meta.hot.accept()
}
