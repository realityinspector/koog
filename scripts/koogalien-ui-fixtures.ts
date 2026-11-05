// Koogalien Writer: describe text, and the store (tokens -> sentence -> code -> Hear it) against a fake host. No DOM, no audio.
//   npx --no-install tsx scripts/koogalien-ui-fixtures.ts        (exit 1 on any failure)
import { describeSentence, describeWord, describeChord } from '../src/features/koogalien/ribbon/describe'
import { useKoogalien, koogalienActions as act } from '../src/features/koogalien/store'
import { gloss } from '../src/koogalien/engine/gloss'
import { print } from '../src/koogalien/lang/print'
import type { KoogalienHost } from '../src/koogalien/ports'
import type { KodeToken } from '../src/kode/kodeCore'
import type { Sentence } from '../src/koogalien/data/types'

let fails = 0, passes = 0
function ok(name: string, cond: boolean, extra = '') { if (cond) passes++; else { fails++; console.log(`FAIL ${name} ${extra}`) } }
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }

// ---- describe (pure)
eq('describeChord', describeChord([1, 6]), 'do and la together')
const word = (id: string, en: string, chords: number[][], status: 'ok' | 'maybe' | 'unknown' = 'ok') => ({ kind: 'word' as const, id, en, chords: chords as never, tone: { loud: 'normal' as const, mods: [] }, confidence: 1, status })
const hw: Sentence = { v: 1, words: [word('hello', 'hello', [[1, 6]]), word('world', 'world', [[1, 5, 8]])], end: '.' }
const d = describeSentence(hw)
ok('describe mentions hello', d.includes('hello'))
ok('describe mentions world', d.includes('world'))
ok('describe says 2 words', d.includes('2 words'))
ok('describe full stop', d.includes('full stop'))
ok('describe means', d.endsWith('Means: hello world.'), d)
eq('describe empty', describeSentence(null), 'No Koogalien sentence yet.')
ok('describe maybe', describeWord(word('hello', 'hello', [[1, 6]], 'maybe'), 0).includes('not sure'))
ok('describe unknown', describeWord(word('x', '?', [[2]], 'unknown'), 0).includes('not a Koogalien word'))
ok('describe wobble', describeWord({ ...word('hello', 'hello', [[1, 6]]), tone: { loud: 'loud', mods: [{ name: 'wobble', depth: 0.6 }] } }, 0).includes('wobbly'))

// ---- the store, with a fake host
const notes: { midi: number; vel: number; beat: number; dur: number }[] = []
const marks: string[] = []
const saved: Record<string, unknown> = {}
let clock = 0
const host: KoogalienHost = {
  sound: { bpm: () => 100, nowBeat: () => 0, note: (midi, vel, beat, dur) => { notes.push({ midi, vel, beat, dur }) }, drum: () => {}, stopAll: () => {} },
  mods: { apply: () => {}, release: () => {}, patch: () => {} },
  progress: { load: <T,>(k: string, f: T) => (k in saved ? (saved[k] as T) : f), save: (k, v) => { saved[k] = v } },
  concepts: { mark: (id) => { marks.push(id) } },
  guide: { show: () => {}, clear: () => {} },
  celebrate: () => {}, now: () => clock, exit: () => {},
}
const key = (midi: number, t: number): KodeToken => ({ src: 'keys', value: midi, pitch: midi, vel: 0.5, t })
const play = (midis: number[], t: number) => { midis.forEach((m, i) => act.feedToken(key(m, t + i * 12))); clock = t + 200; act.tick(clock) }
const st = () => useKoogalien.getState()

act.init(host)
act.clear()
play([60, 69], 1000)                 // hello = 1+6 (C and A)
play([60, 67, 72], 1900)             // world = 1+5+8, 0.9 s later (1.5 beats at 100 bpm: a word break, under the 2-beat sentence gap)
play([67, 72], 2800)                 // the period closer 5+8
clock = 3300; act.tick(clock)
const s = st().sentence
ok('sentence made', !!s && s.words.length === 2, JSON.stringify(s))
if (s) {
  eq('gloss', gloss(s), 'hello world')
  eq('print', print(s), 'say hello world.')
  ok('ended', st().ended)
  ok('describe mentions both', describeSentence(s).includes('hello') && describeSentence(s).includes('world'))
}
eq('code box synced', st().code, 'say hello world.')
ok('sequence marked', marks.includes('sequence'))

// Hear it
const h = act.hear(host)
ok('hear returns a handle', !!h)
ok('notes scheduled', notes.length >= 5, String(notes.length))
ok('velocity <= 0.85', notes.every((n) => n.vel <= 0.85 + 1e-9), JSON.stringify(notes.map((n) => n.vel)))
ok('first chord at the start', notes.length > 0 && notes[0].beat <= 0.2 + 1e-9 && notes[0].beat >= 0, String(notes[0]?.beat))
h?.stop()

// code -> sentence, both ways
act.setCode('say hello friend.')
eq('edit code', st().sentence ? gloss(st().sentence!) : null, 'hello friend')
act.setCode('say hello wurld.')
ok('bad code reports an error and keeps the last good sentence', st().codeErrors.length > 0 && !!st().sentence)
act.setCode('')
ok('empty code clears', st().sentence === null)

// chord builder: 1, 6, OK == the chord
act.clear(); act.setChordBuilder(true)
act.feedToken(key(60, 5000)); act.feedToken(key(69, 6000))
ok('builder keeps keys lit', st().lit.length === 2)
clock = 6500; act.commit()
act.setChordBuilder(false)
clock = 9000; act.tick(clock); act.boundary('end', '.')
ok('builder chord becomes hello', !!st().sentence && gloss(st().sentence!) === 'hello', JSON.stringify(st().sentence?.words.map((w) => w.en)))

// settings persist per player (through the host)
act.setAutoAccept(true)
ok('auto-accept saved', (saved['koogalien-settings'] as { autoAccept?: boolean })?.autoAccept === true)
act.setAutoAccept(false)

// share and outbox
act.setCode('say hello world.')
const link = act.share()
ok('share link', !!link && link.startsWith('v1~'), String(link))
ok('outbox saved', Array.isArray(saved['koogalien-box']) && (saved['koogalien-box'] as unknown[]).length === 1)

console.log(`koogalien-ui: ${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
