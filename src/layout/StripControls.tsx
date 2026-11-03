import { AudioControls } from '../features/audio/AudioControls'
import { DevicesControl } from '../features/devices/DevicesControl'
import { SheetToggle } from '../features/sheet/SheetToggle'
import { Icon } from '../ui/Icon'
import { isWebDemo } from '../web/webDemo'

/** Always-visible switches in the top strip: sound (volume, mute, computer sound) and sheet music. */
export function StripControls() {
  return (
    <div className="kg-strip-controls">
      {isWebDemo()
        ? <span className="kg-keys-chip" title="Web demo: computer keyboard only. Run Koog on your computer for USB keyboards."><Icon name="keys" size={16} /> Computer keys</span>
        : <DevicesControl />}
      <AudioControls />
      <SheetToggle />
    </div>
  )
}
