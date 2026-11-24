package app.noir.music

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class VrishMetadataModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  override fun getName() = "VrishMetadata"

  @ReactMethod
  fun hasStoragePermission(promise: Promise) {
    try {
      val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
      } else {
        ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
      }
      promise.resolve(granted)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestStoragePermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        try {
          val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          promise.resolve(true)
          return
        } catch (e: Exception) {
          val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          promise.resolve(true)
          return
        }
      } else {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        promise.resolve(true)
      }
    } catch (e: Exception) {
      promise.reject("STORAGE_PERMISSION_ERROR", "Could not open storage settings", e)
    }
  }

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
        result.putString("genre", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE))
        val year = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR) ?: retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)
        result.putString("year", year)
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

  private fun getRealPathFromUri(uri: Uri): String? {
    if (uri.scheme == "file") {
      return uri.path
    }
    if (uri.scheme == "content") {
      val projection = arrayOf(MediaStore.Audio.Media.DATA)
      try {
        context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
          val colIdx = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)
          if (colIdx >= 0 && cursor.moveToFirst()) {
            val path = cursor.getString(colIdx)
            if (!path.isNullOrEmpty()) return path
          }
        }
      } catch (e: Exception) {
        // Fallback for custom content providers
      }
    }
    return uri.path
  }

  private fun skipFully(inStream: InputStream, bytesToSkip: Long) {
    var remaining = bytesToSkip
    val buffer = ByteArray(minOf(remaining, 8192L).toInt())
    while (remaining > 0) {
      val toRead = minOf(remaining, buffer.size.toLong()).toInt()
      val count = inStream.read(buffer, 0, toRead)
      if (count < 0) break
      remaining -= count
    }
  }

  private fun toSynchsafe(size: Int): ByteArray {
    return byteArrayOf(
      ((size shr 21) and 0x7F).toByte(),
      ((size shr 14) and 0x7F).toByte(),
      ((size shr 7) and 0x7F).toByte(),
      (size and 0x7F).toByte()
    )
  }

  private fun fromSynchsafe(b: ByteArray, offset: Int = 0): Int {
    return ((b[offset].toInt() and 0x7F) shl 21) or
           ((b[offset + 1].toInt() and 0x7F) shl 14) or
           ((b[offset + 2].toInt() and 0x7F) shl 7) or
           (b[offset + 3].toInt() and 0x7F)
  }

  private fun toInt32BE(value: Int): ByteArray {
    return byteArrayOf(
      ((value shr 24) and 0xFF).toByte(),
      ((value shr 16) and 0xFF).toByte(),
      ((value shr 8) and 0xFF).toByte(),
      (value and 0xFF).toByte()
    )
  }

  private fun buildTextFrame(frameId: String, text: String): ByteArray {
    val isAscii = text.all { it.code in 32..126 }
    val body = ByteArrayOutputStream()
    if (isAscii) {
      body.write(0x00) // ISO-8859-1
      body.write(text.toByteArray(StandardCharsets.ISO_8859_1))
    } else {
      body.write(0x01) // UTF-16 with BOM
      body.write(text.toByteArray(StandardCharsets.UTF_16))
    }
    val bodyBytes = body.toByteArray()

    val frame = ByteArrayOutputStream()
    frame.write(frameId.toByteArray(StandardCharsets.US_ASCII))
    frame.write(toInt32BE(bodyBytes.size))
    frame.write(0x00) // Flags byte 1
    frame.write(0x00) // Flags byte 2
    frame.write(bodyBytes)
    return frame.toByteArray()
  }

  private fun buildApicFrame(imageBytes: ByteArray, mimeType: String): ByteArray {
    val body = ByteArrayOutputStream()
    body.write(0x00) // ISO-8859-1 for MIME and description
    body.write(mimeType.toByteArray(StandardCharsets.ISO_8859_1))
    body.write(0x00) // Null terminator for MIME
    body.write(0x03) // Picture type: Cover (front)
    body.write(0x00) // Empty description null terminator
    body.write(imageBytes)
    val bodyBytes = body.toByteArray()

    val frame = ByteArrayOutputStream()
    frame.write("APIC".toByteArray(StandardCharsets.US_ASCII))
    frame.write(toInt32BE(bodyBytes.size))
    frame.write(0x00) // Flags byte 1
    frame.write(0x00) // Flags byte 2
    frame.write(bodyBytes)
    return frame.toByteArray()
  }

  private fun buildId3v1Tag(title: String?, artist: String?, album: String?, year: String?): ByteArray {
    val tag = ByteArray(128)
    tag[0] = 'T'.code.toByte()
    tag[1] = 'A'.code.toByte()
    tag[2] = 'G'.code.toByte()

    fun writeField(offset: Int, len: Int, value: String?) {
      if (value.isNullOrEmpty()) return
      val bytes = value.toByteArray(StandardCharsets.ISO_8859_1)
      val copyLen = minOf(bytes.size, len)
      System.arraycopy(bytes, 0, tag, offset, copyLen)
    }

    writeField(3, 30, title)
    writeField(33, 30, artist)
    writeField(63, 30, album)
    writeField(93, 4, year)
    tag[127] = 255.toByte() // Unknown genre
    return tag
  }

  @ReactMethod
  fun writeMetadata(uri: String, id: String, tags: ReadableMap, promise: Promise) {
    executor.execute {
      var tempFile: File? = null
      try {
        val hasStorageAccess = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Environment.isExternalStorageManager()
        } else {
          ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }

        if (!hasStorageAccess) {
          val res = Arguments.createMap()
          res.putBoolean("success", false)
          res.putString("error", "PERMISSION_REQUIRED")
          res.putString("message", "Manage External Storage permission required to modify audio files on device")
          promise.resolve(res)
          return@execute
        }

        val parsed = Uri.parse(uri)
        val realPath = getRealPathFromUri(parsed)
        val targetFile = if (!realPath.isNullOrEmpty()) File(realPath) else null
        val isMp3 = targetFile?.name?.endsWith(".mp3", ignoreCase = true) == true ||
                    (parsed.path ?: uri).endsWith(".mp3", ignoreCase = true)

        fun openInStream(): InputStream {
          return if (targetFile != null && targetFile.exists() && targetFile.canRead()) {
            FileInputStream(targetFile)
          } else if (parsed.scheme == "content") {
            context.contentResolver.openInputStream(parsed) ?: throw Exception("Cannot open stream for content URI")
          } else {
            FileInputStream(parsed.path ?: uri)
          }
        }

        // Check file length & trailing ID3v1 tag
        var fileLength = targetFile?.takeIf { it.exists() }?.length() ?: 0L
        var hasId3v1 = false
        if (targetFile != null && targetFile.exists() && fileLength >= 128) {
          try {
            RandomAccessFile(targetFile, "r").use { raf ->
              raf.seek(fileLength - 128)
              val tagHeader = ByteArray(3)
              raf.readFully(tagHeader)
              if (tagHeader[0] == 'T'.code.toByte() && tagHeader[1] == 'A'.code.toByte() && tagHeader[2] == 'G'.code.toByte()) {
                hasId3v1 = true
              }
            }
          } catch (e: Exception) {}
        }

        // 1. Read existing ID3v2 header to preserve unedited frames and find start of audio stream
        var audioOffset = 0L
        var versionMajor = 3
        val preservedFrames = ByteArrayOutputStream()
        val excludedFrameIds = setOf("TIT2", "TPE1", "TALB", "TPE2", "TCOM", "TYER", "TDRC", "TCON", "APIC")

        openInStream().use { input ->
          val headerBuf = ByteArray(10)
          val readHeader = input.read(headerBuf)
          if (readHeader == 10 && headerBuf[0] == 0x49.toByte() && headerBuf[1] == 0x44.toByte() && headerBuf[2] == 0x33.toByte()) {
            versionMajor = headerBuf[3].toInt() and 0xFF
            val tagSize = fromSynchsafe(headerBuf, 6)
            audioOffset = 10L + tagSize

            if (tagSize in 1..52428800) { // Up to 50MB
              val tagData = ByteArray(tagSize)
              var readBytes = 0
              while (readBytes < tagSize) {
                val r = input.read(tagData, readBytes, tagSize - readBytes)
                if (r < 0) break
                readBytes += r
              }

              var pos = 0
              val isV23 = (versionMajor == 3)
              while (pos + 10 <= readBytes) {
                val fId = String(tagData, pos, 4, StandardCharsets.US_ASCII)
                if (!fId.all { it in 'A'..'Z' || it in '0'..'9' }) {
                  break // Padding reached
                }
                val fSize = if (isV23) {
                  ((tagData[pos + 4].toInt() and 0xFF) shl 24) or
                  ((tagData[pos + 5].toInt() and 0xFF) shl 16) or
                  ((tagData[pos + 6].toInt() and 0xFF) shl 8) or
                  (tagData[pos + 7].toInt() and 0xFF)
                } else {
                  fromSynchsafe(tagData, pos + 4)
                }
                if (fSize <= 0 || pos + 10 + fSize > readBytes) break
                if (!excludedFrameIds.contains(fId)) {
                  preservedFrames.write(tagData, pos, 10 + fSize)
                }
                pos += 10 + fSize
              }
            }
          }
        }

        // 2. Read new artwork if provided
        val artworkUri = if (tags.hasKey("artworkUri")) tags.getString("artworkUri") else null
        val removeArtwork = if (tags.hasKey("removeArtwork")) tags.getBoolean("removeArtwork") else false
        val imageBytes = if (!artworkUri.isNullOrEmpty() && !removeArtwork) {
          try {
            val artParsed = Uri.parse(artworkUri)
            val artStream = if (artParsed.scheme == "content") {
              context.contentResolver.openInputStream(artParsed)
            } else {
              FileInputStream(artParsed.path ?: artworkUri)
            }
            artStream?.use { it.readBytes() }
          } catch (e: Exception) {
            null
          }
        } else null

        // 3. Assemble all ID3v2 frames
        val allFrames = ByteArrayOutputStream()
        allFrames.write(preservedFrames.toByteArray())

        val title = if (tags.hasKey("title")) tags.getString("title")?.trim() else null
        if (!title.isNullOrEmpty()) allFrames.write(buildTextFrame("TIT2", title))

        val artist = if (tags.hasKey("artist")) tags.getString("artist")?.trim() else null
        if (!artist.isNullOrEmpty()) allFrames.write(buildTextFrame("TPE1", artist))

        val album = if (tags.hasKey("album")) tags.getString("album")?.trim() else null
        if (!album.isNullOrEmpty()) allFrames.write(buildTextFrame("TALB", album))

        val albumArtist = if (tags.hasKey("albumArtist")) tags.getString("albumArtist")?.trim() else null
        if (!albumArtist.isNullOrEmpty()) allFrames.write(buildTextFrame("TPE2", albumArtist))

        val composer = if (tags.hasKey("composer")) tags.getString("composer")?.trim() else null
        if (!composer.isNullOrEmpty()) allFrames.write(buildTextFrame("TCOM", composer))

        val year = if (tags.hasKey("year")) tags.getString("year")?.trim() else null
        if (!year.isNullOrEmpty()) {
          allFrames.write(buildTextFrame("TYER", year))
          allFrames.write(buildTextFrame("TDRC", year))
        }

        val genre = if (tags.hasKey("genre")) tags.getString("genre")?.trim() else null
        if (!genre.isNullOrEmpty()) allFrames.write(buildTextFrame("TCON", genre))

        if (imageBytes != null && imageBytes.isNotEmpty()) {
          val mimeType = when {
            imageBytes.size > 3 && imageBytes[0] == 0xFF.toByte() && imageBytes[1] == 0xD8.toByte() && imageBytes[2] == 0xFF.toByte() -> "image/jpeg"
            imageBytes.size > 8 && imageBytes[0] == 0x89.toByte() && imageBytes[1] == 0x50.toByte() && imageBytes[2] == 0x4E.toByte() -> "image/png"
            else -> "image/jpeg"
          }
          allFrames.write(buildApicFrame(imageBytes, mimeType))
        }

        // 4. Build ID3v2.3 header
        val framesBytes = allFrames.toByteArray()
        val header = ByteArrayOutputStream()
        header.write("ID3".toByteArray(StandardCharsets.US_ASCII))
        header.write(byteArrayOf(0x03, 0x00)) // ID3v2.3.0
        header.write(0x00) // Flags
        header.write(toSynchsafe(framesBytes.size))

        // 5. Write new file to temp cache file
        val audioBytesToCopy = if (fileLength > audioOffset) {
          fileLength - audioOffset - (if (isMp3 && hasId3v1) 128L else 0L)
        } else -1L

        val tFile = File(context.cacheDir, "vrish_tagged_${System.currentTimeMillis()}.tmp")
        tempFile = tFile

        FileOutputStream(tFile).use { outStream ->
          outStream.write(header.toByteArray())
          outStream.write(framesBytes)

          openInStream().use { inStream ->
            skipFully(inStream, audioOffset)
            if (audioBytesToCopy > 0) {
              var remaining = audioBytesToCopy
              val buf = ByteArray(65536)
              while (remaining > 0) {
                val toRead = minOf(remaining, buf.size.toLong()).toInt()
                val count = inStream.read(buf, 0, toRead)
                if (count < 0) break
                outStream.write(buf, 0, count)
                remaining -= count
              }
            } else {
              val buf = ByteArray(65536)
              while (true) {
                val count = inStream.read(buf)
                if (count < 0) break
                outStream.write(buf, 0, count)
              }
            }
          }

          if (isMp3) {
            val id3v1Bytes = buildId3v1Tag(title, artist, album, year)
            outStream.write(id3v1Bytes)
          }
          outStream.flush()
        }

        // 6. Overwrite the physical file directly on device storage
        var writeSuccess = false
        if (targetFile != null && targetFile.exists()) {
          try {
            tFile.copyTo(targetFile, overwrite = true)
            writeSuccess = true
          } catch (e: Exception) {
            // Log and try ContentResolver output stream below
          }
        }

        if (!writeSuccess && parsed.scheme == "content") {
          try {
            context.contentResolver.openOutputStream(parsed, "wt")?.use { outStream ->
              FileInputStream(tFile).use { inStream ->
                inStream.copyTo(outStream)
              }
              outStream.flush()
              writeSuccess = true
            }
          } catch (e: Exception) {}
        }

        if (!writeSuccess) {
          tFile.delete()
          val res = Arguments.createMap()
          res.putBoolean("success", false)
          res.putString("error", "WRITE_FAILED")
          res.putString("message", "Unable to overwrite physical audio file on storage")
          promise.resolve(res)
          return@execute
        }

        tFile.delete()

        // 7. Update MediaStore database record directly
        try {
          val values = ContentValues().apply {
            if (!title.isNullOrEmpty()) put(MediaStore.Audio.Media.TITLE, title)
            if (!artist.isNullOrEmpty()) put(MediaStore.Audio.Media.ARTIST, artist)
            if (!album.isNullOrEmpty()) put(MediaStore.Audio.Media.ALBUM, album)
            val yearInt = year?.toIntOrNull()
            if (yearInt != null) put(MediaStore.Audio.Media.YEAR, yearInt)
          }
          if (parsed.scheme == "content") {
            context.contentResolver.update(parsed, values, null, null)
          } else if (targetFile != null) {
            context.contentResolver.update(
              MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
              values,
              "${MediaStore.Audio.Media.DATA} = ?",
              arrayOf(targetFile.absolutePath)
            )
          }
        } catch (e: Exception) {}

        // 8. Update internal artwork cache
        if (imageBytes != null && imageBytes.isNotEmpty()) {
          val artworkDir = File(context.filesDir, "artwork").apply { mkdirs() }
          File(artworkDir, "$id.art").writeBytes(imageBytes)
        } else if (removeArtwork) {
          val artworkFile = File(File(context.filesDir, "artwork"), "$id.art")
          if (artworkFile.exists()) artworkFile.delete()
        }

        // 9. Refresh Android MediaScanner so system immediately indexes the changes
        try {
          val scanPath = targetFile?.absolutePath ?: (if (parsed.scheme == "file") parsed.path else null)
          if (scanPath != null) {
            MediaScannerConnection.scanFile(context, arrayOf(scanPath), arrayOf("audio/mpeg"), null)
          }
        } catch (e: Exception) {}

        val result = Arguments.createMap()
        result.putBoolean("success", true)
        result.putString("uri", uri)
        result.putString("realPath", targetFile?.absolutePath)
        promise.resolve(result)
      } catch (e: Exception) {
        tempFile?.delete()
        promise.reject("WRITE_METADATA_ERROR", "Failed to write tags to audio file: ${e.message}", e)
      }
    }
  }

  @ReactMethod
  fun deleteTrackFile(uri: String, promise: Promise) {
    executor.execute {
      try {
        val parsed = Uri.parse(uri)
        val realPath = getRealPathFromUri(parsed)
        var deleted = false
        if (!realPath.isNullOrEmpty()) {
          val f = File(realPath)
          if (f.exists()) {
            deleted = f.delete()
          }
        }
        if (parsed.scheme == "content") {
          try {
            val count = context.contentResolver.delete(parsed, null, null)
            if (count > 0) deleted = true
          } catch (e: Exception) {}
        }
        promise.resolve(deleted)
      } catch (e: Exception) {
        promise.reject("DELETE_ERROR", "Could not delete audio file", e)
      }
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun readStoreSync(): String {
    try {
      val jsonFile = File(context.filesDir, "vrish_store.json")
      if (jsonFile.exists()) {
        return jsonFile.readText(StandardCharsets.UTF_8)
      }

      val dbFile = context.getDatabasePath("noir.db")
      if (dbFile != null && dbFile.exists()) {
        val migrated = migrateFromSqlite(dbFile)
        if (migrated.isNotEmpty()) {
          jsonFile.writeText(migrated, StandardCharsets.UTF_8)
          return migrated
        }
      }
    } catch (e: Exception) {
      // Return empty string on error
    }
    return ""
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun writeStoreSync(json: String): Boolean {
    return try {
      val temp = File(context.filesDir, "vrish_store.tmp")
      temp.writeText(json, StandardCharsets.UTF_8)
      val dest = File(context.filesDir, "vrish_store.json")
      if (!temp.renameTo(dest)) {
        temp.copyTo(dest, overwrite = true)
        temp.delete()
      }
      true
    } catch (e: Exception) {
      false
    }
  }

  @ReactMethod
  fun writeStoreAsync(json: String, promise: Promise) {
    executor.execute {
      try {
        val temp = File(context.filesDir, "vrish_store.tmp")
        temp.writeText(json, StandardCharsets.UTF_8)
        val dest = File(context.filesDir, "vrish_store.json")
        if (!temp.renameTo(dest)) {
          temp.copyTo(dest, overwrite = true)
          temp.delete()
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("WRITE_STORE_ERROR", "Failed to write store", e)
      }
    }
  }

  private fun migrateFromSqlite(dbFile: File): String {
    var db: SQLiteDatabase? = null
    try {
      db = SQLiteDatabase.openDatabase(
        dbFile.path,
        null,
        SQLiteDatabase.OPEN_READONLY
      )
      val root = JSONObject()
      root.put("version", 1)

      // 1. Tracks
      val tracksObj = JSONObject()
      try {
        val cTracks = db.rawQuery("SELECT * FROM tracks", null)
        cTracks.use { c ->
          val idCol = c.getColumnIndex("id")
          val uriCol = c.getColumnIndex("uri")
          val titleCol = c.getColumnIndex("title")
          val artistCol = c.getColumnIndex("artist")
          val albumCol = c.getColumnIndex("album")
          val albumArtistCol = c.getColumnIndex("album_artist")
          val composerCol = c.getColumnIndex("composer")
          val artCol = c.getColumnIndex("artwork_uri")
          val durCol = c.getColumnIndex("duration_ms")
          val addedCol = c.getColumnIndex("added_at")
          val favCol = c.getColumnIndex("favorite")
          val playCol = c.getColumnIndex("play_count")
          val userEditedCol = c.getColumnIndex("user_edited")
          val yearCol = c.getColumnIndex("year")
          val genreCol = c.getColumnIndex("genre")

          while (c.moveToNext()) {
            val t = JSONObject()
            val id = c.getString(idCol)
            t.put("id", id)
            t.put("uri", c.getString(uriCol))
            t.put("title", c.getString(titleCol))
            t.put("artist", c.getString(artistCol))
            t.put("album", c.getString(albumCol))
            if (albumArtistCol >= 0 && !c.isNull(albumArtistCol)) t.put("albumArtist", c.getString(albumArtistCol))
            if (composerCol >= 0 && !c.isNull(composerCol)) t.put("composer", c.getString(composerCol))
            if (artCol >= 0 && !c.isNull(artCol)) t.put("artworkUri", c.getString(artCol))
            t.put("durationMs", c.getLong(durCol))
            t.put("addedAt", c.getLong(addedCol))
            t.put("favorite", c.getInt(favCol) != 0)
            t.put("playCount", c.getInt(playCol))
            if (userEditedCol >= 0 && !c.isNull(userEditedCol)) t.put("userEdited", c.getInt(userEditedCol) != 0)
            if (yearCol >= 0 && !c.isNull(yearCol)) t.put("year", c.getString(yearCol))
            if (genreCol >= 0 && !c.isNull(genreCol)) t.put("genre", c.getString(genreCol))
            tracksObj.put(id, t)
          }
        }
      } catch (e: Exception) {}
      root.put("tracks", tracksObj)

      // 2. Playlists
      val playlistsObj = JSONObject()
      try {
        val cPl = db.rawQuery("SELECT * FROM playlists", null)
        cPl.use { c ->
          val idCol = c.getColumnIndex("id")
          val nameCol = c.getColumnIndex("name")
          val createdCol = c.getColumnIndex("created_at")
          while (c.moveToNext()) {
            val p = JSONObject()
            val plId = c.getString(idCol)
            p.put("id", plId)
            p.put("name", c.getString(nameCol))
            p.put("createdAt", c.getLong(createdCol))

            val trIds = JSONArray()
            try {
              val cPlTr = db.rawQuery("SELECT track_id FROM playlist_tracks WHERE playlist_id=? ORDER BY position ASC", arrayOf(plId))
              cPlTr.use { ctr ->
                while (ctr.moveToNext()) {
                  trIds.put(ctr.getString(0))
                }
              }
            } catch (e: Exception) {}
            p.put("trackIds", trIds)
            playlistsObj.put(plId, p)
          }
        }
      } catch (e: Exception) {}
      root.put("playlists", playlistsObj)

      // 3. Session
      try {
        val cSession = db.rawQuery("SELECT value FROM playback_session WHERE key='last'", null)
        cSession.use { c ->
          if (c.moveToNext()) {
            try {
              root.put("session", JSONObject(c.getString(0)))
            } catch (e: Exception) {}
          }
        }
      } catch (e: Exception) {}

      // 4. Settings
      val settingsObj = JSONObject()
      try {
        val cSettings = db.rawQuery("SELECT key, value FROM app_settings", null)
        cSettings.use { c ->
          while (c.moveToNext()) {
            settingsObj.put(c.getString(0), c.getString(1))
          }
        }
      } catch (e: Exception) {}
      root.put("settings", settingsObj)

      // 5. Fingerprints
      val fingerprintsObj = JSONObject()
      try {
        val cFp = db.rawQuery("SELECT track_id, sha256 FROM track_fingerprints", null)
        cFp.use { c ->
          while (c.moveToNext()) {
            fingerprintsObj.put(c.getString(1), c.getString(0))
          }
        }
      } catch (e: Exception) {}
      root.put("fingerprints", fingerprintsObj)

      return root.toString()
    } catch (e: Exception) {
      return ""
    } finally {
      db?.close()
    }
  }
}
