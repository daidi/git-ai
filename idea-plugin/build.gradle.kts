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
    implementation("org.apache.commons:commons-compress:1.24.0")
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
        version.set(project.property("pluginVersion").toString())
        sinceBuild.set("241")
        untilBuild.set("261.*")
    }

    buildSearchableOptions {
        enabled = false
    }

    signPlugin {
        val cert = System.getenv("CERTIFICATE_CHAIN")
        if (cert != null) certificateChain.set(cert)
        val key = System.getenv("PRIVATE_KEY")
        if (key != null) privateKey.set(key)
        val pass = System.getenv("PRIVATE_KEY_PASSWORD")
        if (pass != null) password.set(pass)
    }

    publishPlugin {
        val pubToken = System.getenv("PUBLISH_TOKEN")
        if (pubToken != null) token.set(pubToken)
    }
}
