// What the Mentor says. Kid lines are specific, warm and middle-school (never babyish, never shaming);
// "tech" lines are the Boss-mode audience: same facts, musician's words.
// Critiques are kind and actionable ("try X"), never "you were wrong".
export type MoveKind =
  | 'quote' | 'motif' | 'sequence' | 'inversion' | 'retrograde' | 'call-response' | 'repetition' | 'variation' | 'rhythm-motif'
  | 'cadence-authentic' | 'cadence-half' | 'cadence-deceptive' | 'cadence' | 'progression' | 'modulation'
  | 'crescendo' | 'decrescendo' | 'range' | 'space' | 'tension' | 'cluster' | 'arpeggio' | 'walking-bass' | 'callback' | 'flow' | 'steady'
  | 'c-nohome' | 'c-rushing' | 'c-wobbly' | 'c-wandering' | 'c-stuck'
type D = Record<string, string | number>
export interface Desc { label: string; kid: string[]; tech: string; score: number; critique?: boolean; mood: 'applaud' | 'gasp' | 'nod' | 'lean' | 'think' }

const s = (d: D, k: string) => String(d[k] ?? '')
export function describe(kind: MoveKind, d: D): Desc {
  switch (kind) {
    case 'quote': {
      const learned = d.learned === 1, where = d.key ? ` in ${s(d, 'key')}` : ''
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
    case 'repetition': return { label: '🔁 repetition', score: 4, mood: 'nod', kid: ['Repeating an idea on purpose makes it feel like a real tune.', 'Saying it twice makes it stick. Nice.'], tech: 'Literal repetition.' }
    case 'variation': return { label: '✨ variation', score: 6, mood: 'applaud', kid: ['You repeated it with a twist. That\'s a variation, the secret of good tunes.', 'Same idea, new spin. That\'s how pros keep repeats interesting.'], tech: 'Varied repetition.' }
    case 'rhythm-motif': return { label: '🥁 rhythm motif', score: 6, mood: 'nod', kid: ['You reused that rhythm with different notes. A rhythm motif is a groove.', 'Same rhythm, new notes. Nice groove thinking.'], tech: 'Rhythmic motif reused with new pitches.' }
    case 'cadence-authentic': return { label: '🏁 authentic cadence', score: 6, mood: 'nod', kid: [`Strong ending: that stepped onto ${s(d, 'home')}, the home note. That's an authentic cadence.`, 'That ending felt finished, like a period on a sentence.'], tech: `Authentic cadence (V–I) in ${s(d, 'key')}.` }
    case 'cadence-half': return { label: '❓ half cadence', score: 5, mood: 'lean', kid: ['You stopped on the 5th note, so it feels like a question mark. That\'s a half cadence.', 'Leaving it hanging on purpose? Smart, we\'re all waiting for the answer.'], tech: `Half cadence (ends on V of ${s(d, 'key')}).` }
    case 'cadence-deceptive': return { label: '😮 deceptive cadence', score: 8, mood: 'gasp', kid: ['Ooh, I expected the home note and you swerved! That\'s a deceptive cadence.', 'Plot twist ending. Deceptive cadences are great for surprises.'], tech: `Deceptive cadence (V–vi) in ${s(d, 'key')}.` }
    case 'cadence': return { label: '🏁 home', score: 4, mood: 'nod', kid: [`You landed on ${s(d, 'home')}, the home note. Satisfying.`, 'That phrase came home. Feels finished.'], tech: 'Phrase closes on the tonic.' }
    case 'progression': return { label: `🎹 ${s(d, 'name')}`, score: 8, mood: 'applaud',
      kid: [d.pop ? 'That\'s the pop progression (I–V–vi–IV). Thousands of hit songs use it.' : `Nice chord moves: ${s(d, 'name')}. That\'s a classic.`, `${s(d, 'name')}, played like you meant it.`], tech: `Progression ${s(d, 'name')} (roman numerals relative to the first chord).` }
    case 'modulation': return { label: `🔑 key change → ${s(d, 'to')}`, score: 9, mood: 'gasp',
      kid: [`Key change! You slid from ${s(d, 'from')} to ${s(d, 'to')}. That's a modulation.`, `Whoa, new key: ${s(d, 'to')}. That lifts the whole mood.`], tech: `Modulation ${s(d, 'from')} to ${s(d, 'to')}.` }
    case 'crescendo': return { label: '📈 crescendo', score: 6, mood: 'lean', kid: ['You\'re getting louder and louder. That\'s a crescendo, and it builds suspense.', 'Great build. Playing louder over time is a crescendo.'], tech: 'Crescendo.' }
    case 'decrescendo': return { label: '📉 diminuendo', score: 5, mood: 'lean', kid: ['Softer and softer. That fade is a diminuendo.', 'Nice, you pulled the volume down on purpose.'], tech: 'Diminuendo.' }
    case 'range': return { label: '↔ whole keyboard', score: 5, mood: 'lean', kid: ['You\'re using the whole keyboard, low rumbles to high sparkles. Nice range.', 'High and low both in one jam. That\'s register exploration.'], tech: 'Wide register exploration.' }
    case 'space': return { label: '🤫 space', score: 6, mood: 'nod', kid: ['You left space. Pros do that. Silence is part of the music.', 'Those rests gave the notes room to breathe.'], tech: 'Effective use of rests/phrasing.' }
    case 'tension': return { label: '✨ tension → release', score: 5, mood: 'applaud', kid: ['That spicy note into a safe one? Tension and release, the engine of every good song.', 'Ooh, that crunchy note resolved beautifully.'], tech: 'Tension/release: non-diatonic note resolved by step.' }
    case 'cluster': return d.boom ? { label: '⚡ BOOM cluster', score: 6, mood: 'gasp', kid: ['Forearm cluster! Henry Cowell did this on piano in 1917.', 'Big cluster, big energy.'], tech: 'Tone cluster.' }
      : { label: '💥 tone cluster', score: 4, mood: 'gasp', kid: ['Forearm cluster! That\'s a real technique, Henry Cowell used it back in 1917.', 'A whole-arm crash. Bold.'], tech: 'Tone cluster.' }
    case 'arpeggio': return { label: '🌈 arpeggio', score: 5, mood: 'nod', kid: [`That ${s(d, 'chord')} spelled out one note at a time is an arpeggio. Smooth.`, 'Broken chord, nicely flowing. That\'s an arpeggio.'], tech: `Arpeggio (${s(d, 'chord')}).` }
    case 'walking-bass': return { label: '🚶 walking bass', score: 7, mood: 'nod', kid: ['Steady low notes moving along: that\'s a walking bass, the heartbeat of jazz.', 'That bass line is walking. Love the groove.'], tech: 'Walking bass line.' }
    case 'callback': return { label: '🪃 callback', score: 8, mood: 'applaud', kid: [`You brought back an idea from earlier (${s(d, 'ago')}). That ties the whole jam together.`, 'Callback! The first idea returned, which makes a jam feel planned.'], tech: `Thematic return of material from ${s(d, 'ago')}.` }
    case 'flow': return { label: '🌊 flow', score: 2, mood: 'nod', kid: ['That was a long, flowing line. Nice stamina.', 'You kept that going the whole way. Smooth.'], tech: 'Extended phrase.' }
    case 'steady': return { label: '⏱ steady', score: 2, mood: 'nod', kid: ['Your timing is really steady right now.', 'Nice, that beat is locked in.'], tech: 'Stable pulse.' }
    case 'c-nohome': return { label: '', score: 4, critique: true, mood: 'think', kid: [`Try ending that phrase on ${s(d, 'home')}, the home note. It works like a period at the end of a sentence.`], tech: `Phrase ended off the tonic; try resolving to ${s(d, 'home')}.` }
    case 'c-rushing': return { label: '', score: 4, critique: true, mood: 'think', kid: ['Your rhythm rushed a bit. Breathe on the rests and let it settle.', 'That sped up as it went. Try tapping your foot to hold the tempo.'], tech: 'Tempo drift (accelerando) within phrase.' }
    case 'c-wobbly': return { label: '', score: 4, critique: true, mood: 'think', kid: ['The timing wobbled a little. Try counting 1-2-3-4 quietly and land notes on the numbers.'], tech: 'Inconsistent inter-onset intervals.' }
    case 'c-wandering': return { label: '', score: 4, critique: true, mood: 'think', kid: [`Lots of spicy notes there. Spice is great, just finish on a note that fits ${s(d, 'key')} so it resolves.`], tech: 'High out-of-key ratio; resolve to a chord tone.' }
    case 'c-stuck': return { label: '', score: 4, critique: true, mood: 'think', kid: ['That stayed on just a couple of notes. Try a jump or two; a bigger leap makes a melody sparkle.'], tech: 'Limited pitch variety; add leaps.' }
  }
}
