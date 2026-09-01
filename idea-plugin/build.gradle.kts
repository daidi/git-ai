import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion
import java.io.File

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.3.20"
    id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = property("pluginGroup").toString()
version = property("pluginVersion").toString()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    implementation("com.google.code.gson:gson:2.14.0")
    implementation("org.apache.commons:commons-compress:1.28.0")
    testImplementation(kotlin("test-junit"))

    intellijPlatform {
        // Compile against the oldest supported IDE so accidental use of newer
        // APIs is caught at build time, then verify the artifact on 2026.2.
        intellijIdeaCommunity(providers.gradleProperty("platformVersion"))
        bundledPlugin("Git4Idea")
    }
}

kotlin {
    // The 2024.1 compatibility baseline runs on Java 17; newer IDEs can load
    // Java 17 bytecode without forcing contributors to install another JDK.
    jvmToolchain(17)
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
        // IntelliJ 2024.1 bundles Kotlin stdlib 1.9.22. Keeping the public
        // language/API level at 1.9 lets one artifact run on 2024.1–2026.2.
        languageVersion = KotlinVersion.KOTLIN_1_9
        apiVersion = KotlinVersion.KOTLIN_1_9
        // Avoid synthetic overrides for platform interface defaults. Those
        // bridges show up as deprecated/experimental API use on newer IDEs.
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// The IntelliJ instrumentation task fails inside Ant when a source set has no
// test classes. Keep `./gradlew test` usable until the first plugin test lands.
tasks.named("instrumentTestCode") {
    enabled = fileTree("src/test").files.isNotEmpty()
}

// Gradle 9 validates task-output relationships strictly. Signature verification
// reads the archive produced by signPlugin, so make that dependency explicit.
tasks.named("verifyPluginSignature") {
    dependsOn("signPlugin")
}

intellijPlatform {
    buildSearchableOptions = false

    pluginConfiguration {
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "241"
            // Do not make each release incompatible with the next IDE line.
            // Compatibility with the current latest IDE is enforced below.
            untilBuild = provider { null }
        }
    }

    pluginVerification {
        ides {
            current()
            // Pin the latest major GA baseline. Using latest() with the 2026.2
            // unified product downloads every optional product plugin as well.
            create(IntelliJPlatformType.IntellijIdea, "2026.2.0.1")
        }
    }

    signing {
        certificateChainFile = layout.file(
            providers.environmentVariable("CERTIFICATE_CHAIN_FILE").map { File(it) },
        )
        privateKeyFile = layout.file(
            providers.environmentVariable("PRIVATE_KEY_FILE").map { File(it) },
        )
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}
