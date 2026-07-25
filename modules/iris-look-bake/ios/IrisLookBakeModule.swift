import ExpoModulesCore
import AudioToolbox
import AVFoundation
import CoreImage
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
}

public class IrisLookBakeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("IrisLookBake")

    AsyncFunction("bakeLookIntoVideo") { (inputPath: String, options: BakeLookVideoOptions) -> [String: Any] in
      try await Self.bakeLookIntoVideo(inputPath: inputPath, options: options)
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
  }

  private static func bakeLookIntoVideo(
    inputPath: String,
    options: BakeLookVideoOptions
  ) async throws -> [String: Any] {
    let cleaned = inputPath.replacingOccurrences(of: "file://", with: "")
    let inputURL = URL(fileURLWithPath: cleaned)
    let asset = AVURLAsset(url: inputURL)

    let videoTracks = try await asset.loadTracks(withMediaType: .video)
    guard videoTracks.first != nil else {
      throw NSError(
        domain: "IrisLookBake",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Video has no video track"]
      )
    }

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

      if options.stamp > 0.01, !options.stampText.isEmpty {
        image = applyStamp(image, text: options.stampText, opacity: options.stamp)
      }

      request.finish(with: image.cropped(to: extent), context: nil)
    })

    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("iris-look-\(UUID().uuidString).mp4")

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
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

  private static func blendColor(_ image: CIImage, rgba: [Double], filterName: String) -> CIImage {
    guard rgba.count == 4, rgba[3] > 0.01 else { return image }
    let color = CIColor(red: rgba[0], green: rgba[1], blue: rgba[2], alpha: rgba[3])
    let colorImage = CIImage(color: color).cropped(to: image.extent)
    guard let filter = CIFilter(name: filterName) else { return image }
    filter.setValue(colorImage, forKey: kCIInputImageKey)
    filter.setValue(image, forKey: kCIInputBackgroundImageKey)
    return filter.outputImage?.cropped(to: image.extent) ?? image
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

  private static func applyStamp(_ image: CIImage, text: String, opacity: Double) -> CIImage {
    let extent = image.extent
    let width = Int(max(1, extent.width.rounded()))
    let height = Int(max(1, extent.height.rounded()))
    let size = CGSize(width: width, height: height)

    let renderer = UIGraphicsImageRenderer(size: size)
    let uiImage = renderer.image { _ in
      let fontSize = max(18, min(size.width, size.height) * 0.045)
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
      let pad = min(size.width, size.height) * 0.045
      let origin = CGPoint(x: size.width - pad - textSize.width, y: size.height - pad - textSize.height)
      attributed.draw(at: origin)
    }

    guard let cgImage = uiImage.cgImage else { return image }
    // UIKit is top-left; CIImage is bottom-left — flip to align.
    let stamp = CIImage(cgImage: cgImage)
      .transformed(by: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: CGFloat(height)))
      .transformed(by: CGAffineTransform(translationX: extent.origin.x, y: extent.origin.y))
    return stamp.composited(over: image).cropped(to: extent)
  }

  private static func screenBlend(_ foreground: CIImage, over background: CIImage) -> CIImage {
    guard let filter = CIFilter(name: "CIScreenBlendMode") else { return background }
    filter.setValue(foreground, forKey: kCIInputImageKey)
    filter.setValue(background, forKey: kCIInputBackgroundImageKey)
    return filter.outputImage?.cropped(to: background.extent) ?? background
  }
}
