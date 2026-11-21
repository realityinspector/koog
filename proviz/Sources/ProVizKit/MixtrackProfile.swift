import Foundation

public enum ControlConfidence: String, Codable, Sendable {
    /// Pressed or moved while Mixtrack Academy asked for this control.
    case learned
    /// Deck B mirrors deck A on the next MIDI channel. Pad channel 4 mirrors to 5.
    case derived
    /// Read from the unlabeled capture: a 14-bit pair, a relative encoder, or a twin of a learned knob.
    case inferred
}

public enum ControlKind: String, Codable, Sendable {
    case button
    case absolute
    case absolute14
    case relative
}

public struct HardwareControl: Identifiable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var kind: ControlKind
    public var address: MIDIAddress
    public var confidence: ControlConfidence
    public var deck: String?

    public init(id: String, name: String, kind: ControlKind, address: MIDIAddress, confidence: ControlConfidence, deck: String? = nil) {
        self.id = id
        self.name = name
        self.kind = kind
        self.address = address
        self.confidence = confidence
        self.deck = deck
    }
}

/// Factory map for the Numark Mixtrack Go.
///
/// Addresses come from two local captures of this controller:
/// `mixtrack-academy/data/mapping.json` (buttons, jog, crossfader, cue level, and the
/// two per-deck knobs, learned by pressing the named control) and
/// `mixtrack-go-observed-midi.json` (every CC and note the unit emitted).
///
/// Channels are 0-based, matching CoreMIDI's status nibble.
/// Deck B is the same note or CC on channel + 1. Pads live on channels 4 and 5.
///
/// The academy file lists `vol.A = cc:0:9` and `tempo.A = cc:0:41`. Those two CCs
/// fire as a pair (1029 and 1031 events in the capture, and 41 = 9 + 32), which is
/// a 14-bit fader. The calibrator stored the MSB as volume and then, because that
/// MSB was already taken, stored the LSB as tempo. This profile keeps them together
/// as the pitch fader. The two independent 7-bit CCs are the ones the calibrator
/// called high (`cc 22`, the Filter/Low knob) and low (`cc 26`, the channel level).
public enum MixtrackProfile {
    public static let padModes = ["Cue", "Loop", "FX", "Sampler", "Stems"]

    public static let controls: [HardwareControl] = {
        var list: [HardwareControl] = []
        func deck(_ side: String, channel: Int, padChannel: Int, confidence: ControlConfidence) {
            let learned: ControlConfidence = side == "A" ? .learned : confidence
            list.append(contentsOf: [
                HardwareControl(id: "play.\(side)", name: "Play", kind: .button, address: .note(channel: channel, note: 0), confidence: learned, deck: side),
                HardwareControl(id: "cue.\(side)", name: "Cue", kind: .button, address: .note(channel: channel, note: 1), confidence: learned, deck: side),
                HardwareControl(id: "sync.\(side)", name: "Sync", kind: .button, address: .note(channel: channel, note: 2), confidence: learned, deck: side),
                HardwareControl(id: "mode.\(side)", name: "Mode", kind: .button, address: .note(channel: padChannel, note: 0), confidence: learned, deck: side),
                HardwareControl(id: "pad1.\(side)", name: "Pad 1", kind: .button, address: .note(channel: padChannel, note: 20), confidence: learned, deck: side),
                HardwareControl(id: "pad2.\(side)", name: "Pad 2", kind: .button, address: .note(channel: padChannel, note: 21), confidence: learned, deck: side),
                HardwareControl(id: "pad3.\(side)", name: "Pad 3", kind: .button, address: .note(channel: padChannel, note: 22), confidence: learned, deck: side),
                HardwareControl(id: "pad4.\(side)", name: "Pad 4", kind: .button, address: .note(channel: padChannel, note: 23), confidence: learned, deck: side),
                HardwareControl(id: "jog.\(side)", name: "Jog", kind: .relative, address: .cc(channel: channel, controller: 6), confidence: learned, deck: side),
                HardwareControl(id: "pitch.\(side)", name: "Pitch", kind: .absolute14, address: .cc14(channel: channel, msb: 9, lsb: 41), confidence: side == "A" ? .inferred : confidence, deck: side),
                HardwareControl(id: "filter.\(side)", name: "Filter", kind: .absolute, address: .cc(channel: channel, controller: 22), confidence: learned, deck: side),
                HardwareControl(id: "level.\(side)", name: "Level", kind: .absolute, address: .cc(channel: channel, controller: 26), confidence: learned, deck: side),
            ])
        }
        deck("A", channel: 0, padChannel: 4, confidence: .learned)
        deck("B", channel: 1, padChannel: 5, confidence: .derived)
        list.append(contentsOf: [
            HardwareControl(id: "xfade", name: "Crossfader", kind: .absolute, address: .cc(channel: 15, controller: 8), confidence: .learned),
            HardwareControl(id: "cuegain", name: "Cue level", kind: .absolute, address: .cc(channel: 15, controller: 10), confidence: .learned),
            HardwareControl(id: "main", name: "Main level", kind: .absolute, address: .cc(channel: 15, controller: 12), confidence: .inferred),
            HardwareControl(id: "browse", name: "Browse", kind: .relative, address: .cc(channel: 15, controller: 0), confidence: .inferred),
        ])
        return list
    }()

    public static func control(_ id: String) -> HardwareControl? {
        controls.first { $0.id == id }
    }
}
