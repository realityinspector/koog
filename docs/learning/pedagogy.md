# Pedagogy and design notes: Koog (ages 4-14, small USB-MIDI keyboards)

Evidence note: web sources for early-childhood piano are mostly studio blogs and vendor pages, not studies. Items marked **[src]** have a cited URL. Items marked **[judgement]** are our design inference or general teaching practice, not verified by a source here. Treat numeric thresholds as tunable defaults.

## 0. The instrument

- No key lights, so the screen must do the "where" work (on-screen keyboard highlighting is mandatory, not optional). [judgement]
- Because it has built-in speakers, the app should avoid doubling the sound: do not synthesize the played note by default (latency echo), only backing/metronome/feedback sounds. Offer a toggle for "app plays notes" for keyboards without speakers. [judgement]

## 1. Age-appropriate pedagogy (4-10)

### Principles

| Idea | Source of the idea | What it means for us |
|---|---|---|
| Short, frequently changing activities | Music for Little Mozarts is built on brief, varied activities for the preschool attention span [src] https://www.sfcv.org/music-little-mozarts ; ages 4-6 have short attention and immature coordination [src] https://uh.edu/~tkoozin/projects/huitzu/preschool.html | Each "activity" 1-3 min; a session is 3-5 activities. |
| Practice length scales with age | One studio's policy: 15-20 min/day for 4-5, 20-30 for 6-7, 5 days/week [src] https://sites.google.com/view/marchantpianostudio/studio-info/tuition-and-options (single studio, not a standard) | Caps below in section 4. |
| Sound/concept before notation (Kodaly) | Kodaly: voice central, sung solfege, moveable-do, sequential, concepts first and notation later [src] https://www.masterclass.com/articles/kodaly-method-guide , https://dynamicmusicroom.com/kodaly-vs-suzuki/ | Sing/echo/clap activities precede reading. Offer solfege (do-re-mi) labels as a key-label option. |
| Rote, listening, imitation, play first read later; parent involved (Suzuki) | [src] https://dynamicmusicroom.com/kodaly-vs-suzuki/ , https://iu.pressbooks.pub/app/uploads/sites/984/2021/07/Principles-of-the-Suzuki-Method.pdf | "Listen then copy" is the first mode; a parent-mode (grown-up helps, shows the pattern) is a first-class flow. |
| Fingers numbered 1-5, thumb = 1, same both hands | General piano pedagogy (e.g. Music for Little Mozarts, Faber) [judgement] | Show finger numbers on hint dots; hand outline graphic. |
| Colour coding | Common in kids' methods (colour per note or per hand) [judgement] | Fixed colour per pitch class (C..B), consistent across keyboard, falling notes, staff noteheads. Left=blue, right=orange as hand colours. Must also use shape/label so colour-blind kids are fine. |
| Rhythm via body/voice before keys | Kodaly-style rhythm syllables (ta, ti-ti) [judgement] | Rhythm games on a single key or any key, "tap the beat" with the metronome pulse visualised. |

### Stage ladder (suggested)

| Stage | Age guide | Skill | Activity types |
|---|---|---|---|
| A. Explore | 4-5 | High/low, loud/soft, black-key groups (2s and 3s) | Free play with velocity-reactive visuals; "find the 2 black keys"; animal sounds low/high |
| B. Echo | 4-6 | Copy 1-3 note patterns by ear and sight | Teacher-note demo, child echoes; rote songs on black keys (pentatonic always sounds good) |
| C. Hand shape | 5-7 | 5-finger position C-G, finger numbers | Falling-note games, "which finger" prompts, rote short pieces |
| D. Pulse and rhythm | 5-8 | Steady beat, quarter/eighth/half | Play-with-the-beat games, call-and-response rhythm |
| E. Reading | 6-10 | Staff with C position, then G position, note names | Staff view with colour fading out; flash-note games |
| F. Two hands, expansion | 7-10 | Hands separately then together, scales, simple chords | Wait-mode songs, hand isolation |

Colour on the staff should be a removable scaffold: fade it per-level rather than drop it suddenly. [judgement]

## 2. What existing apps do

| App | Observed behaviour | Take-away |
|---|---|---|
| Simply Piano | Listens via mic, advances only when correct notes are played, linear guided path, feels "child like"; feedback judged shallow (right note/time only); can't isolate hands or turn off backing; free tier is two courses [src] https://www.pianistmagazine.com/blogs/simply-piano-a-piano-learning-app-for-beginner-pianists-and-above , https://www.guitarchalk.com/flowkey-vs-simply-piano/ | Linear path is good for kids; avoid shallow feedback; give hand isolation and backing toggle. |
| flowkey | Wait mode pauses until correct note is played; reviewers say feedback can be lenient and move on even if rhythm is off [src] https://pianoers.com/flowkey-review/ , https://www.guitarchalk.com/flowkey-vs-simply-piano/ | Wait mode first, then graduate to a timed mode so rhythm gets trained. |
| Piano Maestro (JoyTunes) | Little verified detail found; a competitor blog contrasts it with Simply Piano's "green light" compliance [src, promotional] https://www.the-maestro-online.com/blog/tag/simply-piano-vs-flowkey/ | Do not rely on claims about its internals. |
| Yousician, Synthesia, Duolingo Music | No sourced detail retrieved in this research. Common knowledge: Synthesia = falling notes with wait option; Duolingo = short lessons, streaks, XP [judgement, unverified] | Falling notes for "when/where", staff for reading; short lessons plus streaks are known engagement patterns (but see guilt rule below). |

### Mechanics comparison

| Mechanic | Good for | Risk | Our default |
|---|---|---|---|
| Wait-for-correct-note | Ages 4-7, new pieces | No rhythm learning; can become stop-start | Default for learning a phrase |
| Falling notes (Synthesia-style) | Pre-readers, timing, hand position | Teaches colour/position, not reading | Default for Stage C-D |
| Staff view | Reading (6+) | Overload for under 6 | Opt-in, introduced gradually; show alongside falling notes first |
| Timed play-along with scoring | Rhythm, motivation | Frustration if windows tight | Only after wait-mode clears; generous windows |
| Mic-based listening | Acoustic pianos | Noisy, laggy | Not needed; we have MIDI note-on with velocity (exact) |

Advantage of MIDI: exact note, exact time, and velocity, with no pitch-detection errors, so we can be strict about *what* and lenient about *when*. [judgement]

## 3. Fitting in 37 keys

- 37 keys = 3 octaves. Standard 37-key layout is C to C (C2-C5 in the common scientific naming, MIDI 36-72), but ranges vary by keyboard. **Detect the real range at runtime** (first note-ons, plus an "press your lowest key" calibration step) rather than hardcoding. [judgement]
- Middle C (MIDI 60) sits roughly in the middle octave when range is C2-C5: use it as the home position for the right hand. [judgement]
- Everything up to grand-staff beginner repertoire fits: five-finger positions, C and G major scales over one octave (two octaves also fit), simple LH/RH pieces with hands in 5-finger positions.
- Songs that fit easily (public domain / traditional, 5-finger or small span):

| Song | Hand position | Notes |
|---|---|---|
| Mary Had a Little Lamb | C position, E-D-C | 3 notes first |
| Hot Cross Buns | E-D-C | 3 notes |
| Twinkle Twinkle | C position (C-A needs thumb shift to reach A) | Teach as C-G + shift |
| Ode to Joy | C position (E E F G...) | Fits 5 fingers (mostly) |
| Jingle Bells (chorus) | C position, plus G | Fits |
| Happy Birthday | Spans a 6th-octave-ish range | Needs a hand move |
| Pentatonic black-key improvising | F#-G#-A#-C#-D# | Always consonant; great for ages 4-5 |

Check each arrangement's pitch span in code and mark each song with its required hand position/shifts. [judgement]

- Octave shifting: keyboard hardware is fixed, so the *app* should transpose. Provide: (a) auto-transpose a song into range; (b) octave offset setting; (c) accept a note in any octave as correct in early "pitch class" games (mode flag), strict octave in later levels. Let LH parts sit in the lower octave (C2-B3) and RH in the upper (C3-C5 or so). [judgement]
- Wide-range pieces (more than 3 octaves, big LH leaps) are out of scope; filter the library by fit. [judgement]

## 4. Implementable design rules

### Input and timing
1. **Use note-on with `event.timeStamp`/MIDI timestamp, not the render frame**, for judging; keep audio and visuals on `AudioContext` time. Calibrate latency once (tap-along test) and store an offset. [judgement]
2. **Wait mode:** accept only the next expected note (or chord set within a 100-150 ms gather window); wrong notes show a soft "try that again" colour pulse, no sound of failure, no penalty. Never time out.
3. **Timed mode windows (defaults, tune by testing):** ages 4-6: ±250 ms "good", ±400 ms "ok" (still counts); 7-10: ±150 ms "great", ±250 ms "good". Never show a "miss" label to under-7s; just show the note was "not yet".
4. **Adaptive:** after 2 consecutive misses widen the window or slow tempo 10%; after 3 clean runs speed up 5-10%. Tempo floor 50 BPM for beginners.
5. **Ignore stray notes**: extra notes within an octave of the target in wait mode are free; do not count as errors in explore modes. Debounce note-on repeats under 30 ms. Support sustain pedal CC64 as a no-op.
6. **Hold-time/duration optional**: for Stage D+, long notes use note-off timing with generous tolerance.

### Velocity feedback
7. Map velocity to visuals (note bubble size/glow, keyboard key depress) with a **log-ish curve** and a per-keyboard calibration ("play softly / play loudly") because cheap synth-action keys cluster in a narrow range. [judgement]
8. Dynamics games: "quiet mouse / loud lion"; judge against 3 broad bands (soft, medium, loud), not exact values. Do not penalise velocity in note games.
9. Do not gate progress on velocity until the child (or parent) opts into the dynamics lessons.

### Feedback and rewards
10. Immediate, 100-300 ms visible reaction to every key, correct or not (colour fills the right-note colour; stray notes get a neutral shimmer).
11. **Praise effort and specific things** ("steady beat!") not just stars; keep celebration animations under 2 s and skippable; reduced-motion setting.
12. Reward **collection, not loss**: stickers/stamps/pieces unlock a picture or character; nothing is removed, no hearts, no countdown pressure.
13. **Streaks without guilt:** count "days played this week" (e.g. 5 of 7 dots), never "streak broken". Missing a day does nothing visible. A "rest day" is a normal state. Streak freeze unnecessary because there's no loss. [judgement; contrast with Duolingo-style streaks which we are choosing not to copy]
14. Stars (1-3) based on completion/accuracy with 1 star for *finishing*; every finished activity gets at least 1.
15. Frustration detector: 3+ failures on the same bar, or 20 s of no correct input in wait mode, so slow the tempo, shorten the phrase to the failing bar, or show a hint (finger number, highlight). After a 4th failure offer "play it for me" (demo) and a "skip for now / try something else" button.

### Sessions
16. **Session length caps (defaults, parent-adjustable):** ages 4-5: 10-15 min soft limit; 6-7: 15-20 min; 8-10: 20-30 min. Rationale: one studio's daily practice guide is 15-20 min for 4-5 and 20-30 min for 6-7 [src] https://sites.google.com/view/marchantpianostudio/studio-info/tuition-and-options ; our slightly lower under-5 default is a judgement.
17. Each activity 1-3 minutes; auto-rotate activity type (listen, echo, play, rhythm, free-play) so no type runs more than ~3 min at the 4-6 end. [src for varied short activities: https://www.sfcv.org/music-little-mozarts]
18. Cap = **gentle wind-down**, not a hard cut: at the limit, finish the current piece, show a "great practice" screen, offer a "just one more" free-play button (counts toward nothing). Parent PIN to change caps and to quit.
19. Always end on success: final activity is a previously-mastered song.
20. "Parent mode" screen: shows what was played, a suggested "ask her to show you..." prompt, and no scoring pressure on the parent.

### Display and structure
21. Keyboard on screen is always visible, matches the physical 37 keys (including auto-detected range), with target key highlighted in the pitch colour plus finger number.
22. Large touch/click targets; minimal reading required under 7: icons and voice prompts (pre-recorded audio or Web Speech `speechSynthesis` as fallback). [judgement]
23. Progression is a **linear path** with a few side-branch free activities (Simply Piano's linear path suits beginners per [src] https://www.guitarchalk.com/flowkey-vs-simply-piano/) but with a "choose a song" shelf unlocked as songs are learned.
24. Scaffold fade: coloured notes, then colour only the first note, then none; finger numbers fade in the same way.
25. Hand isolation and backing-track toggle on every song (a gap noted in Simply Piano) [src] https://www.guitarchalk.com/flowkey-vs-simply-piano/ .
26. Store progress locally (IndexedDB/localStorage) with export; no accounts, no ads, no purchases flow in the child UI. [judgement]
27. Handle device loss gracefully: if MIDI disconnects, pause (don't fail) and show a friendly "wake up the piano" screen with a reconnect button; Web MIDI needs a user gesture / permission and a Chromium-based browser (Safari lacks Web MIDI). [judgement; verify browser support before shipping]

## 5. Open questions to verify with the real hardware
- Exact MIDI note range and any octave-button behaviour on your keyboard.
- Velocity curve and note-on latency over USB vs Bluetooth.
- Speaker latency relationship to app audio when playing backing tracks (add an output-latency setting).

## Sources
- Music for Little Mozarts: https://www.sfcv.org/music-little-mozarts
- Ages 4-6 attention/coordination: https://uh.edu/~tkoozin/projects/huitzu/preschool.html
- Studio practice-time policy: https://sites.google.com/view/marchantpianostudio/studio-info/tuition-and-options
- Kodaly guide: https://www.masterclass.com/articles/kodaly-method-guide ; Kodaly vs Suzuki: https://dynamicmusicroom.com/kodaly-vs-suzuki/ ; Suzuki principles: https://iu.pressbooks.pub/app/uploads/sites/984/2021/07/Principles-of-the-Suzuki-Method.pdf
- flowkey reviews: https://pianoers.com/flowkey-review/ ; comparison: https://www.guitarchalk.com/flowkey-vs-simply-piano/
- Simply Piano review: https://www.pianistmagazine.com/blogs/simply-piano-a-piano-learning-app-for-beginner-pianists-and-above
- Piano Maestro (promotional): https://www.the-maestro-online.com/blog/tag/simply-piano-vs-flowkey/
