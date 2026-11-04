// Old emulator / sound ids still work. Pure data (no audio), so the link parser can use it. Never print the old ids.
export const EMU_ALIASES: Record<string, string> = {
  theremin: 'airhands', ondes: 'ribbon', hammond: 'wheelhouse', mellotron: 'tapechoir', moog: 'ladder',
  arp: 'patchbay', tb303: 'squelch', prophet: 'five', juno: 'shimmer', dx: 'bellfm',
}
export const canonEmuId = (id: string): string => EMU_ALIASES[id] ?? id
/** old saved "Change instruments" sound ids */
export const SOUND_ALIASES: Record<string, string> = { moog: 'ladder', bass303: 'squelchbass' }
export const canonSoundId = (id: string): string => SOUND_ALIASES[id] ?? id
