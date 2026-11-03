import { AudioControls } from '../features/audio/AudioControls'
import { DevicesControl } from '../features/devices/DevicesControl'
import { SheetToggle } from '../features/sheet/SheetToggle'
import { Icon } from '../ui/Icon'
import { isEmbed, isWebDemo } from '../web/webDemo'
import { currentUrl } from '../links/sync'
import { linkNote } from '../links/bus'

async function copyLink() {
  const url = currentUrl()
  try { await navigator.clipboard.writeText(url) } catch {
    const t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select(); try { document.execCommand('copy') } catch { /* ignore */ } t.remove()
  }
  linkNote('Link copied')
}

/** Always-visible switches in the top strip: sound (volume, mute, computer sound) and sheet music. */
export function StripControls() {
  return (
    <div className="kg-strip-controls">
      {isWebDemo()
        ? <span className="kg-keys-chip" title="Web demo: computer keyboard only. Run Koog on your computer for USB keyboards."><Icon name="keys" size={16} /> Computer keys</span>
        : <DevicesControl />}
      <AudioControls />
      <SheetToggle />
      {!isEmbed() && <button className="kg-link-btn" title="Copy a link to exactly this" aria-label="Copy a link to exactly this" onClick={() => void copyLink()}><Icon name="link" /></button>}
    </div>
  )
}
