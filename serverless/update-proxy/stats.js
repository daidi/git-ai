import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Keep the read-only credential outside the repository and out of URLs.
const tokenPath = join(homedir(), ".config", "git-ai-admin", "usage-admin-token");
let token = process.env.USAGE_ADMIN_TOKEN;
if (!token) {
  try {
    token = readFileSync(tokenPath, "utf8").trim();
  } catch {
    // Report the setup requirement below without printing credentials.
  }
}
if (!token || token.length < 32) {
  console.error(`Set USAGE_ADMIN_TOKEN or save the Worker secret in ${tokenPath}.`);
  process.exitCode = 1;
} else {
  try {
    const response = await fetch("https://git-ai.codegg.org/v1/usage/summary", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Summary request failed (HTTP ${response.status}).`);
    const summary = await response.json();
    console.log(JSON.stringify(summary, null, 2));
  } catch {
    console.error("Could not read usage metrics. Check connectivity, deployment, and USAGE_ADMIN_TOKEN.");
    process.exitCode = 1;
  }
}
