# Developing Koog

Vite + React + TypeScript + zustand, built to be edited live while someone is playing. Every edit hot-swaps with no page reload.

## Continuity rules (edits must not reset the page)

Vite does a full page reload when an edited module is not an HMR boundary. So:

- **State lives outside React** in `src/store/appStore.ts` (zustand). The instance is kept in
  `import.meta.hot.data`, and the module self-accepts, so editing it does not reset state.
  Persistable fields (`counter`, `text`, `recentNotes`) are mirrored to `sessionStorage`
  (key `koog:state:v1`); if a full reload ever happens, the page restores them.
  Add a field: extend `AppState` + `initial`; add it to `PERSISTED` if it should survive reloads.
  Never put MIDIAccess or other live objects in the store.
- **MIDI lives in `src/midi/connection.ts`**. `MIDIAccess` is kept in `import.meta.hot.data`;
  on re-evaluation it re-attaches handlers to the existing access instead of reopening. The
  module self-accepts. Device hot-plug is handled via `onstatechange`.
- **One kind of export per file**: components-only files (`.tsx`) or non-component files
  (`.ts`). Mixing breaks React Fast Refresh and forces a reload.
- **New feature module (non-component, e.g. a looper engine)**: put it in its own `.ts` file,
  keep long-lived objects (timers, audio nodes, buffers) in `import.meta.hot.data`, and end the file with
  `if (import.meta.hot) { import.meta.hot.dispose(...); import.meta.hot.accept() }`.
  Write it literally as `import.meta.hot.accept(` - Vite does not detect an aliased `const hot = import.meta.hot`.
  Without a self-accept, an edit bubbles up to importers and causes a full reload.
  Keep its state in the store, not module variables. Components then just import it.
- **New UI**: new `.tsx` file exporting only components; add it to `App.tsx`.

## Still forces a full reload

`vite.config.ts`, `index.html`, `package.json`/new dependencies (server restart or re-optimize),
`src/main.tsx`, and anything with a syntax error that never loaded. sessionStorage restores
the persisted state after these, but the MIDI port is reopened (no permission prompt after the first grant).
Editing `appStore.ts`/`connection.ts` swaps module code, but already-created store actions/handlers
registered earlier keep the old closure; connection handlers are re-attached on each edit.

## Kid profiles and saved progress

Per-kid data goes through `src/profile/profile.ts`: `pload(name, fallback)` / `psave(name, value)` store it under `koog.p.<code>.<name>`. Never call `localStorage` directly for kid progress.
- **Stores** that cache saved data at module level: subscribe with `onProfileChange` and reload.
- **Panels** that read saved data in `useState`: `App.tsx` remounts them with `key={player}`.
- **Dev-only panels** go inside the `dad &&` block in `App.tsx`.

## Seeing the app without touching anyone's browser

`node scripts/screenshot.mjs scripts/shots/example-steps.json` launches headless Chrome with a throwaway profile, so kids' progress is never touched. It runs the steps (`nav`, `js`, `shot`) and writes PNGs to `scripts/shots/`, then prints page exceptions and console errors. macOS Chrome path.

Other step types: `wait` (ms), `viewport` (`[w, h]`). The browser is muted. To fake a MIDI device in dev, call `__routeForTest(portName, bytes)` from `src/midi/connection.ts` (a port name with "Mixtrack" is treated as a DJ controller). Test the result, not just the picture: read engine state (for example `loopEngine.debugLog()`, the drum pattern, saved bests) after a flow.

## Checks before a commit

```sh
npm run typecheck        # app + server
npm run check:catalog    # links catalog matches the source (regenerate: npm run build:catalog)
npm run check:listen && npm run check:mentor && npm run check:loops && npm run check:drums
npm run build:web
```

## Deploy (Fly.io app `koog-demo`)

`npm run deploy:fly` builds `dist-web` and ships only the static site plus the small API/MCP server (`server/`). Deploy from a clean checkout of a commit (a `git worktree`), so half-finished local edits are never shipped. One shared-CPU 256 MB machine that stops when idle (`auto_stop_machines`), no volumes, no secrets.

Abuse limits live in `deploy/nginx.conf`: per-visitor and global request rates for pages, files, the API and MCP (429 when over), 1 KB request bodies, 4 KB headers, short timeouts, JSON-only POSTs (415 otherwise), URLs over 2 KB refused (414), MCP batches capped at 10. The server is stateless and logs nothing about kids.

## House rules

- No brand names in the UI (say "DJ controller", "classic looper pedal", "analog-style").
- At most 3 flashes per second, no full-screen flashes, respect reduced motion. Volume caps and the limiter stay on; new sound goes through a capped channel in `src/audio/host.ts` and registers with `src/music/panic.ts`.
- Songs: public domain in the US only (published 1930 or earlier, or traditional).
- No personal info in the repo. Kids' data stays in their browser.
