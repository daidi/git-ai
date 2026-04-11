# Testing and Publishing

Use this reference when the user needs fixture-based tests, integration/UI tests, parser tests, code-insight tests, plugin verification, signing, or Marketplace release steps.

## What this file covers

- light and heavy tests
- fixture-based code insight testing
- integration and UI testing with Starter/Driver
- parser/completion/inspection tests
- plugin verifier
- signing and publishing

## Testing strategy

Choose the lightest test type that still matches the feature.

### Common test bases

- `BasePlatformTestCase` — fixture-based light tests for many PSI/editor/plugin features
- `LightPlatformTestCase` — non-fixture light tests when you do not need `myFixture`
- `LightJavaCodeInsightFixtureTestCase` — Java-specific code insight tests; also available as `LightJavaCodeInsightFixtureTestCase4` (JUnit 4) and `LightJavaCodeInsightFixtureTestCase5` (JUnit 5)
- `HeavyPlatformTestCase` — heavier project/platform environment when light tests are insufficient
- `IdeaTestFixtureFactory` — manual fixture creation when a base class is not the best fit

### Integration and UI testing

Use IntelliJ Platform Starter/Driver when the test must boot a fuller IDE environment, exercise plugin workflows end to end, or interact with real UI surfaces such as tool windows, dialogs, configurables, or notifications.

- **Starter** — prepares the IDE, test project, and test execution environment
- **Driver** — provides higher-level UI interaction and automation support
- **JUnit 5 only** — the Starter-based integration/UI testing path is built for JUnit 5, not JUnit 4

A typical Gradle setup also creates a dedicated `integrationTest` source set and configuration, not just the Starter dependency:

```kotlin
sourceSets {
    create("integrationTest") {
        compileClasspath += sourceSets.main.get().output
        runtimeClasspath += sourceSets.main.get().output
    }
}

val integrationTestImplementation by configurations.getting {
    extendsFrom(configurations.testImplementation.get())
}

dependencies {
    intellijPlatform {
        testFramework(TestFrameworkType.Starter, configurationName = "integrationTestImplementation")
    }

    integrationTestImplementation("org.junit.jupiter:junit-jupiter:5.7.1")
    integrationTestImplementation("org.kodein.di:kodein-di-jvm:7.20.2")
    integrationTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.10.1")
}

val integrationTest by intellijPlatformTesting.testIdeUi.registering {
    task {
        val integrationTestSourceSet = sourceSets.getByName("integrationTest")
        testClassesDirs = integrationTestSourceSet.output.classesDirs
        classpath = integrationTestSourceSet.runtimeClasspath
        useJUnitPlatform()
    }
}
```

Current official Starter intro examples explicitly add `org.kodein.di:kodein-di-jvm` and `org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm` alongside `testFramework(TestFrameworkType.Starter)`. Treat those as part of the documented Starter setup pattern unless the official example for your target platform line says otherwise.

Prefer fixture-based tests for PSI, parser, completion, inspection, and other focused code-insight behavior. Move to Starter/Driver when fidelity matters more than speed.

## When to use what

- PSI/editor feature in a lightweight environment → light fixture test
- Java-specific editor/code insight behavior → `LightJavaCodeInsightFixtureTestCase`
- parser snapshots / PSI tree expectations → extend `ParsingTestCase` from `com.intellij.testFramework`
- full project / heavier platform behavior → `HeavyPlatformTestCase`
- end-to-end plugin workflow or UI interaction → Starter/Driver-based integration or UI test

## Typical test flows

### Inspection test

- configure file text or test data file
- enable inspection
- run highlighting
- assert messages/ranges/fixes

### Completion test

- configure caret position
- invoke completion
- inspect lookup items or inserted result

### Rename / usages test

- place caret on symbol
- invoke rename/find usages
- assert affected files or results

### Parser test

- load `.simple`/custom-language input
- compare produced PSI tree to expected output

## Test-data conventions

Keep stable fixtures under `src/test/testData` and prefer readable before/after files for inspections, intentions, and formatting behavior. For Java/code-insight style tests, common conventions include `*.java` and `*.after.java` pairs for before/after comparisons, plus XML-like markup tags such as `<warning descr="...">code</warning>` for highlighting assertions. Other languages or plugin types may use different fixture naming and assertion styles.

Useful fixture APIs to remember:
- `myFixture.configureByText()` / `configureByFile()`
- `myFixture.checkResultByFile()`
- `myFixture.testHighlighting()` / `checkHighlighting()`
- `myFixture.complete()`
- `myFixture.findSingleIntention()` / `launchAction()`
- `myFixture.renameElementAtCaret()`
- `myFixture.findUsages()`

When tests need a custom SDK, libraries, or facets, use `LightProjectDescriptor` or manual fixture builders from `IdeaTestFixtureFactory`. For JVM-language tests, `DefaultLightProjectDescriptor` and helpers such as `withRepositoryLibrary()` can reduce custom setup boilerplate. Since 2024.2, do not forget explicit test framework dependencies in Gradle.

## Verifier and compatibility checks

Include plugin verification whenever the task involves shipping, Marketplace publication, or IDE-version compatibility.

### For 2.x projects

```bash
./gradlew verifyPlugin
./gradlew verifyPluginStructure
./gradlew verifyPluginProjectConfiguration
```

### For legacy 1.x projects

```bash
./gradlew runPluginVerifier
```

If multiple IDE versions matter, verify against all intended targets.

- Use `verifyPlugin` to run IntelliJ Plugin Verifier against target IDE builds.
- Use `verifyPluginStructure` when the built ZIP/JAR layout or plugin metadata may be malformed.
- Use `verifyPluginProjectConfiguration` when Gradle/plugin setup may be inconsistent (repositories, dependencies, runtime, Kotlin stdlib, JBR, etc.).

## Signing and publishing

A common plugin delivery flow includes some combination of:

1. build plugin
2. sign plugin
3. verify plugin
4. publish to JetBrains Marketplace

Typical tasks:

```bash
./gradlew buildPlugin
./gradlew signPlugin
./gradlew verifyPlugin
./gradlew publishPlugin
```

When signing inputs are configured, `publishPlugin` runs the required signing step automatically before publishing. Run `signPlugin` explicitly when you want to validate signing output or debug signing configuration separately.

## Signing inputs

Configure signing and publishing in `build.gradle.kts` using the 2.x DSL:

```kotlin
intellijPlatform {
    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        // or: certificateChainFile = file("/path/to/chain.crt")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        // or: privateKeyFile = file("/path/to/private.pem")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }
    publishing {
        token = providers.gradleProperty("intellijPlatformPublishingToken")
        // or environment variable: ORG_GRADLE_PROJECT_intellijPlatformPublishingToken
        channels = listOf("beta")
    }
}
```

Do not hardcode secrets into Gradle files or committed properties. Use environment variables or Gradle properties passed at build time.

Common release channels include `default`, `alpha`, `beta`, `eap`, and custom channels. The first Marketplace upload must always be manual; automated publishing applies only after the plugin has already been published to Marketplace once.

## Release guidance

Before release, verify:

- **First-time upload must be manual** — publish the initial Marketplace version by hand before relying on automated releases
- if signing is configured, understand that `publishPlugin` will trigger the required signing step automatically
- `sinceBuild` / `untilBuild` are sensible
- required dependencies are correct
- optional integrations degrade gracefully
- tests cover the changed behavior, including integration/UI coverage when the feature depends on real IDE workflows
- verifier is clean or warnings are understood

## When to also read other references

- Read `compatibility.md` for version migration or build-range advice
- Read `troubleshooting.md` for failing tests, verifier warnings, or signing problems
- Read `code_samples.md` for sample-based test and publishing patterns
