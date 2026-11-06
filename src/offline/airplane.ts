// Airplane: Koog stays here. Sound, keys, games, and the desk keep working.
// Web pages, the ideas inbox, and anything that would leave the computer wait.
import { create } from 'zustand'
import { leavesTheComputer } from './net'

const KEY = 'koog.airplane'
type Desk = { setAirplane?: (on: boolean) => void }

function saved(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

function tellShell(on: boolean) {
  const desk = (window as Window & { koogDesktop?: Desk }).koogDesktop
  desk?.setAirplane?.(on)
  document.documentElement.dataset.airplane = on ? '1' : ''
}

interface AirplaneState {
  on: boolean
  set: (on: boolean) => void
}

export const useAirplane = create<AirplaneState>((set) => ({
  on: typeof localStorage === 'undefined' ? false : saved(),
  set: (on) => {
    try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private window */ }
    tellShell(on)
    set({ on })
  },
}))

export const airplaneOn = (): boolean => useAirplane.getState().on

let guard = false

/** Remember the switch, tell the desktop shell, and keep web links from leaving. */
export function installAirplane() {
  tellShell(useAirplane.getState().on)
  if (guard) return
  guard = true
  document.addEventListener('click', (e) => {
    if (!airplaneOn()) return
    const from = e.target instanceof Element ? e.target : null
    const link = from?.closest('a[href]')
    const href = link?.getAttribute('href') ?? ''
    if (link && leavesTheComputer(href)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, true)
}
