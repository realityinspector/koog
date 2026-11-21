// Global shortcuts must not collide: one key press may not do two jobs.
//   npx --no-install tsx scripts/shortcut-fixtures.ts        (exit 1 on any failure)
import { SHORTCUTS } from '../src/ui/shortcutTable'
import { findCollisions, matches, type ShortcutDef } from '../src/ui/shortcuts'
import { readFileSync } from 'node:fs'

let fails = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`))
  if (!ok) fails++
}

// 1. the declared table: same combo + same context twice = a collision
const seen = new Map<string, string>(), dup: string[] = []
for (const r of SHORTCUTS) for (const c of r.combo.split(' / ')) {
  const k = c.trim() + '|' + r.context
  if (seen.has(k)) dup.push(`${c} in ${r.context}: ${seen.get(k)} and ${r.owner}`); else seen.set(k, r.owner)
}
eq('no two declared shortcuts share a combo in the same context', dup, [])
// M is a note in keys-play-notes and the metronome is Shift+M: the two must stay distinct combos
eq('plain M and Shift+M are different declared combos', SHORTCUTS.filter((r) => r.combo === 'M').length === 1 && SHORTCUTS.filter((r) => r.combo === 'Shift+M').length === 1, true)

// 2. the registry's matcher
const ev = (o: object) => ({ code: 'KeyM', key: 'm', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...o })
const metro = { key: 'KeyM', shift: true as const }
eq('Shift+M matches the metronome shortcut', matches(metro, ev({ shiftKey: true })), true)
eq('plain M does not match it', matches(metro, ev({})), false)
eq('Ctrl+Shift+M does not match it', matches(metro, ev({ shiftKey: true, ctrlKey: true })), false)
eq('Space (no modifiers) matches Space', matches({ key: 'Space' }, ev({ code: 'Space', key: ' ' })), true)
eq('Shift+Space does not match a plain Space shortcut', matches({ key: 'Space' }, ev({ code: 'Space', key: ' ', shiftKey: true })), false)

// 3. the registry reports two shortcuts on one combo
const mk = (id: string, o: Partial<ShortcutDef>): ShortcutDef => ({ id, key: 'KeyM', run: () => {}, ...o })
eq('two shortcuts on the same combo collide', findCollisions([mk('a', { shift: true }), mk('b', { shift: true })]), [['a', 'b']])
eq('M and Shift+M do not collide', findCollisions([mk('a', {}), mk('b', { shift: true })]), [])
eq('Ctrl+M and M do not collide', findCollisions([mk('a', {}), mk('b', { ctrl: true })]), [])

// 4. every row in the table is documented, and the map file exists
const doc = readFileSync(new URL('../docs/SHORTCUTS.md', import.meta.url), 'utf8')
eq('docs/SHORTCUTS.md lists Shift+M', doc.includes('Shift+M'), true)
eq('docs/SHORTCUTS.md lists every declared owner file', SHORTCUTS.filter((r) => r.owner.startsWith('src/') && !doc.includes(r.owner.split(' ')[0])).map((r) => r.owner), [])

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1) }
console.log('\nall shortcut checks passed')
