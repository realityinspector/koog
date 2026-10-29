import { AudioControls } from '../features/audio/AudioControls'
import { SheetToggle } from '../features/sheet/SheetToggle'

/** Always-visible switches in the top strip: sound (volume, mute, computer sound) and sheet music. */
export function StripControls() {
  return (
    <div className="kg-strip-controls">
      <AudioControls />
      <SheetToggle />
    </div>
  )
}
