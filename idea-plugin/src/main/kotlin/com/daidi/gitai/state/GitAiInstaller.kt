package com.daidi.gitai.state

import com.daidi.gitai.GitAiBundle
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.ProcessCanceledException
import com.intellij.openapi.progress.EmptyProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.io.HttpRequests
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.File
import java.io.FileInputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardOpenOption
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import java.util.zip.ZipFile

object GitAiInstaller {
    private val log = Logger.getInstance(GitAiInstaller::class.java)
    private const val MAX_ARCHIVE_BYTES = 150L * 1024L * 1024L
    private const val MAX_BINARY_BYTES = 100L * 1024L * 1024L
    private const val MAX_METADATA_BYTES = 1 shl 20

    fun notifyMissingCli(project: Project) {
        val notification = NotificationGroupManager.getInstance()
            .getNotificationGroup("git-ai.notifications")
            .createNotification(
                GitAiBundle.message("installer.missing.title"),
                GitAiBundle.message("installer.missing.content"),
                NotificationType.WARNING,
            )
        notification.addAction(NotificationAction.createSimple(GitAiBundle.message("installer.download")) {
            notification.expire()
            installCli(project)
        })
        notification.notify(project)
    }

    fun installCli(project: Project) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("installer.downloading"), true) {
            override fun run(indicator: ProgressIndicator) {
                var tempDir: File? = null
                try {
                    val platform = resolvePlatform()
                    val release = fetchLatestRelease(indicator)
                    val extension = if (platform.os == "windows") "zip" else "tar.gz"
                    val fileName = "git-ai_${platform.os}_${platform.arch}.$extension"
                    val baseUrl = "https://github.com/daidi/git-ai/releases/download/${release.tagName}"

                    tempDir = Files.createTempDirectory("git-ai-install-").toFile()
                    val archive = File(tempDir, fileName)
                    val stagedExecutable = File(tempDir, platform.executableName)

                    indicator.text = GitAiBundle.message("installer.downloading")
                    withRetry(indicator, "Release archive download") {
                        Files.deleteIfExists(archive.toPath())
                        downloadToFile("$baseUrl/$fileName", archive, indicator)
                    }
                    require(archive.length() in 1..MAX_ARCHIVE_BYTES) { "Downloaded archive has an invalid size" }

                    val checksums = withRetry(indicator, "Release checksum download") {
                        downloadText("$baseUrl/checksums.txt", indicator)
                    }
                    verifyChecksum(archive, fileName, checksums)

                    indicator.text = GitAiBundle.message("installer.extracting")
                    if (platform.os == "windows") {
                        unzip(archive, stagedExecutable, platform.executableName)
                    } else {
                        untar(archive, stagedExecutable, platform.executableName)
                        require(stagedExecutable.setExecutable(true, true)) { "Unable to make the CLI executable" }
                    }
                    require(stagedExecutable.isFile && stagedExecutable.length() > 0) { "Downloaded CLI is empty" }
                    validateExecutable(stagedExecutable)

                    val binFolder = File(System.getProperty("user.home"), ".git-ai/bin")
                    Files.createDirectories(binFolder.toPath())
                    val destination = File(binFolder, platform.executableName)
                    val staged = Files.createTempFile(binFolder.toPath(), ".git-ai-install-", ".tmp").toFile()
                    try {
                        Files.copy(stagedExecutable.toPath(), staged.toPath(), StandardCopyOption.REPLACE_EXISTING)
                        if (platform.os != "windows") {
                            require(staged.setExecutable(true, true)) { "Unable to stage the CLI executable" }
                        }
                        validateExecutable(staged)
                        try {
                            Files.move(
                                staged.toPath(),
                                destination.toPath(),
                                StandardCopyOption.ATOMIC_MOVE,
                                StandardCopyOption.REPLACE_EXISTING,
                            )
                        } catch (_: AtomicMoveNotSupportedException) {
                            Files.move(staged.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
                        }
                    } finally {
                        staged.delete()
                    }
                    if (platform.os != "windows") destination.setExecutable(true, true)
                    GitAiCli.invalidateExecutableCache()

                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(GitAiBundle.message("installer.success"), NotificationType.INFORMATION)
                        .notify(project)
                } catch (e: Exception) {
                    log.warn("Failed to install git-ai", e)
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(
                            GitAiBundle.message("installer.failed", e.message ?: "Unknown error"),
                            NotificationType.ERROR,
                        )
                        .notify(project)
                } finally {
                    tempDir?.deleteRecursively()
                }
            }
        })
    }

    fun fetchLatestReleaseTag(): String = fetchLatestRelease(EmptyProgressIndicator()).tagName

    private fun fetchLatestRelease(indicator: ProgressIndicator): ReleaseInfo {
        var lastError: Exception? = null
        for (endpoint in listOf(
            "https://git-ai.codegg.org/releases/latest",
            "https://api.github.com/repos/daidi/git-ai/releases/latest",
        )) {
            try {
                val json = withRetry(indicator, "Release metadata lookup") {
                    downloadText(endpoint, indicator)
                }
                val release = Gson().fromJson(json, ReleaseInfo::class.java)
                require(Regex("^v[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$").matches(release.tagName)) {
                    "Release service returned an invalid version"
                }
                return release
            } catch (e: ProcessCanceledException) {
                throw e
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw IllegalStateException("Unable to resolve the latest release: ${lastError?.message ?: "unknown error"}", lastError)
    }

    private fun downloadToFile(url: String, destination: File, indicator: ProgressIndicator) {
        HttpRequests.request(url)
            .forceHttps(true)
            .redirectLimit(5)
            .connectTimeout(10_000)
            .readTimeout(60_000)
            .connect { request ->
                val declaredLength = request.connection.contentLengthLong
                require(declaredLength < 0 || declaredLength <= MAX_ARCHIVE_BYTES) {
                    "Downloaded archive exceeded the safety limit"
                }
                var written = 0L
                try {
                    request.inputStream.use { input ->
                        Files.newOutputStream(
                            destination.toPath(),
                            StandardOpenOption.CREATE_NEW,
                            StandardOpenOption.WRITE,
                        ).use { output ->
                            val buffer = ByteArray(8192)
                            while (true) {
                                indicator.checkCanceled()
                                val count = input.read(buffer)
                                if (count < 0) break
                                written += count
                                require(written <= MAX_ARCHIVE_BYTES) { "Downloaded archive exceeded the safety limit" }
                                output.write(buffer, 0, count)
                            }
                        }
                    }
                    require(written > 0) { "Downloaded archive was empty" }
                } catch (error: Exception) {
                    Files.deleteIfExists(destination.toPath())
                    throw error
                }
            }
    }

    private fun downloadText(url: String, indicator: ProgressIndicator): String =
        HttpRequests.request(url)
            .forceHttps(true)
            .redirectLimit(5)
            .connectTimeout(10_000)
            .readTimeout(20_000)
            .connect { request ->
                indicator.checkCanceled()
                val declaredLength = request.connection.contentLengthLong
                require(declaredLength < 0 || declaredLength <= MAX_METADATA_BYTES) {
                    "Release metadata response was too large"
                }
                val bytes = request.inputStream.use { it.readNBytes(MAX_METADATA_BYTES + 1) }
                require(bytes.size <= MAX_METADATA_BYTES) { "Release metadata response was too large" }
                bytes.toString(Charsets.UTF_8)
            }

    private fun <T> withRetry(
        indicator: ProgressIndicator,
        description: String,
        operation: () -> T,
    ): T {
        var lastError: Exception? = null
        repeat(3) { attempt ->
            indicator.checkCanceled()
            try {
                return operation()
            } catch (e: ProcessCanceledException) {
                throw e
            } catch (e: Exception) {
                lastError = e
                if (attempt < 2) {
                    Thread.sleep(500L shl attempt)
                }
            }
        }
        throw IllegalStateException("$description failed after 3 attempts: ${lastError?.message ?: "unknown error"}", lastError)
    }

    private fun resolvePlatform(): Platform {
        val os = when {
            SystemInfo.isMac -> "darwin"
            SystemInfo.isWindows -> "windows"
            SystemInfo.isLinux -> "linux"
            else -> throw IllegalStateException("This operating system is not supported")
        }
        val arch = when (System.getProperty("os.arch").lowercase()) {
            "amd64", "x86_64", "x64" -> "amd64"
            "aarch64", "arm64" -> "arm64"
            else -> throw IllegalStateException("This CPU architecture is not supported")
        }
        return Platform(os, arch, if (os == "windows") "git-ai.exe" else "git-ai")
    }

    private fun verifyChecksum(archive: File, fileName: String, checksums: String) {
        val matches = checksums.lineSequence()
            .map { it.trim().split(Regex("\\s+"), limit = 2) }
            .filter { it.size == 2 && it[1].removePrefix("*") == fileName }
            .toList()
        require(matches.size == 1) { "No unique checksum was published for $fileName" }
        val parts = matches.single()
        val expected = parts[0].lowercase()
        require(expected.matches(Regex("[0-9a-f]{64}"))) { "Published checksum is invalid" }

        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(archive).use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        require(MessageDigest.isEqual(expected.toByteArray(), actual.toByteArray())) {
            "Checksum verification failed; the download was not installed"
        }
    }

    private fun validateExecutable(executable: File) {
        val process = ProcessBuilder(executable.absolutePath, "--version")
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        val exited = process.waitFor(10, TimeUnit.SECONDS)
        if (!exited) process.destroyForcibly()
        require(exited && process.exitValue() == 0) { "Downloaded CLI failed its validation check" }
    }

    private fun unzip(archive: File, destination: File, targetFile: String) {
        ZipFile(archive).use { zip ->
            val matches = zip.entries().asSequence().filter { it.name == targetFile }.toList()
            require(matches.size == 1) { "Archive must contain exactly one $targetFile entry" }
            val entry = matches.single()
            require(!entry.isDirectory && entry.size in 1..MAX_BINARY_BYTES) { "$targetFile is not a valid executable" }
            zip.getInputStream(entry).use { input ->
                copyLimited(input, destination)
            }
        }
    }

    private fun untar(archive: File, destination: File, targetFile: String) {
        var found = false
        GZIPInputStream(FileInputStream(archive)).use { gzip ->
            TarArchiveInputStream(gzip).use { tar ->
                var entry = tar.nextEntry
                while (entry != null) {
                    if (entry.name == targetFile) {
                        require(!found) { "Archive contains duplicate $targetFile entries" }
                        require(entry.isFile && entry.size in 1..MAX_BINARY_BYTES) { "$targetFile is not a valid executable" }
                        copyLimited(tar, destination)
                        found = true
                    }
                    entry = tar.nextEntry
                }
            }
        }
        require(found) { "$targetFile not found in archive" }
    }

    private fun copyLimited(input: java.io.InputStream, destination: File) {
        var written = 0L
        try {
            Files.newOutputStream(destination.toPath(), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE).use { output ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    written += count
                    require(written <= MAX_BINARY_BYTES) { "Extracted executable exceeded the safety limit" }
                    output.write(buffer, 0, count)
                }
            }
            require(written > 0) { "Extracted executable was empty" }
        } catch (error: Exception) {
            Files.deleteIfExists(destination.toPath())
            throw error
        }
    }

    private data class Platform(val os: String, val arch: String, val executableName: String)
    private data class ReleaseInfo(@SerializedName("tag_name") val tagName: String = "")
}
