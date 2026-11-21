import Foundation

// MARK: - Curves

public enum Curve: String, Codable, CaseIterable, Sendable {
    case linear
    case logarithmic
    case exponential
    case sCurve

    public var label: String {
        switch self {
        case .linear: "Linear"
        case .logarithmic: "Logarithmic"
        case .exponential: "Exponential"
        case .sCurve: "S-curve"
        }
    }

    public func apply(_ t: Double) -> Double {
        let x = min(1, max(0, t))
        switch self {
        case .linear:
            return x
        case .logarithmic:
            return log10(1 + 9 * x)
        case .exponential:
            return (pow(10, x) - 1) / 9
        case .sCurve:
            return x * x * (3 - 2 * x)
        }
    }
}

public struct Tuning: Codable, Equatable, Sendable {
    public var invert: Bool
    public var curve: Curve
    public var minimum: Double
    public var maximum: Double

    public init(invert: Bool = false, curve: Curve = .linear, minimum: Double = 0, maximum: Double = 1) {
        self.invert = invert
        self.curve = curve
        self.minimum = minimum
        self.maximum = maximum
    }

    public func shape(_ raw: Double) -> Double {
        var t = min(1, max(0, raw))
        if invert { t = 1 - t }
        t = curve.apply(t)
        return minimum + (maximum - minimum) * t
    }
}

public func signedMIDIStep(_ value: Int) -> Double {
    if value == 0 || value == 64 { return 0 }
    if value < 64 { return Double(value) }
    return Double(value - 128)
}

// MARK: - Parameters

public enum ParamKind: String, Sendable {
    case unit
    case toggle
    case readout
}

public struct ParamSpec: Identifiable, Sendable {
    public var id: String
    public var name: String
    public var group: String
    public var kind: ParamKind
    public var defaultValue: Double

    public init(id: String, name: String, group: String, kind: ParamKind = .unit, defaultValue: Double = 0) {
        self.id = id
        self.name = name
        self.group = group
        self.kind = kind
        self.defaultValue = defaultValue
    }
}

public enum LayerStack {
    public static let prefixes = ["layerA", "layerB", "slot2", "slot3", "slot4", "slot5", "slot6", "slot7"]
    public static let titles = ["Deck A", "Deck B", "Layer 3", "Layer 4", "Layer 5", "Layer 6", "Layer 7", "Layer 8"]
    public static let blends = ["Normal", "Add", "Multiply", "Screen", "Darken", "Lighten", "Overlay", "Difference", "Exclusion"]
    /// Denominator for the 0...1 blend control. Matches `VB_BLENDS` in the Metal shader.
    public static let blendStops = 8
    /// Blend controls saved before Lighten, Overlay, Difference, and Exclusion existed.
    public static let legacyBlendStops = 4

    /// Map a blend written on the old five-stop grid onto the current grid. 0 stays Normal, 1 stayed Darken.
    public static func migratedBlend(_ unit: Double, from stops: Int, to modern: Int = blendStops) -> Double {
        guard stops > 0, modern > 0, stops != modern else { return min(1, max(0, unit)) }
        let clamped = min(1, max(0, unit))
        let index = min(stops, max(0, Int((clamped * Double(stops)).rounded())))
        return Double(index) / Double(modern)
    }
    public static let sources = ["Shader", "Media", "Text", "Camera", "Screen", "Feedback", "ISF"]
    public static let effects = ["None", "Blur", "Levels", "Pixelate", "Ripple", "Invert", "Core Image color", "Core Image blur", "Chromatic", "Edges", "Glitch"]
    public static let fits = ["Fit", "Fill", "Stretch"]
    public static let canvases = ["Main", "Canvas B", "Canvas C"]
    public static let grades = ["None", "Warm", "Cool", "Bleach", "Punch"]

    public static func focusTag(for index: Int) -> String {
        if index == 0 { return "A" }
        if index == 1 { return "B" }
        return "\(index)"
    }

    public static func prefix(for focus: String) -> String {
        switch focus {
        case "B": return "layerB"
        case "A": return "layerA"
        default:
            if let n = Int(focus), prefixes.indices.contains(n) { return prefixes[n] }
            return "layerA"
        }
    }

    public static func index(of prefix: String) -> Int {
        prefixes.firstIndex(of: prefix) ?? 0
    }

    /// Map a 0...1 control onto a list of named choices.
    public static func choice(_ unit: Double, count: Int) -> Int {
        guard count > 1 else { return 0 }
        return min(count - 1, max(0, Int((min(1, max(0, unit)) * Double(count - 1)).rounded())))
    }

    public static func unit(for source: String) -> Double {
        guard let index = sources.firstIndex(of: source), sources.count > 1 else { return 0 }
        return Double(index) / Double(sources.count - 1)
    }
}

public struct CanvasSpec: Codable, Equatable, Sendable {
    public var width: Int
    public var height: Int

    public init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }

    /// Main follows the view. B and C start at 1280×720 and stay out of the mix until their opacity rises.
    public static let standard: [CanvasSpec] = [
        CanvasSpec(width: 0, height: 0),
        CanvasSpec(width: 1280, height: 720),
        CanvasSpec(width: 1280, height: 720),
    ]
}

public enum FrameMath {
    /// Fit keeps the whole picture, fill covers the frame, stretch ignores aspect. Lock turns stretch back into fit.
    public static func map(u: Double, v: Double, mode: Int, sourceAspect: Double, canvasAspect: Double, lock: Bool) -> (Double, Double) {
        let resolved = (lock && mode == 2) ? 0 : mode
        if resolved >= 2 { return (u, v) }
        let ratio = max(0.05, sourceAspect) / max(0.05, canvasAspect)
        if resolved == 0 {
            if ratio > 1 { return (u, (v - 0.5) * ratio + 0.5) }
            return ((u - 0.5) / ratio + 0.5, v)
        }
        if ratio > 1 { return ((u - 0.5) / ratio + 0.5, v) }
        return (u, (v - 0.5) * ratio + 0.5)
    }
}

public struct MediaClip: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var path: String
    public var kind: String
    public var label: Int
    public var page: Int
    public var trigger: String
    public var note: String
    public var detail: String
    public var triggerNote: String

    public init(id: UUID = UUID(), name: String, path: String, kind: String, label: Int = 0, page: Int = 0, trigger: String = "loop", note: String = "", detail: String = "", triggerNote: String = "") {
        self.id = id
        self.name = name
        self.path = path
        self.kind = kind
        self.label = label
        self.page = page
        self.trigger = trigger
        self.note = note
        self.detail = detail
        self.triggerNote = triggerNote
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, path, kind, label, page, trigger, note, detail, triggerNote
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        path = try container.decode(String.self, forKey: .path)
        kind = try container.decode(String.self, forKey: .kind)
        label = try container.decodeIfPresent(Int.self, forKey: .label) ?? 0
        page = try container.decodeIfPresent(Int.self, forKey: .page) ?? 0
        trigger = try container.decodeIfPresent(String.self, forKey: .trigger) ?? "loop"
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        detail = try container.decodeIfPresent(String.self, forKey: .detail) ?? ""
        triggerNote = try container.decodeIfPresent(String.self, forKey: .triggerNote) ?? ""
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(path, forKey: .path)
        try container.encode(kind, forKey: .kind)
        try container.encode(label, forKey: .label)
        try container.encode(page, forKey: .page)
        try container.encode(trigger, forKey: .trigger)
        try container.encode(note, forKey: .note)
        try container.encode(detail, forKey: .detail)
        try container.encode(triggerNote, forKey: .triggerNote)
    }
}

public struct SurfaceWidget: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var kind: String
    public var label: String
    public var parameter: String

    public init(id: UUID = UUID(), kind: String, label: String, parameter: String) {
        self.id = id
        self.kind = kind
        self.label = label
        self.parameter = parameter
    }
}

public enum MovieCodec {
    public static func fourcc(_ code: String) -> UInt32 {
        var value: UInt32 = 0
        for byte in code.utf8.prefix(4) {
            value = (value << 8) | UInt32(byte)
        }
        return value
    }

    public static func isHAP(_ subtype: UInt32) -> Bool {
        ["Hap1", "Hap5", "HapY", "HapM", "HapA", "Hap7"].contains { fourcc($0) == subtype }
    }

    public static func tag(_ subtype: UInt32) -> String {
        let bytes = [
            UInt8((subtype >> 24) & 0xff),
            UInt8((subtype >> 16) & 0xff),
            UInt8((subtype >> 8) & 0xff),
            UInt8(subtype & 0xff),
        ]
        let text = String(bytes: bytes, encoding: .macOSRoman) ?? ""
        return text.trimmingCharacters(in: .controlCharacters.union(.whitespaces))
    }
}

/// Inverse bilinear for a quad. Corners are top-left, top-right, bottom-right, bottom-left.
public enum KeystoneMath {
    public static func invert(
        point: (Double, Double),
        topLeft: (Double, Double),
        topRight: (Double, Double),
        bottomRight: (Double, Double),
        bottomLeft: (Double, Double)
    ) -> (Double, Double)? {
        let a = topLeft
        let b = topRight
        let c = bottomRight
        let d = bottomLeft
        let e = (b.0 - a.0, b.1 - a.1)
        let f = (d.0 - a.0, d.1 - a.1)
        let g = (a.0 - b.0 + c.0 - d.0, a.1 - b.1 + c.1 - d.1)
        let h = (point.0 - a.0, point.1 - a.1)
        func cross(_ p: (Double, Double), _ q: (Double, Double)) -> Double { p.0 * q.1 - p.1 * q.0 }
        let k2 = cross(g, f)
        let k1 = cross(e, f) + cross(h, g)
        let k0 = cross(h, e)
        let v: Double
        if abs(k2) < 1e-8 {
            guard abs(k1) > 1e-8 else { return nil }
            v = -k0 / k1
        } else {
            let disc = k1 * k1 - 4 * k2 * k0
            guard disc >= 0 else { return nil }
            let root = sqrt(disc)
            let v1 = (-k1 + root) / (2 * k2)
            let v2 = (-k1 - root) / (2 * k2)
            if (0...1).contains(v1) { v = v1 }
            else { v = v2 }
        }
        let denomX = e.0 + g.0 * v
        let denomY = e.1 + g.1 * v
        let u: Double
        if abs(denomX) >= abs(denomY) {
            guard abs(denomX) > 1e-8 else { return nil }
            u = (h.0 - f.0 * v) / denomX
        } else {
            guard abs(denomY) > 1e-8 else { return nil }
            u = (h.1 - f.1 * v) / denomY
        }
        return (u, v)
    }
}

public enum Shaders {
    public static let names = ["Rings", "Grid", "Stems", "Kaleido", "Scan"]

    public static func index(from unit: Double) -> Int {
        let n = names.count
        let i = Int((min(1, max(0, unit)) * Double(n - 1)).rounded())
        return min(n - 1, max(0, i))
    }

    public static func unit(for index: Int) -> Double {
        guard names.count > 1 else { return 0 }
        return Double(min(names.count - 1, max(0, index))) / Double(names.count - 1)
    }
}

public enum ParamCatalog {
    public static let all: [ParamSpec] = {
        var specs: [ParamSpec] = []
        for (index, prefix) in LayerStack.prefixes.enumerated() {
            let group = LayerStack.titles[index]
            let deck = index < 2
            specs.append(contentsOf: [
                ParamSpec(id: "\(prefix).visible", name: "Show", group: group, kind: .toggle, defaultValue: 1),
                ParamSpec(id: "\(prefix).opacity", name: "Opacity", group: group, defaultValue: deck ? 0.85 : 0),
                ParamSpec(id: "\(prefix).speed", name: "Speed", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).hue", name: "Color", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).warp", name: "Warp", group: group, defaultValue: 0.15),
                ParamSpec(id: "\(prefix).phase", name: "Phase", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).running", name: "Play", group: group, kind: .toggle),
                ParamSpec(id: "\(prefix).hit", name: "Hit", group: group, kind: .readout),
                ParamSpec(id: "\(prefix).shader", name: "Shader", group: group, defaultValue: index == 1 ? 0.25 : 0),
                ParamSpec(id: "\(prefix).stem", name: "Stem", group: group, defaultValue: 3),
                ParamSpec(id: "\(prefix).audioAmount", name: "Audio amount", group: group, defaultValue: 0.7),
                ParamSpec(id: "\(prefix).x", name: "X", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).y", name: "Y", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).scale", name: "Scale", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).rotation", name: "Rotation", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).blend", name: "Blend", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).source", name: "Source", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).effect0", name: "Effect 1", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).effect0amt", name: "Effect 1 amount", group: group, defaultValue: 0.35),
                ParamSpec(id: "\(prefix).effect1", name: "Effect 2", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).effect1amt", name: "Effect 2 amount", group: group, defaultValue: 0.35),
                ParamSpec(id: "\(prefix).effect2", name: "Effect 3", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).effect2amt", name: "Effect 3 amount", group: group, defaultValue: 0.35),
                ParamSpec(id: "\(prefix).fit", name: "Fit", group: group, defaultValue: 0),
                ParamSpec(id: "\(prefix).anchorX", name: "Anchor X", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).anchorY", name: "Anchor Y", group: group, defaultValue: 0.5),
                ParamSpec(id: "\(prefix).cropL", name: "Crop left", group: group),
                ParamSpec(id: "\(prefix).cropR", name: "Crop right", group: group),
                ParamSpec(id: "\(prefix).cropT", name: "Crop top", group: group),
                ParamSpec(id: "\(prefix).cropB", name: "Crop bottom", group: group),
                ParamSpec(id: "\(prefix).feather", name: "Feather", group: group),
                ParamSpec(id: "\(prefix).aspectLock", name: "Aspect lock", group: group, kind: .toggle),
                ParamSpec(id: "\(prefix).canvas", name: "Canvas", group: group),
                ParamSpec(id: "\(prefix).grade", name: "Grade", group: group),
                ParamSpec(id: "\(prefix).reverse", name: "Reverse", group: group, kind: .toggle),
            ])
            if deck {
                specs.append(contentsOf: [
                    ParamSpec(id: "\(prefix).sync", name: "Sync", group: group, kind: .toggle),
                    ParamSpec(id: "\(prefix).padMode", name: "Pad mode", group: group, defaultValue: 0),
                ])
            }
        }
        specs.append(contentsOf: [
            ParamSpec(id: "master.crossfade", name: "Crossfader", group: "Master", defaultValue: 0.5),
            ParamSpec(id: "master.brightness", name: "Main level", group: "Master", defaultValue: 0.9),
            ParamSpec(id: "master.previewZoom", name: "Cue zoom", group: "Master", defaultValue: 0.25),
            ParamSpec(id: "master.fadeFX", name: "Fade FX", group: "Master", kind: .toggle),
            ParamSpec(id: "master.blackout", name: "Blackout", group: "Master", kind: .toggle),
            ParamSpec(id: "master.saturation", name: "Saturation", group: "Master", defaultValue: 0.5),
            ParamSpec(id: "master.contrast", name: "Contrast", group: "Master", defaultValue: 0.5),
            ParamSpec(id: "master.split", name: "Canvas split", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.feedback", name: "Feedback", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.feedbackZoom", name: "Feedback zoom", group: "Master", defaultValue: 0.5),
            ParamSpec(id: "master.keystone", name: "Keystone", group: "Master", kind: .toggle),
            ParamSpec(id: "master.k0x", name: "Keystone TL X", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.k0y", name: "Keystone TL Y", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.k1x", name: "Keystone TR X", group: "Master", defaultValue: 1),
            ParamSpec(id: "master.k1y", name: "Keystone TR Y", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.k2x", name: "Keystone BR X", group: "Master", defaultValue: 1),
            ParamSpec(id: "master.k2y", name: "Keystone BR Y", group: "Master", defaultValue: 1),
            ParamSpec(id: "master.k3x", name: "Keystone BL X", group: "Master", defaultValue: 0),
            ParamSpec(id: "master.k3y", name: "Keystone BL Y", group: "Master", defaultValue: 1),
            ParamSpec(id: "master.artnetOut", name: "Art-Net out", group: "Master", kind: .toggle),
            ParamSpec(id: "canvasB.opacity", name: "Canvas B mix", group: "Canvas"),
            ParamSpec(id: "canvasB.blend", name: "Canvas B blend", group: "Canvas"),
            ParamSpec(id: "canvasC.opacity", name: "Canvas C mix", group: "Canvas"),
            ParamSpec(id: "canvasC.blend", name: "Canvas C blend", group: "Canvas"),
            ParamSpec(id: "media.index", name: "Media select", group: "Master", defaultValue: 0),
            ParamSpec(id: "audio.bass", name: "Bass", group: "Audio", kind: .readout),
            ParamSpec(id: "audio.mid", name: "Mid", group: "Audio", kind: .readout),
            ParamSpec(id: "audio.treble", name: "Treble", group: "Audio", kind: .readout),
            ParamSpec(id: "audio.level", name: "Level", group: "Audio", kind: .readout),
            ParamSpec(id: "lfo.rate", name: "LFO rate", group: "Modulators", defaultValue: 0.25),
            ParamSpec(id: "lfo.shape", name: "LFO shape", group: "Modulators", defaultValue: 0),
            ParamSpec(id: "lfo.amount", name: "LFO amount", group: "Modulators", defaultValue: 1),
            ParamSpec(id: "lfo.output", name: "LFO", group: "Modulators", kind: .readout, defaultValue: 0.5),
            ParamSpec(id: "clock.bpm", name: "BPM", group: "Modulators", defaultValue: 0.5),
            ParamSpec(id: "clock.running", name: "Clock run", group: "Modulators", kind: .toggle, defaultValue: 1),
            ParamSpec(id: "clock.phase", name: "Clock phase", group: "Modulators", kind: .readout),
            ParamSpec(id: "clock.follow", name: "Follow the music", group: "Modulators", kind: .toggle, defaultValue: 1),
            ParamSpec(id: "clock.external", name: "MIDI clock", group: "Modulators", kind: .toggle),
            ParamSpec(id: "seq.rate", name: "Sequencer rate", group: "Modulators", defaultValue: 0.5),
            ParamSpec(id: "seq.output", name: "Sequencer", group: "Modulators", kind: .readout),
            ParamSpec(id: "surface.a", name: "Fader A", group: "Surface", defaultValue: 0.5),
            ParamSpec(id: "surface.b", name: "Fader B", group: "Surface", defaultValue: 0.5),
            ParamSpec(id: "surface.c", name: "Fader C", group: "Surface", defaultValue: 0.5),
            ParamSpec(id: "surface.button", name: "Button", group: "Surface", kind: .toggle),
            ParamSpec(id: "surface.x", name: "Pad X", group: "Surface", defaultValue: 0.5),
            ParamSpec(id: "surface.y", name: "Pad Y", group: "Surface", defaultValue: 0.5),
        ])
        for i in 0..<8 {
            specs.append(ParamSpec(id: "seq.step\(i)", name: "Step \(i + 1)", group: "Sequencer", defaultValue: i % 2 == 0 ? 0.2 : 0.85))
            specs.append(ParamSpec(id: "isf.\(i)", name: "ISF \(i + 1)", group: "ISF", defaultValue: 0.5))
        }
        return specs
    }()

    public static let byID: [String: ParamSpec] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    public static func bpm(from unit: Double) -> Double { 40 + min(1, max(0, unit)) * 160 }

    public static func unit(fromBPM bpm: Double) -> Double { min(1, max(0, (bpm - 40) / 160)) }
}

public enum LFOShape: Int, CaseIterable, Sendable {
    case sine, square, triangle, saw, random, cosine, custom

    public var label: String {
        switch self {
        case .sine: "Sine"
        case .square: "Square"
        case .triangle: "Triangle"
        case .saw: "Saw"
        case .random: "Random"
        case .cosine: "Cosine"
        case .custom: "Drawn"
        }
    }

    public static func sineTable(count: Int = 32) -> [Double] {
        (0..<count).map { index in
            0.5 + 0.5 * sin(Double(index) / Double(count) * 2 * Double.pi)
        }
    }

    public func sample(phase: Double, table: [Double] = []) -> Double {
        let p = phase - floor(phase)
        switch self {
        case .sine:
            return 0.5 + 0.5 * sin(p * 2 * Double.pi)
        case .square:
            return p < 0.5 ? 1 : 0
        case .triangle:
            return p < 0.5 ? p * 2 : (1 - p) * 2
        case .saw:
            return p
        case .random:
            var x = UInt64(Int(floor(phase)) & 0x7fffffff)
            x = x &* 6364136223846793005 &+ 1
            return Double(x % 10_000) / 10_000
        case .cosine:
            return 0.5 + 0.5 * cos(p * 2 * Double.pi)
        case .custom:
            guard table.count > 1 else { return 0.5 }
            let scaled = p * Double(table.count - 1)
            let index = min(table.count - 2, max(0, Int(scaled)))
            let fraction = scaled - Double(index)
            return table[index] + (table[index + 1] - table[index]) * fraction
        }
    }
}

public enum UniformPack {
    public static let header = 48
    public static let stride = 36
    public static let count = header + stride * 8

    public static func pack(values: [String: Double], time: Double, aspect: Double, width: Double = 1, height: Double = 1, aspects: [String: Double] = [:], order: [Int] = Array(0..<8), hidden: Set<Int> = []) -> [Float] {
        func f(_ id: String, _ fallback: Double = 0) -> Float {
            Float(values[id] ?? fallback)
        }
        var data = [Float](repeating: 0, count: count)
        data[0] = Float(time)
        data[1] = f("master.crossfade", 0.5)
        data[2] = f("master.brightness", 0.9)
        data[3] = f("audio.bass")
        data[4] = f("audio.mid")
        data[5] = f("audio.treble")
        data[6] = f("audio.level")
        data[7] = Float(aspect)
        data[8] = f("master.previewZoom", 0.25)
        data[9] = f("master.fadeFX")
        data[10] = f("master.blackout")
        data[11] = f("master.saturation", 0.5)
        data[12] = f("master.contrast", 0.5)
        data[13] = f("master.split")
        data[14] = f("master.feedback")
        data[15] = f("master.feedbackZoom", 0.5)
        data[16] = f("master.keystone")
        data[17] = f("master.k0x", 0)
        data[18] = f("master.k0y", 0)
        data[19] = f("master.k1x", 1)
        data[20] = f("master.k1y", 0)
        data[21] = f("master.k2x", 1)
        data[22] = f("master.k2y", 1)
        data[23] = f("master.k3x", 0)
        data[24] = f("master.k3y", 1)
        data[25] = Float(width)
        data[26] = Float(height)
        for i in 0..<8 { data[27 + i] = f("isf.\(i)", 0.5) }
        data[35] = 0
        data[36] = f("canvasB.opacity")
        data[37] = f("canvasB.blend")
        data[38] = f("canvasC.opacity")
        data[39] = f("canvasC.blend")
        // Slots 40...47 are the stack, back to front. 8 is an empty step.
        let sequence = order.isEmpty ? Array(0..<8) : order
        var seen = Set<Int>()
        var cursor = 0
        for index in sequence where (0..<8).contains(index) && seen.insert(index).inserted && cursor < 8 {
            data[40 + cursor] = Float(index)
            cursor += 1
        }
        while cursor < 8 {
            data[40 + cursor] = 8
            cursor += 1
        }
        for (index, prefix) in LayerStack.prefixes.enumerated() {
            let base = header + index * stride
            let deckB = prefix == "layerB"
            let shown = !hidden.contains(index) && f("\(prefix).visible", 1) >= 0.5
            data[base + 0] = shown ? f("\(prefix).opacity", index < 2 ? 0.85 : 0) : 0
            data[base + 1] = f("\(prefix).speed", 0.5)
            data[base + 2] = f("\(prefix).hue", 0.5)
            data[base + 3] = f("\(prefix).warp", 0.15)
            data[base + 4] = f("\(prefix).phase")
            data[base + 5] = f("\(prefix).running")
            data[base + 6] = f("\(prefix).hit")
            data[base + 7] = f("\(prefix).shader", deckB ? 0.25 : 0)
            data[base + 8] = f("\(prefix).stem", 3)
            data[base + 9] = f("\(prefix).audioAmount", 0.7)
            data[base + 10] = f("\(prefix).x", 0.5)
            data[base + 11] = f("\(prefix).y", 0.5)
            data[base + 12] = f("\(prefix).scale", 0.5)
            data[base + 13] = f("\(prefix).rotation", 0.5)
            data[base + 14] = f("\(prefix).blend")
            data[base + 15] = f("\(prefix).source")
            data[base + 16] = f("\(prefix).effect0")
            data[base + 17] = f("\(prefix).effect0amt", 0.35)
            data[base + 18] = f("\(prefix).effect1")
            data[base + 19] = f("\(prefix).effect1amt", 0.35)
            data[base + 20] = f("\(prefix).fit")
            data[base + 21] = f("\(prefix).anchorX", 0.5)
            data[base + 22] = f("\(prefix).anchorY", 0.5)
            data[base + 23] = f("\(prefix).cropL")
            data[base + 24] = f("\(prefix).cropR")
            data[base + 25] = f("\(prefix).cropT")
            data[base + 26] = f("\(prefix).cropB")
            data[base + 27] = f("\(prefix).feather")
            data[base + 28] = f("\(prefix).aspectLock")
            data[base + 29] = f("\(prefix).canvas")
            data[base + 30] = f("\(prefix).effect2")
            data[base + 31] = f("\(prefix).effect2amt", 0.35)
            data[base + 32] = Float(aspects[prefix] ?? 1)
            data[base + 33] = f("\(prefix).grade")
        }
        return data
    }
}

// MARK: - Bindings

public enum MIDIAddress: Codable, Equatable, Hashable, Sendable {
    case note(channel: Int, note: Int)
    case cc(channel: Int, controller: Int)
    case cc14(channel: Int, msb: Int, lsb: Int)

    public var key: String {
        switch self {
        case let .note(channel, note): "note:\(channel):\(note)"
        case let .cc(channel, controller): "cc:\(channel):\(controller)"
        case let .cc14(channel, msb, lsb): "cc14:\(channel):\(msb):\(lsb)"
        }
    }

    public var shortLabel: String {
        switch self {
        case let .note(channel, note): "Note \(channel).\(note)"
        case let .cc(channel, controller): "CC \(channel).\(controller)"
        case let .cc14(channel, msb, lsb): "CC \(channel).\(msb)+\(lsb)"
        }
    }
}

public enum BindingSource: Codable, Equatable, Sendable {
    case midi(MIDIAddress, relative: Bool)
    case osc(String)
    case lfo
    case audioBand(String)
    case clock
    case sequencer
    case parameter(String)

    public var label: String {
        switch self {
        case let .midi(address, relative):
            relative ? "\(address.shortLabel) relative" : address.shortLabel
        case let .osc(path): "OSC \(path)"
        case .lfo: "LFO"
        case let .audioBand(band): "Audio \(band)"
        case .clock: "Clock"
        case .sequencer: "Sequencer"
        case let .parameter(id): "Surface \(id)"
        }
    }
}

public enum BindingBehavior: Codable, Equatable, Sendable {
    case absolute
    case relative(step: Double)
    case momentary
    case toggle
    case trigger
}

public struct UserBinding: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var source: BindingSource
    public var parameter: String
    public var behavior: BindingBehavior
    public var tuning: Tuning

    public init(id: UUID = UUID(), source: BindingSource, parameter: String, behavior: BindingBehavior, tuning: Tuning = Tuning()) {
        self.id = id
        self.source = source
        self.parameter = parameter
        self.behavior = behavior
        self.tuning = tuning
    }
}

public struct PanelSpec: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var kind: String
    public var title: String
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    public var open: Bool

    public init(id: String, kind: String, title: String, x: Double, y: Double, width: Double, height: Double, open: Bool = true) {
        self.id = id
        self.kind = kind
        self.title = title
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.open = open
    }

    public static let kinds: [(kind: String, title: String)] = [
        ("canvas", "Canvas"),
        ("layers", "Layers"),
        ("hardware", "Mixtrack Go"),
        ("media", "Media"),
        ("mapping", "Mapping"),
        ("monitor", "MIDI"),
        ("audio", "Audio"),
        ("modulators", "Modulators"),
        ("surface", "Control surface"),
        ("routes", "Routes"),
        ("presets", "Presets"),
    ]

    public static var defaultLayout: [PanelSpec] {
        [
            PanelSpec(id: "canvas", kind: "canvas", title: "Canvas", x: 12, y: 8, width: 680, height: 352),
            PanelSpec(id: "layers", kind: "layers", title: "Layers", x: 704, y: 8, width: 300, height: 352),
            PanelSpec(id: "hardware", kind: "hardware", title: "Mixtrack Go", x: 12, y: 370, width: 992, height: 246),
            PanelSpec(id: "monitor", kind: "monitor", title: "MIDI", x: 1016, y: 8, width: 300, height: 250, open: true),
            PanelSpec(id: "media", kind: "media", title: "Media", x: 1056, y: 268, width: 280, height: 220, open: false),
            PanelSpec(id: "mapping", kind: "mapping", title: "Mapping", x: 360, y: 80, width: 420, height: 360, open: false),
            PanelSpec(id: "audio", kind: "audio", title: "Audio", x: 80, y: 80, width: 300, height: 280, open: false),
            PanelSpec(id: "modulators", kind: "modulators", title: "Modulators", x: 400, y: 70, width: 460, height: 420, open: false),
            PanelSpec(id: "surface", kind: "surface", title: "Control surface", x: 140, y: 100, width: 420, height: 320, open: false),
            PanelSpec(id: "presets", kind: "presets", title: "Presets", x: 180, y: 90, width: 360, height: 320, open: false),
            PanelSpec(id: "routes", kind: "routes", title: "Routes", x: 220, y: 120, width: 420, height: 360, open: false),
        ]
    }
}
