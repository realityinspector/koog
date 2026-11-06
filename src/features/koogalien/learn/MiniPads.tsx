// Eight small pads showing which keys a word uses. Lit pads are filled AND carry a dot, so color is never the only cue.
// With `onToggle` the pads are tappable (a chord-builder: tap the keys, then press "Play it").
import type { Degree } from '../../../koogalien/data/types'
import { useNames } from '../ui/prefs'

const D: Degree[] = [1, 2, 3, 4, 5, 6, 7, 8]
export function MiniPads({ lit = [], picked = [], onToggle, big, label }: { lit?: readonly Degree[]; picked?: readonly Degree[]; onToggle?: (d: Degree) => void; big?: boolean; label?: string }) {
  const solfege = useNames()
  return (
    <span className={'kgl-pads' + (big ? ' big' : '')} role={onToggle ? 'group' : 'img'} aria-label={label ?? `pads ${lit.join(' and ') || 'none'}`}>
      {D.map((d) => {
        const on = lit.includes(d), pk = picked.includes(d)
        const cls = 'kgl-pad' + (on ? ' on' : '') + (pk ? ' pk' : '')
        return onToggle
          ? <button key={d} type="button" className={cls} aria-pressed={pk} aria-label={`Pad ${d}, ${solfege(d)}`} onClick={() => onToggle(d)}><b>{d}</b><i>{solfege(d)}</i>{on ? <u aria-hidden>●</u> : null}{pk ? <s aria-hidden>✓</s> : null}</button>
          : <span key={d} className={cls} aria-hidden><b>{d}</b>{on ? <u>●</u> : null}</span>
      })}
    </span>
  )
}
