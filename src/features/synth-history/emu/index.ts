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

export const EMULATORS: EmuSpec[] = [theremin, ondes, hammond, mellotron, moog, arp, tb303, prophet, juno, dx]
export const getEmu = (id: string) => EMULATORS.find((e) => e.id === id)
