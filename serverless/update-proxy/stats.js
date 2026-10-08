// Pass the read-only summary credential through the environment, never a URL.
const token = process.env.USAGE_ADMIN_TOKEN;
if (!token || token.length < 32) {
  console.error("Set USAGE_ADMIN_TOKEN to the secret configured on the Worker.");
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
