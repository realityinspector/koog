// Registry of playable emulators, in timeline order.
import { theremin } from './theremin'
import { ondes } from './ondes'
import { hammond } from './hammond'
import { mellotron } from './mellotron'
import { moog } from './moog'
import { arp } from './arp'
import { prophet } from './prophet'
import { tb303 } from './tb303'
import { juno } from './juno'
import { dx } from './dx'
import type { EmuSpec } from './types'
import { canonEmuId } from './aliases'

export const EMULATORS: EmuSpec[] = [theremin, ondes, hammond, mellotron, moog, arp, tb303, prophet, juno, dx]
export { canonEmuId, EMU_ALIASES } from './aliases'
export const getEmu = (id: string) => { const c = canonEmuId(id); return EMULATORS.find((e) => e.id === c) }
