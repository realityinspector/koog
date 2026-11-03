import { useLinkNote } from './bus'

/** The calm note shown when a link mentions something Koog doesn't have. Fades on its own; never blocks. */
export function LinkNote() {
  const { msg, n } = useLinkNote()
  if (!msg) return null
  return <div key={n} className="kg-link-note" role="status" aria-live="polite">{msg}</div>
}
