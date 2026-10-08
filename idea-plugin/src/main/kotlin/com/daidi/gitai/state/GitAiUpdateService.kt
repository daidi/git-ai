package com.daidi.gitai.state

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.settings.GitAiConfigManager
import com.daidi.gitai.settings.GitAiSettingsProtocolException
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.ProcessCanceledException
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import java.security.MessageDigest
import java.lang.ref.WeakReference
import java.util.concurrent.locks.ReentrantLock

/** App-wide, single-flight release discovery. Never installs as a side effect of a check. */
@Service(Service.Level.APP)
internal class GitAiUpdateService : Disposable {
    private val lock = ReentrantLock()
    private val log = Logger.getInstance(GitAiUpdateService::class.java)
    private val notifications = mutableMapOf<String, WeakReference<Notification>>() // EDT only
    @Volatile private var disposed = false

    data class Result(val key: String, val latest: String? = null)

    fun checkNow(info: GitAiCli.RuntimeInfo, indicator: ProgressIndicator, manual: Boolean): Result {
        indicator.checkCanceled()
        if (disposed || info.path == null || info.version == null) return Result("settings.cli.unavailable")
        if (GitAiUpdatePolicy.stableVersion(info.version) == null) return Result("settings.cli.development")
        if (!lock.tryLock()) return Result("settings.cli.busy")
        try {
            val props = PropertiesComponent.getInstance()
            val identity = MessageDigest.getInstance("SHA-256").digest(info.identity.toByteArray())
                .joinToString("") { "%02x".format(it) }
            var cache = GitAiUpdatePolicy.Cache(
                props.getValue("$PREFIX.identity", ""), props.getLong("$PREFIX.success", 0),
                props.getLong("$PREFIX.failure", 0), props.getValue("$PREFIX.latest", ""),
            )
            val now = System.currentTimeMillis()
            if (GitAiUpdatePolicy.shouldFetch(cache, identity, now, manual)) {
                if (cache.identity != identity) cache = GitAiUpdatePolicy.Cache(identity)
                try {
                    val latest = GitAiInstaller.fetchLatestReleaseTag(indicator).removePrefix("v")
                    require(GitAiUpdatePolicy.stableVersion(latest) != null)
                    indicator.checkCanceled()
                    cache = cache.copy(lastSuccess = System.currentTimeMillis(), lastFailure = 0, latest = latest)
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (_: Exception) {
                    cache = cache.copy(lastFailure = System.currentTimeMillis())
                    log.info("CLI update metadata check failed; retry backoff is 15 minutes")
                }
                if (disposed) return Result("settings.cli.unavailable")
                // Versioned keys deliberately ignore the legacy attempt-only
                // timestamp, which may describe a failed check or another CLI.
                props.setValue("$PREFIX.identity", identity)
                props.setValue("$PREFIX.success", cache.lastSuccess.toString())
                props.setValue("$PREFIX.failure", cache.lastFailure.toString())
                props.setValue("$PREFIX.latest", cache.latest)
            }
            if (cache.lastFailure > 0 && cache.lastFailure >= cache.lastSuccess) return Result("settings.cli.checkFailed")
            return if (GitAiUpdatePolicy.isNewer(info.version, cache.latest)) Result("notification.updateAvailable", cache.latest)
            else Result("settings.cli.upToDate")
        } finally {
            lock.unlock()
        }
    }

    fun checkOnStartup(project: Project, manual: Boolean = false) {
        if (project.isDisposed || disposed) return
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("settings.cli.check"), true) {
            override fun run(indicator: ProgressIndicator) {
                val info = GitAiCli.runtimeInfo()
                indicator.checkCanceled()
                if (project.isDisposed || disposed) return
                if (info.path == null) {
                    notify(project, "health:${info.identity}", GitAiBundle.message("installer.missing.content"), true)
                    return
                }
                // Always check the local protocol before considering an optional
                // release query or its cooldown. This requires no network.
                try {
                    GitAiConfigManager.loadSchema(project, indicator)
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (e: Exception) {
                    val key = when {
                        e is GitAiSettingsProtocolException -> "settings.cli.incompatible"
                        else -> "settings.cli.unavailable"
                    }
                    notify(project, "health:${info.identity}", GitAiBundle.message(key), true)
                    return
                }
                clearCompatibilityNotifications()
                val enabled = try {
                    GitAiConfigManager.load(project, "merged", indicator).checkUpdate != false
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (_: Exception) {
                    false
                }
                if (!enabled && !manual) return
                val result = checkNow(info, indicator, manual)
                result.latest?.let { latest ->
                    notify(project, "update:${info.identity}:$latest",
                        GitAiBundle.message("notification.updateAvailable", info.version ?: "—", latest), false)
                }
                if (manual && result.key == "settings.cli.checkFailed") {
                    notify(project, "check:${info.identity}", GitAiBundle.message(result.key), false)
                }
            }
        })
    }

    fun clearCompatibilityNotifications() = clearNotifications(onlyCompatibility = true)

    fun clearNotifications(onlyCompatibility: Boolean = false) {
        ApplicationManager.getApplication().invokeLater {
            notifications.entries.removeIf { (key, value) ->
                if (onlyCompatibility && !key.startsWith("health:")) false
                else {
                    value.get()?.expire()
                    true
                }
            }
        }
    }

    private fun notify(project: Project, identity: String, message: String, incompatible: Boolean) {
        ApplicationManager.getApplication().invokeLater({
            if (disposed || project.isDisposed) return@invokeLater
            notifications.entries.removeIf { it.value.get()?.isExpired != false }
            if (notifications.containsKey(identity)) return@invokeLater
            val notification = NotificationGroupManager.getInstance()
                .getNotificationGroup(if (incompatible) "git-ai.cli.health" else "git-ai.notifications")
                .createNotification(GitAiBundle.message("notification.title"), message,
                    if (incompatible) NotificationType.WARNING else NotificationType.INFORMATION)
            notifications[identity] = WeakReference(notification)
            val projectRef = WeakReference(project)
            notification.addAction(NotificationAction.createSimple(GitAiBundle.message("notification.updateNow")) {
                val activeProject = projectRef.get()?.takeUnless { it.isDisposed } ?: return@createSimple
                GitAiInstaller.installCli(activeProject) { success ->
                    if (success) {
                        checkOnStartup(activeProject)
                    }
                }
            })
            notification.addAction(NotificationAction.createSimple(GitAiBundle.message("settings.cli.retry")) {
                notifications.remove(identity)?.get()?.expire()
                projectRef.get()?.let { checkOnStartup(it, manual = true) }
            })
            notification.notify(project)
        }, project.disposed)
    }

    override fun dispose() {
        disposed = true
        clearNotifications()
    }

    companion object {
        private const val PREFIX = "git-ai.update.v2"
        fun getInstance(): GitAiUpdateService = service()
    }
}
