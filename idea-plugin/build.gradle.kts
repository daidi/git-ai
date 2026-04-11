plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.22"
    id("org.jetbrains.intellij") version "1.17.2"
}

group = property("pluginGroup").toString()
version = property("pluginVersion").toString()

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.10.1")
}

intellij {
    version.set(property("platformVersion").toString())
    type.set(property("platformType").toString())
    plugins.set(listOf("Git4Idea"))
}

kotlin {
    jvmToolchain(17)
}

tasks {
    patchPluginXml {
        version.set(property("pluginVersion").toString())
        sinceBuild.set("241")
        untilBuild.set("261.*")
    }

    buildSearchableOptions {
        enabled = false
    }

    signPlugin {
        certificateChain.set(System.getenv("CERTIFICATE_CHAIN"))
        privateKey.set(System.getenv("PRIVATE_KEY"))
        password.set(System.getenv("PRIVATE_KEY_PASSWORD"))
    }

    publishPlugin {
        token.set(System.getenv("PUBLISH_TOKEN"))
    }
}
