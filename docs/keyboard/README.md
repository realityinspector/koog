# Connecting a USB-MIDI keyboard

Koog works with any class-compliant USB-MIDI keyboard (no driver needed).

1. Plug the keyboard in with a **data** USB cable. Some USB-C cables only charge.
2. Open Koog in Chrome or Edge. Web MIDI only works in Chromium browsers, on `localhost` or HTTPS.
3. Click **Allow** when the browser asks for MIDI access.
4. The MIDI panel (Dad mode) shows the port name. Many small keyboards call themselves just `USB MIDI`. Koog prefers that name and falls back to the first input it finds.

## Pre-flight on macOS

`npm run preflight` lists CoreMIDI ports with a small Swift script, so it needs Xcode Command Line Tools. To require a specific port name:

    KOOG_MIDI_NAME="My Keyboard" npm run preflight

## Built-in speakers

If your keyboard has its own speakers, turn its volume down or leave the app's synth off. Otherwise you hear every note twice, slightly out of sync.

## Measure your keyboard

Dad mode → Test rig → MIDI monitor shows raw messages: channel, velocity range, sustain pedal CC, and the lowest and highest notes. **Copy results** puts them on the clipboard.
