# Language Server Protocol (LSP)

Use this reference when the user wants to integrate a Language Server into an IntelliJ-based plugin.

## What this file covers

- IDE availability and restrictions
- Gradle and plugin.xml setup
- implementing `LspServerSupportProvider` and `LspServerDescriptor`
- status bar integration
- customization
- supported feature timeline
- troubleshooting

## IDE availability

LSP support in the IntelliJ Platform requires targeting platform version `2023.2` or later. It is not available in:

- IntelliJ IDEA Community Edition
- Android Studio

For other JetBrains IDE products, availability depends on the target IDE product and platform version documented for the IntelliJ Platform LSP API. Use the official LSP documentation for the exact IDE/version combination you are targeting rather than assuming a generic "commercial IDE only" rule.

## When to use LSP vs. native language support

LSP provides faster time-to-market for language features but offers a narrower range of IDE integration compared to the native custom language support stack. Use LSP when:

- an existing Language Server is available and well-maintained
- full native integration is not justified by the target audience size
- the plugin needs to support a language where building PSI/parser from scratch is impractical

LSP should not be considered a replacement for the native API but rather a complement. Native support still wins for deep IDE integration (refactoring, project model, debugger, etc.).

## Setup

### Gradle build script

```kotlin
plugins {
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
        // Target an IDE product/version combination that supports the IntelliJ Platform LSP API
        intellijIdea("2024.3")
    }
}
```

### plugin.xml dependency

The required module dependency changed in 2025.2.1:

```xml
<!-- 2025.2.1 and later -->
<depends>com.intellij.modules.lsp</depends>

<!-- Before 2025.2.1 -->
<depends>com.intellij.modules.ultimate</depends>
```

### IDE sources setup

Since 2024.2, LSP API sources are included in the `IntelliJ IDEA sources` artifact. For earlier versions, sources are bundled at `$IDEA_INSTALLATION$/lib/src/src_lsp-openapi.zip` and must be attached manually.

## Basic implementation

A minimal LSP plugin requires two classes:

### LspServerSupportProvider

```kotlin
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.LspServerStarter

class FooLspServerSupportProvider : LspServerSupportProvider {
    override fun fileOpened(
        project: Project,
        file: VirtualFile,
        serverStarter: LspServerStarter
    ) {
        if (file.extension == "foo") {
            serverStarter.ensureServerStarted(FooLspServerDescriptor(project))
        }
    }
}
```

### LspServerDescriptor

```kotlin
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor

private class FooLspServerDescriptor(
    project: Project
) : ProjectWideLspServerDescriptor(project, "Foo") {

    override fun isSupportedFile(file: VirtualFile) =
        file.extension == "foo"

    override fun createCommandLine() =
        GeneralCommandLine("foo", "--stdio")
}
```

### Registration

```xml
<extensions defaultExtensionNs="com.intellij">
    <platform.lsp.serverSupportProvider
        implementation="com.example.FooLspServerSupportProvider"/>
</extensions>
```

Register this extension point only for plugin targets that actually support the LSP API, and pair it with the correct `plugin.xml` module dependency for the target platform line.

## Status bar integration (since 2024.1)

A dedicated Language Services status bar widget shows the status of all LSP servers. Override `createLspServerWidgetItem()` in your `LspServerSupportProvider`:

```kotlin
override fun createLspServerWidgetItem(
    lspServer: LspServer,
    currentFile: VirtualFile?
) = LspServerWidgetItem(
    lspServer, currentFile,
    FooIcons.PluginIcon, FooConfigurable::class.java
)
```

If there are configuration problems preventing server startup, provide a widget item with an error and a hint for the user.

## Customization

### 2025.2 and later

Return a customized `LspCustomization` object from `LspServerDescriptor.lspCustomization` property. New LSP features are only customizable via this API.

### Before 2025.2

Override corresponding properties of `LspServerDescriptor` directly.

The old API remains backward-compatible in 2025.2, but new features require `LspCustomization`.

### Custom requests and notifications

- **Receiving**: Override `LspServerDescriptor.createLsp4jClient()` and extend `Lsp4jClient`
- **Sending**: Override `LspServerDescriptor.lsp4jServerClass` and implement `LspClientNotification` / `LspRequest`

## Language Server delivery

Two approaches:

1. **Bundle the binary** with the plugin as a resource (e.g., a Node.js script). Example: Prisma ORM plugin ships `prisma-language-server.js`.
2. **User-provided path** — let users configure the Language Server binary location via a Settings page.

## Integration considerations

Before recommending LSP, check these tradeoffs:

- **OS/runtime dependency** — the server may require Node.js, Java, Python, or a native binary on the user machine
- **version availability** — some features appear only in point releases, not the initial `.0` release
- **breaking change tolerance** — LSP support evolves across IDE versions; verify the minimum IDE version carefully
- **server delivery model** — decide whether the plugin bundles the server or asks the user for a binary path
- **native vs. LSP depth** — if the user needs deep refactoring, debugger, or project-model integration, native language support may still be a better fit

## Supported features timeline

| Version | Features |
|---------|----------|
| 2023.2 | Diagnostics, quick-fixes, completion, go to definition (StdIO) |
| 2023.3 | Intentions/code actions, formatting, request cancellation |
| 2023.3.2 | Quick documentation, file watcher |
| 2024.1 | Socket communication, executeCommand, applyEdit, showDocument, status bar widget |
| 2024.2 | Find usages, completionItem/resolve, codeAction/resolve |
| 2024.2.2 | Semantic highlighting |
| 2024.3 | Color preview |
| 2024.3.1 | didSave notification, go to type declaration |
| 2025.1 | Document link |
| 2025.1.2 | Pull diagnostics (enabled by default in 2025.2) |
| 2025.2 | LSP customization API |
| 2025.2.2 | Inlay hints, folding range |
| 2025.3 | Server-initiated progress, highlight usages, go to symbol, file structure, breadcrumbs, sticky lines, parameter info |
| 2025.3.1 | Selection range, call hierarchy, type hierarchy |
| 2026.1 | Range formatting, code lens, organize imports |

## Troubleshooting

Enable debug logging for LSP communication:

In `Help | Diagnostic Tools | Debug Log Settings…`, add:

```
#com.intellij.platform.lsp
```

All IDE and LSP server communication is then logged to the IDE log file.

## Sample plugins

- [Prisma ORM](https://plugins.jetbrains.com/plugin/20686-prisma-orm) — bundled Language Server with Node.js
- Explore more on [IntelliJ Platform Explorer](https://jb.gg/ipe?extensions=com.intellij.platform.lsp.serverSupportProvider)

## When to also read other references

- Read `language-support-and-analysis.md` for native custom language support (deeper IDE integration)
- Read `getting-started.md` for Gradle and plugin.xml setup basics
- Read `compatibility.md` for IDE version requirements
