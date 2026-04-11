# MCP Integration

Use this reference when the user is building an IntelliJ Platform plugin that integrates with the MCP-related plugin surface in supported IDE builds, contributes MCP tools, or defines MCP toolsets.

## What this file covers

- currently usable MCP-related plugin extension points
- how to reason about MCP-related platform/plugin surfaces vs external MCP plugins
- safe guidance boundaries when official narrative docs are still sparse
- what this reference does and does not cover

## Current platform shape

MCP integration is a real plugin-development topic, but it is not a broad, version-agnostic IntelliJ Platform surface.

For practical plugin work, treat the MCP surface as:

- product- and build-specific
- narrower than a full AI Assistant extension API
- centered on contributing tools and toolsets

The MCP-related extension points to rely on here are:

- `com.intellij.mcpServer.mcpToolsProvider`
- `com.intellij.mcpServer.mcpToolset`

Do not assume additional MCP extension points are available unless they are confirmed in the exact target IDE build you support.

## Scope boundary

This reference is intentionally narrow.

It covers:

- MCP-related extension points available in supported IDE builds
- cautious implementation guidance for MCP tool contribution and toolset organization

It does not claim to document a full public AI Assistant extension API. If the user asks about deeper AI Assistant-specific APIs or undocumented AI integrations, verify product/version support before suggesting an implementation.

## MCP-related extension points

### `mcpToolsProvider`

Use this when the plugin needs to contribute MCP tools.

Typical fit:

- exposing IDE-aware operations to MCP clients
- registering callable tools backed by platform services or project logic
- contributing tool metadata and execution hooks

### `mcpToolset`

Use this when the plugin needs to group or organize MCP capabilities as a named toolset.

Typical fit:

- packaging a coherent tool family
- separating capabilities by domain
- contributing discoverable grouped functionality instead of many unrelated standalone tools

## Practical guidance

When the user asks for MCP integration help:

1. Confirm the target IDE and platform version first.
2. Check whether the built-in MCP support exists in that product/version line.
3. Use the exact extension-point names supported by that target build.
4. Keep tool logic in services, not in extension constructors.
5. Keep extension implementations stateless and lightweight.
6. Treat tool availability and registration as version-scoped, not universal.
7. If public documentation is thin, avoid inventing contracts that are not clearly established.

## Architecture guidance

### Prefer service-backed tool implementations

Put real business logic in project/application services and let MCP-facing extensions adapt that logic to the MCP surface. This keeps tool registration lightweight and makes ordinary testing easier.

### Validate context at the boundary

MCP tools expose project actions to an external protocol boundary. Validate user-controlled or protocol-controlled inputs carefully and avoid assuming file, project, or editor context is always present.

### Keep product/version assumptions explicit

Do not assume MCP availability across every JetBrains IDE or across old platform baselines. Treat this similarly to LSP or other product/version-scoped capabilities.

### Prefer conservative wording for undocumented contracts

Good wording patterns:

- "This extension point is available in the target IDE build."
- "The likely role is tool contribution or toolset organization."
- "Confirm exact interface behavior in the target build before implementing production logic."

Avoid stronger claims unless you have verified the exact declaration or implementation in the target platform build.

## Relationship to other references

- Read `getting-started.md` for Gradle and `plugin.xml` basics.
- Read `platform-basics.md` for services, threading, disposables, and message bus guidance.
- Read `extension_points.md` for plugin.xml registration patterns.
- Read `compatibility.md` when platform-version or product availability matters.
- Read `lsp.md` only if the user is actually integrating a Language Server; MCP and LSP are different integration surfaces.

## Important caveat

Because the public SDK docs are currently sparse here, do not overstate undocumented behavior.

Prefer wording like:

- "This extension point is available in the target IDE build"
- "The likely role is tool contribution or toolset organization"
- "Confirm the exact interface contract before implementing production logic"
