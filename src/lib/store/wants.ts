import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { wantsPath } from "./paths.js";
import { ulid } from "ulid";

export type Horizon = "this_week" | "this_month" | "someday";
export type Energy = "low" | "med" | "high";
export type TimeOfDay = "any" | "morning" | "afternoon" | "evening";

export interface Want {
  id: string;
  text: string;
  horizon: Horizon;
  duration_min?: number;
  frequency?: string;
  energy?: Energy;
  time_of_day?: TimeOfDay;
  tags?: string[];
  created_at: string;
  last_proposed_at?: string;
}

export async function readAllWants(): Promise<Want[]> {
  let raw: string;
  try {
    raw = await fs.readFile(wantsPath(), "utf-8");
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw caught;
  }
  return parseWantsMarkdown(raw);
}

export async function appendWant(want: Want): Promise<void> {
  const path = wantsPath();
  await fs.mkdir(dirname(path), { recursive: true });
  const existing = await safeRead(path);
  const block = renderWantSection(want);
  const next = existing
    ? ensureSection(existing, want.horizon) + block
    : `---\nhorizon: ${want.horizon}\n---\n\n${block}`;
  await fs.writeFile(path, next, "utf-8");
}

export function newWantId(): string {
  return `want_${ulid().slice(-10).toLowerCase()}`;
}

function renderWantSection(w: Want): string {
  const lines = [
    `## ${w.text}`,
    `- id: ${w.id}`,
    `- horizon: ${w.horizon}`,
    `- created_at: ${w.created_at}`,
  ];
  if (w.duration_min !== undefined) lines.push(`- duration_min: ${w.duration_min}`);
  if (w.frequency) lines.push(`- frequency: ${w.frequency}`);
  if (w.energy) lines.push(`- energy: ${w.energy}`);
  if (w.time_of_day) lines.push(`- time_of_day: ${w.time_of_day}`);
  if (w.tags?.length) lines.push(`- tags: [${w.tags.join(", ")}]`);
  if (w.last_proposed_at) lines.push(`- last_proposed_at: ${w.last_proposed_at}`);
  return lines.join("\n") + "\n\n";
}

function ensureSection(content: string, horizon: Horizon): string {
  const sectionMarker = `horizon: ${horizon}`;
  if (content.includes(sectionMarker)) return content;
  return content + `\n---\nhorizon: ${horizon}\n---\n\n`;
}

async function safeRead(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf-8");
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw caught;
  }
}

// Parse a wants.md file shaped as alternating frontmatter + section blocks.
export function parseWantsMarkdown(raw: string): Want[] {
  const wants: Want[] = [];
  const sections = raw.split(/^---\s*$/m);
  let currentHorizon: Horizon = "someday";

  for (let i = 0; i < sections.length; i++) {
    const block = sections[i] ?? "";
    const trimmed = block.trim();
    if (!trimmed) continue;
    const horizonMatch = trimmed.match(/^horizon:\s*(this_week|this_month|someday)\s*$/m);
    if (horizonMatch && trimmed.split("\n").length <= 3) {
      currentHorizon = horizonMatch[1] as Horizon;
      continue;
    }
    const itemMatches = trimmed.matchAll(/##\s+(.+?)(?=\n)([\s\S]*?)(?=\n##\s|$)/g);
    for (const match of itemMatches) {
      const text = (match[1] ?? "").trim();
      const body = match[2] ?? "";
      const fields = parseFieldList(body);
      if (!text) continue;
      wants.push({
        id: fields.id ?? newWantId(),
        text,
        horizon: (fields.horizon as Horizon) ?? currentHorizon,
        duration_min: fields.duration_min ? Number(fields.duration_min) : undefined,
        frequency: fields.frequency,
        energy: fields.energy as Energy | undefined,
        time_of_day: fields.time_of_day as TimeOfDay | undefined,
        tags: fields.tags ? parseTagList(fields.tags) : undefined,
        created_at: fields.created_at ?? new Date().toISOString(),
        last_proposed_at: fields.last_proposed_at,
      });
    }
  }
  return wants;
}

function parseFieldList(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*-\s*(\w+):\s*(.+?)\s*$/);
    if (m) out[m[1] ?? ""] = m[2] ?? "";
  }
  return out;
}

function parseTagList(s: string): string[] {
  return s
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
