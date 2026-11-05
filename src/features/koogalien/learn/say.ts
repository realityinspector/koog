// A Koogalien voice says some chords through the host sound path (the same scheduler "Hear it back" uses).
import { alienById } from '../../../koogalien/data/aliens'
import type { Chord } from '../../../koogalien/data/types'
import type { KoogalienHost } from '../../../koogalien/ports'
import { chordsScore, letterScore } from '../../../koogalien/learn/speak'
import { playScore, type PlayHandle } from '../play/playScore'

export function sayChords(host: KoogalienHost, chords: readonly Chord[], alien: string): PlayHandle {
  const bpm = Math.round(host.sound.bpm()) || 100
  return playScore(chordsScore(chords, alien, bpm), host, { alien: alienById(alien) ? alien : undefined })
}
export function sayLetter(host: KoogalienHost, row: number, col: number, alien: string): PlayHandle {
  return playScore(letterScore(row, col, alien, Math.round(host.sound.bpm()) || 100), host, { alien })
}
