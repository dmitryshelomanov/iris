import CoreGraphics
import CoreImage
import Foundation
import UIKit
import onnxruntime_objc

enum AnimeStylizeError: LocalizedError {
  case invalidStyle
  case modelMissing
  case decodeFailed
  case encodeFailed
  case inferenceFailed(String)

  var errorDescription: String? {
    switch self {
    case .invalidStyle: return "Unsupported anime style"
    case .modelMissing: return "AnimeGANv3 model missing from app bundle"
    case .decodeFailed: return "Could not decode photo for anime stylize"
    case .encodeFailed: return "Could not encode anime JPEG"
    case .inferenceFailed(let message): return "Anime inference failed: \(message)"
    }
  }
}

/// On-device AnimeGANv3 (Shinkai / Hayao) via ONNX Runtime (CPU).
/// CoreML EP is intentionally disabled: these models have dynamic H×W and crash under CoreML EP.
enum AnimeStylize {
  private static let styleToModel: [String: String] = [
    "animegan-v3-shinkai": "AnimeGANv3_Shinkai_37",
    "animegan-v3-hayao": "AnimeGANv3_Hayao_36",
  ]
  private static let maxSide = 1024
  private static let align = 8
  private static let minSide = 256
  /// Serializes session create + Run — ORT sessions are not safe for concurrent Run.
  private static let runLock = NSLock()
  private static var cachedSessions: [String: ORTSession] = [:]
  private static var cachedEnv: ORTEnv?
  private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

  static func stylizePhoto(inputPath: String, style: String, strength: Double) throws -> [String: Any] {
    guard let modelFileName = styleToModel[style] else { throw AnimeStylizeError.invalidStyle }

    let strength = max(0, min(1, strength))
    let inputURL = URL(fileURLWithPath: stripFileScheme(inputPath))
    guard let source = loadOrientedCGImage(at: inputURL.path) else {
      throw AnimeStylizeError.decodeFailed
    }

    if strength <= 0.01 {
      return passthrough(url: inputURL)
    }

    runLock.lock()
    defer { runLock.unlock() }

    let origW = source.width
    let origH = source.height
    let (inferW, inferH) = alignedSize(width: origW, height: origH, maxSide: maxSide)

    guard let resized = resize(source, width: inferW, height: inferH) else {
      throw AnimeStylizeError.decodeFailed
    }

    let inputTensor = try floatTensorNHWC(from: resized)
    let session = try sharedSessionLocked(modelFileName: modelFileName)

    let output: ORTValue
    do {
      let inputNameList = try session.inputNames()
      guard let inputName = inputNameList.first else {
        throw AnimeStylizeError.inferenceFailed("No input names")
      }
      let outputNameList = try session.outputNames()
      guard let firstName = outputNameList.first else {
        throw AnimeStylizeError.inferenceFailed("No output names")
      }
      let outputs = try session.run(
        withInputs: [inputName: inputTensor],
        outputNames: Set([firstName]),
        runOptions: nil
      )
      guard let value = outputs[firstName] else {
        throw AnimeStylizeError.inferenceFailed("No output tensor")
      }
      output = value
    } catch let err as AnimeStylizeError {
      throw err
    } catch {
      throw AnimeStylizeError.inferenceFailed(String(describing: error))
    }

    guard let stylized = image(fromNHWC: output, width: inferW, height: inferH) else {
      throw AnimeStylizeError.inferenceFailed("Output tensor shape mismatch or decode failed")
    }

    guard let fullRes = resize(stylized, width: origW, height: origH) else {
      throw AnimeStylizeError.decodeFailed
    }
    // Mild clarity after upscale — recovers edge snap lost in infer→full-res.
    let sharpened = sharpen(fullRes, intensity: 0.65) ?? fullRes

    let blended: CGImage
    if strength >= 0.999 {
      blended = sharpened
    } else if let mix = blend(original: source, stylized: sharpened, strength: CGFloat(strength)) {
      blended = mix
    } else {
      blended = sharpened
    }

    let outURL = try writeJPEG(blended, quality: 0.95)
    return [
      "path": outURL.path,
      "uri": outURL.absoluteString,
    ]
  }

  private static func passthrough(url: URL) -> [String: Any] {
    ["path": url.path, "uri": url.absoluteString]
  }

  private static func stripFileScheme(_ path: String) -> String {
    if path.hasPrefix("file://") {
      return URL(string: path)?.path ?? path.replacingOccurrences(of: "file://", with: "")
    }
    return path
  }

  /// Decode with EXIF orientation applied (VisionCamera masters are often rotated).
  private static func loadOrientedCGImage(at path: String) -> CGImage? {
    guard let ui = UIImage(contentsOfFile: path) else { return nil }
    if let cg = ui.cgImage, ui.imageOrientation == .up {
      return cg
    }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    let size = ui.size
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let flattened = renderer.image { _ in
      ui.draw(in: CGRect(origin: .zero, size: size))
    }
    return flattened.cgImage
  }

  /// Scale to maxSide, then align each dim to ×8 with min 256 (AnimeGANv3).
  private static func alignedSize(width: Int, height: Int, maxSide: Int) -> (Int, Int) {
    let scale = min(1.0, Double(maxSide) / Double(max(width, height)))
    var tw = Int((Double(width) * scale).rounded())
    var th = Int((Double(height) * scale).rounded())
    tw = max(minSide, ((tw + align - 1) / align) * align)
    th = max(minSide, ((th + align - 1) / align) * align)
    return (tw, th)
  }

  private static func modelPath(modelFileName: String) throws -> String {
    let host = Bundle(for: IrisLookBakeModule.self)
    let candidates: [Bundle] = [
      Bundle.main.url(forResource: "IrisLookBake", withExtension: "bundle").flatMap(Bundle.init(url:)),
      host.url(forResource: "IrisLookBake", withExtension: "bundle").flatMap(Bundle.init(url:)),
      host,
      Bundle.main,
    ].compactMap { $0 }

    for bundle in candidates {
      if let path = bundle.path(forResource: modelFileName, ofType: "onnx") {
        return path
      }
    }
    throw AnimeStylizeError.modelMissing
  }

  /// Caller must hold [runLock].
  private static func sharedSessionLocked(modelFileName: String) throws -> ORTSession {
    if let cached = cachedSessions[modelFileName] { return cached }

    let env: ORTEnv
    if let cachedEnv {
      env = cachedEnv
    } else {
      env = try ORTEnv(loggingLevel: .warning)
      cachedEnv = env
    }
    let options = try ORTSessionOptions()
    // CPU only — CoreML EP SEGV on this dynamic-shape AnimeGANv3 ONNX.
    try options.setGraphOptimizationLevel(.basic)
    try options.setIntraOpNumThreads(2)
    let session = try ORTSession(
      env: env,
      modelPath: try modelPath(modelFileName: modelFileName),
      sessionOptions: options
    )
    cachedSessions[modelFileName] = session
    return session
  }

  private static func resize(_ image: CGImage, width: Int, height: Int) -> CGImage? {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: nil,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return ctx.makeImage()
  }

  private static func sharpen(_ image: CGImage, intensity: Float) -> CGImage? {
    let input = CIImage(cgImage: image)
    guard let filter = CIFilter(name: "CISharpenLuminance") else { return nil }
    filter.setValue(input, forKey: kCIInputImageKey)
    filter.setValue(intensity, forKey: kCIInputSharpnessKey)
    guard let output = filter.outputImage else { return nil }
    let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    return ciContext.createCGImage(output, from: rect)
  }

  private static func floatTensorNHWC(from image: CGImage) throws -> ORTValue {
    let width = image.width
    let height = image.height
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let ctx = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      throw AnimeStylizeError.decodeFailed
    }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    var floats = [Float](repeating: 0, count: width * height * 3)
    for i in 0..<(width * height) {
      let o = i * 4
      let base = i * 3
      // Undo premultiplied alpha roughly (alpha is 255 from our contexts).
      floats[base] = Float(pixels[o]) / 127.5 - 1.0
      floats[base + 1] = Float(pixels[o + 1]) / 127.5 - 1.0
      floats[base + 2] = Float(pixels[o + 2]) / 127.5 - 1.0
    }

    // Copy into owned NSMutableData — never pass &Array storage directly to ORT.
    let byteCount = floats.count * MemoryLayout<Float>.size
    let data = floats.withUnsafeBufferPointer { buf -> NSMutableData in
      NSMutableData(bytes: buf.baseAddress, length: byteCount)
    }
    let shape: [NSNumber] = [1, NSNumber(value: height), NSNumber(value: width), 3]
    return try ORTValue(
      tensorData: data,
      elementType: .float,
      shape: shape
    )
  }

  private static func image(fromNHWC value: ORTValue, width: Int, height: Int) -> CGImage? {
    guard let tensorData = try? value.tensorData() else { return nil }
    let count = width * height * 3
    let expectedBytes = count * MemoryLayout<Float>.size
    // Require exact element count — short buffers corrupt pixels; longer may be padded OK.
    guard tensorData.length >= expectedBytes else { return nil }

    let bytes = tensorData as Data
    let floats: [Float] = bytes.withUnsafeBytes { raw in
      let buffer = raw.bindMemory(to: Float.self)
      guard buffer.count >= count else { return [] }
      return Array(buffer.prefix(count))
    }
    guard floats.count == count else { return nil }

    var pixels = [UInt8](repeating: 255, count: width * height * 4)
    for i in 0..<(width * height) {
      let base = i * 3
      let o = i * 4
      pixels[o] = u8((floats[base] + 1.0) * 127.5)
      pixels[o + 1] = u8((floats[base + 1] + 1.0) * 127.5)
      pixels[o + 2] = u8((floats[base + 2] + 1.0) * 127.5)
      pixels[o + 3] = 255
    }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    return ctx.makeImage()
  }

  private static func u8(_ v: Float) -> UInt8 {
    UInt8(max(0, min(255, v.rounded())))
  }

  private static func blend(original: CGImage, stylized: CGImage, strength: CGFloat) -> CGImage? {
    let width = original.width
    let height = original.height
    guard stylized.width == width, stylized.height == height else { return stylized }
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var a = [UInt8](repeating: 0, count: width * height * 4)
    var b = [UInt8](repeating: 0, count: width * height * 4)
    guard
      let ctxA = CGContext(
        data: &a, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ),
      let ctxB = CGContext(
        data: &b, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      )
    else { return nil }
    ctxA.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))
    ctxB.draw(stylized, in: CGRect(x: 0, y: 0, width: width, height: height))

    let t = Float(strength)
    let u = 1 - t
    for i in 0..<(width * height * 4) {
      if i % 4 == 3 {
        a[i] = 255
        continue
      }
      a[i] = UInt8(max(0, min(255, (Float(a[i]) * u + Float(b[i]) * t).rounded())))
    }
    return ctxA.makeImage()
  }

  private static func writeJPEG(_ image: CGImage, quality: CGFloat) throws -> URL {
    let ui = UIImage(cgImage: image)
    guard let data = ui.jpegData(compressionQuality: quality) else {
      throw AnimeStylizeError.encodeFailed
    }
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
      .appendingPathComponent("looks", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let out = dir.appendingPathComponent("iris-anime-\(UUID().uuidString).jpg")
    try data.write(to: out, options: .atomic)
    return out
  }
}
