// The one place the visible name lives. Change it here and the screens, the Store card and the tooltips follow.
export const KOOGALIEN_NAME = 'Koogalien'
export const KOOGALIEN_TAGLINE = 'Learn Koogalien, the alien language: play notes, read words.'
/** the three speaking voices, as colored badges: a color AND a letter shape, never color alone */
export const VOICE_LOOK: Record<string, { color: string; mark: string }> = {
  pip: { color: '#E69F00', mark: 'P' },
  dro: { color: '#56B4E9', mark: 'D' },
  zee: { color: '#009E73', mark: 'Z' },
}
