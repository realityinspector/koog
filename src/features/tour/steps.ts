export interface TourStep {
  /** CSS selector of the real element to highlight (first visible match) */
  sel: string
  /** skip this step quietly when nothing visible matches */
  optional?: boolean
  title: string
  body: string
}

/** The short tour that follows the "tap any key" first note. Three real places, nothing else. */
export const TOUR_STEPS: TourStep[] = [
  { sel: '.viz-bar', optional: true, title: 'Pick a scene', body: 'These change what your playing looks like on the display. Fireworks, galaxies, zombies. Tap one and play.' },
  { sel: '[data-tour="modes"]', optional: true, title: '✨ Modes', body: 'Your power-ups live here: DJ, band, looper and more. Open it any time to remix what you play.' },
  { sel: '.kg-rail', title: 'The side rail', body: 'Songs with karaoke, 🎮 GAMES, challenges, beats, and the synth time machine. Tap PLAY to come back here.' },
]
