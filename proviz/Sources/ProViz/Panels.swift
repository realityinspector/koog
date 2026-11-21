import MetalKit
import SwiftUI
import UniformTypeIdentifiers
import ProVizKit

struct PanelBody: View {
    var kind: String
    var session: Session
    @State private var shaderError: String?
    @State private var presetTitle = ""
    @State private var fxName = "Show"
    @State private var pinchStart: Double?

    var body: some View {
        Group {
            switch kind {
            case "canvas": canvas
            case "layers": layers
            case "hardware": HardwareMirror(session: session)
            case "media": MediaBinView(session: session)
            case "routes": RoutesView(session: session)
            case "mapping": mapping
            case "monitor": monitor
            case "audio": audio
            case "modulators": modulators
            case "surface": surface
            case "presets": presets
            default: Text(kind)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var canvas: some View {
        ZStack(alignment: .bottomLeading) {
            MetalCanvas(session: session, error: $shaderError)
                .gesture(
                    MagnifyGesture()
                        .onChanged { value in
                            let prefix = session.focusedPrefix()
                            if pinchStart == nil { pinchStart = session.values["\(prefix).scale"] ?? 0.5 }
                            let next = min(1, max(0.05, (pinchStart ?? 0.5) * value.magnification))
                            session.setParameter("\(prefix).scale", next, user: true)
                        }
                        .onEnded { _ in pinchStart = nil }
                )
            if let shaderError {
                Text(shaderError).font(.system(size: 11, design: .monospaced)).padding(8).foregroundStyle(.red)
            }
            VStack {
                Spacer()
                HStack {
                    Picker("Split", selection: Binding(
                        get: { LayerStack.choice(session.values["master.split"] ?? 0, count: 3) },
                        set: { session.setParameter("master.split", Double($0) / 2, user: true) }
                    )) {
                        Text("Full").tag(0)
                        Text("B / C").tag(1)
                        Text("Quad").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 220)
                    Button("Output") {
                        if let device = MTLCreateSystemDefaultDevice() {
                            OutputBoard.shared.which = 1
                            OutputBoard.shared.open(device: device)
                            session.status = "Output window shows Canvas B. Drag it onto a projector."
                        }
                    }
                    Button("Next display") {
                        session.status = OutputBoard.shared.sendToNextDisplay()
                    }
                    Button(session.recording ? "Stop" : "Record") { session.toggleRecording() }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
                .padding(8)
            }
            HStack {
                Text("A").foregroundStyle(Color.vbA)
                Spacer()
                Text(session.recordStatus).foregroundStyle(Color.vbDim)
                Spacer()
                Text("B").foregroundStyle(Color.vbB)
            }
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .padding(8)
        }
        .background(Color.black)
    }

    private var layers: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                layerStack
                HStack {
                    Button("New layer") { session.addLayer() }
                    Button("Duplicate") { session.duplicateFocusedLayer() }
                    Button("Delete") { session.deleteFocusedLayer() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                Text("The top row is in front. Drag a swatch to reorder. The eye hides a layer and leaves its opacity slider alone. Deck A and Deck B stay, because the crossfader wipes between them.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.vbDim)
                OutputStrip(session: session)
                layerControls(session.focusedPrefix(), title: session.layerName(LayerStack.index(of: session.focusedPrefix())))
                CanvasDesk(session: session, fxName: $fxName)
            }
        }
    }

    private var layerStack: some View {
        let visual = Array(session.layerOrder.reversed())
        return VStack(spacing: 4) {
            ForEach(Array(visual.enumerated()), id: \.element) { rank, index in
                layerRow(index, rank: rank)
            }
        }
    }

    private func layerRow(_ index: Int, rank: Int) -> some View {
        let prefix = LayerStack.prefixes[index]
        let focused = session.focusedPrefix() == prefix
        let shown = (session.values["\(prefix).visible"] ?? 1) >= 0.5
        let locked = session.layerLocked.indices.contains(index) && session.layerLocked[index]
        let blendIndex = LayerStack.choice(session.values["\(prefix).blend"] ?? 0, count: LayerStack.blends.count)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Button {
                    session.focusLayer(index)
                    session.toggle("\(prefix).visible")
                } label: {
                    Image(systemName: shown ? "eye" : "eye.slash")
                        .frame(width: 16)
                }
                .buttonStyle(.borderless)
                .help(shown ? "Hide \(session.layerName(index))" : "Show \(session.layerName(index))")
                .mappable(session, "\(prefix).visible")
                Button {
                    session.setLayerLocked(index, !locked)
                } label: {
                    Image(systemName: locked ? "lock" : "lock.open")
                        .frame(width: 16)
                }
                .buttonStyle(.borderless)
                .help(locked ? "Unlock \(session.layerName(index))" : "Lock \(session.layerName(index))")
                RoundedRectangle(cornerRadius: 2)
                    .fill(swatch(index))
                    .frame(width: 14, height: 14)
                    .onTapGesture { session.focusLayer(index) }
                    .onDrag { NSItemProvider(object: "vb-layer:\(index)" as NSString) }
                TextField("Name", text: Binding(
                    get: { session.layerNames.indices.contains(index) ? session.layerNames[index] : "" },
                    set: {
                        session.focusLayer(index)
                        session.renameLayer(index, $0)
                    }
                ))
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: focused ? .semibold : .regular))
            }
            HStack(spacing: 6) {
                Slider(value: Binding(
                    get: { session.values["\(prefix).opacity"] ?? 0 },
                    set: {
                        session.focusLayer(index)
                        session.setParameter("\(prefix).opacity", $0, user: true)
                    }
                ), in: 0...1)
                .mappable(session, "\(prefix).opacity")
                Text("\(Int(((session.values["\(prefix).opacity"] ?? 0) * 100).rounded()))")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Color.vbDim)
                    .frame(width: 28, alignment: .trailing)
                Menu(LayerStack.blends[blendIndex]) {
                    ForEach(Array(LayerStack.blends.enumerated()), id: \.offset) { item, name in
                        Button(name) {
                            let denom = max(1, LayerStack.blends.count - 1)
                            session.setParameter("\(prefix).blend", Double(item) / Double(denom), user: true)
                        }
                    }
                }
                .menuStyle(.borderlessButton)
                .frame(width: 108)
                .mappable(session, "\(prefix).blend")
            }
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 6).fill(focused ? Color.vbA.opacity(0.16) : Color.vbRaise))
        .opacity(shown ? 1 : 0.45)
        .onDrop(of: [.text], isTargeted: nil) { providers in
            guard let provider = providers.first else { return false }
            provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { item, _ in
                let text: String?
                if let string = item as? String { text = string }
                else if let data = item as? Data { text = String(data: data, encoding: .utf8) }
                else { text = nil }
                guard let text else { return }
                let marker = "vb-layer:"
                guard text.hasPrefix(marker), let dragged = Int(text.dropFirst(marker.count)) else { return }
                Task { @MainActor in session.placeLayer(dragged, atFrontRank: rank) }
            }
            return true
        }
    }

    private func swatch(_ index: Int) -> Color {
        if index == 0 { return .vbA }
        if index == 1 { return .vbB }
        let hue = session.values["\(LayerStack.prefixes[index]).hue"] ?? 0.5
        return Color(hue: hue, saturation: 0.55, brightness: 0.9)
    }

    private func layerControls(_ layer: String, title: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(layer == "layerA" ? Color.vbA : (layer == "layerB" ? Color.vbB : Color.vbText))
            HStack {
                toggle("Play", "\(layer).running")
                if layer == "layerA" || layer == "layerB" { toggle("Sync", "\(layer).sync") }
            }
            unitSlider("Opacity", "\(layer).opacity")
            unitSlider("Speed", "\(layer).speed")
            unitSlider("Color", "\(layer).hue")
            unitSlider("Warp", "\(layer).warp")
            unitSlider("Audio", "\(layer).audioAmount")
            unitSlider("X", "\(layer).x")
            unitSlider("Y", "\(layer).y")
            unitSlider("Scale", "\(layer).scale")
            unitSlider("Rotation", "\(layer).rotation")
            choice("Blend", "\(layer).blend", LayerStack.blends)
            choice("Source", "\(layer).source", LayerStack.sources)
            choice("Effect 1", "\(layer).effect0", LayerStack.effects)
            unitSlider("Amount", "\(layer).effect0amt")
            choice("Effect 2", "\(layer).effect1", LayerStack.effects)
            unitSlider("Amount", "\(layer).effect1amt")
            choice("Effect 3", "\(layer).effect2", LayerStack.effects)
            unitSlider("Amount", "\(layer).effect2amt")
            choice("Grade", "\(layer).grade", LayerStack.grades)
            choice("Canvas", "\(layer).canvas", LayerStack.canvases)
            choice("Fit", "\(layer).fit", LayerStack.fits)
            toggle("Aspect lock", "\(layer).aspectLock")
            toggle("Reverse", "\(layer).reverse")
            unitSlider("Anchor X", "\(layer).anchorX")
            unitSlider("Anchor Y", "\(layer).anchorY")
            unitSlider("Crop left", "\(layer).cropL")
            unitSlider("Crop right", "\(layer).cropR")
            unitSlider("Crop top", "\(layer).cropT")
            unitSlider("Crop bottom", "\(layer).cropB")
            unitSlider("Feather", "\(layer).feather")
            HStack {
                Button("Rewind") { session.nudge(layer, -0.4) }
                Button("Nudge") { session.nudge(layer, 0.15) }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }

    private func choice(_ title: String, _ id: String, _ names: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 11))
            Picker(title, selection: Binding(
                get: { LayerStack.choice(session.values[id] ?? 0, count: names.count) },
                set: { session.setParameter(id, names.count > 1 ? Double($0) / Double(names.count - 1) : 0, user: true) }
            )) {
                ForEach(Array(names.enumerated()), id: \.offset) { index, name in
                    Text(name).tag(index)
                }
            }
            .labelsHidden()
        }
        .mappable(session, id)
    }

    private var media: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Built-in compositions. Browse on the Go moves the highlight. Click one to load it into deck \(session.focusedDeck).")
                .font(.system(size: 11))
                .foregroundStyle(Color.vbDim)
            let selected = Shaders.index(from: session.values["media.index"] ?? 0)
            ForEach(Array(Shaders.names.enumerated()), id: \.offset) { index, name in
                Button {
                    session.selectShader(index, load: true)
                } label: {
                    HStack {
                        Text(name)
                        Spacer()
                        if index == selected { Text("browse").font(.system(size: 9, design: .monospaced)) }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 5).fill(index == selected ? Color.vbA.opacity(0.25) : Color.vbRaise))
                }
                .buttonStyle(.plain)
            }
            Text("Hue, warp, opacity, and speed on each composition are the same controls you MIDI-learn everywhere else. Syphon output is not linked in this build.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
        }
    }

    private var mapping: some View {
        HStack(alignment: .top, spacing: 8) {
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    let groups = Dictionary(grouping: ParamCatalog.all.filter { $0.kind != .readout }, by: \.group)
                    ForEach(groups.keys.sorted(), id: \.self) { group in
                        Text(group).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.vbDim).padding(.top, 6)
                        ForEach(groups[group] ?? []) { spec in
                            Text(spec.name)
                                .font(.system(size: 12))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 3)
                                .padding(.horizontal, 6)
                                .background(RoundedRectangle(cornerRadius: 4).fill(session.selectedParameter == spec.id ? Color.vbA.opacity(0.25) : Color.clear))
                                .onTapGesture { session.selectedParameter = spec.id }
                                .mappable(session, spec.id)
                        }
                    }
                }
            }
            .frame(width: 150)
            mappingDetail
        }
    }

    @ViewBuilder private var mappingDetail: some View {
        if let id = session.selectedParameter {
            let name = ParamCatalog.byID[id]?.name ?? id
            VStack(alignment: .leading, spacing: 8) {
                Text(name).font(.system(size: 14, weight: .semibold))
                Text(id).font(.system(size: 10, design: .monospaced)).foregroundStyle(Color.vbDim)
                HStack {
                    Button("MIDI Learn") { session.beginMIDILearn(id) }
                    Button("OSC Learn") { session.beginOSCLearn(id) }
                }
                .buttonStyle(.bordered)
                let mine = session.bindings.filter { $0.parameter == id }
                if mine.isEmpty {
                    Text("No extra mapping. The Mixtrack Go factory route still applies when this control is one of its targets. Learn a second source to drive it from somewhere else, or learn this hardware onto another parameter.")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.vbDim)
                }
                ForEach(mine) { binding in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(binding.source.label).font(.system(size: 11, design: .monospaced))
                            Spacer()
                            Button("Remove") { session.removeBinding(binding.id) }.buttonStyle(.borderless)
                        }
                        Picker("Curve", selection: Binding(
                            get: { binding.tuning.curve },
                            set: { curve in session.updateBinding(binding.id) { $0.tuning.curve = curve } }
                        )) {
                            ForEach(Curve.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        Toggle("Invert", isOn: Binding(
                            get: { binding.tuning.invert },
                            set: { value in session.updateBinding(binding.id) { $0.tuning.invert = value } }
                        ))
                        Text("Output \(String(format: "%.2f", binding.tuning.minimum)) – \(String(format: "%.2f", binding.tuning.maximum))")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.vbDim)
                        HStack {
                            Text("Min")
                            Slider(value: Binding(
                                get: { binding.tuning.minimum },
                                set: { value in session.updateBinding(binding.id) { $0.tuning.minimum = value } }
                            ))
                            Text("Max")
                            Slider(value: Binding(
                                get: { binding.tuning.maximum },
                                set: { value in session.updateBinding(binding.id) { $0.tuning.maximum = value } }
                            ))
                        }
                        .font(.system(size: 10))
                    }
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color.vbRaise))
                }
            }
        } else {
            Text("Pick a parameter. Right-click any slider for MIDI Learn, OSC Learn, an LFO, or an audio band.")
                .font(.system(size: 12))
                .foregroundStyle(Color.vbDim)
        }
    }

    private var monitor: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(session.sources.isEmpty ? "No ports" : session.sources.joined(separator: ", "))
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(Color.vbDim)
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(session.monitor) { entry in
                        HStack {
                            Text(entry.text).font(.system(size: 10, design: .monospaced)).lineLimit(1)
                            Spacer()
                            if let target = session.selectedParameter {
                                Button("Map") { session.mapAddressKey(entry.addressKey, to: target) }
                                    .font(.system(size: 9))
                                    .buttonStyle(.borderless)
                            }
                        }
                    }
                }
            }
            Text("Space plays A, return plays B, 1–4 are pads, arrows move the crossfader.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
        }
    }

    private var audio: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(session.audioStatus).font(.system(size: 11)).foregroundStyle(Color.vbDim)
            meter("Bass", session.meters.bass, .vbB)
            meter("Mid", session.meters.mid, .vbA)
            meter("Treble", session.meters.treble, .white)
            meter("Level", session.meters.level, .vbText)
            WaveformView(samples: session.waveform)
                .frame(height: 56)
            toggle("Follow the music", "clock.follow")
            Text("A 1024-point FFT splits the input into bass under 140 Hz, mids under 2 kHz, and treble. Right-click a slider to lock one band to it. BPM settles from the bass after a few bars.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
        }
    }

    private var modulators: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("LFO").font(.system(size: 12, weight: .semibold))
                Picker("Shape", selection: Binding(
                    get: { Int((session.values["lfo.shape"] ?? 0) * Double(max(1, LFOShape.allCases.count - 1))) },
                    set: { session.setParameter("lfo.shape", Double($0) / Double(max(1, LFOShape.allCases.count - 1)), user: true) }
                )) {
                    ForEach(Array(LFOShape.allCases.enumerated()), id: \.offset) { index, shape in
                        Text(shape.label).tag(index)
                    }
                }
                LFODraw(session: session)
                    .frame(height: 64)
                unitSlider("Rate", "lfo.rate")
                unitSlider("Amount", "lfo.amount")
                meter("LFO", session.meters.lfo, .vbA)
                Text("Clock").font(.system(size: 12, weight: .semibold)).padding(.top, 6)
                HStack {
                    Button("Tap") { session.tapTempo() }
                    toggle("Run", "clock.running")
                    toggle("MIDI clock", "clock.external")
                }
                HStack {
                    Text("BPM \(Int(ParamCatalog.bpm(from: session.values["clock.bpm"] ?? 0.5).rounded()))")
                        .font(.system(size: 12, design: .monospaced))
                    Slider(value: Binding(
                        get: { session.values["clock.bpm"] ?? 0.5 },
                        set: { session.setParameter("clock.bpm", $0, user: true) }
                    )).mappable(session, "clock.bpm")
                }
                Text("Sequencer").font(.system(size: 12, weight: .semibold)).padding(.top, 6)
                unitSlider("Rate", "seq.rate")
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(0..<8, id: \.self) { step in
                        VStack {
                            Slider(value: Binding(
                                get: { session.values["seq.step\(step)"] ?? 0 },
                                set: { session.setParameter("seq.step\(step)", $0, user: true) }
                            ), in: 0...1)
                            .rotationEffect(.degrees(-90))
                            .frame(width: 70, height: 28)
                            Circle().fill(step == session.sequencerStep ? Color.vbA : Color.vbDim).frame(width: 6, height: 6)
                        }
                        .mappable(session, "seq.step\(step)")
                    }
                }
                .frame(height: 90)
            }
        }
    }

    private var surface: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Build the controls this gig needs. Each one is MIDI-learnable and can drive any parameter.")
                .font(.system(size: 11))
                .foregroundStyle(Color.vbDim)
            ForEach(session.widgets) { widget in
                widgetRow(widget)
            }
            HStack {
                Button("Slider") { session.addWidget("slider") }
                Button("Button") { session.addWidget("button") }
                Button("Menu") { session.addWidget("menu") }
            }
            .buttonStyle(.bordered)
            unitSlider("Fader A", "surface.a")
            unitSlider("Fader B", "surface.b")
            unitSlider("Fader C", "surface.c")
            toggle("Button", "surface.button")
            Text("XY").font(.system(size: 11, weight: .semibold))
            GeometryReader { geo in
                let x = session.values["surface.x"] ?? 0.5
                let y = session.values["surface.y"] ?? 0.5
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 6).fill(Color.vbRaise)
                    Circle().fill(Color.vbA).frame(width: 12, height: 12)
                        .position(x: x * geo.size.width, y: (1 - y) * geo.size.height)
                }
                .gesture(DragGesture(minimumDistance: 0).onChanged { gesture in
                    let width = Double(max(geo.size.width, 1))
                    let height = Double(max(geo.size.height, 1))
                    let x = min(1, max(0, Double(gesture.location.x) / width))
                    let y = min(1, max(0, 1 - Double(gesture.location.y) / height))
                    session.setParameter("surface.x", x, user: true)
                    session.setParameter("surface.y", y, user: true)
                })
            }
            .frame(height: 120)
            .mappable(session, "surface.x")
        }
    }

    private var presets: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Preset name", text: $presetTitle)
                .textFieldStyle(.roundedBorder)
            Button("Save") {
                session.savePreset(named: presetTitle.isEmpty ? session.presetName : presetTitle)
            }
            .buttonStyle(.bordered)
            ForEach(session.presetNames(), id: \.self) { name in
                Button(name) { session.loadPreset(named: name) }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            }
            Text("A preset stores the layout, the parameter values, every learned route, curves, and any Mixtrack address you relearned.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
        }
    }

    private func widgetRow(_ widget: SurfaceWidget) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(widget.label).font(.system(size: 11, weight: .semibold))
                Spacer()
                Button("Remove") { session.removeWidget(widget.id) }
                    .buttonStyle(.borderless)
                    .font(.system(size: 10))
            }
            if widget.kind == "button" {
                toggle(widget.label, widget.parameter)
            } else if widget.kind == "menu" {
                let names = widget.parameter.contains("shader") ? Shaders.names : ["Off", "Mid", "Full"]
                choice(widget.label, widget.parameter, names)
            } else {
                unitSlider(widget.label, widget.parameter)
            }
        }
    }

    private func unitSlider(_ title: String, _ id: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack {
                Text(title).font(.system(size: 11))
                Spacer()
                Text(String(format: "%.2f", session.values[id] ?? 0))
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Color.vbDim)
            }
            Slider(value: Binding(
                get: { session.values[id] ?? 0 },
                set: { session.setParameter(id, $0, user: true) }
            ))
        }
        .mappable(session, id)
    }

    private func toggle(_ title: String, _ id: String) -> some View {
        Toggle(isOn: Binding(
            get: { (session.values[id] ?? 0) > 0.5 },
            set: { session.setParameter(id, $0 ? 1 : 0, user: true) }
        )) {
            Text(title).font(.system(size: 11))
        }
        .toggleStyle(.switch)
        .controlSize(.small)
        .mappable(session, id)
    }

    private func meter(_ title: String, _ value: Double, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 10)).foregroundStyle(Color.vbDim)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.vbRaise)
                    Capsule().fill(color).frame(width: max(2, value * geo.size.width))
                }
            }
            .frame(height: 8)
        }
    }
}

struct PanelChrome: View {
    var spec: PanelSpec
    var session: Session
    var onPop: () -> Void
    @State private var dragOrigin: CGPoint?
    @State private var resizeOrigin: CGSize?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(spec.title).font(.system(size: 11, weight: .semibold))
                Spacer()
                Button(action: onPop) {
                    Image(systemName: "macwindow.badge.plus")
                }
                .buttonStyle(.borderless)
                Button {
                    session.setPanelOpen(spec.kind, false)
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.borderless)
            }
            .padding(.horizontal, 8)
            .frame(height: 26)
            .background(Color.white.opacity(0.04))
            .gesture(DragGesture().onChanged { gesture in
                if dragOrigin == nil { dragOrigin = CGPoint(x: spec.x, y: spec.y) }
                let origin = dragOrigin ?? CGPoint(x: spec.x, y: spec.y)
                session.movePanel(spec.id, x: origin.x + gesture.translation.width, y: origin.y + gesture.translation.height)
            }.onEnded { _ in dragOrigin = nil })
            PanelBody(kind: spec.kind, session: session)
                .padding(8)
            HStack {
                Spacer()
                RoundedRectangle(cornerRadius: 1)
                    .fill(Color.vbDim)
                    .frame(width: 12, height: 12)
                    .gesture(DragGesture().onChanged { gesture in
                        if resizeOrigin == nil { resizeOrigin = CGSize(width: spec.width, height: spec.height) }
                        let origin = resizeOrigin ?? CGSize(width: spec.width, height: spec.height)
                        session.movePanel(spec.id, x: spec.x, y: spec.y, width: origin.width + gesture.translation.width, height: origin.height + gesture.translation.height)
                    }.onEnded { _ in resizeOrigin = nil })
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 4)
        }
        .frame(width: spec.width, height: spec.height)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.vbPanel))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.vbLine))
        .onTapGesture { session.bringToFront(spec.id) }
    }
}
