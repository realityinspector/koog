import AVFoundation
import Accelerate
import Foundation

public struct AudioFrame: Sendable {
    public var bass: Double
    public var mid: Double
    public var treble: Double
    public var level: Double
    public var onset: Bool
}

public final class AudioAnalyzer: @unchecked Sendable {
    public private(set) var status: String = "Audio off"
    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var pending: [Float] = []
    private var low: Float = 0
    private var high: Float = 0
    private var bassEnv: Float = 0
    private var midEnv: Float = 0
    private var highEnv: Float = 0
    private var levelEnv: Float = 0
    private var lastBass: Float = 0
    private var sampleRate: Float = 48_000
    private var started = false
    private var wave = [Float](repeating: 0, count: 128)
    private var fft: vDSP.FFT<DSPSplitComplex>?
    private let fftCount = 1024

    public init() {}

    public func start() async {
        guard !started else { return }
        started = true
        let allowed = await AVCaptureDevice.requestAccess(for: .audio)
        guard allowed else {
            status = "Microphone blocked"
            return
        }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            status = "No audio input"
            return
        }
        sampleRate = Float(format.sampleRate)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.append(buffer)
        }
        do {
            try engine.start()
            status = "Listening"
        } catch {
            status = "Audio didn't start"
            started = false
        }
    }

    public func stop() {
        guard started else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        started = false
        status = "Audio off"
    }

    public func pull() -> AudioFrame {
        lock.lock()
        let samples = pending
        pending.removeAll(keepingCapacity: true)
        lock.unlock()

        var onset = false
        if !samples.isEmpty {
            let step = max(1, samples.count / wave.count)
            for index in 0..<wave.count {
                let sampleIndex = min(samples.count - 1, index * step)
                wave[index] = samples[sampleIndex]
            }
            let timePower = samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(samples.count)
            let bands = spectrum(samples) ?? (bass: timePower, mid: timePower * 0.3, high: timePower * 0.15)
            let total = bands.bass + bands.mid + bands.high + 1e-12
            let follow: Float = 0.35
            bassEnv += (timePower * bands.bass / total - bassEnv) * follow
            midEnv += (timePower * bands.mid / total - midEnv) * follow
            highEnv += (timePower * bands.high / total - highEnv) * follow
            levelEnv += (timePower - levelEnv) * follow
            if bassEnv > 0.0008 && bassEnv > lastBass * 1.8 && bassEnv > midEnv {
                onset = true
            }
            lastBass = bassEnv
        } else {
            bassEnv *= 0.92
            midEnv *= 0.92
            highEnv *= 0.92
            levelEnv *= 0.92
            lastBass = bassEnv
        }
        return AudioFrame(
            bass: unit(bassEnv),
            mid: unit(midEnv),
            treble: unit(highEnv),
            level: unit(levelEnv),
            onset: onset
        )
    }

    public func waveform() -> [Float] {
        lock.lock()
        defer { lock.unlock() }
        return wave
    }

    private func append(_ buffer: AVAudioPCMBuffer) {
        guard let channels = buffer.floatChannelData else { return }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return }
        var copy = [Float](repeating: 0, count: count)
        copy.withUnsafeMutableBufferPointer { dest in
            guard let base = dest.baseAddress else { return }
            base.update(from: channels[0], count: count)
        }
        lock.lock()
        pending.append(contentsOf: copy)
        if pending.count > 16_384 {
            pending.removeFirst(pending.count - 16_384)
        }
        lock.unlock()
    }

    /// 1024-point FFT. Bass is under 140 Hz, mids under 2 kHz, and the rest is treble.
    private func spectrum(_ samples: [Float]) -> (bass: Float, mid: Float, high: Float)? {
        guard samples.count >= 256 else { return nil }
        if fft == nil {
            fft = vDSP.FFT(log2n: 10, radix: .radix2, ofType: DSPSplitComplex.self)
        }
        guard let fft else { return nil }
        let count = fftCount
        var real = [Float](repeating: 0, count: count)
        var imag = [Float](repeating: 0, count: count)
        let start = max(0, samples.count - count)
        let length = samples.count - start
        for index in 0..<length {
            let hann = 0.5 - 0.5 * cos(2 * Float.pi * Float(index) / Float(max(1, length)))
            real[index] = samples[start + index] * hann
        }
        var outReal = [Float](repeating: 0, count: count)
        var outImag = [Float](repeating: 0, count: count)
        real.withUnsafeMutableBufferPointer { realPointer in
            imag.withUnsafeMutableBufferPointer { imagPointer in
                outReal.withUnsafeMutableBufferPointer { outRealPointer in
                    outImag.withUnsafeMutableBufferPointer { outImagPointer in
                        guard let realBase = realPointer.baseAddress,
                              let imagBase = imagPointer.baseAddress,
                              let outRealBase = outRealPointer.baseAddress,
                              let outImagBase = outImagPointer.baseAddress else { return }
                        let input = DSPSplitComplex(realp: realBase, imagp: imagBase)
                        var output = DSPSplitComplex(realp: outRealBase, imagp: outImagBase)
                        fft.forward(input: input, output: &output)
                    }
                }
            }
        }
        let binHz = sampleRate / Float(count)
        func energy(_ fromHz: Float, _ toHz: Float) -> Float {
            let lower = max(1, Int(fromHz / max(binHz, 1)))
            let upper = min(count / 2 - 1, Int(toHz / max(binHz, 1)))
            guard upper > lower else { return 0 }
            var sum: Float = 0
            for bin in lower...upper {
                sum += outReal[bin] * outReal[bin] + outImag[bin] * outImag[bin]
            }
            return sum / Float(upper - lower + 1)
        }
        return (energy(20, 140), energy(140, 2000), energy(2000, sampleRate * 0.45))
    }

    private func unit(_ power: Float) -> Double {
        let db = 10 * log10(max(power, 1e-8))
        let normalized = (db + 48) / 42
        return Double(min(1, max(0, normalized)))
    }
}
