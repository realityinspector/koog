import Darwin
import Foundation

/// A non-blocking 9600 8N1 serial port. Lines are split on newline.
public final class SerialLink: @unchecked Sendable {
    private var fd: Int32 = -1
    private let lock = NSLock()
    private var pending = ""

    public init() {}

    public var isOpen: Bool {
        lock.lock()
        defer { lock.unlock() }
        return fd >= 0
    }

    /// Returns an error string, or nil when the port is open.
    public func open(path: String) -> String? {
        close()
        let handle = Darwin.open(path, O_RDWR | O_NOCTTY | O_NONBLOCK)
        guard handle >= 0 else { return "Couldn't open \(path) (\(String(cString: strerror(errno))))" }
        var options = termios()
        guard tcgetattr(handle, &options) == 0 else {
            Darwin.close(handle)
            return "Couldn't read the serial settings"
        }
        cfmakeraw(&options)
        cfsetspeed(&options, speed_t(B9600))
        options.c_cflag |= tcflag_t(CLOCAL | CREAD)
        options.c_cflag &= ~tcflag_t(PARENB | CSTOPB | CRTSCTS)
        options.c_cflag = (options.c_cflag & ~tcflag_t(CSIZE)) | tcflag_t(CS8)
        guard tcsetattr(handle, TCSANOW, &options) == 0 else {
            Darwin.close(handle)
            return "Couldn't set 9600 8N1"
        }
        lock.lock()
        fd = handle
        pending = ""
        lock.unlock()
        return nil
    }

    public func close() {
        lock.lock()
        let handle = fd
        fd = -1
        pending = ""
        lock.unlock()
        if handle >= 0 { Darwin.close(handle) }
    }

    public func readLine() -> String? {
        lock.lock()
        let handle = fd
        lock.unlock()
        guard handle >= 0 else { return nil }
        var buffer = [UInt8](repeating: 0, count: 256)
        let count = Darwin.read(handle, &buffer, buffer.count)
        lock.lock()
        defer { lock.unlock() }
        if count > 0 {
            pending.append(String(decoding: buffer.prefix(count), as: UTF8.self))
        }
        guard let newline = pending.firstIndex(of: "\n") else { return nil }
        let line = pending[..<newline].trimmingCharacters(in: .whitespacesAndNewlines)
        pending = String(pending[pending.index(after: newline)...])
        return line.isEmpty ? nil : line
    }

    deinit { close() }
}
