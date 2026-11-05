# Koogalien language spec v0

Status: v0 draft, planner 1. Companion to `THESIS.md` (why) and `ARCHITECTURE.md` (how it is built). Builders: every musical decision in this file belongs in ONE data module (`src/koogalien/data/`), so changing a chord later is a one-line edit plus a fixture regeneration, never a refactor.

## 0. Names

- **Koogalien** is the language ("the Koogalese language system"): notes, chords, rhythm and sound-shaping that line up with words.
- **Koogalien** is also the name of the Koog module that teaches it. "Learn Koogalien with the Koog Alien."
- **The Koog Alien** is the single friendly mascot: the face of Koog and the host of the Koogalien module (being designed separately).
- **Koogaliens** (plural) are the friendly alien characters who speak Koogalien. Kids learn it to talk with them. Each has its own synth patch (its voice) and can teach, greet, quiz and reply.
- A **sentence** is both a sentence and a tiny program. Words are tokens, the grammar is the syntax, and `say hello world.` is at once English, code and a melody.

## 1. The design in one page (v1 = the hybrid)

Koogalien has three layers. A kid meets them in this order, and each layer is complete on its own.

1. **Word-chords (the vocabulary).** About 120 starter words, each a short chord (2 to 4 keys pressed together) built from 8 notes: one octave, do re mi fa sol la si do'. Chords are the words of the language. You do not have to spell; you press a shape.
2. **Spell mode (the safety net).** Any exact text, including names and words not in the lexicon, is spelled with fixed two-note hops: first note picks a row of 4 letters, second note picks the letter in the row. 26 letters, no exceptions.
3. **Tone (the feeling).** How you play a word changes its meaning slightly: loud or soft, major-flavoured or minor, and in advanced Koogalien, wobble, sweep and bend from the synth. See section 7.

Rules that hold everywhere:

- 8 notes only. White keys C to C', or 8 pads (DJ pads, drum pads, on-screen pads). Pad 1 is do, pad 8 is do'. Everything is playable with no sharps or flats.
- One hand is enough for every word of 4 keys or fewer. Two-note and three-note words come first.
- Word boundary = a rest (about one beat) or a pedal tap. A word can never contain a rest.
- Sentences are tiny. A sentence ends with a **closer** chord: `.`, `?` or `!`.
- A single note on its own is a digit (1 to 8).
- Nothing about Koogalien needs a screen to be understood. The screen only shows the translation.

Why a hybrid, and what was rejected, is argued in `THESIS.md` section 4.

## 2. Input rules (what counts as a word)

Pads and keys are numbered **1 to 8** (do re mi fa sol la si do') and also named C D E F G A B C'. Both appear in this file.

| Gesture | Meaning |
|---|---|
| Keys pressed within 70 ms of each other | one **chord** (a word, or a punctuation chord) |
| Keys played one after another, in spell mode | letters |
| A single key outside spell mode | a digit, 1 to 8 |
| Rest of 1 beat or more (or 400 ms in free time), or one pedal tap | word boundary |
| Rest of 2 beats or more, or two pedal taps | sentence timeout (acts like `.` if the kid forgot the closer) |
| Chord window not closed (you hold a key for 1+ second and add a key) | commits the held keys as one chord ("slow chord" for small hands) |

**Chord builder (accessibility mode).** For kids who cannot press several keys at once, or who use a single pad or switch: press keys one at a time, each stays lit, then tap the pedal (or the big "OK" pad) to commit them as one chord. The recogniser treats the result exactly like a simultaneous chord. This mode is always available and is not a "baby mode"; it is how the on-screen keyboard works on a phone.

**Timing is forgiving.** Beats are loose. Only the order of words and the key sets matter. Rhythm carries meaning only in the advanced tone layer.

## 3. Spell mode: the alphabet

Enter spell mode with the word-chord `spell` (1 + 2, the two touching keys: "tiny pieces"). Inside spell mode:

- Every letter is **two notes played in sequence** (a row note, then a column note).
- The row note is pad 1 to 7. The column note is pad 1 to 4 (do, re, mi, fa).
- The rows are the classic alphabet chunks of the ABC song: ABCD, EFGH, IJKL, MNOP, QRST, UVWX, YZ. The kid already knows this chunking.
- Letters are fixed width (always two notes), so no separator is needed between letters, and a half-finished letter is detected immediately.
- A chord pressed together in spell mode is a control: `.` (5 + 8) ends spell mode, do' (pad 8) alone is **backspace** ("oops, undo that letter"). A rest of 2 beats also ends spell mode.

|   | col 1 (do) | col 2 (re) | col 3 (mi) | col 4 (fa) |
|---|---|---|---|---|
| **row 1 (do)** | A  (1,1) | B  (1,2) | C  (1,3) | D  (1,4) |
| **row 2 (re)** | E  (2,1) | F  (2,2) | G  (2,3) | H  (2,4) |
| **row 3 (mi)** | I  (3,1) | J  (3,2) | K  (3,3) | L  (3,4) |
| **row 4 (fa)** | M  (4,1) | N  (4,2) | O  (4,3) | P  (4,4) |
| **row 5 (sol)** | Q  (5,1) | R  (5,2) | S  (5,3) | T  (5,4) |
| **row 6 (la)** | U  (6,1) | V  (6,2) | W  (6,3) | X  (6,4) |
| **row 7 (si)** | Y  (7,1) | Z  (7,2) | apostrophe `'` (7,3) | space (7,4) |

(a,b) means: play pad a, then pad b. Digits are not spelled; use the number words (section 4).

Letter names for the example: h = (2,4) = re fa = D F; e = (2,1) = D C; l = (3,4) = E F; o = (4,3) = F E; w = (6,3) = A E; r = (5,2) = G D; d = (1,4) = C F.

**Why this layout.** Alphabet order is the only order a 6-year-old already owns. Frequency-ordered codes (Morse, Huffman) are faster for experts but cost a lookup table the kid must memorise by rote. The Koch method for Morse shows that learning by sound, a few characters at a time, works, but that a printed chart is what experts abandon first; we keep the chart on screen and fade it with the ladder (see THESIS.md).

## 4. Numbers and punctuation

Digits: a **single note** outside spell mode is a digit: pad N is the number N (do = 1 … do' = 8). The number is the key you press.

| Number | How to play |
|---|---|
| 1 to 8 | the single key, pad N |
| 0 (`zero`) | 1 + 8 (an octave is a circle: same note, back where it started) |
| 9 (`nine`) | 2 + 8 (music theory joke: the 9th above do is re) |
| 10 (`ten`) | 3 + 8 (the 10th above do is mi) |

Numbers above 10 are not in v1 (reserved: a digit-run mode). Two single notes in a row (with a word gap) are two numbers, e.g. `2 3` reads "two three".

Closers (they end a sentence and set its mood):

| Closer | Chord | Why it sounds right |
|---|---|---|
| `.` statement | 5 + 8 (sol, do') | the V to I resolution: "we are home" |
| `?` question | 2 + 5 (re, sol) | an unresolved, hanging pair; on playback the last word rises |
| `!` shout | 1 + 3 + 5 + 8 (C, E, G, C') | the biggest major chord; played loudly |

Koog already teaches the cadence. In Koogalien a statement ends with the resolution, a question ends hanging in the air: the same ear-training, now with meaning.

There is no comma. A rest is the comma.

## 5. The starter lexicon

120 entries: 28 two-key (every two-key slot is used), 55 three-key (1 free: 3 4 6), 37 four-key (33 free). The 8 single notes are reserved for digits. Spare capacity is about 34 slots; builders extending the lexicon must follow the rules below and update the fixtures.

### How the words were assigned (the "sonic alignment" rules)

Builders must follow these when adding words, so the language stays learnable.

1. **Consonance tracks feeling.** Open, stable chords (perfect fifths, major triads) are positive words: yes, we, happy, love, home, good. Minor chords are sad or quiet: sad, miss, sleep. Tense or crunchy intervals (the tritone 4 + 7, the half steps 3 + 4 and 7 + 8) are negation or urgency: no, not, now, stop.
2. **Height tracks size and lightness.** Sets near the top of the keyboard are small, bright, light things (sun, star, bird). Sets near the bottom are big, deep, heavy (dad, tree).
3. **Re-pairs ask.** Every two-key chord starting on re (2) is a question word: why, what, who, where, and the `?` closer.
4. **Pronouns share notes.** I = 1 + 3 (do mi: "mi" sounds like "me"). You = 3 + 5 (a third stacked on top of I). We = 1 + 3 + 5 (I + you, stacked: a chord is literally "together").
5. **Colours are rainbow clusters.** Red, orange, yellow, green, blue, purple are three adjacent keys, one step up each (123, 234, 345, 456, 567, 678). Paint mixes next to its neighbours.
6. **Solfège puns where they exist.** do-mi = I (mi = me), si = see, mi + si = my, fa + sol = and (neighbours), 9th = re, 10th = mi.
7. **Note-name spelling.** A few words are spelled by their note names: FACE (F A C E), BED/BAD style anagrams for the future. Use these only where free.
8. **Koog's signature.** Koog = do sol la, the opening of Twinkle. Koog Alien (the mascot) = Koog + the top note (1 5 6 8). Koogalien (the language, or one of its speakers) = Koog + si (1 5 6 7). The family of names shares a front.
9. **Arbitrary is allowed, but marked.** Where no mnemonic exists, the table says so, and the Koogalien who teaches the word tells a story instead.

### The first dozen (Tier 1: taught in the first session)

hello (1 6), world (1 5 8), say (5 6), I (1 3), you (3 5), yes (1 5), no (4 7), Koog (1 5 6), friend (1 4 5), happy (2 5 7), love (4 6 8), music (6 8). Closers `.`, `?`, `!`.

Tier 2 (about 40 words): pronouns, question words, feelings, colours, numbers 0 to 10, simple verbs. Tier 3: the rest, including the Koding words (loop, if, then, remember, name, code, list, number).

### Full table

Sorted by number of keys, then key set. "Pads" are played together (a chord). "Notes" are the same keys by name.

| Word | Pads | Notes | Why it sounds right |
|---|---|---|---|
| spell | 1 + 2 | C D | two touching keys = tiny pieces; letters are the smallest pieces of a word |
| I | 1 + 3 | C E | do+mi: mi sounds like 'me' |
| is | 1 + 4 | C F | a steady fourth: two things held level, like an equals sign |
| yes | 1 + 5 | C G | do+sol, the purest, most agreeable interval |
| hello | 1 + 6 | C A | a bright open sixth, like a wave |
| see | 1 + 7 | C B | si sounds like 'see' |
| zero | 1 + 8 | C C' | an octave is a circle: the same note back where it started |
| why | 2 + 3 | D E | a small wobbly step: curiosity |
| what | 2 + 4 | D F | re-chords all ask questions; this one is the plain 'what' |
| ? | 2 + 5 | D G | an unresolved pair that hangs in the air, waiting for an answer |
| who | 2 + 6 | D A | re-chords ask; la (6) is the 'person' note |
| where | 2 + 7 | D B | re-chords ask; the wide gap is 'far away somewhere' |
| nine | 2 + 8 | D C' | the 9th above do is re (a music-theory joke kids can learn) |
| not | 3 + 4 | E F | mi-fa is a half step: a crunch, a snag, a 'nope' |
| you | 3 + 5 | E G | mi+sol sits one third above 'I' (do+mi) |
| goodbye | 3 + 6 | E A | a wistful minor third, falling away |
| my | 3 + 7 | E B | mi+si: 'mi' = my |
| ten | 3 + 8 | E C' | the 10th above do is mi |
| and | 4 + 5 | F G | fa+sol are neighbours holding hands |
| please | 4 + 6 | F A | fa+la, gentle and leaning in |
| no | 4 + 7 | F B | fa+si is the tritone, the most tense interval there is |
| thanks | 4 + 8 | F C' | fa to do' is the 'Amen' cadence |
| say | 5 + 6 | G A | two easy neighbour keys for the word you use most |
| play | 5 + 7 | G B | sol+si, bouncy major third |
| . | 5 + 8 | G C' | sol to do', the 'we are home' resolution |
| want | 6 + 7 | A B | la+si, close and longing |
| music | 6 + 8 | A C' | la+do', a soulful minor third |
| to | 7 + 8 | B C' | si leans into do': it leads TO home |
| red | 1 + 2 + 3 | C D E | colours are three neighbours; red is at the bottom, purple at the top |
| orange | 2 + 3 + 4 | D E F | next step up the rainbow |
| yellow | 3 + 4 + 5 | E F G | middle of the rainbow |
| green | 4 + 5 + 6 | F G A | climbing |
| blue | 5 + 6 + 7 | G A B | higher, cooler |
| purple | 6 + 7 + 8 | A B C' | the top of the rainbow |
| we | 1 + 3 + 5 | C E G | I (1 3) plus you (3 5) stacked = we |
| love | 4 + 6 + 8 | F A C' | F major, the warm 'amen' chord |
| happy | 2 + 5 + 7 | D G B | a bright major chord (G) |
| sad | 2 + 4 + 6 | D F A | a minor chord (Dm) |
| miss | 3 + 5 + 7 | E G B | a minor chord (Em): longing |
| sleep | 3 + 6 + 8 | E A C' | a soft minor chord (Am), low-energy |
| afraid | 2 + 4 + 7 | D F B | a diminished chord, the spooky one |
| friend | 1 + 4 + 5 | C F G | do held up by fa and sol on both sides: support |
| world | 1 + 5 + 8 | C G C' | do-sol-do': very wide and open, like the world |
| Koog | 1 + 5 + 6 | C G A | the opening notes of Twinkle (do sol la) |
| song | 1 + 3 + 6 | C E A | warm major-sixth colour |
| dream | 1 + 3 + 7 | C E B | a floaty maj7 shimmer |
| home | 1 + 3 + 8 | C E C' | do mi do': stable, a house with a roof |
| family | 1 + 4 + 6 | C F A | F-ish and cosy |
| good | 1 + 4 + 8 | C F C' | do fa do': a calm 'all good' shape |
| hope | 1 + 2 + 5 | C D G | suspended: waiting for something good |
| listen | 2 + 3 + 5 | D E G | three close keys leaning in, like an ear |
| think | 2 + 3 + 6 | D E A | cloudy and unresolved |
| wonder | 2 + 3 + 7 | D E B | wide, curious, a little eerie |
| look | 2 + 4 + 5 | D F G | D F G: pointing |
| bad | 2 + 4 + 8 | D F C' | a dark minor shape |
| big | 2 + 5 + 8 | D G C' | D G C': a wide, strong stack of fourths |
| car | 1 + 6 + 7 | C A B | C A B: 'cab' |
| quiet | 1 + 2 + 4 | C D F | small and tight at the bottom |
| up | 1 + 2 + 6 | C D A | a tight start then a leap up |
| down | 1 + 2 + 7 | C D B | tight start, then the far leap |
| eat | 1 + 3 + 4 | C E F | C E F: a bite |
| ! | 1 + 3 + 5 + 8 | C E G C' | the loudest, biggest major chord: shout it |
| loop | 1 + 2 + 3 + 4 | C D E F | four neighbours in a row: a ladder you climb again and again |
| code | 1 + 3 + 5 + 7 | C E G B | a shimmering maj7: a spell being cast |
| if | 2 + 4 + 5 + 7 | D F G B | G7: tension that wants to resolve |
| then | 1 + 3 + 5 + 6 | C E G A | the resolved home chord that answers 'if' |
| remember | 1 + 4 + 5 + 8 | C F G C' | anchors at both ends: something held fast |
| name | 1 + 2 + 5 + 8 | C D G C' | open and bare: just a label |
| make | 4 + 5 + 6 + 8 | F G A C' | bright, building |
| word | 3 + 4 + 5 + 6 | E F G A | four neighbours: a little cluster of letters |
| face | 1 + 3 + 4 + 6 | C E F A | F-A-C-E, literally spelled by the note names |
| again | 2 + 3 + 4 + 7 | D E F B | same shape re-visited |
| more | 5 + 6 + 7 + 8 | G A B C' | top four keys: more, higher |
| start | 1 + 2 + 3 + 8 | C D E C' | low cluster then up and out |
| stop | 1 + 5 + 7 + 8 | C G B C' | si-do' crunch at the top: brakes |
| sun | 5 + 6 + 8 | G A C' | high and bright |
| star | 5 + 7 + 8 | G B C' | even higher, twinkly |
| moon | 4 + 6 + 7 | F A B | pale, cool, mid-high |
| water | 3 + 5 + 8 | E G C' | E-G-C': flowing arpeggio shape |
| tree | 1 + 4 + 7 | C F B | a tall stack from root to top |
| cat | 1 + 5 + 7 | C G B | small and pointy |
| dog | 1 + 6 + 8 | C A C' | friendly leaping |
| bird | 1 + 7 + 8 | C B C' | flutter at the top end |
| dad | 1 + 2 + 8 | C D C' | low and deep, then the roof |
| mom | 2 + 3 + 8 | D E C' | warm middle, then home |
| help | 2 + 5 + 6 | D G A | reaching up |
| give | 2 + 6 + 7 | D A B | hand moving outward |
| take | 2 + 6 + 8 | D A C' | hand moving inward |
| go | 2 + 7 + 8 | D B C' | a leap forward |
| come | 3 + 4 + 7 | E F B | opposite shape of go |
| like | 3 + 4 + 8 | E F C' | a small crunch then a smile |
| learn | 3 + 5 + 6 | E G A | stepping upward |
| try | 3 + 6 + 7 | E A B | three keys reaching for the top |
| with | 3 + 7 + 8 | E B C' | two ends joined |
| how | 4 + 5 + 7 | F G B | the three keys above fa |
| can | 4 + 5 + 8 | F G C' | strong: fa-sol-do' |
| now | 4 + 7 + 8 | F B C' | two close notes at the very top, urgent |
| sing | 1 + 2 + 3 + 5 | C D E G | low gentle rise |
| dance | 1 + 2 + 3 + 6 | C D E A | a rise that skips |
| game | 1 + 2 + 3 + 7 | C D E B | playful |
| school | 1 + 2 + 4 + 5 | C D F G | tight cluster: kids together |
| teach | 1 + 2 + 4 + 6 | C D F A | a pointer |
| tell | 1 + 2 + 4 + 7 | C D F B | reaching out |
| ask | 1 + 2 + 4 + 8 | C D F C' | a question reaching far |
| answer | 1 + 2 + 5 + 6 | C D G A | a reply to ask |
| book | 1 + 2 + 6 + 7 | C D A B | pages |
| read | 1 + 2 + 6 + 8 | C D A C' | book (1 2 6 7) with its top note lifted to the octave: eyes going up the page |
| write | 1 + 2 + 7 + 8 | C D B C' | read's cousin: the highest pair, because writing is making the marks |
| draw | 1 + 3 + 4 + 5 | C E F G | a drawn line |
| build | 1 + 3 + 4 + 7 | C E F B | stacking |
| share | 1 + 3 + 4 + 8 | C E F C' | two end notes plus middle |
| together | 1 + 3 + 6 + 7 | C E A B | we+more |
| magic | 1 + 3 + 7 + 8 | C E B C' | a shimmering ending |
| number | 1 + 4 + 5 + 6 | C F G A | three ascending neighbours after do |
| list | 1 + 4 + 5 + 7 | C F G B | rungs |
| random | 1 + 4 + 6 + 7 | C F A B | scattered |
| robot | 1 + 4 + 6 + 8 | C F A C' | square, mechanical |
| alien | 1 + 4 + 7 + 8 | C F B C' | strange crunchy top |
| Koogalien | 1 + 5 + 6 + 7 | C G A B | Koog (1 5 6) plus 7 |
| Koog Alien | 1 + 5 + 6 + 8 | C G A C' | Koog (1 5 6) plus the top note: the mascot |

Reserved and free: only the sets not in the table are free. Never reuse a set, never change a shipped word without bumping the language version (section 13).

## 6. Grammar (deliberately tiny)

A **sentence** is: words, then a closer. That is all that is required.

1. **Order.** Head first, like code. If the first word is a command verb (`say`, `play`, `make`, `loop`, `ask`, `tell`, `show`), the sentence is a command and the rest are its arguments. Otherwise it is a statement: `Koog is happy.` (Koog, is, happy, period).
2. **No articles, plurals or tenses.** "the" and "a" do not exist. Plural is a number before the noun (`2 friend`) or `more`. Past and future are words you add (`now`, and later `before`, `after`).
3. **Negation** is `not` before the word it flips: `not happy`.
4. **Questions** end with `?`, or begin with a question word (why, what, who, where, how). On playback the last word of a `?` sentence rises in pitch (a rising contour) so even a kid who cannot read the closer hears the question.
5. **Assignment** uses `is`: `name is Zib`, `x is 5`. This is the variable of Koding Kore (a name holding a value); `remember` stores one.
6. **Repetition** is `loop 3 say hello.`: the number, then what to repeat. This is the loop.
7. **Choice** is `if ... then ...`.
8. **Quotes.** A spelled literal in code text is written in double quotes: `say "hello world".` (spell mode on the keyboard, the quotes in the code text).

### Mapping to code (Koding Kore concepts)

| Koogalien idea | Koogalien form | Koding Kore concept |
|---|---|---|
| A sentence | words + closer | sequence (ordered steps) |
| A command verb | `say`, `play`, `make` | function call (the verb is the function, the rest are arguments) |
| `name is Zib.` | `is` | variable (a name holding a value) |
| `loop 3 say hello.` | `loop` | repeat |
| `if happy then say yes.` | `if`, `then` | condition |
| A word-chord | one chord | token (a unit the recogniser emits) |
| Two sentences in a row | closers separate | a program (a list of statements) |
| A motif reused | a named word | function definition (reserved: `define`) |

The Koding Kore SDK turns any instrument into tokens; Koogalien is one more token vocabulary on that layer: a word-chord is a token, a sentence is a token stream, the Koogalien code text is the printed form. (See `docs/KODING_KORE.md` when it lands; align names with it, not with this table.)

## 7. The tone layer (feeling and sound shaping)

Pitch and chord say WHAT. Tone says HOW. Koogalien is played on a synth, so sound shaping carries meaning, as in tonal languages and talking drums where pitch contour changes a word. Two sub-layers.

### 7a. Basic tone (v1, every beginner can do it)

Only things any keyboard or pad does:

| Cue | Meaning | Text mark |
|---|---|---|
| Soft (velocity low) | whisper, shy, gentle | `~soft` or `hello:soft` |
| Normal | plain | none |
| Loud (velocity high) | emphasis, excited | `HELLO` / `hello:loud` |
| Sentence mostly major words | bright accompaniment on playback | derived, not typed |
| Sentence has minor/negative words | warm minor drone on playback | derived, not typed |

Emotion is read from the words. Each lexicon word has a valence tag (positive, neutral, negative; negative = sad, afraid, miss, bad, no, not, stop). The playback engine adds a soft drone: major for a mostly positive sentence, minor for a mostly negative one. This is presentation, deterministic, and never changes the meaning of the code.

### 7b. Advanced Koogalien: modulation (unlocks after the kid passes Tier 2)

Each cue is a short **tone attribute** on the word being played. They are written `word:tone`. Each has ONE meaning so there is never a lookup of overlapping meanings. All are quantised to three levels so a wobbly hand is not punished (low / mid / high, with a dead zone).

| Sound cue | Meaning | Text | Why it is the right match |
|---|---|---|---|
| **Vibrato / LFO rate**, fast and deep | excited | `hello:excited` | a fast wobble is a trembling voice |
| **Vibrato**, slow and shallow | unsure, wondering | `hello:unsure` | a slow wobble is a hesitant voice |
| **Filter sweep opening** (dark to bright) while the word sounds | ask: this word is a question ("you?") | `you:ask` | an opening mouth, a rising "huh?" |
| **Filter sweep closing** (bright to dark) | tell: firm statement | `you:tell` | a closing door, a full stop |
| **Pitch bend / glide up** into the word | really? surprise | `yes:up` | a rising tone is surprise in every tonal language |
| **Pitch bend / glide down** into the word | sigh, disappointment | `yes:down` | falling tone is "oh well" |
| **Tremolo** (volume LFO) | many, plural, again | `friend:many` | a shimmer is "lots of them" |
| **Staccato** (short, detached) | firm, urgent | `go:urgent` | short and sharp = a command |
| **Legato** (long, connected) | polite, gentle | `go:polite` | smooth = a request |
| **Mod wheel / knob position** | intensity: low / mid / high | `love:big` | how much, a volume knob for meaning |
| **Timbre / patch** | speaker (see section 9) | `@zib` | each Koogalien has its own sound |

**Decisions and rejected alternatives.**

- *Filter sweep as question, not as statement.* Pitch contour already marks a question by the sentence closer; the filter marks a question on a single word (`you:ask`), which pitch cannot do without changing the chord. Statement is simply the default, so `tell` is optional.
- *Vibrato as emotion, not as a person/tense marker.* Wobble is the strongest, most universal "feeling" cue in voices and instruments.
- *Envelope shape as politeness, not tense.* Tense changes meaning logically and belongs to words (`now`). Short vs long is a manner of acting, which suits politeness and urgency. Rejected: envelope as tense, because it would mean a kid cannot say a past-tense verb without a modulation-capable device.
- *Bend as tone, but only up/down.* Tonal languages have many contours (rise, fall, dip). v1 keeps two so a mouse-draggable slider can do it.
- *Tremolo for plural.* Rejected alternative: tremble for fear. Fear is a word (`afraid`), shimmer is quantity.
- *Never required.* Every Koogalien sentence is correct without any modulation. Modulation only adds nuance, so a kid on a phone with no mod wheel loses nothing.

**How each device plays it.**

| Device | Excited / unsure | Ask / tell | Up / down | Many | Urgent / polite | Intensity |
|---|---|---|---|---|---|---|
| Keyboard with mod wheel + pitch bend | mod wheel (rate on hold) | filter knob or CC sweep | pitch bend | CC (tremolo depth) or aftertouch | touch the key staccato or hold | mod wheel position |
| DJ controller (knobs + jog wheel) | jog wheel speed | knob sweep | jog nudge up/down | a dedicated knob | pad tap short or long | knob position |
| Drum pads | pad pressure | an encoder or on-screen slider | not available (use words) | repeated hit | tap or hold | pressure |
| On-screen sliders | `Wobble` slider (rate) | `Bright` slider | `Glide` slider | `Shimmer` slider | `Short/Long` slider | `Big` slider |
| Pedal | tap = word boundary; hold while a word sounds = polite (legato); double tap = urgent (staccato) | not available | not available | not available | the pedal alone | not available |

A modulation stroke belongs to the word whose chord is sounding when it happens (or the next word, if none is sounding and the control is touched in the gap). The recogniser records the dominant level per word and prints the tone attribute.

## 8. Worked example: "hello world" in three forms

Words used: `say` (5 + 6, G A), `hello` (1 + 6, C A), `world` (1 + 5 + 8, C G C'), `.` (5 + 8, G C').

### Form 1: played notes (words)

| Beat | What the kid plays | Pads | Notes |
|---|---|---|---|
| 1 | `say` | 5 + 6 together | G A |
| 2 | `hello` | 1 + 6 together | C A |
| 3 | `world` | 1 + 5 + 8 together | C G C' |
| 4 | `.` | 5 + 8 together | G C' |

One rest between each. Four chords.

Koogalien code text: `say hello world.`

English: "Say hello world." (Reads as: say the words "hello world".)

### Form 2: the exact text in spell mode

For exact letters, say `spell`, then spell every letter as two hops, with space (7,4) between words, then end with `.`.

| Letter | h | e | l | l | o | space | w | o | r | l | d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pads | 2,4 | 2,1 | 3,4 | 3,4 | 4,3 | 7,4 | 6,3 | 4,3 | 5,2 | 3,4 | 1,4 |
| Notes | D F | D C | E F | E F | F E | B F | A E | F E | G D | E F | C F |

Played: `say` (G A), `spell` (C D), then the 11 hops above, then `.` (G C').

Koogalien code text: `say "hello world".`

English: Say "hello world" (letter for letter).

### Form 3: both ways describe the same thing

`say hello world.` and `say "hello world".` print the same English. The first is faster (4 chords). The second is exact and works for ANY text, including names. The same program in three forms:

| Form | Value |
|---|---|
| Played | `say` + `hello` + `world` + `.` (4 chords) or `say` + `spell` + 11 hops + `.` |
| Code | `say hello world.` or `say "hello world".` |
| English | Say hello world. |

### With feeling

`say hello:excited world:big!` is the same sentence with a fast wobble on hello, the mod wheel high on world, and a loud closer. The melody is the same notes; the sound is different; the code shows the difference.

## 9. Voices: the Koogaliens

Every Koogalien is a synth patch. The patch is its **voice**; the voice is how you know who is speaking, as in a tonal language where timbre says who.

- The kid has a default voice (a clean electric piano).
- Each Koogalien has its own patch and its own recurring chord for its name (a short name-motif played before it speaks). A speaker tag in text is `@zib`.
- Dialogue is a list of sentences with speakers: `@zib say hello world.` then the kid replies.
- A Koogalien can teach (plays a word and waits), greet, quiz ("what is this?"), or reply.
- The Koog Alien (the mascot) is the host: it introduces each Koogalien, and it is the voice of the lessons.

## 10. Hear it back: text to melody

Every sentence plays. The playback is a pure function of the parsed sentence (the "score"):

1. Tokenise the Koogalien code text into words, spelled literals and closers.
2. Each word-chord becomes its notes sounded together, held for 3/4 beat, followed by 1/4 beat of rest. (Default tempo 90 BPM; the kid can change it.)
3. Each spelled letter becomes its two notes as two eighth notes in a row (so a letter is half a beat). A space is a short pause.
4. Each digit is one note held for a beat.
5. The closer is played: `.` resolves (5 + 8), `?` hangs (2 + 5, and the final word's pitch rises by a whole step), `!` is loud.
6. Tone attributes modulate the synth parameters (section 7).
7. The drone from section 7a plays softly under the sentence.
8. The words of the sentence light up in the code and English lines as each plays (the SentenceRibbon in ARCHITECTURE.md).

English text can also be turned into Koogalien: each word is looked up in the lexicon; if it is found, the chord is used; if not, it is spelled in spell mode. So any English sentence has a melody, which is the "hello world" promise for names and new words.

## 11. Melody to text: the recogniser

1. **Segment.** Group key-downs into chords (70 ms window), then words (rest of 1 beat or a pedal tap), then sentences (a closer, or a 2-beat timeout).
2. **Look up.** Match each chord against the lexicon by exact key set. In spell mode, decode letters from pairs.
3. **Report confidence** for each word: exact match, near match, or unknown.
4. **Print** the code line and the English line, aligned word by word.

### Degrading gracefully

Kids make mistakes. The recogniser never says "wrong"; it says "did you mean?".

| Mistake | What it does |
|---|---|
| One key missed or added (e.g. you played 1 + 5 + 7 instead of 1 + 5 + 8) | Offers the nearest words by key-set distance (one add, drop or shift): "Did you mean `world`?" |
| Chord keys arrive too far apart (a rolled chord) | Treats keys within 150 ms as one chord when no lexicon word matches the shorter reading |
| Unknown chord | Shows the unknown shape in a neutral colour and offers up to 3 nearest words, ranked by distance, then by how often the kid has used each word, then by grammar fit (after `say`, any word fits) |
| Odd number of spell notes | Marks the last letter "half" and waits; a pedal tap or a rest finishes it with a suggestion |
| Misspelled word in spell mode | Autocorrect from the lexicon and a small English word list (edit distance 1) with the correction shown, never forced |
| Missing closer | Treats a 2-beat rest as a `.` and tells the kid |
| A sentence that parses but makes no sense (`yes no`) | Is still a valid program; the Koogalien answers literally, which is part of the fun |

Distance between two chords is the number of keys to add, drop or move one step to turn one into the other, so `1 5 8` and `1 5 7` are distance 1.

## 12. Accessibility and inclusivity in the language itself

- One octave and eight pads means no reach beyond one hand.
- The chord builder (section 2) lets one key at a time work, or a single switch if the pad set is scanned.
- Every word has a visual (a coloured shape, a glyph, the English) so a deaf or hard-of-hearing kid can use the screen and the vibration; every word has a sound so a blind kid can learn from sound alone with screen-reader labels.
- No cue relies on colour alone. Red-green is avoided in the lexicon colour chips.
- The language is not tied to Western tuning: the 8 notes are "pads 1 to 8"; the pitch mapping is a skin. Tuning, key (transposition) and note names are settings.
- Words for "boy", "girl", "mom", "dad", "family" are all optional; the language has `friend`, `I`, `you`, `we` first.

## 13. Versioning and extension

- Language version: `0.1` (this file). Anything in a shipped fixture is frozen. New words may only use free sets. If you must change a shipped word, bump the minor version, keep an alias for the old chord, and tell the kid the Koogalien changed its mind.
- Required fixtures: the full lexicon as data, 20 canonical sentences with their notes, code and English, and the near-miss table of section 11.
- Planned for v0.2: digit-runs for numbers above 10, `define` (name a motif), `before`/`after`, dialogue turns.

## 14. Glossary

- **Koogalien** (language): the notes-and-words language. **Koogalien** (module): the Koog screen that teaches it. **Koogaliens**: the alien characters who speak it. **The Koog Alien**: the mascot host.
- **Word-chord**: a word spoken as 2 to 4 keys pressed together.
- **Spell mode**: the letter layer; each letter is a two-note hop (row, then column).
- **Closer**: the chord that ends a sentence: `.` `?` `!`.
- **Sentence**: words plus a closer; also a tiny program.
- **Lexicon**: the table of words and their chords.
- **Tone**: how a word is played: soft/loud, and in advanced Koogalien wobble, sweep, bend, shimmer, short/long.
- **Voice**: a Koogalien's synth patch; who is speaking.
- **Chord window**: 70 ms, the time within which keys count as one chord.
- **Word gap**: a rest of about a beat, or a pedal tap.
- **Ladder**: Koog's six-rung support-fading practice (Hunt and Peck, Follow, Echo, Memory, Play full, Master), reused for learning words.
- **Nearest word**: the autocorrect suggestion when a chord is a key off.
- **Sonic alignment**: the rules that tie a word's meaning to how its chord sounds (section 5).

## 15. The first ten minutes (kid journey)

A new kid, a keyboard or pads, no reading required beyond the English line.

| Min | What happens | Skill |
|---|---|---|
| 0:00 | The Koog Alien waves and plays one chord, `hello` (C A). Pads 1 and 6 glow. "Press both." The kid does. The Alien answers `hello` back with a happy wobble. | The first word, the first reply |
| 1:00 | The Alien shows the word on screen with the English "hello" and a picture. Echo rung: it plays `hello` again, the kid copies. | Word as a shape of keys |
| 2:00 | Second word: `world` (C G C'), shown as a big round planet. "Hello world." The kid plays both, with a rest between. | Word boundary = a rest |
| 3:00 | Third word: `say` (G A). The Alien shows the code line appearing as the kid plays: `say hello world.` The kid presses `.` and hears the whole sentence played back as a melody. | The big moment: I wrote it, I heard it, I read it |
| 5:00 | Mistake on purpose: if the kid presses `world` with one key wrong, the Alien says "close! Did you mean world?" with the right keys glowing. | Mistakes are fine |
| 6:00 | Quiz: the Alien plays a sentence the kid has never seen but made of the three words. "What did I say?" The kid taps the English words. | Hearing to meaning |
| 7:30 | A new Koogalien (Zib) arrives with its own voice and says `hello`. The kid replies `hello you?` and hears it rise. | A voice, a question |
| 9:00 | Spell peek: the Alien spells the kid's name from the keyboard (two hops per letter); the kid sees the letters appear. | Spell mode exists |
| 10:00 | A star and a postcard: "You wrote hello world in code." The code, melody and English are saved to the kid's collection, ready to share. | A keepsake |

What the kid has after ten minutes: three words, one program, the idea that a sentence is both music and code, and a friend who answers.

## 16. Sources and credit

- Solresol (François Sudre, 1827) is public domain; Koogalien adapts its idea of a language built on the solfège syllables, not its vocabulary. [Wikipedia: Solresol](https://en.wikipedia.org/wiki/Solresol).
- Silbo Gomero: [UNESCO](https://ich.unesco.org/en/RL/whistled-language-of-the-island-of-la-gomera-canary-islands-silbo-gomero-00172).
- Stenotype chord and syllable structure: [Plover documentation](https://morinted.gitbooks.io/plover-theory/content/layout/chorded-keyboard.html).
- Yoruba talking drum: [Durojaye et al. 2021, Frontiers in Communication](https://www.frontiersin.org/articles/10.3389/fcomm.2021.650382/pdf).
- Koch method for Morse: [summary](https://hamradio.my/?p=1705).
- Chunking in children's memory: [Jones 2012](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2012.00167/full).
