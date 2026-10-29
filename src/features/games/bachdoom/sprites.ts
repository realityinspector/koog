// BachDoom sprites: all pixel art is drawn by code (see sp-*.ts). buildSprites() is pure and deterministic.
import type { Sprites } from './types'
import { buildBoss } from './sp-boss'
import { buildGrumble, buildImp, buildSqueak } from './sp-demons'
import { buildBfg, buildNotes, buildOrbs, buildSmoke } from './sp-fx'
import { buildBust, buildCandles, buildColumn, buildStand } from './sp-props'

export function buildSprites(): Sprites {
  return {
    demons: { imp: buildImp(), grumble: buildGrumble(), squeak: buildSqueak() },
    boss: buildBoss(),
    note: buildNotes(),
    orb: buildOrbs(),
    bfg: buildBfg(),
    smoke: buildSmoke(),
    props: { column: buildColumn(), candles: buildCandles(), bust: buildBust(), stand: buildStand() },
  }
}
