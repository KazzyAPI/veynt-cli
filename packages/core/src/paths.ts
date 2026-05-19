import { access } from "node:fs/promises";
import { join, dirname } from "node:path";

export const VEYNT_DIR_NAME = ".veynt";

/** Repository-local Veynt configuration directory (committed). */
export function resolveVeyntDir(repoRoot: string): string {
  return join(repoRoot, VEYNT_DIR_NAME);
}

/** Walks up from cwd to locate the Git repository root. */
export async function resolveRepoRoot(cwd: string = process.cwd()): Promise<string> {
  let current = cwd;

  while (true) {
    try {
      await access(join(current, ".git"));
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return cwd;
      }
      current = parent;
    }
  }
}
