# Visualizers for free play

Goal: a young child bangs on a 37-key velocity-sensitive keyboard (no key lights, built-in speakers). The screen should answer every key press instantly, visibly, and joyfully. Stack: Vite + React + Web MIDI + Web Audio.

Dated 2026-10-27. Versions and licences from `npm view` on that date. Pages I fetched are cited. Everything else is from general knowledge and is marked "(unverified)".

## TL;DR

- Use **raw Canvas 2D** for v1. It needs no dependency and handles a few thousand particles at 60fps on a MacBook. Keep a **renderer interface** so a PixiJS (WebGL) backend can replace it if we outgrow Canvas 2D.
- Draw outside React, in a single `requestAnimationFrame` loop. Note events go from MIDI to a ring buffer to the renderer, and never through React state.
- Colour by pitch class with a fixed rainbow-ish, colour-blind-checked palette. Velocity sets size, speed and particle count.
- Build order: (1) pitch-coloured burst particles, (2) rising bars / piano-roll trails, (3) ripples plus a gentle creature.
- Safety by default: no full-screen flashes, a hard cap of 3 flashes/sec, and a "calm mode" toggle that also follows `prefers-reduced-motion`.

---

## 1. Engine survey

| Option | What it is | Pros | Cons | Fit |
|---|---|---|---|---|
| **Canvas 2D** (built in) | Immediate-mode 2D API | Zero deps; simple; additive blending via `globalCompositeOperation='lighter'`; `OffscreenCanvas` possible | CPU-bound; fill-rate heavy past roughly 5-10k sprites; no shaders | Best v1 |
| **PixiJS 8** | 2D renderer on WebGL/WebGPU, scene graph, `ParticleContainer` | Fast sprite batching (10k+ particles); filters; blend modes | About 400KB+ min (unverified); extra API; more to learn | Best upgrade path |
| **three.js** | 3D engine on WebGL/WebGPU | Powerful: 3D, instancing, post-processing bloom | Heavy (~600KB+ unverified); overkill for 2D | Only if we want 3D scenes |
| **p5.js** | Creative-coding library | Friendly API; huge examples | LGPL-2.1 licence (more to think about); not tuned for perf; its draw loop and instance mode sit awkwardly with React | Prototyping only |
| **Tone.js** | Audio framework, not a renderer | Has `Tone.Draw`, which schedules visuals to match audio time | We already use Web Audio directly; MIDI-triggered notes are "now", so `Tone.Draw` buys little | Skip; the pairing idea is "audio-clock-aligned drawing" |
| **ogl / regl / twgl** | Thin WebGL wrappers | Small, no scene-graph bloat; ideal for full-screen fragment shaders (fluid, aurora, kaleidoscope) | Need GLSL knowledge; you build everything yourself | Optional later for a shader "background" layer |
| **WebGL/WebGPU custom particles** | GPU-instanced quads, or compute shaders | 100k+ particles | Complexity; WebGPU support is uneven (unverified for Safari/older macOS) | Not needed for a 37-key toy |
| **tsParticles** | Configurable particle engine | Presets; confetti and fireworks | Config-driven; less control over per-note mapping; bundle size | Skip |
| **canvas-confetti** | Tiny confetti burst | Trivial to call | Fixed look; its own canvas; it flashes full-screen colour if misused | Skip (we want pitch-coloured bursts) |

Shader notes: a full-screen fragment shader driven by a few uniforms (`uNoteColor[12]`, `uEnergy`, `uTime`) gives fluid, kaleidoscope and aurora looks for very little code. It runs on the GPU, so it costs the main thread almost nothing.

Sources:
- PixiJS docs: https://pixijs.com/8.x/guide (the intro URL I tried returned 404, so the PixiJS claims above are from general knowledge)
- three.js: https://threejs.org
- Tone.Draw: https://tonejs.github.io/docs/ (unverified)
- ogl: https://github.com/oframe/ogl
- regl: https://github.com/regl-project/regl
- twgl: https://twgljs.org

---

## 2. Proven fun visual ideas

### Note-to-colour mapping
- **Simple rainbow-by-pitch-class (recommended):** C=red through to B=violet, a hue wheel over 12 semitones. Octave sets lightness or size: low notes are big, dark and slow; high notes are small, bright and fast. The child learns "same colour = same note family". Tip: an octave leap changes brightness, not hue.
- **Newton's wheel (1704):** maps 7 notes to the spectrum colours (red, orange, yellow, green, blue, indigo, violet). Same family as simple rainbow.
- **Scriabin's circle of fifths mapping:** colour follows the circle of fifths, so related keys get neighbouring colours. Chords look harmonious, but neighbouring semitones get unrelated colours. Less intuitive for a child and not needed.
- **Chromesthesia (synaesthesia):** associations vary between individuals, so no mapping is "correct". Consistency is what matters.
- Avoid colour as the only cue. Pair it with position (x from the key) and shape or size.

### Effects
1. **Velocity-scaled particle bursts:** spawn N = 8 + velocity/4 particles at x = key position. Velocity sets speed, size and life. Soft taps give glitter; hard hits give a fountain.
2. **Synthesia-style bars:** while the key is held, a bar grows upward or downward from the key's x position. On release it floats away and fades. Width is one key's width, height is hold time, and opacity is velocity. This doubles as a piano-roll trail.
3. **Ripples:** expanding rings from the note position, with radius growing at a rate set by velocity. Many overlapping rings look like water.
4. **Creatures / characters:** a blob, cat, or bunny family where each pitch range wakes a different creature. It hops, blinks or squeaks on note-on and changes expression with velocity. High emotional reward for children, and it needs little animation (squash-and-stretch springs).
5. **Chord-shape mandalas:** held notes form a polygon on a 12-slot pitch-class circle, with symmetry (6 or 8 fold) repeated. Chords make distinct shapes, and the child sees "two notes = line, three = triangle".
6. **Piano-roll trails:** a scrolling history of recent notes (x = pitch, y = time), so the child sees the tune they just played. This also feeds the looper, since a loop can be drawn the same way.

Because the keyboard has **no key lights**, an on-screen **mirror keyboard** (37 keys that light with the real ones) helps a lot. It tells the child where their hands are.

Sources:
- Chromesthesia / sound-colour mapping overview: https://en.wikipedia.org/wiki/Chromesthesia
- Scriabin, Newton colour scales: https://en.wikipedia.org/wiki/Color_music
- Synthesia: https://synthesiagame.com

---

## 3. Performance

Targets: 60fps on a MacBook; input to first visible frame under about 20ms.

**Timing and latency**
- The MIDI event `timeStamp` is a `DOMHighResTimeStamp` in the same time base as `performance.now()`. So `performance.now() - event.timeStamp` measures how long the event waited before your handler ran. Source: Web MIDI spec https://webaudio.github.io/web-midi-api/ (MDN's MIDIMessageEvent page does not cover this; the time-base claim is from the spec and general knowledge).
- Handle the MIDI event in the handler only to push `{note, vel, t}` into a pre-allocated ring buffer. Do the drawing in the rAF loop and spawn visuals from the buffer.
- Audio triggers directly in the MIDI handler (not via rAF), so sound is never delayed by drawing.
- One rAF loop owns all rendering. Use the rAF timestamp for `dt`, clamp `dt` (for example to 50ms), and never stack `setInterval` timers.

**React**
- No React state per note. React renders UI chrome only (settings, toggles).
- Create the `<canvas>` once. A `useEffect` initialises the renderer and stores it in a ref or module singleton. Notes reach it through a plain-JS event bus or zustand's `subscribe` (which fires outside render). zustand is already a dependency.
- Keep note-on and note-off state (which keys are down) in a mutable typed array (`Uint8Array(128)`), not in React.

**Canvas habits**
- Pool particles in struct-of-arrays typed arrays (`Float32Array`) with a fixed max (for example 4096). Do not allocate in the loop; this avoids GC hiccups.
- Cap `devicePixelRatio` at 2 (`Math.min(devicePixelRatio, 2)`), and drop to 1 if the frame time degrades. Retina fill-rate is the usual first bottleneck.
- Pre-render glow sprites to an offscreen canvas once and `drawImage` them, instead of per-frame `shadowBlur` or gradients (both are slow).
- Use `globalCompositeOperation = 'lighter'` for glow. Batch by colour where possible.
- Resize with a `ResizeObserver`, not on every frame.
- Adaptive quality: track the average frame time; if it exceeds about 18ms, lower the particle cap or DPR.
- `OffscreenCanvas` plus a worker moves rendering off the main thread. It is supported in current Safari, Chrome and Firefox (unverified for the oldest macOS). Worth it only if main-thread jank shows up. The cost is postMessage latency for note events and a more complex build. Defer.
- Pause the loop when `document.hidden`.

Sources:
- https://webaudio.github.io/web-midi-api/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas

---

## 4. Accessibility and safety

Children are at higher risk from flashing, and this app responds directly to a banging toddler, so design as if the worst case will happen.

**WCAG 2.3.1 Three Flashes or Below Threshold (Level A)** (fetched: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- Pass if there are at most **3 general flashes and/or 3 red flashes in any one-second period**, OR the combined flashing area is small: at most 0.006 steradians within any 10-degree visual field (about 25% of that field, roughly 341x256 CSS px at typical viewing).
- **General flash:** a pair of opposing luminance changes of 10% or more of max luminance, where the darker state is below 0.80 relative luminance.
- **Red flash:** a pair of opposing transitions involving saturated red (R/(R+G+B) >= 0.8). Red is held to the stricter standard, so avoid strobing saturated red.
- Fine, balanced patterns (squares under 0.1 degree) are exempt, but do not rely on that.
- WCAG 2.3.2 (AAA, Three Flashes) has no area exception; aim for it in spirit.

**Design rules for us**
- A child can hit 10 keys a second. Therefore:
  - No full-screen or large-area flash on note-on. Effects stay local (small bursts, rings, creatures).
  - Use **fades, not flashes**: attack of 60-100ms and decay of 300ms or more. Smooth envelopes lower the luminance-transition rate.
  - A global **flash limiter**: track a rolling 1-second window of the total frame luminance delta, and if the screen has had 3 big transitions, damp new effects' intensity.
  - Dark background (for example near-black blue), no white backgrounds. Keep overall luminance changes small, with additive glow capped.
  - No saturated red bursts above the area limit. Use a warm orange or pink instead of pure red in the palette.
  - No rapid camera shake or large zooms.
- **Reduced motion:** read `matchMedia('(prefers-reduced-motion: reduce)')` (Baseline, widely available; MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). When on: fewer and slower particles, no shake or parallax, no spinning mandalas, gentle fades only. Listen for `change`.
- **Calm-mode toggle:** a visible, parent-reachable setting (not a hidden menu) that forces the reduced profile regardless of OS setting. Persist it in `localStorage`. Default: follow OS preference, with a parent choice to override.
- **Colour-blind safety:** about 8% of boys have a colour-vision deficiency. Use a palette that stays distinguishable, such as Okabe-Ito (https://jfly.uni-koeln.de/color/), and add a second cue (position, shape or size, octave-linked brightness). Offer an alternate palette switch. Check with a simulator (unverified tooling choice).
- **Contrast:** keep key labels and UI chrome at WCAG AA contrast against the dark background.
- Add `aria-hidden` to the decorative canvas; keep real controls in normal DOM.
- **Test:** use the free PEAT tool (Harding test; https://trace.umd.edu/peat/, unverified current availability) or record the canvas and count luminance transitions by script.

---

## 5. Library table

Versions and licences from `npm view` on 2026-10-27.

| Library | Version | Licence | Notes |
|---|---|---|---|
| pixi.js | 8.22.0 | MIT | 2D WebGL/WebGPU; best upgrade path |
| three | 0.186.1 | MIT | 3D; overkill |
| p5 | 2.3.4 | LGPL-2.1 | Prototyping; licence needs care for bundling |
| tone | 15.1.22 | MIT | Audio; `Tone.Draw` only |
| ogl | 1.0.11 | Unlicense | Tiny WebGL; shader layers |
| regl | 2.1.1 | MIT | Functional WebGL |
| twgl.js | 7.0.0 | MIT | WebGL helpers |
| tsparticles | 4.5.0 | MIT | Config-driven particles |
| @tsparticles/engine | 4.5.0 | MIT | Core of tsparticles |
| canvas-confetti | 1.9.4 | ISC | Fixed confetti only |
| gsap | 3.15.0 | Custom "Standard no charge" licence (https://gsap.com/standard-license) | Tweening; licence restrictions, so avoid |

Current repo deps (`package.json`): react 19.3.1, react-dom, zustand 5.0.16, Vite 8.3.5, TypeScript 7.0.2. No visual library yet.

---

## 6. Recommendation

**Start with raw Canvas 2D**, no new dependency. Our worst case is a few thousand small glowing sprites, which Canvas 2D handles at 60fps with pooling and prerendered glow sprites. Hide it behind a small `Renderer` interface so that, if profiling shows trouble, PixiJS 8 (MIT, `ParticleContainer`) replaces the backend without touching effects logic. Add an `ogl` shader background later as an optional layer. Skip p5 (LGPL, React friction), three.js (3D overkill), gsap (licence) and Tone.js (we already have Web Audio).

### Suggested module layout

```
src/visuals/
  VisualizerCanvas.tsx     // React shell: mounts <canvas> once, ResizeObserver, passes ref; no per-note state
  engine.ts                // rAF loop, dt clamp, DPR cap, pause on hidden, adaptive quality
  eventBus.ts              // noteOn/noteOff(note, vel, timeStamp) -> ring buffer; fed by the MIDI layer
  palette.ts               // pitchClass -> colour; default + colour-blind palette; octave -> lightness
  safety.ts                // calm mode + prefers-reduced-motion + rolling flash limiter; exposes intensity scale 0..1
  pool.ts                  // typed-array particle pool
  effects/
    Effect.ts              // interface: onNoteOn, onNoteOff, update(dt), draw(ctx)
    burst.ts               // velocity-scaled particle burst
    bars.ts                // rising/falling bars and piano-roll trails
    ripples.ts             // expanding rings
    creature.ts            // later: bunny/blob reacting to notes
  MirrorKeyboard.tsx       // optional DOM/canvas strip showing the 37 keys lit
```

Rules: effects never import React; `safety.ts` scales every effect's intensity; each effect is toggleable from a small settings store (zustand).

### First three effects, in order

1. **Pitch-coloured velocity bursts** (`burst.ts` + `palette.ts` + pool + engine). The fastest route to "it reacts to me". It forces us to get the plumbing right (event bus, rAF, pool, DPR cap) and sets the safety limiter from day one.
2. **Rising bars / piano-roll trails** (`bars.ts`). It shows note length and gives the child a visible tune history. It also reuses the same x-per-key mapping and gives a base for the looper display.
3. **Ripples, then a gentle creature** (`ripples.ts`, then `creature.ts`). Ripples are cheap and soothing, so they make a good calm-mode default. A creature adds personality once the base is stable.

### Next checks
- Measure `performance.now() - event.timeStamp` on a real USB-MIDI keyboard to find the actual input latency budget.
- Run a flash-count test on a recording of a mashing child (or a script that hits all 37 keys at 10Hz).
- Test with a colour-vision-deficiency simulator on the default palette.
