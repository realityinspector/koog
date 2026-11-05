# The Koogalien thesis: a language where sound and words align

Status: thesis v1 (planner 1). Read with `LANGUAGE.md` (the spec) and `ARCHITECTURE.md` / `BUILD_PLAN.md` (the build). Written for the owner and for builder agents.

**Names.** *Koogalien* is the language ("the Koogalese language system") and also the Koog module that teaches it. *Koogaliens* are the friendly alien characters who speak it, each with its own synth voice. *The Koog Alien* is the mascot and host. "Learn Koogalien with the Koog Alien."

---

## 1. The claim in one paragraph

Koog is a place where a child plays and the app names what they did. Koogalien takes the next step: what the child plays can mean something. A kid presses a chord, and that chord is the word "hello". Press a few more and they have written `say hello world.`, which is at the same moment a sentence, a line of code and a melody. They see the code, they hear it played back as music, and they read the English. The thesis is that a **musical language that is also a programming language** teaches three things at once (music, language, coding) because in this design they are the same act. The keyboard stops being only an instrument and becomes a way to write and to speak.

## 2. Why this is a good idea

### 2.1 Music and language are already relatives

Humans already turn pitch and rhythm into meaning in many places. We should borrow the best of them, not invent from nothing.

- **Solresol** (François Sudre, 1827) built an entire language on the seven solfège syllables. Words are sequences of 1 to 5 syllables, with 7 + 49 + 336 + 2,268 + 9,072 = 11,732 possible words; short words were particles, and reversing a word's syllables flipped its meaning (fala, good; lafa, bad). It was playable on any seven-key thing, and it is public domain. [Solresol](https://en.wikipedia.org/wiki/Solresol). Its lesson for us: a tiny alphabet of notes can carry a whole language, and structure (length, order, reversal) can carry meaning. Its flaw: it never became learnable, because its words were arbitrary strings of note names with no sound-meaning link.
- **Silbo Gomero**, the whistled form of Spanish on La Gomera, reduces the five Spanish vowels to two whistle pitches and the consonants to four, and uses pitch and whether the whistle is broken or sustained to carry everything. It has been taught in the island's schools since 1999 and UNESCO listed it in 2009. [UNESCO](https://ich.unesco.org/en/RL/whistled-language-of-the-island-of-la-gomera-canary-islands-silbo-gomero-00172). Its lesson: a language can survive being squeezed through a very narrow channel if the channel keeps the contour. Children can learn it in school.
- **Talking drums.** The Yoruba dùndún imitates a tonal language: Yoruba has three relative tones (low, mid, high, often called do, re, mi), and the drum's tension changes pitch to follow them, including glides. Researchers measured that its microstructure matches speech. [Durojaye et al. 2021](https://www.frontiersin.org/articles/10.3389/fcomm.2021.650382/pdf). Its lesson: pitch contour, not only pitch, is where meaning lives; and an instrument can "talk" because a language already uses tone. The mechanism of grammar transfer is still not fully understood, which is a reason to keep our grammar tiny.
- **Music and syntax.** Patel's shared syntactic integration resource hypothesis proposes that music and language keep separate representations but draw on a common limited pool of syntactic processing. The claim is contested (some results may reflect general attention). [PMC2658747](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658747). We do not rely on it as proof. We note only that the proposal is plausible enough that a language built from music does not fight the brain.

### 2.2 Chords are already how skilled people write fast

- **Stenotype** machines chord whole syllables: the left hand carries the sounds that start a syllable, the thumbs the vowel, the right hand the ending, and the order keys go down does not matter, so the software sorts them into one canonical key order. Court reporters write at normal speaking pace this way. The default English theory is not purely phonetic: it relies on many dictionary "briefs", short entries for common words. [Plover docs](https://morinted.gitbooks.io/plover-theory/content/layout/chorded-keyboard.html). Our lessons: (a) a chord is a good unit for a syllable or a whole word; (b) a hybrid of spelling and shortcut words is exactly what experts end up with; (c) order should not matter inside a chord.
- **Braille** is a six-dot cell, 2^6 = 64 patterns, 63 non-empty, each cell a letter, number or contraction. It is a chorded system that blind children have learned for two centuries, and it too is a hybrid of letters and contractions (general knowledge, not separately cited).
- **Morse** teaches by sound. The Koch method (1930s) starts at a fast character speed (about 12 words per minute was found optimal for initial learning), adds characters one or two at a time in a non-alphabetical order, and rejects visual charts. [Koch summary](https://hamradio.my/?p=1705). Our lesson: learn by hearing, add a few symbols at a time, fade the chart.

### 2.3 Why the kid learns more than one thing

- **Music.** Playing chords from one octave, hearing intervals, resolving cadences. A word-chord is an interval or a triad; the kid hears major, minor, tritone and half step as feelings first and names later (Koog's "name what they did" principle).
- **Language.** Word and letter, sentence and question, tone and emotion, speaker and voice. Spelling a name. Learning that a rising contour is a question.
- **Coding.** A word is a token, a sentence is a statement, `loop 3 say hello.` is a loop, `name is Zib.` is a variable, `if ... then ...` is a condition. The kid writes real programs without typing syntax and learns to read the printed form.

The unity is the point: the same object (a Koogalien sentence) is three subjects.

## 3. The core insight: "sound and words align"

"Aligned" can mean four different things, and the design uses all four deliberately:

1. **Aligned in structure.** A sentence is a sequence of words; a melody is a sequence of chords. One-to-one, in the same order, shown line by line.
2. **Aligned in feeling (sonic alignment).** The sound of a word-chord is chosen to resemble its meaning: consonant chords for positive words, minor for sad, the tense tritone for "no", rainbow clusters for colours, height for size. This is iconicity, the same thing behind "bouba/kiki" and why a tonal language's contour feels right. It is applied consistently with written rules (LANGUAGE.md section 5), because arbitrary mappings are what killed Solresol.
3. **Aligned in time.** The word glows as its chord sounds, in code and in English. This is the "hear it back" promise.
4. **Aligned in modulation.** How a word is shaped by a synth (wobble, sweep, bend, shimmer, short or long) carries feeling or force, as pitch contour does in a tonal language. This is optional and comes later.

## 4. The core design decisions

Four candidate designs were considered. The decision is the hybrid, with the reasons below.

### Option A: a Solresol-style syllable language

*Each note is a syllable; a word is a sequence of notes.*

For: the most musical; it reads as a melody; needs only 7 notes.
Against: with arbitrary words of 3 to 5 notes, there is no way to learn a word except to memorise a note string. With about 11,000 possible words Sudre never built a learnable vocabulary and later authors filled it in. A tune also cannot encode a name. Sequence-words conflict with sequence-letters (is "do re" the word 1 or letters?). The research on chunking (below) suggests a note string of five is five items to hold, not one.
**Rejected as the base. Borrowed:** the idea that a few notes are enough; short words for common words; reversal as an idea (we use reversal of nothing, but "inverse" pairs like come/go are kept in mind).

### Option B: a letters-on-keys alphabet (a spelling cipher)

*26 letters mapped onto keys and chords.*

For: universal; any word and any name works; trivially learnable if the code is regular; the kid learns to spell with their hands.
Against: it is not a language. It is a cipher for English; the sound has no relation to the meaning; "hello" is ten notes, so the melody is a rattle, not a word; it teaches no coding concept beyond strings.
**Rejected as the base. Kept as the safety net:** spell mode (LANGUAGE.md section 3).

### Option C: chord-as-word

*A chord shape is a word or morpheme.*

For: a chord is a single gesture, a single sound, a single chunk in memory; stenotype shows this is the fast way to write; 8 notes give C(8,2) + C(8,3) + C(8,4) = 28 + 56 + 70 = 154 chords, enough for a real starter vocabulary; chords can be chosen to resemble their meaning (consonance and so on).
Against: 154 words is a hard cap, no way to say a name, and the chord table is a memory task. Without spelling there is no safety net.
**Adopted as the main layer.**

### Option D (chosen): the hybrid

Three layers, learned in order:

1. **Word-chords** for about 120 core words (up to about 150 with the free slots).
2. **Spell mode** for exact text: 26 letters, fixed two-note hops (row, then column), ABC-song chunking.
3. **Tone** for feeling, from velocity and key flavour at first, from synth modulation later.

Reasons: it matches how every expert chorded system ended up (stenotype with briefs, Braille with contractions); it has a safety net, so a kid is never stuck; the common words are short and musical; and it maps cleanly to code (strings are spelled literals, words are tokens).

Additional decisions and their alternatives:

| Decision | Chosen | Rejected and why |
|---|---|---|
| Note set | 8 notes (one octave, do to do'), no sharps | 12-note chromatic: too many keys for beginners; 7-note Solresol: fine, but the 8th note is needed to match 8 pads and the octave gives us `zero`, nine, ten |
| Letter code | Alphabetical rows of 4, two-note hop | Frequency-ordered (shorter for common letters, Morse-style): faster for experts but needs rote memory; a 6-year-old owns alphabetical order already |
| Letter width | Fixed two notes | Variable width: needs separators; fixed width is self-synchronising and a half letter is detected immediately |
| Word boundary | A rest or a pedal tap | Fixed rhythm slots: punishes beginners; a special "space" chord: breaks flow |
| Questions | Rising contour on the last word plus a hanging closer (`?` = re sol) | A question word only: English can ask without one; the closer also teaches cadences, which Koog already names |
| Numbers | A single note is the digit; zero, nine, ten are chords | A separate number mode: a mode to forget; digits as spelled letters: loses the "pad N is N" joy |
| Grammar | Head-first, no articles, plurals or tenses | English grammar: too big, and head-first matches code (`say x`) |
| Emotion | Words carry valence; velocity gives soft and loud; a drone derives from the words | Mood chosen separately by the kid: a third thing to pick and a way to contradict the words |
| Modulation | Optional advanced layer; each cue has one meaning | Modulation required or overloaded: excludes phone users and blows the load budget |

## 5. How it maps to code

A Koogalien sentence is a program. This is not a metaphor: the same object is rendered three ways.

```
  played:   [say] [hello] [world] [.]        (chords on 8 keys or pads)
  code:     say hello world.
  English:  Say hello world.
  melody:   G-A together, C-A together, C-G-C' together, G-C' together
```

And with a spelled literal:

```
  code:     say "hello world".
  played:   [say] [spell] D F, D C, E F, E F, F E, B F, A E, F E, G D, E F, C F [.]
```

A kid can WRITE "hello world" by playing, SEE the code appear as they play, HEAR it back as music, and READ the English translation. The lexicon form is short (four chords). The spelled form is exact (13 events).

The mapping to Koding Kore concepts (full table in LANGUAGE.md section 6):

| Koding Kore idea | Koogalien form |
|---|---|
| sequence | a sentence is an ordered list of words |
| function | a command verb (`say`, `play`, `make`) with arguments |
| variable | `name is Zib.` and `remember` |
| repeat / loop | `loop 3 say hello.` |
| condition | `if happy then say yes.` |
| token | a word-chord, a spelled letter, or a closer |
| motif | a named, reusable word (future `define`) |
| program | several sentences in order |

The Koding Kore SDK turns any instrument into tokens and lets motifs be functions. Koogalien adds a token vocabulary on top: the Kore sees chords; Koogalien gives them meaning. A kid who learns that `loop 3 say hello.` repeats three times is learning the same loop as a Koog Kode loop of notes, in a form where the loop has a meaning.

## 6. Learnability: how much can a kid hold?

Facts to design to, with the honest limits of the evidence:

- **Chunks, not items.** Children's short-term memory is small, but chunking (grouping into familiar units) gives young children an equal benefit as older ones in a colour-sequence memory study of 374 children. [Jones 2012](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2012.00167/full) discusses chunking as a developmental mechanism. Design consequence: a word is one chord (one chunk), not a string. Spell letters are two notes (one chunk of two) and the alphabet is chunked in fours (ABCD EFGH ...), a structure kids already know.
- **A small start.** Silbo reduces the whole phonology to a few whistles; Braille is a 6-dot cell; the Koch method adds a couple of characters at a time. Design consequence: 12 words in the first session (Tier 1), about 40 by the end of Tier 2, never more than 6 new words per sitting.
- **Spaced retrieval.** A 2012 study of Grade 3 children found words taught with spaced sessions were retained better than words taught in one massed block, and spaced retrieval helps children with developmental language disorder too; but some evidence on within-day spacing is mixed. [Son et al. 2012](https://www.gwern.net/docs/spaced-repetition/2012-son.pdf), [Journal of Neurodevelopmental Disorders, 2021](https://doaj.org/article/8a10ae0e049a4ae193d363239de3a5fd). Design consequence: the app brings words back across days with growing gaps; we do not rely on same-day repetition alone. (I did not find a children-specific meta-analysis; the builder should treat the spacing schedule as a tunable setting and measure.)
- **The phrase ladder.** Koog already scaffolds then fades: Hunt and Peck, Follow, Echo, Memory, Play full, Master. Use it for every word and every sentence. A new word begins with glowing keys and ends with the kid playing it from memory in time.
- **Mnemonics.** Each word has a reason it sounds right (LANGUAGE.md section 5), with a story where no reason exists. Mnemonic channels: solfège puns (mi = me, si = see), the stacking trick (I + you = we), rainbow clusters, and note-name words (FACE).
- **Vocabulary size.** A starter vocabulary of about 120 words is enough for real sentences and is learnable over weeks, not minutes. A child is not asked to learn the whole table; they unlock words by playing.

## 7. Modulation: sound shaping as grammar

Koogalien is played on a synth, so the sound itself can mean something, as in a tonal language. The design is deliberately two-layer.

- **Basic tone (v1):** soft and loud, and a drone derived from the words' feeling. Everyone can do it.
- **Advanced Koogalien (later):** vibrato rate and depth (excited vs unsure), filter sweep (ask vs tell), pitch bend (really? vs sigh), tremolo (many), staccato vs legato (urgent vs polite), mod wheel or knob position (intensity), and the synth patch (speaker/voice).

Each cue has one meaning, three levels, and is never required. It is played on a keyboard's mod wheel and pitch bend, a DJ controller's knobs and jog wheel, on-screen sliders, and the pedal (hold = legato, double tap = staccato). Full table in LANGUAGE.md section 7. The decision to make envelope politeness, not tense, and to keep tense in the words, is the one worth defending: tense changes truth conditions, so it must be reachable on every device. A rule of the design: **delete all modulation and the language still works.**

## 8. The Koogaliens, the story frame

Why would a kid learn a language? To talk to someone. The Koogaliens are the reason:

- Kids learn Koogalien to talk with the Koogaliens, who each have a voice (a synth patch), a name-motif, and a personality.
- A Koogalien can teach (play and wait), greet, quiz, and reply.
- The Koog Alien (the mascot) hosts the module and introduces each new Koogalien.
- A reply is a sentence in Koogalien that the kid can understand by hearing or reading the English line, and later by hearing alone.
- Voices make dialogue possible: `@zib say hello world.` then the kid replies.

This is the design philosophy of Koog applied once more: the child is a co-designer (they will ask for aliens); the app names what they did; feedback is honest; scaffolds fade; the child leaves with something they made (a message, a postcard).

## 9. Risks and mitigations

| Risk | What could go wrong | Mitigation |
|---|---|---|
| Cognitive load | 120 chords plus 26 letters plus modulation is a lot | Tier 1 is 12 words; spell is introduced by the Alien in minute 9; modulation unlocks after Tier 2; hints are always available; never more than 6 new words per sitting |
| Ambiguity | Similar chords confused; one key off; chord versus letter pair | Fixed width letters; spell mode entered explicitly; chord window 70 ms; nearest-word suggestions with confidence; the lexicon has a minimum distance of one key, so a near miss is always a suggestion, never a silent wrong word |
| Chord reading by the machine | Keys arriving a few ms apart | Chord window plus the chord builder for slow chords; tune with fixtures |
| Accessibility | Small hands, one-hand play, motor difficulties, hearing or sight differences | Everything fits one octave and one hand; a one-key-at-a-time chord builder; every word has a visual and a sound; no colour-only cues; screen-reader labels for pads |
| Inclusivity | Western tuning bias, gendered words, English-centric glosses | Pads are 1 to 8 and note names are a skin; no gendered words in Tier 1; the English gloss is a swappable language pack; Koogalien itself belongs to no one nation, as Solresol's inventor intended |
| Fun | A chart of chords is homework | Every session ends with the kid saying something to a Koogalien who answers; the Alien reacts with surprise; sentences play as music; kids' own sentences become jingles and postcards |
| Fake fluency | A kid who can only echo and thinks they speak | Quizzes use unseen sentences; the ladder ends in recall in time; the honest-feedback principle applies ("you mixed up `world` and `friend`") |
| Over-promising | "A new language" for kids may imply human-level fluency | Say what it is: a small playful language; a few hundred words; it teaches transferable skills |
| Mod hardware | Many kids have no mod wheel | Modulation is advanced, optional, and has on-screen sliders |
| Conflict with Koog Kode | Two ways to say a loop | Koogalien code text is a rendering of the Kore token stream; one engine, two skins |

## 10. Success measures

Measure what the kid does, not what the app shows.

1. **First minute:** more than 80% of new kids play a first word-chord within 60 seconds of opening the module.
2. **First ten minutes:** a kid writes, hears and reads `say hello world.` (the "three forms" moment). Target: more than 70% within ten minutes.
3. **Retention:** after a week, a kid recalls at least 8 of the first 12 words from sound alone.
4. **Reading back:** given a sentence played to them, a kid picks the right English at least 80% of the time for Tier 1 words.
5. **Spelling:** a kid spells their own name on the keys within the first three sessions.
6. **Conversation:** a kid replies to a Koogalien with a sentence of three or more words they chose.
7. **Transfer to code:** after the loop unit, a kid can say what `loop 3 say hello.` does and write a loop in Koog Kode.
8. **Recogniser health:** the share of kid chords that are an exact match, a near match, or unknown. Near-match suggestions accepted more than 70% of the time means the autocorrect is good.
9. **Joy:** sessions that end on purpose, not by frustration; kid-built requests to the build log ("make Zib sing"); kids who come back unprompted.
10. **Fairness:** equal progress with the chord builder and with keyboard chords; equal progress for left and right hand; equal progress with and without the mod wheel in basic Koogalien.

## 11. What to build first (pointer)

The language is useless without the loop of play, see, hear. The smallest thing that proves the thesis: the three-word demo (`say hello world.`) with the recogniser, the playback and the three-line ribbon on a keyboard and on pads. Everything else (spell mode, quizzes, voices, modulation, a dictionary of 120 words) is a layer on top. See `BUILD_PLAN.md`.

## 12. Open questions for the owner

1. Should the Koog Alien and the Koogaliens have pitched name-motifs inside the language (so their names are words)? The spec reserves `Koogalien` (C G A B) and `Koog Alien` (C G A C').
2. Is the language ever allowed to grow by the kids (a kid-coined word with a chord)? The spec reserves ~34 free chord slots for that.
3. How strict is the "pitch-only for beginners" rule on devices that have a mod wheel?
4. How should Koogalien talk to the App Store and the Koding Kore (is each Koogalien a Kore app)?

## Sources

- [Solresol, Wikipedia](https://en.wikipedia.org/wiki/Solresol); [History of Solresol, Babbel](https://www.babbel.com/en/magazine/what-is-solresol)
- [UNESCO: Silbo Gomero](https://ich.unesco.org/en/RL/whistled-language-of-the-island-of-la-gomera-canary-islands-silbo-gomero-00172)
- [Durojaye et al. 2021: the Yoruba dùndún](https://www.frontiersin.org/articles/10.3389/fcomm.2021.650382/pdf)
- [Plover: the chorded keyboard](https://morinted.gitbooks.io/plover-theory/content/layout/chorded-keyboard.html)
- [Koch method for Morse](https://hamradio.my/?p=1705)
- [Slevc, Rosenberg and Patel on music and language syntax](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658747)
- [Jones 2012 on chunking](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2012.00167/full)
- [Son et al. 2012, spacing in Grade 3 vocabulary](https://www.gwern.net/docs/spaced-repetition/2012-son.pdf)
- [Spaced retrieval in children with DLD, 2021](https://doaj.org/article/8a10ae0e049a4ae193d363239de3a5fd)

## North star: whole works of literature in Koogalien

The owner's long-term goal: *eventually, whole works of literature should translate to Koogalien.* A kid should be able to open a public-domain book (fables, fairy tales, poems, then novels; US public domain only), hear it as Koogalien music, watch the three-row ribbon (notes, code, English) scroll in time like a karaoke audiobook, and play along.

What that asks of the design, so v1 choices keep the door open:
- **Coverage over a fixed lexicon.** Literature needs tens of thousands of words, and chord-words are capped at roughly 150. So the hybrid must scale:
  - **Core words** stay chords, the most frequent few hundred. Word-frequency research suggests a few hundred words cover most of the words in children's text.
  - **Every other word is spelled** (spell mode).
  - **Common phrases** can later become multi-chord idioms.
  - The translator reports a "coverage" score per book, so the lexicon grows where books need it.
- **Streaming encoder.** `translate` / `encode` must work incrementally (sentence by sentence) with stable output, so a 60,000-word book never has to be held as one score. Paragraphs and chapters map to musical sections: a key change or a new Koogalien voice per character, and rests at paragraph breaks.
- **Meaning beyond words.**
  - Punctuation closers already carry `.` `?` `!`.
  - The tone/modulation layer carries emotion and emphasis (a wobble for excitement, a filter sweep for a question).
  - Dialogue is voiced by different Koogaliens (patches), so a story with three characters sounds like three speakers.
- **Readability as music.**
  - Tempo and phrasing presets ("read-aloud", "story time", "fast reader").
  - Long-form playback needs pacing: breaths at commas, longer rests at paragraphs.
  - The Learn ladder works on passages: hear a line, echo it, play it from memory.
- **A library pipeline (later).**
  - An offline build script converts public-domain texts into versioned Koogalien editions: data files with the coverage report and the spelled-word list.
  - Each edition is checked for copyright status before inclusion.
  - Editions are bundled with the app; no network.
- **Measures:** words per minute a kid can read in Koogalien by ear; how many lexicon words a kid knows; how many lines of a story they can play from memory.

Builders: keep the encoder incremental, keep the lexicon an extensible versioned data module with frequency metadata, and keep the sentence model free of length limits beyond the safety caps for live input.

### Reaching literature: more musical dimensions = more words

The owner's direction: *add factors like key duration, key, tempo and other parameters to Koogalien to reach literature level.* Every musical dimension a player can control reliably multiplies the vocabulary, the same way tones multiply syllables in a tonal language. Each dimension is introduced only once the kid is ready (the ladder), and every one has a "plain" default, so beginners never need it.

| Dimension | What the player does | Meaning it can carry | Multiplier |
|---|---|---|---|
| Chord (2–4 of 8 keys) | which keys | the word root | 154 roots (28 + 56 + 70) |
| Bass note / inversion | which chord note is lowest (stop folding octaves) | word family member (noun / verb / adjective of one root) | about ×3 (154 roots → 504 forms) |
| Duration | short tap vs held | short = the word, long = its plural / "very" / past | ×2 |
| Dynamics (velocity) | soft vs loud | soft = quoted or whispered, loud = emphasis or a name | ×2 |
| Articulation | staccato vs legato | urgent vs polite (already in LANGUAGE.md) | tone layer |
| Arpeggio direction | roll the chord up vs down | up = toward / give, down = away / take | ×2 |
| Rhythm cell | the chord on a straight vs dotted rhythm | question vs statement, or tense | ×2 |
| Key (tonal center) | which key you're in | topic or "chapter context": the same chord means different things in different topic keys, like a namespace | ×N per key |
| Mode (major / minor) | the scale used | mood of the passage, positive vs negative sense | ×2 |
| Tempo | the speed of the passage | narrative time: fast = action, slow = description or memory | discourse |
| Register (octave) | low vs high octave | speaker size or age (a giant low, a mouse high), or "inner voice" | ×2–3 |
| Modulation (LFO, filter, bend) | mod wheel, knobs, bend | emotion, questions, sarcasm, "many" (already in LANGUAGE.md) | tone layer |
| Patch / timbre | the instrument sound | which character is speaking (dialogue) | discourse |

**Capacity:**
- **One chord-stroke:** 504 forms × 2 (duration) × 2 (dynamics) × 2 (arpeggio direction) gives about **8,000 distinct single-stroke words** in one key.
- **Two-stroke compounds:** about **64 million**. That's more than English needs.
- **Key namespaces:** these give a natural way to group the lexicon by topic (nature, home, feelings, story words).

Literature needs roughly 20,000–50,000 word forms. With the chord, inversion, duration and dynamics layers, plus two-stroke compounds for rare words and spell mode as the safety net, every word in a public-domain novel has a playable form.

**Rules so it stays learnable:**
1. **A meaning, not decoration.** Each dimension means one consistent thing everywhere: duration always marks plural/intensity, never something else.
2. **Beginners never need it.** The plain form (short, medium loudness, root position, home key) is always valid and always means the base word.
3. **Unlocked one at a time.** Each dimension comes as a curriculum unit with its own Echo game.
4. **Matched forgivingly.** The recognizer scores each dimension separately with its own confidence. A wrong duration becomes "did you mean the plural?", never a failure.
5. **Reachable on every input.** Each dimension has a way in on keys, pads, the DJ controller and on-screen: hold = duration, velocity or pad pressure = dynamics, jog = register.

**For builders now:** the Stroke/Word types must carry optional `bass`, `durationClass`, `dyn`, `arp`, `rhythm`, `keyCenter`, `mode`, `register`, `tempo` and `mod` fields, defaulting to "plain". The encoder and decoder must pass them through unchanged even where v1 ignores them. Lexicon entries get an optional `forms` map (plural, intensity, family) so later units only add data.
