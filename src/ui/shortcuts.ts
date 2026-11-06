// One place to register a GLOBAL keyboard shortcut. Why: two handlers claiming the same key (M was both the note B and the
// metronome) made one press do two jobs. This helper gives every shortcut the same manners:
//   * ignores text boxes / contenteditable / selects, key repeat (unless asked) and IME composition
//   * Ctrl/Cmd/Alt must match exactly (a shortcut that does not ask for Ctrl never fires with Ctrl)
//   * Shift must match exactly (shift: undefined means "must NOT be held"; 'any' ignores it)
//   * in dev, a console warning when ONE key press matches two shortcuts that are both active
// Declared combos live in src/ui/shortcutTable.ts (the docs and the collision fixture read it).
export interface ShortcutDef {
  /** unique id (re-registering the same id replaces it, so HMR is safe) */
  id: string
  /** e.code ("KeyM", "Space", "Enter") or e.key ("Escape") */
  key: string
  shift?: boolean | 'any'
  /** Ctrl or Cmd */
  ctrl?: boolean
  alt?: boolean
  /** active right now? (a closed panel's shortcut must say false) */
  when?: () => boolean
  /** return false to say "not mine after all" (the browser's default then still happens) */
  run: (e: KeyboardEvent) => void | false
  /** key released (for hold gestures such as the looper button) */
  up?: (e: KeyboardEvent) => void
  /** let a repeating (held) key fire again */
  repeat?: boolean
  /** let it fire while a text box has focus (default false) */
  inFields?: boolean
  /** a label for the dev warning */
  owner?: string
}

type Hot = { reg?: Map<string, ShortcutDef>; off?: () => void }
const hot = ((typeof import.meta !== 'undefined' && import.meta.hot?.data) || {}) as Hot
const reg: Map<string, ShortcutDef> = hot.reg ?? new Map()

export const inTextField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el || typeof el !== 'object') return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((el as HTMLInputElement).type)
}

type KeyLike = { code: string; key?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }
/** does this key event match the shortcut's combo (ignoring `when`)? */
export function matches(d: Pick<ShortcutDef, 'key' | 'shift' | 'ctrl' | 'alt'>, e: KeyLike): boolean {
  if (e.code !== d.key && e.key !== d.key) return false
  if (d.shift !== 'any' && !!d.shift !== e.shiftKey) return false
  if (!!d.ctrl !== (e.ctrlKey || e.metaKey)) return false
  return !!d.alt === e.altKey
}
const active = (d: ShortcutDef) => { try { return !d.when || d.when() } catch { return false } }
const combo = (d: ShortcutDef) => `${d.ctrl ? 'Ctrl+' : ''}${d.alt ? 'Alt+' : ''}${d.shift === true ? 'Shift+' : ''}${d.key}`

/** ids of registered shortcuts that share a combo with another one (a static check; `when` is not consulted) */
export function findCollisions(list: Iterable<ShortcutDef> = reg.values()): string[][] {
  const by = new Map<string, string[]>()
  for (const d of list) { const k = combo(d) + (d.shift === 'any' ? '*' : ''); by.set(k, [...(by.get(k) ?? []), d.id]) }
  return [...by.values()].filter((v) => v.length > 1)
}

function onDown(e: KeyboardEvent) {
  if (e.isComposing || e.defaultPrevented) return
  const hit: ShortcutDef[] = []
  for (const d of reg.values()) {
    if (!matches(d, e) || (e.repeat && !d.repeat) || (!d.inFields && inTextField(e.target)) || !active(d)) continue
    hit.push(d)
  }
  if (!hit.length) return
  if (hit.length > 1 && import.meta.env?.DEV) console.warn(`[shortcuts] ${combo(hit[0])} is claimed by ${hit.map((h) => h.owner ?? h.id).join(' and ')} at the same time; only the first runs`)
  if (hit[0].run(e) !== false) e.preventDefault()
}
function onUp(e: KeyboardEvent) {
  for (const d of reg.values()) if (d.up && (e.code === d.key || e.key === d.key)) { try { d.up(e) } catch { /* ignore */ } }
}

/** register a global shortcut; call the returned function to remove it */
export function registerShortcut(def: ShortcutDef): () => void {
  if (import.meta.env?.DEV) {
    const same = [...reg.values()].filter((o) => o.id !== def.id && combo(o) === combo(def) && (o.shift === 'any') === (def.shift === 'any'))
    if (same.length) console.warn(`[shortcuts] ${combo(def)} is registered by ${def.owner ?? def.id} and ${same.map((s) => s.owner ?? s.id).join(', ')}; make sure their when() are never both true`)
  }
  reg.set(def.id, def)
  return () => { if (reg.get(def.id) === def) reg.delete(def.id) }
}
/** the registered shortcuts (for dev tools and tests) */
export const registeredShortcuts = () => [...reg.values()]
/** run the dispatcher by hand (tests that have no real window events) */
export const dispatchKeyDown = onDown
export const dispatchKeyUp = onUp

if (typeof window !== 'undefined') {
  hot.off?.()
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  const off = () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  if (import.meta.hot) {
    import.meta.hot.data.reg = reg
    import.meta.hot.data.off = off
    import.meta.hot.dispose(() => { off() })
    import.meta.hot.accept()
  }
}
