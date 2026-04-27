import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAll } from "./mcp/registry.js";
import { log } from "./lib/log.js";
import { setCalendarBackend } from "./lib/calendar/index.js";
import { loadCalendarBackend } from "./lib/calendar/loader.js";

const PACKAGE_NAME = "galileii";
const PACKAGE_VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  const { backend, source } = await loadCalendarBackend();
  setCalendarBackend(backend);
  log.info(`calendar backend: ${source}`);

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

main().catch((caught) => {
  log.error("boot failed", { err: String(caught) });
  process.exit(1);
});
