# Getting Started with IntelliJ Platform SDK

Use this reference when the user needs to create a new plugin, configure Gradle, choose target IDEs, or understand plugin packaging basics.

## What this file covers

- IntelliJ Platform Gradle Plugin 2.x setup
- `build.gradle.kts` structure
- `settings.gradle.kts` basics
- `plugin.xml` essentials
- target IDE and bundled plugin selection
- minimal project layout
- starter snippets for new plugins

## Minimal project structure

```text
my-plugin/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── src/
│   ├── main/
│   │   ├── java/ or kotlin/
│   │   └── resources/
│   │       └── META-INF/plugin.xml
│   └── test/
└── gradle/
```

## Recommended baseline

- JDK 17+ (minimum required by the IntelliJ Platform Gradle Plugin 2.x; JDK 21 is the practical baseline for 2024.2+ targets and required for 2025.1+ targets)
- Gradle 8.13+
- IntelliJ Platform Gradle Plugin `2.13.1` (example version — verify the current supported version in the official docs before pinning)
- Prefer Kotlin DSL in Gradle files

## `build.gradle.kts` template

```kotlin
plugins {
    id("java")
    id("org.jetbrains.intellij.platform") version "2.13.1"
}

group = "com.example"
version = "1.0.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdea("2024.3")
        bundledPlugin("com.intellij.java")

        testFramework(TestFrameworkType.Platform)
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "com.example.myplugin"
        name = "My Plugin"
        version = project.version.toString()
        description = "Plugin description"
        vendor {
            name = "Gadfly"
        }
        ideaVersion {
            sinceBuild = "243"
        }
    }
}
```

`sinceBuild` should match the minimum IDE line you actually support. In most cases, omit `untilBuild` entirely. Only consider restricting the upper bound if you intentionally publish separate plugin versions per major IDE line; for 2025.3+ that strategy uses `strict-until-build`, not a blanket `until-build` in every starter template.

## `settings.gradle.kts` template

Minimal:

```kotlin
rootProject.name = "my-plugin"
```

With centralized dependency resolution (recommended for multi-module or strict builds):

```kotlin
import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform

plugins {
    id("org.jetbrains.intellij.platform.settings") version "2.13.1"
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS

    repositories {
        mavenCentral()

        intellijPlatform {
            defaultRepositories()
        }
    }
}

rootProject.name = "my-plugin"
```

## `gradle.properties` template

```properties
# IntelliJ Platform Gradle Plugin settings
org.jetbrains.intellij.platform.downloadSources=true
org.jetbrains.intellij.platform.selfUpdateCheck=false

# Gradle performance
org.gradle.configuration-cache=true
org.gradle.caching=true
```

## Target IDE selection

Choose the IDE dependency based on the real plugin target. The helper function name determines which product is used for development and testing:

- `intellijIdea("2024.3")` — IntelliJ IDEA target
- `pycharm("2024.3")` — PyCharm target
- `webstorm("2024.3")` — WebStorm
- `goland("2024.3")` — GoLand
- `rider("2024.3")` — Rider
- `clion("2024.3")` — CLion
- `phpstorm("2024.3")` — PhpStorm
- `rubymine("2024.3")` — RubyMine
- `rustRover("2024.3")` — RustRover
- `androidStudio("2024.3")` — Android Studio
- `datagrip("2024.3")` — DataGrip
- `dataspell("2024.3")` — DataSpell
- `gateway("2024.3")` — Gateway
- `fleetBackend("2024.3")` — Fleet Backend
- `mps("2024.3")` — MPS

Notes:
- Before 2025.3, some products still had separate dependency target types such as `IntellijIdeaCommunity` (`IC`) or `PyCharmCommunity` (`PC`).
- For 2025.3 and later, use the unified product helpers such as `intellijIdea()` and `pycharm()` instead of deprecated `IC` / `PC` targets.
- Only add bundled plugins you truly need.

## `plugin.xml` essentials

```xml
<idea-plugin>
    <id>com.example.myplugin</id>
    <name>My Plugin</name>
    <version>1.0.0</version>
    <vendor>Gadfly</vendor>
    <description><![CDATA[
        Short plugin description. Use CDATA when the description contains HTML.
    ]]></description>

    <depends>com.intellij.modules.platform</depends>

    <extensions defaultExtensionNs="com.intellij">
        <!-- extension points go here -->
    </extensions>

    <applicationListeners>
        <!-- declarative application listeners go here -->
    </applicationListeners>

    <projectListeners>
        <!-- declarative project listeners go here -->
    </projectListeners>

    <actions>
        <!-- actions go here -->
    </actions>
</idea-plugin>
```

Add product/language-specific modules only when needed (e.g. `<depends>com.intellij.modules.java</depends>` for Java-specific PSI).

If the plugin integrates with optional IDE events, prefer declarative listeners in `plugin.xml` via `<applicationListeners>` and `<projectListeners>` instead of eager startup wiring.

## Dependency strategy

Prefer the smallest viable dependency set:

- Use `com.intellij.modules.platform` for generic plugins
- Add `com.intellij.modules.lang` if you work with PSI/editor language features
- Add `com.intellij.modules.java` only for Java-specific PSI or UI integration
- Use optional dependencies for integrations that may not exist in every IDE

In Gradle, use `bundledPlugin("pluginId")` for bundled plugin dependencies and `bundledModule("moduleId")` for platform module dependencies. These are distinct helpers -- modules represent platform capabilities while plugins are optional feature bundles.

## Optional dependency pattern

When an optional dependency only gates plugin availability, `optional="true"` may be enough. When the optional dependency also enables additional extensions, use a separate `config-file` so those extensions are loaded only when the dependency is present:

```xml
<depends optional="true"
         config-file="myPluginId-optionalPluginName.xml">org.jetbrains.plugins.yaml</depends>
```

The `config-file` points to a separate XML file (in the same directory as `plugin.xml`) that contains only the extensions for the optional integration. This file must have a unique name to avoid classloader conflicts in tests.

## Project setup advice

When implementing for a user:

1. Identify target IDE(s)
2. Identify required language/plugin dependencies
3. Keep the initial setup minimal
4. Put implementation classes in `src/main/java` or `src/main/kotlin`
5. Put icons, templates, and `plugin.xml` resources under `src/main/resources`

## Multi-module projects

For larger plugins, split into multiple Gradle modules. Use `org.jetbrains.intellij.platform.module` plugin in submodules and `pluginModule()` in the main module's dependencies to wire them together:

```kotlin
// In submodule build.gradle.kts
plugins {
    id("org.jetbrains.intellij.platform.module")
}

// In main module build.gradle.kts dependencies
dependencies {
    intellijPlatform {
        pluginModule(implementation(project(":submodule")))
    }
}
```

### pluginModule vs pluginComposedModule

- `pluginModule(implementation(project(":sub")))` — places the submodule JAR in `lib/modules/` (separate JAR)
- `pluginComposedModule(implementation(project(":sub")))` — merges the submodule into the main plugin JAR

Use `pluginModule` for most cases. Use `pluginComposedModule` when the submodule must be in the same classloader as the main module.

## Advanced Gradle configuration

### Split mode (remote development)

Enable split mode for remote development support (requires platform 241.14473+):

```kotlin
intellijPlatform {
    splitMode = true  // default: true
    splitModeTarget = SplitModeTarget.BACKEND  // default
}
```

### Additional dependency helpers

```kotlin
dependencies {
    intellijPlatform {
        // Bundled platform modules (not plugins)
        bundledModule("com.intellij.modules.json")

        // Marketplace plugin dependencies
        plugin("org.example.someplugin", "1.0.0")

        // Auto-resolve compatible Marketplace version
        compatiblePlugin("org.example.someplugin")

        // Test-scope dependencies
        testFramework(TestFrameworkType.Platform)
        testBundledPlugin("com.intellij.java")
        testBundledModule("com.intellij.modules.json")
        testPlugin("org.example.someplugin", "1.0.0")
    }
}
```

### Additional Gradle properties

```properties
# Opt out of automatic IntelliJ Platform dependencies
org.jetbrains.intellij.platform.addDefaultIntellijPlatformDependencies=false

# Mute specific verification warnings
org.jetbrains.intellij.platform.verifyPluginProjectConfigurationMutedMessages=message1,message2

# Custom cache directory
org.jetbrains.intellij.platform.intellijPlatformCache=/path/to/cache
```

## Common setup mistakes

- Using the legacy `org.jetbrains.intellij` plugin instead of `org.jetbrains.intellij.platform`
- Forgetting `intellijPlatform { defaultRepositories() }`
- Declaring too many bundled plugins
- Setting an overly broad `untilBuild`
- Targeting Java APIs without `com.intellij.modules.java`
- Missing `config-file` in optional `<depends>` when separate extensions are needed
- Using Gradle version below the minimum required by the chosen plugin version
- Calling `instrumentationTools()` explicitly (deprecated — now auto-applied)
- Using `IntellijIdeaCommunity` (`IC`) or `PyCharmCommunity` (`PC`) as dependency target for 2025.3+ (use unified `intellijIdea()` / `pycharm()` instead)
- Not excluding Kotlin stdlib from plugin dependencies (platform bundles it)
- Adding Kotlin Coroutines explicitly (should not be added; platform provides them)

## Publishing basics

A common first-release flow is:

1. `buildPlugin` (or `signPlugin` if signing is already configured)
2. install and test the ZIP locally
3. upload the plugin manually to Marketplace

For later automated releases, a common task combination is:

1. `verifyPlugin`
2. `publishPlugin`

The first Marketplace upload must always be manual. After the plugin has been published to Marketplace once, later automated releases can use Gradle tasks such as `publishPlugin`; if signing is configured, `publishPlugin` will run the required signing step automatically. Read `testing-and-publishing.md` for the fuller release workflow.

## When to also read other references

- Read `compatibility.md` for version migration or build-range questions
- Read `extension_points.md` for exact XML registration syntax
- Read `testing-and-publishing.md` for verifier, signing, and Marketplace release
