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
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.io.HttpRequests
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.File
import java.io.FileInputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import java.util.zip.ZipFile

object GitAiInstaller {
    private val log = Logger.getInstance(GitAiInstaller::class.java)
    private const val MAX_ARCHIVE_BYTES = 150L * 1024L * 1024L

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
                    val release = fetchLatestRelease()
                    val extension = if (platform.os == "windows") "zip" else "tar.gz"
                    val fileName = "git-ai_${platform.os}_${platform.arch}.$extension"
                    val baseUrl = "https://github.com/daidi/git-ai/releases/download/${release.tagName}"

                    tempDir = Files.createTempDirectory("git-ai-install-").toFile()
                    val archive = File(tempDir, fileName)
                    val stagedExecutable = File(tempDir, platform.executableName)

                    indicator.text = GitAiBundle.message("installer.downloading")
                    HttpRequests.request("$baseUrl/$fileName")
                        .connectTimeout(10_000)
                        .readTimeout(60_000)
                        .saveToFile(archive, indicator)
                    require(archive.length() in 1..MAX_ARCHIVE_BYTES) { "Downloaded archive has an invalid size" }

                    val checksums = HttpRequests.request("$baseUrl/checksums.txt")
                        .connectTimeout(10_000)
                        .readTimeout(20_000)
                        .readString()
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
                    try {
                        Files.move(
                            stagedExecutable.toPath(),
                            destination.toPath(),
                            StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING,
                        )
                    } catch (_: AtomicMoveNotSupportedException) {
                        Files.move(stagedExecutable.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
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

    private fun fetchLatestRelease(): ReleaseInfo {
        val json = HttpRequests.request("https://git-ai.codegg.org/releases/latest")
            .connectTimeout(10_000)
            .readTimeout(20_000)
            .readString()
        val release = Gson().fromJson(json, ReleaseInfo::class.java)
        require(Regex("^v[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$").matches(release.tagName)) {
            "Release service returned an invalid version"
        }
        return release
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
        val parts = checksums.lineSequence()
            .map { it.trim().split(Regex("\\s+"), limit = 2) }
            .firstOrNull { it.size == 2 && it[1].removePrefix("*") == fileName }
            ?: throw IllegalStateException("No checksum was published for $fileName")
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
            val entry = zip.getEntry(targetFile) ?: throw IllegalStateException("$targetFile not found in archive")
            require(!entry.isDirectory) { "$targetFile is not a file" }
            zip.getInputStream(entry).use { input ->
                Files.copy(input, destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
        }
    }

    private fun untar(archive: File, destination: File, targetFile: String) {
        GZIPInputStream(FileInputStream(archive)).use { gzip ->
            TarArchiveInputStream(gzip).use { tar ->
                var entry = tar.nextTarEntry
                while (entry != null) {
                    if (!entry.isDirectory && (entry.name == targetFile || entry.name.endsWith("/$targetFile"))) {
                        Files.copy(tar, destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
                        return
                    }
                    entry = tar.nextTarEntry
                }
            }
        }
        throw IllegalStateException("$targetFile not found in archive")
    }

    private data class Platform(val os: String, val arch: String, val executableName: String)
    private data class ReleaseInfo(@SerializedName("tag_name") val tagName: String = "")
}
