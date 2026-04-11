package com.daidi.gitai.state

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * Runs git-ai CLI commands from within the IDE.
 * All business logic stays in the CLI — the plugin only observes and delegates.
 */
object GitAiCli {
    private val log = Logger.getInstance(GitAiCli::class.java)

    data class Result(
        val success: Boolean,
        val stdout: String,
        val stderr: String,
    )

    /**
     * Run a git-ai command in the project directory.
     */
    fun run(project: Project, vararg args: String): Result {
        val basePath = project.basePath ?: return Result(false, "", "No project base path")
        return execute(basePath, "git-ai", *args)
    }

    /**
     * Run a raw git command with GIT_AI_INTERNAL=true.
     */
    fun runGitInternal(project: Project, vararg args: String): Result {
        val basePath = project.basePath ?: return Result(false, "", "No project base path")
        return execute(basePath, "git", *args, env = mapOf("GIT_AI_INTERNAL" to "true"))
    }

    private fun execute(
        workingDir: String,
        command: String,
        vararg args: String,
        env: Map<String, String> = emptyMap(),
    ): Result {
        return try {
            val pb = ProcessBuilder(command, *args)
            pb.directory(File(workingDir))
            pb.environment().putAll(env)
            pb.redirectErrorStream(false)

            val process = pb.start()

            val stdout = BufferedReader(InputStreamReader(process.inputStream)).readText()
            val stderr = BufferedReader(InputStreamReader(process.errorStream)).readText()

            val exited = process.waitFor(30, TimeUnit.SECONDS)
            if (!exited) {
                process.destroyForcibly()
                return Result(false, stdout, "Process timed out")
            }

            Result(
                success = process.exitValue() == 0,
                stdout = stdout.trim(),
                stderr = stderr.trim(),
            )
        } catch (e: Exception) {
            log.warn("Command failed: $command ${args.joinToString(" ")}", e)
            Result(false, "", e.message ?: "Unknown error")
        }
    }
}
