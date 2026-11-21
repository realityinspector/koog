import AppKit
import SwiftUI
import UniformTypeIdentifiers
import ProVizKit

struct WaveformView: View {
    var samples: [Float]

    var body: some View {
        Canvas { context, size in
            var path = Path()
            let count = max(samples.count, 2)
            for index in 0..<count {
                let sample = samples.indices.contains(index) ? samples[index] : 0
                let x = CGFloat(index) / CGFloat(count - 1) * size.width
                let y = size.height * (0.5 - CGFloat(sample) * 0.45)
                if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                else { path.addLine(to: CGPoint(x: x, y: y)) }
            }
            context.stroke(path, with: .color(Color.vbA), lineWidth: 1.2)
        }
        .background(RoundedRectangle(cornerRadius: 6).fill(Color.vbRaise))
    }
}

struct LFODraw: View {
    var session: Session

    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                var path = Path()
                let table = session.lfoTable
                let count = max(table.count, 2)
                for index in 0..<count {
                    let sample = table.indices.contains(index) ? table[index] : 0.5
                    let x = CGFloat(index) / CGFloat(count - 1) * size.width
                    let y = size.height * (1 - CGFloat(sample))
                    if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
                context.stroke(path, with: .color(Color.vbA), lineWidth: 1.4)
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let count = session.lfoTable.count
                        guard count > 1, geo.size.width > 1, geo.size.height > 1 else { return }
                        let index = Int((value.location.x / geo.size.width * CGFloat(count - 1)).rounded())
                        let sample = 1 - Double(value.location.y / geo.size.height)
                        session.setLFOSample(index: min(count - 1, max(0, index)), value: sample)
                        session.setParameter("lfo.shape", Double(LFOShape.custom.rawValue) / Double(max(1, LFOShape.allCases.count - 1)), user: true)
                    }
            )
        }
        .background(RoundedRectangle(cornerRadius: 6).fill(Color.vbRaise))
    }
}

struct CanvasDesk: View {
    var session: Session
    @Binding var fxName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Canvases").font(.system(size: 12, weight: .semibold))
            Text("Main follows the window until you set a size. B and C are separate pictures. Mix them in, or send one to the output window.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
            canvasSize(0, title: "Main")
            canvasSize(1, title: "Canvas B")
            canvasSize(2, title: "Canvas C")
            choiceMix("Canvas B mix", "canvasB.opacity")
            choiceBlend("Canvas B blend", "canvasB.blend")
            choiceMix("Canvas C mix", "canvasC.opacity")
            choiceBlend("Canvas C blend", "canvasC.blend")
            HStack {
                TextField("FX preset", text: $fxName)
                    .textFieldStyle(.roundedBorder)
                Button("Save") { session.saveFX(named: fxName) }
                Button("Recall") { session.recallFX(named: fxName) }
            }
            .font(.system(size: 11))
            if !session.fxPresets.isEmpty {
                Text(session.fxPresets.keys.sorted().joined(separator: ", "))
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Color.vbDim)
            }
        }
    }

    private func canvasSize(_ index: Int, title: String) -> some View {
        let spec = index < session.canvasSizes.count ? session.canvasSizes[index] : CanvasSpec(width: 0, height: 0)
        return HStack {
            Text(title).frame(width: 64, alignment: .leading)
            TextField("W", value: Binding(
                get: { spec.width },
                set: { session.setCanvasSize(index: index, width: $0, height: spec.height) }
            ), format: .number)
            .frame(width: 64)
            TextField("H", value: Binding(
                get: { spec.height },
                set: { session.setCanvasSize(index: index, width: spec.width, height: $0) }
            ), format: .number)
            .frame(width: 64)
            if index == 0 && spec.width < 16 {
                Text("window").font(.system(size: 10)).foregroundStyle(Color.vbDim)
            }
        }
        .font(.system(size: 11, design: .monospaced))
    }

    private func choiceMix(_ title: String, _ id: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.system(size: 11))
            Slider(value: Binding(
                get: { session.values[id] ?? 0 },
                set: { session.setParameter(id, $0, user: true) }
            ))
        }
        .mappable(session, id)
    }

    private func choiceBlend(_ title: String, _ id: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 11))
            Picker(title, selection: Binding(
                get: { LayerStack.choice(session.values[id] ?? 0, count: LayerStack.blends.count) },
                set: { session.setParameter(id, Double($0) / Double(LayerStack.blends.count - 1), user: true) }
            )) {
                ForEach(Array(LayerStack.blends.enumerated()), id: \.offset) { index, name in
                    Text(name).tag(index)
                }
            }
            .labelsHidden()
        }
        .mappable(session, id)
    }
}

struct OutputStrip: View {
    var session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Master").font(.system(size: 12, weight: .semibold))
            Toggle("Blackout", isOn: Binding(
                get: { (session.values["master.blackout"] ?? 0) > 0.5 },
                set: { session.setParameter("master.blackout", $0 ? 1 : 0, user: true) }
            )).mappable(session, "master.blackout")
            slider("Saturation", "master.saturation")
            slider("Contrast", "master.contrast")
            slider("Feedback", "master.feedback")
            slider("Feedback zoom", "master.feedbackZoom")
            Toggle("Keystone", isOn: Binding(
                get: { (session.values["master.keystone"] ?? 0) > 0.5 },
                set: { session.setParameter("master.keystone", $0 ? 1 : 0, user: true) }
            )).mappable(session, "master.keystone")
            if (session.values["master.keystone"] ?? 0) > 0.5 {
                slider("Top left X", "master.k0x")
                slider("Top left Y", "master.k0y")
                slider("Top right X", "master.k1x")
                slider("Top right Y", "master.k1y")
                slider("Bottom right X", "master.k2x")
                slider("Bottom right Y", "master.k2y")
                slider("Bottom left X", "master.k3x")
                slider("Bottom left Y", "master.k3y")
            }
        }
    }

    private func slider(_ title: String, _ id: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.system(size: 11))
            Slider(value: Binding(
                get: { session.values[id] ?? 0 },
                set: { session.setParameter(id, $0, user: true) }
            ))
        }
        .mappable(session, id)
    }
}

struct MediaBinView: View {
    @Bindable var session: Session
    @State private var hover = false

    private var pageClips: [MediaClip] {
        session.clips.filter { $0.page == session.mediaPage }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button("Camera") { session.useCamera() }
                Button("Screen") { session.useScreen() }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Text("Drop movies, images, ISF shaders, or text from the Finder. Camera and screen trigger like clips. Browse on the Go still walks the built-in compositions.")
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
                        if index == selected { Text("browse").font(.system(size: 9, design: .monospaced)).foregroundStyle(Color.vbDim) }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 5).fill(index == selected ? Color.vbA.opacity(0.25) : Color.vbRaise))
                }
                .buttonStyle(.plain)
            }
            HStack {
                ForEach(0..<4, id: \.self) { page in
                    Button("Page \(page + 1)") { session.mediaPage = page }
                        .buttonStyle(.bordered)
                        .tint(session.mediaPage == page ? Color.vbA : Color.vbDim)
                        .onDrop(of: [.text], isTargeted: nil) { providers in
                            guard let provider = providers.first else { return false }
                            provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { item, _ in
                                let text: String?
                                if let string = item as? String { text = string }
                                else if let data = item as? Data { text = String(data: data, encoding: .utf8) }
                                else { text = nil }
                                guard let text, let id = UUID(uuidString: text.trimmingCharacters(in: .whitespacesAndNewlines)) else { return }
                                Task { @MainActor in session.moveClip(id, page: page) }
                            }
                            return true
                        }
                }
                Slider(value: $session.thumbSpan, in: 0.15...1)
                    .frame(width: 80)
            }
            let span = 64 + session.thumbSpan * 96
            LazyVGrid(columns: [GridItem(.adaptive(minimum: span), spacing: 8)], spacing: 8) {
                ForEach(pageClips) { clip in
                    clipCell(clip, span: span)
                }
            }
            Text(hover ? "Drop to add to page \(session.mediaPage + 1)" : "Syphon, Spout, and NDI are not installed. Flash, Quartz Composer, and Vuo files are refused. HAP plays only if a HAP decoder is installed. Drag a clip onto a page number to move it.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
        }
        .onDrop(of: [.fileURL], isTargeted: $hover) { providers in
            for provider in providers {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    let url: URL?
                    if let item = item as? URL { url = item }
                    else if let data = item as? Data { url = URL(dataRepresentation: data, relativeTo: nil) }
                    else { url = nil }
                    guard let url else { return }
                    Task { @MainActor in session.importFile(url: url) }
                }
            }
            return true
        }
    }

    private func clipCell(_ clip: MediaClip, span: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: 6).fill(labelColor(clip.label).opacity(0.35))
                VStack {
                    Image(nsImage: NSWorkspace.shared.icon(forFile: clip.path))
                        .resizable()
                        .frame(width: 28, height: 28)
                    Text(clip.kind.uppercased()).font(.system(size: 9, weight: .bold, design: .monospaced))
                }
            }
            .frame(height: span * 0.7)
            .onTapGesture { session.assign(clip) }
            .onDrag { NSItemProvider(object: clip.id.uuidString as NSString) }
            Text(clip.name).font(.system(size: 10)).lineLimit(1)
            if !clip.detail.isEmpty {
                Text(clip.detail).font(.system(size: 9, design: .monospaced)).foregroundStyle(Color.vbDim).lineLimit(2)
            }
            if !clip.note.isEmpty {
                Text(clip.note).font(.system(size: 9)).foregroundStyle(Color.vbDim).lineLimit(3)
            }
            if !clip.triggerNote.isEmpty {
                Text("MIDI \(clip.triggerNote)").font(.system(size: 9, design: .monospaced)).foregroundStyle(Color.vbA)
            }
            HStack {
                Button("Label") { session.cycleLabel(clip.id) }
                Menu(clip.trigger) {
                    Button("loop") { session.setTrigger(clip.id, "loop") }
                    Button("restart") { session.setTrigger(clip.id, "restart") }
                    Button("toggle") { session.setTrigger(clip.id, "toggle") }
                }
                Menu("Page") {
                    ForEach(0..<4, id: \.self) { page in
                        Button("Page \(page + 1)") { session.moveClip(clip.id, page: page) }
                    }
                }
            }
            .font(.system(size: 9))
            .buttonStyle(.borderless)
            HStack {
                Button("Trigger") { session.beginClipTrigger(clip.id) }
                Button("Swap") { swap(clip) }
            }
            .font(.system(size: 9))
            .buttonStyle(.borderless)
        }
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 8).stroke(labelColor(clip.label), lineWidth: 1))
    }

    private func swap(_ clip: MediaClip) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.message = "Replace \(clip.name). Every layer using this clip follows the new file."
        if panel.runModal() == .OK, let url = panel.url {
            session.swapClip(clip.id, url: url)
        }
    }

    private func labelColor(_ label: Int) -> Color {
        switch label % 6 {
        case 0: Color.vbDim
        case 1: Color.vbA
        case 2: Color.vbB
        case 3: Color.pink
        case 4: Color.green
        default: Color.yellow
        }
    }
}

struct RoutesView: View {
    @Bindable var session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(session.artnetStatus).font(.system(size: 12, design: .monospaced))
            Text("Art-Net listens on UDP 6454. Right-click a control and choose DMX Learn, then move a fader. Turn Art-Net out on to broadcast brightness, the crossfader, the audio bands, and the deck levels.")
                .font(.system(size: 11))
                .foregroundStyle(Color.vbDim)
            Toggle("Art-Net out", isOn: Binding(
                get: { (session.values["master.artnetOut"] ?? 0) > 0.5 },
                set: { session.setParameter("master.artnetOut", $0 ? 1 : 0, user: true) }
            ))
            Text(session.serialStatus).font(.system(size: 12, design: .monospaced))
            TextField("Serial device", text: $session.serialPath)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Open serial") { session.connectSerial() }
                Button("Close") { session.disconnectSerial() }
            }
            .buttonStyle(.bordered)
            Text("9600 8N1. A line that is a number drives the selected parameter, or Surface fader A.")
                .font(.system(size: 11))
                .foregroundStyle(Color.vbDim)
            Divider()
            Text("Syphon is not linked. The Syphon framework is not installed, so there is no texture in or out. Spout is a Windows protocol and is not spoken here.")
            Text("NDI is not linked. The NDI SDK is not installed.")
            Text("Flash, Quartz Composer, and Vuo compositions are not run. ISF shaders are the generative files this build loads.")
            Text("Blackmagic DeckLink and UltraStudio are not linked. A camera macOS already exposes, including a USB webcam, can be a layer. Professional Thunderbolt cards need their own driver before they show up here.")
            HStack {
                Button("Camera layer") { session.useCamera() }
                Button("Screen layer") { session.useScreen() }
                Button("Feedback layer") { session.useFeedback() }
            }
            .buttonStyle(.bordered)
            Text("Screen capture asks for screen-recording permission. Feedback also has a master amount that trails the whole output.")
                .font(.system(size: 11))
                .foregroundStyle(Color.vbDim)
        }
        .font(.system(size: 11))
    }
}
