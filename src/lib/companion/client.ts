import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { galileiiHome } from "../store/paths.js";

const COMPANION_PORT = 51790;
const COMPANION_HOST = "127.0.0.1";
const TOKEN_PATH = () => resolve(galileiiHome(), "companion-token");

export interface BlockRequest {
  bundle_ids?: string[];
  duration_minutes: number;
  reason?: string;
}

export interface NotifyRequest {
  title: string;
  body: string;
  category?: string;
}

export class CompanionUnavailableError extends Error {
  constructor(public readonly hint: string) {
    super("Galileii Companion is not available");
    this.name = "CompanionUnavailableError";
  }
}

async function readToken(): Promise<string | null> {
  const path = TOKEN_PATH();
  if (!existsSync(path)) return null;
  return (await fs.readFile(path, "utf-8")).trim();
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await readToken();
  if (!token) {
    throw new CompanionUnavailableError(
      "Galileii Companion is not installed (no token at ~/.galileii/companion-token). " +
        "Install with: brew install --cask galileii-companion (V0 stub: companion not yet shipped).",
    );
  }
  const url = `http://${COMPANION_HOST}:${COMPANION_PORT}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (caught) {
    throw new CompanionUnavailableError(
      `Companion daemon not reachable at ${url}. Is the menubar app running? Error: ${(caught as Error).message}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Companion ${path} -> ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function blockApps(req: BlockRequest): Promise<{ block_id: string; expires_at: string }> {
  return call("/screen-time/block", req);
}

export async function unblockApps(blockId: string): Promise<{ released: boolean }> {
  return call("/screen-time/unblock", { block_id: blockId });
}

export async function notify(req: NotifyRequest): Promise<{ delivered: boolean }> {
  return call("/notify", req);
}

export async function isCompanionAvailable(): Promise<boolean> {
  const token = await readToken();
  if (!token) return false;
  try {
    const res = await fetch(`http://${COMPANION_HOST}:${COMPANION_PORT}/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
