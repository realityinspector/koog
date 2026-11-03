// Web demo + teacher demo flags. Shared by the app, the landing page and the teacher page.
//
//   Web demo   `npm run build:web` (VITE_WEB_DEMO=1). A hosted copy for trying Koog in a browser.
//              It opens on a landing page with a demo code, and supports only the computer keyboard
//              (no MIDI devices, no foot pedal, no Idea box). In dev, open any page with ?webdemo to try it.
//   Embed      ?embed in the URL: Koog running inside the teacher demo's laptop screen.
//
// The demo code is a soft gate that keeps casual visitors out. It is not real security: the page is static.
// Only a hash of the code is stored here.

const CODE_SHA256 = 'd579609bd5631519c58c95d3968ea91b06ba6e7dc9de0be63a346912e1275c30'
const OK_KEY = 'koog.demo.ok'
const WEB_KEY = 'koog.webdemo'
export const GITHUB_URL = 'https://github.com/realityinspector/koog'

const q = () => new URLSearchParams(location.search)
const safe = <T,>(f: () => T, d: T): T => { try { return f() } catch { return d } }

// ?webdemo (dev only) turns web-demo mode on for this tab; ?webdemo=0 turns it off.
if (import.meta.env.DEV) {
  const w = q().get('webdemo')
  if (w !== null) safe(() => (w === '0' ? sessionStorage.removeItem(WEB_KEY) : sessionStorage.setItem(WEB_KEY, '1')), undefined)
}

/** true in the hosted web demo build (or a dev tab opened with ?webdemo). */
export function isWebDemo(): boolean {
  if (import.meta.env.VITE_WEB_DEMO === '1') return true
  return import.meta.env.DEV && safe(() => sessionStorage.getItem(WEB_KEY) === '1', false)
}
/** true when Koog runs inside the teacher demo's laptop screen. */
export const isEmbed = () => q().has('embed')

/** Web demo only: has this browser entered the demo code? (Always true outside the web demo.) */
export function isUnlocked(): boolean {
  if (!isWebDemo()) return true
  return safe(() => localStorage.getItem(OK_KEY) === CODE_SHA256, false)
}

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
/** Check a typed demo code (case and spaces ignored). Remembers it on success. */
export async function tryUnlock(code: string): Promise<boolean> {
  const h = await sha256(code.trim().toLowerCase().replace(/\s+/g, ''))
  if (h !== CODE_SHA256) return false
  safe(() => localStorage.setItem(OK_KEY, h), undefined)
  return true
}
export function lock() { safe(() => localStorage.removeItem(OK_KEY), undefined) }
