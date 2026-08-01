package expo.modules.irislookbake

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.FileOutputStream
import java.nio.FloatBuffer
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object AnimeStylize {
  private val STYLE_TO_MODEL = mapOf(
    "animegan-v3-shinkai" to "AnimeGANv3_Shinkai_37.onnx",
    "animegan-v3-hayao" to "AnimeGANv3_Hayao_36.onnx",
  )
  private const val MAX_SIDE = 1024
  private const val ALIGN = 8
  private const val MIN_SIDE = 256

  private val sessions = mutableMapOf<String, OrtSession>()
  /** Serializes session create + Run — ORT sessions are not safe for concurrent Run. */
  private val runLock = Any()
  private val env: OrtEnvironment = OrtEnvironment.getEnvironment()

  fun stylizePhoto(
    context: Context?,
    inputPath: String,
    style: String,
    strength: Double,
  ): Map<String, Any> {
    val modelAsset = STYLE_TO_MODEL[style]
      ?: throw IllegalArgumentException("Unsupported style: $style")
    val ctx = context ?: throw IllegalStateException("No Android context")
    val strengthClamped = strength.coerceIn(0.0, 1.0)
    val path = stripFileScheme(inputPath)

    synchronized(runLock) {
      val source = decodeOrientedBitmap(path)
        ?: throw IllegalStateException("Could not decode photo for anime stylize")

      try {
        if (strengthClamped <= 0.01) {
          return passthrough(path)
        }

        val origW = source.width
        val origH = source.height
        val (inferW, inferH) = alignedSize(origW, origH, MAX_SIDE)
        val resized = Bitmap.createScaledBitmap(source, inferW, inferH, true)
        var stylizedBitmap: Bitmap? = null
        var fullRes: Bitmap? = null
        var sharpened: Bitmap? = null
        var blended: Bitmap? = null

        try {
          val input = bitmapToNHWC(resized)
          val ortSession = sharedSessionLocked(ctx, modelAsset)
          val inputName = ortSession.inputNames.firstOrNull()
            ?: throw IllegalStateException("AnimeGANv3 model has no input names")
          val inputShape = longArrayOf(1, inferH.toLong(), inferW.toLong(), 3)
          val tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), inputShape)

          tensor.use {
            ortSession.run(mapOf(inputName to it)).use { results ->
              val outTensor = results[0] as? OnnxTensor
                ?: throw IllegalStateException("Anime inference returned unexpected tensor type")
              val count = inferW * inferH * 3
              val remaining = outTensor.floatBuffer.remaining()
              if (remaining < count) {
                throw IllegalStateException(
                  "Anime inference output too short ($remaining < $count)",
                )
              }
              val out = FloatArray(count)
              outTensor.floatBuffer.duplicate().get(out)
              stylizedBitmap = nhwcToBitmap(out, inferW, inferH)
            }
          }

          val stylized = stylizedBitmap
            ?: throw IllegalStateException("Anime inference produced no bitmap")
          fullRes = Bitmap.createScaledBitmap(stylized, origW, origH, true)
          sharpened = sharpen(fullRes!!, 0.65f)
          blended = if (strengthClamped >= 0.999) {
            sharpened
          } else {
            blend(source, sharpened!!, strengthClamped.toFloat())
          }

          val outFile = writeJpeg(ctx, blended!!)
          return mapOf(
            "path" to outFile.absolutePath,
            "uri" to outFile.toURI().toString(),
          )
        } finally {
          recycleDistinct(resized, source)
          recycleDistinct(stylizedBitmap, fullRes, sharpened, blended, source)
          recycleDistinct(fullRes, sharpened, blended, source)
          recycleDistinct(sharpened, blended, source)
          recycleDistinct(blended, source)
        }
      } finally {
        if (!source.isRecycled) source.recycle()
      }
    }
  }

  private fun passthrough(path: String): Map<String, Any> {
    val file = File(path)
    return mapOf(
      "path" to file.absolutePath,
      "uri" to file.toURI().toString(),
    )
  }

  private fun stripFileScheme(path: String): String =
    if (path.startsWith("file://")) path.removePrefix("file://") else path

  /** Decode JPEG/PNG and apply EXIF orientation (parity with iOS UIImage). */
  private fun decodeOrientedBitmap(path: String): Bitmap? {
    val decoded = BitmapFactory.decodeFile(path) ?: return null
    return try {
      val exif = ExifInterface(path)
      val orientation = exif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL,
      )
      if (orientation == ExifInterface.ORIENTATION_NORMAL ||
        orientation == ExifInterface.ORIENTATION_UNDEFINED
      ) {
        return decoded
      }
      val matrix = Matrix()
      when (orientation) {
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
          matrix.postRotate(90f)
          matrix.preScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> {
          matrix.postRotate(270f)
          matrix.preScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        else -> return decoded
      }
      val oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
      if (oriented !== decoded) decoded.recycle()
      oriented
    } catch (_: Exception) {
      decoded
    }
  }

  /** Scale to maxSide, then align each dim to ×8 with min 256 (AnimeGANv3). */
  private fun alignedSize(width: Int, height: Int, maxSide: Int): Pair<Int, Int> {
    val scale = min(1.0, maxSide.toDouble() / max(width, height).toDouble())
    var tw = (width * scale).roundToInt()
    var th = (height * scale).roundToInt()
    tw = max(MIN_SIDE, ((tw + ALIGN - 1) / ALIGN) * ALIGN)
    th = max(MIN_SIDE, ((th + ALIGN - 1) / ALIGN) * ALIGN)
    return tw to th
  }

  /** Caller must hold [runLock]. */
  private fun sharedSessionLocked(context: Context, modelAsset: String): OrtSession {
    sessions[modelAsset]?.let { return it }
    val bytes = context.assets.open(modelAsset).use { it.readBytes() }
    val options = OrtSession.SessionOptions()
    // CPU only — NNAPI (like CoreML EP) is unsafe for these dynamic H×W models.
    val created = env.createSession(bytes, options)
    sessions[modelAsset] = created
    return created
  }

  private fun bitmapToNHWC(bitmap: Bitmap): FloatArray {
    val w = bitmap.width
    val h = bitmap.height
    val pixels = IntArray(w * h)
    bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
    val out = FloatArray(w * h * 3)
    for (i in pixels.indices) {
      val c = pixels[i]
      val base = i * 3
      out[base] = ((c shr 16) and 0xff) / 127.5f - 1f
      out[base + 1] = ((c shr 8) and 0xff) / 127.5f - 1f
      out[base + 2] = (c and 0xff) / 127.5f - 1f
    }
    return out
  }

  private fun nhwcToBitmap(floats: FloatArray, width: Int, height: Int): Bitmap {
    val pixels = IntArray(width * height)
    for (i in pixels.indices) {
      val base = i * 3
      val r = u8((floats[base] + 1f) * 127.5f)
      val g = u8((floats[base + 1] + 1f) * 127.5f)
      val b = u8((floats[base + 2] + 1f) * 127.5f)
      pixels[i] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
  }

  private fun u8(v: Float): Int = max(0, min(255, v.roundToInt()))

  /** Mild unsharp via 3×3 kernel (amount ~0…1). */
  private fun sharpen(src: Bitmap, amount: Float): Bitmap {
    val a = amount.coerceIn(0f, 1f)
    if (a < 0.01f) return src
    val w = src.width
    val h = src.height
    val pixels = IntArray(w * h)
    src.getPixels(pixels, 0, w, 0, 0, w, h)
    val out = IntArray(w * h)
    // center = 1 + 4a, neighbors = -a
    val c = 1f + 4f * a
    val n = -a
    for (y in 0 until h) {
      for (x in 0 until w) {
        fun sample(sx: Int, sy: Int): Int {
          val xx = sx.coerceIn(0, w - 1)
          val yy = sy.coerceIn(0, h - 1)
          return pixels[yy * w + xx]
        }
        val p0 = sample(x, y)
        val pL = sample(x - 1, y)
        val pR = sample(x + 1, y)
        val pU = sample(x, y - 1)
        val pD = sample(x, y + 1)
        fun ch(shift: Int): Int {
          val v =
            ((p0 shr shift) and 0xff) * c +
              ((pL shr shift) and 0xff) * n +
              ((pR shr shift) and 0xff) * n +
              ((pU shr shift) and 0xff) * n +
              ((pD shr shift) and 0xff) * n
          return max(0, min(255, v.roundToInt()))
        }
        out[y * w + x] = (0xff shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
      }
    }
    return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
  }

  private fun blend(original: Bitmap, stylized: Bitmap, strength: Float): Bitmap {
    val w = original.width
    val h = original.height
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    canvas.drawBitmap(original, 0f, 0f, paint)
    paint.alpha = (strength.coerceIn(0f, 1f) * 255f).roundToInt()
    canvas.drawBitmap(stylized, 0f, 0f, paint)
    return out
  }

  private fun writeJpeg(context: Context, bitmap: Bitmap): File {
    val dir = File(context.filesDir, "looks")
    if (!dir.exists()) dir.mkdirs()
    val out = File(dir, "iris-anime-${UUID.randomUUID()}.jpg")
    FileOutputStream(out).use { stream ->
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)) {
        throw IllegalStateException("Could not encode anime JPEG")
      }
    }
    return out
  }

  private fun recycleDistinct(candidate: Bitmap?, vararg keep: Bitmap?) {
    if (candidate == null || candidate.isRecycled) return
    if (keep.any { it != null && it === candidate }) return
    candidate.recycle()
  }
}
