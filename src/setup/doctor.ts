import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
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
      detail: mode === 0o600 ? undefined : `Got mode ${mode.toString(8)}; run \`chmod 600 ${env}\``,
    });
  } else {
    checks.push({
      name: ".env present",
      pass: false,
      detail: "Run `galileii auth` to create.",
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
