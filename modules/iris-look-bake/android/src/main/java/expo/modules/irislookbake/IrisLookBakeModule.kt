package expo.modules.irislookbake

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.Shader
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.nio.ByteBuffer
import java.util.Random
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class BakeLookVideoOptions : Record {
  @Field
  var matrix: List<Double> = emptyList()

  @Field
  var tint: List<Double> = emptyList()

  @Field
  var shadows: List<Double> = emptyList()

  @Field
  var highlights: List<Double> = emptyList()

  @Field
  var vignette: Double = 0.0

  @Field
  var grain: Double = 0.0

  @Field
  var bloom: Double = 0.0

  @Field
  var leak: Double = 0.0

  @Field
  var stamp: Double = 0.0

  @Field
  var stampText: String = ""

  @Field
  var smooth: Double = 0.0

  @Field
  var posterize: Double = 0.0

  @Field
  var edges: Double = 0.0
}

class IrisLookBakeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IrisLookBake")

    AsyncFunction("bakeLookIntoVideo") { inputPath: String, options: BakeLookVideoOptions ->
      bakeLookIntoVideo(appContext.reactContext, inputPath, options)
    }

    // iOS-only path; Android uses expo-haptics from JS.
    Function("playSystemHaptic") { _: String -> }
  }

  private fun needsBake(options: BakeLookVideoOptions): Boolean {
    return options.matrix.size == 20 ||
      options.smooth > 0.01 ||
      options.posterize > 0.01 ||
      options.edges > 0.01 ||
      options.vignette > 0.01 ||
      options.grain > 0.01 ||
      options.bloom > 0.01 ||
      options.leak > 0.01 ||
      options.stamp > 0.01 ||
      (options.tint.size >= 4 && options.tint[3] > 0.01) ||
      (options.shadows.size >= 4 && options.shadows[3] > 0.01) ||
      (options.highlights.size >= 4 && options.highlights[3] > 0.01)
  }

  private fun bakeLookIntoVideo(
    context: Context?,
    inputPath: String,
    options: BakeLookVideoOptions
  ): Map<String, Any> {
    val cleaned = inputPath.removePrefix("file://")
    val inputFile = File(cleaned)
    if (!inputFile.exists()) {
      throw IllegalArgumentException("Input video not found")
    }

    if (!needsBake(options)) {
      return passthrough(inputFile)
    }

    val outFile = File(
      context?.cacheDir ?: inputFile.parentFile,
      "iris-bake-${System.currentTimeMillis()}.mp4"
    )

    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(cleaned)
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val fpsMeta = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
        ?.toFloatOrNull()
        ?: parseFps(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT), durationMs)

      if (width <= 0 || height <= 0 || durationMs <= 0L) {
        throw IllegalStateException("Invalid video metadata")
      }

      // Match source timing; cap encode fps at 30 for CPU bake cost.
      val fps = max(12, min(30, (if (fpsMeta > 1f) fpsMeta else 30f).roundToInt()))
      val frameCount = max(1, ((durationMs / 1000.0) * fps).roundToInt())
      val colorMatrix = if (options.matrix.size == 20) {
        colorMatrixFromOptions(options)
      } else {
        ColorMatrix()
      }
      val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
        colorFilter = ColorMatrixColorFilter(colorMatrix)
      }

      val outW = width - (width % 2)
      val outH = height - (height % 2)

      encodeBitmapsToMp4(
        retriever = retriever,
        outFile = outFile,
        frameCount = frameCount,
        durationMs = durationMs,
        outW = outW,
        outH = outH,
        fps = fps,
        paint = paint,
        rotation = rotation,
        options = options
      )

      muxAudioFromOriginal(cleaned, outFile, durationMs)

      if (!outFile.exists() || outFile.length() < 1024) {
        throw IllegalStateException("Bake produced empty output")
      }

      return mapOf(
        "path" to outFile.absolutePath,
        "uri" to "file://${outFile.absolutePath}",
        "baked" to true
      )
    } catch (error: Exception) {
      if (outFile.exists()) outFile.delete()
      throw error
    } finally {
      try {
        retriever.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun parseFps(frameCountMeta: String?, durationMs: Long): Float {
    val frames = frameCountMeta?.toIntOrNull() ?: return 30f
    if (durationMs <= 0L || frames <= 0) return 30f
    return (frames * 1000f) / durationMs.toFloat()
  }

  private fun passthrough(file: File) = mapOf(
    "path" to file.absolutePath,
    "uri" to "file://${file.absolutePath}",
    "baked" to false
  )

  private fun colorMatrixFromOptions(options: BakeLookVideoOptions): ColorMatrix {
    val m = options.matrix
    val values = FloatArray(20) { i -> m[i].toFloat() }
    val cm = ColorMatrix(values)

    fun applyRgba(rgba: List<Double>, mode: String) {
      if (rgba.size < 4 || rgba[3] <= 0.01) return
      val r = rgba[0].toFloat()
      val g = rgba[1].toFloat()
      val b = rgba[2].toFloat()
      val a = rgba[3].toFloat().coerceIn(0f, 1f)
      val extra = ColorMatrix()
      when (mode) {
        "multiply" -> extra.setScale(1f - a + r * a, 1f - a + g * a, 1f - a + b * a, 1f)
        "screen" -> extra.setScale(
          1f + (1f - r) * a * 0.35f,
          1f + (1f - g) * a * 0.35f,
          1f + (1f - b) * a * 0.35f,
          1f
        )
        else -> extra.setScale(
          1f + (r - 0.5f) * a * 0.4f,
          1f + (g - 0.5f) * a * 0.4f,
          1f + (b - 0.5f) * a * 0.4f,
          1f
        )
      }
      cm.postConcat(extra)
    }

    applyRgba(options.shadows, "multiply")
    applyRgba(options.tint, "soft")
    applyRgba(options.highlights, "screen")
    // Vignette is applied spatially on the canvas (not as a global matrix darken).

    return cm
  }

  private fun encodeBitmapsToMp4(
    retriever: MediaMetadataRetriever,
    outFile: File,
    frameCount: Int,
    durationMs: Long,
    outW: Int,
    outH: Int,
    fps: Int,
    paint: Paint,
    rotation: Int,
    options: BakeLookVideoOptions
  ) {
    val mime = MediaFormat.MIMETYPE_VIDEO_AVC
    val format = MediaFormat.createVideoFormat(mime, outW, outH).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar)
      setInteger(MediaFormat.KEY_BIT_RATE, max(2_500_000, outW * outH * 5))
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    val encoder = MediaCodec.createEncoderByType(mime)
    encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    encoder.start()

    val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    if (rotation != 0) muxer.setOrientationHint(rotation)

    var trackIndex = -1
    var muxerStarted = false
    val bufferInfo = MediaCodec.BufferInfo()
    val frameDurationUs = 1_000_000L / fps
    val grainRandom = Random(7)

    fun drain(endOfStream: Boolean) {
      if (endOfStream) encoder.signalEndOfInputStream()
      while (true) {
        val outIndex = encoder.dequeueOutputBuffer(bufferInfo, 10_000)
        when {
          outIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!endOfStream) break
          outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            if (muxerStarted) throw IllegalStateException("Format changed twice")
            trackIndex = muxer.addTrack(encoder.outputFormat)
            muxer.start()
            muxerStarted = true
          }
          outIndex >= 0 -> {
            val encoded = encoder.getOutputBuffer(outIndex) ?: continue
            if (bufferInfo.size > 0 && muxerStarted) {
              encoded.position(bufferInfo.offset)
              encoded.limit(bufferInfo.offset + bufferInfo.size)
              muxer.writeSampleData(trackIndex, encoded, bufferInfo)
            }
            encoder.releaseOutputBuffer(outIndex, false)
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
          }
        }
      }
    }

    try {
      var encodedFrames = 0
      for (i in 0 until frameCount) {
        val timeUs = if (frameCount == 1) 0L else (i * durationMs * 1000L) / (frameCount - 1).coerceAtLeast(1)
        val raw = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
          ?: continue
        var graded = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(graded)
        canvas.drawBitmap(raw, null, android.graphics.Rect(0, 0, outW, outH), paint)
        applySpatialEffects(canvas, outW, outH, options, grainRandom, i)
        graded = applyToon(graded, options)

        if (options.stamp > 0.01 && options.stampText.isNotEmpty()) {
          val stampCanvas = Canvas(graded)
          val stampPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(
              (options.stamp.coerceIn(0.0, 1.0) * 240).roundToInt(),
              255,
              154,
              26
            )
            textSize = outH * 0.035f
            typeface = android.graphics.Typeface.MONOSPACE
            isFakeBoldText = true
          }
          val padX = outW * 0.045f
          val padY = outH * 0.045f
          stampCanvas.drawText(
            options.stampText,
            outW - stampPaint.measureText(options.stampText) - padX,
            outH - padY,
            stampPaint
          )
        }

        val yuv = argbToNv12(graded)
        raw.recycle()
        graded.recycle()

        var inputIndex = encoder.dequeueInputBuffer(50_000)
        var spins = 0
        while (inputIndex < 0 && spins < 20) {
          drain(false)
          inputIndex = encoder.dequeueInputBuffer(50_000)
          spins++
        }
        if (inputIndex >= 0) {
          val input = encoder.getInputBuffer(inputIndex)!!
          input.clear()
          input.put(yuv)
          encoder.queueInputBuffer(inputIndex, 0, yuv.size, encodedFrames * frameDurationUs, 0)
          encodedFrames++
        }
        drain(false)
      }
      if (encodedFrames == 0) {
        throw IllegalStateException("No frames decoded for bake")
      }
      drain(true)
    } finally {
      try {
        encoder.stop()
        encoder.release()
      } catch (_: Exception) {
      }
      try {
        if (muxerStarted) muxer.stop()
        muxer.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun applySpatialEffects(
    canvas: Canvas,
    outW: Int,
    outH: Int,
    options: BakeLookVideoOptions,
    random: Random,
    frameIndex: Int
  ) {
    if (options.vignette > 0.01) {
      val vig = options.vignette.toFloat().coerceIn(0f, 1f)
      val cx = outW / 2f
      val cy = outH / 2f
      val radius = hypot(cx.toDouble(), cy.toDouble()).toFloat() * 1.05f
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = RadialGradient(
          cx,
          cy,
          radius,
          intArrayOf(Color.TRANSPARENT, Color.argb((vig * 0.85f * 255).roundToInt(), 0, 0, 0)),
          floatArrayOf(0.35f, 1f),
          Shader.TileMode.CLAMP
        )
        xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)
      }
      canvas.drawRect(0f, 0f, outW.toFloat(), outH.toFloat(), paint)
    }

    if (options.grain > 0.01) {
      val grain = options.grain.toFloat().coerceIn(0f, 1f)
      val tile = 64
      val noise = Bitmap.createBitmap(tile, tile, Bitmap.Config.ARGB_8888)
      val pixels = IntArray(tile * tile)
      // Animate grain slightly per frame.
      random.setSeed(7L + frameIndex * 9973L)
      for (i in pixels.indices) {
        val v = random.nextInt(256)
        val a = (28 + grain * 140).roundToInt().coerceIn(0, 180)
        pixels[i] = (a shl 24) or (v shl 16) or (v shl 8) or v
      }
      noise.setPixels(pixels, 0, tile, 0, 0, tile, tile)
      val paint = Paint().apply {
        alpha = (80 + grain * 140).roundToInt().coerceIn(40, 220)
        xfermode = PorterDuffXfermode(PorterDuff.Mode.OVERLAY)
      }
      var y = 0
      while (y < outH) {
        var x = 0
        while (x < outW) {
          canvas.drawBitmap(noise, x.toFloat(), y.toFloat(), paint)
          x += tile
        }
        y += tile
      }
      noise.recycle()
    }

    if (options.bloom > 0.02) {
      val bloom = options.bloom.toFloat().coerceIn(0f, 1f)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = RadialGradient(
          outW * 0.5f,
          outH * 0.42f,
          hypot(outW.toDouble(), outH.toDouble()).toFloat() * 0.55f,
          intArrayOf(
            Color.argb((bloom * 0.5f * 255).roundToInt(), 255, 245, 224),
            Color.argb((bloom * 0.24f * 255).roundToInt(), 255, 176, 96),
            Color.TRANSPARENT
          ),
          floatArrayOf(0f, 0.4f, 1f),
          Shader.TileMode.CLAMP
        )
        xfermode = PorterDuffXfermode(PorterDuff.Mode.SCREEN)
      }
      canvas.drawRect(0f, 0f, outW.toFloat(), outH.toFloat(), paint)
    }

    if (options.leak > 0.02) {
      val leak = options.leak.toFloat().coerceIn(0f, 1f)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = android.graphics.LinearGradient(
          outW * 0.92f,
          outH * 0.02f,
          outW * 0.45f,
          outH * 0.55f,
          Color.argb((leak * 0.72f * 255).roundToInt(), 255, 106, 32),
          Color.TRANSPARENT,
          Shader.TileMode.CLAMP
        )
        xfermode = PorterDuffXfermode(PorterDuff.Mode.SCREEN)
      }
      canvas.drawRect(0f, 0f, outW.toFloat(), outH.toFloat(), paint)
    }
  }

  private fun applyToon(source: Bitmap, options: BakeLookVideoOptions): Bitmap {
    val smooth = options.smooth
    val posterize = options.posterize
    val edges = options.edges
    if (smooth <= 0.01 && posterize <= 0.01 && edges <= 0.01) return source

    var working = source
    if (smooth > 0.01) {
      val factor = (1.0 / (1.0 + smooth * 7.0)).coerceIn(0.12, 1.0)
      val tw = max(2, (working.width * factor).roundToInt())
      val th = max(2, (working.height * factor).roundToInt())
      val small = Bitmap.createScaledBitmap(working, tw, th, true)
      val blurred = Bitmap.createScaledBitmap(small, working.width, working.height, true)
      small.recycle()
      working.recycle()
      working = blurred
    }

    val w = working.width
    val h = working.height
    val pixels = IntArray(w * h)
    working.getPixels(pixels, 0, w, 0, 0, w, h)

    if (posterize > 0.01) {
      val levels = max(2, (32.0 - posterize * 28.0).roundToInt())
      val step = 255.0 / (levels - 1)
      for (i in pixels.indices) {
        val c = pixels[i]
        val a = c ushr 24
        val r = ((((c shr 16) and 0xff) / step).roundToInt() * step).roundToInt().coerceIn(0, 255)
        val g = ((((c shr 8) and 0xff) / step).roundToInt() * step).roundToInt().coerceIn(0, 255)
        val b = (((c and 0xff) / step).roundToInt() * step).roundToInt().coerceIn(0, 255)
        pixels[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
      }
    }

    if (edges > 0.01) {
      val luma = FloatArray(w * h)
      for (i in pixels.indices) {
        val c = pixels[i]
        val r = (c shr 16) and 0xff
        val g = (c shr 8) and 0xff
        val b = c and 0xff
        luma[i] = 0.2126f * r + 0.7152f * g + 0.0722f * b
      }
      val strength = edges.toFloat().coerceIn(0f, 1f)
      for (y in 1 until h - 1) {
        for (x in 1 until w - 1) {
          val i = y * w + x
          val gx = luma[i + 1] - luma[i - 1]
          val gy = luma[i + w] - luma[i - w]
          val edge = kotlin.math.sqrt(gx * gx + gy * gy) / 255f
          val ink = (1f - (edge * (1.2f + strength * 3.5f)).coerceIn(0f, 1f) * strength)
          val c = pixels[i]
          val a = c ushr 24
          val r = (((c shr 16) and 0xff) * ink).roundToInt().coerceIn(0, 255)
          val g = (((c shr 8) and 0xff) * ink).roundToInt().coerceIn(0, 255)
          val b = ((c and 0xff) * ink).roundToInt().coerceIn(0, 255)
          pixels[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
        }
      }
    }

    val out = if (working.isMutable) working else working.copy(Bitmap.Config.ARGB_8888, true).also {
      if (working !== source) working.recycle()
    }
    out.setPixels(pixels, 0, w, 0, 0, w, h)
    return out
  }

  private fun argbToNv12(bitmap: Bitmap): ByteArray {
    val w = bitmap.width
    val h = bitmap.height
    val argb = IntArray(w * h)
    bitmap.getPixels(argb, 0, w, 0, 0, w, h)
    val ySize = w * h
    val out = ByteArray(ySize + ySize / 2)
    var yIndex = 0
    var uvIndex = ySize
    var index = 0
    for (j in 0 until h) {
      for (i in 0 until w) {
        val c = argb[index++]
        val r = (c shr 16) and 0xff
        val g = (c shr 8) and 0xff
        val b = c and 0xff
        val y = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        out[yIndex++] = y.coerceIn(0, 255).toByte()
        if (j % 2 == 0 && i % 2 == 0) {
          val u = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
          val v = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
          out[uvIndex++] = u.coerceIn(0, 255).toByte()
          out[uvIndex++] = v.coerceIn(0, 255).toByte()
        }
      }
    }
    return out
  }

  private fun muxAudioFromOriginal(inputPath: String, videoOnlyFile: File, maxDurationMs: Long) {
    val extractor = MediaExtractor()
    val tempOut = File(videoOnlyFile.parentFile, "iris-bake-av-${System.currentTimeMillis()}.mp4")
    try {
      extractor.setDataSource(inputPath)
      var audioTrack = -1
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          audioTrack = i
          break
        }
      }
      if (audioTrack < 0) return

      val videoExtractor = MediaExtractor()
      videoExtractor.setDataSource(videoOnlyFile.absolutePath)
      var videoTrack = -1
      for (i in 0 until videoExtractor.trackCount) {
        val format = videoExtractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("video/")) {
          videoTrack = i
          break
        }
      }
      if (videoTrack < 0) {
        videoExtractor.release()
        return
      }

      val muxer = MediaMuxer(tempOut.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      videoExtractor.selectTrack(videoTrack)
      val outVideo = muxer.addTrack(videoExtractor.getTrackFormat(videoTrack))
      extractor.selectTrack(audioTrack)
      val outAudio = muxer.addTrack(extractor.getTrackFormat(audioTrack))
      muxer.start()

      val buffer = ByteBuffer.allocate(1 shl 20)
      val info = MediaCodec.BufferInfo()
      val maxPtsUs = maxDurationMs * 1000L

      fun copy(ext: MediaExtractor, track: Int, trimToPts: Long?) {
        while (true) {
          info.offset = 0
          info.size = ext.readSampleData(buffer, 0)
          if (info.size < 0) break
          info.presentationTimeUs = ext.sampleTime
          if (trimToPts != null && info.presentationTimeUs > trimToPts) break
          info.flags = ext.sampleFlags
          muxer.writeSampleData(track, buffer, info)
          ext.advance()
        }
      }

      copy(videoExtractor, outVideo, null)
      copy(extractor, outAudio, maxPtsUs)
      muxer.stop()
      muxer.release()
      videoExtractor.release()

      if (tempOut.exists() && tempOut.length() > 0) {
        videoOnlyFile.delete()
        tempOut.renameTo(videoOnlyFile)
      }
    } catch (error: Exception) {
      if (tempOut.exists()) tempOut.delete()
      throw error
    } finally {
      try {
        extractor.release()
      } catch (_: Exception) {
      }
    }
  }
}
