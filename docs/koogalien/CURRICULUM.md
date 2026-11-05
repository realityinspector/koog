# Koogalien curriculum: the kid's path into Koogalien

Chords, words and letters here follow LANGUAGE.md (authoritative; the data lives in `src/koogalien/data/`). Each unit is about 15 to 25 minutes over a few sessions. **The Koog Alien** (the mascot) hosts every lesson: waves, listens, cheers, looks puzzled when a word doesn't match. Three Koogaliens speak the language in different voices (each has its own synth patch): **Pip** (round, bubbly, bright) for units 1 to 3, **Dro** (slow, deep, wobbly) for units 4 to 6, **Zee** (quick, glassy) for units 7 to 9. A unit unlocks when the previous one is "known" (Master on its checkpoint), but the Dictionary is always open.

Every unit uses the phrase ladder (Hunt & Peck, Follow, Echo, Memory, Play full, Master) on its words, spaced repetition (Leitner boxes: next session, 1, 3, 7, 14 days) for review, and stars. Mastery means Master rung on the unit checkpoint sentence with at least 80% of words matched at confidence 0.85 or better, plus the unit's review cards out of box 1.

v1 ships units 1 to 3 fully playable, the Dictionary, and one learning game. Units 4 to 9 are specified here and unlock as later builds land; the data module and ladder already support them.

## Unit 1: Eight notes
- Goal: the whole language is built from 8 notes (do re mi fa sol la si do', pads 1 to 8). A lone note is a number; a chord is a word.
- Activities: the Koog Alien lights a pad and says its number (Hunt & Peck with the keybed guide); "Which number did Pip play?" (hear, then press); count 1 to 8 up and down; "Play my number" (age, house number); the Dictionary pad grid.
- Mastery: hear 8 random single notes and press the matching key, 7 of 8 right, then echo a 3-number run at your own pace.
- Concept: sequence.

## Unit 2: First words
- Goal: a word is a short chord (2 to 4 keys pressed together), not letters. The first dozen: hello, world, say, I, you, yes, no, Koog, friend, happy, love, music.
- Activities: Word of the Day cards, each with its "why it sounds right" story (do+sol is the agreeable yes; fa+si, the tritone, is the tense no); Match-Up (hear a word, tap the picture); Echo (the Koog Alien and Pip say a word, you play it back); the explorer shows the closest word and its confidence for any chord you play.
- Mastery: 8 words known (Echo on each), then a rapid round: hear 10 words, play 8 right.
- Concept: event (a shape triggers a meaning).

## Unit 3: Hello world
- Goal: write, see and hear the first sentence. The headline moment.
- Activities: the Koog Alien and Pip teach hello (do+la) and world (do+sol+do'); the kid plays them with a rest between; the ribbon shows notes, `say hello world.` and "hello world" aligned; "Hear it back" plays it; the kid edits the code (`say "hello friend"`) and hears the change; Pip cheers when the English reads back right.
- Mastery: from a blank screen, play hello world in time (Master rung); type the code for it; match three code snippets to their sounds.
- Concepts: sequence (a program of words), code vs music.

## Unit 4: Sentences
- Goal: join 3 to 5 words with word gaps, and know how a sentence ends.
- Activities: Build-a-Sentence (play word tiles in order: "I love music"); Fix-It (one word in a played sentence is wrong; find and fix it, which marks debug); Dro's Slow Sentence (a pedal press is the word break, a double press ends the sentence).
- Mastery: play a 4-word sentence after hearing it once (Memory), and write one of your own.
- Concepts: sequence, debug.

## Unit 5: Questions and feelings
- Goal: the ending changes the meaning. The closer chord sets the mood: statement, question, shout. feeling words (happy, sad, mad, sleepy) are chords with character.
- Activities: Same Words, Different Ending (end with 5+8 for a statement, 2+5 hanging in the air for a question, 1+3+5+8 loud for a shout); Mood Mirror (Dro shows a feeling, the kid answers with a feeling word); first modulation taste: hold the mod wheel or the on-screen wobble slider and the word becomes excited.
- Mastery: hear 6 short sentences and label statement, question or exclamation (5 of 6), then write one question and one feeling sentence.
- Concepts: condition, parameter.

## Unit 6: Spell any word
- Goal: for any word, play the chord `spell` (1+2), then each letter as two notes: a row (1 to 7: ABCD, EFGH, IJKL, MNOP, QRST, UVWX, YZ) and a column (1 to 4). End with 5+8 (or lone 8 to undo a letter).
- Activities: the ABC-song chunk game (find the row, then the column); Spell Bee (words Dro says, 3 to 7 letters, growing); Mystery Word (letters play one by one, guess the word); Teach Pip a New Word (spell it, Pip says it back plainly); names and places.
- Mastery: spell 5 words of 4 or more letters, 4 of 5 right with no hints, using backspace at least once correctly.
- Concepts: function (spell mode is a reusable mode), loop.

## Unit 7: Messages to a friend
- Goal: write a message and "send" it, with nothing networked.
- Activities: Message Maker (2 to 6 words, pick a Koogalien voice); Send makes a share link the kid can copy to a friend (who opens it in Koog and hears and reads it) and keeps a copy in the Outbox; Open Mail plays messages from a link or the Inbox, and the Koogalien explains unknown words; Zee replies from a small local table; a plain note says only the sentence is in the link and nothing is uploaded.
- Mastery: write and send a message, open one a grown-up made, read it, answer it with a new message.
- Concepts: event, variable.

## Unit 8: Koogalien + code
- Goal: variables and functions with words.
- Activities: `let hi = "hello friend"` then `say hi`; joining sentences with a comma; naming a saved motif (Kore) and using it as a word; Code Hunt (fix 5 broken one-line programs); change one variable and hear the whole message change. Functions (`to greet(name): ...`) arrive after v1 (variables ship first).
- Mastery: write a three-line program that sets two variables and says a sentence using them; predict what it will say, then hear it (the guess matches).
- Concepts: variable, function, debug.

## Unit 9 (advanced Koogalien): Shaping the sound
- Goal: the sound itself carries meaning. LFO (wobble), filter, glide, tremolo, envelope and timbre change what a word means. v1 has one meaning (wobble = excited); the rest are v2.
- Activities: Mood Lab (set a knob or slider, hear the word change); Say It Like Dro (a Koogalien voice swap); mod-wheel dictation.
- Mastery: say one sentence in two moods and the Koogalien picks which is which.
- Concept: parameter.

## Cross-cutting
- Dictionary / Explorer: always open. Search by English, by notes (play to look up), or by Koogalien. Shows notes, code and English together, with a Hear It button.
- Accessibility: every game works with keys, pads or on-screen buttons; every sentence has screen-reader text; never color alone.
- Grown-ups: a parent page lists words known and sentences written. All on-device.
