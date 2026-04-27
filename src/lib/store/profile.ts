import { readMarkdown, writeMarkdown } from "./markdown.js";
import { profilePath } from "./paths.js";

export interface School {
  name?: string;
  campus?: string;
  address?: string;
}

export interface Profile {
  name?: string;
  school?: School;
  home_address?: string;
  transportation?: Array<"walk" | "bike" | "transit" | "car" | "rideshare">;
  timezone?: string;
}

export async function readProfileFile(): Promise<{
  exists: boolean;
  profile: Profile;
  body: string;
}> {
  const doc = await readMarkdown<Profile>(profilePath());
  if (!doc) return { exists: false, profile: {}, body: "" };
  return { exists: true, profile: doc.data, body: doc.body };
}

export async function writeProfileFile(
  profile: Profile,
  body: string = "",
): Promise<void> {
  await writeMarkdown(profilePath(), { data: profile, body });
}

export function applyProfilePatch(
  current: Profile,
  patch: Partial<Profile>,
): { next: Profile; diff: Array<{ path: string; before: unknown; after: unknown }> } {
  const next: Profile = { ...current };
  const diff: Array<{ path: string; before: unknown; after: unknown }> = [];
  for (const [k, v] of Object.entries(patch)) {
    const key = k as keyof Profile;
    const before = current[key];
    if (v === null) {
      if (before !== undefined) {
        diff.push({ path: k, before, after: null });
        delete next[key];
      }
      continue;
    }
    if (JSON.stringify(before) !== JSON.stringify(v)) {
      diff.push({ path: k, before, after: v });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = v;
    }
  }
  return { next, diff };
}
