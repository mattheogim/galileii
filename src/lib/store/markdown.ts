import matter from "gray-matter";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export interface MarkdownDoc<T> {
  data: T;
  body: string;
}

export async function readMarkdown<T>(
  path: string,
): Promise<MarkdownDoc<T> | null> {
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = matter(raw);
    return { data: parsed.data as T, body: parsed.content };
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw caught;
  }
}

export async function writeMarkdown<T extends object>(
  path: string,
  doc: MarkdownDoc<T>,
): Promise<void> {
  const out = matter.stringify(doc.body, doc.data as Record<string, unknown>);
  await atomicWrite(path, out);
}

export async function appendText(path: string, text: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.appendFile(path, text, "utf-8");
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, content, "utf-8");
  await fs.rename(tmp, path);
}
