# Commit-message evaluation

`git-ai-eval` is a maintainer-only benchmark. It does not install hooks,
rewrite commits, update refs, or write application state. The embedded v2
dataset contains exact diffs or focused excerpts from ten public `git-ai`
commits, together with curated rough hints, reference messages, and explicit
semantic expectations. It covers all four output formats, Simplified Chinese,
a rename, and binary-only changes.

Run the deterministic reference self-check:

```bash
cd cli
go run ./cmd/git-ai-eval --mode reference --fail-under 100
```

Measure how much information the original rough hints contain:

```bash
go run ./cmd/git-ai-eval --mode original
```

Evaluate the model and provider from the existing merged Git AI configuration
(user settings plus repository-local overrides):

```bash
go run ./cmd/git-ai-eval --mode live --fail-under 85
```

Live mode sends the fixture diffs to the configured provider. It runs cases
sequentially, applies each case's format and diff budget, never prints API
keys, and reports generation success, format correctness, exact Trailer
preservation, expected Conventional Commit type, semantic concepts, diff
budget/context retention (both file paths and representative changed lines),
and p50/p95 latency.
Live reports also record the provider and model names for reproducibility,
without including endpoints or credentials.

Semantic concepts are expressed as groups of equivalent phrases rather than
exact reference-message wording. Cases may likewise declare more than one
acceptable Conventional Commit type when the underlying diff reasonably
supports multiple classifications.

Use `--json` for a machine-readable report or `--dataset path/to/dataset.json`
for a custom manifest. External manifests may embed `diff` or reference a
bounded regular `diff_file` located beneath the manifest directory.

The embedded sources are:

| Case | Source commit | Diff |
|---|---|---|
| Windows permission tests | `a8f4d13d640c8dbf48120c4a8e259c3e844f148d` | full |
| VS Code template interpolation | `45f60b8ac4e7c122be8d64552f9280e96f711ac2` | full |
| GitHub Actions Node 24 | `729582f61f8440630ff6c7a91bcf40a541be4bba` | full |
| VS Code `saveState` restoration | `bf838ab218bd5ef051444bb81811bdba3b78a790` | full |
| IntelliJ settings rendering | `099c75c4eb479362d04653d62b81f2bde97c1c38` | full |
| Askpass environment sanitization | `bcba40c9f703976b15baa2a692e94c24a36cf938` | full |
| Incremental terminal rendering | `149d84f6b4b1c06900e2ee3413d3e6f9085aa2be` | full |
| IntelliJ signing temp files | `694d0d7980ba815fc168677a6e747b2ee406daf5` | full |
| Simplified Chinese README rename | `e62a292d4b4de33304cf5d3a7249e7ea4cb2e226` | focused excerpt |
| VS Code Marketplace binary icons | `2ee41272d6d428da98755c3cb04927bd33936228` | full |
