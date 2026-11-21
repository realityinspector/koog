import SwiftUI
import ProVizKit

extension Color {
    static let vbBg = Color(red: 0.06, green: 0.07, blue: 0.09)
    static let vbPanel = Color(red: 0.11, green: 0.12, blue: 0.15)
    static let vbRaise = Color(red: 0.16, green: 0.17, blue: 0.21)
    static let vbLine = Color.white.opacity(0.08)
    static let vbA = Color(red: 0.35, green: 0.86, blue: 0.92)
    static let vbB = Color(red: 0.95, green: 0.58, blue: 0.28)
    static let vbText = Color.white.opacity(0.92)
    static let vbDim = Color.white.opacity(0.48)
}

struct Mappable: ViewModifier {
    var session: Session
    var parameter: String

    func body(content: Content) -> some View {
        content.contextMenu {
            Button("MIDI Learn") { session.beginMIDILearn(parameter) }
            Button("OSC Learn") { session.beginOSCLearn(parameter) }
            Button("DMX Learn") { session.beginDMXLearn(parameter) }
            Menu("Attach") {
                Button("LFO") { session.attach(parameter, source: .lfo) }
                Button("Bass") { session.attach(parameter, source: .audioBand("bass")) }
                Button("Mid") { session.attach(parameter, source: .audioBand("mid")) }
                Button("Treble") { session.attach(parameter, source: .audioBand("treble")) }
                Button("Clock") { session.attach(parameter, source: .clock) }
                Button("Sequencer") { session.attach(parameter, source: .sequencer) }
                Button("Surface fader A") { session.attach(parameter, source: .parameter("surface.a")) }
                Button("Surface fader B") { session.attach(parameter, source: .parameter("surface.b")) }
                Button("Surface X") { session.attach(parameter, source: .parameter("surface.x")) }
                Button("Surface Y") { session.attach(parameter, source: .parameter("surface.y")) }
            }
            Button("Clear extra mappings") { session.clearBindings(for: parameter) }
        }
    }
}

extension View {
    func mappable(_ session: Session, _ parameter: String) -> some View {
        modifier(Mappable(session: session, parameter: parameter))
    }
}
