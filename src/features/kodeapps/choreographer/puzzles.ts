// The 12 Choreographer puzzles. Each goal REQUIRES its idea: a hard block limit (loops), a rule that must exist (events,
// conditions), or a move the kid must teach himself (functions). Every puzzle ships a reference solution that
// scripts/choreo-fixtures.ts proves passes at par.
import type { Goal, Node, Routine } from './engine'

export type Concept = 'sequence' | 'loop' | 'event' | 'condition' | 'function' | 'parameter' | 'debug'
export interface Puzzle {
  id: string; n: number; title: string; emoji: string; concept: Concept
  story: string
  /** ids of the puzzle functions handed to the kid */
  fns: string[]
  goal: Goal
  par: number
  drums: string
  hints: string[]
  /** a reference answer */
  solution: Routine
  /** show the target dance first, silently (the "copy this dance" levels) */
  demo?: boolean
  /** needs the kid to teach a move */
  teach?: boolean
  /** light the keys of the motifs he needs */
  glow?: boolean
}
const call = (fn: string, a?: 's' | 'l'): Node => (a ? { k: 'call', fn, a } : { k: 'call', fn })
const rep = (n: number, ...body: Node[]): Node => ({ k: 'repeat', n, body })
const R = (nodes: Node[], rules: Routine['rules'] = []): Routine => ({ v: 1, name: 'Solution', bpm: 100, nodes, rules })
const IFHI = (): Node => ({ k: 'if', c: 'high', then: [call('wl')], else: [call('wr')] })

export const PUZZLES: Puzzle[] = [
  { id: 'p1', n: 1, title: 'One after another', emoji: '🪜', concept: 'sequence', demo: true, glow: true,
    story: 'Watch the dance, then copy it. A routine is a list of moves, done in order.',
    fns: ['jump', 'spin'], goal: { seq: ['jump', 'spin'] }, par: 2, drums: 'K.S.',
    hints: ['Tap Hop, then Twirl. Or play their tunes on the keys: the lit keys show you.', 'Order matters: first a jump, then a spin.'],
    solution: R([call('jump'), call('spin')]) },
  { id: 'p2', n: 2, title: 'Four jumps, two blocks', emoji: '🔁', concept: 'loop', glow: true,
    story: 'Make him jump 4 times, using only 2 blocks. Adding the same block again and again is slow: a repeat does it for you.',
    fns: ['jump'], goal: { seq: ['jump', 'jump', 'jump', 'jump'], requires: ['repeat'], maxBlocks: 2 }, par: 2, drums: 'K.S.',
    hints: ['Add one Hop, then tap ×4 (or tap the pedal) to wrap it in a repeat.', 'A repeat holds a block inside it and runs it again and again. 🔁 4 × Hop is just 2 blocks.'],
    solution: R([rep(4, call('jump'))]) },
  { id: 'p3', n: 3, title: 'Jump on the kick', emoji: '⚡', concept: 'event',
    story: 'Make him jump every time the kick drum hits. An event rule waits for something to happen, then reacts.',
    fns: ['jump'], goal: { reacts: [{ ev: 'kick', move: 'jump' }], requires: ['when'] }, par: 2, drums: 'K.S.',
    hints: ['Tap ⚡ When, pick "the kick drum hits", then choose the rule\'s box and tap Hop.', 'The rule is: when kick → Hop. Press Perform and watch each kick.'],
    solution: R([], [{ ev: 'kick', body: [call('jump')] }]) },
  { id: 'p4', n: 4, title: 'Copy this dance', emoji: '👀', concept: 'loop', demo: true, glow: true,
    story: 'Watch, then rebuild it. Two jumps and a spin, twice. Can you spot the part that repeats?',
    fns: ['jump', 'spin'], goal: { seq: ['jump', 'jump', 'spin', 'jump', 'jump', 'spin'] }, par: 4, drums: 'K.S.',
    hints: ['jump, jump, spin happens twice in a row.', 'Build jump, jump, spin once, then wrap it in a repeat ×2. Par is 4 blocks.'],
    solution: R([rep(2, call('jump'), call('jump'), call('spin'))]) },
  { id: 'p5', n: 5, title: 'Clap loop, snare spin', emoji: '🥁', concept: 'event',
    story: 'Clap 4 times, and spin every time the snare hits. A loop and an event together, in 4 blocks.',
    fns: ['clap', 'spin'], goal: { seq: ['clap', 'clap', 'clap', 'clap'], reacts: [{ ev: 'snare', move: 'spin' }], requires: ['repeat', 'when'], maxBlocks: 4 }, par: 4, drums: 'K.S.',
    hints: ['Four claps need a repeat. The snare needs a rule.', '🔁 4 × Clap, plus ⚡ when snare → Twirl. That is 4 blocks.'],
    solution: R([rep(4, call('clap'))], [{ ev: 'snare', body: [call('spin')] }]) },
  { id: 'p6', n: 6, title: 'Left or right?', emoji: '🔀', concept: 'condition',
    story: 'After a high note he should wave left. After a low note he should wave right. An if / else chooses between two things.',
    fns: ['ding', 'dong', 'wl', 'wr'], goal: { seq: ['sway', 'waveL', 'sway', 'waveR'], requires: ['if'] }, par: 8, drums: 'K.S.',
    hints: ['Add Ding (high), then an if: "the note is high" then Wave L, else Wave R. Then Dong (low) and another if.', 'The if looks at the last note that played. Tap an if\'s then or else box, then a move, to fill it.'],
    solution: R([call('ding'), IFHI(), call('dong'), IFHI()]) },
  { id: 'p7', n: 7, title: 'Teach him "Zoom"', emoji: '🎓', concept: 'function', teach: true,
    story: 'Teach him your own move: play a short tune, then say it means Moonwalk. Then make him moonwalk 3 times with only 2 blocks.',
    fns: [], goal: { seq: ['moonwalk', 'moonwalk', 'moonwalk'], requires: ['fn', 'repeat'], maxBlocks: 2 }, par: 2, drums: 'K.S.',
    hints: ['Tap 🎓 Teach him a move, play 3 notes, then choose Moonwalk.', 'Your new move shows up in the list. Add it once and wrap it in ×3.'],
    solution: R([rep(3, call('u1'))]) },
  { id: 'p8', n: 8, title: 'Loud means spin', emoji: '📢', concept: 'event',
    story: 'Soft tap, BOOM, soft tap, BOOM. Make him spin whenever a loud note plays, and build the pattern with a repeat.',
    fns: ['tap', 'boom', 'spin'], goal: { seq: ['sway', 'sway', 'sway', 'sway'], reacts: [{ ev: 'loud', move: 'spin' }], requires: ['repeat', 'when'], maxBlocks: 5 }, par: 5, drums: 'K.S.',
    hints: ['Soft tap then BOOM, twice: that is a repeat holding 2 blocks.', '⚡ when "a loud note plays" then Twirl. Only BOOM is loud.'],
    solution: R([rep(2, call('tap'), call('boom'))], [{ ev: 'loud', body: [call('spin')] }]) },
  { id: 'p9', n: 9, title: 'A loop with two moves', emoji: '🧅', concept: 'loop',
    story: 'Spin and jump three times, then bow. Use just 4 blocks. Put the repeat around BOTH moves.',
    fns: ['spin', 'jump', 'bow'], goal: { seq: ['spin', 'jump', 'spin', 'jump', 'spin', 'jump', 'bow'], requires: ['repeat'], maxBlocks: 4 }, par: 4, drums: 'K.S.',
    hints: ['A repeat can hold more than one block. Tap its box to choose where new blocks go.', '🔁 3 × (Twirl, Hop), then Bow. That is 4 blocks.'],
    solution: R([rep(3, call('spin'), call('jump')), call('bow')]) },
  { id: 'p10', n: 10, title: 'Big and small', emoji: '📏', concept: 'parameter',
    story: 'Same move, different size. A parameter changes how a function runs. Jump small, jump BIG, twice, in 3 blocks.',
    fns: ['jump'], goal: { seq: ['jump:s', 'jump:l', 'jump:s', 'jump:l'], requires: ['repeat', 'param'], maxBlocks: 3 }, par: 3, drums: 'K.S.',
    hints: ['Tap the size tag on a block to change it (S, M, L). Playing its tune lower or higher does it too.', '🔁 2 × (Hop small, Hop BIG).'],
    solution: R([rep(2, call('jump', 's'), call('jump', 'l'))]) },
  { id: 'p11', n: 11, title: 'Kick and snare', emoji: '🎛️', concept: 'event',
    story: 'Two rules at once: jump on the kick, clap on the snare. Both listen to the same music.',
    fns: ['jump', 'clap'], goal: { reacts: [{ ev: 'kick', move: 'jump' }, { ev: 'snare', move: 'clap' }], requires: ['when'] }, par: 4, drums: 'K.S.',
    hints: ['Add two ⚡ When rules. Set one to the kick and one to the snare.', 'when kick then Hop; when snare then Clap. Four blocks in all.'],
    solution: R([], [{ ev: 'kick', body: [call('jump')] }, { ev: 'snare', body: [call('clap')] }]) },
  { id: 'p12', n: 12, title: 'The big show', emoji: '🏆', concept: 'debug',
    story: 'Put it all together: a repeat, a when rule AND an if / else, in 11 blocks or fewer. Use Step to debug it one move at a time.',
    fns: ['ding', 'dong', 'wl', 'wr', 'jump', 'spin'], goal: { requires: ['repeat', 'when', 'if'], seq: ['sway', 'waveL', 'sway', 'waveR', 'sway', 'waveL', 'sway', 'waveR'], reacts: [{ ev: 'kick', move: 'jump' }], maxBlocks: 14 }, par: 11, drums: 'K.S.',
    hints: ['Build one high/low wave pattern (Ding, if, Dong, if), then wrap it in a repeat ×2.', 'Add ⚡ when kick then Hop. Use ⏭ Step to watch it one move at a time.'],
    solution: R([rep(2, call('ding'), IFHI(), call('dong'), IFHI())], [{ ev: 'kick', body: [call('jump')] }]) },
]
export const puzzleById = (id: string) => PUZZLES.find((p) => p.id === id)
