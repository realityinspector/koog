import AppKit
import SwiftUI
import ProVizKit

@MainActor
final class WindowShelf: NSObject, NSWindowDelegate {
    var windows: [NSWindow] = []
    var onClose: ((String) -> Void)?

    func pop(kind: String, title: String, session: Session) {
        if let existing = windows.first(where: { $0.identifier?.rawValue == kind }) {
            existing.makeKeyAndOrderFront(nil)
            return
        }
        let host = NSHostingController(rootView: PanelBody(kind: kind, session: session).padding(12).frame(minWidth: 320, minHeight: 220))
        let window = NSWindow(contentViewController: host)
        window.title = title
        window.identifier = NSUserInterfaceItemIdentifier(kind)
        window.styleMask = [.titled, .closable, .resizable, .miniaturizable]
        window.setContentSize(NSSize(width: 520, height: 420))
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.makeKeyAndOrderFront(nil)
        windows.append(window)
    }

    func windowWillClose(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        let kind = window.identifier?.rawValue ?? ""
        windows.removeAll { $0 === window }
        onClose?(kind)
    }
}

struct RootView: View {
    var session: Session
    @State private var shelf = WindowShelf()
    @State private var keyMonitor: Any?

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            GeometryReader { geo in
                ZStack(alignment: .topLeading) {
                    Color.vbBg
                    ForEach(session.panels.filter(\.open)) { panel in
                        PanelChrome(spec: panel, session: session) {
                            shelf.pop(kind: panel.kind, title: panel.title, session: session)
                            session.setPanelOpen(panel.kind, false)
                        }
                        .position(x: panel.x + panel.width / 2, y: panel.y + panel.height / 2)
                    }
                }
                .onAppear { shelf.onClose = { session.setPanelOpen($0, true) } }
                .frame(width: geo.size.width, height: geo.size.height)
            }
        }
        .background(Color.vbBg)
        .preferredColorScheme(.dark)
        .task { await session.start() }
        .onAppear { installKeys() }
        .onDisappear {
            if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
        }
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Text("KOOG Pro Viz")
                .font(.system(size: 13, weight: .semibold))
            Text(session.status)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(session.deviceConnected ? Color.vbA : Color.vbDim)
                .lineLimit(1)
            if session.learn != nil {
                Button("Cancel learn") { session.cancelLearn() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
            Spacer()
            Text(session.oscStatus)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(Color.vbDim)
            Menu("Panels") {
                ForEach(PanelSpec.kinds, id: \.kind) { item in
                    let open = session.panels.first { $0.kind == item.kind }?.open ?? false
                    Button(open ? "Hide \(item.title)" : "Show \(item.title)") {
                        session.setPanelOpen(item.kind, !open)
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(Color.vbPanel)
    }

    private func installKeys() {
        guard keyMonitor == nil else { return }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if NSApp.keyWindow?.firstResponder is NSTextView { return event }
            switch event.charactersIgnoringModifiers {
            case " ":
                session.tap("play.A")
                return nil
            case "\r":
                session.tap("play.B")
                return nil
            case "1", "2", "3", "4":
                if let digit = event.charactersIgnoringModifiers?.first, let number = Int(String(digit)) {
                    session.tap("pad\(number).A")
                }
                return nil
            case "f":
                session.toggle("master.fadeFX")
                return nil
            case "t":
                session.tapTempo()
                return nil
            case "b":
                session.toggle("master.blackout")
                return nil
            case String(UnicodeScalar(NSLeftArrowFunctionKey)!):
                session.moveAbsolute("xfade", (session.physical["xfade"] ?? 0.5) - 0.04)
                return nil
            case String(UnicodeScalar(NSRightArrowFunctionKey)!):
                session.moveAbsolute("xfade", (session.physical["xfade"] ?? 0.5) + 0.04)
                return nil
            default:
                return event
            }
        }
    }
}
