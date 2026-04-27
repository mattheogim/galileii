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
} from "../lib/store/paths.js";

export async function runInit(): Promise<void> {
  const home = galileiiHome();
  await fs.mkdir(home, { recursive: true });

  await writeIfMissing(configPath(), DEFAULT_CONFIG);
  await writeIfMissing(profilePath(), STARTER_PROFILE);
  await writeIfMissing(wantsPath(), STARTER_WANTS);
  await writeIfMissing(routinesPath(), STARTER_ROUTINES);
  await writeIfMissing(placesPath(), STARTER_PLACES);
  await writeIfMissing(decisionsPath(), STARTER_DECISIONS);

  console.log(`Galileii initialized at ${home}`);
  console.log("Next steps:");
  console.log("  1. Run `galileii auth` to connect Google Calendar.");
  console.log("  2. Add the MCP server to your Claude Desktop config:");
  console.log(`
{
  "mcpServers": {
    "galileii": {
      "command": "npx",
      "args": ["-y", "galileii", "mcp"]
    }
  }
}
`);
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  if (existsSync(path)) {
    console.log(`  - ${path} (already exists, skipped)`);
    return;
  }
  await fs.writeFile(path, content, "utf-8");
  console.log(`  + ${path}`);
}

const DEFAULT_CONFIG = JSON.stringify(
  {
    version: 1,
    timezone: "America/Vancouver",
    work_hours: { start: "08:00", end: "22:00" },
    default_buffer_minutes: 15,
    google: {
      calendar_id: "primary",
    },
  },
  null,
  2,
) + "\n";

const STARTER_PROFILE = `---
timezone: America/Vancouver
transportation: []
---

# Profile

Free notes about you. Galileii reads the YAML frontmatter above; this body is for you (and Obsidian).
`;

const STARTER_WANTS = `---
horizon: this_week
---

## (example) Start running again
- id: want_example
- duration_min: 30
- frequency: 2x/week
- energy: med
- time_of_day: morning
- tags: [fitness, outdoor]

---
horizon: someday
---

## (example) Read more
- id: want_example_2
- duration_min: 30
- frequency: daily
- energy: low
- tags: [reading]
`;

const STARTER_ROUTINES = `---
sleep:
  weekday_bedtime: "23:00"
  weekday_waketime: "07:00"
  weekend_shift_minutes: 60
classes: []
gym: []
---

# Routines

Add weekly recurring blocks here. Galileii excludes these from "empty time" by default.
`;

const STARTER_PLACES = `---
home:
  address: ""
  modes: { walk: 0 }
---

# Places

Named locations and travel times. Galileii uses these to annotate gaps with surrounding context.
`;

const STARTER_DECISIONS = `# Decisions

This is an append-only log of decisions made by Galileii (events created, profile updates, wants added).
Each entry has a stable \`decision_id\` so the file is git-diff friendly.
`;
