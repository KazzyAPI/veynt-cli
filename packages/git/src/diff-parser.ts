import type { FileChange } from "@veynt/core";

/**
 * Parses unified Git diff output into structured file changes.
 */
export class DiffParser {
  parse(rawDiff: string): Omit<FileChange, "isRuleFile">[] {
    if (!rawDiff.trim()) {
      return [];
    }

    const files: Omit<FileChange, "isRuleFile">[] = [];
    const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

    for (const chunk of chunks) {
      const parsed = this.parseChunk(chunk);
      if (parsed) {
        files.push(parsed);
      }
    }

    return files;
  }

  private parseChunk(chunk: string): Omit<FileChange, "isRuleFile"> | null {
    const headerMatch = chunk.match(/^a\/(.+?) b\/(.+?)\n/);
    if (!headerMatch) {
      return null;
    }

    const [, pathA, pathB] = headerMatch;
    const path = pathB ?? pathA ?? "unknown";
    const status = this.inferStatus(chunk);
    const diffStart = chunk.indexOf("@@");
    const diff = diffStart >= 0 ? chunk.slice(diffStart) : chunk;

    return { path, status, diff };
  }

  private inferStatus(chunk: string): FileChange["status"] {
    if (chunk.includes("new file mode")) return "added";
    if (chunk.includes("deleted file mode")) return "deleted";
    if (chunk.includes("rename from")) return "renamed";
    return "modified";
  }
}
