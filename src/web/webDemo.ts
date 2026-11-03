// Web demo + teacher demo flags. Shared by the app, the landing page and the teacher page.
//
//   Web demo   `npm run build:web` (VITE_WEB_DEMO=1). A hosted copy for trying Koog in a browser.
//              It opens on a landing page, and supports only the computer keyboard
//              (no MIDI devices, no foot pedal, no Idea box). In dev, open any page with ?webdemo to try it.
//   Embed      ?embed in the URL: Koog running inside the teacher demo's laptop screen.
//
// The hosted copy has no sign-in. Its server rate-limits each visitor instead (see deploy/nginx.conf).

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
