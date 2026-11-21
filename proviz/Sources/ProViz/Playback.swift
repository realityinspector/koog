import AVFoundation
import AppKit
import CoreImage
import CoreMedia
import CoreVideo
import Metal
import MetalKit
import ScreenCaptureKit
import ProVizKit

/// Movies, stills, text, the camera, and the screen, as Metal textures for the eight layers.
@MainActor
final class PlaybackDeck {
    private var cache: CVMetalTextureCache?
    private var movies: [String: MovieSlot] = [:]
    private var stills: [String: MTLTexture] = [:]
    private var stillStamp: [String: String] = [:]
    private var textTextures: [String: MTLTexture] = [:]
    private var textStamp: [String: String] = [:]
    private var tokens: [String: Int] = [:]
    private var inspected: Set<String> = []
    private var layerTextures: [MTLTexture?] = Array(repeating: nil, count: 8)
    private var primed: [String: AVPlayer] = [:]
    private var blank: MTLTexture?
    private let camera = CameraGrab()
    private let screen = ScreenGrab()
    private var ci: CIContext?
    var cameraStatus: String { camera.status }
    var screenStatus: String { screen.status }

    func texture(for index: Int) -> MTLTexture? {
        guard layerTextures.indices.contains(index) else { return blank }
        return layerTextures[index] ?? blank
    }

    func sync(device: MTLDevice, session: Session) {
        if cache == nil {
            var created: CVMetalTextureCache?
            CVMetalTextureCacheCreate(nil, nil, device, nil, &created)
            cache = created
        }
        if blank == nil { blank = solid(device, color: (0, 0, 0, 0)) }
        if ci == nil { ci = CIContext(mtlDevice: device) }
        for path in session.pullPrimePaths() { prime(path) }
        for (index, prefix) in LayerStack.prefixes.enumerated() {
            let source = LayerStack.choice(session.values["\(prefix).source"] ?? 0, count: LayerStack.sources.count)
            switch source {
            case 1:
                layerTextures[index] = mediaTexture(device: device, session: session, prefix: prefix)
            case 2:
                layerTextures[index] = textTexture(device: device, session: session, prefix: prefix)
            case 3:
                camera.ensureStarted()
                layerTextures[index] = camera.latestBuffer().flatMap { texture(from: $0, device: device) } ?? blank
            case 4:
                screen.ensureStarted()
                layerTextures[index] = screen.latestBuffer().flatMap { texture(from: $0, device: device) } ?? blank
            default:
                layerTextures[index] = blank
            }
        }
    }

    private func mediaTexture(device: MTLDevice, session: Session, prefix: String) -> MTLTexture? {
        guard let id = session.clipForLayer[prefix], let clip = session.clips.first(where: { $0.id == id }) else { return blank }
        inspect(clip, session: session)
        let url = URL(fileURLWithPath: clip.path)
        if clip.kind == "image" {
            let effect = LayerStack.choice(session.values["\(prefix).effect0"] ?? 0, count: LayerStack.effects.count)
            let amount = session.values["\(prefix).effect0amt"] ?? 0
            let stamp = "\(clip.path)#\(effect)#\(String(format: "%.3f", amount))"
            if stillStamp[prefix] != stamp {
                stills[prefix] = imageTexture(device: device, url: url, effect: effect, amount: amount, session: session, prefix: prefix)
                stillStamp[prefix] = stamp
            }
            return stills[prefix] ?? blank
        }
        let slot: MovieSlot
        if let existing = movies[prefix], existing.url == url {
            slot = existing
        } else {
            slot = MovieSlot(url: url)
            movies[prefix] = slot
        }
        let token = session.clipToken[prefix] ?? 0
        if tokens[prefix] != token {
            tokens[prefix] = token
            if clip.trigger == "toggle", slot.player.rate > 0 {
                slot.player.pause()
            } else {
                slot.player.seek(to: .zero)
                slot.player.play()
            }
        }
        let speed = session.values["\(prefix).speed"] ?? 0.5
        var rate = Float(0.15 + speed * 1.7)
        if (session.values["\(prefix).reverse"] ?? 0) > 0.5 { rate = -max(0.25, abs(rate)) }
        if let item = slot.player.currentItem {
            let duration = item.duration.seconds
            let now = item.currentTime().seconds
            if clip.trigger == "loop", duration.isFinite, duration > 0.2, rate >= 0, now > duration - 0.05 {
                slot.player.seek(to: .zero)
            }
            if rate < 0, duration.isFinite, duration > 0.2, now < 0.08 {
                slot.player.seek(to: CMTime(seconds: duration - 0.12, preferredTimescale: 600))
            }
            let nudge = session.takeNudge(prefix)
            if abs(nudge) > 0.001 {
                var target = now + nudge
                if duration.isFinite, duration > 0 {
                    while target < 0 { target += duration }
                    while target > duration { target -= duration }
                }
                slot.player.seek(to: CMTime(seconds: max(0, target), preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
            }
        }
        if abs(slot.player.rate - rate) > 0.05 { slot.player.rate = rate }
        let time = slot.output.itemTime(forHostTime: CACurrentMediaTime())
        guard slot.output.hasNewPixelBuffer(forItemTime: time),
              let buffer = slot.output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else {
            return layerTextures[LayerStack.index(of: prefix)] ?? blank
        }
        if let texture = texture(from: buffer, device: device) {
            let height = max(1, CVPixelBufferGetHeight(buffer))
            session.setAspect(prefix, Double(CVPixelBufferGetWidth(buffer)) / Double(height))
            return texture
        }
        return blank
    }

    private func prime(_ path: String) {
        guard primed[path] == nil, primed.count < 6 else { return }
        let item = AVPlayerItem(url: URL(fileURLWithPath: path))
        item.preferredForwardBufferDuration = 1.5
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.preroll(atRate: 1) { _ in }
        primed[path] = player
    }

    private func imageTexture(device: MTLDevice, url: URL, effect: Int, amount: Double, session: Session, prefix: String) -> MTLTexture? {
        guard var image = CIImage(contentsOf: url) else { return nil }
        if image.extent.height > 1 {
            session.setAspect(prefix, Double(image.extent.width / image.extent.height))
        }
        if effect == 6 {
            image = image.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: amount * 2])
        } else if effect == 7 {
            image = image.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: amount * 24]).cropped(to: image.extent)
        }
        let width = max(1, Int(image.extent.width))
        let height = max(1, Int(image.extent.height))
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: min(width, 1920), height: min(height, 1080), mipmapped: false)
        descriptor.usage = [.shaderRead, .shaderWrite]
        descriptor.storageMode = .shared
        guard let texture = device.makeTexture(descriptor: descriptor), let ci else { return nil }
        let scaled = image.transformed(by: CGAffineTransform(scaleX: CGFloat(texture.width) / image.extent.width, y: CGFloat(texture.height) / image.extent.height))
        ci.render(scaled, to: texture, commandBuffer: nil, bounds: CGRect(x: 0, y: 0, width: texture.width, height: texture.height), colorSpace: CGColorSpaceCreateDeviceRGB())
        return texture
    }

    private func textTexture(device: MTLDevice, session: Session, prefix: String) -> MTLTexture? {
        let text = session.texts[prefix] ?? "Pro Viz"
        if textStamp[prefix] == text, let existing = textTextures[prefix] { return existing }
        let size = NSSize(width: 960, height: 540)
        let image = NSImage(size: size)
        image.lockFocus()
        NSColor.clear.setFill()
        NSRect(origin: .zero, size: size).fill()
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 72, weight: .semibold),
            .foregroundColor: NSColor.white,
            .paragraphStyle: style,
        ]
        let rect = NSRect(x: 40, y: 180, width: 880, height: 220)
        (text as NSString).draw(in: rect, withAttributes: attributes)
        image.unlockFocus()
        guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return blank }
        let loader = MTKTextureLoader(device: device)
        let texture = try? loader.newTexture(cgImage: cg, options: [.SRGB: false, .textureUsage: NSNumber(value: MTLTextureUsage.shaderRead.rawValue)])
        textTextures[prefix] = texture
        textStamp[prefix] = text
        return texture ?? blank
    }

    private func texture(from buffer: CVPixelBuffer, device: MTLDevice) -> MTLTexture? {
        guard let cache else { return nil }
        var metal: CVMetalTexture?
        let result = CVMetalTextureCacheCreateTextureFromImage(
            nil, cache, buffer, nil, .bgra8Unorm,
            CVPixelBufferGetWidth(buffer), CVPixelBufferGetHeight(buffer), 0, &metal
        )
        guard result == kCVReturnSuccess, let metal else { return nil }
        return CVMetalTextureGetTexture(metal)
    }

    private func solid(_ device: MTLDevice, color: (UInt8, UInt8, UInt8, UInt8)) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: 1, height: 1, mipmapped: false)
        descriptor.usage = [.shaderRead]
        descriptor.storageMode = .shared
        guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }
        var pixel = [color.2, color.1, color.0, color.3]
        texture.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, withBytes: &pixel, bytesPerRow: 4)
        return texture
    }

    private func inspect(_ clip: MediaClip, session: Session) {
        let token = "\(clip.id.uuidString)|\(clip.path)"
        guard clip.kind == "movie", clip.note.isEmpty, !inspected.contains(token) else { return }
        inspected.insert(token)
        let id = clip.id
        let path = clip.path
        Task {
            let asset = AVURLAsset(url: URL(fileURLWithPath: path))
            let playable = (try? await asset.load(.isPlayable)) ?? false
            var hap = false
            if let track = try? await asset.loadTracks(withMediaType: .video).first {
                let descriptions = (try? await track.load(.formatDescriptions)) ?? []
                hap = descriptions.contains { MovieCodec.isHAP(CMFormatDescriptionGetMediaSubType($0)) }
            }
            var detailParts: [String] = []
            if let track = try? await asset.loadTracks(withMediaType: .video).first {
                if let size = try? await track.load(.naturalSize), size.height > 1 {
                    detailParts.append("\(Int(size.width))×\(Int(size.height))")
                }
                if let fps = try? await track.load(.nominalFrameRate), fps > 1 {
                    detailParts.append(String(format: "%.2f fps", fps))
                }
                let descriptions = (try? await track.load(.formatDescriptions)) ?? []
                if let subtype = descriptions.first.map({ MovieCodec.tag(CMFormatDescriptionGetMediaSubType($0)) }), !subtype.isEmpty {
                    detailParts.append(subtype)
                }
            }
            if let duration = try? await asset.load(.duration).seconds, duration.isFinite, duration > 0 {
                detailParts.append(String(format: "%.1fs", duration))
            }
            let detail = detailParts.joined(separator: " · ")
            let note: String
            if hap && !playable {
                note = "HAP is in this file, and this Mac has no HAP decoder. Install the HAP codec, or transcode to ProRes."
            } else if !playable {
                note = "This file did not open. ProRes, Animation, H.264, and HEVC play when macOS can decode them."
            } else if hap {
                note = "HAP is playing through the installed codec. The file still streams from disk."
            } else {
                note = "Primed the start, then streaming from disk."
            }
            await MainActor.run {
                session.setClip(note: note, id: id)
                if !detail.isEmpty { session.setClipDetail(detail, id: id) }
            }
        }
    }
}

private final class MovieSlot {
    let url: URL
    let player: AVPlayer
    let output: AVPlayerItemVideoOutput

    init(url: URL) {
        self.url = url
        let item = AVPlayerItem(url: url)
        output = AVPlayerItemVideoOutput(pixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ])
        item.preferredForwardBufferDuration = 1.5
        item.add(output)
        player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.preroll(atRate: 1) { _ in }
        player.play()
    }
}

private final class CameraGrab: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    private let session = AVCaptureSession()
    private let lock = NSLock()
    private var latest: CVPixelBuffer?
    private var started = false
    private(set) var status = "Camera idle"

    func ensureStarted() {
        guard !started else { return }
        started = true
        Task { await self.open() }
    }

    func latestBuffer() -> CVPixelBuffer? {
        lock.lock()
        defer { lock.unlock() }
        return latest
    }

    private func open() async {
        let allowed = await AVCaptureDevice.requestAccess(for: .video)
        guard allowed else {
            status = "Camera blocked"
            started = false
            return
        }
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            status = "No camera"
            started = false
            return
        }
        session.addInput(input)
        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "visionboard.camera"))
        guard session.canAddOutput(output) else {
            status = "Camera output failed"
            started = false
            return
        }
        session.addOutput(output)
        session.commitConfiguration()
        session.startRunning()
        status = device.localizedName
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lock.lock()
        latest = buffer
        lock.unlock()
    }
}

private final class ScreenGrab: NSObject, SCStreamOutput, @unchecked Sendable {
    private let lock = NSLock()
    private var latest: CVPixelBuffer?
    private var stream: SCStream?
    private var starting = false
    private(set) var status = "Screen idle"

    func ensureStarted() {
        guard stream == nil, !starting else { return }
        starting = true
        Task { await self.open() }
    }

    func latestBuffer() -> CVPixelBuffer? {
        lock.lock()
        defer { lock.unlock() }
        return latest
    }

    private func open() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else {
                status = "No display"
                starting = false
                return
            }
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let config = SCStreamConfiguration()
            config.width = 960
            config.height = 540
            config.pixelFormat = kCVPixelFormatType_32BGRA
            config.showsCursor = false
            config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
            let stream = SCStream(filter: filter, configuration: config, delegate: nil)
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue(label: "visionboard.screen"))
            try await stream.startCapture()
            self.stream = stream
            status = "Screen capture"
        } catch {
            status = "Screen capture needs permission in System Settings"
            starting = false
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .screen, let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lock.lock()
        latest = buffer
        lock.unlock()
    }
}

@MainActor
final class PerformanceRecorder {
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var frame: Int64 = 0
    private var skip = 0
    private var url: URL?

    func update(session: Session, texture: MTLTexture) {
        if session.recording, writer == nil {
            start(width: texture.width, height: texture.height, session: session)
        }
        if !session.recording, writer != nil {
            finish(session: session)
            return
        }
        guard session.recording, let input, let adaptor, input.isReadyForMoreMediaData else { return }
        skip += 1
        guard skip % 4 == 0 else { return }
        guard let pool = adaptor.pixelBufferPool else { return }
        var pixel: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixel) == kCVReturnSuccess, let pixel else { return }
        CVPixelBufferLockBaseAddress(pixel, [])
        defer { CVPixelBufferUnlockBaseAddress(pixel, []) }
        guard let base = CVPixelBufferGetBaseAddress(pixel) else { return }
        let row = CVPixelBufferGetBytesPerRow(pixel)
        texture.getBytes(base, bytesPerRow: row, from: MTLRegionMake2D(0, 0, texture.width, texture.height), mipmapLevel: 0)
        let when = CMTime(value: frame, timescale: 15)
        frame += 1
        if !adaptor.append(pixel, withPresentationTime: when) {
            session.setRecordStatus("Couldn't write a frame")
        }
    }

    private func start(width: Int, height: Int, session: Session) {
        let folder = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask)[0]
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let url = folder.appendingPathComponent("KOOG-ProViz-\(stamp).mov")
        self.url = url
        do {
            let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
            let settings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: width,
                AVVideoHeightKey: height,
            ]
            let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
            input.expectsMediaDataInRealTime = true
            let source: [String: Any] = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
            ]
            let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: source)
            guard writer.canAdd(input) else {
                session.setRecordStatus("Couldn't start the recording")
                return
            }
            writer.add(input)
            writer.startWriting()
            writer.startSession(atSourceTime: .zero)
            self.writer = writer
            self.input = input
            self.adaptor = adaptor
            frame = 0
            session.setRecordStatus("Recording \(url.lastPathComponent)")
        } catch {
            session.setRecordStatus("Couldn't start the recording")
        }
    }

    private func finish(session: Session) {
        input?.markAsFinished()
        let url = url
        writer?.finishWriting { [weak session] in
            Task { @MainActor in
                if let url {
                    session?.setRecordStatus("Saved \(url.lastPathComponent)")
                }
            }
        }
        writer = nil
        input = nil
        adaptor = nil
    }
}
