# High Koogalien

High Koogalien is the advanced register of Koogalien, made for reading whole books (THESIS.md, "Reaching literature: more musical dimensions = more words"). It is expressive rendering on top of the plain words. It never changes which word a chord means and never changes how v1 matches a chord: a test runs every lexicon word through High and checks the id and chord are untouched.

- **Plain Koogalien** says each word as itself, in one voice (Pip), at one tempo. It is v1 exactly, only paced by the speed preset.
- **High Koogalien** sets the optional fields Builder A reserved on `WordSlot` (`durationClass`, `dyn`, `arp`, `keyCenter`, `mode`, `register`, `tempo`, `mod`) and lays the sentence out in time.

Code: `src/koogalien/library/high.ts` (pure). The rules are also data (`HIGH_RULES`), which the reader's "What is High Koogalien?" card reads. Tests: `npm run check:library`.

## The rules

| Dimension | Field | Rule | Means |
|---|---|---|---|
| Voice | patch | A quoted line is spoken by Pip, Dro or Zee, the narrator is the unpatched synth. A named speaker keeps one voice for the whole book (first heard = Pip, then Dro, then Zee, then around again); an unnamed quote in a new paragraph answers the last speaker with the speaker before. | who is speaking |
| Key | `keyCenter` | Chapter n is in the n-th key of C, G, D, A, E, B, F, B-flat, then around again (folded into -5 to +6 semitones so every voice stays in range). | where in the book we are |
| Mode | `mode` | A dark scene is minor: degrees 3, 6 and 7 are lowered a semitone. | mood |
| Tempo | `tempo` | Scene tempo: calm 84, steady 96, joyful 108, action 124, dark 80 (100 = the base). | narrative time |
| Duration | `durationClass` | A plural, a past tense or a possessive of a lexicon word (`dogs`, `walked`, `rabbit's`) plays the base word's chord held twice as long. The word after `very`, `so`, `too`, `really`, `quite` is also held long. | plural, past, very |
| Dynamics | `dyn`, tone | Names (a capitalised word that does not start a sentence), CAPITALS and `_stressed_` words are loud. A whisper, a murmur or a thought (read from the attribution) makes the sentence soft; a shout or cry makes it loud. | emphasis, a name, a whisper |
| Question | `mod` | A question lifts its last word one whole step and sweeps the filter closed for the word. An inner question (`"Is it?" said Alice.`) is lifted too. | a question |
| Shout | `mod`, `dyn` | A `!` clause ends loud with the v1 wobble. | excited |
| Breath | timing | A comma is a breath of half a beat, a dash 0.7, a semicolon or colon 0.9; a paragraph ends with 3.5 beats of rest and a chapter with 7. | phrasing |
| Arpeggio | `arp` | Chord-words that mean toward (`come`, `give`, `bring`, `here`, `up`) roll up; words that mean away (`go`, `take`, `leave`, `away`, `down`, `out`, `off`) roll down. | toward / away |
| Register | `register` | A chapter title is spoken an octave low. | a heading voice |
| Spelling | timing | Spelled words run at double speed (hops a quarter beat apart) so rare words stay short. | rare words |

Scenes are chosen from a paragraph's words alone (action words and `!`, dark words, joyful words, long descriptive sentences without dialogue); no plot guessing. Speed presets multiply all time: story time 1.25, read-aloud 2, fast reader 3.2.

## What High never does

- It never turns a spelled word into a different word, or a chord into a different chord. (Folding `dogs` onto `dog` only happens when `dog` is a chord-word, and the English row still shows `dogs`.)
- It never goes above the velocity cap (0.85) or the polyphony cap (6 notes at once); the host and `playScore` enforce both.
- It never flashes the screen. The word being heard gets a steady underline.

## Coverage

`src/koogalien/library/coverage.json` (written by `npm run build:library`) holds, per book, the known chord-words, the spelled words, the ratio, the High ratio (plurals and past tenses folded onto their chord word) and the 50 most common spelled words. A research loop reads it to decide which words earn a chord.

## The library pipeline

`scripts/build-library.ts` (grown-ups run it, never kids, never at runtime):

1. Raw text from the public-domain source is read from `private/library-raw/` (gitignored; treated as untrusted data and never executed). `-- --download` fetches them politely, one at a time, four seconds apart.
2. `clean.ts` removes the header, footer, licence, credit lines, illustration tags, footnote marks and every trademark mention. `chapters.ts` cuts chapters by heading or table of contents. `text.ts` cuts sentences (it knows `Mr.`), joins "said Alice." onto its quote and detects speakers.
3. `build.ts` translates each sentence with `translate` and `print` and writes `src/koogalien/library/editions/<id>.json`: chapters of paragraphs of `[english, code, voice]`. The reader re-translates from the English, so growing the lexicon improves every book without a rebuild; the stored code is the snapshot for diffs.
4. A book is only built when its year is 1930 or earlier. Short books ship whole; long novels ship their first chapters (`ship` in `sources.ts`) and `-- --all` builds every chapter (do not commit those).
