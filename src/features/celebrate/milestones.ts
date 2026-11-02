// "Firsts" that get a centre toast, once per kid (saved with pload/psave under 'milestones').
// Uses the celebrate system only (no coach captions), so nothing is said twice by this file.
// Started from Tour.tsx (kid mode only); the subscriptions are rebuilt cleanly on every edit.
import { onNote } from '../../music/notes'
import { onJudge } from '../../music/judge'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onProfileChange, isGuest, pload, psave } from '../../profile/profile'
import { celebrate } from './celebrate'

type Id = 'note' | 'streak10' | 'chord' | 'cadence' | 'boom'
const KEY = 'milestones'
const has = (id: Id) => !!pload<Record<string, boolean>>(KEY, {})[id]
function fire(id: Id, title: string, emoji: string, delay = 0) {
  if (isGuest() || has(id)) return
  const m = pload<Record<string, boolean>>(KEY, {})
  m[id] = true
  psave(KEY, m)
  if (delay) setTimeout(() => celebrate({ title, emoji, kind: 'best' }), delay)
  else celebrate({ title, emoji, kind: 'best' })
}

/** "Cmaj" style names read badly out loud: "First chord: C major!" */
export function chordWords(name: string): string {
  return name.replace(/^([A-G][#b]?)(maj|M)$/, '$1 major').replace(/^([A-G][#b]?)(m|min)$/, '$1 minor').replace(/^([A-G][#b]?)$/, '$1 major')
}

export function startMilestones(): () => void {
  const offs: (() => void)[] = []
  offs.push(onNote((e) => {
    if (!e.on) return
    // brand-new players get their first-note moment from the Tour; kids who already did the tour just get it recorded
    if (pload<boolean>('tour', false) && !has('note')) { const m = pload<Record<string, boolean>>(KEY, {}); m.note = true; psave(KEY, m) }
  }))
  offs.push(useHarmonyStore.subscribe((s, prev) => {
    if (s.streak >= 10 && prev.streak < 10) fire('streak10', '10 in a row!', '🔥')
    if (s.chord && s.chord !== prev.chord && s.heldNotes.length >= 3) fire('chord', `First chord: ${chordWords(s.chord)}!`, '🎹')
  }))
  offs.push(onJudge((e) => {
    if (e.type === 'cadence') fire('cadence', 'First cadence! You ended the musical sentence.', '🏁')
    else if (e.type === 'cluster' && e.boom) fire('boom', 'First BOOM!', '⚡')
  }))
  offs.push(onProfileChange(() => { /* state is read per kid on each event, nothing cached */ }))
  return () => offs.forEach((f) => f())
}

/** The first-note moment, called by the Tour's interactive beat. */
export function firstNoteDone(): boolean {
  if (has('note')) return false
  const m = pload<Record<string, boolean>>(KEY, {}); m.note = true; psave(KEY, m)
  return true
}

if (import.meta.hot) import.meta.hot.accept()
