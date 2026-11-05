// Dev/test only: mounts a Kore app by id into a full-screen div, so the headless harness can drive it before the App Store route exists.
import { createRoot, type Root } from 'react-dom/client'
import { getApp } from './registry'
import { KoreRunner } from './KoreRunner'
import './apps'

let root: Root | null = null
export function mountKoreApp(id: string, onExit: () => void = () => unmountKoreApp()) {
  unmountKoreApp()
  const app = getApp(id); if (!app) return false
  const el = document.createElement('div'); el.id = 'kore-dev-root'
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#14141f;overflow:auto'
  document.body.appendChild(el); root = createRoot(el)
  root.render(<KoreRunner app={app} onExit={onExit} />)
  return true
}
export function unmountKoreApp() { root?.unmount(); root = null; document.getElementById('kore-dev-root')?.remove() }
if (import.meta.hot) import.meta.hot.accept()
