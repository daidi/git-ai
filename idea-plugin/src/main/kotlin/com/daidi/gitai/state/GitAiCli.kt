package com.daidi.gitai.state

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.util.concurrency.AppExecutorUtil
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Thin, bounded process adapter for the git-ai CLI.
 *
 * The CLI remains the only component that reads or writes runtime state and
 * configuration. Callers must invoke this adapter from a background thread.
 */
object GitAiCli {
    private val log = Logger.getInstance(GitAiCli::class.java)
    private const val MAX_OUTPUT_BYTES = 4 * 1024 * 1024
    private val missingNotificationShown = AtomicBoolean(false)

    @Volatile
    private var cachedExecutable: String? = null

    data class Result(
        val success: Boolean,
        val stdout: String,
        val stderr: String,
    ) {
        val errorText: String get() = stderr.ifBlank { stdout }.ifBlank { "Command failed" }
    }

    fun run(project: Project, vararg args: String): Result =
        runCommand(project, args, input = null, timeoutSeconds = 45, notifyIfMissing = true)

    /** Used by polling so a missing CLI cannot produce one notification per tick. */
    fun runSilently(project: Project, vararg args: String): Result =
        runCommand(project, args, input = null, timeoutSeconds = 8, notifyIfMissing = false)

    fun runWithInput(project: Project, input: String, vararg args: String): Result =
        runCommand(project, args, input = input, timeoutSeconds = 45, notifyIfMissing = true)

    fun runGitInternal(project: Project, vararg args: String): Result {
        val basePath = project.basePath ?: return Result(false, "", "No project base path")
        return execute(
            workingDir = basePath,
            command = "git",
            args = args,
            env = mapOf("GIT_AI_INTERNAL" to "true"),
            timeoutSeconds = 45,
        )
    }

    fun invalidateExecutableCache() {
        cachedExecutable = null
        missingNotificationShown.set(false)
    }

    private fun runCommand(
        project: Project,
        args: Array<out String>,
        input: String?,
        timeoutSeconds: Long,
        notifyIfMissing: Boolean,
    ): Result {
        val basePath = project.basePath ?: return Result(false, "", "No project base path")
        val executable = getExecutablePath()
        if (executable == null) {
            if (notifyIfMissing && missingNotificationShown.compareAndSet(false, true)) {
                GitAiInstaller.notifyMissingCli(project)
            }
            return Result(false, "", "Git AI CLI is not installed")
        }
        return execute(basePath, executable, args, input = input, timeoutSeconds = timeoutSeconds)
    }

    private fun getExecutablePath(): String? {
        cachedExecutable?.let { cached ->
            if (!File(cached).isAbsolute || isExecutable(File(cached))) return cached
            cachedExecutable = null
        }

        val isWindows = System.getProperty("os.name").lowercase().contains("win")
        val executableName = if (isWindows) "git-ai.exe" else "git-ai"
        val homeDir = System.getProperty("user.home")
        val candidates = listOf(
            File(homeDir, ".git-ai/bin/$executableName"),
            File("/opt/homebrew/bin/$executableName"),
            File("/usr/local/bin/$executableName"),
            File(homeDir, "go/bin/$executableName"),
            File(homeDir, ".cargo/bin/$executableName"),
            File("/usr/bin/$executableName"),
        )
        candidates.firstOrNull(::isExecutable)?.absolutePath?.let {
            cachedExecutable = it
            return it
        }

        // GUI-launched IDEs often have a reduced PATH, but retain it as a final
        // fallback for package-manager and user-specific installations.
        if (probeExecutable(executableName)) {
            cachedExecutable = executableName
            return executableName
        }
        return null
    }

    private fun isExecutable(file: File): Boolean =
        file.isFile && (System.getProperty("os.name").lowercase().contains("win") || file.canExecute())

    private fun probeExecutable(command: String): Boolean = try {
        val process = ProcessBuilder(command, "--version")
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        val exited = process.waitFor(5, TimeUnit.SECONDS)
        if (!exited) process.destroyForcibly()
        exited && process.exitValue() == 0
    } catch (_: Exception) {
        false
    }

    private fun execute(
        workingDir: String,
        command: String,
        args: Array<out String>,
        input: String? = null,
        env: Map<String, String> = emptyMap(),
        timeoutSeconds: Long,
    ): Result {
        return try {
            val processBuilder = ProcessBuilder(listOf(command) + args)
                .directory(File(workingDir))
                .redirectErrorStream(false)
            processBuilder.environment().putAll(env)
            val process = processBuilder.start()

            val executor = AppExecutorUtil.getAppExecutorService()
            val stdoutFuture = executor.submit<String> { readLimited(process.inputStream) }
            val stderrFuture = executor.submit<String> { readLimited(process.errorStream) }

            process.outputStream.use { stream ->
                if (input != null) {
                    stream.write(input.toByteArray(StandardCharsets.UTF_8))
                    stream.flush()
                }
            }

            val exited = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
            if (!exited) {
                process.destroy()
                if (!process.waitFor(1, TimeUnit.SECONDS)) process.destroyForcibly()
            }

            val stdout = stdoutFuture.get(3, TimeUnit.SECONDS).trim()
            val stderr = stderrFuture.get(3, TimeUnit.SECONDS).trim()
            if (!exited) {
                Result(false, stdout, "Command timed out after ${timeoutSeconds}s")
            } else {
                Result(process.exitValue() == 0, stdout, stderr)
            }
        } catch (e: Exception) {
            log.warn("Git AI command execution failed", e)
            Result(false, "", e.message ?: "Unknown command error")
        }
    }

    private fun readLimited(stream: InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var truncated = false
        stream.use {
            while (true) {
                val read = it.read(buffer)
                if (read < 0) break
                val remaining = MAX_OUTPUT_BYTES - output.size()
                if (remaining > 0) output.write(buffer, 0, minOf(read, remaining))
                if (read > remaining) truncated = true
            }
        }
        val text = output.toString(StandardCharsets.UTF_8)
        return if (truncated) "$text\n[output truncated]" else text
    }
}
