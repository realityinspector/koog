import { setSheetOn, useScore, useSheet } from '../../music/scoreStore'
import { useScreen } from '../../layout/screenStore'
import './sheet.css'
import { Icon } from '../../ui/Icon'

/** Compact strip button: turns the play-along sheet music on and off. */
export function SheetToggle() {
  const on = useSheet((s) => s.on)
  const score = useScore((s) => s.score)
  const screen = useScreen((s) => s.screen)
  const canShow = !!score || screen === 'play'
  const visible = on && canShow
  const title = visible ? 'Hide the sheet music' : canShow ? 'Show the sheet music' : 'The sheet shows on PLAY, or while a song is playing'
  return (
    <button className={'sh-toggle' + (visible ? ' on' : '')} aria-pressed={visible} title={title} onClick={() => { if (canShow) setSheetOn(!on) }}>
      <Icon name="sheet" /> <span className="sh-toggle-t">Sheet</span>
    </button>
  )
}
