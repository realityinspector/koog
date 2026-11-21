import SwiftUI
import ProVizKit

@main
@MainActor
enum ProVizMain {
    static func main() {
        if CommandLine.arguments.contains("--self-test") {
            let failures = RigCheck.failures()
            if failures.isEmpty {
                print("KOOG Pro Viz self-test passed")
                Foundation.exit(0)
            }
            for failure in failures {
                fputs(failure + "\n", stderr)
            }
            Foundation.exit(1)
        }
        ProVizApp.main()
    }
}

struct ProVizApp: App {
    @State private var session = Session()

    var body: some Scene {
        Window("KOOG Pro Viz", id: "main") {
            RootView(session: session)
                .frame(minWidth: 1100, minHeight: 680)
        }
        .defaultSize(width: 1360, height: 760)
        .commands {
            CommandMenu("Performance") {
                Button("Save Preset") { session.savePreset(named: session.presetName) }
                    .keyboardShortcut("s", modifiers: [.command])
            }
        }
    }
}
