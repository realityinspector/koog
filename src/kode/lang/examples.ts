// Starter snippets for the Examples menu, simple to clever. PURE.
export interface Example { id: string; title: string; why: string; code: string }

export const EXAMPLES: Example[] = [
  { id: 'hello', title: '1. Hello, notes', why: 'Each word is a step. The steps share one bar, so four notes make four beats.',
    code: 'tempo 100\nnotes "c e g e"\n' },
  { id: 'rests', title: '2. Rests', why: 'A ~ is a rest: a step of silence. Rests make the groove.',
    code: 'tempo 100\nnotes "c ~ e g ~ e ~ c"\n' },
  { id: 'beat', title: '3. A drum beat', why: 'drums uses the pad names: kick, snare, hat, open, clap, lotom, hitom and rim.',
    code: 'tempo 96\ndrums "kick hat snare hat"\n' },
  { id: 'layers', title: '4. Two layers', why: 'Every line is its own layer and they all share the beat. Try changing one line while it plays.',
    code: 'tempo 100\ndrums "kick ~ snare ~"\nnotes "c e g e"\n' },
  { id: 'squeeze', title: '5. Squeeze with [ ]', why: 'Brackets squeeze steps into one: [c e] takes the time of a single step. And c*2 plays it twice.',
    code: 'tempo 100\nnotes "c [e g] c*2 [e g c5]"\ndrums "kick [hat hat] snare [hat hat]"\n' },
  { id: 'alt', title: '6. A new one each bar', why: 'In < > the pattern picks one thing per bar: bar 1 plays c, bar 2 plays a, bar 3 plays f and so on.',
    code: 'tempo 90\nsound "ladder"\nnotes "<c a f g> e g e"\nsound "piano"\ndrums "kick hat snare hat*2"\n' },
  { id: 'chord', title: '7. Chords and sounds', why: 'Commas inside [ ] play together. sound picks the instrument for the layers below it, loud sets the volume.',
    code: 'tempo 84\nsound "tapechoir"\nloud 0.6\nnotes "<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>"\nsound "bell"\nloud 0.8\nnotes "e5 ~ g5 [a5 g5] ~ e5 d5 ~"\n' },
  { id: 'groove', title: '8. A little song', why: 'Bass, drums and a melody that changes every bar. Notes with a number (c4, a3) pick the octave; plain c is c4.',
    code: '# a tiny band\ntempo 108\nsound "squelch"\nloud 0.7\nnotes "<c2 c2 f2 g2> ~ c3 ~ <c2 c2 f2 g2> ~ [c3 c3] ~"\nsound "piano"\ndrums "kick [hat hat] snare hat kick [kick hat] snare [hat open]"\nsound "bell"\nnotes "<[e5 g5] [d5 f5]> ~ c5*2 ~ <g4 a4> ~ ~ ~"\n' },
  { id: 'play', title: '9. Play a motif', why: 'play runs a motif you saved in 🧩 My Motifs, like calling a function (Round comes built in). +7 moves it up seven notes, x2 plays it twice as fast.',
    code: 'tempo 96\nplay round\nplay round +7 x2\ndrums "kick ~ snare ~"\n' },
]
