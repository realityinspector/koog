# Koding Kore: the developer guide

> Koding allows the keyboard (like a piano keyboard) to become a coding interface. New types of apps, games, and adventures can come from learning music.

For app builders that means two things: every musical input (keys, pads, DJ controller, pedal) is a way to write a program, and every program is something you can hear. Design your app so the player's playing IS the code and the result is sound.

The **Koding Kore** is the runtime and SDK every Koog Kode app runs on. The **Koog App Store** (name in one place: `STORE_NAME` in `src/kode/kore/brand.ts`) is the catalog where kids find and launch them.

## Files

| File | What |
| --- | --- |
| `src/kode/kore/types.ts` / `index.ts` | `KodeApp`, `KodeConcept`, `KoreAppProps`, `Kore`; `registerApp`, `listApps`, `getApp`, `STORE_NAME` |
| `src/kode/kore/apps.ts` | the built-in registry (Koogalien Racer, Koog Kode, Koreographer, My Motifs, Phrase Match, Light the Tree, Harvest Feast) |
| `src/kode/kore/sdk.ts` | `createKore(appId, {exit})`; call-sign router (`acquireCallSigns`) |
| `src/kode/kore/KoreRunner.tsx` | loads an app's lazy component, hands it a Kore, disposes it on exit and HMR |
| `src/kode/kore/motifCore.ts`, `motifs.ts` | motif functions: pure rules, and the per-player store |
| `src/kode/kore/concepts.ts` | concept record (first-used date + count) behind concept badges |
| `src/kode/kore/ladder.ts` | phrase-ladder helpers imported from the holiday engine |
| `scripts/kore-fixtures.ts` | `npm run check:kore` |

## The manifest

```ts
registerApp({
  id: 'echo-cave', name: 'Echo Cave', icon: '🦇', tagline: 'Your phrase comes back, higher.',
  concepts: ['function', 'parameter'],          // sequence loop function parameter event condition parallel random recursion debug variable
  inputs: ['keys', 'drums'],                    // keys drums dj pedal screen
  ages: [7, 12], minutes: 5, status: 'beta',    // ready | beta | soon
  route: '#/apps/echo-cave',                    // learning apps may point at an existing game route and omit `component`
  component: () => import('./EchoCave'),        // lazy; default export takes { kore }
})
```

## An example app (about 40 lines)

```tsx
import { useEffect, useState } from 'react'
import type { KoreAppProps } from '../../kode/kore'

export default function EchoCave({ kore }: KoreAppProps) {
  const [last, setLast] = useState<number | null>(null)
  useEffect(() => {
    let phrase: { pitch: number; t: number; vel: number }[] = []
    const off = kore.tokens.on((t) => {                  // every device is one stream of tokens
      if (t.pitch == null) return
      kore.concepts.mark('event')                        // the kid USED an event: counts toward the badge
      setLast(t.pitch)
      if (t.t - (phrase.at(-1)?.t ?? 0) > 3000) phrase = []
      phrase.push({ pitch: t.pitch, t: t.t, vel: t.vel })
      kore.guide.show([t.pitch + 12])                    // glow the key an octave up
      if (phrase.length === 3) {
        const m = kore.motifs.define(phrase, { name: 'Echo', emoji: '🦇' })   // a phrase becomes a function
        if (m) kore.motifs.call(m.id, { transpose: 12 })                       // call it with an argument: an octave up
        phrase = []
      }
    })
    return off                                           // also cleaned up for you on exit and HMR
  }, [kore])
  const saved = kore.progress.load('plays', 0)           // per player, stored as kore.echo-cave.plays
  return (
    <div>
      <h2>🦇 Echo Cave</h2>
      <p>Last note: {last ?? '-'} · caves explored: {saved}</p>
      <button onClick={() => { kore.progress.save('plays', saved + 1); kore.celebrate({ title: 'Cave explored!', emoji: '🦇' }); kore.exit() }}>Leave</button>
    </div>
  )
}
```

## The SDK (`kore`)

- `tokens.on(fn)` -> unsubscribe. Wraps `src/kode/tokens.ts` (`{src, value, pitch?, lane?, vel, t}`).
- `clock`: `bpm()`, `beat()`, `nextBeat()`, `msOfBeat(b)`, `onBeat(fn)`, `atBeat(b, fn)` on the master clock.
- `sound.note(n, vel, whenBeat?, beats?)`, `sound.drum(voice, vel, whenBeat?)`, `sound.events(evs)`: scheduled on the audio clock ahead of time. Drums go through the capped `kore` channel (cap 0.8) and everything is silenced by panic.
- `guide.show(notes, soon?)` / `guide.clear()`, `sheet.show(phrase)` / `sheet.clear()`.
- `motifs`: `list`, `get`, `define(taps, {name, emoji})`, `call(nameOrId, {transpose, speed, vel})`, `onChange`.
- `progress.load(key, fallback)` / `progress.save(key, value)`: per player, namespaced `kore.<appId>.<key>`.
- `concepts.mark(id)`: records that the kid USED a concept (first date + count). The first time earns a concept badge.
- `celebrate({title, emoji, kind})`, `exit()`, `onCleanup(fn)`.
- `ladder`: `LEVELS`, `MASTER_PASS`, `newProg`, `nextUp`, `progressPct`, `phrasesOf` (imported from the holiday engine, not copied).

## Rules

1. **No DOM outside your own root.** Render in the component you are given; do not touch `document.body`, other apps' elements or global styles.
2. **No network** (no `fetch`, sockets, beacons) and **no `eval`/`new Function`**. Kid-made things are Koog Kode PROGRAMS (data), never executable code.
3. **Read only your own storage.** Use `kore.progress`, never `localStorage` or another app's keys.
4. **Volume caps stay on.** Make sound only through `kore.sound` (capped channel, limiter, panic). Never create your own AudioContext.
5. **At most 3 flashes per second**, no full-screen flashes, respect `prefers-reduced-motion`.
6. **Privacy**: nothing leaves the device; do not collect names or free text beyond a motif name saved locally.
7. **Clean up**: subscriptions made through `kore` are released on exit and HMR. Anything else you create (timers, listeners) goes through `kore.onCleanup`.
8. No brand names in the UI. Real musicians' names are fine; only traditional or pre-1931 music.

## Motif functions

Play a phrase, then stomp the pedal or press **Save motif**. Leading silence is trimmed and timing is lightly snapped to a quarter-beat grid. Pick an emoji and a name (or leave them blank for an auto-name like "🐝 Buzz"). Saving marks the `function` concept.

- **Call sign**: the first two notes (as an interval, so it works in any key) with the second note held for 350 ms. For drum or DJ pads, hit the chosen pad twice quickly.
- Playing the call sign runs the motif on the **next beat**, inside any Kore app (and in free play if the "Call signs work in free play too" toggle in My Motifs is on).
- **Arguments** (they mark the `parameter` concept): start the sign higher or lower and the motif transposes by the difference (max +/-24); hold the pedal while calling for x2 speed; how hard you press the second note scales the loudness. The editor can also set default transpose and x1/2, x1, x2.
- **Recursion teaser**: the built-in "Round" calls itself again every 2 beats, softer each time, capped at 4 levels (`MAX_DEPTH`). Marks `recursion`.
- Saved per player under `kore.motifs.list`. Delete asks to confirm and offers Undo.
- **Koog Kode**: `resolveMotif(name, shift?, speed?)` from `src/kode/kore` returns `{name, kind, notes: [{note, beat, beats, vel}]}` or `null`. The language's `play <name> +n` line calls it. "Use in Koog Kode" in My Motifs copies `play buzz +0`.

## Testing

`npm run check:kore` covers the pure logic (call-sign detection, transpose, speed, trim/quantise, recursion cap, concept record, registry validation) and the store (define, call at +3 on the beat, delete + undo, reload).
