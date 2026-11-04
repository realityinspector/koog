// One rename map for every user-facing feature name. Values are the CURRENT names.
// To apply the Koogalien rebrand (see docs/BRAND_KOOGALIEN.md) change values here, then swap hardcoded strings
// in components to NAMES.* references. Navigation words (PLAY, SONGS, CHALLENGE, GAMES, BEATS, SYNTH, LOG,
// Settings, Back, Start) are deliberately NOT here: they stay plain (Rule 1).
// Not wired into components yet.

export const NAMES = {
  // helpers and characters
  mentor: 'Mentor',
  band: 'Band',
  smartBand: 'Smart Band',
  mimic: 'Mimic',
  vibesFace: 'Vibes face',
  vibes: 'Vibes',
  dancer: 'Dancer',
  duo: 'DJ + Piano',
  mascot: 'Koog Alien', // owner-decided; the host character (art in src/brand/mascot/)
  // play surfaces and tools
  looper: 'Looper',
  loopStation: 'Loop station',
  drumPads: 'Drum pads',
  gamePads: 'Game pads',
  beatMachine: 'Beat machine',
  pedalboard: 'Pedalboard',
  pianoPedals: 'Piano pedals',
  boost: 'Boost',
  metronome: 'Metronome',
  perfHud: 'Perf',
  perfMonitor: 'Performance monitor',
  // learn and play-through
  challenges: 'Challenges',
  dailyChallenge: 'Daily Challenge',
  bossLevel: 'Boss Level',
  learnIt: 'Learn it',
  mySongs: 'My Songs',
  myMotifs: 'My Motifs',
  codingPowers: 'coding powers',
  quests: 'Quests',
  patch: 'Patch',
  patchDrawer: 'Patch drawer',
  // games
  phraseMatch: 'Phrase Match',
  lightTheTree: 'Light the Tree',
  harvestFeast: 'Harvest Feast',
  bachDoom: 'BachDoom',
  zombieLanes: 'Zombie Lanes',
  jiuJitsuFlow: 'Jiu-Jitsu Flow',
  runwayRemix: 'Runway Remix',
  racer: 'Koogalien Racer', // owner-decided (was Komma Racer)
  // places and meta
  gallery: 'Gallery',
  artGallery: 'Art Gallery',
  tour: 'Guided tour',
  buildLog: 'Build log',
  ideaBar: 'Idea?',
  bossMode: 'Boss mode',
  studio: 'Studio',
  scenes: 'Scenes',
  timeline: 'Timeline',
  instruments: 'Instruments',
  synthHistory: 'Synth History',
  // Koog world (already branded)
  koog: 'Koog',
  koding: 'Koding',
  kodingKore: 'Koding Kore',
  koogKode: 'Koog Kode',
  koogalien: 'Koogalien', // the language AND the module that teaches it (Komma/Komms are dropped)
  koogaliens: 'Koogaliens', // the aliens who speak it
  koreographer: 'Koreographer', // owner-decided (was Choreographer)
  appStore: 'Koog App Store',
} as const

export type NameKey = keyof typeof NAMES
export const name = (k: NameKey): string => NAMES[k]
