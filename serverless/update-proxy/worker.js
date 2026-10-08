const DAY_MS = 86_400_000;
const RETENTION_DAYS = 35;
const MAX_BODY_BYTES = 256;
const EVENT_FIELDS = new Set(["event", "installation_id", "source", "cli_version"]);
const VERSION_PATTERN = /^(dev|unknown|[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$/;
const SOURCES = new Set([
  "cli", "vscode", "cursor", "windsurf", "vscode-family", "intellij", "pycharm", "webstorm",
  "goland", "phpstorm", "rider", "clion", "datagrip", "rubymine", "android-studio", "jetbrains", "unknown",
]);

function json(value, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

function validVersion(version) {
  return typeof version === "string" && version.length <= 64 &&
    version === version.trim() && VERSION_PATTERN.test(version);
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function authorized(request, token) {
  const supplied = request.headers.get("Authorization") || "";
  if (supplied.length > 512) return false;
  const expectedHash = await sha256(`Bearer ${token}`);
  const suppliedHash = await sha256(supplied);
  let difference = 0;
  for (let i = 0; i < expectedHash.length; i++) difference |= expectedHash[i] ^ suppliedHash[i];
  return difference === 0;
}

async function readEvent(request) {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: json({ error: "Expected application/json" }, 415) };
  }
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    return { error: json({ error: "Request too large" }, 413) };
  }
  if (!request.body) return { error: json({ error: "Invalid event" }, 400) };
  const reader = request.body.getReader();
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: json({ error: "Request too large" }, 413) };
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const event = JSON.parse(body);
    if (!event || Array.isArray(event) ||
        !Object.keys(event).every(key => EVENT_FIELDS.has(key)) ||
        event.event !== "polish_started" || typeof event.installation_id !== "string" ||
        !/^[a-f0-9]{32}$/.test(event.installation_id) ||
        (event.source !== undefined && !SOURCES.has(event.source)) ||
        (event.cli_version !== undefined && !validVersion(event.cli_version))) {
      return { error: json({ error: "Invalid event" }, 400) };
    }
    return { event: { ...event, source: event.source ?? "unknown", cli_version: event.cli_version ?? "unknown" } };
  } catch {
    return { error: json({ error: "Invalid event" }, 400) };
  } finally {
    reader.releaseLock();
  }
}

async function recordUsage(request, env) {
  const { event, error } = await readEvent(request);
  if (error) return error;
  if (!env.USAGE_DB) return json({ error: "Usage storage unavailable" }, 503);
  const hash = Array.from(await sha256(event.installation_id), byte => byte.toString(16).padStart(2, "0")).join("");
  // Server UTC determines the day. No client timestamp, IP, or request headers
  // are stored. The primary key makes retries and concurrent IDEs idempotent.
  await env.USAGE_DB.prepare(
    "INSERT INTO daily_activity (day, installation_hash, source, cli_version) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
  ).bind(utcDay(new Date()), hash, event.source, event.cli_version).run();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

async function usageSummary(request, env) {
  if (!env.USAGE_ADMIN_TOKEN || env.USAGE_ADMIN_TOKEN.length < 32) {
    return json({ error: "Usage summary unavailable" }, 503);
  }
  if (!await authorized(request, env.USAGE_ADMIN_TOKEN)) return json({ error: "Unauthorized" }, 401);
  if (!env.USAGE_DB) return json({ error: "Usage storage unavailable" }, 503);
  const now = new Date();
  const today = utcDay(now);
  const weekStart = utcDay(new Date(now.getTime() - 6 * DAY_MS));
  const monthStart = utcDay(new Date(now.getTime() - 29 * DAY_MS));
  const [totals, history, sources, versions] = await env.USAGE_DB.batch([
    env.USAGE_DB.prepare(`SELECT
      COUNT(DISTINCT CASE WHEN day = ? THEN installation_hash END) AS dau,
      COUNT(DISTINCT CASE WHEN day >= ? THEN installation_hash END) AS wau,
      COUNT(DISTINCT installation_hash) AS mau
      FROM daily_activity WHERE day >= ? AND day <= ?`).bind(today, weekStart, monthStart, today),
    env.USAGE_DB.prepare(`SELECT day, COUNT(DISTINCT installation_hash) AS active_installations
      FROM daily_activity WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day`).bind(monthStart, today),
    env.USAGE_DB.prepare(`SELECT source,
      COUNT(DISTINCT CASE WHEN day = ? THEN installation_hash END) AS dau,
      COUNT(DISTINCT CASE WHEN day >= ? THEN installation_hash END) AS wau,
      COUNT(DISTINCT installation_hash) AS mau
      FROM daily_activity WHERE day >= ? AND day <= ? GROUP BY source ORDER BY source`).bind(today, weekStart, monthStart, today),
    env.USAGE_DB.prepare(`SELECT cli_version,
      COUNT(DISTINCT CASE WHEN day = ? THEN installation_hash END) AS dau,
      COUNT(DISTINCT CASE WHEN day >= ? THEN installation_hash END) AS wau,
      COUNT(DISTINCT installation_hash) AS mau
      FROM daily_activity WHERE day >= ? AND day <= ? GROUP BY cli_version ORDER BY cli_version`).bind(today, weekStart, monthStart, today),
  ]);
  const byDay = new Map(history.results.map(row => [row.day, row.active_installations]));
  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = utcDay(new Date(now.getTime() - (29 - index) * DAY_MS));
    return { day, active_installations: byDay.get(day) || 0 };
  });
  return json({
    as_of: now.toISOString(), timezone: "UTC", unit: "active_installations", event: "polish_started",
    windows: { dau: { from: today, to: today }, wau: { from: weekStart, to: today }, mau: { from: monthStart, to: today } },
    ...totals.results[0], daily, by_source: sources.results, by_cli_version: versions.results,
  });
}

async function latestRelease(request, ctx) {
  // Ignore query strings in the cache key, and never cache telemetry responses.
  const cacheKey = new Request(new URL("/releases/latest", request.url));
  const cache = caches.default;
  let response = await cache.match(cacheKey);
  if (!response) {
    const upstream = await fetch("https://api.github.com/repos/daidi/git-ai/releases/latest", {
      headers: { "User-Agent": "git-ai-update-proxy", Accept: "application/vnd.github.v3+json" },
    });
    response = new Response(upstream.body, upstream);
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET");
    response.headers.set("Cache-Control", upstream.status === 200 ? "s-maxage=3600" : "no-store");
    if (upstream.status === 200) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const methods = { "/releases/latest": "GET", "/v1/usage": "POST", "/v1/usage/summary": "GET" };
    if (!Object.hasOwn(methods, path)) return json({ error: "Not found" }, 404);
    if (request.method !== methods[path]) {
      return new Response(null, { status: 405, headers: { Allow: methods[path], "Cache-Control": "no-store" } });
    }
    try {
      if (path === "/v1/usage") return await recordUsage(request, env);
      if (path === "/v1/usage/summary") return await usageSummary(request, env);
      return await latestRelease(request, ctx);
    } catch {
      // Do not log request bodies, installation identifiers, or credentials.
      return json({ error: "Service temporarily unavailable" }, 503);
    }
  },

  async scheduled(_controller, env) {
    if (!env.USAGE_DB) return;
    const oldestDay = utcDay(new Date(Date.now() - (RETENTION_DAYS - 1) * DAY_MS));
    await env.USAGE_DB.prepare("DELETE FROM daily_activity WHERE day < ?").bind(oldestDay).run();
  },
};
