# Connecting a USB-MIDI keyboard

Koog works with any class-compliant USB-MIDI keyboard (no driver needed).

1. Plug the keyboard in with a **data** USB cable. Some USB-C cables only charge.
2. Open Koog in Chrome or Edge. Web MIDI only works in Chromium browsers, on `localhost` or HTTPS.
3. Click **Allow** when the browser asks for MIDI access.
4. The MIDI panel (Dad mode) shows the port name. Many small keyboards call themselves just `USB MIDI`. Koog prefers that name and falls back to the first input it finds.

## Bluetooth keyboards

Chrome on macOS sees Bluetooth (BLE) MIDI devices through CoreMIDI once they are paired at the system level:

1. Put the keyboard in pairing mode.
2. Open **Audio MIDI Setup**, then **Window > Show MIDI Studio**, then click the **Bluetooth** icon.
3. Click **Connect** next to the keyboard. It now shows up as a MIDI device.
4. Reload Koog (or just wait: devices appearing are picked up live). The Devices chip shows it.

Latency: Bluetooth MIDI adds a connection interval, typically 7.5 to 15 ms, and a little jitter on top. Keep the keyboard close and in line of sight, and keep other Bluetooth gear (headphones, mice) away from it. A USB-C cable is the lowest and steadiest option (about 1 ms). Hot-plug is live: plugging in, unplugging or re-pairing re-attaches without a page refresh.

## Speed notes (for tinkerers)

Notes sound first, then the screen catches up: the synth starts before the judge, visuals, games and looper hear about the note. A message that carries several MIDI events, or uses running status, is split into separate notes; a note-on with velocity 0 counts as a note-off. Held keys and the foot pedal ignore key repeat.

## Pre-flight on macOS

`npm run preflight` lists CoreMIDI ports with a small Swift script, so it needs Xcode Command Line Tools. To require a specific port name:

    KOOG_MIDI_NAME="My Keyboard" npm run preflight

## Built-in speakers

If your keyboard has its own speakers, turn its volume down or leave the app's synth off. Otherwise you hear every note twice, slightly out of sync.

## Measure your keyboard

Dad mode → Test rig → MIDI monitor shows raw messages: channel, velocity range, sustain pedal CC, and the lowest and highest notes. **Copy results** puts them on the clipboard.

## USB, cables, hubs and delay (what a web page can and cannot do)

Full write-up with sources: `USB_MIDI.md` in the usb-pedals scratch notes (summary here).

- **USB-C is a plug, not a speed.** A MIDI keyboard or foot pedal talks at most every 1 ms (full speed) or 0.125 ms (high speed); the polling wait is 0 to 1 ms. A USB-C to USB-A dongle changes nothing. What matters is the number of hops and what else shares them.
- **Plug straight in.** Put the keyboard and pedal directly into the computer, or into a *powered* hub that has no webcam, disk or audio interface on it. Cheap or bus-powered hubs add timing wobble (jitter), not a fixed delay. The Devices menu > Timing shows "Input wobble" (typical and worst delay between the message arriving in the browser and Koog seeing it); a worst case far above about 10 ms points at a busy hub, Bluetooth or a busy computer.
- **Foot switches that type a key** are USB keyboards (HID): they poll every 1 to 10 ms and Koog learns the key. A switch that sends a mouse click needs its own setup app to send a key.
- **Bluetooth MIDI** adds 7 to 50 ms and wobbles (the computer picks the connection interval). **5-pin MIDI cables** take about 1 ms per 3-byte message, so a 10-note chord spreads over about 10 ms.
- **Bluetooth headphones add 150 to 300 ms to the SOUND.** Koog shows a tip when the sound card reports a large output delay or the output looks wireless. Use the computer speakers or wired headphones for playing.
- **Timing offset** (Devices > Timing) moves when a device's notes COUNT for scoring and recording. It never changes the sound. The tap test measures your average tap against ten clicks, and "Use as timing offset" applies it to that device.
- A web page cannot choose the USB polling rate, change a hub, set the OS audio buffer, or see whether a cable is USB-C. MIDI 2.0 keyboards arrive as ordinary MIDI 1.0 bytes in Web MIDI.

### Pedals
Foot pedal actions (Devices menu): Automatic, Sustain, Loop station, Beat, Kick, **Soft**, **Sostenuto**, **Pedalboard stomp**, Off. A keyboard pedal sends sustain (CC 64; below 64 is a half pedal), sostenuto (CC 66), soft (CC 67), expression (CC 11) and volume (CC 7) with no setup. See the Pedalboard (README) for the effect pedals.
