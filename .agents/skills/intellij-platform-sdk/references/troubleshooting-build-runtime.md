# Build, Runtime, and Verification Troubleshooting

Use this reference when the problem is about Gradle setup, dependency resolution, runtime class loading, action registration, service initialization, verifier warnings, or release-time failures.

## Build issues

### `Could not resolve org.jetbrains.intellij.platform`

A common cause is incomplete plugin repositories.

```kotlin
repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}
```

### `Plugin [id: 'org.jetbrains.intellij.platform'] was not found`

Common checks:

- the plugin version exists and is spelled correctly
- Gradle plugin resolution / plugin management is configured correctly
- Gradle version is high enough for the selected plugin version
- the project is resolving plugins from the expected plugin repositories

If the project uses `dependencyResolutionManagement` and you want to declare IntelliJ Platform repositories in `settings.gradle.kts`, the separate settings plugin can be part of that setup:

```kotlin
plugins {
    id("org.jetbrains.intellij.platform.settings") version "2.13.1" // example version
}
```

That settings plugin is not a universal fix for every `org.jetbrains.intellij.platform` resolution failure; use it only when the build layout actually needs settings-level repository configuration.

### Bundled plugin not found

Use the correct bundled plugin ID for the selected IDE.

```kotlin
dependencies {
    intellijPlatform {
        intellijIdea("2024.3")
        bundledPlugin("com.intellij.java")
    }
}
```

## Runtime issues

### `ClassNotFoundException`

Common causes to check:

1. class/package name in `plugin.xml`
2. source-set placement
3. whether the dependency/module/plugin is actually available at runtime

### Service initialization failed

Common causes:

- missing `@Service`
- wrong service level
- constructor doing too much work
- circular dependency chains

Preferred pattern:

```java
@Service(Service.Level.PROJECT)
public final class MyProjectService {
    private final Project project;

    public MyProjectService(Project project) {
        this.project = project;
    }
}
```

### Extension point class not found

Check:

- correct EP namespace
- required module/plugin dependency exists
- target IDE actually contains that EP

## Action issues

### Action not visible

Common checks:

1. `plugin.xml` registration is correct
2. target action group exists
3. `update()` sets visibility and enabled state correctly

```java
@Override
public void update(@NotNull AnActionEvent e) {
    e.getPresentation().setEnabledAndVisible(e.getProject() != null);
}
```

### Missing `getActionUpdateThread()` warning

When targeting IntelliJ Platform 2022.3 or later, actions must implement `getActionUpdateThread()`. Choose the thread based on what `update()` reads:

- `BGT` for PSI/VFS/project-model reads
- `EDT` for direct Swing/UI state access

A common modern choice is:

```java
@Override
public @NotNull ActionUpdateThread getActionUpdateThread() {
    return ActionUpdateThread.BGT;
}
```

### Slow action updates / UI freeze

Move heavy work out of `update()` and into `actionPerformed()` or background execution.

## Plugin verifier

### Typical verifier problems

- internal API usage
- deprecated API usage
- missing or wrong build range
- unavailable dependency/plugin classes on some target IDEs

Run:

```bash
./gradlew verifyPlugin
```

Then inspect the generated report under `build/reports/pluginVerifier/`.

### Internal API usage warnings

Prefer public APIs. Only fall back to internal APIs when the tradeoff is explicit and justified.

## Release-time checks

Before publishing, verify:

- signing inputs are present
- verifier is clean enough for target IDEs
- `sinceBuild`/`untilBuild` are realistic
- optional dependencies are truly optional in code paths

## Common error messages

### `Cannot create class`

One common cause is a constructor, signature, dependency, or classloading problem. Also check whether the class is abstract, has the wrong constructor shape for the extension point/service, or depends on an unavailable module/plugin at runtime.

### `Extension implementation class not found`

Common causes include a wrong fully qualified class name or an unavailable dependency.

### IDE dependency type deprecated (2025.3+)

If using `IntellijIdeaCommunity` (`IC`) or `PyCharmCommunity` (`PC`) as dependency target for 2025.3+, switch to the unified `intellijIdea()` / `pycharm()` helpers.

### `Service configuration is missing`

If the service is not a light service, check whether it needs to be declared in `plugin.xml`. If it is intended to be a light service, verify `@Service`, the service level, and constructor shape instead of adding XML blindly.

## See also

- `getting-started.md`
- `compatibility.md`
- `extension_points.md`
- `testing-and-publishing.md`
- `lsp.md`
