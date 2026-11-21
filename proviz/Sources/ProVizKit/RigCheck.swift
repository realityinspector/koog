import CoreMIDI
import Foundation
import Metal

@MainActor
public enum RigCheck {
    public static func failures() -> [String] {
        var failures: [String] = []
        func check(_ condition: Bool, _ message: String) {
            if !condition { failures.append(message) }
        }

        check(Curve.logarithmic.apply(0) == 0, "log curve starts at 0")
        check(abs(Curve.logarithmic.apply(1) - 1) < 0.0001, "log curve ends at 1")
        check(abs(Curve.exponential.apply(0)) < 0.0001, "exp curve starts at 0")
        check(Tuning(invert: true).shape(0.25) == 0.75, "invert flips the range")
        check(signedMIDIStep(1) == 1 && signedMIDIStep(127) == -1, "jog steps")
        check(UniformPack.pack(values: [:], time: 0, aspect: 1).count == UniformPack.count, "uniform pack size")
        check(ParamCatalog.bpm(from: ParamCatalog.unit(fromBPM: 120)) == 120, "120 BPM round trip")

        let running = MIDIParser.messages(from: [0x90, 0x00, 0x7F, 0x00, 0x00])
        check(running.count == 2, "running status produced \(running.count) messages")
        if case let .note(channel, note, _, on) = running.first {
            check(channel == 0 && note == 0 && on, "running status note")
        } else {
            check(false, "running status was not a note")
        }

        let raw = UnsafeMutableRawPointer.allocate(byteCount: 512, alignment: 16)
        defer { raw.deallocate() }
        let list = raw.assumingMemoryBound(to: MIDIPacketList.self)
        var packet = MIDIPacketListInit(list)
        let first: [UInt8] = [0x90, 0x00, 0x7F]
        let second: [UInt8] = [0xBF, 0x08, 0x7F]
        packet = first.withUnsafeBufferPointer { ptr in
            MIDIPacketListAdd(list, 512, packet, 0, 3, ptr.baseAddress!)
        }
        packet = second.withUnsafeBufferPointer { ptr in
            MIDIPacketListAdd(list, 512, packet, 0, 3, ptr.baseAddress!)
        }
        _ = packet
        let packets = MIDIParser.messages(in: list)
        check(packets.count == 2, "packet list produced \(packets.count) messages")
        if packets.count == 2 {
            if case let .note(channel, note, velocity, on) = packets[0] {
                check(channel == 0 && note == 0 && velocity == 127 && on, "packet note \(packets[0])")
            } else { check(false, "first packet \(packets[0])") }
            if case let .cc(channel, controller, value) = packets[1] {
                check(channel == 15 && controller == 8 && value == 127, "packet crossfader \(packets[1])")
            } else { check(false, "second packet \(packets[1])") }
        }

        let message = OSCMessage(address: "/visionboard/layerA/opacity", values: [.float(0.5), .int(3), .string("go")])
        let decoded = OSCCodec.decode(OSCCodec.encode(message))
        check(decoded.count == 1 && decoded[0].address == message.address, "OSC address round trip")
        check(abs((decoded.first?.primary ?? 0) - 0.5) < 0.0001, "OSC float round trip")

        let session = Session(connectHardware: false)
        check(session.hardware.count == 28, "factory control count \(session.hardware.count)")
        check(MixtrackProfile.control("play.A")?.address == .note(channel: 0, note: 0), "play A")
        check(MixtrackProfile.control("play.B")?.address == .note(channel: 1, note: 0), "play B")
        check(MixtrackProfile.control("pad3.B")?.address == .note(channel: 5, note: 22), "pad 3 B")
        check(MixtrackProfile.control("pitch.A")?.address == .cc14(channel: 0, msb: 9, lsb: 41), "pitch is 14-bit")
        check(MixtrackProfile.control("filter.A")?.address == .cc(channel: 0, controller: 22), "filter")
        check(MixtrackProfile.control("level.A")?.address == .cc(channel: 0, controller: 26), "level")
        check(MixtrackProfile.control("xfade")?.address == .cc(channel: 15, controller: 8), "crossfader")
        check(MixtrackProfile.control("browse")?.address == .cc(channel: 15, controller: 0), "browse")

        session.tap("play.A")
        check(session.values["layerA.running"] == 1, "play starts deck A")
        session.tap("play.A")
        check(session.values["layerA.running"] == 0, "play toggles off")

        session.tap("play.B")
        check(session.values["layerB.running"] == 1, "play B")
        session.setParameter("layerA.phase", 0.4)
        session.tap("cue.A")
        check(session.value(for: "layerA.phase") == 0, "cue returns to the start")

        session.ingest([
            .cc(channel: 0, controller: 9, value: 64),
            .cc(channel: 0, controller: 41, value: 0),
        ])
        let speed = session.values["layerA.speed"] ?? -1
        check(abs(speed - 0.5) < 0.02, "pitch center is \(speed)")
        check(abs((session.values["layerA.opacity"] ?? 0) - 0.85) < 0.001, "pitch fader must not change level")

        session.ingest([.cc(channel: 0, controller: 26, value: 0)])
        check(session.values["layerA.opacity"] == 0, "level closes deck A")
        session.ingest([.cc(channel: 1, controller: 26, value: 127)])
        check(abs((session.values["layerB.opacity"] ?? 0) - 1) < 0.001, "level B")

        session.ingest([.cc(channel: 0, controller: 22, value: 127)])
        check(session.values["layerA.hue"] == 1, "filter sets color")
        session.attach("layerA.warp", source: .midi(.cc(channel: 0, controller: 22), relative: false))
        session.ingest([.cc(channel: 0, controller: 22, value: 64)])
        check(abs((session.values["layerA.hue"] ?? 0) - 64.0 / 127) < 0.02, "filter still sets color")
        check(abs((session.values["layerA.warp"] ?? 0) - 64.0 / 127) < 0.02, "same knob also sets warp")

        session.setParameter("master.fadeFX", 1)
        session.ingest([.cc(channel: 15, controller: 8, value: 127)])
        check(session.values["master.crossfade"] == 1, "crossfader full right")
        check(session.values["layerA.warp"] == 1 && session.values["layerB.warp"] == 0, "fade FX sweeps both decks")

        session.ingest([.cc(channel: 15, controller: 12, value: 0)])
        check(session.values["master.brightness"] == 0, "main level")
        let phaseBefore = session.value(for: "layerA.phase")
        session.nudgeRelative("jog.A", ticks: 5)
        let phaseAfter = session.value(for: "layerA.phase")
        check(phaseAfter > phaseBefore, "jog scrubs deck A")

        session.nudgeRelative("browse", ticks: 1)
        check(abs((session.values["media.index"] ?? 0) - 0.25) < 0.001, "browse steps the bin")

        session.setParameter("layerA.padMode", 4)
        session.tap("pad1.A")
        check(session.values["layerA.stem"] == 0, "stem pad 1")
        session.tap("pad4.A")
        check(session.values["layerA.stem"] == 3, "stem pad 4")

        session.setParameter("layerB.padMode", 3)
        session.tap("pad3.B")
        check(abs((session.values["layerB.shader"] ?? -1) - 0.5) < 0.001, "sampler pad picks a shader")

        session.setParameter("layerA.padMode", 1)
        session.tap("mode.A")
        check(session.values["layerA.padMode"] == 2, "short mode press cycles")

        session.ingest([.note(channel: 4, note: 0, velocity: 127, on: true)])
        session.tick(0.6)
        check(session.shiftHeld, "holding mode is shift")
        session.setParameter("layerA.speed", 0.2)
        session.tap("sync.A")
        check(session.values["layerA.speed"] == 0.5 && session.values["layerA.sync"] == 0, "shift sync resets speed")
        session.ingest([.note(channel: 4, note: 0, velocity: 0, on: false)])
        check(!session.shiftHeld, "releasing mode leaves shift")

        session.setTuning("level.A", Tuning(invert: true))
        session.moveAbsolute("level.A", 1)
        check(session.values["layerA.opacity"] == 0, "inverted level")

        let document = PresetDocument(
            name: "Club",
            values: ["master.brightness": 0.2],
            bindings: session.bindings,
            tuning: session.tuning,
            panels: session.panels,
            addresses: ["play.A": .note(channel: 0, note: 3)]
        )
        let copy = try? JSONDecoder().decode(PresetDocument.self, from: JSONEncoder().encode(document))
        check(copy == document, "preset round trip")

        check(isMixtrackGo(name: "Numark MixTrack Go"), "device name")
        check(!isMixtrackGo(name: "IAC Driver"), "unrelated MIDI port")

        check(session.values["slot2.opacity"] == 0, "extra layers start closed")
        session.addLayer()
        check(session.layerCount == 3 && (session.values["slot2.opacity"] ?? 0) > 0.5, "add layer opens the next slot")
        check(session.layerOrder.last == 2, "new layer sits in front")
        session.placeLayer(2, atFrontRank: 2)
        let stacked = session.uniformPack(aspect: 1)
        check(stacked[40] == 2 && stacked[41] == 0 && stacked[42] == 1 && stacked[43] == 8, "drag sends a layer behind the decks")
        session.setParameter("slot2.visible", 0)
        let hiddenPack = session.uniformPack(aspect: 1)
        let slot2Opacity = UniformPack.header + 2 * UniformPack.stride
        check(hiddenPack[slot2Opacity] == 0 && (session.values["slot2.opacity"] ?? 0) > 0.5, "eye hides the layer and keeps the slider")
        check(abs(LayerStack.migratedBlend(1, from: LayerStack.legacyBlendStops) - 4 / Double(LayerStack.blendStops)) < 0.0001, "old darken stays darken")
        check(abs(LayerStack.migratedBlend(0.25, from: LayerStack.legacyBlendStops) - 1 / Double(LayerStack.blendStops)) < 0.0001, "old add stays add")
        session.placeLayer(2, atFrontRank: 0)

        session.tapTempo()
        session.tick(0.4)
        session.tapTempo()
        let tapped = ParamCatalog.bpm(from: session.values["clock.bpm"] ?? 0)
        check(abs(tapped - 150) < 2, "tap tempo \(tapped)")

        let clocks = MIDIParser.messages(from: [0xF8, 0xFA, 0xFC])
        check(clocks == [.clock, .transport(start: true), .transport(start: false)], "midi clock bytes")

        let hap = MovieCodec.fourcc("Hap1")
        check(MovieCodec.isHAP(hap) && !MovieCodec.isHAP(MovieCodec.fourcc("apcn")), "HAP fourcc")

        let dmx = ArtDmx(universe: 3, sequence: 1, channels: [10, 20, 30])
        let decodedDMX = ArtNet.decode(ArtNet.encode(dmx))
        check(decodedDMX?.universe == 3 && decodedDMX?.channels.prefix(3).elementsEqual([10, 20, 30]) == true, "Art-Net round trip")

        let isf = """
        /*{ "DESCRIPTION": "wash", "INPUTS": [ {"NAME": "level", "TYPE": "float", "DEFAULT": 0.25, "MIN": 0.0, "MAX": 1.0} ] }*/
        void main() {
          gl_FragColor = vec4(level, 0.0, 0.0, 1.0);
        }
        """
        let shader = ISFTranslator.parse(isf)
        check(shader?.inputs.first?.name == "level" && shader?.inputs.first?.value == 0.25, "ISF input")
        check(shader?.metal.contains("float4 isf_main") == true && shader?.metal.contains("gl_FragColor") == false, "ISF metal")
        if let metal = shader?.metal, let device = MTLCreateSystemDefaultDevice() {
            do {
                _ = try device.makeLibrary(source: "#include <metal_stdlib>\nusing namespace metal;\n\(metal)", options: nil)
            } catch {
                check(false, "ISF did not compile: \(error)")
            }
        }

        if let inverted = KeystoneMath.invert(
            point: (0.3, 0.7),
            topLeft: (0, 0), topRight: (1, 0), bottomRight: (1, 1), bottomLeft: (0, 1)
        ) {
            check(abs(inverted.0 - 0.3) < 0.03 && abs(inverted.1 - 0.7) < 0.03, "keystone identity \(inverted)")
        } else {
            check(false, "keystone identity failed")
        }

        check(UniformPack.header == 48 && UniformPack.stride == 36, "uniform layout")
        check(session.values["canvasB.opacity"] == 0, "canvas B starts out of the mix")
        check(abs(LFOShape.cosine.sample(phase: 0) - 1) < 0.0001, "cosine starts at the top")
        let drawn = LFOShape.custom.sample(phase: 0.5, table: [0, 1])
        check(abs(drawn - 0.5) < 0.0001, "drawn wave interpolates")
        let fitted = FrameMath.map(u: 0.5, v: 0, mode: 0, sourceAspect: 2, canvasAspect: 1, lock: false)
        check(abs(fitted.0 - 0.5) < 0.0001 && abs(fitted.1 + 0.5) < 0.0001, "fit letterboxes a wide source")
        let oldClip = #"{"id":"00000000-0000-0000-0000-000000000001","name":"a","path":"/tmp/a.mov","kind":"movie","label":1,"page":0,"trigger":"loop","note":""}"#
        let clip = try? JSONDecoder().decode(MediaClip.self, from: Data(oldClip.utf8))
        check(clip?.detail == "" && clip?.triggerNote == "" && clip?.name == "a", "old media json")
        return failures
    }
}
