import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_TITLE } from './brand/names'
import { isWebDemo, isEmbed } from './web/webDemo'

document.title = APP_TITLE

const showApp = !isWebDemo() || new URLSearchParams(location.search).has('play') || location.hash.startsWith('#/')
if (isEmbed()) void import('./web/demoBridge')

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (!showApp) {
    const { Landing } = await import('./web/Landing')
    root.render(<StrictMode><Landing /></StrictMode>)
    return
  }
  await import('./index.css') // app-wide styles (not for the landing page: they lock page scrolling)
  await import('./midi/connection') // side effect: opens MIDI once, survives HMR (skipped in the web demo)
  await import('./features/gamepad/gamepad') // side effect: a wireless game controller plays notes (no MIDI permission)
  const { App } = await import('./App')
  root.render(<StrictMode><App /></StrictMode>)
}
void boot()
