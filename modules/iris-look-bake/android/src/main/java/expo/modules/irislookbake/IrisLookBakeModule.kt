package expo.modules.irislookbake

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer
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
}

class IrisLookBakeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IrisLookBake")

    AsyncFunction("bakeLookIntoVideo") { inputPath: String, options: BakeLookVideoOptions ->
      withContext(Dispatchers.Default) {
        bakeLookIntoVideo(appContext.reactContext, inputPath, options)
      }
    }

    // iOS-only path; Android uses expo-haptics from JS.
    Function("playSystemHaptic") { _: String -> }
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

    if (options.matrix.size != 20) {
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

      if (width <= 0 || height <= 0 || durationMs <= 0L) {
        return passthrough(inputFile)
      }

      val fps = 20
      val frameCount = max(1, min(180, ((durationMs / 1000.0) * fps).roundToInt()))
      val colorMatrix = colorMatrixFromOptions(options)
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

      muxAudioFromOriginal(cleaned, outFile)

      if (!outFile.exists() || outFile.length() < 1024) {
        return passthrough(inputFile)
      }

      return mapOf(
        "path" to outFile.absolutePath,
        "uri" to "file://${outFile.absolutePath}",
        "baked" to true
      )
    } catch (_: Exception) {
      if (outFile.exists()) outFile.delete()
      return passthrough(inputFile)
    } finally {
      try {
        retriever.release()
      } catch (_: Exception) {
      }
    }
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

    if (options.vignette > 0.01) {
      val v = options.vignette.toFloat().coerceIn(0f, 1f)
      cm.postConcat(ColorMatrix().apply { setScale(1f - v * 0.15f, 1f - v * 0.15f, 1f - v * 0.15f, 1f) })
    }

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
      for (i in 0 until frameCount) {
        val timeUs = (i * durationMs * 1000L) / frameCount
        val raw = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST) ?: continue
        val graded = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(graded)
        canvas.drawBitmap(raw, null, android.graphics.Rect(0, 0, outW, outH), paint)

        if (options.stamp > 0.05 && options.stampText.isNotEmpty()) {
          val stampPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.argb(
              (options.stamp.coerceIn(0.0, 1.0) * 240).roundToInt(),
              255,
              154,
              26
            )
            textSize = outH * 0.035f
            typeface = android.graphics.Typeface.MONOSPACE
            isFakeBoldText = true
          }
          canvas.drawText(options.stampText, outW * 0.72f, outH * 0.94f, stampPaint)
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
          encoder.queueInputBuffer(inputIndex, 0, yuv.size, i * frameDurationUs, 0)
        }
        drain(false)
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

  private fun muxAudioFromOriginal(inputPath: String, videoOnlyFile: File) {
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

      fun copy(ext: MediaExtractor, track: Int) {
        while (true) {
          info.offset = 0
          info.size = ext.readSampleData(buffer, 0)
          if (info.size < 0) break
          info.presentationTimeUs = ext.sampleTime
          info.flags = ext.sampleFlags
          muxer.writeSampleData(track, buffer, info)
          ext.advance()
        }
      }

      copy(videoExtractor, outVideo)
      copy(extractor, outAudio)
      muxer.stop()
      muxer.release()
      videoExtractor.release()

      if (tempOut.exists() && tempOut.length() > 0) {
        videoOnlyFile.delete()
        tempOut.renameTo(videoOnlyFile)
      }
    } catch (_: Exception) {
      if (tempOut.exists()) tempOut.delete()
    } finally {
      try {
        extractor.release()
      } catch (_: Exception) {
      }
    }
  }
}
