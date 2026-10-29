// BachDoom wall / floor / ceiling textures: procedural, deterministic, seamless 64 x 64.
import type { Textures } from './types'
import { brick, pipes, glass, wood, velvet, marble } from './tex-walls'
import { flag, checker, carpet, planks, vault, beams, gold } from './tex-surfaces'

export function buildTextures(): Textures {
  return {
    walls: { brick: brick().px, pipes: pipes().px, glass: glass().px, wood: wood().px, velvet: velvet().px, marble: marble().px },
    floors: { flag: flag().px, checker: checker().px, carpet: carpet().px, planks: planks().px },
    ceils: { vault: vault().px, beams: beams().px, gold: gold().px },
  }
}
