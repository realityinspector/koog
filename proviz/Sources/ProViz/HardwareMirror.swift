import SwiftUI
import ProVizKit

struct HardwareMirror: View {
    var session: Session
    @State private var dragTicks: [String: Int] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                deck("A", tint: .vbA)
                mixer
                deck("B", tint: .vbB)
            }
            Text("Quit Serato DJ Lite, then plug the Go in. Controls marked check were inferred from the capture — right-click one and choose Relearn if it tracks the wrong knob. Hold Mode for shift.")
                .font(.system(size: 10))
                .foregroundStyle(Color.vbDim)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func deck(_ side: String, tint: Color) -> some View {
        let layer = side == "A" ? "layerA" : "layerB"
        let mode = Int((session.values["\(layer).padMode"] ?? 0).rounded())
        let modeName = MixtrackProfile.padModes[min(MixtrackProfile.padModes.count - 1, max(0, mode))]
        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                jog(side, tint: tint)
                fader("pitch.\(side)", tint: tint)
            }
            HStack(spacing: 4) {
                hwButton("play.\(side)", lit: (session.values["\(layer).running"] ?? 0) > 0.5, tint: tint)
                hwButton("cue.\(side)", lit: false, tint: tint)
                hwButton("sync.\(side)", lit: (session.values["\(layer).sync"] ?? 0) > 0.5, tint: tint)
                hwButton("mode.\(side)", lit: true, tint: tint)
            }
            HStack(spacing: 4) {
                ForEach(1...4, id: \.self) { index in
                    hwButton("pad\(index).\(side)", lit: padLit(layer: layer, index: index - 1, mode: mode), tint: tint)
                }
            }
            Text(modeName.uppercased())
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundStyle(tint)
            HStack(spacing: 8) {
                knob("filter.\(side)", tint: tint)
                knob("level.\(side)", tint: tint)
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(tint.opacity(session.focusedDeck == side ? 0.1 : 0.04)))
    }

    private var mixer: some View {
        VStack(spacing: 8) {
            HStack(spacing: 14) {
                knob("browse", tint: .white)
                knob("main", tint: .white)
                knob("cuegain", tint: .white)
            }
            crossfader
            Toggle(isOn: Binding(
                get: { (session.values["master.fadeFX"] ?? 0) > 0.5 },
                set: { session.setParameter("master.fadeFX", $0 ? 1 : 0, user: true) }
            )) {
                Text("Fade FX").font(.system(size: 11, weight: .semibold))
            }
            .toggleStyle(.switch)
            .tint(.vbB)
            .mappable(session, "master.fadeFX")
            Text(session.shiftHeld ? "SHIFT" : "Deck \(session.focusedDeck)")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(session.shiftHeld ? Color.vbB : Color.vbDim)
        }
        .frame(maxWidth: .infinity)
    }

    private var crossfader: some View {
        let value = session.physical["xfade"] ?? 0.5
        return VStack(spacing: 3) {
            Text(label("xfade")).font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.vbDim)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.vbRaise)
                    Circle()
                        .fill(Color.white)
                        .frame(width: 14, height: 14)
                        .offset(x: value * (geo.size.width - 14))
                        .shadow(color: (session.flash["xfade"] ?? 0) > 0.05 ? .white : .clear, radius: 6)
                }
                .gesture(DragGesture(minimumDistance: 0).onChanged { gesture in
                    let raw = min(1, max(0, gesture.location.x / max(1, geo.size.width)))
                    session.moveAbsolute("xfade", raw)
                })
            }
            .frame(height: 16)
            .contextMenu { hardwareMenu("xfade") }
        }
        .frame(width: 180)
    }

    private func jog(_ side: String, tint: Color) -> some View {
        let id = "jog.\(side)"
        let angle = session.jogAngle[id] ?? 0
        return VStack(spacing: 2) {
            ZStack {
                Circle().stroke(tint.opacity(0.8), lineWidth: 3)
                Circle().fill(Color.vbRaise).padding(6)
                Rectangle().fill(tint).frame(width: 2, height: 16).offset(y: -10)
                    .rotationEffect(.radians(angle))
            }
            .frame(width: 54, height: 54)
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { gesture in
                    let ticks = Int(gesture.translation.width / 8)
                    let delta = ticks - (dragTicks[id] ?? 0)
                    if delta != 0 {
                        dragTicks[id] = ticks
                        session.nudgeRelative(id, ticks: delta)
                    }
                }
                .onEnded { _ in dragTicks[id] = 0 })
            .contextMenu { hardwareMenu(id) }
            Text(label(id)).font(.system(size: 9)).foregroundStyle(Color.vbDim)
        }
    }

    private func fader(_ id: String, tint: Color) -> some View {
        let value = session.physical[id] ?? 0.5
        return VStack(spacing: 2) {
            GeometryReader { geo in
                ZStack(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.vbRaise)
                    RoundedRectangle(cornerRadius: 3).fill(tint).frame(height: max(4, value * geo.size.height))
                }
                .gesture(DragGesture(minimumDistance: 0).onChanged { gesture in
                    let raw = 1 - min(1, max(0, gesture.location.y / max(1, geo.size.height)))
                    session.moveAbsolute(id, raw)
                })
            }
            .frame(width: 16, height: 54)
            .contextMenu { hardwareMenu(id) }
            Text(label(id)).font(.system(size: 9)).foregroundStyle(Color.vbDim)
        }
    }

    private func knob(_ id: String, tint: Color) -> some View {
        let value = session.physical[id] ?? (id == "browse" ? 0 : 0.5)
        return VStack(spacing: 2) {
            ZStack {
                Circle().fill(Color.vbRaise)
                Circle().trim(from: 0.15, to: 0.15 + value * 0.7)
                    .stroke(tint, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(90))
                if (session.flash[id] ?? 0) > 0.05 {
                    Circle().stroke(Color.white, lineWidth: 1)
                }
            }
            .frame(width: 36, height: 36)
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { gesture in
                    if id == "browse" {
                        let ticks = Int(gesture.translation.width / 14)
                        let delta = ticks - (dragTicks[id] ?? 0)
                        if delta != 0 {
                            dragTicks[id] = ticks
                            session.nudgeRelative(id, ticks: delta)
                        }
                    } else {
                        let raw = min(1, max(0, 0.5 - gesture.translation.height / 90))
                        session.moveAbsolute(id, raw)
                    }
                }
                .onEnded { _ in dragTicks[id] = 0 })
            .contextMenu { hardwareMenu(id) }
            Text(label(id)).font(.system(size: 9)).foregroundStyle(Color.vbDim)
            if let control = session.hardware.first(where: { $0.id == id }), control.confidence == .inferred {
                Text("check").font(.system(size: 8, weight: .bold)).foregroundStyle(Color.vbB)
            }
        }
    }

    private func hwButton(_ id: String, lit: Bool, tint: Color) -> some View {
        let down = (session.flash[id] ?? 0) > 0.2
        return Button(label(id)) { session.tap(id) }
            .buttonStyle(.plain)
            .font(.system(size: 9, weight: .semibold))
            .frame(width: 40, height: 22)
            .background(RoundedRectangle(cornerRadius: 4).fill(lit || down ? tint.opacity(0.85) : Color.vbRaise))
            .foregroundStyle(lit || down ? Color.black : Color.vbText)
            .contextMenu { hardwareMenu(id) }
    }

    private func label(_ id: String) -> String {
        session.hardware.first { $0.id == id }?.name ?? id
    }

    @ViewBuilder private func hardwareMenu(_ id: String) -> some View {
        Button("Relearn from the Go") { session.beginHardwareRelearn(id) }
        let tune = session.tuning[id] ?? Tuning()
        Button(tune.invert ? "Use normal direction" : "Invert") {
            var next = tune
            next.invert.toggle()
            session.setTuning(id, next)
        }
        Menu("Curve") {
            ForEach(Curve.allCases, id: \.self) { curve in
                Button(curve.label) {
                    var next = tune
                    next.curve = curve
                    session.setTuning(id, next)
                }
            }
        }
        if let control = session.hardware.first(where: { $0.id == id }) {
            Text(control.address.shortLabel)
        }
    }

    private func padLit(layer: String, index: Int, mode: Int) -> Bool {
        switch mode {
        case 3: return Shaders.index(from: session.values["\(layer).shader"] ?? 0) == index
        case 4: return Int((session.values["\(layer).stem"] ?? 3).rounded()) == index
        default: return false
        }
    }
}
