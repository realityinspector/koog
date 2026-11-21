import CoreMIDI
import Foundation

public enum MIDIMessage: Equatable, Sendable {
    case note(channel: Int, note: Int, velocity: Int, on: Bool)
    case cc(channel: Int, controller: Int, value: Int)
    case clock
    case transport(start: Bool)
    case other(status: Int)

    public var summary: String {
        switch self {
        case let .note(channel, note, velocity, on):
            "Note \(on ? "on" : "off") ch \(channel) n \(note) v \(velocity)"
        case let .cc(channel, controller, value):
            "CC ch \(channel) cc \(controller) = \(value)"
        case .clock:
            "MIDI clock"
        case let .transport(start):
            start ? "MIDI start" : "MIDI stop"
        case let .other(status):
            String(format: "MIDI 0x%02X", status)
        }
    }
}

public enum MIDIParser {
    /// Split a byte stream that already contains complete messages (no running-status across calls).
    public static func messages(from bytes: [UInt8]) -> [MIDIMessage] {
        var out: [MIDIMessage] = []
        var i = 0
        var running: UInt8 = 0
        while i < bytes.count {
            var status = bytes[i]
            if status < 0x80 {
                guard running >= 0x80 else { break }
                status = running
            } else {
                i += 1
                if status >= 0xF0 {
                    if status == 0xF8 {
                        out.append(.clock)
                    } else if status == 0xFA {
                        out.append(.transport(start: true))
                    } else if status == 0xFC {
                        out.append(.transport(start: false))
                    } else if status == 0xF0 {
                        if let end = bytes[i...].firstIndex(of: 0xF7) { i = end + 1 }
                        else { break }
                    }
                    running = 0
                    continue
                }
                running = status
            }
            let needed = dataBytes(for: status)
            guard i + needed <= bytes.count else { break }
            let channel = Int(status & 0x0F)
            let type = status & 0xF0
            let d1 = Int(bytes[i])
            let d2 = needed > 1 ? Int(bytes[i + 1]) : 0
            i += needed
            switch type {
            case 0x90:
                out.append(.note(channel: channel, note: d1, velocity: d2, on: d2 > 0))
            case 0x80:
                out.append(.note(channel: channel, note: d1, velocity: d2, on: false))
            case 0xB0:
                out.append(.cc(channel: channel, controller: d1, value: d2))
            default:
                out.append(.other(status: Int(status)))
            }
        }
        return out
    }

    public static func messages(in packetList: UnsafePointer<MIDIPacketList>) -> [MIDIMessage] {
        let count = Int(packetList.pointee.numPackets)
        guard count > 0 else { return [] }
        guard let field = MemoryLayout.offset(of: \MIDIPacketList.packet) else { return [] }
        var packet = UnsafeMutableRawPointer(mutating: UnsafeRawPointer(packetList).advanced(by: field))
            .assumingMemoryBound(to: MIDIPacket.self)
        var out: [MIDIMessage] = []
        for index in 0..<count {
            let length = Int(packet.pointee.length)
            if length > 0 {
                let bytes = withUnsafeBytes(of: packet.pointee.data) { raw -> [UInt8] in
                    Array(raw.prefix(length))
                }
                out.append(contentsOf: messages(from: bytes))
            }
            if index + 1 < count {
                packet = UnsafeMutablePointer(mutating: MIDIPacketNext(packet))
            }
        }
        return out
    }

    private static func dataBytes(for status: UInt8) -> Int {
        switch status & 0xF0 {
        case 0xC0, 0xD0: 1
        default: 2
        }
    }
}

public func isMixtrackGo(name: String) -> Bool {
    let n = name.lowercased()
    if n.contains("mixtrack") && n.contains("go") { return true }
    if n.contains("numark") && n.contains("mixtrack") { return true }
    return false
}

public final class MIDIEngine: @unchecked Sendable {
    public var onMessages: (@Sendable ([MIDIMessage]) -> Void)?
    public var onSources: (@Sendable ([String], Bool) -> Void)?

    private var client = MIDIClientRef()
    private var inPort = MIDIPortRef()
    private var outPort = MIDIPortRef()
    private let lock = NSLock()
    private var mixtrackDestination: MIDIEndpointRef = 0
    private var connected = Set<MIDIEndpointRef>()
    private var started = false

    public init() {}

    public func start() {
        lock.lock()
        let already = started
        started = true
        lock.unlock()
        guard !already else { return }

        let status = MIDIClientCreateWithBlock("KOOG Pro Viz" as CFString, &client) { [weak self] _ in
            self?.rescan()
        }
        guard status == noErr else { return }
        MIDIInputPortCreateWithBlock(client, "KOOG Pro Viz In" as CFString, &inPort) { [weak self] packetList, _ in
            let messages = MIDIParser.messages(in: packetList)
            guard !messages.isEmpty else { return }
            self?.onMessages?(messages)
        }
        MIDIOutputPortCreate(client, "KOOG Pro Viz Out" as CFString, &outPort)
        rescan()
    }

    public func sendNote(channel: Int, note: Int, velocity: Int) {
        lock.lock()
        let dest = mixtrackDestination
        let port = outPort
        lock.unlock()
        guard dest != 0, port != 0, (0...15).contains(channel), (0...127).contains(note) else { return }
        var packet = MIDIPacket()
        packet.timeStamp = 0
        packet.length = 3
        let status = UInt8(0x90 | (channel & 0x0F))
        let data: [UInt8] = [status, UInt8(note), UInt8(max(0, min(127, velocity)))]
        withUnsafeMutableBytes(of: &packet.data) { raw in
            for (i, byte) in data.enumerated() where i < raw.count {
                raw[i] = byte
            }
        }
        var list = MIDIPacketList(numPackets: 1, packet: packet)
        MIDISend(port, dest, &list)
    }

    private func rescan() {
        var names: [String] = []
        var foundGo = false
        var goDest: MIDIEndpointRef = 0
        let sourceCount = MIDIGetNumberOfSources()
        for index in 0..<sourceCount {
            let endpoint = MIDIGetSource(index)
            let name = Self.displayName(endpoint)
            names.append(name)
            if isMixtrackGo(name: name) { foundGo = true }
            lock.lock()
            let already = connected.contains(endpoint)
            let port = inPort
            lock.unlock()
            if !already, port != 0 {
                MIDIPortConnectSource(port, endpoint, nil)
                lock.lock()
                connected.insert(endpoint)
                lock.unlock()
            }
        }
        let destCount = MIDIGetNumberOfDestinations()
        for index in 0..<destCount {
            let endpoint = MIDIGetDestination(index)
            if isMixtrackGo(name: Self.displayName(endpoint)) {
                goDest = endpoint
                break
            }
        }
        lock.lock()
        mixtrackDestination = goDest
        lock.unlock()
        onSources?(names, foundGo)
    }

    private static func displayName(_ endpoint: MIDIEndpointRef) -> String {
        var unmanaged: Unmanaged<CFString>?
        let status = MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &unmanaged)
        guard status == noErr, let unmanaged else { return "" }
        return unmanaged.takeRetainedValue() as String
    }
}
