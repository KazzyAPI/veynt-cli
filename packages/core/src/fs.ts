import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await ensureDirectory(dirname(path));
  await writeFile(path, content, "utf-8");
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
