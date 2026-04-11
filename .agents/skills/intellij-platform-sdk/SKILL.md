---
name: intellij-platform-sdk
description: >
  IntelliJ Platform plugin development with the v2 SDK / IntelliJ Platform Gradle Plugin 2.x.
  Use this skill when the task is clearly about building, configuring, debugging, testing, or publishing
  a plugin for JetBrains IDEs such as IntelliJ IDEA, WebStorm, PyCharm, GoLand, Rider, CLion,
  PhpStorm, DataGrip, or Android Studio. Trigger when the user is working in an IntelliJ Platform
  plugin context and mentions plugin.xml, org.jetbrains.intellij.platform, AnAction, PSI,
  LocalInspectionTool, CompletionContributor, ParserDefinition, ToolWindowFactory,
  PersistentStateComponent, extension points, plugin verifier, Marketplace publishing,
  custom language support, or IntelliJ Platform Gradle Plugin 2.x setup/migration.
  Do not trigger for general JetBrains IDE usage, ordinary run configurations, generic logging,
  generic Gradle questions, or language-server discussions outside IntelliJ plugin development.
---

# IntelliJ Platform SDK Skill

Use this skill for **IntelliJ Platform plugin development** based on the modern **v2 SDK**.

This skill is intentionally split into focused references so the main file stays small and the model can load only the material relevant to the task.

## What this skill helps with

- creating or updating IntelliJ Platform plugins
- configuring `build.gradle.kts`, `settings.gradle.kts`, and `plugin.xml`
- implementing actions, services, tool windows, settings, and notifications
- working with PSI, references, indexing, VFS, and dumb mode
- building custom language support
- implementing inspections, intentions, quick fixes, completion, formatting, and documentation
- testing plugins and preparing Marketplace publication
- handling version compatibility and Gradle plugin migration

## How to use this skill

First, identify the user’s real task. Then read only the relevant reference files.

### Read `references/getting-started.md` when the task is about

- creating a new IntelliJ Platform plugin project
- setting up IntelliJ Platform Gradle Plugin 2.x for a plugin project
- choosing target IDEs or bundled plugins for plugin development
- adding optional plugin/module dependencies in `plugin.xml`
- writing or fixing plugin-project `plugin.xml` metadata

### Read `references/platform-basics.md` when the task is about

- `AnAction`, action groups, menus, toolbars
- services (`@Service`, project/application/module services)
- logging (`Logger`, `logger<T>()`, `thisLogger()`)
- background tasks (`Task.Backgroundable`, `ProgressManager`, `ProgressIndicator`)
- Virtual File System (`VirtualFile`, VFS listeners)
- threading, read/write actions, dumb mode, modality
- Kotlin coroutine patterns in plugins (`readAction`, `writeAction`, `CoroutineScope`)
- dynamic plugin loading/unloading
- disposable lifecycle management
- messaging infrastructure (`MessageBus`, `Topic`)
- general plugin architecture decisions

### Read `references/psi-and-indexing.md` when the task is about

- PSI traversal or modification
- references, resolve, rename, find usages, safe delete
- code generation using PSI factories
- file-based indexes, stub indexes, gists, file view providers
- `IndexNotReadyException`, dumb mode, PSI performance
- PSI cookbook (Java-specific common operations)
- caching with `CachedValuesManager`

### Read `references/language-support-and-analysis.md` when the task is about

- custom language plugins
- lexer, parser, `ParserDefinition`
- syntax highlighting, annotators, completion
- inspections, intentions, quick fixes
- rename refactoring, rename validation, safe delete
- formatter, folding, structure view, documentation provider
- parameter info, spell checking, navigation bar integration
- inlay hints, code vision
- language injection
- Symbols API and declarations/references model
- Poly Symbols and Web Types for web-framework metadata
- DocumentationTarget API
- `OptPane`, declarative inspection options, `OptionController`

### Read `references/ui-settings-and-toolwindows.md` when the task is about

- Kotlin UI DSL v2 (`panel { row { } }`, `BoundConfigurable`)
- dialogs and IntelliJ UI components
- tool windows
- settings/configurables
- persistent state
- notifications
- popups (`JBPopup`, `ListPopup`, chooser popups)
- new project wizard, module type, project view integration
- status bar widgets
- editor notification banners
- persisting sensitive data (`PasswordSafe`)
- embedded editor components (`EditorTextField`)

### Read `references/testing-and-publishing.md` when the task is about

- test fixtures and plugin tests
- integration tests or UI tests
- Starter/Driver-based test setup
- parser/completion/inspection tests
- plugin verifier
- `verifyPluginProjectConfiguration` / `verifyPluginStructure`
- signing and publishing to Marketplace

### Read `references/compatibility.md` when the task is about

- build compatibility
- `sinceBuild` / `untilBuild`
- migrating from legacy Gradle plugin 1.x to 2.x
- API changes across platform versions
- Java/Kotlin version expectations
- Workspace Model migration or newer platform API transitions

### Read `references/extension_points.md` when the task is about

- exact `plugin.xml` registration syntax
- locating the right extension point
- action group IDs and XML patterns
- MCP extension points such as `com.intellij.mcpServer.*`

### Read `references/code_samples.md` when the task is about

- finding the closest official SDK sample
- copying an official implementation pattern
- understanding what each JetBrains sample demonstrates

### Read `references/lsp.md` when the task is about

- integrating a Language Server into an IntelliJ Platform plugin
- `LspServerSupportProvider`, `LspServerDescriptor`, or LSP-specific `plugin.xml` dependencies
- LSP setup for supported JetBrains IDE products and platform versions in plugin-development context
- LSP feature support timeline inside the IntelliJ Platform
- deciding between LSP integration and native IntelliJ language support for a plugin

### Read `references/mcp-and-ai-integration.md` when the task is about

- MCP-related plugin integration in an IntelliJ Platform plugin
- contributing MCP tools or defining MCP toolsets
- understanding MCP-related extension points such as `com.intellij.mcpServer.*`
- MCP guidance in areas where the official SDK docs are still sparse

### Read `references/patterns.md` when the task is about

- reusable implementation patterns
- editor/document helpers
- progress handling
- dialog/tool-window patterns
- PSI/editor/VFS utilities

### Read `references/troubleshooting.md` when the task is about

- you are not yet sure which troubleshooting bucket the issue belongs to
- actions not appearing
- threading assertions
- service initialization failures
- PSI write-action errors
- verifier warnings
- test setup failures

### Read `references/troubleshooting-build-runtime.md` when the task is about

- Gradle or repository resolution failures
- `plugin.xml` wiring or class loading issues
- action registration/runtime visibility issues
- verifier/signing/release failures

### Read `references/troubleshooting-psi-ui-testing.md` when the task is about

- PSI validity or write-action assertions
- `IndexNotReadyException`
- editor/document synchronization
- UI refresh or EDT access errors
- fixture/test-data/debugging problems

## Working principles

When solving IntelliJ Platform tasks:

1. Prefer **official platform concepts** over ad-hoc hacks.
2. Put reusable logic in **services**, not in actions.
3. Keep `AnAction.update()` **extremely fast**.
4. Respect **threading and dumb mode** before optimizing behavior.
5. Use **PSI-aware** approaches for structural code tasks.
6. Use **platform UI components** and conventions for user-facing surfaces.
7. Keep plugin dependencies and target IDE scope as small as practical.

## High-value reminders

- `AnAction` implementations should not store request-specific state in fields.
- When targeting IntelliJ Platform 2022.3 or later, actions must implement `getActionUpdateThread()`.
- PSI modifications must run on EDT inside a write action and command; coordinate document changes with the PSI/document APIs used by the platform.
- Not every feature is safe in dumb mode; do not mark things `DumbAware` casually.
- For Kotlin plugins targeting 2024.1+ or newer platform baselines, prefer coroutine-based read/write APIs when appropriate.
- Light services must be `final`; constructor injection of dependency services is unsupported, and services should not be looked up in constructors only to cache them in fields.
- Avoid internal APIs unless there is no viable public alternative and the tradeoff is explicit.

## Typical response strategy

When a user asks for implementation help:

1. Determine the feature surface: action, service, PSI, UI, language support, test, or publishing.
2. Read the matching reference files.
3. Follow the closest official sample or extension-point pattern.
4. Implement the smallest correct solution that matches IntelliJ Platform rules.
5. If publishing or compatibility matters, also review verifier/signing/build-range concerns.

## Reference map

- `references/getting-started.md`
- `references/platform-basics.md`
- `references/psi-and-indexing.md`
- `references/language-support-and-analysis.md`
- `references/ui-settings-and-toolwindows.md`
- `references/testing-and-publishing.md`
- `references/compatibility.md`
- `references/extension_points.md`
- `references/code_samples.md`
- `references/lsp.md`
- `references/mcp-and-ai-integration.md`
- `references/patterns.md`
- `references/troubleshooting.md`
- `references/troubleshooting-build-runtime.md`
- `references/troubleshooting-psi-ui-testing.md`
