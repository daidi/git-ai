# Git AI release proxy and active installation metrics

This Worker serves release metadata and records daily polishing activity in D1.
Release requests never count as activity. The CLI owns the installation ID and
reporting, so terminal, VS Code, and JetBrains usage share one ID per OS user
configuration directory.

## What is counted

- An active installation has started at least one polishing attempt that day.
  Failed model calls count; status polling, update checks, smart-skipped commits,
  and merely opening an IDE do not.
- DAU is today's distinct installation count. WAU and MAU deduplicate across
  today plus the preceding 6 and 29 days respectively. All boundaries use UTC;
  today is partial. They are not the sum of daily counts.
- The CLI sends exactly `installation_id` (128 random bits encoded as hex),
  `event: "polish_started"`, `source` (a fixed IDE/terminal label), and `cli_version`
  (the version of the CLI binary doing the polishing). It sends no
  code, paths, commit contents, credentials, account IDs, model names, or local
  productivity records.
- D1 stores only the SHA-256 installation hash, source label, CLI version, and server UTC date.
  The daily primary key deduplicates concurrent reports and retries. A scheduled job
  deletes rows older than the latest 35 UTC dates. Cloudflare handles network
  metadata such as source IP under its own platform settings; this application
  does not persist it.
- This is an installation metric, not an exact count of people: multiple devices
  can count separately, shared OS accounts can count once, and opt-outs/offline
  usage are absent. Ingestion is public, so these are self-reported product
  metrics, not an authenticated or fraud-proof billing measurement.

## IDE attribution

`by_source` includes per-source DAU/WAU/MAU for VS Code, Cursor, Windsurf,
IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, Rider, CLion, DataGrip,
RubyMine, Android Studio, and CLI terminals when identifiable. One installation
can count once in several source groups on the same day. Overall and daily
totals still deduplicate that installation; do not add source groups together.

Plugin actions pass a fixed `GIT_AI_CLIENT` label to their CLI child process.
The VS Code extension also labels newly created integrated terminals in trusted
workspaces. Native IDE Git commits do not necessarily run through our plugin;
for these, the foreground hook checks known askpass and terminal hints locally,
then forwards only the fixed label before daemon environment sanitization.
No paths, IPC handles, terminal session IDs, or raw host names are uploaded.

Detection is best-effort. `vscode-family` and `jetbrains` mean the IDE family is
known but the specific product is not; `unknown` means no reliable hint exists.
Existing terminals may need restarting to receive the label. Remote terminals
without forwarded hints may remain unknown. Users can explicitly set
`GIT_AI_CLIENT=cli` (or a supported product label); arbitrary values map to
`unknown`. No repository-level attribution setting is used.

## CLI versions

`by_cli_version` includes DAU/WAU/MAU for each reported CLI version. Release builds
use their build version, `go install` builds use the recorded module version, and
local development builds report `dev`. Only bounded version labels are accepted;
unrecognized CLI build labels become `unknown`. This field does not identify the
IDE application version or the separately installed plugin version.

Older reporters can omit `cli_version`; those events and pre-migration rows are
grouped under `unknown`. An installation that uses two CLI versions within a
window counts in both version groups, but only once in the overall total and in
each IDE group. Do not add version groups together to calculate total users.

## User controls

Usage reporting is **enabled by default**. Disable it before the next polish:

```sh
git-ai config set usage_telemetry false --global
git-ai config get usage_telemetry
```

Enable it again with `git-ai config set usage_telemetry true --global`.
`GIT_AI_USAGE_TELEMETRY=false` disables reporting through the environment;
`DO_NOT_TRACK=1` takes precedence even over explicit enablement. Repository
configuration cannot change this global preference. Saving older IDE settings
preserves an existing opt-out. Explicitly resetting/unsetting global config
restores defaults.

The ID and throttle state live in `usage.json` alongside the OS user config,
outside all repositories. Disabled reporting creates no ID and makes no usage
request. A request already sent cannot be withdrawn; existing server rows age
out under retention. Local `telemetry.json` productivity data stays local.

Reporting runs alongside the model request in the already detached daemon with
a two-second deadline, without redirects or logging payloads. Successful reports
are suppressed per source and current CLI version for the rest of the local UTC
day. Switching versions allows a fresh report that day; failed attempts can
retry at most hourly for the same source and version on another polish. Offline events are not
queued or backfilled.
The server uses receipt time, so requests crossing midnight or devices with
incorrect clocks can shift/miss a daily observation.

## Local verification

```sh
npm ci --ignore-scripts
npm test
```

Tests use a real local Workers runtime and D1 SQLite via Miniflare, with upstream
requests mocked. No Cloudflare account or live usage upload is needed.

## Production setup

Deploy the backend before distributing the new CLI. Existing CLI installations
do not report this event until they upgrade; historical DAU cannot be recovered
from release request counts. Without the D1 binding, ingestion returns 503 and
the existing release route continues to work.

1. Log in with `npx wrangler login` if necessary. Create and bind the database:

   ```sh
   npx wrangler d1 create git-ai-usage --binding USAGE_DB --update-config
   ```

   Confirm `wrangler.toml` contains the returned real database ID:

   ```toml
   [[d1_databases]]
   binding = "USAGE_DB"
   database_name = "git-ai-usage"
   database_id = "<ID returned by Cloudflare>"
   migrations_dir = "migrations"
   ```

   If the database already exists, reuse its ID instead of creating a duplicate.

2. Apply the schema:

   ```sh
   npx wrangler d1 migrations apply git-ai-usage --remote
   ```

   Apply migrations before every Worker upgrade. `0002_cli_version.sql` preserves
   existing activity as version `unknown` and keeps inserts from the previous
   Worker compatible while deployment is in progress.

3. Generate a strong random admin token (at least 32 characters), store it in your
   password manager, and paste it into Wrangler's secret prompt:

   ```sh
   npx wrangler secret put USAGE_ADMIN_TOKEN
   ```

   Do not commit the token, put it in a URL, or ship it to CLI users. The summary
   fails closed when this secret is absent. No token is needed for ingestion.

4. Run `npm run deploy`. The configured daily cron enforces retention. Configure
   Cloudflare rate limiting for `POST /v1/usage` to match expected traffic. Avoid
   retaining request bodies or Authorization headers in any optional access logs.

## Read the counts

Save the admin token in `~/.config/git-ai-admin/usage-admin-token` with file
permissions `0600`, or export `USAGE_ADMIN_TOKEN` in your shell to override it.
The credential stays outside this repository. After this one-time setup, run:

```sh
npm run stats
```

This calls `GET https://git-ai.codegg.org/v1/usage/summary` with a Bearer header and
prints `dau`, `wau`, `mau`, their exact UTC windows, 30 daily observations, and
`by_source` and `by_cli_version` counts.
Only aggregates are exposed, with `Cache-Control: no-store`. A zero means no
accepted event in that window, not that all existing users have stopped using
Git AI. Check deployment, uptake of the new CLI, and opt-outs before interpreting
early counts. The existing Cloudflare request graph remains a traffic metric.

References: [D1 setup](https://developers.cloudflare.com/d1/get-started/),
[D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
