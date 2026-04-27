import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { galileiiHome, envPath } from "../store/paths.js";
import { GoogleCalendarBackend } from "./google.js";
import { MockCalendarBackend } from "./mock.js";
import type { CalendarBackend } from "./index.js";

const REDIRECT_URI = "http://localhost:51789/oauth/callback";

interface ClientCreds {
  client_id: string;
  client_secret: string;
}

export async function loadCalendarBackend(): Promise<{
  backend: CalendarBackend;
  source: "google" | "mock-seeded" | "mock-empty";
}> {
  if (process.env.GALILEII_BACKEND === "mock-seeded") {
    return { backend: new MockCalendarBackend(SMOKE_FIXTURES), source: "mock-seeded" };
  }
  const refreshToken = await readRefreshToken();
  const creds = await loadClientCreds();
  if (refreshToken && creds) {
    return {
      backend: new GoogleCalendarBackend({
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        redirectUri: REDIRECT_URI,
        refreshToken,
      }),
      source: "google",
    };
  }
  return { backend: new MockCalendarBackend(), source: "mock-empty" };
}

async function readRefreshToken(): Promise<string | null> {
  const path = envPath();
  if (!existsSync(path)) return null;
  const raw = await fs.readFile(path, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^GALILEII_GOOGLE_REFRESH_TOKEN=(.+)$/);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

async function loadClientCreds(): Promise<ClientCreds | null> {
  const envId = process.env.GALILEII_GOOGLE_CLIENT_ID;
  const envSecret = process.env.GALILEII_GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) {
    return { client_id: envId, client_secret: envSecret };
  }
  const jsonPath = resolve(galileiiHome(), "google-client.json");
  if (!existsSync(jsonPath)) return null;
  const raw = await fs.readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as
    | { installed?: ClientCreds; web?: ClientCreds }
    | ClientCreds;
  if ("installed" in parsed && parsed.installed) return parsed.installed;
  if ("web" in parsed && parsed.web) return parsed.web;
  if ("client_id" in parsed && "client_secret" in parsed) return parsed;
  return null;
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
