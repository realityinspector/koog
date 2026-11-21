// window.__koogState(): a snapshot of the shared state, for the Boss / developer to look at in the console. DEV builds only, no kid UI.
// What it answers: who owns the key glow / the sheet / the clock, which docks are open, how many things listen to each feed (a count that
// grows after edits is a leak), which per-player modules reload on a profile switch. See docs/STATE.md.
import { dockSnapshot } from './docks'
import { ownerSnapshot } from '../music/owners'
import { useGuide, guideOwner } from '../music/guide'
import { useScore, useSheet } from '../music/scoreStore'
import { clockHolders, clockListenerCounts, getBpm, isRunning } from '../music/masterClock'
import { useScreen } from './screenStore'
import { profileListenerInfo, useProfile } from '../profile/profile'
import { panicTargets } from '../music/panic'
import { noteListenerCount } from '../music/notes'
import { judgeListenerCount } from '../music/judge'
import { sayListenerCount } from '../coach/coachBus'
import { tokenListenerCount } from '../kode/tokens'
import { routerListenerCounts } from '../midi/router'
import { useLoop } from '../features/loopstation/loopEngine'
import { useDrums } from '../features/drumpads/drumEngine'
import { useKode } from '../features/kode/kodeEngine'
import { usePedal } from '../features/pedal/pedal'
import { useAudioSettings } from '../music/audioSettings'
import { useDevices } from '../music/devices'

export function koogState() {
  const p = useProfile.getState(), sc = useScreen.getState(), g = useGuide.getState(), score = useScore.getState(), lp = useLoop.getState()
  return {
    profile: { active: p.active, mode: p.mode, listeners: profileListenerInfo() },
    screen: { screen: sc.screen, game: sc.game },
    docks: dockSnapshot(),
    owners: ownerSnapshot(),
    clock: { running: isRunning(), bpm: getBpm(), holders: clockHolders(), listeners: clockListenerCounts() },
    guide: { lit: g.targets.length, soon: g.soon.length, owner: guideOwner() },
    sheet: { on: useSheet.getState().on, scoreOwner: score.score?.owner ?? null, pos: score.pos },
    loop: { running: lp.running, metronome: lp.metro },
    drums: { running: useDrums.getState().running },
    kode: { running: useKode.getState().running },
    pedal: { action: usePedal.getState().action },
    audio: { volume: useAudioSettings.getState().volume, muted: useAudioSettings.getState().muted, boost: useAudioSettings.getState().boost },
    devices: useDevices.getState().devices.filter((d) => d.connected).map((d) => `${d.name}:${d.role}`),
    subscriptions: { notes: noteListenerCount(), judge: judgeListenerCount(), coach: sayListenerCount(), kodeTokens: tokenListenerCount(), midi: routerListenerCounts(), panicTargets: panicTargets().length },
  }
}

if (import.meta.env.DEV) {
  ;(globalThis as Record<string, unknown>).__koogState = koogState
}
if (import.meta.hot) { import.meta.hot.accept() }
