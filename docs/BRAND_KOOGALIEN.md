# Koogalien brand pass: proposal

Status: PROPOSAL. Nothing in the UI changes until the owner approves. Names live in one file, `src/brand/names.ts` (values are the current names today). Applying the rebrand = edit values there + swap hardcoded strings to `NAMES.*` (swap list at the bottom).

Owner decisions already folded in: "Komma" and "Komms" are dropped. **Koogalien** is the language AND the module that teaches it. **Koogaliens** are the aliens who speak it. The mascot is **the Koog Alien** (art in `src/brand/mascot/`). Komma Racer is now **Koogalien Racer**. Choreographer is now **Koreographer**. Docs under `docs/komms/` still say Komma/Komms/Pip/Dro/Zee and need a find-and-replace pass by the Komma team (see Decisions).

## Rules

1. Kid NAVIGATION stays plain: PLAY, SONGS, CHALLENGE, GAMES, BEATS, SYNTH, LOG, Settings, Back, Start (and boss rail DJ, LOOPS, DRUMS, SCENES). Teachers and parents must understand the app at a glance.
2. FEATURE and CHARACTER names get the Koogalien treatment only when it reads naturally and stays pronounceable.
3. No K-ifying that hurts early readers or collides with real words. Never "KK" clusters or triple-K runs (a K-word next to a K-word with a space is fine: "Koog Kode"; a doubled letter inside a word is not). Each proposal below was checked for slur or odd-letter readings. Avoid: "Kommunity", "Kool", "Kut", "Kidz"-style spellings, anything ending in "-kk".
4. Lore: the Koog Alien hosts. Everything else is a friend of the Koog Alien.
5. Plain description always stays in the tooltip or blurb ("Koach: a friendly tips helper"), so a rename never hides what a thing does.

## Lore paragraph (reusable by the Komma/Koogalien team)

> The Koog Alien came to Earth by following a sound. It landed inside a synth and has been there ever since, because it loves music more than anything on its home planet, where everybody talks in notes. That language is Koogalien: a note, a chord or a rhythm is a letter or a word, and a sentence is a little song. The Koog Alien greets you when you open Koog, cheers when you reach a milestone, and teaches you Koogalien one word at a time. Other Koogaliens, its friends and cousins, drop in to help: one coaches, one DJs, one dances. Nobody is ever scolded. Wrong notes are just Earth accents.

Light touches only: a Koog Alien face in celebrations, the greeting line, the Mentor and DJ seats, loading and empty states. No lore gate in front of any feature.

## Table

Risk: R = readability for early readers, C = confusion. Recommend: NOW (apply now), WAVE (apply after the current wave of edits lands), SKIP.

| Current name | Proposed | Why | Risk | Recommend |
|---|---|---|---|---|
| Mentor | Koach (the Koog Alien in coach hat) | One K, hard-K sound matches "coach", pronounced like it | R low (reads "coach"); C low with tooltip | WAVE |
| Band / Smart Band | Koogalien Band | Cousins who back you up | R low; C low | WAVE |
| Mimic | Mimic (keep) | Already a plain fun word; "Koog answers" blurb already on-brand | none | SKIP |
| Vibes face | Koogalien mood | The face is a Koogalien reacting to your music | C low | WAVE |
| Vibes (visual) | Vibes (keep) | Common word, used in gallery stops and visual picker | none | SKIP |
| Dancer | Dancer, kid-named (keep naming chip); default name "Zee" | Kid already names the dancer; just give a Koogalien default | none | WAVE |
| DJ + Piano / Duo | DJ + Piano (keep); DJ seat is a Koogalien | Plain, describes the mode exactly | none | SKIP (character only) |
| Looper / Loop station | Looper (keep) | Core function, widely understood | none | SKIP |
| Drum pads | Drum pads (keep) | Same | none | SKIP |
| Game pads | Game pads (keep) | Same | none | SKIP |
| Beat Machine | Beat Kore | Ties to Koding Kore (the SDK) | C medium: Kore is the SDK, kids may think it is code | SKIP (use only in Boss/teacher view) |
| Pedalboard | Pedalboard (keep) | Real-world term teachers use | none | SKIP |
| Pedals (Fuzz, Echo, Jet, Swirl, Wobble, Quack, Squeeze, Octave, Reverb) | keep | Already playful, readable | none | SKIP |
| Challenges (nav label CHALLENGE) | nav plain; panel title "Kwests" is NOT recommended | "Kw" is hard for early readers | R high | SKIP. Use "Koog Challenges" in the panel heading only if wanted |
| Daily Challenge | Daily Challenge (keep) | Plain | none | SKIP |
| Boss Level / Boss mode | Boss mode (keep) | "Boss" is already the studio/Dad mode name used across docs and gallery. "Kaptain mode" reads like a different feature | C medium | SKIP |
| Studio | Studio (keep) | Nav-like | none | SKIP |
| Scenes | Scenes (keep) | Nav-like | none | SKIP |
| Learn it ladder rungs (Listen, Follow, Echo, Memory, In time, No sheet, Both hands) | keep | Early-reader words; same ladder Koogalien lessons use | none | SKIP |
| My Songs | My Songs (keep) | Personal, plain | none | SKIP |
| My Motifs | My Motifs (keep) | Already a Koog Kode app | none | SKIP |
| coding powers badges | Koding powers | Matches "Koding" (coding-with-music) | R low | NOW |
| Patch / Patch drawer | Patch (keep) | Synth term teachers expect | none | SKIP |
| Quests | Quests (keep) | Already a good game word | none | SKIP |
| Phrase Match | Phrase Match (keep) | Plain description | none | SKIP |
| Light the Tree / Harvest Feast | keep | Holiday names read best plain | none | SKIP |
| BachDoom, Zombie Lanes, Jiu-Jitsu Flow, Runway Remix | keep | Established, descriptive | none | SKIP |
| Komma Racer | Koogalien Racer | Owner decision | R low (long) | NOW |
| Choreographer | Koreographer | Owner decision; "Ko-reo" still sounds right | R medium, teach once | NOW |
| Gallery | Koog Gallery | Natural, no spelling change | none | WAVE |
| Art Gallery mode | Koog Art Gallery | Same | none | WAVE |
| Guided tour | Tour with the Koog Alien | Mascot hosts the tour | C low | WAVE |
| Build log (LOG nav stays) | Koog Crew log | "Crew" (not "Krew") avoids a KK-style Koog-K look | R low | WAVE |
| Idea? button | Idea? (keep) | One word, instant meaning | none | SKIP |
| Perf HUD / Is Koog keeping up? | Koog Pulse | Reads as a heartbeat for the app; tooltip says "performance" | C low | WAVE |
| Boost | Boost (keep) | Short, safe, has ear-protection timer | none | SKIP |
| Metronome (M key) | keep | Teachers expect it | none | SKIP |
| Timeline / Instruments | keep | History view, plain | none | SKIP |
| Synth History (nav SYNTH) | keep | Nav plain | none | SKIP |
| Koog instruments (Koog Ladder, Koog Squelch, ...) | keep | Already done | none | SKIP |
| Koog App Store | keep | Already done | none | SKIP |
| Koog Kode / Koding Kore | keep | Already done | none | SKIP |
| Celebration toasts ("New badge") | "Koog Alien cheer" visuals, text stays | Lore, no word change | none | WAVE |
| The Koogalien teaching module (was Komms) | Koogalien (module name equals language) | Owner decision; store and launcher label "Koogalien" | C medium: name used for both language and lessons, so tooltip "Learn Koogalien" | NOW |
| Komma guides Pip, Dro, Zee | Keep as Koogalien cousins; Zee also dances | Consistent with docs/komms | none | needs Komma team |

## Top 15 recommended renames

1. Komma Racer to Koogalien Racer (NOW)
2. Choreographer to Koreographer (NOW)
3. Komms module and Komma language to Koogalien (NOW)
4. "coding powers" to Koding powers (NOW)
5. Mentor to Koach (WAVE)
6. Band / Smart Band to Koogalien Band (WAVE)
7. Vibes face to Koogalien mood (WAVE)
8. Gallery to Koog Gallery (WAVE)
9. Art Gallery to Koog Art Gallery (WAVE)
10. Guided tour to Tour with the Koog Alien (WAVE)
11. Build log to Koog Crew log (WAVE)
12. Perf HUD to Koog Pulse (WAVE)
13. Dancer default name to a Koogalien name (WAVE)
14. Celebration cheers become Koog Alien cheers (WAVE)
15. Beat machine to Beat Kore, Boss/teacher view only (optional)

## Decisions for the owner

- Koach vs a named Koogalien mentor (for example "Pip the Koach")? Recommend plain "Koach".
- Koog Pulse for the Perf HUD, or leave "Perf"?
- One word "Koogalien" for both language and lessons: confirm a "Learn Koogalien" tooltip is enough.
- docs/komms/*.md still use Komma/Komms; who updates them?
- Early-reader testing on "Koach" and "Koreographer" before apply.
- Challenges to "Kwests": recommend NO.

## Swap list (path:line, as of this snapshot; other agents are editing, so re-grep before applying)

- src/features/modes/ModesLauncher.tsx:56 'DJ + Piano', :58 'Band', :59 'Mimic', :62 'Mentor', :63 'Vibes face', :67 'Looper', :69 'Drum pads', :71 'Koog Kode', :73 'Pedalboard' (CardDef name and blurb), :100 'Art Gallery' button, :102 store button
- src/App.tsx:58 'Challenges', :62 'Behind the scenes', :71-73 boss titles 'Loop station', 'Drum pads', 'Emulator rack', 'Scenes' (labels PLAY/SONGS/CHALLENGE/GAMES/BEATS/SYNTH/LOG stay)
- src/features/games/GamesPanel.tsx:23-30 titles Zombie Lanes, Jiu-Jitsu Flow, Runway Remix, Phrase Match, Harvest Feast, Light the Tree, Komma Racer (:29 to NAMES.racer), BachDoom
- src/features/gallery/stops.data.ts:91 'Mentor', :94 'Smart Band', :97 'Mimic', :100 'DJ + Piano', :106 'Patch Quests', :112 'Drum pads', :229 'Art Gallery mode', :263 'Dancer easter eggs', :271 'Is Koog keeping up?', :279 'Komma Racer'
- src/features/gallery/Gallery.tsx:38,40 'Art Gallery mode'
- src/features/mentor/Mentor.tsx:70 aria-label/title 'Mentor'; :64 '🎬 Highlights'
- src/features/smartband/SmartBandChip.tsx:43,46,58 'Band ...' aria-labels
- src/features/pedalboard/effects.ts:200-230 pedal names (unchanged proposals), :230 'Looper'
- src/features/perfmon/PerfHud.tsx:50 '⏱ Perf', :53 'Performance monitor', :55 '⏱ Performance'
- src/features/appstore/AppStore.tsx:117,145 'coding powers'
- src/features/visualizer/QuestsPanel.tsx:41 '🧩 Quests'
- src/features/songs/MySongs.tsx:107,109,113 'My Songs'
- src/layout/Instrument.tsx:106 'Idea?'
- src/features/kodeapps/motifs/MyMotifs.tsx (title)
- src/features/beats/BeatsPanel.tsx:59 aria-label 'Beat machine'
- src/features/challenges/defs.ts:501 'Boss Level', :503 'Daily Challenge'; ChallengesPanel.tsx:12 'Boss'
- src/features/buildlog/BuildLog.tsx and README/docs feature rows, src/web/Landing.tsx (check for names), the Choreographer and Komma/Komms strings in src/features/games/racer, src/features/kodeapps, src/features/appstore (owned by other agents: grep "Komma\|Komms\|Choreograph")
- Also grep tooltips/aria-labels and README.md, docs/api.md, llms.txt for the same strings.
