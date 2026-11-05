# Koogalien architecture: how Koogalien fits Koog

Status: plan v1 (planner 2), built on `docs/koogalien/LANGUAGE.md` v0 (planner 1). That spec is authoritative for notes, words, spell mode, closers and tone. Every musical decision lives in ONE data module, `src/koogalien/data/`, so a later change to a chord is a data edit plus fixtures. Everything else here is mechanism.

Key facts taken from LANGUAGE.md: the language uses 8 notes (do re mi fa sol la si do', pads 1 to 8, white keys C to C'); a word is a CHORD of 1 to 4 of them pressed within 70 ms; a lone note is a digit; spell mode is two-note letters (row 1-7, column 1-4); a sentence ends with a closer chord (`.` 5+8, `?` 2+5, `!` 1+3+5+8); a rest of a beat or a pedal tap is the word boundary; tone (loud/soft, major/minor flavour, and in advanced Koogalien wobble, sweep, bend) adds feeling.

## Names

- **Koogalien**: the language ("the Koogalese language system"). Notes, chords, rhythm and sound-shaping that line up with words.
- **Koogalien** (the module/app): also named Koogalien. It teaches the language. It is a Kore app family in the Koog App Store.
- **The Koog Alien**: the single mascot who hosts the module and teaches. UI uses the mascot SVG component from `src/brand/mascot/` (poses and expressions, being built by another agent). All UI reaches it through ONE adapter, `src/features/koogalien/ui/Host.tsx`, which uses `import.meta.glob('../../../brand/mascot/*')` and falls back to a plain emoji badge until the component lands.
- **Koogaliens** (plural): the characters who speak the language. In v1 three voices (Pip, Dro, Zee), each with its own synth patch. They greet, quiz and reply; the Koog Alien introduces them.
- Folders: `src/koogalien/` language core (pure, no DOM, no audio). `src/features/koogalien/` the app. Scripts `scripts/koogalien-*.ts`, npm `check:koogalien*`. Route `#/koogalien`.

## Big picture

```
 DEVICES  keys / MIDI / pads / DJ / pedal / mod wheel / sliders
    |  (src/kode/tokens.ts: onToken, startKode)        (CC + bend: src/features/koogalien/modInput.ts, additive)
    v
 KodeToken stream + ModSample stream ---------------------+
    |                                                      |
    v                                                      v
 koogalien/engine/recognize  (PURE: tokens -> chords -> words -> sentence, with confidence)
    |
    +--> Sentence { words[], end } --+--> koogalien/lang/print  -> Koogalien code   say hello world.
    |                                +--> koogalien/engine/gloss -> English      "hello world"
    |                                +--> koogalien/engine/encode -> Score       (notes+chords+timing+mods)
    |                                                                               |
    |                                                    features/koogalien/play (Kore sound, audio clock)
    v                                                                               v
 SentenceRibbon (notes | code | English, aligned word by word)               "hear it back"

 TYPED/PASTED CODE  say hi.  --koogalien/lang/parse--> Sentence  (same path as above, no devices)
 ENGLISH TEXT       "hello world" --koogalien/engine/translate--> Sentence --> encode --> play
```

One value, `Sentence`, is the hub. Every form (played, code, English, Score, share link) is a pure function of it. That is what makes "write hello world by playing, see it as code, hear it back, read the English" four views of one thing, and it is the thing the fixtures test.

## Modules

### 1. Data: `src/koogalien/data/` (pure, versioned)
- `types.ts`: shared types (written first, see BUILD_PLAN). The atom is a `Chord`: a sorted set of scale degrees 1 to 8.
- `lexicon.ts`: the starter lexicon, ported 1:1 from the LANGUAGE.md table (about 120 entries: `{id, en, chord, kind, tier, unit, emoji, alt[]}`), including closers `.` `?` `!`, `spell`, digits-as-words `zero nine ten`, and the control words. Builder A ports the table with a script-like fixture that re-parses the markdown table in LANGUAGE.md and checks it equals the TS data (so the two cannot drift).
- `alphabet.ts`: the 26 letters as `(row, col)` pairs (rows ABCD EFGH IJKL MNOP QRST UVWX YZ; columns 1 to 4), plus `SPELL_END` (5+8), `BACKSPACE` (lone 8).
- `tone.ts`: the tone layer: `Loudness` bands, flavour (major/minor), and `MOD_MEANINGS` (v1: `wobble` = excited; others reserved; extended if LANGUAGE.md section 7 defines more).
- `aliens.ts`: Koogaliens (voices): `{id, name, emoji, patch, centre, greeting}`.
- `version.ts`: `KOOGALIEN_VERSION = 1`. Share links and saved messages carry it. Lexicon ids are never renumbered, only added or deprecated with a replacement.
- Invariants fixture: no two entries share a chord; all chords have 1 to 4 degrees; the 8 single-note chords are reserved for digits; every lexicon id is unique and lowercase; every letter reachable; tier 1 words are exactly the "first dozen".

### 2. Encoder: `src/koogalien/engine/encode.ts` (English to Koogalien)
`translate(text) -> Sentence`: tokenize, lowercase, look each word up (also `alt`), numbers 0 to 10 become digit notes or the `zero/nine/ten` words, anything unknown becomes a SPELLED word (spell chord, then row/column note pairs, then the spell-end chord), a trailing `. ? !` becomes the closer. `encode(sentence, opts) -> Score`: a chord is played together (one `ChordEvent`), words are separated by a one-beat rest, spell letters are two single notes in sequence, a `?` closer makes playback lift the last word's pitch, a `!` closer is played loud. Per-word `tone` (loudness, flavour, mods) becomes velocity and `ModEvent`s, so the encoder outputs modulation, not only notes. Pure, deterministic, length-capped.

### 3. Decoder / recognizer: `src/koogalien/engine/recognize.ts` (played to words)
A pure reducer `step(state, input) -> {state, out[]}`; input is a `KodeToken`, a `ModSample` or a `{tick}`. Tests replay recorded token arrays; no timers, no eval, no audio.
- **Degrees, not pitches**: `degreeOf(midi, homeC)` maps white keys C..C' to 1..8 (home octave configurable, default middle C; other octaves fold by pitch class; a C at or above homeC+12 is degree 8, below it is 1). Black keys are ignored (shown as "not Koogalien"). Pad tokens map lane 0..7 to degrees 1..8 directly, so keys, drum pads, DJ pads and the on-screen pads are one input.
- **Chord window**: notes within 70 ms (`chordMs`, configurable to 120) form one `Chord`. "Slow chord": a held key plus a new key within one second commits as a chord. **Chord builder (accessibility mode)**: keys pressed one at a time stay lit, then a pedal tap (or the OK pad) commits them; the recognizer receives a `commit` input and treats it as a simultaneous chord.
- **Word boundary**: a rest of 1 beat or more (400 ms in free time), or one pedal tap. **Sentence timeout**: a rest of 2 beats or more, or two pedal taps; it acts as `.` if no closer was played. A closer chord (`.`, `?`, `!`) ends the sentence and sets its mood.
- **Modes**: normal mode reads a chord as a word (nearest lexicon chord), a lone note as a digit (1 to 8). The `spell` chord switches to spell mode: notes are consumed in pairs (row 1 to 7, column 1 to 4) giving a letter; a chord pressed together is a control (`5+8` ends spell mode, lone `8` is backspace); a rest of 2 beats also ends it. A half-finished letter is shown as pending.
- **Nearest-word matching** (`match.ts`): the distance between chords is the Jaccard distance over degree sets (a wrong or missing key costs, one key off in a 2-note chord is large, in a 4-note chord is small). `confidence = 1 - distance`, adjusted by a small prior for words the kid has `known`. `>= 0.85` accepted (`ok`); `0.5 .. 0.85` is `maybe` with up to 3 alternatives ("Did you mean...?"); below 0.5 is `unknown` and shows the raw notes. Exact chord = confidence 1. Because a one-note miss can legitimately be another word, a `maybe` never changes the sentence silently: it is highlighted until the kid confirms (the ribbon shows the alternatives).
- **Tone**: velocity buckets (soft / normal / loud), a chord's flavour comes from the data (major or minor), and modulation: `ModSample {kind:'wheel'|'bend'|'knob'|'slider', value, t}` held above `modThreshold` for `modHoldMs` while a word sounds attaches `wobble` to that word. Sources: mod wheel (MIDI CC1), pitch bend (0xE0), DJ knobs and jog through the device roles in `src/music/devices.ts`, and the on-screen slider (`emitMod`).
- Devices: keys/midi, drums, dj (pads), pedal (boundary/commit), screen (on-screen pads and Space/End buttons). If a source is absent the recognizer simply never sees it.
- Hard limits: 20 letters per spelled word, 32 words per sentence, 400 chars of code. A friendly diag, never a hang.

### 4. Koogalien code form: `src/koogalien/lang/` (text syntax)
LANGUAGE.md calls a sentence "both a sentence and a tiny program" (`say hello world.`). The code form is that idea made literal.
```
say hello world.             # canonical: bare words, closer at the end (. ? !)
say are you happy?           # the closer sets the ending
say hello "Maya" .           # quotes spell a name or any word not in the lexicon (spell mode)
say 3 2 1 !                  # digits are lone notes
let hi = hello friend.       # variable holding a sentence (unit 8)
say hi world.                # a name used in a say is replaced by its sentence
# comments start with #
```
Quotes around the WHOLE text (`say "hello world"`) are accepted on input and printed back in the canonical bare form. 
`parse(src) -> {sentence?, program, errors: Diag[]}`, `print(sentence) -> string` (canonical form), and `print(parse(print(s))) == print(s)` is a fixture (round trip). `lower(program) -> Sentence` evaluates `let` and joins by plain substitution (no loops, no eval, no recursion in v1, so it always terminates). Unknown words in `say` produce a Diag that suggests the closest word ("did you mean 'happy'?").

**Extend the Koog Kode language or keep it separate? Separate, with a bridge.** Reasons: (1) `src/kode/lang` is owned by another agent and is a pattern language about WHEN notes sound (`notes "c e g"`); Koogalien code is about WHAT is said and is word-valued, with its own diagnostics and a lexicon check. (2) Putting meaning into the pattern grammar would couple its release to ours and risk breaking the kid-facing Kode editor. (3) Pure modules with their own limits are easier to fixture. The bridge: `koogalien/lang/toKode.ts` emits `notes "..."` lines from a Score so any Koogalien sentence opens in the Kode editor, and `Diag` and the `describe` style are imported from `kode/lang/types` (type only). A later version may add a `say` keyword to Kode; nothing here blocks it.

### 5. Playback: `src/features/koogalien/play/` ("hear it back")
`playScore(score, port, opts) -> handle{stop(), done: Promise}`. The `SoundPort` interface (below) wraps `kore.sound.note(n, vel, whenBeat)`, `kore.sound.drum`, and `kore.clock`. All notes are scheduled up front on the audio clock (sample-accurate `noteOn(n, v, when)` path), never with `setTimeout` chains, so a busy UI can't smear rhythm. Playback registers with `src/music/panic.ts`, goes through a capped channel in `src/audio/host.ts`, never exceeds velocity 0.85, and polyphony of 6.
- **Voice per Koogalien**: each alien has a `patch` (a partial `SynthParams`: waveform, cutoff, filter envelope, LFO shape). Playback applies the patch before the first note and restores the previous synth params when it finishes or is stopped.
- **Modulation**: a `ModEvent` with `wobble` sets the synth's LFO (`lfoTarget:'pitch'|'amp'`, `lfoRate`, `lfoDepth` in `src/features/synth-history/engine.ts` params) at its start beat and returns it to the previous value at its end. v1 uses those existing params (depth max 0.6, rate 4 to 7 Hz; audio only, and any visual echo of it obeys the 3-flashes-per-second cap). Filter sweeps (`cutoff`), glide (the engine's shared `bend` source, in cents) and tremolo (`lfoTarget:'amp'`) are v2 and the `ModName` type reserves them. Playback calls the setters through a small `ModPort` so tests can record the calls.
- **Highlight feed**: playback emits `onWord(i)` at the scheduled time (a lookahead timer reads the audio clock) so the ribbon highlights the word being heard.

### 6. Visuals: `src/features/koogalien/ribbon/`
`SentenceRibbon` (hosted by the Koog Alien mascot, whose expression reacts: listening, pleased on a clean match, puzzled on `maybe`/`unknown`) renders one column per word with three aligned rows: NOTES (a small 8-pad strip with the chord's degrees lit, plus note names on request; spelled words show their row/column pairs), CODE (the Koogalien word token), ENGLISH (the gloss and emoji). The current word is marked by a thick underline and a steady fill, never a blink. Low-confidence words show a dashed border and the alternatives. A live "Listening..." column shows chords arriving before they become a word.
- Color-blind safe: each word kind has a color from the Okabe-Ito palette AND a shape/pattern/label, so meaning never depends on hue. Contrast at least 4.5:1.
- Motion: highlight advance is at most 2 per second at the slowest default tempo and is a position change, not a flash; reduced-motion removes animation. At most 3 flashes a second anywhere (the Koogalien blink is capped through the same `flashOk()` style limiter as the holiday engine). No full-screen flashes.
- Screen reader: `describeSentence(s): string` gives text for every sentence, for example "Koogalien sentence, 2 words. Word 1: hello, notes C and E together then G. Word 2: world. Ends with a full stop. Means: hello world." The ribbon root has `role="group"`, `aria-label` set from it, and a `aria-live="polite"` region announces a newly recognized sentence once (not per word).

### 7. Learning: `src/koogalien/learn/` (pure) + `src/features/koogalien/learn/` (UI)
- `srs.ts`: Leitner boxes (5): box 1 review next session, then 1, 3, 7, 14 days. `review(card, correct, now)`; `due(cards, now, limit)`. `now` is injected so fixtures control time. Cards are words, letters and short sentences.
- **Phrase ladder** applied to words: the six holiday rungs, reused through `kore.ladder` where available: Hunt & Peck (the guide shows the keys, no pressure), Follow (the ribbon shows the notes, you play along), Echo (the Koogalien plays, you answer), Memory (hear it once, then play it), Play full (a whole sentence at your own pace), Master (a whole sentence in time with the beat). The rung applies to a word first, then a sentence; a word is "learned" at Echo, "known" at Master.
- **Progress**: `kore.progress.load/save('koogalien', ...)` (per player, via `pload`/`psave`). Shape: `{v, unitsDone, cards, sentencesWritten, stars}`.
- **concepts.mark**: `sequence` when a sentence of 2 or more words is written; `function` when a `let` sentence (or a saved motif used as a word) is defined; `variable` for `let`; `parameter` when a word is given a modulation or a sentence is repeated with a different alien; `debug` when the kid fixes a `maybe`/unknown word; `event` for pedal-as-boundary use. Marks are made exactly once at the moment of use.

### 8. Messages and "send"
A message is a `Sentence`. "Send" never touches a network: it produces (a) a share link `#/koogalien?m=<code>` where `<code>` is the Koogalien code form, URL-encoded, version-tagged, at most 400 chars, that anyone with the app can open and hear (reading it is parse + play, nothing executed), and (b) a local copy in the "Inbox/Outbox" list in the kid's profile (`pload('koogalien-box')`, 50 messages max). Nothing is uploaded; there is no server code. The "reply" a Koogalien gives is generated locally from a small table (greeting in, greeting out).

## Where it plugs in
- Registered as Kore apps in `src/kode/kore/apps.ts` (by the Kore agent, or via `registerApp` at module load): `koogalien` (the hub: Writer, Dictionary, Games). The App Store then lists it with `concepts`, `inputs: ['keys','drums','dj','pedal','screen']`, `ages: [7,99]`.
- Component is lazy-loaded: `() => import('../../features/koogalien/KoogalienApp')`. It receives `{kore}`; only `features/koogalien/host.ts` touches `kore`, and builds the `SoundPort`, `ModPort`, `Progress`, `Concepts` interfaces so the rest is testable and works with a fake host if the Kore slips.
- Reachable from: the App Store, `#/koogalien` route, a Modes entry, a tour stop at the end of `gallery/stops.data.ts`, the README feature table.

## Data-flow for the headline scene
Kid plays [C+E+G chord] (rest) [A chord]:
1. Tokens arrive (`keys`: C and A inside 70 ms) -> chord {1,6}. A rest of 1.4 beats -> word boundary. Next chord {1,5,8} -> word 2. A closer chord (5+8) or a 2-beat rest ends the sentence.
2. `match()` finds hello (confidence 0.97) and world (0.91).
3. `Sentence{words:[hello,world], end:'.'}` is stored in `useKoogalien` (zustand).
4. Ribbon redraws: notes row, `say hello world.`, "hello world". `describeSentence` updates the live region.
5. "Hear it" -> `encode()` -> `playScore()` -> highlight steps word by word.
(hello = 1+6, world = 1+5+8, from LANGUAGE.md.)

## Constraints (checklist for every builder)
- No network, no `fetch`, no `eval`/`Function`, no dynamic `import()` of user data. The recognizer and parser are pure functions with hard limits.
- Volume: capped channel, velocity cap 0.85, limiter stays on, polyphony 6, registered with panic. Mod depth capped.
- Photosensitivity: at most 3 flashes/s, no full-screen flashes, reduced-motion respected.
- Privacy: messages and progress only in `pload/psave`; share links carry only the sentence the kid chose to share; no analytics.
- Accessibility: `describeSentence` for every sentence, keyboard-operable controls, never color alone, mod and pedal both have on-screen equivalents.
- House rules: DEVELOPING.md (HMR: one kind of export per file, `import.meta.hot.accept(` literal, state in zustand/hot data, `pload/psave`), no brand names, no editing `buildlog/entries.ts`.
- Language changes: LANGUAGE.md is v0. Chord assignments are data; if the tone section (7) adds meanings, add them to `data/tone.ts` and the `ModName` union (additive).
