import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { readProfileFile, type Profile } from "../lib/store/profile.js";

const inputSchema = {} as const;

export const readProfile: Tool<typeof inputSchema> = {
  name: "read_profile",
  description:
    "Return the user's persistent profile from ~/.galileii/profile.md. Use at conversation start, or when profile context is needed (school, address, transportation, timezone). Read-only.",
  isReadOnly: true,
  isConcurrencySafe: true,
  inputSchema,
  async call() {
    const { exists, profile } = await readProfileFile();
    const summary = exists
      ? renderSummary(profile)
      : "No profile yet. Onboard the user by asking school, home neighborhood, and main transportation.";
    return ok({ summary, profile: { ...profile, exists } });
  },
};

// Suppress unused import warning — z is here for tools that use it.
void z;

function renderSummary(p: Profile): string {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  if (p.school?.name)
    parts.push(`@ ${p.school.name}${p.school.campus ? ` ${p.school.campus}` : ""}`);
  if (p.home_address) parts.push(`home: ${p.home_address}`);
  if (p.transportation?.length) parts.push(`travels by ${p.transportation.join("+")}`);
  if (p.timezone) parts.push(`tz ${p.timezone}`);
  return parts.length ? parts.join(", ") : "Profile exists but is empty.";
}
