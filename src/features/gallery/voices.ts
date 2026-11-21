// The synth each gallery picture plays. Pure data: the tour, Art Gallery and the holiday shows share it.
// Successive pictures move through synth types, and the same type comes back with a different setting.
// 'classic' is the everyday Koog patch. Other Koog entries are preset ids. Emulator entries are preset names.

export interface GalleryVoice {
  sound: string
  preset: string
}

export const GALLERY_VOICES: GalleryVoice[] = [
  { sound: 'koog', preset: 'classic' },
  { sound: 'organ', preset: 'Smoky lounge' },
  { sound: 'ladder', preset: 'Space-age lead' },
  { sound: 'ladder', preset: 'Squelchy zap' },
  { sound: 'epiano', preset: 'Glassy e-piano' },
  { sound: 'bell', preset: 'Tubular bell' },
  { sound: 'strings', preset: 'Dreamy strings' },
  { sound: 'choir', preset: 'Old choir' },
  { sound: 'pad', preset: 'Lush pad' },
  { sound: 'brass', preset: 'Brass stab' },
  { sound: 'koog', preset: 'space-pad' },
  { sound: 'organ', preset: 'Cathedral full' },
  { sound: 'organ', preset: 'Soft flutes' },
  { sound: 'strings', preset: 'Koog moonlit strings' },
  { sound: 'ladder', preset: 'Fat bass' },
  { sound: 'ladder', preset: 'Koog sunset lead' },
  { sound: 'bell', preset: 'Koog glass bell' },
  { sound: 'pad', preset: 'Koog moon shimmer' },
  { sound: 'brass', preset: 'Warm pad' },
  { sound: 'koog', preset: 'wobble' },
  { sound: 'choir', preset: 'Breathy flute' },
  { sound: 'epiano', preset: 'Brass / bass' },
  { sound: 'koog', preset: 'bells' },
  { sound: 'brass', preset: 'Koog glass pad' },
  { sound: 'pad', preset: 'Pluck bass' },
  { sound: 'koog', preset: 'laser' },
]

export function galleryVoice(i: number): GalleryVoice {
  const n = GALLERY_VOICES.length
  const k = ((Math.floor(i) % n) + n) % n
  return GALLERY_VOICES[k]
}

/** Index among play pictures that still need a voice (a picture that already names a sound keeps it). */
export function pictureOrdinal(items: { id: string; screen?: string; mode?: string; sound?: string }[], id: string): number {
  let n = 0
  for (const it of items) {
    if (it.screen !== 'play' || it.mode === 'boss' || it.sound) continue
    if (it.id === id) return n
    n++
  }
  return -1
}
