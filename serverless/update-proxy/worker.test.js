import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Miniflare, createFetchMock } from "miniflare";
import worker from "./worker.js";

const token = "test-only-admin-token-with-32-characters";
const origin = "https://usage.example.test";
const day = (ago = 0) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
const fetchMock = createFetchMock();
fetchMock.disableNetConnect();
let mf;
let db;
before(async () => {
  mf = new Miniflare({
    modules: true, scriptPath: "worker.js", compatibilityDate: "2024-04-14",
    fetchMock, d1Databases: ["USAGE_DB", "MIGRATION_DB"], bindings: { USAGE_ADMIN_TOKEN: token },
  });
  db = await mf.getD1Database("USAGE_DB");
  await db.exec((await readFile("migrations/0001_daily_activity.sql", "utf8")).replace(/\n/g, " "));
  await db.exec((await readFile("migrations/0002_cli_version.sql", "utf8")).replace(/\n/g, " "));
});
after(async () => { await mf?.dispose(); });
beforeEach(async () => { await db.prepare("DELETE FROM daily_activity").run(); });
const event = id => ({ installation_id: id.repeat(32), event: "polish_started", source: "vscode", cli_version: "1.4.2" });
const send = value => mf.dispatchFetch(`${origin}/v1/usage`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});
const summary = () => mf.dispatchFetch(`${origin}/v1/usage/summary`, { headers: { Authorization: `Bearer ${token}` } });
const seed = async (ago, id, source = "cli", version = "unknown") => db.prepare("INSERT INTO daily_activity VALUES (?, ?, ?, ?)").bind(day(ago), id.repeat(64), source, version).run();

test("version migration preserves old rows and supports inserts from the previous Worker", async () => {
  const legacyDb = await mf.getD1Database("MIGRATION_DB");
  await legacyDb.exec((await readFile("migrations/0001_daily_activity.sql", "utf8")).replace(/\n/g, " "));
  await legacyDb.prepare("INSERT INTO daily_activity VALUES (?, ?, ?)").bind(day(), "a".repeat(64), "vscode").run();
  await legacyDb.exec((await readFile("migrations/0002_cli_version.sql", "utf8")).replace(/\n/g, " "));
  assert.deepEqual((await legacyDb.prepare("SELECT * FROM daily_activity").all()).results, [
    { day: day(), installation_hash: "a".repeat(64), source: "vscode", cli_version: "unknown" },
  ]);
  for (const id of ["a", "b"]) {
    await legacyDb.prepare("INSERT INTO daily_activity (day, installation_hash, source) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(day(), id.repeat(64), "vscode").run();
  }
  assert.equal((await legacyDb.prepare("SELECT COUNT(*) AS n FROM daily_activity WHERE cli_version = 'unknown'").first()).n, 2);
});

test("concurrent reports deduplicate and store only a hash and UTC day", async () => {
  const responses = await Promise.all(Array.from({ length: 12 }, () => send(event("a"))));
  assert.ok(responses.every(response => response.status === 204));
  const { results } = await db.prepare("SELECT * FROM daily_activity").all();
  assert.deepEqual(results, [{ day: day(), source: "vscode", cli_version: "1.4.2", installation_hash: createHash("sha256").update("a".repeat(32)).digest("hex") }]);
  assert.equal(responses[0].headers.get("Cache-Control"), "no-store");
});

test("DAU/WAU/MAU count distinct installations over inclusive UTC windows", async () => {
  await seed(0, "a");
  await seed(1, "a");
  await seed(6, "b");
  await seed(7, "c");
  await seed(29, "d");
  await seed(30, "e");
  await seed(-1, "f");
  const response = await summary();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  assert.deepEqual([result.dau, result.wau, result.mau], [1, 2, 4]);
  assert.equal(result.timezone, "UTC");
  assert.equal(result.unit, "active_installations");
  assert.equal(result.daily.length, 30);
  assert.deepEqual(result.daily[0], { day: day(29), active_installations: 1 });
  assert.deepEqual(result.daily[1], { day: day(28), active_installations: 0 });
  assert.deepEqual(result.daily[29], { day: day(), active_installations: 1 });
  assert.equal(JSON.stringify(result).includes("installation_hash"), false);
});

test("empty database returns zero and a complete daily series", async () => {
  const result = await (await summary()).json();
  assert.deepEqual([result.dau, result.wau, result.mau], [0, 0, 0]);
  assert.ok(result.daily.every(row => row.active_installations === 0));
  assert.deepEqual(result.by_cli_version, []);
});

test("one installation in multiple IDEs counts once overall and once in each IDE", async () => {
  await seed(0, "a", "vscode");
  await seed(0, "a", "cursor");
  await seed(6, "a", "pycharm");
  await seed(7, "b", "pycharm");
  const result = await (await summary()).json();
  assert.deepEqual([result.dau, result.wau, result.mau], [1, 1, 2]);
  assert.equal(result.daily[29].active_installations, 1);
  assert.deepEqual(result.by_source, [
    { source: "cursor", dau: 1, wau: 1, mau: 1 },
    { source: "pycharm", dau: 0, wau: 1, mau: 2 },
    { source: "vscode", dau: 1, wau: 1, mau: 1 },
  ]);
});

test("summary requires a configured secret and rejects missing or incorrect authentication", async () => {
  for (const authorization of ["", "Bearer wrong", `Bearer ${token}x`]) {
    const response = await mf.dispatchFetch(`${origin}/v1/usage/summary`, { headers: { Authorization: authorization } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const request = new Request(`${origin}/v1/usage/summary`);
  assert.equal((await worker.fetch(request, {}, {})).status, 503);
});

test("legacy reports without version or source are accepted as unknown", async () => {
  const base = { event: "polish_started" };
  for (const value of [
    { ...base, installation_id: "a".repeat(32) },
    { ...base, installation_id: "b".repeat(32), source: "cursor" },
    { ...base, installation_id: "c".repeat(32), cli_version: "dev" },
  ]) {
    assert.equal((await send(value)).status, 204);
  }
  const result = await (await summary()).json();
  assert.equal(result.dau, 3);
  assert.deepEqual(result.by_cli_version, [
    { cli_version: "dev", dau: 1, wau: 1, mau: 1 },
    { cli_version: "unknown", dau: 2, wau: 2, mau: 2 },
  ]);
});

test("version cohorts deduplicate across IDEs and upgrades do not inflate overall activity", async () => {
  for (const version of ["1.4.1", "1.4.2", "1.4.2"]) {
    assert.equal((await send({ ...event("a"), cli_version: version })).status, 204);
  }
  await seed(0, "b", "cli", "1.4.2");
  await seed(6, "b", "cursor", "1.4.2");
  await seed(7, "c", "cli", "1.4.1");
  await seed(29, "c", "cursor", "1.4.1");
  await seed(30, "d", "cli", "1.4.1");
  await seed(-1, "e", "cli", "1.4.1");
  const result = await (await summary()).json();
  assert.deepEqual([result.dau, result.wau, result.mau], [2, 2, 3]);
  assert.equal(result.daily[29].active_installations, 2);
  assert.deepEqual(result.by_source.find(row => row.source === "vscode"), { source: "vscode", dau: 1, wau: 1, mau: 1 });
  assert.deepEqual(result.by_cli_version, [
    { cli_version: "1.4.1", dau: 1, wau: 1, mau: 2 },
    { cli_version: "1.4.2", dau: 2, wau: 2, mau: 2 },
  ]);
});

test("only bounded version labels are accepted", async () => {
  for (const version of ["1.5.0-rc.1+build.2", "1.4.2-0.20261008000000-deadbeef", "dev", "unknown"]) {
    assert.equal((await send({ ...event("a"), cli_version: version })).status, 204);
  }
  for (const version of [null, 142, {}, [], "", "v1.4.2", "1.2", "/private/build/path", "1.2.3\n", "1.2.3-", "1.2.3-" + "a".repeat(59)]) {
    assert.equal((await send({ ...event("a"), cli_version: version })).status, 400);
  }
});

test("invalid, sensitive, or oversized payloads are not stored", async () => {
  for (const value of [null, [], {}, { ...event("a"), repo: "/private" }, { ...event("a"), timestamp: day() },
    { ...event("a"), event: "status_poll" }, { ...event("a"), installation_id: 1 }, event("x"), { ...event("a"), source: "/private/editor/path" }, { ...event("a"), source: null }]) {
    assert.equal((await send(value)).status, 400);
  }
  assert.equal((await mf.dispatchFetch(`${origin}/v1/usage`, {
    method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}",
  })).status, 415);
  assert.equal((await mf.dispatchFetch(`${origin}/v1/usage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(257),
  })).status, 413);
  // Exercise the streaming limit without trusting Content-Length.
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(257))); controller.close(); } });
  assert.equal((await worker.fetch(new Request(`${origin}/v1/usage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half",
  }), { USAGE_DB: db }, {})).status, 413);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM daily_activity").first()).n, 0);
});

test("unknown paths and methods cannot poison the release cache or record usage", async () => {
  assert.equal((await mf.dispatchFetch(`${origin}/unknown`)).status, 404);
  for (const [path, method] of [["/releases/latest", "POST"], ["/v1/usage", "GET"], ["/v1/usage/summary", "POST"]]) {
    assert.equal((await mf.dispatchFetch(`${origin}${path}`, { method })).status, 405);
  }
});

test("storage failures return retryable status without echoing internals", async () => {
  const request = () => new Request(`${origin}/v1/usage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event("a")),
  });
  assert.equal((await worker.fetch(request(), {}, {})).status, 503);
  const broken = { prepare() { throw new Error("private database error"); } };
  const response = await worker.fetch(request(), { USAGE_DB: broken }, {});
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private"), false);
});

test("scheduled retention keeps the most recent 35 UTC days", async () => {
  await seed(34, "a");
  await seed(35, "b");
  await worker.scheduled({}, { USAGE_DB: db });
  const { results } = await db.prepare("SELECT day FROM daily_activity").all();
  assert.deepEqual(results, [{ day: day(34) }]);
});

test("release lookup remains compatible and does not count as activity", async () => {
  fetchMock.get("https://api.github.com").intercept({ path: "/repos/daidi/git-ai/releases/latest" })
    .reply(200, JSON.stringify({ tag_name: "v1.2.3", assets: [] }), { headers: { "Content-Type": "application/json" } });
  const response = await mf.dispatchFetch(`${origin}/releases/latest`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tag_name, "v1.2.3");
  assert.equal(response.headers.get("Cache-Control"), "s-maxage=3600");
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM daily_activity").first()).n, 0);
});
