package app.noir.music

import android.content.Intent
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.concurrent.Executors

class VrishMetadataModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  override fun getName() = "VrishMetadata"

  @ReactMethod
  fun requestBackgroundPlaybackExemption(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(false)
        return
      }
      val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
        promise.resolve(false)
        return
      }
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BACKGROUND_SETTINGS_ERROR", "Could not open Android battery settings", e)
    }
  }

  @ReactMethod
  fun fingerprint(uri: String, promise: Promise) {
    executor.execute {
      try {
        val parsed = Uri.parse(uri)
        val stream = if (parsed.scheme == "content") {
          context.contentResolver.openInputStream(parsed) ?: throw Exception("Cannot open stream for content URI")
        } else {
          FileInputStream(parsed.path ?: uri)
        }
        val digest = MessageDigest.getInstance("SHA-256")
        stream.use { input ->
          val buffer = ByteArray(65536)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
          }
        }
        promise.resolve(digest.digest().joinToString("") { "%02x".format(it) })
      } catch (e: Exception) { promise.reject("FINGERPRINT_ERROR", "Could not hash audio file", e) }
    }
  }

  @ReactMethod
  fun extract(uri: String, id: String, promise: Promise) {
    executor.execute {
      val retriever = MediaMetadataRetriever()
      try {
        val parsed = Uri.parse(uri)
        if (parsed.scheme == "content") retriever.setDataSource(context, parsed)
        else retriever.setDataSource(parsed.path ?: uri)
        val result = Arguments.createMap()
        result.putString("title", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
        result.putString("artist", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
        result.putString("album", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
        result.putString("albumArtist", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST))
        result.putString("composer", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COMPOSER))
        result.putDouble("durationMs", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0)
        val art = retriever.embeddedPicture
        if (art != null && art.isNotEmpty()) {
          val artworkDir = File(context.filesDir, "artwork").apply { mkdirs() }
          val artworkFile = File(artworkDir, "$id.art")
          artworkFile.writeBytes(art)
          result.putString("artworkUri", Uri.fromFile(artworkFile).toString())
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("METADATA_ERROR", "Could not read audio metadata", e)
      } finally {
        retriever.release()
      }
    }
  }
}
