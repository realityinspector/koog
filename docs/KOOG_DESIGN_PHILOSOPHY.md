# The Koog design philosophy

How Koog (a kids' piano and synth app) was designed and built, written so that someone building a *different* app, for example a reading app, a math app or a language app, can reuse the thinking. Each section gives the principle, how Koog applies it, and how it would carry over to a reading app.

Koog in one line: a child plays, the app listens, names what they did ("Cadence!", "Motif!"), and turns free play into real skill through games, scaffolded practice and honest feedback.

---

## 1. The child is the co-designer

**Principle.** Build *with* the kid, not *for* an imagined kid. Their requests are the roadmap, and they should see their ideas become real.

**In Koog.**
- An in-app request bar lets the kid type ideas ("make the backgrounds sparkly", "a guy who can dance"). Each request gets a status (new, building, done) and a reply the kid can read.
- A kid-facing **build log** explains every shipped change in middle-school language and teaches the real concept behind it ("Musicians call snapping notes to the grid quantising").
- When a request can't be done as asked (a copyrighted pop song), say why kindly and offer the closest thing that *can* be done.

**For a reading app.** "I want stories about dragons" goes in the request bar. The build log explains "We added a dragon story. Fun fact: authors plan a story's shape before writing, and here's the shape of this one."

## 2. Name what they did

**Principle.** The magic moment is when the app *recognizes* real skill in what the child just did and names it with the expert's word.

**In Koog.**
- Koog listens to every note. It labels real musical ideas the moment they happen: a cadence, a motif, a scale, a chord change. It also recognizes famous patterns and styles.
- Labels are short, instant, and use the real vocabulary.

**For a reading app.** "You just read a compound word!" "That sentence had a simile." "You figured out that word from context; that's what strong readers do."

## 3. Honest feedback, never glazing

**Principle.** Praise that is always on is noise. A good mentor criticizes bad habits as well as celebrating good ones, kindly and specifically.

**In Koog.**
- The Mentor praises real wins.
- It also says things like "Lots of keys, no idea. Slow down and pick three notes." when the kid mashes.
- Every critique comes with one concrete next step.

**For a reading app.** "You skipped three words in that line. Try pointing as you read." Not "Great job!" after every page.

## 4. Scaffold, then fade (the ladder)

**Principle.** Memorization and mastery come from a ladder of support that is gradually taken away. Every rung is passable, the next one is a little harder, and the top one is the real skill with no help.

**In Koog.** The phrase ladder, used by Learn and the holiday games:
1. **Hunt & Peck:** the next key glows; take your time.
2. **Follow:** keys glow briefly, then fade.
3. **Echo:** hear it, then play it back.
4. **Memory:** phrase by phrase, no hints. A peek costs a star.
5. **Play full:** the whole piece from memory, at your own pace. A mistake is a "slip" and the piece waits for the right note.
6. **Master:** the whole piece from memory, in time.

Rules that make the ladder work:
- **Clear start:** a one-line goal, a Start button and a count-in. Nothing starts before the kid is ready.
- **Hints are spent, not hidden:** hints are always *available*, but they cost something on the higher rungs.
- **Progress you can see:** "Phrase 3 of 8", stars per rung, % learned per piece, and a scene that fills up as you go (ornaments on a tree, dishes on a table).
- **No dead ends:** every result offers Next, Again and Pick another.
- **Saved progress:** every rung's progress persists.

**For a reading app.**
1. Word-by-word highlighting with audio.
2. Highlighting only, no audio.
3. Echo reading: listen to a sentence, then read it.
4. Read a paragraph on your own, with a "peek" for a word costing a star.
5. Read the whole page aloud.
6. Read it fluently, in time.

## 5. Basics before power

**Principle.** Ship the simple, obvious version first. Power features come later and stay out of the way. When adults say "too much power, not enough basics", believe them.

**In Koog.**
- The loop station was first built with eight tracks and every option. It was rebuilt around **one big button**: tap to record, tap to loop, two taps to stop, hold to clear.
- The Advanced view and Boss (grown-up) mode keep the power.
- Defaults should "just feel right", and new knobs go in Advanced.

**For a reading app.** One big "Read to me / I'll read" button. Font, speed and dictionary settings live behind "More".

## 6. One instrument, not a website

**Principle.** The app should feel like a single object you play, not a web page you scroll.

**In Koog.**
- **One screen:** a big display, a rail of mode buttons and a keybed. No page scrolling and no clutter.
- **Fit on screen:** every screen is checked at laptop size and phone size, with no overlaps and no clipped text.
- **Keep the controls visible:** the main control surface (the keyboard) never gets covered.

**For a reading app.** The page is the instrument, with a fixed set of big tools around it. The text never gets covered by popups.

## 7. Delight and secrets

**Principle.** Kids explore. Reward curiosity with surprises that also teach.

**In Koog.**
- The Dancer is a stick figure who dances to your music. He has a gallery of easter eggs: play "shave and a haircut" and he gets a foam beard; play a scale and he turns into a fish ("scales!"); play Jingle Bells and he becomes Santa.
- Found eggs are collected in a gallery. Unfound eggs show a gentle hint.
- He can be named, and he remembers his name per player.

**For a reading app.** Read a tongue twister fast and the narrator's hat spins. Find all the rhyming words on a page to unlock a poem. A pet character reacts to what you read.

## 8. Any input is the instrument

**Principle.** Meet the child where they are. Every device they have should work, and every device should feel equally first-class.

**In Koog.**
- **Every device feeds one stream:** a USB keyboard, computer keys, on-screen keys, a DJ controller, drum pads and a USB foot pedal all work. They feed one shared input stream, so every game works with every device.
- **The pedal works everywhere:** it can start a level, run the looper, play the kick drum or sustain notes.
- **One-person setup:** "Set up a USB foot pedal" learns any key in one press.

**For a reading app.** Touch, mouse, keyboard, voice (read aloud) and a switch device for accessibility all drive the same actions.

## 9. Response first, everything else after

**Principle.** The child's action must produce its result *instantly*. Bookkeeping can wait a few milliseconds; the feeling can't.

**In Koog.**
- **Sound first:** a key press makes sound *before* any scoring, visuals or saving.
- **Precise timing:** timers run in a background worker so a busy screen can't delay them, and notes are scheduled ahead on the audio clock. Loops stay within a few milliseconds.
- **Real people's timing:** research on human timing says people tap slightly early, and a foot presses earlier than a hand, so the looper compensates.
- **Measure it:** latency is measured, with before-and-after numbers, and tracked per screen so every part of the app feels equally fast.

**For a reading app.** Word highlighting tracks the voice with no lag. Page turns are instant. Speech-recognition feedback arrives within a beat, or shows a "listening…" state.

## 10. Safety is designed in, not added on

**Principle.** Protect the child's body and attention by default.

**In Koog.**
- **Volume:** a low default, a hard cap and a limiter on every sound. A panic button silences everything.
- **Boost mode for quiet laptops:** it asks twice, never survives a reload, and switches itself off after an hour.
- **Photosensitivity:** visual effects never flash more than 3 times per second, there are no full-screen flashes, and reduced-motion settings are respected.
- **Speaker volume:** the pre-flight check warns if the computer's volume is high.

**For a reading app.**
- Comfortable default text size and contrast.
- No autoplaying video.
- Gentle break reminders.
- No dark patterns: no streak guilt, no "you'll lose your progress!".

## 11. Privacy by design

**Principle.** A kids' app should collect nothing it doesn't need. Here that means nothing at all.

**In Koog.**
- **No accounts, ads, analytics or tracking.** Progress lives only in the child's own browser.
- **Profiles keep siblings apart and nothing more.** A kid picks a code word so siblings don't overwrite each other's badges. It isn't a password and isn't described as security.
- **The server is stateless.** The small API server helps an AI assistant suggest activities and logs nothing about kids.
- **Diagnostics stay local.** Performance tracking never leaves the device, and the UI says so.
- **The public code is scrubbed.** No real names, emails or family details in the repo, checked by an automated scan before every push.
- **Personal data stays out of git.** Notes about the family (kids' requests, progress backups) are kept locally and never committed.

**For a reading app.** Reading history and voice recordings stay on the device. Nothing is uploaded.

## 12. Respect other people's work

**Principle.** Only use what you're allowed to, and make your own things your own.

**In Koog.**
- **Songs:** only music that is public domain in the US (published in 1930 or earlier, or traditional). Kids who ask for current pop songs get tools to make their own instead.
- **Artist styles:** Mimic answers "in the style of" a famous musician by imitating their *habits*, never their recordings.
- **No brand names in the product.** The instruments are Koog's own designs ("Koog Ladder", "Koog Squelch") inspired by *families* of instruments, not copies of products. The history timeline uses years and generic descriptions.
- **Licenses:** other tools' licenses are checked before borrowing ideas. A similar notation can be written independently; copyleft code is never copied.

**For a reading app.** Public-domain books, plus original stories. Rights checked for every text and illustration. No characters borrowed from franchises.

## 13. Everything is reachable and documented

**Principle.** A feature nobody can find doesn't exist. A feature nobody can explain will be misused.

**In Koog.**
- **Easy to reach:** every feature has a button in the app, a deep link (for example `#/songs/ode/learn?rung=2`), a tooltip, and a stop on the self-playing guided tour.
- **A "museum mode":** Art Gallery mode is a calm, looping, full-screen show of the app for TVs and classrooms.
- **Docs for people:** a README feature table.
- **Docs for AI assistants:** an `llms.txt` and an API, so an AI helping a parent only uses real links.
- **Regular audits:** each audit lists every element, how it's reached, and whether it's documented.

**For a reading app.** Every book, chapter and exercise has a link a teacher can share. A guided tour shows every feature in five minutes.

## 14. Test the real result, not the picture

**Principle.** "It renders" is not "it works". Test the way the child uses it, and check the outcome.

**In Koog.**
- **A real browser, faking only the hands:** tests drive the app in a headless browser with fake key presses and fake MIDI devices.
- **Check the outcome:** the loop actually contains the notes and plays them back on the beat; the song actually finishes; the badge is still there after a reload; the volume never exceeds the cap.
- **Look at every screenshot critically,** at laptop and phone sizes.
- **Pure logic gets fast tests.** These cover timing rules, the pattern parser and easter-egg recognition, with a positive case in two keys and a near-miss for each.
- **Be honest about what wasn't tested:** "tested with simulated MIDI, not the real controller", "Harvest Feast was only played through level 3".

**For a reading app.** Feed recorded audio of a child reading into the speech checker and assert which words it marked. Check that a finished book shows as finished after a restart.

## 15. Never disrupt the player

**Principle.** The app is used *while* it's being built and improved. Updates must never interrupt a child mid-play.

**In Koog.**
- **Live updates:** changes appear without a page reload (hot module replacement), with long-lived state kept outside the components.
- **Every save compiles.** Half-written files are never saved.
- **The kid's session is untouchable:** builders never send input to the child's tab. They test in a separate, muted, throwaway browser profile.
- **Ship from a clean copy:** deploys build from a clean checkout of a commit, so unfinished work is never shipped.

**For a reading app.** Content and fixes update between pages, never mid-sentence. A child's place in a book is never lost to an update.

## 16. Hosting that can't run away

**Principle.** A free kids' app must be cheap, safe from abuse, and boring to operate.

**In Koog.**
- **Small and idle when unused:** one small machine that stops when idle, with no database and no secrets.
- **Rate limits:** per-visitor and global request limits, tiny request-size caps, short timeouts, JSON-only APIs, and capped batches.
- **Security headers** on every page.

**For a reading app.** Static books served from a CDN, a stateless API for teachers, and the same rate limits and headers.

## 17. How the work gets done (for teams of AI agents)

Koog was built live by a lead agent coordinating many parallel agents. What made that work:
- **Strict folder ownership.** Each agent owns specific folders. Shared files get tiny, additive edits, re-read right before editing.
- **A shared brief.** One short file of hard rules every agent reads first: safety, privacy, copyright, testing, reporting.
- **The lead commits.** Agents never commit, push, deploy or run git commands that change the working tree. The lead reviews reports and screenshots, runs every check, scans for personal info, then ships.
- **Reports, not essays.** Each report covers what was built, how a kid reaches it, test numbers, files touched, caveats, and one kid-facing build-log line.
- **Research before building, when it matters.** For example, how hardware loop pedals handle timing and what studies say about human timing. The research is written down, then applied, then measured.
- **Clean up after yourself.** Close every test browser, stop every test server, and leave no orphaned processes on the owner's machine.

## 18. Translating this to a reading app: a checklist

- [ ] The child can request features and read replies. A build log explains changes and teaches a real concept.
- [ ] The app names real reading skills the moment the child shows them.
- [ ] Feedback is honest and specific, with a next step. No empty praise.
- [ ] A visible ladder runs from full support to independent fluent reading, with hints that cost something higher up.
- [ ] The simple mode comes first; power is hidden behind "More".
- [ ] One calm screen, the text never covered, checked at tablet and phone sizes.
- [ ] Secrets and easter eggs reward curiosity, collected in a gallery.
- [ ] Every input works: touch, keyboard, voice, switch access.
- [ ] Feedback is instant (highlighting, page turns); bookkeeping comes after.
- [ ] Safety defaults: text size and contrast, no autoplay, break reminders, no guilt mechanics.
- [ ] No accounts, no tracking, data stays on the device, and the public code is scrubbed of personal info.
- [ ] Only public-domain or owned texts and art. Original characters. No brands.
- [ ] Every feature is reachable by a button and a link, documented, and on the guided tour.
- [ ] Tests check outcomes (words marked, books finished, progress saved) and say honestly what wasn't tested.
- [ ] Updates never interrupt a reading session.
- [ ] Hosting is cheap, stateless and rate-limited.
