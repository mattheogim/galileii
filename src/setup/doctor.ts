import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  galileiiHome,
  profilePath,
  wantsPath,
  routinesPath,
  placesPath,
  decisionsPath,
  configPath,
  envPath,
} from "../lib/store/paths.js";
import { loadCalendarBackend } from "../lib/calendar/loader.js";

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

export async function runDoctor(): Promise<void> {
  const checks: Check[] = [];
  const home = galileiiHome();

  checks.push({
    name: `Galileii home (${home})`,
    pass: existsSync(home),
    detail: existsSync(home) ? undefined : "Run `galileii init` first.",
  });

  for (const [label, path] of [
    ["config.json", configPath()],
    ["profile.md", profilePath()],
    ["wants.md", wantsPath()],
    ["routines.md", routinesPath()],
    ["places.md", placesPath()],
    ["decisions.md", decisionsPath()],
  ] as const) {
    checks.push({ name: label, pass: existsSync(path) });
  }

  const env = envPath();
  if (existsSync(env)) {
    const stat = await fs.stat(env);
    const mode = stat.mode & 0o777;
    checks.push({
      name: ".env permissions are 600",
      pass: mode === 0o600,
      detail:
        mode === 0o600
          ? undefined
          : `Got mode ${mode.toString(8)}; run \`chmod 600 ${env}\``,
    });
  } else {
    checks.push({
      name: ".env present (Google refresh token)",
      pass: false,
      detail: "Run `galileii auth` to create.",
    });
  }

  const clientJson = resolve(home, "google-client.json");
  const hasJson = existsSync(clientJson);
  const hasEnvCreds = !!(
    process.env.GALILEII_GOOGLE_CLIENT_ID && process.env.GALILEII_GOOGLE_CLIENT_SECRET
  );
  checks.push({
    name: "Google OAuth client creds",
    pass: hasJson || hasEnvCreds,
    detail:
      hasJson || hasEnvCreds
        ? undefined
        : `Save credentials JSON to ${clientJson} or set GALILEII_GOOGLE_CLIENT_ID/SECRET env vars.`,
  });

  // Live calendar test
  try {
    const { source, backend } = await loadCalendarBackend();
    if (source === "google") {
      // Try a tiny list call
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await backend.listEvents({ range: { start, end } });
      checks.push({ name: "Google Calendar reachable", pass: true });
    } else {
      checks.push({
        name: "Calendar backend",
        pass: false,
        detail: `Currently using ${source}. Run \`galileii auth\` to connect Google.`,
      });
    }
  } catch (caught) {
    checks.push({
      name: "Google Calendar reachable",
      pass: false,
      detail: (caught as Error).message,
    });
  }

  let failed = 0;
  for (const c of checks) {
    const tag = c.pass ? "PASS" : "FAIL";
    const line = c.detail ? `${tag}  ${c.name} — ${c.detail}` : `${tag}  ${c.name}`;
    console.log(line);
    if (!c.pass) failed++;
  }

  if (failed > 0) {
    console.log(`\n${failed} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll checks passed.");
  }
}
