# Troubleshooting Index

Use this file as a routing guide instead of loading every troubleshooting note at once.

## Read `troubleshooting-build-runtime.md` when the issue is about

- Gradle sync or dependency resolution
- v2 SDK setup problems
- class loading / runtime wiring
- action visibility or registration
- service initialization
- verifier warnings
- signing or release failures

## Read `troubleshooting-psi-ui-testing.md` when the issue is about

- PSI validity or write-action assertions
- `IndexNotReadyException`
- editor/document coordination
- UI refresh or EDT errors
- memory leaks / disposables
- fixture setup and test data
- local debugging inside sandbox IDE

## Quick heuristics

- if the build fails before IDE launch, start with build/runtime troubleshooting
- if the plugin loads but behavior fails at PSI/editor/UI time, start with PSI/UI/testing troubleshooting
- if release or compatibility warnings appear, start with build/runtime troubleshooting, then cross-check `compatibility.md`
- if the LSP server does not start or communication looks wrong, read the `lsp.md` troubleshooting section directly

## Symptom-based routing

- repository resolution fails, Gradle sync breaks, or signing/verifier tasks fail → `troubleshooting-build-runtime.md`
- `plugin.xml` wiring, class loading, action registration, or service initialization fails → `troubleshooting-build-runtime.md`
- `IndexNotReadyException`, PSI invalidation, write-action errors, or EDT assertions → `troubleshooting-psi-ui-testing.md`
- editor/document state looks wrong, UI does not refresh, or tests/debugging in sandbox IDE are failing → `troubleshooting-psi-ui-testing.md`
