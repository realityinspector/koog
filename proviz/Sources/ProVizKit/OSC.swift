import Darwin
import Foundation

public enum OSCValue: Equatable, Sendable {
    case float(Double)
    case int(Int)
    case string(String)

    public var number: Double? {
        switch self {
        case let .float(value): value
        case let .int(value): Double(value)
        case .string: nil
        }
    }
}

public struct OSCMessage: Equatable, Sendable {
    public var address: String
    public var values: [OSCValue]

    public init(address: String, values: [OSCValue]) {
        self.address = address
        self.values = values
    }

    public var primary: Double {
        values.compactMap(\.number).first ?? 1
    }
}

public enum OSCCodec {
    public static func encode(_ message: OSCMessage) -> Data {
        var data = Data()
        writeString(message.address, into: &data)
        var tags = ","
        for value in message.values {
            switch value {
            case .float: tags.append("f")
            case .int: tags.append("i")
            case .string: tags.append("s")
            }
        }
        writeString(tags, into: &data)
        for value in message.values {
            switch value {
            case let .float(number):
                var bits = UInt32(Float(number).bitPattern).bigEndian
                data.append(Data(bytes: &bits, count: 4))
            case let .int(number):
                var bits = Int32(number).bigEndian
                data.append(Data(bytes: &bits, count: 4))
            case let .string(text):
                writeString(text, into: &data)
            }
        }
        return data
    }

    public static func decode(_ data: Data) -> [OSCMessage] {
        if data.starts(with: Data("#bundle".utf8)) {
            return decodeBundle(data)
        }
        guard let message = decodeOne(data) else { return [] }
        return [message]
    }

    private static func decodeBundle(_ data: Data) -> [OSCMessage] {
        var cursor = 16 // "#bundle\0" (8) + timetag (8)
        var messages: [OSCMessage] = []
        while cursor + 4 <= data.count {
            let size = Int(readInt(data, cursor))
            cursor += 4
            guard size > 0, cursor + size <= data.count else { break }
            let slice = data.subdata(in: cursor..<(cursor + size))
            cursor += size
            messages.append(contentsOf: decode(slice))
        }
        return messages
    }

    private static func decodeOne(_ data: Data) -> OSCMessage? {
        var cursor = 0
        guard let address = readString(data, &cursor), address.hasPrefix("/") else { return nil }
        guard let tags = readString(data, &cursor), tags.hasPrefix(",") else { return nil }
        var values: [OSCValue] = []
        for tag in tags.dropFirst() {
            switch tag {
            case "f":
                guard cursor + 4 <= data.count else { return nil }
                let bits = readUInt32(data, cursor)
                cursor += 4
                values.append(.float(Double(Float(bitPattern: bits))))
            case "i":
                guard cursor + 4 <= data.count else { return nil }
                values.append(.int(Int(readInt(data, cursor))))
                cursor += 4
            case "s":
                guard let text = readString(data, &cursor) else { return nil }
                values.append(.string(text))
            case "T":
                values.append(.int(1))
            case "F":
                values.append(.int(0))
            default:
                return nil
            }
        }
        return OSCMessage(address: address, values: values)
    }

    private static func writeString(_ text: String, into data: inout Data) {
        data.append(Data(text.utf8))
        data.append(0)
        while data.count % 4 != 0 { data.append(0) }
    }

    private static func readString(_ data: Data, _ cursor: inout Int) -> String? {
        guard cursor < data.count else { return nil }
        guard let end = data[cursor...].firstIndex(of: 0) else { return nil }
        let text = String(data: data[cursor..<end], encoding: .utf8) ?? ""
        cursor = (end + 1 + 3) & ~3
        return text
    }

    private static func readUInt32(_ data: Data, _ cursor: Int) -> UInt32 {
        let b0 = UInt32(data[cursor])
        let b1 = UInt32(data[cursor + 1])
        let b2 = UInt32(data[cursor + 2])
        let b3 = UInt32(data[cursor + 3])
        return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
    }

    private static func readInt(_ data: Data, _ cursor: Int) -> Int32 {
        Int32(bitPattern: readUInt32(data, cursor))
    }
}

public final class OSCEngine: @unchecked Sendable {
    private let lock = NSLock()
    private var fd: Int32 = -1
    private var inbox: [OSCMessage] = []
    private var thread: Thread?
    public var inPort: UInt16 = 8000
    public var outPort: UInt16 = 9000
    public var outHost: String = "127.0.0.1"

    public init() {}

    /// Starts listening. Returns an error string, or nil when the port is open.
    public func start(port: UInt16) -> String? {
        stop()
        let socketFD = socket(AF_INET, SOCK_DGRAM, 0)
        guard socketFD >= 0 else { return "OSC socket failed" }
        var reuse: Int32 = 1
        setsockopt(socketFD, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = port.bigEndian
        address.sin_addr.s_addr = in_addr_t(0).bigEndian
        let bound = withUnsafePointer(to: &address) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                bind(socketFD, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else {
            close(socketFD)
            return "OSC port \(port) is in use"
        }
        lock.lock()
        fd = socketFD
        inPort = port
        lock.unlock()
        let worker = Thread { [weak self] in self?.receiveLoop(socketFD) }
        worker.name = "KOOG Pro Viz OSC"
        thread = worker
        worker.start()
        return nil
    }

    public func stop() {
        lock.lock()
        let current = fd
        fd = -1
        lock.unlock()
        if current >= 0 { close(current) }
    }

    public func poll() -> [OSCMessage] {
        lock.lock()
        let batch = inbox
        inbox.removeAll(keepingCapacity: true)
        lock.unlock()
        return batch
    }

    public func send(_ message: OSCMessage) {
        let payload = OSCCodec.encode(message)
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = outPort.bigEndian
        address.sin_addr.s_addr = inet_addr(outHost)
        _ = payload.withUnsafeBytes { buffer in
            withUnsafePointer(to: &address) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                    sendto(fd, buffer.baseAddress, buffer.count, 0, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
                }
            }
        }
    }

    private func receiveLoop(_ socketFD: Int32) {
        var buffer = [UInt8](repeating: 0, count: 4096)
        while true {
            let count = buffer.withUnsafeMutableBytes { raw -> Int in
                guard let base = raw.baseAddress else { return -1 }
                return recv(socketFD, base, raw.count, 0)
            }
            if count <= 0 { break }
            let data = Data(buffer.prefix(count))
            let messages = OSCCodec.decode(data)
            guard !messages.isEmpty else { continue }
            lock.lock()
            inbox.append(contentsOf: messages)
            if inbox.count > 200 { inbox.removeFirst(inbox.count - 200) }
            lock.unlock()
        }
    }
}
