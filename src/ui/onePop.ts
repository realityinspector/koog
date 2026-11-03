import { useEffect, useRef } from 'react'

/** One popover at a time: when a popover opens it announces itself, and every other open popover closes.
 *  Usage: useOnePop('devices', open, () => setOpen(false)). Ids must be unique per popover. */
const EV = 'koog:pop'
export function useOnePop(id: string, open: boolean, close: () => void) {
  const c = useRef(close)
  c.current = close
  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent(EV, { detail: id })) // before listening, so it doesn't close itself
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) c.current() }
    window.addEventListener(EV, on)
    return () => window.removeEventListener(EV, on)
  }, [open, id])
}
