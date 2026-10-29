import { setSheetOn, useSheet } from '../../music/scoreStore'
import './sheet.css'

/** Compact strip button: turns the play-along sheet music on and off. */
export function SheetToggle() {
  const on = useSheet((s) => s.on)
  return (
    <button className={'sh-toggle' + (on ? ' on' : '')} aria-pressed={on} title={on ? 'Hide the sheet music' : 'Show the sheet music'} onClick={() => setSheetOn(!on)}>
      <span aria-hidden>🎼</span> <span className="sh-toggle-t">Sheet</span>
    </button>
  )
}
