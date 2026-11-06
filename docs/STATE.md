# Koog shared state: the map, the findings, the guards

Written by the state-audit pass. Live check: `window.__koogState()` in the dev console (DEV builds only, no kid UI). Guards: `npm run check:state` (node, pure) and `node scripts/screenshot.mjs scripts/shots/state-harness-steps.json <outDir>` (live app, throwaway profile; prints `state harness: N pass, 0 fail`).

New helpers: `src/music/owners.ts` (ownership), `src/layout/docks.ts` + `dockWiring.ts` (dock manager), `src/layout/stateInspector.ts`, `onProfileChange(fn, name)` and `ploadShared` in `src/profile/profile.ts`, `acquireClock / releaseClock` in `src/music/masterClock.ts`, `setGuideFor / clearGuideFor` in `src/music/guide.ts`.

## 1. Inventory

### 1.1 Zustand stores (about 58 files; all keep the instance on `import.meta.hot.data`, the HMR rule)
| Area | Stores (file) | Saved? | Writers / readers |
|---|---|---|---|
| App core | `store/appStore.ts` (counter, text, recentNotes; sessionStorage `koog:state:v1`) | session | writers: midi connection, localNotes, typing (via `pushNote`); readers: `onNote` feed, readouts |
| Profile | `profile/profile.ts` (active, profiles, mode) | device keys | ProfileBar writes; everything reads via `pkey/pload/psave` |
| Screen | `layout/screenStore.ts` (screen, game) | no | Instrument.tsx (screen), GamesPanel (game); readers: docks, mentor, visualizer, links, perfmon |
| Key glow | `music/guide.ts` (targets, tone, soon) | no | about 20 writers (games, songs, coop, duo, phrase engine, kore sdk, loop station); reader PianoStrip, padplay |
| Sheet | `music/scoreStore.ts` (`useScore` score/pos/results, `useSheet` on) | `koog.sheet.on` | games, songs, phrase engine, loop engine publish by `owner`; SheetOverlay reads |
| Sheet level | `music/sheetLevel.ts` | per kid | SheetOverlay |
| Audio | `music/audioSettings.ts` (volume, muted, boost) | `koog.audio` (boost never) | AudioControls; host reads |
| Clock | `music/masterClock.ts` (bpm, running, following, link) | no | Loop, drums, Kode, racer, pedal, Boss UI; readers: all engines |
| Devices | `music/devices.ts` (devices, roles) | `koog.devices.roles` | connection.ts; readers: controller pages, padplay |
| Judge / harmony / vibes / zones / phrases | `music/judge.ts`, `harmonyStore.ts` (per kid), `vibes.ts`, `zones.ts` (per kid), `phraseEngine.ts` + `phrases.ts` (per kid), `typing.ts` | mixed | note feed in, many readers |
| Loop station | `loopstation/loopEngine.ts`, `loopSurface.ts` (controller loop page), `guide.ts` (rhythm guide + metronome, a DIFFERENT `useGuide`), `clearToast.ts` | sessions per kid | pedal, controller, M key |
| Drums | `drumpads/drumEngine.ts` (per kid), `drumSurface.ts` (drum page `on`) | per kid | |
| Kode | `kode/kodeEngine.ts` (per kid), `kodeDock.ts`, `kode/kore/motifs.ts` (per kid) | | |
| Pedal / board | `pedal/pedal.ts` (`koog.pedal`), `pedalboard/boardEngine.ts` (per kid), `boardOpen.ts`, `pianoPedals.ts` | | |
| DJ | `dj/duo.ts`, `duoOpen.ts` (`koog.dj.open`), `coop.ts` (per kid + shared `koog.band`), `calibrate.ts` | | |
| Pad play | `padplay/padplay.ts` (`koog.padplay.*`) | device | |
| Games | `games/racer`, `memory`, `holiday` engines (per kid via psave) | per kid | |
| Koogalien | `features/koogalien/store.ts`, `ui/prefs.ts`, `library/reader.ts` (per kid) | per kid | not touched by this pass (busy area) |
| Other | `challenges/store.ts`, `mentor/mentorStore.ts`, `celebrate`, `controller/surface.ts`, `devices/latency.ts`, `devices/soundChoice.ts`, `gallery/runner.ts`, `pro/{bossStore,mixer,monitor,scenes}`, `sheet/freeplay.ts`, `test-rig`, `vibes/{challenge,dancerName,eggStore}`, `links/bus.ts`, `coach/coachBus.ts` | | |

### 1.2 Module-level mutable state (kept on `hot.data`)
masterClock `A` anchor and listener sets; `notes.ts` feed; judge/coach/token listener sets; midi router subs; `panic.ts` target map; `owners.ts` and `docks.ts` registries; `profile.ts` listener set plus named map; engines' `E`/`R`/`G` objects (loop, drums, kode, racer, memory run, guide audio); `storeState.ts` (Store view); `gallery/runner.ts` localStorage shield (NOW on hot.data, see F6); `layout/stack.ts` observers.

### 1.3 Storage keys
Per player (`koog.p.<code>.<name>` via pload/psave/pkey): `split.v1, sheetLevel, harmony, phrases.v1, songs.best.v1, mysongs.v1, songs.beat (NEW), rq.seen (NEW), loop.sessions.v1, loop.closeNudge.v1, drumpads.v1, pedalboard, appstore.recent, scenes, coach, coach.seen, coach.phraseTips, dancer.eggs, dancer.name, smartband, coop, milestones, tour, mentor.on, mentor.v1, mimic, surface.v1, holidayGames, bachdoom, zombielanes, fashion, jiujitsu, memory, racer, gk.<game>, kode.v1, patchquests, lastPlayed, sound.v1, kore.concepts, kore.motifs.list, kore.motifs.freePlay, koogalien, koogalien-ui, koogalien-games, library.prefs`.
Device-wide (deliberate, each listed with a reason in `scripts/state-fixtures.ts` DEVICE_KEYS; the fixture fails on any NEW unlisted key): `koog.active, koog.profiles, koog.mode, koog.audio, koog.devices.roles, koog.timingOffsets, koog.pedal, koog.typing.on, koog.mode.screen, koog.sheet.on, koog.sheet.names, koog.kb.*, koog.vibes.chip, koog.dj.*, koog.band (shared on purpose), koog.loop.view, koog.songs.lyrics, koog.padplay.*, koog.viz.*, koog.ctl.*, koog.perf*`; session: `koog:state:v1`, `koog.webdemo`.
Legacy shared keys now adopted per player: `koog.songs.beat`, `koog.rq.seen` (`ploadShared`).

### 1.4 Event buses (emitter -> listeners)
- `onNote` (`music/notes.ts`): emitters midi/connection, typing, localNotes, padplay, PianoStrip clicks via `pushNote`; listeners judge, harmony, loop engine, mentor, milestones, phrase engine, games, vibes, perfmon, DUO, Kode tokens.
- `onJudge`: judge emits; vibes, milestones, freeplay, mentor, games listen.
- `coachBus` (`onSay`): coach tips, mentor, vibes captions, phrase labels emit; CoachLine UI listens.
- Kode tokens (`kode/tokens.ts` `onToken`): Kode runner, games emit; Kore concepts, games listen.
- MIDI router roles (`midi/router.ts`): connection emits per device role (`piano, dj, surface, loop, drums, gamepads`); loopSurface, drumSurface, controller surface, padplay, DJ engine listen. `onRoleChange` for role switches.
- Master clock: `onBeat / onBar / onTick`; racer, drums, kode, loop engine, guide audio, beats link, schedulers.
- `startSignal` (padplay/pedal, input-conflicts agent): its own start channel; `ui/shortcuts.ts` owns global keys (see docs/SHORTCUTS.md).
- `links/bus.ts` + `links/sync.ts`: hash router to state and back (screen, kode dock, duo, mimic, band, helpers).
- `onProfileChange` registry (`profile.ts`): 21 listeners at boot, 10+ named.
- Panic registry (`music/panic.ts`): 25 targets (audio-host, beats, boost, dj, drumpads, emulators, fx, guide, holiday, kode, kore, localNotes, loops, metronome, mimic, padplay, pedal, pedalboard, pro, racer, smartband, synth, zones).

### 1.5 Global singletons
Audio host (`audio/host.ts`: one context, one limiter, capped channels `band dj drumpads drums fx guide holiday-backing keys kode kode-drums kore loops mimic racer`), master clock, local-notes synth (`localNotes.ts`), worker timer (`audio/workerTimer.ts`, the only Worker), panic registry, pedal, devices, key-glow guide, sheet/score, judge, harmony, coach bus.

### 1.6 Docks and overlays (the dock manager, `src/layout/dockWiring.ts`)
| id | flag | group |
|---|---|---|
| looper | `useLoopsDock.open` | bottom (exclusive) |
| kode | `useKodeDock.open` | bottom (exclusive) |
| drums | `useDrumPage.on` (controller page `drums`) | bottom (exclusive) |
| duo | `useDuoOpen.open` | none (strip, coexists) |
| pedalboard | `useBoardOpen.open` | none (modal) |
| gamepads | `usePadPlay.on` | none |
| sheet | `useSheet.on` | none |
| store | appstore `open` (hash `#/apps`, Koogalien lives in its frame) | none |
Not registered: gallery (`useGallery.phase`, owns the whole screen and resets the world between stops), controller surface/page (device roles).

## 2. Flows

```
Note: device/keyboard -> midi/connection (role router) or typing.ts / PianoStrip click
      -> localNotes (sound, panic-registered) + pushNote -> appStore.recentNotes
      -> notes.ts dispatch (ONE store subscription) -> every onNote listener
         (judge -> onJudge listeners; harmony; loop recorder; phrase engine; games; mentor; vibes; Kode tokens)

Pedal: key (pedal.ts, capture phase) or MIDI CC64 -> press() -> pedalJob():
      auto -> drum page ? kick : looper on screen ? loop : sustain
      actions: sustain/soft/sostenuto (localNotes), loop (bigDown), kick, stomp (pedalboard), beat (raw start/stop clock)
      start signal for games: startSignal.ts (own channel; no longer fakes a pedal press)

Screens/docks: hash -> links/sync -> useScreen / setKodeDock / duo ; Instrument tabs -> useScreen.screen
      ModesLauncher / DevicesControl / Kode panel / links -> setLoopsDock | setKodeDock | setControllerPage('drums')
      -> dock manager subscription: the newly opened dock in group 'bottom' closes the others (any route)
      GamesPanel mount/unmount -> useScreen.game; unmount force-clears key glow

Profile: ProfileBar -> useProfile.signIn/create/signOut -> switchTo() -> every onProfileChange listener reloads its data;
      panels keyed by `player` in App.tsx remount (Songs, Challenges, Games, RequestBar, ProStudio, AppStore); setBoost(false)

Master clock: start via acquireClock(owner) [racer, drums, kode] | raw startMaster [loop engine, pedal 'beat', Boss START]
      stop via releaseClock(owner) -> only when last holder leaves AND a holder started it; loop engine uses stopMasterUnlessHeld();
      any stopMaster() (player pressed STOP) clears the "we started it" duty. Drums also stop when the clock is stopped under them.

Volume/boost/panic: audioSettings.volume/muted -> host master gain; boost doubles gain, auto-off after 60 min and on profile change;
      panicAll() -> every registered target (hard flag) then CC123 + CC120 on 16 channels; limiter and caps always stay in the host.
```

## 3. Findings (ranked by kid impact)

Status: FIXED = fixed here, PROPOSED = needs a bigger refactor.

1. **FIXED. Closing a game could stop the clock under the drums / Kode / looper.** Racer (`games/racer/engine.ts` closeGame) called `stopMaster()` if it had started the clock, even if drums had since joined it; the same pattern in drums and Kode (`startedClock` flags, three owners, no counting). Fix: refcounted `acquireClock/releaseClock`; loop engine uses `stopMasterUnlessHeld()`. Fixture + harness cover it.
2. **FIXED. Sheet level never reloaded for the next kid in a production build.** `sheetLevel.ts` and `pro/scenes.ts` registered `onProfileChange` inside `if (import.meta.hot)`, so only the dev server did it. Found by the new profile-switch fixture.
3. **FIXED. Racer and Phrase Match kept the previous kid's save in the store.** Racer's `save` and Memory's `kode/kodeWins` were read once; the next lap/`setKode` wrote the old kid's numbers under the new kid. Both now reload on profile change.
4. **FIXED. Gallery storage shield broke on a hot edit.** `gallery/runner.ts` captured the already-patched `Storage` methods as originals when its module was re-evaluated mid-gallery, so afterwards every progress save was silently held in memory. State now lives on `hot.data`.
5. **FIXED. Late timers wiped another feature's key glow.** About 20 writers share `useGuide`; `later(clearGuide)` in a game that already left, the phrase trainer echo timer, the DUO strip and Co-op all clobbered each other. The guide now records its owner; racer, memory, holiday, phrase engine, coop, duo and the challenge mini keyboard use owner-scoped set/clear. PROPOSED: migrate the remaining writers (bachdoom, fashion, jiujitsu, zombielanes, loop station, kore sdk, EmuLearn, phraseKit).
6. **FIXED. Two docks could show at once.** Only the Modes launcher and the Kode panel closed other docks; `setControllerPage('drums')` from DevicesControl, `#/kode` links or the loop-page chip left e.g. Looper plus Drums stacked. The dock manager enforces one dock per group from any route.
7. **FIXED. Un-namespaced per-kid keys.** `koog.songs.beat` (backing beat per song) and `koog.rq.seen` (which request replies a kid has seen) were shared by siblings; now per kid and adopted once from the old key. The remaining `koog.*` keys are device settings and listed with reasons in the fixture. PROPOSED: sheet names and keyboard names are really learner training wheels and could become per kid (needs the components keyed by player).
8. **FIXED. HMR stacking.** `dancerName.ts` subscribed to the whole profile store on every evaluation, recreated its store (under components already using it) and had no `accept`; `perfmon.ts` stacked `pagehide`, `visibilitychange` and a profile subscription per edit. Both clean up on dispose now. Named `onProfileChange(fn, name)` replaces rather than stacks.
9. **PROPOSED. Two modules both called "guide".** `music/guide.ts` (key glow) and `loopstation/guide.ts` (rhythm guide and metronome) both export `useGuide` and `setGuide` with different shapes; ProStudio's `setGuide({ on: false })` on exiting Boss mode is the rhythm one. Rename the second (`useRhythmGuide`) in a pass that does not collide with the looper work.
10. **PROPOSED. Hidden coupling by DOM clicks.** `padplay.ts` clickFirst() clicks other features' buttons by class name (`.zl-btn.go`, `.bd-start`, `button.btn` "Play"); gallery `runner.press()` and `links/sync.ts` click `.vb-patch.on` and `.kg-dev-chip.open`. A renamed class silently breaks pad Start. Replace with the `startSignal` channel plus `data-padplay` opt-ins (partly done by input-conflicts).
11. **PROPOSED. The loop engine keeps its own clock ownership (`ownMaster`, `metroClock`).** It is the one remaining raw starter besides the pedal `beat` action and Boss START. Convert to `acquireClock('loops')` / `acquireClock('metronome')` once the input-conflicts work in `loopEngine.ts` settles; steps: ensureTransport -> acquire, releaseMaster -> release, setMetronomeOn -> acquire/release, delete ownMaster/metroClock.
12. **PROPOSED. Game exit has no single leave hook.** Each game clears its own score/guide/timers on unmount; GamesPanel only force-clears the glow. A `useScreen.game` transition handler that calls `releaseAll(owner)` for every game owner would make a missed cleanup harmless.
13. **PROPOSED. Koogalien state** (`koogalien/store.ts`, library reader, learn progress) caches per-player data at module level. Not touched (the UX agent is working there); register each in `onProfileChange(fn, name)` when that work lands.
14. Boss mode entry persists `koog.sheet.on = 0` (setSheetOn writes localStorage) and restores on exit; a full reload while in Boss mode loses the kid's choice. Low impact.

## 4. How to use the guards
- New shared singleton: `createSlot(name, clear)` (last owner wins) or `createHolds(name, start, stop, isOn)` (refcount) from `music/owners.ts`; call `releaseAll(owner)` on unmount and in `import.meta.hot.dispose`.
- New dock: add one `registerDock` line in `layout/dockWiring.ts`; give it `group: 'bottom'` if it shares the PLAY display bottom.
- New per-player module: use `pload/psave`, and `onProfileChange(reload, 'moduleName')` OUTSIDE any `if (import.meta.hot)` block. `check:state` fails if a module that caches per-player data does neither.
- New localStorage key: per kid unless it is a device setting; add device settings to DEVICE_KEYS with a reason.
- Never call `startMaster/stopMaster` from a game or engine: use `acquireClock/releaseClock`.
