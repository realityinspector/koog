# Koog game design: thesis, antithesis, synthesizer

> **Thesis:** practice. Scales, theory, "keep a steady beat".
> **Antithesis:** a kid with his elbow on the keyboard, making every emoji on screen go off.
> **Synthesis:** a *synthesizer* that turns the second into the first, without either side noticing.
> (Hegel would call this *Aufhebung*: the antithesis is cancelled *and* kept. The elbow stays. It just has to earn its moment.)

## One judge, everywhere

Every note goes through one judge, `src/music/judge.ts`, before any visual or game sees it. So "playing well" means the same thing in the fireworks, in Zombie Lanes and in BachDoom. Kids learn one set of rules, and every screen reinforces it.

The judge's rules are small and readable on purpose. A kid, or a parent, can understand all of them:

| What it hears | Rule | Music skill |
|---|---|---|
| **In key** | Pitch class is in the current key (detected automatically or set by hand) | Harmony: scales and keys |
| **Tension → release** | An out-of-key note followed within 1.5 s by an in-key note 1–2 semitones away | Harmony: dissonance resolves. "Wrong" notes are only wrong if you leave them hanging |
| **Rhythm** | The gap since the last note compared with the gap before it. Simple ratios (same, ½, 2×, ⅓, 3×, ⅔, 3⁄2) score high | Technique: steady pulse, and note lengths that relate to each other |
| **Style: contour** | Steps (1–2 semitones) score best, small leaps are fine, big jumps score lower | Style: singable melodies |
| **Style: motif** | Your last three jumps repeat an earlier three-jump pattern, even starting on a different note. Plain scales don't count | Style/composition: motifs and sequences |
| **Style: cadence** | A phrase of 4+ notes, then a 0.7 s pause, with the home note in the last notes | Style/form: phrases end like sentences |
| **Tone cluster** | 4+ notes started within 90 ms, packed a step apart, or 7+ notes at once | Technique: control. It's also a real 20th-century technique (Henry Cowell, 1917) |

The judge keeps three meters, **KEY**, **BEAT** and **STYLE**, shown together as MUSIC POWER on the display. It also keeps one charge meter, **⚡ BOOM**.

## The elbow economy

The core loop for the kid who makes "beautiful noise":

1. Forearm slams **fizzle**. The fireworks sputter and droop, the confetti cannon jams, and the zombies point and laugh. It's funny, not shaming. A coach caption explains what happened the first few times.
2. Playing in key **charges ⚡ BOOM**: about 16 good notes. Resolving tension and keeping a steady rhythm charge it faster.
3. When BOOM is full, the *same* slam becomes the **best effect in the app**: a giant finale, a room-clearing BFG in BachDoom ("Big Forearm Gesture"), or a full-screen zombie wipe in Zombie Lanes.

The slam is never banned. It becomes the reward for 16 notes of real playing. Kids learn the difference between noise and music by controlling *when* the noise happens. Pros call that dynamics.

## Feedback in the visuals (free play)

| Moment | Fireworks | Other modes and scenes |
|---|---|---|
| Good note | Burst size and brightness scale with the note's score | Same scaling |
| Steady rhythm | Rockets fly straighter and higher, "in formation" | — |
| Out of key, left hanging | Muted, smoky burst | Muted variants |
| Tension → release | Gold "release" bloom | Zombie gets zapped and dances |
| Motif | Echo copies of the pattern | — |
| Cadence | Fountain plus ring at the home note | Zombies bow |
| Slam without charge | Dud rockets: sputter, smoke, fall | Junk-mail spill, jammed cannon, zombies laugh |
| Slam with BOOM | Multi-stage finale | Mailbag explosion, mega cannons, pancaked zombies |

## Games

The games are listed in order of what they teach.

### 🧟 Zombie Lanes: *where every note lives*
Zombies walk down lanes aligned exactly over the real keys. Play the note on a zombie's sign to blast it.

- Levels go from white keys with names, to two octaves, to sharps and flats, to hidden names (find the note by position).
- Chord zombies need a whole triad. The Zombie King needs a melody played in order.
- Training wheels light up the target key on levels 1–2.
- Hits on a steady pulse score double.

### 💀 BachDoom: *play real pieces, in time*
A retro first-person rail shooter. The piece **is** the ammo: the next correct note fires the pipe-organ gun, and each demon is one phrase of the melody. Wrong notes misfire. Cadences heal you. Slams jam the organ unless BOOM is charged, in which case the BFG fires.

| Level | Map | Piece |
|---|---|---|
| E1M1 | The Practice Room | Ode to Joy (Beethoven) |
| E1M2 | The Ballroom | Minuet in G (Petzold, long credited to Bach) |
| E1M3 | The Organ Loft | Toccata in D minor (Bach) |
| E1M4 | Hall of the Mountain King | Grieg |
| **E1M5 BOSS** | The Well-Tempered Cathedral | **Prelude in C, BWV 846** (bars 1–19, in 5 phases) |

The difficulty names are parodies of the classic ones:
- *I'm Too Young to Practice:* demons wait, and any octave counts.
- *Hurt Me Plenty:* demons advance, and you need the exact key.
- *Ultra-Virtuoso:* timing windows, and on-time notes are critical hits.

#### Phrase Waves (Episode 0: Boot Camp, plus one rehearsal before each boss)
A Galaga-style level type (`src/features/games/bachdoom/waves.ts`). A short phrase is **taught** first: a formation of demons hovers at the top, one per note, and each pulses on its beat while `phraseEngine.demo` plays the phrase. Then the formation **dives**: every demon swoops at you and reaches its gold *strike ring* exactly when its note is due. Play the right note inside the timing window to shoot it. The sheet strip shows the phrase and highlights the current note (hidden on the blind rung).

| Wave | Rung | Window | Help |
|---|---|---|---|
| 1 | follow | +-300 ms | the key stays lit, names on the demons |
| 2 | echo | +-240 ms | the key only flashes at the start of each dive |
| 3 | memory | +-200 ms | no key help, sheet music only |
| 4 | timed | +-120 ms | strict |
| bonus | blind | +-120 ms | no sheet music |
| last | hands | +-120 ms | only when Easy/Full chords are on: the left-hand chord tone on beat one is also required |

Windows scale with the difficulty (story x1.6, normal x1, ultra x0.8). Each kid starts at the rung `phraseEngine.mastery` says they have reached, so known rungs are skipped, and every clean pass is recorded through `phraseEngine.attempt` (so it counts in SONGS too).
**A wrong, early, late or missing note** pops specific feedback at the demon ("TOO EARLY <- 80MS", "LATE ->", "WRONG: THAT WAS D, NEEDED E", "MISSED"), jams the organ, shakes the view (not under reduced motion), makes Bach grimace and pulses the red edge (max 3 per second). That demon finishes its dive and bites for **double** a normal bite. The phrase is **broken**: the formation swirls back, an extra demon joins (up to +3) and the phrase restarts. After 2 breaks the key is lit again, as a hint.
**A clean pass** shows PHRASE PERFECT!, pays a chain bonus (+6 HARMONY per chained wave, x2 if every note was on the beat) and shatters the formation into golden notes.

**Why the Prelude in C is the right final boss:** every bar is one chord, broken the same way (notes 1 2 3 4 5 3 4 5, twice). Once a kid sees the pattern, a famous, real, two-minute piece becomes learnable. Beating the boss means you can play the opening of the Well-Tempered Clavier.

**Why not a current pop song as the final boss?** Copyright. Koog only ships music that is public domain in the US (published 1930 or earlier, or traditional), or original songs written for Koog. The Koog Originals, or a pre-1930 hit like *The Entertainer*, can be future boss levels.

## Teaching without lectures

- **Coach captions** (`src/features/harmony/CoachTips.tsx`) name each moment as it happens: *Fizzle! Release! Cadence! Motif! BOOM!* Each kid gets the full one-sentence lesson the first 3 times, then just the label. Captions are rate-limited so they never nag.
- **Readouts** show the inference: KEY, CHORD, MUSIC POWER and STREAK with ⚡ BOOM. Tapping KEY lets the kid override it.
- **The keybed glows** with "play this next" (`src/music/guide.ts`) in games and songs.

## Next ideas

- Grade rhythm against the actual beat when the backing beat or Smart Band is on, not just against the previous gap.
- Use velocity, on keyboards that send it, to reward real dynamics (crescendo into a cadence).
- Two-player Zombie Lanes: one kid plays bass lanes, the other melody lanes.
- Let a kid's own My Songs recording become a BachDoom level.
