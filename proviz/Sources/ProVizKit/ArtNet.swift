import Darwin
import Foundation

public struct ArtDmx: Equatable, Sendable {
    public var universe: Int
    public var sequence: Int
    public var channels: [UInt8]

    public init(universe: Int, sequence: Int = 0, channels: [UInt8]) {
        self.universe = universe
        self.sequence = sequence
        self.channels = channels
    }
}

public enum ArtNet {
    public static func encode(_ packet: ArtDmx) -> Data {
        var data = Data("Art-Net\0".utf8)
        data.append(contentsOf: [0x00, 0x50]) // OpDmx, little endian
        data.append(contentsOf: [0x00, 14]) // protocol version, big endian
        data.append(UInt8(packet.sequence & 0xFF))
        data.append(0)
        let universe = UInt16(max(0, min(32767, packet.universe)))
        data.append(UInt8(universe & 0xFF))
        data.append(UInt8(universe >> 8))
        let count = min(512, packet.channels.count)
        let length = UInt16((count + 1) & ~1) // even length, Art-Net requirement
        data.append(UInt8(length >> 8))
        data.append(UInt8(length & 0xFF))
        data.append(contentsOf: packet.channels.prefix(count))
        if data.count < 18 + Int(length) {
            data.append(contentsOf: [UInt8](repeating: 0, count: 18 + Int(length) - data.count))
        }
        return data
    }

    public static func decode(_ data: Data) -> ArtDmx? {
        guard data.count >= 18 else { return nil }
        guard data.prefix(8).elementsEqual(Data("Art-Net\0".utf8)) else { return nil }
        let opcode = Int(data[8]) | (Int(data[9]) << 8)
        guard opcode == 0x5000 else { return nil }
        let sequence = Int(data[12])
        let universe = Int(data[14]) | (Int(data[15]) << 8)
        let length = (Int(data[16]) << 8) | Int(data[17])
        guard length >= 2, data.count >= 18 + min(length, 512) || data.count > 18 else { return nil }
        let available = min(length, data.count - 18, 512)
        guard available > 0 else { return nil }
        return ArtDmx(universe: universe, sequence: sequence, channels: Array(data[18..<(18 + available)]))
    }
}

public final class ArtNetEngine: @unchecked Sendable {
    public private(set) var status = "Art-Net off"
    private let lock = NSLock()
    private var fd: Int32 = -1
    private var inbox: [ArtDmx] = []
    private var thread: Thread?

    public init() {}

    public func start() -> String? {
        stop()
        let socketFD = socket(AF_INET, SOCK_DGRAM, 0)
        guard socketFD >= 0 else { return "Art-Net socket failed" }
        var reuse: Int32 = 1
        setsockopt(socketFD, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
        var broadcast: Int32 = 1
        setsockopt(socketFD, SOL_SOCKET, SO_BROADCAST, &broadcast, socklen_t(MemoryLayout<Int32>.size))
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = UInt16(6454).bigEndian
        address.sin_addr.s_addr = in_addr_t(0).bigEndian
        let bound = withUnsafePointer(to: &address) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                bind(socketFD, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else {
            close(socketFD)
            return "Art-Net port 6454 is in use"
        }
        lock.lock()
        fd = socketFD
        lock.unlock()
        status = "Art-Net 6454"
        let worker = Thread { [weak self] in self?.receive(socketFD) }
        worker.name = "KOOG Pro Viz Art-Net"
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
        status = "Art-Net off"
    }

    public func poll() -> [ArtDmx] {
        lock.lock()
        let batch = inbox
        inbox.removeAll(keepingCapacity: true)
        lock.unlock()
        return batch
    }

    public func send(_ packet: ArtDmx) {
        lock.lock()
        let socketFD = fd
        lock.unlock()
        guard socketFD >= 0 else { return }
        let payload = ArtNet.encode(packet)
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = UInt16(6454).bigEndian
        address.sin_addr.s_addr = inet_addr("255.255.255.255")
        _ = payload.withUnsafeBytes { buffer in
            withUnsafePointer(to: &address) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
                    sendto(socketFD, buffer.baseAddress, buffer.count, 0, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
                }
            }
        }
    }

    private func receive(_ socketFD: Int32) {
        var buffer = [UInt8](repeating: 0, count: 2048)
        while true {
            let count = buffer.withUnsafeMutableBytes { raw -> Int in
                guard let base = raw.baseAddress else { return -1 }
                return recv(socketFD, base, raw.count, 0)
            }
            if count <= 0 { break }
            if let packet = ArtNet.decode(Data(buffer.prefix(count))) {
                lock.lock()
                inbox.append(packet)
                if inbox.count > 30 { inbox.removeFirst(inbox.count - 30) }
                lock.unlock()
            }
        }
    }
}
