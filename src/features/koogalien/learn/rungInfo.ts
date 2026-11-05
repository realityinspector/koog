// The rung names and icons are the holiday ladder's (reused through the Kore, not copied), so every game speaks the same way.
import { ladder } from '../../../kode/kore/ladder'
import type { Rung } from '../../../koogalien/learn/ladder'

export function rungInfo(r: Rung): { name: string; icon: string; coach: string; rule: string } {
  const l = ladder.LEVELS.find((x) => x.id === r)
  return l ? { name: l.name, icon: l.icon, coach: l.coach, rule: l.rule } : { name: r, icon: '⭐', coach: '', rule: '' }
}
