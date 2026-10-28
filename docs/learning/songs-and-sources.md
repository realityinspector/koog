# Songs and sources for Koog

Researched 2026-10-27. Not legal advice. "Verified" = I fetched the page; "unverified" = from memory or secondary sources, check before relying.

Target: a young child, 37-key (3 octave, 36 semitones, e.g. C3-C6) keyboard. Prefer melodies spanning one octave or less, in C/G/F major.

## Quick recommendation

1. Start with the PD nursery/folk table below. Tunes are free; write or sequence them yourself in the app (no MIDI needed for 8-bar melodies).
2. For ready-made files use Mutopia (per-piece licence, mostly PD) or OpenScore (CC0). Four verified Mutopia MIDIs are in `midi/`.
3. Play-along audio: Musopen / Wikimedia Commons / FMA, filtered to CC0 or PD.
4. For pop songs: buy licensed sheet music or use a licensed app, or arrange by ear for private use (see section d).

## (a) Open sheet music

| Source | URL | Licence | Format | Kid fit |
|---|---|---|---|---|
| Mutopia Project | https://www.mutopiaproject.org | Per piece: Public Domain, CC BY, CC BY-SA (verified, https://www.mutopiaproject.org/legal.html). Check each piece's page. | PDF, LilyPond source, MIDI (generated from LilyPond) | Good for Bach/Beethoven/folk; search is by title, many nursery songs absent |
| IMSLP / Petrucci | https://imslp.org | Scans mostly PD. Caveat: PD is judged under Canadian life+50/70 rules, so some composers (d. 1955-1975) are PD in Canada but possibly still protected in the US/EU. Editions and new typesetting can carry their own copyright (often CC). | PDF scans, some MIDI/MusicXML | Huge, but dense scores; look for "Album for the Young" (Schumann, Tchaikovsky), Burgmuller, Gurlitt, Anna Magdalena notebook (unverified details) |
| MuseScore.com (community) | https://musescore.com | Per upload; many CC0 / CC BY / CC BY-SA but also copyrighted arrangements of pop songs, which are unlicensed. Filter by licence; do not assume. | MuseScore, MusicXML, MIDI (download limits/login) | Good, but lots of pop infringing uploads |
| OpenScore | https://musescore.com/openscore, https://github.com/OpenScore | Scores CC0 (secondary sources: MuseScore forum https://musescore.org/en/node/315935 and the Lieder/String Quartet corpus papers; I did not read the GitHub licence file) | MusicXML, MuseScore, MIDI | Lieder (voice+piano) and string quartets; little beginner piano. Low kid value, high licence clarity |
| Wikimedia Commons | https://commons.wikimedia.org (Category: Sheet music / MIDI files) | Per file, PD/CC shown on file page | PDF, PNG, MIDI, Ogg | Handful of nursery songs and simple scores |

## (b) MIDI with clear licences

| Source | URL | Licence | Notes | Recommend? |
|---|---|---|---|---|
| Mutopia MIDI | https://www.mutopiaproject.org | Same as piece (verified PD for the 4 downloaded) | Robotic, quantised, no velocity. Often multi-track; mute accompaniment. | Yes |
| OpenScore corpora | https://github.com/OpenScore | CC0 | MIDI export from MuseScore; not beginner repertoire | Yes, if repertoire fits |
| piano-midi.de | https://www.piano-midi.de | Commons marks Bernd Krueger's files CC BY-SA 3.0 DE (secondary: https://commons.wikimedia.org/wiki/User:Berndkru); I could not open the site's own copyright page (TLS error), so unverified. Note: sequenced performances, expressive, mostly advanced repertoire | Attribution + share-alike would apply | Maybe, verify first; mostly too hard |
| Kunst der Fuge | https://www.kunstderfuge.com | Announced CC licensing in 2008 (https://creativecommons.org/2008/03/07/kunstderfuge/); I did not verify which CC variant or whether it still applies; parts are paywalled | Large classical MIDI collection | Verify first |
| Lakh MIDI Dataset | https://colinraffel.com/projects/lmd/ | Dataset labelled CC BY 4.0 (verified), but the author did not transcribe the files and copyright metadata is inconsistent: the licence covers the compilation at best, not the underlying songs, most of which are copyrighted pop | Research dataset, 170k files | No for shipping content. Fine for private experiments; do not redistribute |
| BitMidi, FreeMidi, MidiWorld, etc. | bitmidi.com, freemidi.org | User-uploaded with no licence; mostly sequences of copyrighted songs. Sites usually disclaim responsibility (unverified for each) | Convenient and unlicensed | No. Do not bundle or recommend |

Practical point: even for PD tunes, a *specific MIDI sequence* can carry its own copyright (the sequencer's performance/arrangement). A MIDI you made yourself from a PD melody is cleanest.

## (c) Play-along / backing audio (CC / PD)

| Source | URL | Licence | Notes |
|---|---|---|---|
| Musopen | https://musopen.org | Recordings offered as PD / CC0 / CC BY (check per item) | Classical recordings; good for listening and playing along with simple pieces |
| Wikimedia Commons | https://commons.wikimedia.org | Per file | Includes piano-midi.de renderings and PD recordings |
| Free Music Archive | https://freemusicarchive.org | Per track: CC BY, BY-SA, BY-NC, CC0 etc. Filter by licence; NC blocks commercial use, ND blocks arranging | Mostly original music, not nursery tunes |
| ccMixter | https://ccmixter.org | Per track, CC BY / BY-NC / similar; has a-cappella/instrument stems and "pells" | Good for backing tracks to jam over; check licence each |
| Sound recordings in the US | LoC: https://blogs.loc.gov/copyright/2025/12/lifecycle-of-copyright-1930-works-in-the-public-domain/ | US recordings from 1925 and earlier are PD as of 2026 (verified via search results); the underlying composition and the recording are separate rights | Old recordings are usually poor for kids |

## (d) Popular songs: the copyright reality

- A song has several separate rights: the composition (melody+lyrics), the sound recording, any sheet-music arrangement, and any MIDI file. Most pop songs' compositions are in copyright for life+70 years (or 95 years from publication for older US works).
- Nearly all pop MIDI and sheet music on free sites (including many MuseScore uploads and BitMidi-type sites) is unlicensed. Using them privately is a grey area; redistributing or bundling them in your app is infringement. This guide does not recommend them.
- Legal options:
  1. PD classics and nursery rhymes (table below).
  2. US public domain by date: works published in 1930 or earlier are PD in the US as of Jan 1, 2026 (verified: https://blogs.loc.gov/copyright/2025/12/lifecycle-of-copyright-1930-works-in-the-public-domain/ and https://authorsguild.org/news/works-by-faulkner-christie-and-hammett-enter-the-public-domain-in-2026/). Search results cite "I Got Rhythm" and "Georgia on My Mind" among 1930 songs. Next: 1931 works enter on Jan 1, 2027. US-only: many countries use life+70, so a US-PD song may be protected elsewhere. Also check the *specific* published version (later arrangements stay protected).
  3. Licensed services: Musicnotes (https://www.musicnotes.com, per-song purchase, licensed arrangements, personal use), Flowkey, Simply Piano (subscription; licensed catalogues; you cannot export their content into your own app), Hooktheory (https://www.hooktheory.com, licensed song theory/TheoryTab database for study). Terms differ; their content cannot be bundled into Koog.
  4. Parent transcribes or arranges by ear for personal/family use. A short private arrangement is the lowest risk, but it is still a derivative work of a copyrighted song: do not publish, share, or ship it with the app. Writing the melody yourself does not grant you rights to it. Do not copy lyrics.
- Happy Birthday: Warner/Chappell claimed the copyright for decades. In Sept 2015 a US federal judge (George H. King) ruled that the 1935 copyright covered only a specific piano arrangement, not the melody or lyrics, and in 2016 the company settled for $14M with the song declared public domain; the melody comes from the 1893 "Good Morning to All" (Hill sisters). Sources: https://www.rollingstone.com/music/news/warner-music-settles-happy-birthday-lawsuit-for-14-million-20160209 and https://www.irishnews.com/news/worldnews/2016/06/28/news/happy-birthday-song-ruled-public-domain-by-us-judge-582612/. Status is therefore free to use in the US (court settlement; elsewhere melody/lyrics are long PD). Safe to include.

## Starter table: ~25 PD songs for a 37-key keyboard

Ranges are the typical melody (middle C = C4). "Link" means a verified direct file/page; otherwise search the named site by title, nothing is claimed beyond that. Composers/origins are public-domain traditional or died long before 1930. Keys are the usual beginner key; any transposes freely. Tunes marked * are best built by hand in the app rather than fetched.

| # | Song | Key | Range | Source |
|---|---|---|---|---|
| 1 | Twinkle, Twinkle, Little Star (melody: "Ah vous dirai-je, Maman") | C | C4-A4 | Mutopia KV265 (guitar duo, too wide): https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236. Or build by hand* |
| 2 | Mary Had a Little Lamb | C | E4-G4 | Build by hand* (Commons search) |
| 3 | Hot Cross Buns | C | E4-G4 | Build by hand* |
| 4 | Ode to Joy (Beethoven) | C/D | E4-D5 | Verified MIDI in `midi/`; https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528 |
| 5 | Jingle Bells (Pierpont, 1857) | C | E4-A4 plus up to C5 | Build by hand*; IMSLP/Commons search |
| 6 | Brahms' Lullaby | C | C4-C5 | Verified MIDI in `midi/`; https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=481 |
| 7 | Au clair de la lune | C | C4-D4..E4 | Verified MIDI in `midi/` (guitar, E3-E5): https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1111 |
| 8 | Bach Minuet in G (BWV Anh. 114) | G | D4-B5 (2 voices) | Verified MIDI in `midi/`: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=258 |
| 9 | Frere Jacques / Are You Sleeping | C | C4-A4 | Build by hand* |
| 10 | London Bridge | C | D4-G4 | Build by hand* |
| 11 | Row, Row, Row Your Boat (Ordway lyric 1852) | C | C4-G4 | Build by hand* |
| 12 | Old MacDonald Had a Farm | C | C4-A4 | Build by hand* |
| 13 | Lightly Row | C | E4-G4 | Build by hand* |
| 14 | Oh! Susanna (Foster, 1848) | C | C4-A4 | Build by hand* |
| 15 | Camptown Races (Foster, 1850) | C | C4-A4 | Build by hand* |
| 16 | When the Saints Go Marching In | C | C4-A4 | Traditional; earliest recordings 1920s, melody generally treated as PD. Build by hand* |
| 17 | She'll Be Coming 'Round the Mountain | C | C4-G4 | Build by hand* |
| 18 | Amazing Grace | C/G | C4-E5 | Melody PD (1835). Mutopia's bagpipe version is CC BY-SA, so build by hand* or find a PD hymnal |
| 19 | Silent Night (Gruber, 1818) | C | C4-A4 | Build by hand* |
| 20 | Greensleeves | A minor | E4-G5 | Traditional; hand-built, needs a bit more range |
| 21 | Aura Lee (1861) | C | C4-G4 | Build by hand* |
| 22 | Skip to My Lou | C | C4-G4 | Build by hand* |
| 23 | Itsy Bitsy Spider | C | C4-A4 | Build by hand* |
| 24 | Happy Birthday to You | C | C4-C5 (octave) | PD by 2015-16 ruling/settlement (see above). Build by hand* |
| 25 | Für Elise opening (Beethoven) | A minor | A3-C5 | Mutopia: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931 (check licence on page; full piece too hard, use theme) |

Note: I confirmed Mutopia hosts files for 1, 4, 6, 7, 8, 25 but not the simple nursery songs. For the rest, melodies are well known and PD; there is no need for an outside file for 8-bar melodies. Do not copy lyrics from modern songbooks (some versions of lyrics for older songs carry later copyright).

## Files in `midi/`

See `midi/LICENSES.md`: four Mutopia Public Domain MIDIs.
