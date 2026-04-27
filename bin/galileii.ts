#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const argv = process.argv.slice(2);
const subcommand = argv[0] ?? "mcp";

function printHelp(): void {
  console.log(`galileii — personal scheduling assistant (MCP server)

Usage:
  galileii mcp          Start the MCP server over stdio (default).
  galileii init         Scaffold ~/.galileii/ with starter files.
  galileii auth         Connect a Google Calendar via OAuth.
  galileii doctor       Verify the local setup.
  galileii --help       Show this help.
  galileii --version    Show version.
`);
}

async function runServer(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const serverEntry = resolve(here, "../server.js");
  const child = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  switch (subcommand) {
    case "mcp":
      await runServer();
      return;
    case "init":
      const { runInit } = await import("../src/setup/init.js");
      await runInit();
      return;
    case "auth":
      const { runAuth } = await import("../src/setup/auth.js");
      await runAuth();
      return;
    case "doctor":
      const { runDoctor } = await import("../src/setup/doctor.js");
      await runDoctor();
      return;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      return;
    case "--version":
    case "-v":
      console.log("galileii 0.1.0");
      return;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printHelp();
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
