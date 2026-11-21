import Foundation
import Observation

public struct MonitorEntry: Identifiable, Equatable, Sendable {
    public var id: UUID
    public var text: String
    public var addressKey: String
    public var value: Int
}

public struct MeterLevels: Equatable, Sendable {
    public var bass: Double
    public var mid: Double
    public var treble: Double
    public var level: Double
    public var lfo: Double

    public init(bass: Double = 0, mid: Double = 0, treble: Double = 0, level: Double = 0, lfo: Double = 0.5) {
        self.bass = bass
        self.mid = mid
        self.treble = treble
        self.level = level
        self.lfo = lfo
    }
}

public enum LearnTarget: Equatable, Sendable {
    case midi(String)
    case osc(String)
    case dmx(String)
    case hardware(String)
    case clip(UUID)
}

public struct PresetDocument: Equatable, Sendable {
    public var name: String
    public var values: [String: Double]
    public var bindings: [UserBinding]
    public var tuning: [String: Tuning]
    public var panels: [PanelSpec]
    public var addresses: [String: MIDIAddress]
    public var clips: [MediaClip]
    public var widgets: [SurfaceWidget]
    public var texts: [String: String]
    public var dmxRoutes: [String: String]
    public var layerCount: Int
    public var isfSource: String
    public var canvasSizes: [CanvasSpec]
    public var lfoTable: [Double]
    public var fxPresets: [String: [String: Double]]
    public var layerNames: [String]
    public var layerLocked: [Bool]
    public var layerOrder: [Int]
    /// Blend grid the stored values were written with. Missing files use the five-stop grid.
    public var blendScale: Int

    public init(
        name: String,
        values: [String: Double],
        bindings: [UserBinding],
        tuning: [String: Tuning],
        panels: [PanelSpec],
        addresses: [String: MIDIAddress],
        clips: [MediaClip] = [],
        widgets: [SurfaceWidget] = [],
        texts: [String: String] = [:],
        dmxRoutes: [String: String] = [:],
        layerCount: Int = 2,
        isfSource: String = "",
        canvasSizes: [CanvasSpec] = CanvasSpec.standard,
        lfoTable: [Double] = [],
        fxPresets: [String: [String: Double]] = [:],
        layerNames: [String] = LayerStack.titles,
        layerLocked: [Bool] = Array(repeating: false, count: 8),
        layerOrder: [Int] = [0, 1],
        blendScale: Int = LayerStack.legacyBlendStops
    ) {
        self.name = name
        self.values = values
        self.bindings = bindings
        self.tuning = tuning
        self.panels = panels
        self.addresses = addresses
        self.clips = clips
        self.widgets = widgets
        self.texts = texts
        self.dmxRoutes = dmxRoutes
        self.layerCount = layerCount
        self.isfSource = isfSource
        self.canvasSizes = canvasSizes
        self.lfoTable = lfoTable
        self.fxPresets = fxPresets
        self.layerNames = layerNames
        self.layerLocked = layerLocked
        self.layerOrder = layerOrder
        self.blendScale = blendScale
    }
}

extension PresetDocument: Codable {
    private enum CodingKeys: String, CodingKey {
        case name, values, bindings, tuning, panels, addresses, clips, widgets, texts, dmxRoutes, layerCount, isfSource, canvasSizes, lfoTable, fxPresets, layerNames, layerLocked, layerOrder, blendScale
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        values = try container.decode([String: Double].self, forKey: .values)
        bindings = try container.decode([UserBinding].self, forKey: .bindings)
        tuning = try container.decode([String: Tuning].self, forKey: .tuning)
        panels = try container.decode([PanelSpec].self, forKey: .panels)
        addresses = try container.decode([String: MIDIAddress].self, forKey: .addresses)
        clips = try container.decodeIfPresent([MediaClip].self, forKey: .clips) ?? []
        widgets = try container.decodeIfPresent([SurfaceWidget].self, forKey: .widgets) ?? []
        texts = try container.decodeIfPresent([String: String].self, forKey: .texts) ?? [:]
        dmxRoutes = try container.decodeIfPresent([String: String].self, forKey: .dmxRoutes) ?? [:]
        layerCount = try container.decodeIfPresent(Int.self, forKey: .layerCount) ?? 2
        isfSource = try container.decodeIfPresent(String.self, forKey: .isfSource) ?? ""
        canvasSizes = try container.decodeIfPresent([CanvasSpec].self, forKey: .canvasSizes) ?? CanvasSpec.standard
        lfoTable = try container.decodeIfPresent([Double].self, forKey: .lfoTable) ?? []
        fxPresets = try container.decodeIfPresent([String: [String: Double]].self, forKey: .fxPresets) ?? [:]
        layerNames = try container.decodeIfPresent([String].self, forKey: .layerNames) ?? LayerStack.titles
        layerLocked = try container.decodeIfPresent([Bool].self, forKey: .layerLocked) ?? Array(repeating: false, count: 8)
        layerOrder = try container.decodeIfPresent([Int].self, forKey: .layerOrder) ?? [0, 1]
        blendScale = try container.decodeIfPresent(Int.self, forKey: .blendScale) ?? LayerStack.legacyBlendStops
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(values, forKey: .values)
        try container.encode(bindings, forKey: .bindings)
        try container.encode(tuning, forKey: .tuning)
        try container.encode(panels, forKey: .panels)
        try container.encode(addresses, forKey: .addresses)
        try container.encode(clips, forKey: .clips)
        try container.encode(widgets, forKey: .widgets)
        try container.encode(texts, forKey: .texts)
        try container.encode(dmxRoutes, forKey: .dmxRoutes)
        try container.encode(layerCount, forKey: .layerCount)
        try container.encode(isfSource, forKey: .isfSource)
        try container.encode(canvasSizes, forKey: .canvasSizes)
        try container.encode(lfoTable, forKey: .lfoTable)
        try container.encode(fxPresets, forKey: .fxPresets)
        try container.encode(layerNames, forKey: .layerNames)
        try container.encode(layerLocked, forKey: .layerLocked)
        try container.encode(layerOrder, forKey: .layerOrder)
        try container.encode(blendScale, forKey: .blendScale)
    }
}

@MainActor
@Observable
public final class Session {
    public var values: [String: Double]
    public var hardware: [HardwareControl]
    public var bindings: [UserBinding]
    public var tuning: [String: Tuning]
    public var panels: [PanelSpec]
    public var physical: [String: Double]
    public var flash: [String: Double]
    public var jogAngle: [String: Double]
    public var monitor: [MonitorEntry]
    public var sources: [String]
    public var deviceConnected: Bool
    public var status: String
    public var learn: LearnTarget?
    public var selectedParameter: String?
    public var selectedControl: String?
    public var focusedDeck: String
    public var shiftHeld: Bool
    public var sequencerStep: Int
    public var presetName: String
    public var audioStatus: String
    public var oscStatus: String
    public var oscInPort: Int
    public var oscOutPort: Int
    public var time: Double
    /// Audio and LFO levels for the panels. Copied from the frame clock about ten times a second.
    public var meters: MeterLevels
    public var waveform: [Float]
    public var clips: [MediaClip]
    public var clipForLayer: [String: UUID]
    public var widgets: [SurfaceWidget]
    public var texts: [String: String]
    public var dmxRoutes: [Int: String]
    public var layerCount: Int
    public var mediaPage: Int
    public var thumbSpan: Double
    public var isfSource: String
    public var isfMetal: String
    public var isfNames: [String]
    public var isfGeneration: Int
    public var artnetStatus: String
    public var serialStatus: String
    public var serialPath: String
    public var serialTarget: String
    public var recording: Bool
    public var recordStatus: String
    public var clipToken: [String: Int]
    public var canvasSizes: [CanvasSpec]
    public var lfoTable: [Double]
    public var fxPresets: [String: [String: Double]]
    public var layerNames: [String]
    public var layerLocked: [Bool]
    /// Open layers, back to front. The last entry is the front of the stack.
    public var layerOrder: [Int]
    public var blendScale: Int
    public nonisolated static let defaultCanvases = CanvasSpec.standard
    /// Playback nudges and source aspects. Kept off the observed store so a frame does not redraw the panels.
    @ObservationIgnored public var nudges: [String: Double] = [:]
    @ObservationIgnored public var sourceAspect: [String: Double] = [:]
    @ObservationIgnored public var primePaths: [String] = []

    private var index: [String: String]
    private var partial14: [String: (hi: Int, lo: Int)]
    private var held: [String: Bool]
    private var modeHeld: [String: Double]
    private var lfoPhase: Double
    private var seqPhase: Double
    private var beatMarks: [Double]
    private var lastOnset: Double?
    private var bpmTouched: Double
    private var dirty: Bool
    private var saveAccum: Double
    private var sweep: [(channel: Int, note: Int)]
    private var led: [String: Int]
    private var sawGo: Bool
    private var loopStarted: Bool
    private let persistence: Bool
    private var midi: MIDIEngine?
    private var osc: OSCEngine?
    private var audio: AudioAnalyzer?
    private var sentOSC: [String: Double]
    private var bindingHeld: [UUID: Bool]
    /// Phase, hits, and analysis. Kept off the observed parameter dictionary so the panels do not redraw every frame.
    @ObservationIgnored private var live: [String: Double]
    private var meterAccum: Double
    private var artnet: ArtNetEngine?
    private var serial: SerialLink?
    private var lastDMX: [UInt8]
    private var artnetSequence: Int
    private var artnetAccum: Double
    private var clockTicks: Int
    private var lastClockBeat: Double
    private var taps: [Double]

    public init(connectHardware: Bool = true) {
        values = Dictionary(uniqueKeysWithValues: ParamCatalog.all.map { ($0.id, $0.defaultValue) })
        hardware = MixtrackProfile.controls
        bindings = []
        tuning = [:]
        panels = PanelSpec.defaultLayout
        physical = [
            "pitch.A": 0.5, "pitch.B": 0.5,
            "filter.A": 0.5, "filter.B": 0.5,
            "level.A": 0.85, "level.B": 0.85,
            "xfade": 0.5, "main": 0.9, "cuegain": 0.25,
        ]
        flash = [:]
        jogAngle = [:]
        monitor = []
        sources = []
        deviceConnected = false
        status = "Looking for a Mixtrack Go"
        learn = nil
        selectedParameter = nil
        selectedControl = nil
        focusedDeck = "A"
        shiftHeld = false
        sequencerStep = 0
        presetName = "Mixtrack Go"
        audioStatus = "Audio off"
        oscStatus = "OSC off"
        oscInPort = 8000
        oscOutPort = 9000
        time = 0
        meters = MeterLevels()
        waveform = [Float](repeating: 0, count: 128)
        clips = []
        clipForLayer = [:]
        widgets = []
        texts = [:]
        dmxRoutes = [:]
        layerCount = 2
        mediaPage = 0
        thumbSpan = 0.45
        isfSource = ""
        isfMetal = ""
        isfNames = []
        isfGeneration = 0
        artnetStatus = "Art-Net off"
        serialStatus = "Serial closed"
        serialPath = "/dev/cu.usbmodem"
        serialTarget = "surface.a"
        recording = false
        recordStatus = "Not recording"
        clipToken = [:]
        canvasSizes = Self.defaultCanvases
        lfoTable = LFOShape.sineTable()
        fxPresets = [:]
        layerNames = LayerStack.titles
        layerLocked = Array(repeating: false, count: 8)
        layerOrder = [0, 1]
        blendScale = LayerStack.blendStops
        index = [:]
        partial14 = [:]
        held = [:]
        modeHeld = [:]
        lfoPhase = 0
        seqPhase = 0
        beatMarks = []
        lastOnset = nil
        bpmTouched = -100
        dirty = false
        saveAccum = 0
        sweep = []
        led = [:]
        sawGo = false
        loopStarted = false
        persistence = connectHardware
        sentOSC = [:]
        bindingHeld = [:]
        live = [:]
        meterAccum = 0
        lastDMX = []
        artnetSequence = 0
        artnetAccum = 0
        clockTicks = 0
        lastClockBeat = 0
        taps = []
        rebuild()
        if connectHardware {
            loadSession()
            midi = MIDIEngine()
            osc = OSCEngine()
            audio = AudioAnalyzer()
        }
    }

    public func start() async {
        midi?.onMessages = { [weak self] messages in
            Task { @MainActor in self?.ingest(messages) }
        }
        midi?.onSources = { [weak self] names, hasGo in
            Task { @MainActor in self?.devicesChanged(names, hasGo: hasGo) }
        }
        midi?.start()
        if let error = osc?.start(port: UInt16(oscInPort)) {
            oscStatus = error
        } else if osc != nil {
            osc?.outPort = UInt16(oscOutPort)
            oscStatus = "OSC in \(oscInPort) · out \(oscOutPort)"
        }
        if persistence {
            artnet = ArtNetEngine()
            if let error = artnet?.start() {
                artnetStatus = error
            } else if artnet != nil {
                artnetStatus = artnet?.status ?? "Art-Net 6454"
            }
            serial = SerialLink()
        }
        // The microphone prompt must not hold MIDI, OSC, or the picture clock.
        if !loopStarted {
            loopStarted = true
            Task { @MainActor in
                var last = Date().timeIntervalSinceReferenceDate
                while !Task.isCancelled {
                    let now = Date().timeIntervalSinceReferenceDate
                    let dt = min(0.05, max(0, now - last))
                    last = now
                    self.tick(dt)
                    try? await Task.sleep(for: .milliseconds(16))
                }
            }
        }
        await audio?.start()
        if let audio { audioStatus = audio.status }
    }

    // MARK: Input

    public func ingest(_ messages: [MIDIMessage]) {
        for message in messages {
            noteMonitor(message)
            if let target = learn {
                switch target {
                case let .hardware(id):
                    if !isRelease(message) {
                        rebindHardware(id, to: message)
                        learn = nil
                    }
                case let .midi(parameter):
                    if !isRelease(message) {
                        addMIDIBinding(parameter: parameter, message: message)
                        learn = nil
                        status = "Mapped \(ParamCatalog.byID[parameter]?.name ?? parameter)"
                    }
                case let .clip(id):
                    if case let .note(channel, note, velocity, on) = message, on, velocity > 0 {
                        setTriggerNote(id, "\(channel):\(note)")
                        learn = nil
                        status = "Clip trigger note \(channel).\(note)"
                        continue
                    }
                case .osc, .dmx:
                    break
                }
            }
            if case .clock = message {
                clockTicks += 1
                if clockTicks % 24 == 0 {
                    let interval = time - lastClockBeat
                    lastClockBeat = time
                    if interval > 0.2, interval < 2, values["clock.external", default: 0] > 0.5 {
                        write("clock.bpm", ParamCatalog.unit(fromBPM: 60 / interval))
                        bpmTouched = time
                    }
                }
                continue
            }
            if case let .transport(start) = message {
                write("clock.running", start ? 1 : 0)
                continue
            }
            guard let id = index[lookupKey(message)], let control = hardware.first(where: { $0.id == id }) else {
                applyLooseMIDI(message)
                continue
            }
            touch(id)
            switch control.kind {
            case .button:
                guard case let .note(_, _, velocity, on) = message else { continue }
                let down = on && velocity > 0
                let was = held[id] ?? false
                held[id] = down
                if down && !was { perform(control, value: 1, edge: .press) }
                if !down && was { perform(control, value: 0, edge: .release) }
            case .absolute:
                guard case let .cc(_, _, value) = message else { continue }
                let raw = Double(value) / 127
                physical[id] = raw
                perform(control, value: raw, edge: .change)
            case .absolute14:
                guard case let .cc(channel, controller, value) = message,
                      case let .cc14(_, msb, lsb) = control.address else { continue }
                var state = partial14[id] ?? (0, 0)
                if controller == msb { state.hi = value }
                if controller == lsb { state.lo = value }
                partial14[id] = state
                let raw = Double((state.hi << 7) | state.lo) / 16383
                physical[id] = raw
                perform(control, value: raw, edge: .change)
                _ = channel
            case .relative:
                guard case let .cc(_, _, value) = message else { continue }
                let ticks = signedMIDIStep(value)
                guard ticks != 0 else { continue }
                if id.hasPrefix("jog") { jogAngle[id, default: 0] += ticks * 0.08 }
                perform(control, value: ticks, edge: .change)
            }
            applyLooseMIDI(message)
        }
    }

    public func tick(_ dt: Double) {
        time += dt
        for key in Array(flash.keys) {
            let next = max(0, (flash[key] ?? 0) - dt * 2.2)
            if next <= 0.001 {
                flash.removeValue(forKey: key)
            } else {
                flash[key] = next
            }
        }
        for (_, started) in modeHeld where time - started > 0.45 {
            shiftHeld = true
        }

        let frame = audio?.pull()
        if let frame {
            write("audio.bass", frame.bass)
            write("audio.mid", frame.mid)
            write("audio.treble", frame.treble)
            write("audio.level", frame.level)
            if frame.onset { registerOnset() }
            if let status = audio?.status, status != audioStatus { audioStatus = status }
        }

        if values["clock.running", default: 1] > 0.5 {
            let bpm = ParamCatalog.bpm(from: values["clock.bpm", default: 0.5])
            var phase = readValue("clock.phase") + dt * bpm / 60
            if phase >= 1 { phase -= floor(phase) }
            write("clock.phase", phase)
        }

        let rate = 0.05 + values["lfo.rate", default: 0.25] * 8
        lfoPhase += dt * rate
        let shapeSpan = max(1, LFOShape.allCases.count - 1)
        let shapeIndex = Int((values["lfo.shape", default: 0] * Double(shapeSpan)).rounded())
        let shape = LFOShape(rawValue: min(shapeSpan, max(0, shapeIndex))) ?? .sine
        let amount = values["lfo.amount", default: 1]
        let sample = shape.sample(phase: lfoPhase, table: lfoTable)
        write("lfo.output", 0.5 + (sample - 0.5) * amount)

        if values["clock.running", default: 1] > 0.5 {
            let bpm = ParamCatalog.bpm(from: values["clock.bpm", default: 0.5])
            let stepsPerSecond = (bpm / 60) * (0.5 + values["seq.rate", default: 0.5] * 3)
            seqPhase += dt * stepsPerSecond
            while seqPhase >= 1 {
                seqPhase -= 1
                sequencerStep = (sequencerStep + 1) % 8
            }
            write("seq.output", values["seq.step\(sequencerStep)", default: 0])
        }

        for prefix in LayerStack.prefixes {
            write("\(prefix).hit", readValue("\(prefix).hit") * exp(-dt * 5))
            if values["\(prefix).sync", default: 0] > 0.5 {
                write("\(prefix).phase", readValue("clock.phase"))
            } else {
                let running = values["\(prefix).running", default: 0] > 0.5
                let speed = values["\(prefix).speed", default: 0.5]
                let motion = running ? 0.1 + speed * 0.85 : 0.03
                var phase = readValue("\(prefix).phase") + dt * motion
                phase -= floor(phase)
                write("\(prefix).phase", phase)
            }
        }

        meterAccum += dt
        if meterAccum >= 0.1 {
            meterAccum = 0
            let next = MeterLevels(
                bass: readValue("audio.bass"),
                mid: readValue("audio.mid"),
                treble: readValue("audio.treble"),
                level: readValue("audio.level"),
                lfo: readValue("lfo.output")
            )
            if next != meters { meters = next }
            if let audio { waveform = audio.waveform() }
        }

        pollArtNet()
        if let line = serial?.readLine() { ingestSerial(line) }
        artnetAccum += dt
        if artnetAccum >= 0.05 {
            artnetAccum = 0
            publishArtNet()
        }

        applyAutomation()
        pollOSC()
        publishOSC()
        serviceLEDs()

        if persistence {
            saveAccum += dt
            if dirty && saveAccum > 1.5 {
                saveSession()
                dirty = false
                saveAccum = 0
            }
        }
    }

    // MARK: Editing

    public func setParameter(_ id: String, _ value: Double, user: Bool = false) {
        if user && id == "clock.bpm" { bpmTouched = time }
        write(id, value)
        if user { selectedParameter = id }
    }

    public func toggle(_ id: String) {
        let next = (values[id] ?? 0) > 0.5 ? 0.0 : 1.0
        write(id, next)
    }

    public func tap(_ id: String) {
        guard let control = hardware.first(where: { $0.id == id }) else { return }
        switch control.address {
        case let .note(channel, note):
            ingest([
                .note(channel: channel, note: note, velocity: 127, on: true),
                .note(channel: channel, note: note, velocity: 0, on: false),
            ])
        default:
            break
        }
    }

    public func moveAbsolute(_ id: String, _ raw: Double) {
        guard let control = hardware.first(where: { $0.id == id }) else { return }
        let unit = min(1, max(0, raw))
        switch control.address {
        case let .cc(channel, controller):
            ingest([.cc(channel: channel, controller: controller, value: Int((unit * 127).rounded()))])
        case let .cc14(channel, msb, lsb):
            let full = Int((unit * 16383).rounded())
            ingest([
                .cc(channel: channel, controller: msb, value: full >> 7),
                .cc(channel: channel, controller: lsb, value: full & 127),
            ])
        default:
            break
        }
    }

    public func nudgeRelative(_ id: String, ticks: Int) {
        guard ticks != 0, let control = hardware.first(where: { $0.id == id }),
              case let .cc(channel, controller) = control.address else { return }
        let clamped = min(63, max(-63, ticks))
        let value = clamped > 0 ? clamped : 128 + clamped
        ingest([.cc(channel: channel, controller: controller, value: value)])
    }

    public func beginMIDILearn(_ parameter: String) {
        learn = .midi(parameter)
        selectedParameter = parameter
        status = "MIDI learn · move \(ParamCatalog.byID[parameter]?.name ?? parameter)"
    }

    public func beginOSCLearn(_ parameter: String) {
        learn = .osc(parameter)
        selectedParameter = parameter
        status = "OSC learn · send a message"
    }

    public func beginHardwareRelearn(_ id: String) {
        learn = .hardware(id)
        selectedControl = id
        status = "Relearn \(hardware.first { $0.id == id }?.name ?? id) · move it on the Go"
    }

    public func cancelLearn() {
        learn = nil
        status = deviceConnected ? "Mixtrack Go connected" : status
    }

    public func attach(_ parameter: String, source: BindingSource) {
        let behavior: BindingBehavior = ParamCatalog.byID[parameter]?.kind == .toggle ? .toggle : .absolute
        bindings.append(UserBinding(source: source, parameter: parameter, behavior: behavior))
        dirty = true
        selectedParameter = parameter
    }

    public func clearBindings(for parameter: String) {
        bindings.removeAll { $0.parameter == parameter }
        dirty = true
    }

    public func updateBinding(_ id: UUID, _ edit: (inout UserBinding) -> Void) {
        guard let index = bindings.firstIndex(where: { $0.id == id }) else { return }
        edit(&bindings[index])
        dirty = true
    }

    public func removeBinding(_ id: UUID) {
        bindings.removeAll { $0.id == id }
        dirty = true
    }

    public func setTuning(_ id: String, _ value: Tuning) {
        tuning[id] = value
        dirty = true
    }

    public func focusedPrefix() -> String {
        LayerStack.prefix(for: focusedDeck)
    }

    public func loadFocused() {
        let layer = focusedPrefix()
        write("\(layer).shader", values["media.index"] ?? 0)
        write("\(layer).source", 0)
    }

    public func selectShader(_ index: Int, load: Bool) {
        write("media.index", Shaders.unit(for: index))
        if load { loadFocused() }
    }

    public func layerName(_ index: Int) -> String {
        guard layerNames.indices.contains(index) else { return LayerStack.titles[index] }
        let trimmed = layerNames[index].trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? LayerStack.titles[index] : trimmed
    }

    public func renameLayer(_ index: Int, _ name: String) {
        guard layerNames.indices.contains(index) else { return }
        var names = layerNames
        names[index] = String(name.prefix(40))
        layerNames = names
        dirty = true
    }

    public func setLayerLocked(_ index: Int, _ locked: Bool) {
        guard layerLocked.indices.contains(index) else { return }
        var flags = layerLocked
        flags[index] = locked
        layerLocked = flags
        dirty = true
    }

    /// `rank` 0 is the front of the stack, the top row in the layers panel.
    public func placeLayer(_ index: Int, atFrontRank rank: Int) {
        guard layerOrder.contains(index) else { return }
        if layerLocked.indices.contains(index), layerLocked[index] {
            status = "Unlock \(layerName(index)) to reorder it"
            return
        }
        var visual = Array(layerOrder.reversed())
        visual.removeAll { $0 == index }
        visual.insert(index, at: min(max(0, rank), visual.count))
        layerOrder = Array(visual.reversed())
        dirty = true
    }

    public func focusLayer(_ index: Int) {
        guard layerOrder.contains(index) else { return }
        focusedDeck = LayerStack.focusTag(for: index)
    }

    public func addLayer() {
        guard layerCount < LayerStack.prefixes.count else {
            status = "Eight layers is the stack limit"
            return
        }
        guard let index = (0..<LayerStack.prefixes.count).first(where: { !layerOrder.contains($0) }) else { return }
        var names = layerNames
        if names.indices.contains(index) { names[index] = LayerStack.titles[index] }
        layerNames = names
        var flags = layerLocked
        if flags.indices.contains(index) { flags[index] = false }
        layerLocked = flags
        layerOrder.append(index)
        layerCount = layerOrder.count
        let prefix = LayerStack.prefixes[index]
        write("\(prefix).opacity", 0.85)
        write("\(prefix).source", 0)
        write("\(prefix).visible", 1)
        focusedDeck = LayerStack.focusTag(for: index)
        dirty = true
    }

    public func duplicateFocusedLayer() {
        guard layerCount < LayerStack.prefixes.count else {
            status = "Eight layers is the stack limit"
            return
        }
        let sourceIndex = LayerStack.index(of: focusedPrefix())
        guard let destIndex = (0..<LayerStack.prefixes.count).first(where: { !layerOrder.contains($0) }) else { return }
        let from = LayerStack.prefixes[sourceIndex]
        let to = LayerStack.prefixes[destIndex]
        var next = values
        for spec in ParamCatalog.all where spec.id.hasPrefix(from + ".") && spec.kind != .readout {
            let rest = String(spec.id.dropFirst(from.count))
            next[to + rest] = values[spec.id] ?? spec.defaultValue
        }
        values = next
        texts[to] = texts[from]
        if let clip = clipForLayer[from] {
            clipForLayer[to] = clip
            clipToken[to, default: 0] += 1
        }
        sourceAspect[to] = sourceAspect[from]
        var names = layerNames
        if names.indices.contains(destIndex) {
            names[destIndex] = String((layerName(sourceIndex) + " copy").prefix(40))
        }
        layerNames = names
        var flags = layerLocked
        if flags.indices.contains(destIndex) { flags[destIndex] = false }
        layerLocked = flags
        layerOrder.append(destIndex)
        layerCount = layerOrder.count
        focusedDeck = LayerStack.focusTag(for: destIndex)
        dirty = true
        status = "Duplicated \(layerName(sourceIndex))"
    }

    public func deleteFocusedLayer() {
        let index = LayerStack.index(of: focusedPrefix())
        if index < 2 {
            status = "Deck A and Deck B stay mapped to the Mixtrack"
            return
        }
        if layerLocked.indices.contains(index), layerLocked[index] {
            status = "Unlock \(layerName(index)) to delete it"
            return
        }
        closeLayer(at: index)
    }

    public func removeLayer() {
        guard let index = layerOrder.filter({ $0 >= 2 }).max() else { return }
        closeLayer(at: index)
    }

    private func closeLayer(at index: Int) {
        guard index >= 2, layerOrder.contains(index) else { return }
        layerOrder.removeAll { $0 == index }
        layerCount = layerOrder.count
        write("\(LayerStack.prefixes[index]).opacity", 0)
        if focusedDeck == LayerStack.focusTag(for: index) {
            focusedDeck = layerOrder.last.map { LayerStack.focusTag(for: $0) } ?? "A"
        }
        dirty = true
    }

    public func importFile(url: URL) {
        let ext = url.pathExtension.lowercased()
        let kind: String
        if ["fs", "isf"].contains(ext) { kind = "isf" }
        else if ["png", "jpg", "jpeg", "tif", "tiff", "heic", "gif", "bmp", "webp"].contains(ext) { kind = "image" }
        else if ["txt", "md", "rtf"].contains(ext) { kind = "text" }
        else if ext == "qtz" { kind = "quartz" }
        else if ext == "swf" { kind = "flash" }
        else if ext == "vuo" { kind = "vuo" }
        else { kind = "movie" }
        var note = ""
        if kind == "quartz" {
            note = "Quartz Composer files are not loaded. This macOS does not include that runtime."
        } else if kind == "flash" {
            note = "Flash Player is not on this Mac. Export a movie instead."
        } else if kind == "vuo" {
            note = "Vuo is not linked. Drop an ISF shader or a movie."
        } else if kind == "movie" {
            note = ""
            primePaths.append(url.path)
        }
        if kind == "isf", let source = try? String(contentsOf: url, encoding: .utf8) {
            loadISF(source)
        }
        if kind == "text", let source = try? String(contentsOf: url, encoding: .utf8) {
            texts[focusedPrefix()] = String(source.prefix(400))
            write("\(focusedPrefix()).source", LayerStack.unit(for: "Text"))
        }
        let clip = MediaClip(name: url.deletingPathExtension().lastPathComponent, path: url.path, kind: kind, page: mediaPage, note: note)
        clips.append(clip)
        if kind == "movie" || kind == "image" {
            assign(clip)
        }
        dirty = true
        status = "Added \(clip.name)"
    }

    public func assign(_ clip: MediaClip) {
        let prefix = focusedPrefix()
        clipForLayer[prefix] = clip.id
        clipToken[prefix, default: 0] += 1
        switch clip.kind {
        case "isf":
            if let source = try? String(contentsOfFile: clip.path, encoding: .utf8) { loadISF(source) }
            write("\(prefix).source", LayerStack.unit(for: "ISF"))
        case "image", "movie":
            write("\(prefix).source", LayerStack.unit(for: "Media"))
        case "text":
            write("\(prefix).source", LayerStack.unit(for: "Text"))
        default:
            break
        }
        dirty = true
    }

    public func setClip(note: String, id: UUID) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].note = note
    }

    public func setClipDetail(_ detail: String, id: UUID) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].detail = detail
    }

    public func setTriggerNote(_ id: UUID, _ note: String) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        for other in clips.indices where clips[other].triggerNote == note && clips[other].id != id {
            clips[other].triggerNote = ""
        }
        clips[index].triggerNote = note
        dirty = true
    }

    public func beginClipTrigger(_ id: UUID) {
        learn = .clip(id)
        status = "Clip trigger · press a MIDI note that is not a Mixtrack factory button"
    }

    public func swapClip(_ id: UUID, url: URL) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].path = url.path
        clips[index].name = url.deletingPathExtension().lastPathComponent
        clips[index].note = ""
        clips[index].detail = ""
        primePaths.append(url.path)
        dirty = true
        status = "Swapped \(clips[index].name)"
    }

    public func nudge(_ prefix: String, _ seconds: Double) {
        nudges[prefix, default: 0] += seconds
    }

    public func takeNudge(_ prefix: String) -> Double {
        let value = nudges[prefix] ?? 0
        nudges[prefix] = 0
        return value
    }

    public func setAspect(_ prefix: String, _ aspect: Double) {
        guard aspect.isFinite, aspect > 0.05 else { return }
        if let old = sourceAspect[prefix], abs(old - aspect) < 0.02 { return }
        sourceAspect[prefix] = aspect
    }

    public func pullPrimePaths() -> [String] {
        let paths = primePaths
        primePaths.removeAll(keepingCapacity: true)
        return paths
    }

    public func setCanvasSize(index: Int, width: Int, height: Int) {
        guard canvasSizes.indices.contains(index) else { return }
        canvasSizes[index].width = min(3840, max(0, width))
        canvasSizes[index].height = min(3840, max(0, height))
        dirty = true
    }

    public func setLFOSample(index: Int, value: Double) {
        guard lfoTable.indices.contains(index) else { return }
        lfoTable[index] = min(1, max(0, value))
        dirty = true
    }

    public func saveFX(named name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        let prefix = focusedPrefix()
        var bag: [String: Double] = [:]
        for key in ["effect0", "effect0amt", "effect1", "effect1amt", "effect2", "effect2amt", "grade", "fit", "feather", "opacity", "hue", "warp"] {
            bag[key] = values["\(prefix).\(key)"] ?? 0
        }
        fxPresets[clean] = bag
        dirty = true
        status = "Saved FX \(clean)"
    }

    public func recallFX(named name: String) {
        guard let bag = fxPresets[name] else { return }
        let prefix = focusedPrefix()
        for (key, value) in bag {
            write("\(prefix).\(key)", value)
        }
        status = "Recalled FX \(name)"
    }

    public func cycleLabel(_ id: UUID) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].label = (clips[index].label + 1) % 6
        dirty = true
    }

    public func setTrigger(_ id: UUID, _ trigger: String) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].trigger = trigger
        dirty = true
    }

    public func moveClip(_ id: UUID, page: Int) {
        guard let index = clips.firstIndex(where: { $0.id == id }) else { return }
        clips[index].page = max(0, min(7, page))
        dirty = true
    }

    public func setText(for prefix: String, _ text: String) {
        texts[prefix] = text
        dirty = true
    }

    public func loadISF(_ source: String) {
        guard let shader = ISFTranslator.parse(source) else {
            status = "That file is not an ISF shader this build can read"
            return
        }
        isfSource = source
        isfMetal = shader.metal
        isfNames = shader.inputs.map(\.name)
        for (index, input) in shader.inputs.enumerated() where index < 8 {
            write("isf.\(index)", input.value)
        }
        isfGeneration += 1
        write("\(focusedPrefix()).source", LayerStack.unit(for: "ISF"))
        status = "ISF \(shader.title)"
        dirty = true
    }

    public func addWidget(_ kind: String) {
        let parameter = selectedParameter ?? "surface.a"
        let label = ParamCatalog.byID[parameter]?.name ?? parameter
        widgets.append(SurfaceWidget(kind: kind, label: label, parameter: parameter))
        dirty = true
    }

    public func removeWidget(_ id: UUID) {
        widgets.removeAll { $0.id == id }
        dirty = true
    }

    public func tapTempo() {
        taps.append(time)
        taps = taps.filter { time - $0 < 3 }
        guard taps.count >= 2 else {
            status = "Tap again"
            return
        }
        let intervals = zip(taps, taps.dropFirst()).map { $1 - $0 }
        let average = intervals.reduce(0, +) / Double(intervals.count)
        guard average > 0.18 else { return }
        write("clock.bpm", ParamCatalog.unit(fromBPM: 60 / average))
        bpmTouched = time
        status = "Tap \(Int((60 / average).rounded())) BPM"
    }

    public func beginDMXLearn(_ parameter: String) {
        learn = .dmx(parameter)
        selectedParameter = parameter
        status = "DMX learn · move a channel"
    }

    public func connectSerial() {
        serial = serial ?? SerialLink()
        if let error = serial?.open(path: serialPath) {
            serialStatus = error
        } else {
            serialTarget = selectedParameter ?? serialTarget
            serialStatus = "Serial \(serialPath) → \(ParamCatalog.byID[serialTarget]?.name ?? serialTarget)"
        }
    }

    public func disconnectSerial() {
        serial?.close()
        serialStatus = "Serial closed"
    }

    public func useCamera() {
        write("\(focusedPrefix()).source", LayerStack.unit(for: "Camera"))
        status = "Camera on \(LayerStack.titles[LayerStack.index(of: focusedPrefix())])"
    }

    public func useScreen() {
        write("\(focusedPrefix()).source", LayerStack.unit(for: "Screen"))
        status = "Screen on \(LayerStack.titles[LayerStack.index(of: focusedPrefix())])"
    }

    public func useFeedback() {
        write("\(focusedPrefix()).source", LayerStack.unit(for: "Feedback"))
    }

    public func toggleRecording() {
        recording.toggle()
        recordStatus = recording ? "Recording" : "Not recording"
    }

    public func setRecordStatus(_ text: String) {
        recordStatus = text
        if text.hasPrefix("Couldn't") || text.hasPrefix("Saved") { recording = false }
    }

    public func movePanel(_ id: String, x: Double, y: Double, width: Double? = nil, height: Double? = nil) {
        guard let index = panels.firstIndex(where: { $0.id == id }) else { return }
        panels[index].x = x
        panels[index].y = y
        if let width { panels[index].width = max(220, width) }
        if let height { panels[index].height = max(140, height) }
        dirty = true
    }

    public func bringToFront(_ id: String) {
        guard let index = panels.firstIndex(where: { $0.id == id }) else { return }
        let panel = panels.remove(at: index)
        panels.append(panel)
    }

    public func setPanelOpen(_ kind: String, _ open: Bool) {
        guard let index = panels.firstIndex(where: { $0.kind == kind }) else { return }
        panels[index].open = open
        if open { bringToFront(panels[index].id) }
        dirty = true
    }

    public func mapAddressKey(_ key: String, to parameter: String) {
        guard let address = Self.parseAddress(key) else { return }
        let relative = key.hasPrefix("cc:") && (parameter == "media.index" || parameter.hasSuffix(".phase"))
        let behavior: BindingBehavior = ParamCatalog.byID[parameter]?.kind == .toggle ? .toggle : (relative ? .relative(step: 0.02) : .absolute)
        bindings.append(UserBinding(source: .midi(address, relative: relative), parameter: parameter, behavior: behavior))
        dirty = true
        status = "Mapped \(key) to \(ParamCatalog.byID[parameter]?.name ?? parameter)"
    }

    // MARK: Presets

    public func presetNames() -> [String] {
        let folder = Self.presetsFolder()
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.map { $0.deletingPathExtension().lastPathComponent }.sorted()
    }

    public func savePreset(named name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        presetName = clean
        let document = PresetDocument(
            name: clean,
            values: values.filter { !Self.volatile($0.key) },
            bindings: bindings,
            tuning: tuning,
            panels: panels,
            addresses: Dictionary(uniqueKeysWithValues: hardware.map { ($0.id, $0.address) }),
            clips: clips,
            widgets: widgets,
            texts: texts,
            dmxRoutes: Dictionary(uniqueKeysWithValues: dmxRoutes.map { (String($0.key), $0.value) }),
            layerCount: layerCount,
            isfSource: isfSource,
            canvasSizes: canvasSizes,
            lfoTable: lfoTable,
            fxPresets: fxPresets,
            layerNames: layerNames,
            layerLocked: layerLocked,
            layerOrder: layerOrder,
            blendScale: blendScale
        )
        do {
            let url = Self.presetsFolder().appendingPathComponent(clean).appendingPathExtension("json")
            let data = try JSONEncoder().encode(document)
            try data.write(to: url, options: .atomic)
            status = "Saved preset \(clean)"
            saveSession()
        } catch {
            status = "Couldn't save preset"
        }
    }

    public func loadPreset(named name: String) {
        let url = Self.presetsFolder().appendingPathComponent(name).appendingPathExtension("json")
        guard let data = try? Data(contentsOf: url),
              let document = try? JSONDecoder().decode(PresetDocument.self, from: data) else {
            status = "Couldn't open \(name)"
            return
        }
        apply(document)
        presetName = document.name
        status = "Recalled \(document.name)"
        saveSession()
    }

    public func uniformPack(aspect: Double, width: Double = 1, height: Double = 1) -> [Float] {
        var merged = values
        for (key, value) in live { merged[key] = value }
        let hidden = Set((0..<LayerStack.prefixes.count).filter { index in
            (merged["\(LayerStack.prefixes[index]).visible"] ?? 1) < 0.5
        })
        return UniformPack.pack(values: merged, time: time, aspect: aspect, width: width, height: height, aspects: sourceAspect, order: layerOrder, hidden: hidden)
    }

    /// Current value, including frame-rate signals that are not stored in `values`.
    public func value(for id: String) -> Double {
        readValue(id)
    }

    // MARK: Factory routes

    private enum Edge { case press, release, change }

    private func perform(_ control: HardwareControl, value: Double, edge: Edge) {
        let tune = tuning[control.id] ?? Tuning()
        let side = control.deck
        let layer = side == "B" ? "layerB" : "layerA"
        if let side { focusedDeck = side == "B" ? "B" : (side == "A" ? "A" : focusedDeck) }
        let base = control.id.split(separator: ".").first.map(String.init) ?? control.id

        switch base {
        case "play":
            guard edge == .press else { return }
            if shiftHeld {
                write("\(layer).phase", 0)
                write("\(layer).running", 1)
                write("\(layer).hit", 1)
            } else {
                toggle("\(layer).running")
            }
        case "cue":
            guard edge == .press else { return }
            write("\(layer).phase", 0)
            write("\(layer).hit", 1)
            if shiftHeld { write("\(layer).running", 0) }
        case "sync":
            guard edge == .press else { return }
            if shiftHeld {
                write("\(layer).speed", 0.5)
                write("\(layer).sync", 0)
                physical["pitch.\(side ?? "A")"] = 0.5
            } else {
                toggle("\(layer).sync")
            }
        case "mode":
            if edge == .press {
                modeHeld[control.id] = time
            } else if edge == .release {
                let started = modeHeld[control.id] ?? time
                modeHeld[control.id] = nil
                if time - started < 0.45 {
                    let current = Int((values["\(layer).padMode"] ?? 0).rounded())
                    write("\(layer).padMode", Double((current + 1) % MixtrackProfile.padModes.count))
                }
                shiftHeld = false
            }
        case "pad1", "pad2", "pad3", "pad4":
            guard edge == .press, let digit = base.last, let number = Int(String(digit)) else { return }
            firePad(layer: layer, index: number - 1)
        case "jog":
            let scale = shiftHeld ? 0.04 : 0.012
            var phase = readValue("\(layer).phase") + value * scale * (tune.invert ? -1 : 1)
            phase -= floor(phase)
            write("\(layer).phase", phase)
        case "pitch":
            write("\(layer).speed", tune.shape(value))
        case "filter":
            write("\(layer).hue", tune.shape(value))
        case "level":
            write("\(layer).opacity", tune.shape(value))
        case "xfade":
            write("master.crossfade", tune.shape(value))
            if values["master.fadeFX", default: 0] > 0.5 {
                write("layerA.warp", min(1, max(0, value)))
                write("layerB.warp", min(1, max(0, 1 - value)))
            }
        case "cuegain":
            write("master.previewZoom", tune.shape(value))
        case "main":
            write("master.brightness", tune.shape(value))
        case "browse":
            let step = 1 / Double(Shaders.names.count - 1)
            let direction = tune.invert ? -1.0 : 1.0
            let next = min(1, max(0, (values["media.index"] ?? 0) + value * step * direction))
            write("media.index", next)
        default:
            break
        }
    }

    private func firePad(layer: String, index: Int) {
        let mode = Int((values["\(layer).padMode"] ?? 0).rounded())
        if shiftHeld && mode == 0 {
            write("\(layer).hue", 0.5)
            return
        }
        switch mode {
        case 0:
            write("\(layer).hue", [0.02, 0.14, 0.48, 0.74][index])
            write("\(layer).hit", 1)
        case 1:
            write("\(layer).warp", [0.08, 0.28, 0.55, 0.92][index])
        case 2:
            write("\(layer).warp", min(1, (values["\(layer).warp"] ?? 0) + 0.22))
            write("\(layer).hit", 1)
        case 3:
            write("\(layer).shader", Shaders.unit(for: index))
            write("\(layer).hit", 1)
        default:
            write("\(layer).stem", Double(index))
            write("\(layer).hit", 1)
        }
    }

    private func applyLooseMIDI(_ message: MIDIMessage) {
        if case let .note(channel, note, velocity, on) = message, on, velocity > 0 {
            let key = "\(channel):\(note)"
            if let clip = clips.first(where: { $0.triggerNote == key }) {
                assign(clip)
                write("\(focusedPrefix()).running", 1)
                status = "Triggered \(clip.name)"
            }
        }
        for binding in bindings {
            guard case let .midi(address, relative) = binding.source else { continue }
            switch address {
            case let .note(channel, note):
                guard case let .note(messageChannel, messageNote, velocity, on) = message,
                      messageChannel == channel, messageNote == note else { continue }
                let down = on && velocity > 0
                let was = bindingHeld[binding.id] ?? false
                guard down != was else { continue }
                bindingHeld[binding.id] = down
                apply(binding, unit: down ? 1 : 0, ticks: 0, edgePress: down)
            case let .cc(channel, controller):
                guard case let .cc(messageChannel, messageController, value) = message,
                      messageChannel == channel, messageController == controller else { continue }
                if relative {
                    apply(binding, unit: 0, ticks: signedMIDIStep(value), edgePress: false)
                } else if binding.behavior == .toggle || binding.behavior == .trigger || binding.behavior == .momentary {
                    let down = value > 0
                    let was = bindingHeld[binding.id] ?? false
                    guard down != was else { continue }
                    bindingHeld[binding.id] = down
                    apply(binding, unit: down ? 1 : 0, ticks: 0, edgePress: down)
                } else {
                    apply(binding, unit: Double(value) / 127, ticks: 0, edgePress: false)
                }
            case let .cc14(channel, msb, lsb):
                guard case let .cc(messageChannel, messageController, value) = message,
                      messageChannel == channel, messageController == msb || messageController == lsb else { continue }
                var state = partial14[address.key] ?? (0, 0)
                if messageController == msb { state.hi = value }
                if messageController == lsb { state.lo = value }
                partial14[address.key] = state
                let unit = Double((state.hi << 7) | state.lo) / 16383
                apply(binding, unit: unit, ticks: 0, edgePress: false)
            }
        }
    }

    private func apply(_ binding: UserBinding, unit: Double, ticks: Double, edgePress: Bool) {
        switch binding.behavior {
        case .absolute:
            write(binding.parameter, binding.tuning.shape(unit))
        case let .relative(step):
            let direction = binding.tuning.invert ? -1.0 : 1.0
            let next = (values[binding.parameter] ?? 0) + ticks * step * direction
            write(binding.parameter, next)
        case .momentary:
            write(binding.parameter, unit > 0.5 ? binding.tuning.shape(1) : binding.tuning.minimum)
        case .toggle:
            if edgePress { toggle(binding.parameter) }
        case .trigger:
            if edgePress {
                if binding.parameter == "action.load" { loadFocused() }
                else { toggle(binding.parameter) }
            }
        }
    }

    private func applyAutomation() {
        var writes: [(String, Double)] = []
        for binding in bindings {
            let unit: Double?
            switch binding.source {
            case .lfo:
                unit = readValue("lfo.output")
            case let .audioBand(band):
                unit = readValue("audio.\(band)")
            case .clock:
                unit = readValue("clock.phase")
            case .sequencer:
                unit = readValue("seq.output")
            case let .parameter(id):
                unit = values[id]
            case .midi, .osc:
                unit = nil
            }
            guard let unit, binding.behavior == .absolute else { continue }
            writes.append((binding.parameter, binding.tuning.shape(unit)))
        }
        for (id, value) in writes { write(id, value) }
    }

    private func pollOSC() {
        for message in osc?.poll() ?? [] {
            if case let .osc(parameter) = learn {
                bindings.append(UserBinding(
                    source: .osc(message.address),
                    parameter: parameter,
                    behavior: ParamCatalog.byID[parameter]?.kind == .toggle ? .toggle : .absolute
                ))
                learn = nil
                dirty = true
                status = "OSC \(message.address) → \(ParamCatalog.byID[parameter]?.name ?? parameter)"
            }
            if let id = Self.parameterID(from: message.address) {
                write(id, min(1, max(0, message.primary)))
            }
            for binding in bindings {
                guard case let .osc(path) = binding.source, path == message.address else { continue }
                apply(binding, unit: min(1, max(0, message.primary)), ticks: 0, edgePress: message.primary > 0.5)
            }
            monitor.insert(MonitorEntry(id: UUID(), text: "OSC \(message.address) \(message.primary)", addressKey: message.address, value: Int(message.primary * 127)), at: 0)
            if monitor.count > 40 { monitor.removeLast(monitor.count - 40) }
        }
    }

    private func publishOSC() {
        guard osc != nil else { return }
        for spec in ParamCatalog.all where spec.kind != .readout {
            if spec.id.hasSuffix(".phase") || spec.id.hasSuffix(".hit") { continue }
            let value = values[spec.id] ?? 0
            if let previous = sentOSC[spec.id], abs(previous - value) < 0.004 { continue }
            sentOSC[spec.id] = value
            let path = "/visionboard/" + spec.id.replacingOccurrences(of: ".", with: "/")
            osc?.send(OSCMessage(address: path, values: [.float(value)]))
        }
    }

    // MARK: Hardware bookkeeping

    private func devicesChanged(_ names: [String], hasGo: Bool) {
        sources = names
        deviceConnected = hasGo
        if hasGo && !sawGo {
            sawGo = true
            queueSweep()
            status = "Mixtrack Go connected"
        } else if !hasGo {
            sawGo = false
            status = names.isEmpty ? "No MIDI input. Quit Serato, then plug in the Go." : "MIDI: \(names.joined(separator: ", "))"
        }
    }

    private func rebindHardware(_ id: String, to message: MIDIMessage) {
        guard let slot = hardware.firstIndex(where: { $0.id == id }) else { return }
        let kind = hardware[slot].kind
        hardware[slot].address = Self.address(from: message, kind: kind)
        hardware[slot].confidence = .learned
        rebuild()
        dirty = true
        status = "\(hardware[slot].name) is now \(hardware[slot].address.shortLabel)"
    }

    private func addMIDIBinding(parameter: String, message: MIDIMessage) {
        if let id = index[lookupKey(message)],
           let control = hardware.first(where: { $0.id == id }),
           factoryTargets(control).contains(parameter) {
            status = "\(control.name) already drives \(ParamCatalog.byID[parameter]?.name ?? parameter)"
            return
        }
        let address: MIDIAddress
        let relative: Bool
        if let id = index[lookupKey(message)], let control = hardware.first(where: { $0.id == id }) {
            address = control.address
            relative = control.kind == .relative
        } else {
            address = Self.address(from: message, kind: nil)
            relative = false
        }
        let behavior: BindingBehavior
        if ParamCatalog.byID[parameter]?.kind == .toggle || addressNote(address) {
            behavior = .toggle
        } else if relative {
            behavior = .relative(step: 0.02)
        } else {
            behavior = .absolute
        }
        bindings.append(UserBinding(source: .midi(address, relative: relative), parameter: parameter, behavior: behavior))
        dirty = true
    }

    private func factoryTargets(_ control: HardwareControl) -> Set<String> {
        let layer = control.deck == "B" ? "layerB" : "layerA"
        switch control.id.split(separator: ".").first.map(String.init) ?? control.id {
        case "play": return ["\(layer).running"]
        case "pitch": return ["\(layer).speed"]
        case "filter": return ["\(layer).hue"]
        case "level": return ["\(layer).opacity"]
        case "xfade": return ["master.crossfade"]
        case "main": return ["master.brightness"]
        case "cuegain": return ["master.previewZoom"]
        case "browse": return ["media.index"]
        default: return []
        }
    }

    private func rebuild() {
        index = [:]
        for control in hardware {
            switch control.address {
            case let .note(channel, note):
                index["note:\(channel):\(note)"] = control.id
            case let .cc(channel, controller):
                index["cc:\(channel):\(controller)"] = control.id
            case let .cc14(channel, msb, lsb):
                index["cc:\(channel):\(msb)"] = control.id
                index["cc:\(channel):\(lsb)"] = control.id
            }
        }
    }

    private func touch(_ id: String) {
        flash[id] = 1
        selectedControl = id
    }

    private func lookupKey(_ message: MIDIMessage) -> String {
        switch message {
        case let .note(channel, note, _, _): "note:\(channel):\(note)"
        case let .cc(channel, controller, _): "cc:\(channel):\(controller)"
        case .clock: "clock"
        case let .transport(start): start ? "start" : "stop"
        case let .other(status): "other:\(status)"
        }
    }

    private func isRelease(_ message: MIDIMessage) -> Bool {
        if case let .note(_, _, _, on) = message { return !on }
        return false
    }

    private func noteMonitor(_ message: MIDIMessage) {
        let key = lookupKey(message)
        let value: Int
        switch message {
        case let .note(_, _, velocity, _): value = velocity
        case let .cc(_, _, raw): value = raw
        case .clock: value = 0
        case let .transport(start): value = start ? 1 : 0
        case let .other(status): value = status
        }
        let owner = index[key].flatMap { id in hardware.first { $0.id == id }?.name }
        let label = owner ?? "unassigned"
        monitor.insert(MonitorEntry(id: UUID(), text: "\(message.summary) · \(label)", addressKey: key, value: value), at: 0)
        if monitor.count > 40 { monitor.removeLast(monitor.count - 40) }
    }

    private func registerOnset() {
        guard values["clock.follow", default: 1] > 0.5 else { return }
        if let lastOnset {
            let interval = time - lastOnset
            if interval > 0.28 && interval < 1.1 {
                beatMarks.append(interval)
                if beatMarks.count > 8 { beatMarks.removeFirst(beatMarks.count - 8) }
                if time - bpmTouched > 8, beatMarks.count >= 4 {
                    let median = beatMarks.sorted()[beatMarks.count / 2]
                    write("clock.bpm", ParamCatalog.unit(fromBPM: 60 / median))
                }
            }
        }
        lastOnset = time
    }

    private func queueSweep() {
        sweep.removeAll(keepingCapacity: true)
        for channel in [0, 1, 4, 5, 15] {
            for note in 0..<128 { sweep.append((channel, note)) }
        }
        led.removeAll()
    }

    private func serviceLEDs() {
        guard deviceConnected, midi != nil else { return }
        if !sweep.isEmpty {
            for _ in 0..<48 where !sweep.isEmpty {
                let item = sweep.removeFirst()
                midi?.sendNote(channel: item.channel, note: item.note, velocity: 0)
            }
            if sweep.isEmpty { led.removeAll() }
            return
        }
        func want(_ id: String, _ on: Bool) {
            guard let control = hardware.first(where: { $0.id == id }),
                  case let .note(channel, note) = control.address else { return }
            let velocity = on ? 127 : 0
            let key = control.address.key
            if led[key] == velocity { return }
            led[key] = velocity
            midi?.sendNote(channel: channel, note: note, velocity: velocity)
        }
        for side in ["A", "B"] {
            let layer = side == "A" ? "layerA" : "layerB"
            want("play.\(side)", values["\(layer).running", default: 0] > 0.5)
            want("sync.\(side)", values["\(layer).sync", default: 0] > 0.5)
            want("mode.\(side)", true)
            let mode = Int((values["\(layer).padMode"] ?? 0).rounded())
            for pad in 0..<4 {
                let on: Bool
                switch mode {
                case 3:
                    on = Shaders.index(from: values["\(layer).shader"] ?? 0) == pad
                case 4:
                    on = Int((values["\(layer).stem"] ?? 3).rounded()) == pad
                default:
                    on = false
                }
                want("pad\(pad + 1).\(side)", on)
            }
        }
    }

    private func pollArtNet() {
        for packet in artnet?.poll() ?? [] {
            if case let .dmx(parameter) = learn {
                var channel = 0
                var best = 0
                for index in packet.channels.indices {
                    let previous = index < lastDMX.count ? Int(lastDMX[index]) : 0
                    let delta = abs(Int(packet.channels[index]) - previous)
                    if delta > best {
                        best = delta
                        channel = index
                    }
                }
                if best > 0 {
                    dmxRoutes[channel] = parameter
                    learn = nil
                    dirty = true
                    status = "DMX ch \(channel + 1) → \(ParamCatalog.byID[parameter]?.name ?? parameter)"
                }
            }
            for (channel, parameter) in dmxRoutes where channel < packet.channels.count {
                write(parameter, Double(packet.channels[channel]) / 255)
            }
            lastDMX = packet.channels
        }
    }

    private func publishArtNet() {
        guard values["master.artnetOut", default: 0] > 0.5 else { return }
        var channels = [UInt8](repeating: 0, count: 16)
        let ids = ["master.brightness", "master.crossfade", "audio.bass", "audio.mid", "audio.treble", "layerA.opacity", "layerB.opacity", "master.feedback"]
        for (index, id) in ids.enumerated() {
            channels[index] = UInt8(min(255, max(0, readValue(id) * 255)))
        }
        artnetSequence = (artnetSequence + 1) & 0xFF
        artnet?.send(ArtDmx(universe: 0, sequence: artnetSequence, channels: channels))
    }

    private func ingestSerial(_ line: String) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard let number = Double(trimmed) else {
            status = "Serial \(trimmed)"
            return
        }
        let unit = number > 1 ? number / 255 : number
        write(serialTarget, unit)
        status = "Serial \(trimmed)"
    }

    private func readValue(_ id: String) -> Double {
        if let value = live[id] { return value }
        if let value = values[id] { return value }
        return ParamCatalog.byID[id]?.defaultValue ?? 0
    }

    private func write(_ id: String, _ value: Double) {
        let next: Double
        if id.hasSuffix(".stem") || id.hasSuffix(".padMode") {
            next = min(4, max(0, value))
        } else if ParamCatalog.byID[id]?.kind == .toggle {
            next = value >= 0.5 ? 1 : 0
        } else if id.hasSuffix(".phase") {
            next = value - floor(value)
        } else {
            next = min(1, max(0, value))
        }
        if Self.volatile(id) {
            let old = live[id] ?? values[id]
            if let old, abs(old - next) < 0.0000005 { return }
            live[id] = next
            return
        }
        if let old = values[id], abs(old - next) < 0.0000005 { return }
        var copy = values
        copy[id] = next
        values = copy
        dirty = true
    }

    private static func volatile(_ id: String) -> Bool {
        id.hasPrefix("audio.") || id.hasSuffix(".phase") || id.hasSuffix(".hit") || id == "lfo.output" || id == "seq.output" || id == "clock.phase"
    }

    private static func address(from message: MIDIMessage, kind: ControlKind?) -> MIDIAddress {
        switch message {
        case let .note(channel, note, _, _):
            return .note(channel: channel, note: note)
        case let .cc(channel, controller, _):
            if kind == .absolute14 {
                let msb = controller >= 32 ? controller - 32 : controller
                return .cc14(channel: channel, msb: msb, lsb: msb + 32)
            }
            return .cc(channel: channel, controller: controller)
        case .clock, .transport, .other:
            return .cc(channel: 0, controller: 0)
        }
    }

    private func addressNote(_ address: MIDIAddress) -> Bool {
        if case .note = address { return true }
        return false
    }

    private static func parseAddress(_ key: String) -> MIDIAddress? {
        let parts = key.split(separator: ":").map(String.init)
        guard parts.count >= 3, let channel = Int(parts[1]), let number = Int(parts[2]) else { return nil }
        switch parts[0] {
        case "note": return .note(channel: channel, note: number)
        case "cc": return .cc(channel: channel, controller: number)
        case "cc14":
            guard parts.count >= 4, let lsb = Int(parts[3]) else { return nil }
            return .cc14(channel: channel, msb: number, lsb: lsb)
        default: return nil
        }
    }

    private static func parameterID(from address: String) -> String? {
        var path = address
        if path.hasPrefix("/visionboard/") { path.removeFirst("/visionboard/".count) }
        else { return nil }
        let id = path.replacingOccurrences(of: "/", with: ".")
        return ParamCatalog.byID[id] == nil ? nil : id
    }

    private func apply(_ document: PresetDocument) {
        var restored = values
        for (key, value) in document.values where ParamCatalog.byID[key] != nil && !Self.volatile(key) {
            restored[key] = value
        }
        values = restored
        live.removeAll()
        bindings = document.bindings
        tuning = document.tuning
        clips = document.clips
        widgets = document.widgets
        texts = document.texts
        dmxRoutes = Dictionary(uniqueKeysWithValues: document.dmxRoutes.compactMap { key, value in
            Int(key).map { ($0, value) }
        })
        layerCount = min(LayerStack.prefixes.count, max(2, document.layerCount))
        let candidate = document.layerOrder
        let orderFits = candidate.count == layerCount
            && Set(candidate).count == candidate.count
            && candidate.allSatisfy { (0..<LayerStack.prefixes.count).contains($0) }
            && candidate.contains(0) && candidate.contains(1)
        layerOrder = orderFits ? candidate : Array(0..<layerCount)
        layerNames = document.layerNames.count == LayerStack.prefixes.count ? document.layerNames : LayerStack.titles
        layerLocked = document.layerLocked.count == LayerStack.prefixes.count ? document.layerLocked : Array(repeating: false, count: 8)
        if document.blendScale != LayerStack.blendStops {
            var migrated = values
            for key in document.values.keys where key.hasSuffix(".blend") {
                migrated[key] = LayerStack.migratedBlend(document.values[key] ?? 0, from: document.blendScale)
            }
            values = migrated
        }
        blendScale = LayerStack.blendStops
        if !document.isfSource.isEmpty { loadISF(document.isfSource) }
        if document.canvasSizes.count == 3 { canvasSizes = document.canvasSizes }
        if !document.lfoTable.isEmpty { lfoTable = document.lfoTable }
        if !document.fxPresets.isEmpty { fxPresets = document.fxPresets }
        if !document.panels.isEmpty { panels = document.panels }
        hardware = MixtrackProfile.controls
        for index in hardware.indices {
            if let address = document.addresses[hardware[index].id] {
                hardware[index].address = address
                hardware[index].confidence = .learned
            }
        }
        rebuild()
        dirty = true
    }

    private func loadSession() {
        let url = Self.supportFolder().appendingPathComponent("session.json")
        guard let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(SessionFile.self, from: data) else { return }
        apply(PresetDocument(
            name: file.presetName,
            values: file.values,
            bindings: file.bindings,
            tuning: file.tuning,
            panels: file.panels,
            addresses: file.addresses,
            clips: file.clips,
            widgets: file.widgets,
            texts: file.texts,
            dmxRoutes: file.dmxRoutes,
            layerCount: file.layerCount,
            isfSource: file.isfSource,
            canvasSizes: file.canvasSizes,
            lfoTable: file.lfoTable,
            fxPresets: file.fxPresets,
            layerNames: file.layerNames,
            layerLocked: file.layerLocked,
            layerOrder: file.layerOrder,
            blendScale: file.blendScale
        ))
        presetName = file.presetName
        dirty = false
    }

    private func saveSession() {
        let file = SessionFile(
            values: values.filter { !Self.volatile($0.key) },
            bindings: bindings,
            tuning: tuning,
            panels: panels,
            addresses: Dictionary(uniqueKeysWithValues: hardware.map { ($0.id, $0.address) }),
            presetName: presetName,
            clips: clips,
            widgets: widgets,
            texts: texts,
            dmxRoutes: Dictionary(uniqueKeysWithValues: dmxRoutes.map { (String($0.key), $0.value) }),
            layerCount: layerCount,
            isfSource: isfSource,
            canvasSizes: canvasSizes,
            lfoTable: lfoTable,
            fxPresets: fxPresets,
            layerNames: layerNames,
            layerLocked: layerLocked,
            layerOrder: layerOrder,
            blendScale: blendScale
        )
        do {
            let data = try JSONEncoder().encode(file)
            try data.write(to: Self.supportFolder().appendingPathComponent("session.json"), options: .atomic)
        } catch {
            status = "Couldn't save the session"
        }
    }

    private static func supportFolder() -> URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("KOOG Pro Viz", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func presetsFolder() -> URL {
        let url = supportFolder().appendingPathComponent("Presets", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}

private struct SessionFile: Codable {
    var values: [String: Double]
    var bindings: [UserBinding]
    var tuning: [String: Tuning]
    var panels: [PanelSpec]
    var addresses: [String: MIDIAddress]
    var presetName: String
    var clips: [MediaClip] = []
    var widgets: [SurfaceWidget] = []
    var texts: [String: String] = [:]
    var dmxRoutes: [String: String] = [:]
    var layerCount: Int = 2
    var isfSource: String = ""
    var canvasSizes: [CanvasSpec] = CanvasSpec.standard
    var lfoTable: [Double] = []
    var fxPresets: [String: [String: Double]] = [:]
    var layerNames: [String] = LayerStack.titles
    var layerLocked: [Bool] = Array(repeating: false, count: 8)
    var layerOrder: [Int] = [0, 1]
    var blendScale: Int = LayerStack.legacyBlendStops

    private enum CodingKeys: String, CodingKey {
        case values, bindings, tuning, panels, addresses, presetName, clips, widgets, texts, dmxRoutes, layerCount, isfSource, canvasSizes, lfoTable, fxPresets, layerNames, layerLocked, layerOrder, blendScale
    }

    init(values: [String: Double], bindings: [UserBinding], tuning: [String: Tuning], panels: [PanelSpec], addresses: [String: MIDIAddress], presetName: String, clips: [MediaClip], widgets: [SurfaceWidget], texts: [String: String], dmxRoutes: [String: String], layerCount: Int, isfSource: String, canvasSizes: [CanvasSpec], lfoTable: [Double], fxPresets: [String: [String: Double]], layerNames: [String], layerLocked: [Bool], layerOrder: [Int], blendScale: Int) {
        self.values = values
        self.bindings = bindings
        self.tuning = tuning
        self.panels = panels
        self.addresses = addresses
        self.presetName = presetName
        self.clips = clips
        self.widgets = widgets
        self.texts = texts
        self.dmxRoutes = dmxRoutes
        self.layerCount = layerCount
        self.isfSource = isfSource
        self.canvasSizes = canvasSizes
        self.lfoTable = lfoTable
        self.fxPresets = fxPresets
        self.layerNames = layerNames
        self.layerLocked = layerLocked
        self.layerOrder = layerOrder
        self.blendScale = blendScale
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        values = try container.decode([String: Double].self, forKey: .values)
        bindings = try container.decode([UserBinding].self, forKey: .bindings)
        tuning = try container.decode([String: Tuning].self, forKey: .tuning)
        panels = try container.decode([PanelSpec].self, forKey: .panels)
        addresses = try container.decode([String: MIDIAddress].self, forKey: .addresses)
        presetName = try container.decode(String.self, forKey: .presetName)
        clips = try container.decodeIfPresent([MediaClip].self, forKey: .clips) ?? []
        widgets = try container.decodeIfPresent([SurfaceWidget].self, forKey: .widgets) ?? []
        texts = try container.decodeIfPresent([String: String].self, forKey: .texts) ?? [:]
        dmxRoutes = try container.decodeIfPresent([String: String].self, forKey: .dmxRoutes) ?? [:]
        layerCount = try container.decodeIfPresent(Int.self, forKey: .layerCount) ?? 2
        isfSource = try container.decodeIfPresent(String.self, forKey: .isfSource) ?? ""
        canvasSizes = try container.decodeIfPresent([CanvasSpec].self, forKey: .canvasSizes) ?? CanvasSpec.standard
        lfoTable = try container.decodeIfPresent([Double].self, forKey: .lfoTable) ?? []
        fxPresets = try container.decodeIfPresent([String: [String: Double]].self, forKey: .fxPresets) ?? [:]
        layerNames = try container.decodeIfPresent([String].self, forKey: .layerNames) ?? LayerStack.titles
        layerLocked = try container.decodeIfPresent([Bool].self, forKey: .layerLocked) ?? Array(repeating: false, count: 8)
        layerOrder = try container.decodeIfPresent([Int].self, forKey: .layerOrder) ?? [0, 1]
        blendScale = try container.decodeIfPresent(Int.self, forKey: .blendScale) ?? LayerStack.legacyBlendStops
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(values, forKey: .values)
        try container.encode(bindings, forKey: .bindings)
        try container.encode(tuning, forKey: .tuning)
        try container.encode(panels, forKey: .panels)
        try container.encode(addresses, forKey: .addresses)
        try container.encode(presetName, forKey: .presetName)
        try container.encode(clips, forKey: .clips)
        try container.encode(widgets, forKey: .widgets)
        try container.encode(texts, forKey: .texts)
        try container.encode(dmxRoutes, forKey: .dmxRoutes)
        try container.encode(layerCount, forKey: .layerCount)
        try container.encode(isfSource, forKey: .isfSource)
        try container.encode(canvasSizes, forKey: .canvasSizes)
        try container.encode(lfoTable, forKey: .lfoTable)
        try container.encode(fxPresets, forKey: .fxPresets)
        try container.encode(layerNames, forKey: .layerNames)
        try container.encode(layerLocked, forKey: .layerLocked)
        try container.encode(layerOrder, forKey: .layerOrder)
        try container.encode(blendScale, forKey: .blendScale)
    }
}


