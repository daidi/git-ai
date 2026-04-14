package com.daidi.gitai.state

import com.daidi.gitai.GitAiBundle
import com.intellij.notification.*
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.io.HttpRequests
import java.io.File
import java.io.FileInputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.zip.GZIPInputStream
import java.util.zip.ZipFile
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream

object GitAiInstaller {
    private val log = Logger.getInstance(GitAiInstaller::class.java)

    fun notifyMissingCli(project: Project) {
        val notification = NotificationGroupManager.getInstance()
            .getNotificationGroup("git-ai.notifications")
            .createNotification(
                GitAiBundle.message("installer.missing.title"),
                GitAiBundle.message("installer.missing.content"),
                NotificationType.WARNING
            )
        
        notification.addAction(NotificationAction.createSimple(GitAiBundle.message("installer.download")) {
            notification.expire()
            installCli(project)
        })
        
        notification.notify(project)
    }

    fun installCli(project: Project) {
        val os = when {
            SystemInfo.isMac -> "darwin"
            SystemInfo.isWindows -> "windows"
            else -> "linux"
        }
        val archStr = System.getProperty("os.arch").lowercase()
        val arch = if (archStr.contains("aarch64") || archStr.contains("arm")) "arm64" else "amd64"
        
        val ext = if (SystemInfo.isWindows) "zip" else "tar.gz"
        val fileName = "git-ai_${os}_${arch}.$ext"
        val downloadUrl = "https://github.com/daidi/git-ai/releases/latest/download/$fileName"

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("installer.downloading"), true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val homeDir = System.getProperty("user.home")
                    val binFolder = File(homeDir, ".git-ai/bin")
                    if (!binFolder.exists()) {
                        binFolder.mkdirs()
                    }

                    val archiveFile = File(System.getProperty("java.io.tmpdir"), fileName)
                    
                    indicator.text = "Downloading $fileName..."
                    HttpRequests.request(downloadUrl).saveToFile(archiveFile, indicator)
                    
                    indicator.text = GitAiBundle.message("installer.extracting")
                    val exeName = if (SystemInfo.isWindows) "git-ai.exe" else "git-ai"
                    val destExe = File(binFolder, exeName)

                    if (SystemInfo.isWindows) {
                        unzip(archiveFile, destExe, exeName)
                    } else {
                        untar(archiveFile, destExe, exeName)
                        destExe.setExecutable(true)
                    }
                    
                    archiveFile.delete()

                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(GitAiBundle.message("installer.success"), NotificationType.INFORMATION)
                        .notify(project)

                } catch (e: Exception) {
                    log.warn("Failed to install git-ai", e)
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(GitAiBundle.message("installer.failed", e.message ?: "Unknown error"), NotificationType.ERROR)
                        .notify(project)
                }
            }
        })
    }

    private fun unzip(archive: File, dest: File, targetFile: String) {
        ZipFile(archive).use { zip ->
            val entry = zip.getEntry(targetFile) ?: throw Exception("$targetFile not found in zip")
            zip.getInputStream(entry).use { input ->
                Files.copy(input, dest.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
        }
    }

    private fun untar(archive: File, dest: File, targetFile: String) {
        GZIPInputStream(FileInputStream(archive)).use { gzip ->
            TarArchiveInputStream(gzip).use { tar ->
                var entry = tar.nextTarEntry
                while (entry != null) {
                    if (entry.name == targetFile || entry.name.endsWith("/$targetFile")) {
                        Files.copy(tar, dest.toPath(), StandardCopyOption.REPLACE_EXISTING)
                        return
                    }
                    entry = tar.nextTarEntry
                }
                throw Exception("$targetFile not found in tar.gz")
            }
        }
    }
}
