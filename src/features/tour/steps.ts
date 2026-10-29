export interface TourStep {
  /** CSS selector of the real element to highlight */
  sel: string
  /** optional: pick the first match whose text includes this */
  text?: string
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  { sel: '.kg-display', title: 'The display', body: 'This is your screen. Every note you play paints it. In-key notes glow gold; notes outside the key go 🌶️ spicy.' },
  { sel: '.sr', title: 'Smart readouts', body: 'Koog listens. It figures out your key and chords live. Tap 🤖 BAND and it plays along with you.' },
  { sel: '.viz-bar button', text: 'Patch', title: 'Patch', body: 'Build your own synth sound, and watch the visuals change shape with it. Try 🧩 Quests.' },
  { sel: '.kg-rail', title: 'Modes', body: 'Songs with karaoke, challenges, beats, synth history, and the build log.' },
  { sel: '.kg-idea', title: 'Ideas', body: 'Want a feature? Type it here. The AI builds it, sometimes while you watch.' },
]
