import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAll } from "./mcp/registry.js";
import { log } from "./lib/log.js";
import { setCalendarBackend } from "./lib/calendar/index.js";
import { MockCalendarBackend } from "./lib/calendar/mock.js";

const PACKAGE_NAME = "galileii";
const PACKAGE_VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  // V0: default to mock backend until Google OAuth is wired up.
  // In the smoke environment, GALILEII_BACKEND=mock-seeded gets a fixture set.
  if (process.env.GALILEII_BACKEND === "mock-seeded") {
    setCalendarBackend(new MockCalendarBackend(SMOKE_FIXTURES));
  } else {
    setCalendarBackend(new MockCalendarBackend());
  }

  registerAll(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info(`${PACKAGE_NAME} v${PACKAGE_VERSION} ready`);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("shutting down");
    setTimeout(() => process.exit(0), 500);
  };
  process.stdin.on("end", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("uncaughtException", (caught) => {
    log.error("uncaughtException", { err: String(caught) });
  });
  process.on("unhandledRejection", (caught) => {
    log.error("unhandledRejection", { err: String(caught) });
  });
}

const SMOKE_FIXTURES = [
  {
    id: "fix_class",
    title: "CS101",
    start: "2026-04-27T10:00:00Z",
    end: "2026-04-27T11:00:00Z",
    location: "SFU Burnaby AQ 3005",
    all_day: false,
    recurring: false,
  },
  {
    id: "fix_gym",
    title: "Iron Lab",
    start: "2026-04-27T18:00:00Z",
    end: "2026-04-27T19:00:00Z",
    location: "Iron Lab",
    all_day: false,
    recurring: false,
  },
];

main().catch((caught) => {
  log.error("boot failed", { err: String(caught) });
  process.exit(1);
});
