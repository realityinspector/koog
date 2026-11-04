import type { KodeConcept, KodeInput } from '../../kode/kore'

export interface ConceptInfo { id: KodeConcept; icon: string; name: string; kid: string; hint: string }
/** Kid-facing words for every coding concept the Kore can record. */
export const CONCEPTS: ConceptInfo[] = [
  { id: 'sequence', icon: '🪜', name: 'Sequences', kid: 'Steps happen one after another, in order.', hint: 'Play a few notes in a row on purpose.' },
  { id: 'loop', icon: '🔁', name: 'Loops', kid: 'Repeat something so you do not have to do it again.', hint: 'Make a pattern repeat.' },
  { id: 'function', icon: '🧩', name: 'Functions', kid: 'Give a tune a name, then use it any time.', hint: 'Save a motif and call it.' },
  { id: 'parameter', icon: '🎚️', name: 'Parameters', kid: 'Change how a function works: higher, faster, louder.', hint: 'Call a saved motif with a change.' },
  { id: 'event', icon: '⚡', name: 'Events', kid: 'When one thing happens, another thing happens.', hint: 'Make a key or stomp trigger something.' },
  { id: 'condition', icon: '🔀', name: 'If / else', kid: 'Choose what to do depending on what happens.', hint: 'Make the music react to a choice.' },
  { id: 'parallel', icon: '🥁', name: 'Parallel', kid: 'Do two things at the same time, like drums and melody.', hint: 'Run two lines together.' },
  { id: 'random', icon: '🎲', name: 'Random', kid: 'Let chance pick, so it is a little different each time.', hint: 'Use a dice roll in your music.' },
  { id: 'recursion', icon: '🪆', name: 'Recursion', kid: 'A pattern made of a smaller copy of itself.', hint: 'Build a tune inside a tune.' },
  { id: 'debug', icon: '🐞', name: 'Debugging', kid: 'Find what went wrong and fix it.', hint: 'Fix a wrong note or step.' },
  { id: 'variable', icon: '📦', name: 'Variables', kid: 'A box with a name that holds a value you can change.', hint: 'Store a note or number and reuse it.' },
]
export const conceptInfo = (id: string): ConceptInfo => CONCEPTS.find((c) => c.id === id) ?? { id: id as KodeConcept, icon: '⭐', name: id, kid: '', hint: '' }

export const INPUTS: Record<KodeInput, { icon: string; name: string }> = {
  keys: { icon: '🎹', name: 'Keys' }, drums: { icon: '🥁', name: 'Drum pads' }, dj: { icon: '🎧', name: 'DJ controller' }, pedal: { icon: '🦶', name: 'Pedal' }, screen: { icon: '👆', name: 'Touch screen' },
}
