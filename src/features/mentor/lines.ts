// What the Mentor says. Kid lines are specific, warm and middle-school (never babyish, never shaming);
// "tech" lines are the Boss-mode audience: same facts, musician's words.
// Honest, not a hype machine: praise names the specific thing that was good; critiques name what's wrong and how to
// fix it ("That was mashing, not music yet. Pick three notes and make a pattern."). Direct and kind, never shaming,
// never sugar-coated into "great job!". Tech critiques are blunt and musicianly.
export type MoveKind =
  | 'quote' | 'motif' | 'sequence' | 'inversion' | 'retrograde' | 'call-response' | 'repetition' | 'variation' | 'rhythm-motif'
  | 'cadence-authentic' | 'cadence-half' | 'cadence-deceptive' | 'cadence' | 'progression' | 'modulation'
  | 'crescendo' | 'decrescendo' | 'range' | 'space' | 'tension' | 'cluster' | 'arpeggio' | 'walking-bass' | 'callback' | 'flow' | 'steady'
  | 'c-nohome' | 'c-rushing' | 'c-wobbly' | 'c-wandering' | 'c-stuck'
  | 'c-mashing' | 'c-banging' | 'c-hammered' | 'c-nospace' | 'c-abrupt' | 'c-wrongnote'
  | 'style-bach' | 'style-satie' | 'style-beethoven' | 'style-mozart' | 'style-chopin' | 'style-debussy' | 'style-joplin'
type D = Record<string, string | number>
export interface Desc { label: string; kid: string[]; tech: string; score: number; critique?: boolean; mood: 'applaud' | 'gasp' | 'nod' | 'lean' | 'think' }

const s = (d: D, k: string) => String(d[k] ?? '')
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
export function describe(kind: MoveKind, d: D): Desc {
  switch (kind) {
    case 'quote': {
      const learned = d.learned === 1, where = d.key ? ` in ${s(d, 'key')}` : ''
      // a known piece with composer info: name the composer, the piece, the year and one fact
      if (!learned && d.piece) {
        const who = s(d, 'who'), yr = s(d, 'year'), fact = s(d, 'fact'), piece = s(d, 'piece')
        const moved = d.key ? ` (and you moved it to ${s(d, 'key')})` : ''
        return {
          label: `🎵 ${who || 'trad.'}: ${s(d, 'title')}`, score: 11, mood: 'gasp',
          kid: who
            ? [`That's ${who}! ${cap(piece)}, ${yr}${moved}. ${fact}`, `I know that one: ${who}, ${piece}, ${yr}${moved}. ${fact}`]
            : [`That's ${piece}, ${s(d, 'trad') || 'a traditional folk tune'} from ${yr}${moved}. Nobody knows who wrote it first. ${fact}`, `${cap(piece)}! It's ${s(d, 'trad') || 'a traditional folk tune'}, from ${yr}${moved}. ${fact}`],
          tech: `Quotation: ${s(d, 'title')} (${who || 'traditional'}, ${yr})${d.key ? `, transposed to ${s(d, 'key')}` : ''}, ${s(d, 'n')} notes${d.miss ? ', 1 note off' : ''}.`,
        }
      }
      return {
        label: `🎵 quote: ${s(d, 'title')}${where}`, score: learned ? 11 : 10, mood: 'gasp',
        kid: learned
          ? (d.key
            ? [`You quoted your ${s(d, 'title')} phrase in a new key (${s(d, 'key')}). That's called a quotation!`, `That's your ${s(d, 'title')} phrase, moved to ${s(d, 'key')}. Quoting what you've learned is a real composer trick.`]
            : [`That's the ${s(d, 'title')} phrase you learned, sneaking into your jam. That's called a quotation!`, `You quoted your ${s(d, 'title')} phrase. Composers do that on purpose.`])
          : (d.key
            ? [`🎵 Was that ${s(d, 'title')}?! In ${s(d, 'key')}, sneaky.`, `Wait, ${s(d, 'title')}${where}? I heard that.`]
            : [`🎵 Was that ${s(d, 'title')}?!`, `I heard ${s(d, 'title')} sneak in there. Nice quote.`]),
        tech: `Quotation: ${s(d, 'title')}${d.key ? `, transposed to ${s(d, 'key')}` : ''} (${s(d, 'n')} notes${d.miss ? ', 1 note off' : ''}).`,
      }
    }
    case 'motif': return { label: '🔁 motif', score: 5, mood: 'nod', kid: ['That little pattern keeps coming back. That\'s a motif, and it\'s how songs stick in your head.', 'Nice, you gave that idea a second turn. Motifs are how tunes get memorable.'], tech: 'Motif restated.' }
    case 'sequence': return { label: `🔁 sequence ${d.dir === 'up' ? '↗' : '↘'}`, score: 7, mood: 'applaud',
      kid: [`That sequence climbing ${s(d, 'dir')} was gorgeous. Same idea, new starting note.`, `You moved that idea ${s(d, 'dir')} a step and kept its shape. That's a sequence.`].map((x) => (d.dir === 'down' ? x.replace('climbing down', 'stepping down') : x)),
      tech: `Melodic sequence, ${s(d, 'dir')} by ${s(d, 'by')} semitones.` }
    case 'inversion': return { label: '↕ inversion', score: 8, mood: 'gasp',
      kid: ['Whoa, you flipped that motif upside down. That\'s called an inversion.', 'Same pattern, mirrored. Bach loved doing exactly that.'], tech: 'Inversion of the previous motif.' }
    case 'retrograde': return { label: '⏪ retrograde', score: 8, mood: 'gasp',
      kid: ['You played that idea backwards! That\'s a retrograde, a real composer trick.', 'Backwards on purpose? That\'s called a retrograde.'], tech: 'Retrograde of the previous figure.' }
    case 'call-response': return { label: '💬 call & response', score: 8, mood: 'applaud',
      kid: ['That felt like a conversation: a question, then an answer that landed home.', 'Call and response! The second phrase answered the first one.'], tech: 'Call and response: antecedent open, consequent closes on the tonic.' }
    case 'repetition': return { label: '🔁 repetition', score: 3, mood: 'nod', kid: ['Repeating an idea on purpose makes it feel like a real tune.', 'Saying it twice makes it stick. Nice.'], tech: 'Literal repetition.' }
    case 'variation': return { label: '✨ variation', score: 6, mood: 'applaud', kid: ['You repeated it with a twist. That\'s a variation, the secret of good tunes.', 'Same idea, new spin. That\'s how pros keep repeats interesting.'], tech: 'Varied repetition.' }
    case 'rhythm-motif': return { label: '🥁 rhythm motif', score: 6, mood: 'nod', kid: ['You reused that rhythm with different notes. A rhythm motif is a groove.', 'Same rhythm, new notes. Nice groove thinking.'], tech: 'Rhythmic motif reused with new pitches.' }
    case 'cadence-authentic': return { label: '🏁 authentic cadence', score: 6, mood: 'nod', kid: [`Strong ending: that stepped onto ${s(d, 'home')}, the home note. That's an authentic cadence.`, 'That ending felt finished, like a period on a sentence.'], tech: `Authentic cadence (V–I) in ${s(d, 'key')}.` }
    case 'cadence-half': return { label: '❓ half cadence', score: 5, mood: 'lean', kid: ['You stopped on the 5th note, so it feels like a question mark. That\'s a half cadence.', 'Leaving it hanging on purpose? Smart, we\'re all waiting for the answer.'], tech: `Half cadence (ends on V of ${s(d, 'key')}).` }
    case 'cadence-deceptive': return { label: '😮 deceptive cadence', score: 8, mood: 'gasp', kid: ['Ooh, I expected the home note and you swerved! That\'s a deceptive cadence.', 'Plot twist ending. Deceptive cadences are great for surprises.'], tech: `Deceptive cadence (V–vi) in ${s(d, 'key')}.` }
    case 'cadence': return { label: '🏁 home', score: 3, mood: 'nod', kid: [`You landed on ${s(d, 'home')}, the home note. Satisfying.`, 'That phrase came home. Feels finished.'], tech: 'Phrase closes on the tonic.' }
    case 'progression': return { label: `🎹 ${s(d, 'name')}`, score: 8, mood: 'applaud',
      kid: [d.pop ? 'That\'s the pop progression (I–V–vi–IV). Thousands of hit songs use it.' : `Nice chord moves: ${s(d, 'name')}. That\'s a classic.`, `${s(d, 'name')}, played like you meant it.`], tech: `Progression ${s(d, 'name')} (roman numerals relative to the first chord).` }
    case 'modulation': return { label: `🔑 key change → ${s(d, 'to')}`, score: 9, mood: 'gasp',
      kid: [`Key change! You slid from ${s(d, 'from')} to ${s(d, 'to')}. That's a modulation.`, `Whoa, new key: ${s(d, 'to')}. That lifts the whole mood.`], tech: `Modulation ${s(d, 'from')} to ${s(d, 'to')}.` }
    case 'crescendo': return { label: '📈 crescendo', score: 6, mood: 'lean', kid: ['You\'re getting louder and louder. That\'s a crescendo, and it builds suspense.', 'Great build. Playing louder over time is a crescendo.'], tech: 'Crescendo.' }
    case 'decrescendo': return { label: '📉 diminuendo', score: 5, mood: 'lean', kid: ['Softer and softer. That fade is a diminuendo.', 'Nice, you pulled the volume down on purpose.'], tech: 'Diminuendo.' }
    case 'range': return { label: '↔ whole keyboard', score: 4, mood: 'lean', kid: ['You\'re using the whole keyboard, low rumbles to high sparkles. Nice range.', 'High and low both in one jam. That\'s register exploration.'], tech: 'Wide register exploration.' }
    case 'space': return { label: '🤫 space', score: 6, mood: 'nod', kid: ['You left space. Pros do that. Silence is part of the music.', 'Those rests gave the notes room to breathe.'], tech: 'Effective use of rests/phrasing.' }
    case 'tension': return { label: '✨ tension → release', score: 5, mood: 'applaud', kid: ['That spicy note into a safe one? Tension and release, the engine of every good song.', 'Ooh, that crunchy note resolved beautifully.'], tech: 'Tension/release: non-diatonic note resolved by step.' }
    case 'cluster': return d.boom ? { label: '⚡ BOOM cluster', score: 6, mood: 'gasp', kid: ['Forearm cluster! Henry Cowell did this on piano in 1917.', 'Big cluster, big energy.'], tech: 'Tone cluster.' }
      : { label: '💥 tone cluster', score: 4, mood: 'gasp', kid: ['Forearm cluster! That\'s a real technique, Henry Cowell used it back in 1917.', 'A whole-arm crash. Bold.'], tech: 'Tone cluster.' }
    case 'arpeggio': return { label: '🌈 arpeggio', score: 5, mood: 'nod', kid: [`That ${s(d, 'chord')} spelled out one note at a time is an arpeggio. Smooth.`, 'Broken chord, nicely flowing. That\'s an arpeggio.'], tech: `Arpeggio (${s(d, 'chord')}).` }
    case 'walking-bass': return { label: '🚶 walking bass', score: 7, mood: 'nod', kid: ['Steady low notes moving along: that\'s a walking bass, the heartbeat of jazz.', 'That bass line is walking. Love the groove.'], tech: 'Walking bass line.' }
    case 'callback': return { label: '🪃 callback', score: 8, mood: 'applaud', kid: [`You brought back an idea from earlier (${s(d, 'ago')}). That ties the whole jam together.`, 'Callback! The first idea returned, which makes a jam feel planned.'], tech: `Thematic return of material from ${s(d, 'ago')}.` }
    case 'flow': return { label: '🌊 flow', score: 2, mood: 'nod', kid: ['That was a long, flowing line. Nice stamina.', 'You kept that going the whole way. Smooth.'], tech: 'Extended phrase.' }
    case 'steady': return { label: '⏱ steady', score: 2, mood: 'nod', kid: ['Your timing is really steady right now.', 'Nice, that beat is locked in.'], tech: 'Stable pulse.' }
    // ---- critiques: name the problem, then the fix ----
    case 'c-nohome': return { label: '', score: 6, critique: true, mood: 'think',
      kid: [`That phrase just stopped, it didn't land anywhere. End on ${s(d, 'home')}, the home note, and it'll sound finished.`, `No landing on that one. Aim the last note at ${s(d, 'home')}; it works like the period at the end of a sentence.`],
      tech: `Phrase ends unresolved (off the tonic and dominant). Resolve to ${s(d, 'home')}.` }
    case 'c-rushing': return { label: '', score: 6, critique: true, mood: 'think',
      kid: ['You sped up as you went. That\'s rushing. Pick a speed, tap your foot, and make the end match the start.', 'That ran away from you, the end was way faster than the beginning. Slow the start down so you can hold it.'],
      tech: 'Rushing: IOIs shrank across the phrase (accelerando). Lock to a pulse.' }
    case 'c-wobbly': return { label: '', score: 6, critique: true, mood: 'think',
      kid: ['The timing was all over the place, no beat to follow yet. Count 1-2-3-4 out loud and put each note on a number.', 'I couldn\'t find the beat in that. Try playing along with a slow, steady count first.'],
      tech: 'Unsteady time: inter-onset intervals don\'t settle into any ratio. Practice with a click.' }
    case 'c-wandering': return { label: '', score: 6, critique: true, mood: 'think',
      kid: [`A lot of those notes clashed with ${s(d, 'key')}. One spicy note is flavor; this many sounds lost. Stick to the key and add spice on purpose.`, `That wandered out of ${s(d, 'key')} and never came back. Use the in-key notes as home base.`],
      tech: `Over a third of the phrase is outside ${s(d, 'key')}, unresolved. Treat chromatics as passing tones.` }
    case 'c-stuck': return { label: '', score: 5, critique: true, mood: 'think',
      kid: ['That stayed on just a couple of notes. Try a jump or two; a bigger leap makes a melody sparkle.', 'Two notes is a doorbell, not a tune yet. Add a third note and a jump.'],
      tech: 'Pitch content of two notes; add range and a leap.' }
    case 'c-mashing': return { label: '', score: 9, critique: true, mood: 'think',
      kid: d.how === 'slam'
        ? ['Slamming over and over is just noise. Save the big crash for one moment that matters.', 'That many crashes in a row stops being exciting. Play something, THEN hit one big slam as the finale.']
        : ['That was mashing, not music yet. Pick three notes and make a pattern.', 'Lots of keys, no idea. Slow down, choose a few notes, and repeat a little pattern on purpose.'],
      tech: d.how === 'slam' ? 'Repeated clusters with no material between: noise, not gesture. One cluster, placed.' : 'Random dense attack: no contour, no repeated figure. Reduce to a 3-note cell and develop it.' }
    case 'c-banging': return { label: '', score: 7, critique: true, mood: 'think',
      kid: ['Every note is full blast. When everything is loud, nothing stands out. Play softer, then save loud for the big moment.', 'You\'re banging the keys. Try playing half as hard; your loud notes will hit harder when there are quiet ones around them.'],
      tech: 'Constant fortissimo, no dynamic contrast. Back off to mf and shape it.' }
    case 'c-hammered': return { label: '', score: 6, critique: true, mood: 'think',
      kid: [`That's ${s(d, 'n')} ${s(d, 'note')}s in a row. A repeated note can be a drumbeat, but this one needs somewhere to go. Step up or down after a few.`, `Same note, ${s(d, 'n')} times. Give it a destination: hit it three times, then move.`],
      tech: `${s(d, 'n')} repetitions of ${s(d, 'note')} with no change. Repeated notes need a target.` }
    case 'c-nospace': return { label: '', score: 6, critique: true, mood: 'think',
      kid: ['That was nonstop, no breaths at all. Music needs gaps. Play a phrase, stop for a beat, then answer it.', 'Wall of notes! Leave some silence; rests are what make the notes mean something.'],
      tech: 'No rests for over 10 s: no phrasing. Break it into 2-bar phrases.' }
    case 'c-abrupt': return { label: '', score: 6, critique: true, mood: 'think',
      kid: ['That stopped mid-sentence: you were still running and just quit. Finish the run on a home note.', 'You cut that one off in the middle. Keep going two more notes and land it.'],
      tech: `Phrase breaks off mid-scale on a non-chord tone. Complete the line to ${s(d, 'home')}.` }
    case 'c-wrongnote': return { label: '', score: 7, critique: true, mood: 'think',
      kid: [`You landed on ${s(d, 'note')}, and it doesn't fit the key. It sounds like a slip. Slide to ${s(d, 'fix')} right next to it.`, `${s(d, 'note')} was the wrong note to stop on here. Try ${s(d, 'fix')} instead, one key over.`],
      tech: `Non-diatonic ${s(d, 'note')} on a structural point, unresolved. Resolve by step to ${s(d, 'fix')}.` }
    // ---- composer signature moves ----
    case 'style-bach': return { label: '🎼 Bach move', score: 9, mood: 'gasp',
      kid: ['That busy pattern moving to new notes sounds like Bach! He spun whole pieces out of one little figure, shifted step by step.', 'Running figure, repeated on new notes: that\'s straight out of Bach\'s playbook (1700s).'],
      tech: 'Baroque figuration: sequential motor rhythm, figure transposed by step (Bach).' }
    case 'style-satie': return { label: '🎼 Satie vibe', score: 9, mood: 'lean',
      kid: ['Slow, spacious, a dreamy 7th. That sounds like Erik Satie, who wrote quiet floating pieces in Paris in the 1880s.', 'All that space and those soft 7ths: very Satie. He liked music that just floats in the room.'],
      tech: 'Sparse texture, slow pulse, 7th sonorities: Satie (Gymnopédies, 1888).' }
    case 'style-beethoven': return { label: '🎼 Beethoven punch', score: 9, mood: 'gasp',
      kid: ['Little motif, hammered home, with a sudden loud punch! That\'s a Beethoven move. He loved shocking people with dynamics.', 'Quiet, quiet, BAM, and the same idea again. Pure Beethoven drama.'],
      tech: 'Motivic insistence with sforzando contrast: Beethoven.' }
    case 'style-mozart': return { label: '🎼 Alberti bass', score: 9, mood: 'applaud',
      kid: ['Low, high, middle, high: that\'s an Alberti bass! Mozart used that pattern all over his piano sonatas.', 'That bouncing broken-chord bass is called Alberti bass. Very Mozart, very 1780s.'],
      tech: 'Alberti bass (1-5-3-5): Classical-era accompaniment, Mozart.' }
    case 'style-chopin': return { label: '🎼 Chopin sweep', score: 9, mood: 'lean',
      kid: ['Wide rolling left hand with a melody on top: that sounds like Chopin! His left hand covered huge stretches of the keyboard.', 'That big sweeping bass under a tune is a Chopin thing. Romantic piano, 1830s style.'],
      tech: 'Wide-spaced LH arpeggiation under a cantabile line: Chopin.' }
    case 'style-debussy': return { label: '🎼 Debussy color', score: 9, mood: 'gasp',
      kid: d.how === 'parallel'
        ? ['Sliding the same chord shape around like that is something Debussy did. He cared about color more than rules.', 'Parallel chords! Debussy broke the old rules that way around 1900.']
        : ['Whoa, that\'s a whole-tone scale, every note a whole step apart. Debussy used it to sound dreamy and blurry.', 'That floaty, no-home sound is the whole-tone scale. Very Debussy.'],
      tech: d.how === 'parallel' ? 'Planing: parallel chords of identical quality (Debussy).' : 'Whole-tone collection: Debussy.' }
    case 'style-joplin': return { label: '🎼 ragtime', score: 9, mood: 'applaud',
      kid: ['Oom-pah bass with the tune pushing off the beat: that\'s ragtime! Scott Joplin made it famous around 1900.', 'Bass, chord, bass, chord, and a syncopated melody on top. Joplin would approve.'],
      tech: 'Stride/oom-pah LH with syncopated RH: ragtime (Joplin).' }
  }
}
