import ExpoModulesCore
import AudioToolbox
import AVFoundation
import CoreImage
import Metal
import UIKit

struct BakeLookVideoOptions: Record {
  @Field var matrix: [Double] = []
  @Field var tint: [Double] = []
  @Field var shadows: [Double] = []
  @Field var highlights: [Double] = []
  @Field var vignette: Double = 0
  @Field var grain: Double = 0
  @Field var bloom: Double = 0
  @Field var leak: Double = 0
  @Field var stamp: Double = 0
  @Field var stampText: String = ""
  @Field var smooth: Double = 0
  @Field var posterize: Double = 0
  @Field var edges: Double = 0
}

struct StylizePhotoOptions: Record {
  @Field var style: String = "animegan-v3-shinkai"
  @Field var strength: Double = 1
}

public class IrisLookBakeModule: Module {
  private static let bakeLock = NSLock()
  private static var bakeInFlight = false
  private static let stylizeLock = NSLock()
  private static var stylizeInFlight = false
  private static weak var activeExporter: AVAssetExportSession?
  private static let sharedCIContext: CIContext = {
    if let device = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: device, options: [.cacheIntermediates: false])
    }
    return CIContext(options: [.cacheIntermediates: false])
  }()

  public func definition() -> ModuleDefinition {
    Name("IrisLookBake")

    AsyncFunction("bakeLookIntoVideo") { (inputPath: String, options: BakeLookVideoOptions) -> [String: Any] in
      try await Self.bakeLookIntoVideo(inputPath: inputPath, options: options)
    }

    Function("cancelBakeLookIntoVideo") {
      Self.cancelActiveBake()
    }

    /// Peek/pop/nope via AudioServices — works while the camera session is active
    /// (UIKit / expo-haptics Taptic APIs are silenced by iOS during capture).
    Function("playSystemHaptic") { (kind: String) in
      try? AVAudioSession.sharedInstance().setAllowHapticsAndSystemSoundsDuringRecording(true)
      let soundID: SystemSoundID
      switch kind {
      case "pop": soundID = 1520
      case "nope": soundID = 1521
      default: soundID = 1519 // peek — light tick (Camera.app level snap)
      }
      AudioServicesPlaySystemSound(soundID)
    }

    AsyncFunction("stylizePhoto") { (inputPath: String, options: StylizePhotoOptions) -> [String: Any] in
      Self.stylizeLock.lock()
      if Self.stylizeInFlight {
        Self.stylizeLock.unlock()
        throw NSError(
          domain: "IrisLookBake",
          code: 7,
          userInfo: [NSLocalizedDescriptionKey: "Anime stylize already in progress"]
        )
      }
      Self.stylizeInFlight = true
      Self.stylizeLock.unlock()
      defer {
        Self.stylizeLock.lock()
        Self.stylizeInFlight = false
        Self.stylizeLock.unlock()
      }
      return try AnimeStylize.stylizePhoto(
        inputPath: inputPath,
        style: options.style,
        strength: options.strength
      )
    }
  }

  private static func cancelActiveBake() {
    bakeLock.lock()
    defer { bakeLock.unlock() }
    activeExporter?.cancelExport()
  }

  private static func needsBake(_ options: BakeLookVideoOptions) -> Bool {
    options.matrix.count == 20 ||
      options.smooth > 0.01 ||
      options.posterize > 0.01 ||
      options.edges > 0.01 ||
      options.vignette > 0.01 ||
      options.grain > 0.01 ||
      options.bloom > 0.01 ||
      options.leak > 0.01 ||
      options.stamp > 0.01 ||
      (options.tint.count >= 4 && options.tint[3] > 0.01) ||
      (options.shadows.count >= 4 && options.shadows[3] > 0.01) ||
      (options.highlights.count >= 4 && options.highlights[3] > 0.01)
  }

  private static func passthrough(url: URL) -> [String: Any] {
    [
      "path": url.path,
      "uri": url.absoluteString,
      "baked": false,
    ]
  }

  private static func bakeLookIntoVideo(
    inputPath: String,
    options: BakeLookVideoOptions
  ) async throws -> [String: Any] {
    bakeLock.lock()
    if bakeInFlight {
      bakeLock.unlock()
      throw NSError(
        domain: "IrisLookBake",
        code: 5,
        userInfo: [NSLocalizedDescriptionKey: "Look bake already in progress"]
      )
    }
    bakeInFlight = true
    bakeLock.unlock()

    defer {
      bakeLock.lock()
      bakeInFlight = false
      activeExporter = nil
      bakeLock.unlock()
    }

    let cleaned = inputPath.replacingOccurrences(of: "file://", with: "")
    let inputURL = URL(fileURLWithPath: cleaned)

    guard FileManager.default.fileExists(atPath: inputURL.path) else {
      throw NSError(
        domain: "IrisLookBake",
        code: 6,
        userInfo: [NSLocalizedDescriptionKey: "Input video not found"]
      )
    }

    if !needsBake(options) {
      return passthrough(url: inputURL)
    }

    let asset = AVURLAsset(url: inputURL)

    let videoTracks = try await asset.loadTracks(withMediaType: .video)
    guard let videoTrack = videoTracks.first else {
      throw NSError(
        domain: "IrisLookBake",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Video has no video track"]
      )
    }

    let naturalSize = try await videoTrack.load(.naturalSize)
    let preferredTransform = try await videoTrack.load(.preferredTransform)
    let oriented = naturalSize.applying(preferredTransform)
    let stampSize = CGSize(
      width: max(1, abs(oriented.width).rounded()),
      height: max(1, abs(oriented.height).rounded())
    )

    // Build stamp once — text is static for the export; avoid full-res UIKit alloc per frame.
    let stampImage: CIImage? = {
      guard options.stamp > 0.01, !options.stampText.isEmpty else { return nil }
      return makeStampImage(text: options.stampText, opacity: options.stamp, size: stampSize)
    }()

    let ciContext = sharedCIContext

    let composition = AVMutableVideoComposition(asset: asset, applyingCIFiltersWithHandler: { request in
      let extent = request.sourceImage.extent
      var image = request.sourceImage.clampedToExtent()

      if options.matrix.count == 20 {
        let m = options.matrix
        image = image.applyingFilter("CIColorMatrix", parameters: [
          "inputRVector": CIVector(x: m[0], y: m[1], z: m[2], w: m[3]),
          "inputGVector": CIVector(x: m[5], y: m[6], z: m[7], w: m[8]),
          "inputBVector": CIVector(x: m[10], y: m[11], z: m[12], w: m[13]),
          "inputAVector": CIVector(x: m[15], y: m[16], z: m[17], w: m[18]),
          "inputBiasVector": CIVector(x: m[4], y: m[9], z: m[14], w: m[19]),
        ])
      }

      image = blendColor(image, rgba: options.shadows, filterName: "CIMultiplyBlendMode")
      image = blendColor(image, rgba: options.tint, filterName: "CISoftLightBlendMode")
      image = blendColor(image, rgba: options.highlights, filterName: "CIScreenBlendMode")

      image = applyToon(image, smooth: options.smooth, posterize: options.posterize, edges: options.edges)

      if options.vignette > 0.01 {
        image = image.applyingFilter("CIVignette", parameters: [
          kCIInputIntensityKey: options.vignette * 1.35,
          kCIInputRadiusKey: 1.6,
        ])
      }

      if options.grain > 0.05 {
        image = applyGrain(image, amount: options.grain, time: request.compositionTime.seconds)
      }

      if options.bloom > 0.01 {
        image = applyBloom(image, amount: options.bloom)
      }

      if options.leak > 0.01 {
        image = applyLeak(image, amount: options.leak)
      }

      if let stamp = stampImage {
        let scaleX = extent.width / stamp.extent.width
        let scaleY = extent.height / stamp.extent.height
        let placed = stamp
          .transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
          .transformed(by: CGAffineTransform(translationX: extent.origin.x, y: extent.origin.y))
        image = placed.composited(over: image.cropped(to: extent)).cropped(to: extent).clampedToExtent()
      }

      request.finish(with: image.cropped(to: extent), context: ciContext)
    })

    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("iris-look-\(UUID().uuidString).mp4")

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    let presetCandidates = [
      AVAssetExportPresetHighestQuality,
      AVAssetExportPreset1920x1080,
      AVAssetExportPreset1280x720,
      AVAssetExportPresetMediumQuality,
    ]
    var exporter: AVAssetExportSession?
    for preset in presetCandidates {
      if let session = AVAssetExportSession(asset: asset, presetName: preset) {
        exporter = session
        break
      }
    }
    guard let exporter else {
      throw NSError(
        domain: "IrisLookBake",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Could not create video export session"]
      )
    }

    exporter.videoComposition = composition
    exporter.outputURL = outputURL
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true

    bakeLock.lock()
    activeExporter = exporter
    bakeLock.unlock()

    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      exporter.exportAsynchronously {
        switch exporter.status {
        case .completed:
          continuation.resume()
        case .cancelled:
          continuation.resume(
            throwing: NSError(
              domain: "IrisLookBake",
              code: 4,
              userInfo: [NSLocalizedDescriptionKey: "Video look bake cancelled"]
            )
          )
        default:
          let message = exporter.error?.localizedDescription ?? "Video look bake failed"
          continuation.resume(
            throwing: NSError(
              domain: "IrisLookBake",
              code: 3,
              userInfo: [NSLocalizedDescriptionKey: message]
            )
          )
        }
      }
    }

    return [
      "path": outputURL.path,
      "uri": outputURL.absoluteString,
      "baked": true,
    ]
  }

  /// Renders stamp text once; scaled to each frame extent in the composition handler.
  private static func makeStampImage(text: String, opacity: Double, size: CGSize) -> CIImage? {
    let width = Int(max(1, size.width.rounded()))
    let height = Int(max(1, size.height.rounded()))
    let renderSize = CGSize(width: width, height: height)
    let renderer = UIGraphicsImageRenderer(size: renderSize)
    let uiImage = renderer.image { _ in
      let fontSize = max(18, min(renderSize.width, renderSize.height) * 0.045)
      let font = UIFont(name: "Courier-Bold", size: fontSize)
        ?? UIFont(name: "CourierNewPS-BoldMT", size: fontSize)
        ?? UIFont.monospacedSystemFont(ofSize: fontSize, weight: .bold)
      let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: UIColor(red: 1, green: 0.604, blue: 0.102, alpha: CGFloat(min(0.95, opacity))),
        .kern: 1.5,
      ]
      let attributed = NSAttributedString(string: text, attributes: attrs)
      let textSize = attributed.size()
      let pad = min(renderSize.width, renderSize.height) * 0.045
      let origin = CGPoint(
        x: renderSize.width - pad - textSize.width,
        y: renderSize.height - pad - textSize.height
      )
      attributed.draw(at: origin)
    }

    guard let cgImage = uiImage.cgImage else { return nil }
    // UIKit is top-left; CIImage is bottom-left — flip to align.
    return CIImage(cgImage: cgImage)
      .transformed(by: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: CGFloat(height)))
  }

  private static func blendColor(_ image: CIImage, rgba: [Double], filterName: String) -> CIImage {
    guard rgba.count == 4, rgba[3] > 0.01 else { return image }
    let color = CIColor(red: rgba[0], green: rgba[1], blue: rgba[2], alpha: rgba[3])
    let colorImage = CIImage(color: color).cropped(to: image.extent)
    guard let filter = CIFilter(name: filterName) else { return image }
    filter.setValue(colorImage, forKey: kCIInputImageKey)
    filter.setValue(image, forKey: kCIInputBackgroundImageKey)
    return filter.outputImage?.cropped(to: image.extent) ?? image
  }

  private static func applyToon(
    _ image: CIImage,
    smooth: Double,
    posterize: Double,
    edges: Double
  ) -> CIImage {
    guard smooth > 0.01 || posterize > 0.01 || edges > 0.01 else { return image }
    let extent = image.extent
    var result = image.clampedToExtent()

    if smooth > 0.01 {
      let radius = 0.6 + smooth * 10.0
      result = result
        .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radius])
        .cropped(to: extent)
        .clampedToExtent()
    }

    if posterize > 0.01 {
      let levels = max(2.0, 32.0 - posterize * 28.0)
      result = result
        .applyingFilter("CIColorPosterize", parameters: ["inputLevels": levels])
        .cropped(to: extent)
        .clampedToExtent()
    }

    if edges > 0.01 {
      let edgeImage = result
        .applyingFilter("CIEdges", parameters: [kCIInputIntensityKey: 1.0 + edges * 8.0])
        .cropped(to: extent)
      // Invert edges toward black ink and multiply over the flat color.
      let ink = edgeImage.applyingFilter("CIColorInvert").applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 1, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 1, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: min(1.0, edges * 1.15)),
        "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      ])
      if let multiply = CIFilter(name: "CIMultiplyBlendMode") {
        multiply.setValue(ink, forKey: kCIInputImageKey)
        multiply.setValue(result.cropped(to: extent), forKey: kCIInputBackgroundImageKey)
        result = (multiply.outputImage ?? result).cropped(to: extent).clampedToExtent()
      }
    }

    return result.cropped(to: extent)
  }

  private static func applyGrain(_ image: CIImage, amount: Double, time: Double) -> CIImage {
    guard let noise = CIFilter(name: "CIRandomGenerator")?.outputImage else { return image }
    let offset = CGFloat(time * 97.0).truncatingRemainder(dividingBy: 500)
    let moved = noise.transformed(by: CGAffineTransform(translationX: offset, y: offset * 0.7))
      .cropped(to: image.extent)
    let softAlpha = min(0.35, 0.1 + amount * 0.35)
    let punchAlpha = min(0.55, 0.12 + amount * 0.55)
    let softNoise = moved.applyingFilter("CIColorMatrix", parameters: [
      "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputAVector": CIVector(x: 0, y: 0, z: 0, w: softAlpha),
      "inputBiasVector": CIVector(x: 0.5, y: 0.5, z: 0.5, w: 0),
    ])
    let punchNoise = moved.applyingFilter("CIColorMatrix", parameters: [
      "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      "inputAVector": CIVector(x: 0, y: 0, z: 0, w: punchAlpha),
      "inputBiasVector": CIVector(x: 0.5, y: 0.5, z: 0.5, w: 0),
    ])

    var result = image
    if let softLight = CIFilter(name: "CISoftLightBlendMode") {
      softLight.setValue(softNoise, forKey: kCIInputImageKey)
      softLight.setValue(result, forKey: kCIInputBackgroundImageKey)
      result = softLight.outputImage?.cropped(to: image.extent) ?? result
    }
    if let overlay = CIFilter(name: "CIOverlayBlendMode") {
      overlay.setValue(punchNoise, forKey: kCIInputImageKey)
      overlay.setValue(result, forKey: kCIInputBackgroundImageKey)
      result = overlay.outputImage?.cropped(to: image.extent) ?? result
    }
    if let multiply = CIFilter(name: "CIMultiplyBlendMode") {
      multiply.setValue(punchNoise, forKey: kCIInputImageKey)
      multiply.setValue(result, forKey: kCIInputBackgroundImageKey)
      result = multiply.outputImage?.cropped(to: image.extent) ?? result
    }
    return result
  }

  private static func applyBloom(_ image: CIImage, amount: Double) -> CIImage {
    let extent = image.extent
    let cx = extent.midX
    let cy = extent.origin.y + extent.height * 0.58
    let radius = hypot(extent.width, extent.height) * 0.55
    let centerAlpha = min(0.5, amount * 0.48)
    let midAlpha = min(0.28, amount * 0.22)

    guard let gradient = CIFilter(name: "CIRadialGradient") else { return image }
    gradient.setValue(CIVector(x: cx, y: cy), forKey: "inputCenter")
    gradient.setValue(0, forKey: "inputRadius0")
    gradient.setValue(radius, forKey: "inputRadius1")
    gradient.setValue(CIColor(red: 1, green: 0.96, blue: 0.88, alpha: centerAlpha), forKey: "inputColor0")
    gradient.setValue(CIColor(red: 1, green: 0.69, blue: 0.38, alpha: 0), forKey: "inputColor1")

    var glow = gradient.outputImage?.cropped(to: extent) ?? CIImage.empty()

    // Soft mid ring via second gradient
    guard let mid = CIFilter(name: "CIRadialGradient") else {
      return screenBlend(glow, over: image)
    }
    mid.setValue(CIVector(x: cx, y: cy), forKey: "inputCenter")
    mid.setValue(radius * 0.35, forKey: "inputRadius0")
    mid.setValue(radius * 0.85, forKey: "inputRadius1")
    mid.setValue(CIColor(red: 1, green: 0.69, blue: 0.38, alpha: midAlpha), forKey: "inputColor0")
    mid.setValue(CIColor(red: 1, green: 0.69, blue: 0.38, alpha: 0), forKey: "inputColor1")
    if let midImage = mid.outputImage?.cropped(to: extent) {
      glow = midImage.composited(over: glow)
    }

    var result = screenBlend(glow, over: image)

    let blurred = image
      .clampedToExtent()
      .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: max(4.0, min(extent.width, extent.height) * 0.012 * (0.6 + amount))])
      .cropped(to: extent)
    let fadedBlur = blurred.applyingFilter("CIColorMatrix", parameters: [
      "inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0),
      "inputGVector": CIVector(x: 0, y: 1, z: 0, w: 0),
      "inputBVector": CIVector(x: 0, y: 0, z: 1, w: 0),
      "inputAVector": CIVector(x: 0, y: 0, z: 0, w: min(0.45, amount * 0.45)),
      "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
    ])
    result = screenBlend(fadedBlur, over: result)
    return result
  }

  private static func applyLeak(_ image: CIImage, amount: Double) -> CIImage {
    let extent = image.extent
    let start = CIVector(x: extent.maxX * 0.92, y: extent.maxY * 0.98)
    let end = CIVector(x: extent.origin.x + extent.width * 0.45, y: extent.origin.y + extent.height * 0.45)
    let alpha = min(0.72, amount * 0.75)

    guard let gradient = CIFilter(name: "CILinearGradient") else { return image }
    gradient.setValue(start, forKey: "inputPoint0")
    gradient.setValue(end, forKey: "inputPoint1")
    gradient.setValue(CIColor(red: 1, green: 0.42, blue: 0.13, alpha: alpha), forKey: "inputColor0")
    gradient.setValue(CIColor(red: 1, green: 0.42, blue: 0.13, alpha: 0), forKey: "inputColor1")
    guard let leak = gradient.outputImage?.cropped(to: extent) else { return image }
    return screenBlend(leak, over: image)
  }

  private static func screenBlend(_ foreground: CIImage, over background: CIImage) -> CIImage {
    guard let filter = CIFilter(name: "CIScreenBlendMode") else { return background }
    filter.setValue(foreground, forKey: kCIInputImageKey)
    filter.setValue(background, forKey: kCIInputBackgroundImageKey)
    return filter.outputImage?.cropped(to: background.extent) ?? background
  }
}
