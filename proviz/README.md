# KOOG Pro Viz

The visual desk in the KOOG desktop edition. It follows the Visionboard performance protocol and keeps its own session at `~/Library/Application Support/KOOG Pro Viz/`. OSC addresses stay `/visionboard/…`, the paths the protocol's factory checks and smoke packet use. The process name is `ProViz`. UDP 8000 and Art-Net UDP 6454 are the protocol ports, so one desk holds each port.

Native macOS visual performance desk for the Numark Mixtrack Go. Plug the controller in (USB or Bluetooth MIDI) and the factory map drives the picture. Extra mappings, OSC, audio bands, and internal modulators sit on top of that.

Requires macOS 14 or later. The performer guide is the body of this file. **[For the next agent](#for-the-next-agent)** is the source map: file tree, frame path, uniform layout, and the rules that keep the factory rig working.

## Build

```bash
swift test
scripts/build-app.sh
open build/ProViz.app
```

`swift test` checks the factory rig without opening MIDI, the microphone, or OSC. The `.app` bundle is what macOS uses for the microphone, camera, and Bluetooth permission prompts. Screen capture asks for screen-recording permission in System Settings. Quit Serato DJ Lite before launching, or Serato keeps the Mixtrack port.

A binary also accepts `--self-test` and prints `KOOG Pro Viz self-test passed` or the failing checks.

## What the Go does

Channels are 0-based. Deck B is the same control on the next channel. Pads use channels 4 and 5.

| Control | Address | Picture |
| --- | --- | --- |
| Play | note ch 0/1, note 0 | Start or stop that deck. Shift+Play restarts it. |
| Cue | note ch 0/1, note 1 | Reset phase. Shift+Cue also stops. |
| Sync | note ch 0/1, note 2 | Lock phase to the clock. Shift+Sync returns speed to the center. |
| Mode | note ch 4/5, note 0 | Short press cycles the pad page. Hold it for shift. |
| Pads 1–4 | note ch 4/5, notes 20–23 | See pad pages below. |
| Jog | CC ch 0/1, CC 6 | Scrub phase. Relative: 1–63 forward, 65–127 backward. |
| Pitch | CC ch 0/1, CC 9 + CC 41 | Deck speed. 14-bit. Center is normal speed. |
| Filter | CC ch 0/1, CC 22 | Hue. |
| Level | CC ch 0/1, CC 26 | Opacity. |
| Crossfader | CC ch 15, CC 8 | Wipe from deck A to deck B. |
| Cue level | CC ch 15, CC 10 | Preview zoom. |
| Main | CC ch 15, CC 12 | Brightness. Inferred; right-click Relearn if it is the wrong knob. |
| Browse | CC ch 15, CC 0 | Step the media bin. Inferred relative encoder. |

Pitch is inferred as one 14-bit fader. An earlier calibrator split CC 9 and CC 41 into volume and tempo because they always move together. Filter and level were learned as the two 7-bit knobs. Controls marked **check** on the hardware panel were inferred. Right-click one and choose Relearn, then move the real control.

Play, cue, and sync light the matching pad LEDs (note-on, same note, velocity 127 or 0) when a destination named like the Mixtrack Go is connected. On connect, KOOG Pro Viz sends note-offs on channels 0, 1, 4, 5, and 15 so the unit leaves its idle light show.

### Pad pages

Mode cycles Cue, Loop, FX, Sampler, Stems.

- **Cue.** Pads set hue (four colors) and flash the deck.
- **Loop.** Pads set warp.
- **FX.** Each pad pushes warp up and flashes.
- **Sampler.** Pads pick Rings, Grid, Stems, or Kaleido. Scan is the fifth composition; reach it from the media bin or the browse encoder.
- **Stems.** Pad 1 follows bass, 2 mids, 3 treble, 4 all three. The audio amount on the layer scales how hard the band drives the shader.

### Keys

Space plays deck A. Return plays deck B. 1–4 fire deck A’s pads. F toggles Fade FX, which makes the crossfader also set warp on the outgoing deck. T taps tempo. B toggles the master blackout. Left and right nudge the crossfader. Command-S saves the current preset. Keys are ignored while a text field is focused.

## Picture

Eight layers. Deck A and deck B stay the Mixtrack decks and wipe across the main canvas with the crossfader. Layers 3–8 start hidden (opacity 0). Add layer on the layers panel raises the count and brings the next one in at 0.85 opacity. Remove layer stops at two.

The layers panel is a stack, top row in front. Each row has an eye, a lock, a name, an opacity slider, and a blend mode. Drag the color swatch to reorder. New layer adds one in front. Duplicate copies the focused layer. Delete removes the focused layer. A lock blocks reorder and delete. The eye hides a layer without moving its opacity slider. Deck A and Deck B cannot be deleted: the Mixtrack crossfader wipes between them as one plate. A layer dragged below that plate sits behind the wipe. On Canvas B and Canvas C every layer, including the decks, stacks with its own blend mode.

Each layer has its own opacity, speed, color, warp, play, shader, stem, audio amount, position, scale, rotation, anchor, crop, feather, fit mode, blend, source, grade, and three effect slots. Fit, fill, and stretch use the clip's aspect. Aspect lock turns stretch back into fit. A trackpad pinch scales the focused layer. Reverse and the rewind / nudge buttons scratch a movie. Scale, position, and rotation are independent of the master canvas.

Three canvases. Main follows the preview window until you type a pixel size. Canvas B and Canvas C render at their own sizes (default 1280×720, clamped from 160 to 3840). A layer's Canvas menu sends it to one of them. Canvas B and C stay out of the program mix until you raise their mix sliders, which blend with Normal, Add, Multiply, Screen, or Darken. Output opens a window of Canvas B. Next display moves that window onto a second monitor when one is connected. The preview's B / C split shows Canvas B over Canvas C beside the program. Quad shows the program, main, B, and C.

Sources: Shader, Media, Text, Camera, Screen, Feedback, ISF.

Blend modes: Normal, Add, Multiply, Screen, Darken, Lighten, Overlay, Difference, and Exclusion. On the main canvas, Deck A and Deck B stay a crossfade wipe, including the Fade FX edge. Their blend mode is used when they are sent to Canvas B or Canvas C.

Effects, three per layer, top to bottom: None, Blur, Levels, Pixelate, Ripple, Invert, Core Image color, Core Image blur, Chromatic, Edges, Glitch. Core Image color and blur run on still images. Movies use the GPU versions of the other effects. Grades are five built-in looks (none, warm, cool, bleach, punch), not loaded cube files. Save FX stores the focused layer's effects, grade, fit, and feather under a name. This is three slots, not an open-ended stack.

The canvas overlay switches the preview among Full, B / C, and Quad.

Master controls: brightness, saturation, contrast, blackout, feedback amount, feedback zoom, and keystone. Keystone turns on eight corner sliders and warps the final mix onto those corners. Record writes the live mix to `~/Movies/KOOG-ProViz-<date>.mov` as H.264 at about 15 frames per second. Recording waits for the GPU before each readback, so the picture can hitch while it is on.

Feedback routes the mixed output back in. Turn up the master feedback amount, or set a layer’s source to Feedback.

## Media

Drop movies, images, `.isf` / `.fs` shaders, or text files from the Finder onto the media bin. The clip lands on the current page (four pages) and, for a movie or image, on the focused layer. Movies stream from disk through AVFoundation. They are not loaded whole into RAM. ProRes, Animation, H.264, and HEVC play when macOS can decode them. Alpha comes through as BGRA.

HAP, HAP Alpha, and HAP Q play only when a HAP decoder is already installed. If the file is HAP and this Mac cannot play it, the clip note says so and asks for the codec or a ProRes transcode.

Each clip has a color label (six colors), a page (drag it onto a page button or use the Page menu), and a trigger: loop, restart, or toggle. Trigger learns a MIDI note that is not one of the Mixtrack factory buttons and fires that clip on the focused layer. Swap replaces the file; every layer pointing at that clip follows it. The cell shows size, frame rate, codec, and duration once the file has been inspected. Movies prime the first seconds, then keep streaming from disk. They are not copied whole into RAM. The thumbnail-size slider changes the grid. Camera and Screen in the bin trigger those live sources like a clip. The built-in compositions stay at the top of the bin. Browse on the Go still walks those five shaders.

A text file copies the first 400 characters onto the focused layer and sets its source to Text, drawn with the system font. There is no RSS reader.

## ISF

Drop an ISF file whose header is a `/*{ … }*/` JSON block and whose body is `void main` GLSL. KOOG Pro Viz translates a subset to Metal (up to eight float or long inputs, `vec2`/`vec3`/`vec4` as floats, `gl_FragColor` to the shader output) and recompiles the canvas. Inputs land on `isf.0` through `isf.7`. Texture lookups are not translated, so a shader that samples an image will fail to compile. One ISF is loaded at a time. Any layer can select it as its source. There is no in-app shader editor: edit the file and drop it again.

Quartz Composer (`.qtz`), Flash (`.swf`), and Vuo (`.vuo`) files are refused. This Mac has none of those runtimes linked.

## Map anything else

Right-click a slider, button, or knob. MIDI Learn, OSC Learn, or DMX Learn, then move the control. One hardware control can drive several parameters: learn it onto each one, or attach it from the mapping panel. Each binding has invert, minimum, maximum, and a curve (linear, logarithmic, exponential, or S-curve). Attach can also follow the LFO, bass, mid, treble, the clock, the step sequencer, or a surface fader.

Clear extra mappings removes the learned bindings. The factory Mixtrack routes stay.

The surface panel builds a small control panel: add a slider, a button, or a menu aimed at the selected parameter. That is the custom panel. It is not a freeform layout designer.

Buttons on learned bindings can be momentary, toggle, or a trigger. The stem pads are a radio group: one band is active at a time.

## Modulators

- **Audio.** Microphone or line input. A 1024-point FFT splits it into bass (under 140 Hz), mids (under 2 kHz), and treble. The audio panel draws the live waveform. Right-click a parameter and attach Bass, Mid, or Treble. Follow-the-music sets the clock BPM from bass onsets after four intervals, and pauses that for a few seconds after you edit BPM yourself.
- **LFO.** Sine, cosine, square, triangle, saw, random, or a wave you draw in the modulators panel. Automate any learned parameter by attaching the LFO.
- **Clock.** BPM, run, tap tempo (the Tap button or the T key), and an external MIDI clock toggle. MIDI clock is 24 pulses per quarter note. Sync on a deck locks its phase to the clock. External clock stays off until you turn it on, so it does not fight follow-the-music.
- **Step sequencer.** Eight steps.

## OSC

Listens on UDP port 8000. Sends to `127.0.0.1:9000`.

A message whose address matches a parameter sets it directly. Addresses look like `/visionboard/layerA/opacity` (dots in the parameter id become slashes). OSC Learn stores any other address onto the control you right-clicked. Bundles are read one level deep. Readouts, phase, and hit are not published back out. Integers arrive as 32-bit.

## Routes

Open the Routes panel from the panel menu.

- **Art-Net.** Listens on UDP 6454. DMX Learn binds the channel that moved the most. Incoming values write `channel / 255` into the learned parameter. Art-Net out is off until you turn it on. It then broadcasts universe 0, sixteen channels, about 20 times a second. The first eight are brightness, crossfader, bass, mid, treble, deck A opacity, deck B opacity, and feedback. The rest stay at zero. This is channel data, not a pixel-mapped LED image.
- **Serial.** Open a path such as `/dev/cu.usbmodem` at 9600 8N1. A line that parses as a number drives the selected parameter, or Surface fader A. Values above 1 are divided by 255. The port is not opened at launch.
- **Camera.** The Camera layer button sets the focused layer’s source to a camera macOS already exposes (USB webcam, or a Thunderbolt input after its own driver has published a device). Capture is 1280×720 through AVFoundation. DeckLink and UltraStudio are not linked.
- **Screen.** The Screen layer button captures the main display with ScreenCaptureKit at 960×540. macOS asks for screen-recording permission.
- **Syphon, Spout, and NDI** are not linked. Spout is a Windows protocol. There is no texture or network video in or out. The output window on a second display is the multi-monitor path.

## Layouts

Panels (canvas, layers, media, hardware, monitor, mapping, audio, modulators, surface, presets, routes) can be dragged, resized, closed, and popped into their own windows. The layout is part of the session and of each preset.

Session state, including clips, widgets, text, DMX routes, layer count, and the loaded ISF source, is saved to `~/Library/Application Support/KOOG Pro Viz/session.json`. Presets are JSON files in the `Presets` folder next to it. Older session files that lack those keys still open.

## What this build does not do

- Syphon, Spout, NDI, Flash, Quartz Composer, and Vuo.
- Blackmagic DeckLink and UltraStudio. A camera only appears if AVFoundation already lists it.
- A native HAP decoder. HAP plays only through a codec you install yourself.
- RSS or other network text. Text layers read a local file, 400 characters.
- More than eight layers, three effects on a layer, or three canvases. No layer groups, masks, or adjustment layers.
- Using one layer’s picture as a texture inside another layer’s effect chain. Feedback is the mixed output, not a chosen layer.
- A freeform preview grid. Full, B / C, and quad are the splits.
- Loaded color-lookup files. Grades are the five built-in looks.
- A freeform control-panel designer beyond slider, button, and menu widgets.
- HID gamepads, tablets, and motorized-fader takeover beyond Mixtrack LED feedback.
- Pixel-mapped Art-Net images. Outgoing Art-Net is sixteen DMX channels.

## For the next agent

This is a native Swift 6 Mac app. SwiftUI owns the panels. AppKit owns the windows and the file dialogs. Metal draws the picture. There is no web UI, so browser checks do not apply. Prove a change with `swift test`, a Metal compile of the shader string, `scripts/build-app.sh`, and `--self-test`.

Do not pretend a missing SDK is present. Syphon, Spout, NDI, DeckLink, Quartz Composer, Flash, and Vuo are not linked. HAP plays only when the Mac already has a HAP decoder. Say that in the UI and in this file when you touch those paths.

### File tree

```
proviz/
  Package.swift              SwiftPM. macOS 14. Library, app, tests. No extra linker flags.
  Info.plist                 Bundle id dev.koog.proviz, version 0.1.0. Mic, camera, Bluetooth strings.
  .gitignore                 Ignores .build/, build/, *.app, .DS_Store.
  scripts/build-app.sh       swift build -c release, copy binary + plist into build/ProViz.app, ad-hoc codesign.
  README.md                  Performer guide, then this section.
  Sources/ProVizKit/    Logic the tests import. No SwiftUI, no Metal drawing.
    Signal.swift             Parameters, layer lists, uniform pack, clips, panels, LFO shapes, keystone math.
    Session.swift            The brain. MIDI/OSC ingest, clock, presets, session file, layer stack.
    MixtrackProfile.swift    The 28 factory controls and their addresses.
    MIDI.swift               Parser, packet list, MIDIEngine, isMixtrackGo(name:).
    OSC.swift                OSC codec and UDP engine. In 8000, out 127.0.0.1:9000.
    AudioAnalyzer.swift      AVAudioEngine tap plus a 1024-point vDSP FFT.
    ArtNet.swift             ArtDmx encode/decode and the UDP engine on port 6454.
    ISF.swift                ISF JSON header + GLSL subset translated to Metal.
    SerialLink.swift         9600 8N1. Not opened at launch.
    RigCheck.swift           Factory assertions. Session(connectHardware: false).
  Sources/ProViz/       The executable. Imports ProVizKit.
    AppMain.swift            --self-test or ProVizApp. Window 1360×760, minimum 1100×680.
    RootView.swift           Panel desktop, keyboard monitor, popped-out windows.
    Panels.swift             Panel bodies: canvas, layers, hardware, mapping, audio, modulators, surface, presets.
    StageUI.swift            Media bin, routes, LFO draw pad, canvas size desk, output strip.
    MetalCanvas.swift        Shader string, MTKView, three-pass draw, output window.
    Playback.swift           Movies, stills, text, camera, screen, recording.
    HardwareMirror.swift     On-screen Mixtrack. Jog drag uses @State so it does not flood.
    Theme.swift              Colors and the right-click Learn / Attach menu.
  Tests/ProVizTests/
    RigTests.swift           One XCTest that calls RigCheck.failures().
  build/ProViz.app      The signed bundle. Produced by the script. Not in git.
```

`ProVizKit` is the product tests can see. The shader, the view, and playback live in the app target. A kit test cannot compile `CanvasShader`. Extract that string and compile it with `xcrun -sdk macosx metal` when you change it.

Outside this repo, two files explain the factory map and should not be treated as equal:

- `../../mixtrack-go-observed-midi.json` is an unlabeled capture. The profile follows it.
- `../../mixtrack-academy/data/mapping.json` splits CC 9 and CC 41 into volume and tempo. That split is a calibrator bug. The Go sends them as one 14-bit pitch fader. Filter is CC 22. Level is CC 26.

### How a frame is built

`RootView` starts `Session.start()` from `.task`. The order in `start()` matters. MIDI, OSC, Art-Net, and serial start first. Then a `Task` runs `tick` about every 16 ms. Only after that task exists does `await audio?.start()` run. `AVCaptureDevice.requestAccess` can sit on a permission dialog. If that await is in front of the tick, OSC and the session save never run.

`tick` advances time, the LFO, the step sequencer, the clock, and follow-the-music. It copies meters and the waveform onto `Session.meters` and `Session.waveform` about ten times a second. It polls OSC and Art-Net, publishes OSC, and saves when `dirty && saveAccum > 1.5`.

`MetalCanvas.Coordinator.draw` asks `PlaybackDeck.sync` for eight layer textures, packs uniforms, and encodes three passes into one command buffer:

1. `fs_canvas` draws each active canvas into its own texture. Pass index is uniform slot 35, overwritten per pass. Canvas B and C are skipped unless their mix is up, a layer targets them, or the output window is showing that canvas.
2. `fs_present` samples the three canvas textures plus the eight layer textures and the feedback texture, and writes the program into `colorTarget`.
3. A blit copies `colorTarget` into the preview drawable and into the other feedback texture. If the output window is open, `fs_blit` draws the chosen canvas into that window's drawable in the same command buffer.

`buffer.waitUntilCompleted()` runs only while `session.recording` is true. Recording is H.264 at about 15 fps to `~/Movies/KOOG-ProViz-<date>.mov`, with colons turned into dashes. Leaving the wait on all the time hitches the picture.

Feedback is a ping-pong of the mixed program, not of one chosen layer. Texture slots in `fs_present` are 0–7 layers, 8 feedback, 9–11 canvases.

There is no `fs_main`. The shader is the Swift string `CanvasShader.template` in `MetalCanvas.swift`, with `/*ISF*/` replaced by the loaded ISF or a small default `isf_main`. `VB_HEADER`, `VB_STRIDE`, and `VB_BLENDS` in that string must match `UniformPack` and `LayerStack.blendStops`.

### Uniform layout

`UniformPack.header` is 48. `UniformPack.stride` is 36. `count` is `48 + 36 * 8` = 336. `RigCheck` asserts those numbers. An old 40/20 layout is gone. If you add a float, you add it in both the pack and the shader, or you use a spare that is already reserved.

Header:

| Slot | Value |
| --- | --- |
| 0 | Time, seconds |
| 1 | Crossfader |
| 2 | Brightness |
| 3–6 | Bass, mid, treble, level |
| 7 | Aspect of the pass |
| 8 | Preview zoom |
| 9 | Fade FX |
| 10 | Blackout |
| 11 | Saturation. The shader multiplies by 2 |
| 12 | Contrast, mixed from 0.55 to 1.7 |
| 13 | Preview split. 0 full, 1 program beside B over C, else quad |
| 14–15 | Feedback amount (clamped to 0.92) and zoom |
| 16 | Keystone on |
| 17–24 | Four corners, TL TR BR BL, default unit square |
| 25–26 | Pass width and height |
| 27–34 | `isf.0` … `isf.7` |
| 35 | Canvas index. Pack writes 0. Draw overwrites it |
| 36–39 | Canvas B mix, B blend, C mix, C blend |
| 40–47 | Stack order, back to front. 8 means an empty step |

Per layer, at `48 + index * 36`:

| Slot | Value | Identity |
| --- | --- | --- |
| 0 | Opacity. Forced to 0 when Show is off | Decks default 0.85, other slots 0 |
| 1 | Speed | 0.5 is 1× for movies (`0.15 + speed * 1.7`) |
| 2 | Hue | 0.5 |
| 3 | Warp | 0.15 |
| 4 | Phase | Live. Not stored in `values` |
| 5 | Running | |
| 6 | Hit | Live |
| 7 | Shader index as a unit | Deck B defaults to 0.25 (Grid) |
| 8 | Stem | 3 means all bands |
| 9 | Audio amount | 0.7 |
| 10–11 | X, Y | 0.5 is the center |
| 12 | Scale | 0.5 fills the frame. Zoom is `unit * 2` |
| 13 | Rotation | 0.5 is 0° |
| 14 | Blend, as a unit on the current grid | |
| 15 | Source | |
| 16–19 | Effect 1 and 2, plus amounts | Amount default 0.35 |
| 20 | Fit. 0 fit, 1 fill, 2 stretch | |
| 21–22 | Anchor | 0.5, 0.5 matches the old placement |
| 23–26 | Crop left, right, top, bottom | |
| 27 | Feather | |
| 28 | Aspect lock. Turns stretch back into fit | |
| 29 | Canvas target. 0 main, 1 B, 2 C | |
| 30–31 | Effect 3 and amount | |
| 32 | Source aspect, from `session.sourceAspect`, not a slider | |
| 33 | Grade | |
| 34–35 | Spare. Leave them 0 unless you claim them in both places | |

Choice controls are units. `LayerStack.choice` maps a unit to an index with `round(unit * (count - 1))`. The shader must use the same denominator. Sources use `* 6` (7 names). Effects use `* 10` (11 names). Fits use `* 2`. Canvases use `* 2`. Grades use `* 4`. Blends use `* VB_BLENDS` with `VB_BLENDS` = 8.

`shade` returns nothing when opacity is about 0, when the layer's canvas is not the current pass, or when the placed UV is outside 0–1. A non-default scale crops the layer to a quad. Default scale 0.5 must still fill the frame.

On the main canvas, Deck A and Deck B are one crossfade plate, drawn at the stack position of whichever deck is further back. The wipe ignores their blend modes. If the plate is the bottom of the stack it replaces the picture, so the default 0.85 deck opacity still looks solid. If a layer is behind the plate, the plate covers by its opacity and that layer shows through. Hiding one deck drops it out of the wipe. Canvas B and C stack every layer, decks included, with blend modes. Finish then mixes the three canvases, feedback, saturation, contrast, blackout, brightness, vignette, and keystone.

### Parameters, observation, and the stack

Every slider is a `ParamSpec` in `ParamCatalog`. Ids look like `layerA.opacity` or `master.brightness`. Almost every value lives in `0...1` so MIDI, OSC, and DMX share one range. Toggles are 0 or 1. `clock.bpm` at 0.5 is 120 (`40 + unit * 160`).

`Session` is `@MainActor` and `@Observable`. Hardware callbacks are not on that actor. `MIDIEngine`, `OSCEngine`, `ArtNetEngine`, `AudioAnalyzer`, and `SerialLink` are `@unchecked Sendable`. They hop back with `Task { @MainActor in }`. `PlaybackDeck`, `PerformanceRecorder`, and `MetalCanvas.Coordinator` are `@MainActor`. `CameraGrab` and `ScreenGrab` are `@unchecked Sendable`.

Volatile animation must stay out of `values`. `Session.volatile` is `audio.*`, anything ending in `.phase` or `.hit`, `lfo.output`, `seq.output`, and `clock.phase`. Those live in `@ObservationIgnored live`. Writing them into `values` redraws every panel on every frame and pegs the CPU. `sourceAspect`, playback `nudges`, and `primePaths` are also `@ObservationIgnored`.

Layer identity is the prefix, not the row. Prefixes are `layerA`, `layerB`, `slot2` … `slot7`. Focus tags are `A`, `B`, `2` … `7`. MIDI for the Go always writes `layerA` and `layerB`. Do not swap parameter dictionaries between slots to reorder, or a learned binding follows the wrong picture.

`layerOrder` is back to front. The last entry is the top row. `placeLayer(_:atFrontRank:)` uses rank 0 as the front. `layerCount` is `layerOrder.count`. Decks 0 and 1 are always in the order and cannot be deleted. New and Duplicate append, which puts the layer in front. Delete closes the focused slot and sets its opacity to 0. The prefix stays free for the next New. Show is the toggle `prefix.visible`. The pack zeros opacity when it is off and leaves the opacity slider alone. Lock is `layerLocked`, not a parameter. Names are `layerNames`.

Blend values are units on a grid of `LayerStack.blendStops` (8). Files saved when there were five modes have `blendScale` missing, which decodes as `legacyBlendStops` (4). `apply` remaps only the blend keys in that document. A file that already stores `blendScale == 8` is left alone. If you add a mode, bump the Swift list, `blendStops`, `VB_BLENDS`, and `blendOver` together, and keep the old indices stable so the migrator still means Darken when it sees a 1.0 from the five-stop grid.

### MIDI and the factory map

Channels are 0-based. Deck B is deck A plus one. Pads are channels 4 and 5. Globals are channel 15. The profile has 28 controls. `RigCheck` walks them. Keep those asserts green.

Relative jog and browse: 1…63 is positive, 65…127 is negative, and 127 is −1. Pitch is 14-bit, CC n MSB plus CC n+32 LSB. Factory routes and `UserBinding`s both write. The last writer wins. Hardware buttons toggle on the rising edge. Shift is Mode held longer than 0.45 s. A short Mode press cycles the pad page. It does not jump to page 5.

LEDs are note-on, same note, velocity 127 or 0. They go only to a destination whose name contains “mixtrack” and “go”, or “numark” and “mixtrack”. On connect, sweep note-offs on channels 0, 1, 4, 5, and 15, then refresh. Connect every MIDI source. The factory map matches the address, not the device name.

`MIDIPacketList` is `pack(4)`. On ARM, `MIDIPacketNext` 4-byte-aligns and returns `UnsafeMutablePointer`, not Optional. Call it. The packet-list test allocates 512 bytes at alignment 16.

Clip triggers listen in `applyLooseMIDI`, not in the factory switch. A factory note must not also fire a clip. Learn stores `channel:note` on the clip and clears that note from the other clips.

### OSC, DMX, serial, sound

OSC in is UDP 8000. Out is `127.0.0.1:9000`. An address `/visionboard/layerA/opacity` sets that parameter. Dots in the id become slashes. Integers on the wire are `Int32`. Bundles are one level deep. Readouts, phase, and hit are not published.

Art-Net is UDP 6454, OpDmx. Learn binds the channel that moved the most. Out is off until `master.artnetOut` is on, then about 20 Hz, universe 0, 16 channels. The first eight are brightness, crossfader, bass, mid, treble, deck A opacity, deck B opacity, and feedback.

Serial defaults to `/dev/cu.usbmodem`, 9600 8N1, and stays closed until the Routes panel opens it. A numeric line writes the selected parameter, or `surface.a`. Values above 1 are divided by 255.

The FFT is `vDSP.FFT`, log2n 10, 1024 samples, Hann, run inside `pull()` on the main actor, not in the audio callback. Bands are 20–140 Hz, 140–2000 Hz, and 2000 Hz to 0.45× sample rate. Energy is normalized by the sum of the bands and scaled by the time-domain mean square so the old onset test still works: bass envelope above 0.0008, above 1.8× the previous bass, and above the mids. The waveform on screen is time-domain. Follow-the-music needs four bass intervals, then pauses for 8 seconds after a manual BPM edit.

The LFO shape unit maps with `index / (allCases.count - 1)`, which is 6. Shapes are sine, square, triangle, saw, random, cosine, custom. Custom samples `session.lfoTable` (32 sine samples until the user draws). `tick` must pass that table into `sample(phase:table:)`. Drawing switches the shape to custom.

### Pictures and files

Movies stream. `AVPlayer` uses `preferredForwardBufferDuration` of 1.5 seconds and prerolls. “Preload” is that preroll. Up to six muted players sit in `PlaybackDeck.prime`. Whole files are not copied into RAM. ProRes, H.264, HEVC, and Animation go through AVFoundation. Alpha is BGRA. HAP is detected by fourcc (`Hap1`, `Hap5`, `HapY`, `HapM`, `HapA`, `Hap7`) via `MovieCodec`. Playback still needs a system decoder.

Core Image color and blur are effect indices 6 and 7, and they run on stills. Movies take the GPU versions of the other effects.

`importFile` refuses `.qtz`, `.swf`, and `.vuo` with an honest note and does not assign them. ISF is one shader at a time, no texture lookups, no in-app editor. Dropping a new file recompiles when `isfGeneration` changes. Text is the first 400 characters. There is no RSS.

`MediaClip` has a custom `init(from:)` and `encode(to:)` so a clip saved before `detail` and `triggerNote` still decodes. Inspection stores `"\(id)|\(path)"` and writes size, frame rate, fourcc, and duration.

Camera and screen are ordinary sources (indices 3 and 4). Capture is whatever AVFoundation already lists, at 1280×720 for the camera and 960×540 for the main display. A new ad-hoc signature is a new TCC identity, so the mic prompt can return. Camera usage is in `Info.plist`. Screen recording has no reliable plist key.

`OutputBoard` is an app-target window titled “Canvas output”. It starts paused, on canvas B, and does not move itself to a second display. `sendToNextDisplay()` uses `NSScreen.screens.dropFirst()` or reports that only one display is connected.

### Persistence

`~/Library/Application Support/KOOG Pro Viz/session.json` is the live session. Presets are `Presets/*.json` beside it. Both are `PresetDocument` shaped data. `SessionFile` is the private on-disk twin.

Codable defaults for canvas sizes must not call a main-actor static. `Session` is `@MainActor`, so `Session.defaultCanvases` cannot be a default argument. The value lives on `CanvasSpec.standard`: main 0×0 (follow the view), B and C 1280×720. Sizes clamp to 0 or 160…3840. `Session.defaultCanvases` is `nonisolated` and points at that array.

Missing keys still decode. `apply` restores canvas sizes only when the array has three entries, the LFO table only when it is non-empty, and FX presets only when the dictionary is non-empty. An empty old preset must not wipe a drawn wave or a saved look. `layerOrder` is accepted when it is a permutation of the open slots and still contains decks 0 and 1. Otherwise it becomes `0..<layerCount`, which matches the old back-to-front picture.

Do not delete or overwrite the KOOG Pro Viz `session.json` except as a stash around a smoke test. Copy it to `/tmp/koog-proviz-session-stash.json`, run the test, quit, and copy it back. A launch rewrites that file with any new keys. This desk leaves `~/Library/Application Support/Visionboard/session.json` untouched. `pgrep -x ProViz` is the process check. The executable name is short enough that `lsof` shows `ProViz`.

An OSC smoke packet is `/visionboard/master/brightness` as a float `0.4`. The saved value comes back as `0.4000000059604645`. Idle CPU for the previous builds sat near 8–13%. A peg near 90% means volatile keys got back into `values`.

`screencapture` of a window failed here without screen-recording permission. Do not grab the whole desktop.

### Where to edit

| Change | Touch |
| --- | --- |
| New slider | `ParamCatalog`, the panel control, and a uniform slot if the shader reads it. Right-click Learn comes from `.mappable` in `Theme.swift`. |
| New blend, source, effect, fit, grade | The `LayerStack` array, the shader denominator, and the branch that interprets the index. Keep old indices. |
| Stack behavior | `layerOrder` / `placeLayer` in `Session.swift`, slots 40–47, and `paintStack` in the shader. |
| Factory control | `MixtrackProfile.swift` and `RigCheck`. Re-run `swift test`. |
| Shader look | `CanvasShader.template`. Compile the extracted string. A Swift build does not compile that string. |
| Movie timing | `Playback.swift`. Rate, reverse, and nudge are not uniforms. |
| New panel | `PanelSpec.kinds`, `defaultLayout`, and `PanelBody` in `Panels.swift`. |

### Checks

```bash
swift test
# Extract CanvasShader.template, replace /*ISF*/, then:
xcrun -sdk macosx metal -c /tmp/proviz.metal -o /tmp/proviz.air
scripts/build-app.sh
.build/release/ProViz --self-test
```

`swift test` and `--self-test` construct `Session(connectHardware: false)`. They do not open MIDI, the microphone, OSC, or the session file. The signed `.app` is what macOS prompts against. Quit Serato DJ Lite before a real launch, or Serato holds the Mixtrack port.

After a green self-test, say what you ran. Do not say the Go, a camera, HAP, Syphon, NDI, or a second display was live-tested unless that hardware was actually in the loop.
