import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { isWebDemo, isEmbed } from './web/webDemo'

const showApp = !isWebDemo() || new URLSearchParams(location.search).has('play')
if (isEmbed()) void import('./web/demoBridge')

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (!showApp) {
    const { Landing } = await import('./web/Landing')
    root.render(<StrictMode><Landing /></StrictMode>)
    return
  }
  await import('./midi/connection') // side effect: opens MIDI once, survives HMR (skipped in the web demo)
  const { App } = await import('./App')
  root.render(<StrictMode><App /></StrictMode>)
}
void boot()
