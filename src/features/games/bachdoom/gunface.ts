// BachDoom HUD art: BACH's status-bar face + the pipe-organ gun. Procedural, deterministic, pure.
import type { Face, Gun } from './types'
import { makeFaces } from './gf-face'
import { makeGun } from './gf-gun'

export function buildFaces(): Face {
  return makeFaces()
}

export function buildGun(): Gun {
  return makeGun()
}
