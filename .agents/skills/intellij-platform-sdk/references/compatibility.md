# IntelliJ Platform SDK Version Compatibility

This document covers version compatibility, migration guides, and API changes.

## Version Numbering

IntelliJ Platform uses the following versioning scheme:

| Version | Build Number | Format |
|---------|--------------|--------|
| 2026.1 | 261.xxxx.xx | BRANCH.BUILD |
| 2025.3 | 253.xxxx.xx | BRANCH.BUILD |
| 2025.2 | 252.xxxx.xx | BRANCH.BUILD |
| 2025.1 | 251.xxxx.xx | BRANCH.BUILD |
| 2024.3 | 243.xxxx.xx | BRANCH.BUILD |
| 2024.2 | 242.xxxx.xx | BRANCH.BUILD |
| 2024.1 | 241.xxxx.xx | BRANCH.BUILD |

Build number format: `YYR` where:
- `YY` = Year (24 = 2024)
- `R` = Release number within the year (1 = first, 2 = second, 3 = third)
- There is no `YY0` — `R` starts at 1

## Gradle Plugin Versions

| IntelliJ Platform Gradle Plugin | Minimum Gradle | Minimum Platform | Notes |
|--------------------------------|----------------|------------------|-------|
| 2.x (example current line: 2.13.1) | 8.13 | 2022.3 | Use 2.x for new projects; verify the exact plugin version in the official docs before pinning |
| 1.x (legacy) | 7.3 | — | Legacy only |

## SDK Migration (1.x to 2.x)

### build.gradle.kts Changes

**1.x (Legacy):**
```kotlin
plugins {
    id("java")
    id("org.jetbrains.intellij") version "1.17.3"
}

intellij {
    version.set("2023.2.5")
    type.set("IC")
    plugins.set(listOf("java"))
}

tasks {
    patchPluginXml {
        sinceBuild.set("232")
        untilBuild.set("232.*")
    }
}
```

**2.x (Current):**
```kotlin
plugins {
    id("java")
    id("org.jetbrains.intellij.platform") version "2.13.1"
}

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
    }
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "243"
        }
    }
}
```

### Key Differences

| Aspect | 1.x | 2.x |
|--------|-----|-----|
| Plugin ID | `org.jetbrains.intellij` | `org.jetbrains.intellij.platform` |
| IDE Version | `intellij.version` | `intellijPlatform { intellijIdea() }` |
| Plugins | `intellij.plugins` | `intellijPlatform { bundledPlugin() }` |
| Patching | `patchPluginXml` | `pluginConfiguration` |
| Repositories | Automatic | Explicit `intellijPlatform { defaultRepositories() }` |
| Verifier task | `runPluginVerifier` | `verifyPlugin` |
| instrumentationTools | Required | Deprecated / auto-applied |

### Migration Helper

A migration plugin `org.jetbrains.intellij.platform.migration` is available to help with the transition. Apply it alongside the old plugin to get migration assistance and warnings.

## API Compatibility

### Since/Until Build

```xml
<!-- plugin.xml -->
<idea-version since-build="243"/>
<!-- since-build is required -->
<!-- usually omit until-build for broad compatibility -->
<!-- when you intentionally ship separate plugin versions per major IDE line, 2025.3+ introduces strict-until-build -->
```

Use actual build numbers only. Do not invent branch or patch numbers. Multipart build numbers are valid when you need to target a specific bugfix baseline:

```xml
<!-- any 2021.3.x release -->
<idea-version since-build="213" until-build="213.*"/>

<!-- 2021.3.3 or later -->
<idea-version since-build="213.7172.25"/>
```

`since-build="233.*"` is invalid, and broad upper bounds should normally be left to Marketplace policy unless your release process truly ships one plugin version per IDE major line.

| Version | Build | Since |
|---------|-------|-------|
| 2026.1 | 261.xxx | 261 |
| 2025.3 | 253.xxx | 253 |
| 2025.2 | 252.xxx | 252 |
| 2025.1 | 251.xxx | 251 |
| 2024.3 | 243.xxx | 243 |
| 2024.2 | 242.xxx | 242 |
| 2024.1 | 241.xxx | 241 |
| 2023.3 | 233.xxx | 233 |
| 2023.2 | 232.xxx | 232 |
| 2023.1 | 231.xxx | 231 |

### Notable API Changes

Use the labels below literally:
- **Breaking API** — code/config changes are required for affected plugins
- **Notable change** — behavior or capabilities changed, but not always as a hard break
- **Migration note** — recommended transition guidance or tooling support

#### 2025.2
- Notable change: `LspCustomization` API becomes the customization path for newly introduced LSP features in 2025.2+
- Notable change: LSP inlay hints and folding range support arrive in 2025.2.2
- Migration note: the `plugin.xml` LSP dependency changes to `com.intellij.modules.lsp` in 2025.2.1 and later (earlier versions use `com.intellij.modules.ultimate`)

#### 2025.1
- Notable change: `ContainerUtil` methods marked `@Unmodifiable` now return truly unmodifiable collections (internal/test mode for now)
- Breaking API: Kotlin 2.x required for plugin compilation
- Notable change: K2 Kotlin mode enabled by default in IntelliJ IDEA
- Breaking API: Kotlin UI DSL v1 (`com.intellij.ui.layout` package) must not be used from 2025.1 — migrate to v2 (`com.intellij.ui.dsl.builder`)

#### 2024.3
- Breaking API: JSON plugin extracted — add `<depends>com.intellij.modules.json</depends>` and `bundledModule("com.intellij.modules.json")` in Gradle when your plugin relies on JSON support
- Breaking API: JUnit library unbundled — add explicit test dependency when your tests rely on it
- Notable change: `ParsingTestCase` now verifies reparsing causes no changes
- Notable change: Dumb-aware "Highlight Usages" support

#### 2024.2
- Notable change: Intention actions and quick-fixes can be `DumbAware`
- Migration note: Workspace Model APIs are increasingly favored over older project-model integrations in some areas
- Breaking API: `TabInfo` constructor requires non-null `JComponent`
- Notable change: `ToggleAction` no longer closes popups

#### 2024.1
- Notable change: Bundled localization capabilities for plugins
- Migration note: Kotlin coroutines are recommended for asynchronous code
- Notable change: Highlighting runs more efficiently (inspections and annotators in parallel)
- Notable change: Cached values interact with dumb mode

#### 2023.3
- Breaking API: Threading model enforcement tightened
- Breaking API: `commons-lang2` and `commons-collections` libraries removed from platform
- Breaking API: JsonPath library unbundled
- Notable change: External annotators can run in dumb mode

#### 2023.2
- Notable change: Language Server Protocol (LSP) API introduced
- Notable change: Inspection descriptions support syntax-highlighted code snippets

#### 2023.1
- Notable change: Declarative inspection options
- Notable change: `DocumentationTarget` API for quick documentation (replaces `lang.documentationProvider`)
- Notable change: `@ApiStatus.Obsolete` annotation introduced
- Notable change: Annotators can implement `DumbAware` (run during indexing)

## Language Level Compatibility

| IntelliJ Platform | Java | Bundled Kotlin stdlib |
|-------------------|------|-----------------------|
| 2026.1 | 21 | 2.3.20 |
| 2025.3 | 21 | 2.2.20 |
| 2025.2 | 21 | 2.1.20 |
| 2025.1 | 21 | 2.1.10 |
| 2024.3 | 21 | 2.0.21 |
| 2024.2 | 21 | 1.9.24 |
| 2024.1 | 17 | 1.9.22 |
| 2023.3 | 17 | 1.9.21 |
| 2023.2 | 17 | 1.8.20 |
| 2023.1 | 17 | 1.8.0 |

Kotlin 2.x is recommended for plugins targeting 2024.3+ and **required** for 2025.1+. Plugins supporting multiple platform versions must target the lowest bundled stdlib version.

## Target IDE Compatibility

### Plugin Targets

| IDE | Gradle Dependency | Notes |
|-----|-------------------|-------|
| IntelliJ IDEA | `intellijIdea()` | IntelliJ IDEA target; 2025.3+ uses the unified product helper instead of deprecated `IC` |
| PyCharm | `pycharm()` | PyCharm target; product-line details vary by platform version and 2025.3+ uses the unified helper instead of deprecated `PC` |
| WebStorm | `webstorm()` | JavaScript IDE |
| PhpStorm | `phpstorm()` | PHP IDE |
| GoLand | `goland()` | Go IDE |
| Rider | `rider()` | .NET IDE |
| CLion | `clion()` | C/C++ IDE |
| DataGrip | `datagrip()` | Database IDE |
| RubyMine | `rubymine()` | Ruby IDE |
| RustRover | `rustRover()` | Rust IDE |
| Android Studio | `androidStudio()` | Android IDE |

**2025.3+ type changes:** `IntellijIdeaCommunity` (`IC`) and `PyCharmCommunity` (`PC`) are deprecated as dependency targets for 2025.3+. Use `intellijIdea()` and `pycharm()` for the unified product targets instead.

### Dependency Declaration

```xml
<!-- For cross-platform plugins -->
<depends>com.intellij.modules.platform</depends>

<!-- For Java-specific plugins -->
<depends>com.intellij.modules.java</depends>

<!-- For Python-specific plugins -->
<depends optional="true" config-file="withPython.xml">PythonCore</depends>

<!-- For JavaScript-specific plugins -->
<depends optional="true" config-file="withJavaScript.xml">JavaScript</depends>
```

## Testing Compatibility

### Test Dependencies (2.x)

```kotlin
dependencies {
    intellijPlatform {
        intellijIdea("2024.3")
        testFramework(TestFrameworkType.Platform)
        testFramework(TestFrameworkType.Plugin.Java)
    }

    testImplementation("junit:junit:4.13.2")
}
```

## Breaking Changes Log

### 2022.3
- Notable: `ActionUpdateThread` — `getActionUpdateThread()` is required when targeting 2022.3 or later
- Threading model enforcement begins

## Migration Checklist

### From 1.x to 2.x

- [ ] Update plugin ID to `org.jetbrains.intellij.platform`
- [ ] Add `intellijPlatform { defaultRepositories() }` in repositories
- [ ] Move IDE version to `dependencies { intellijPlatform { intellijIdea("...") } }`
- [ ] Update bundled plugin dependencies syntax
- [ ] Update `patchPluginXml` to `pluginConfiguration`
- [ ] Update test dependencies (`testFramework(TestFrameworkType.Platform)`)
- [ ] Verify Gradle version (8.13+ required for 2.x)
- [ ] Note: `runPluginVerifier` task renamed to `verifyPlugin` in 2.x
- [ ] Test plugin functionality

### General Version Updates

- [ ] Update `since-build`
- [ ] Only add `until-build` / `strict-until-build` when the release strategy actually requires an upper bound
- [ ] Check deprecated API usage
- [ ] Update Kotlin/Java language level if needed
- [ ] Run plugin verifier
- [ ] Test on target IDE versions
- [ ] Update changelog

## Plugin Verifier

Configure IDE versions for verification in `build.gradle.kts`:

```kotlin
intellijPlatform {
    pluginVerification {
        ides {
            recommended()
            // or specific versions:
            // create(IntelliJPlatformType.IntellijIdeaCommunity, "2024.2")
            // Note: ide() was renamed to create() in Gradle Plugin 2.7.0+
            // create(IntelliJPlatformType.IntellijIdeaCommunity, "2024.3")
        }
    }
}
```

Then run:

```bash
./gradlew verifyPlugin
```

Note: In 1.x, the task was called `runPluginVerifier`. In 2.x, IDE versions are configured in the build script, not via CLI parameters.
