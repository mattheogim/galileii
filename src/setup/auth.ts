import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { dirname } from "node:path";
import {
  galileiiHome,
  envPath,
} from "../lib/store/paths.js";
import { getAuthUrl, exchangeCode, type GoogleClientCreds } from "../lib/calendar/google.js";
import { resolve } from "node:path";

const REDIRECT_PORT = 51789;
const REDIRECT_PATH = "/oauth/callback";
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`;

export async function runAuth(): Promise<void> {
  const creds = await loadClientCreds();
  if (!creds) {
    console.error("Cannot run auth without Google OAuth client credentials.");
    console.error("");
    console.error("Two options:");
    console.error(`  (a) Save your downloaded OAuth credentials JSON to`);
    console.error(`      ${resolve(galileiiHome(), "google-client.json")}`);
    console.error("");
    console.error("  (b) Or set env vars:");
    console.error("      GALILEII_GOOGLE_CLIENT_ID=...");
    console.error("      GALILEII_GOOGLE_CLIENT_SECRET=...");
    console.error("");
    console.error(
      "The JSON download is the easier path — get it from https://console.cloud.google.com/apis/credentials",
    );
    process.exit(2);
  }

  const { url, oauth } = await getAuthUrl({
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    redirectUri: REDIRECT_URI,
  });

  console.log("Opening browser to authorize Galileii…");
  console.log("If it doesn't open, visit this URL manually:");
  console.log(url);
  console.log("");

  const code: string = await new Promise((resolveCode, rejectCode) => {
    const server = createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);
        if (reqUrl.pathname !== REDIRECT_PATH) {
          res.writeHead(404).end("not found");
          return;
        }
        const codeParam = reqUrl.searchParams.get("code");
        const errParam = reqUrl.searchParams.get("error");
        if (errParam) {
          res.writeHead(400).end(`OAuth error: ${errParam}`);
          server.close();
          rejectCode(new Error(`OAuth error: ${errParam}`));
          return;
        }
        if (!codeParam) {
          res.writeHead(400).end("missing ?code");
          return;
        }
        res
          .writeHead(200, { "Content-Type": "text/html" })
          .end(
            "<html><body><h1>Galileii is connected.</h1><p>You can close this tab.</p></body></html>",
          );
        server.close();
        resolveCode(codeParam);
      } catch (caught) {
        rejectCode(caught as Error);
      }
    });
    server.listen(REDIRECT_PORT);
    setTimeout(
      () => {
        server.close();
        rejectCode(new Error("OAuth timed out after 5 minutes."));
      },
      5 * 60 * 1000,
    );
    openInBrowser(url).catch((e) =>
      console.warn(`Could not auto-open browser: ${(e as Error).message}`),
    );
  });

  console.log("Got auth code — exchanging for tokens…");
  const tokens = await exchangeCode(oauth, code);

  await fs.mkdir(dirname(envPath()), { recursive: true });
  const envContent = `GALILEII_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
  await fs.writeFile(envPath(), envContent, { mode: 0o600 });
  await fs.chmod(envPath(), 0o600);

  console.log(`Stored refresh token at ${envPath()} (mode 600).`);
  console.log("Galileii is now connected to Google Calendar.");
  console.log("Run `galileii doctor` to verify, then start the MCP server.");
}

async function loadClientCreds(): Promise<GoogleClientCreds | null> {
  const envId = process.env.GALILEII_GOOGLE_CLIENT_ID;
  const envSecret = process.env.GALILEII_GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) {
    return { client_id: envId, client_secret: envSecret };
  }
  const jsonPath = resolve(galileiiHome(), "google-client.json");
  if (!existsSync(jsonPath)) return null;
  const raw = await fs.readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as
    | { installed?: GoogleClientCreds; web?: GoogleClientCreds }
    | GoogleClientCreds;
  // The Google Cloud Console download wraps creds in "installed" or "web".
  if ("installed" in parsed && parsed.installed) return parsed.installed;
  if ("web" in parsed && parsed.web) return parsed.web;
  if ("client_id" in parsed && "client_secret" in parsed) return parsed;
  throw new Error(`Cannot parse credentials at ${jsonPath}.`);
}

async function openInBrowser(url: string): Promise<void> {
  return new Promise((res, rej) => {
    const cmd =
      process.platform === "darwin"
        ? `open "${url}"`
        : process.platform === "win32"
          ? `start "" "${url}"`
          : `xdg-open "${url}"`;
    exec(cmd, (err) => (err ? rej(err) : res()));
  });
}
