import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import type { StandardsProfile } from "@veynt/core";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".py"]);

/**
 * Samples source files to infer comment density and common patterns.
 */
export class StandardsInferrer {
  async infer(repoRoot: string): Promise<StandardsProfile> {
    const samples = await this.collectSampleFiles(repoRoot, 20);
    const commentDensity = await this.measureCommentDensity(samples);

    return {
      commentDensity,
      nullabilityPattern: "prefer explicit null handling over excessive optionals",
      utilityReusePatterns: [
        "Reuse existing utilities before introducing helpers",
        "Prefer framework-native patterns over custom abstractions",
      ],
      dependencyPatterns: [
        "Avoid adding dependencies for trivial functionality",
        "Prefer existing project dependencies",
      ],
      antiPatterns: [
        "Excessive abstraction layers",
        "Over-commenting obvious code",
        "Business logic in wrong layer",
        "Duplicated domain rules",
        "Nullable-heavy APIs without justification",
      ],
    };
  }

  private async collectSampleFiles(
    dir: string,
    limit: number,
    collected: string[] = [],
  ): Promise<string[]> {
    if (collected.length >= limit) return collected;

    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return collected;
    }

    for (const entry of entries) {
      if (collected.length >= limit) break;
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.collectSampleFiles(fullPath, limit, collected);
      } else if (CODE_EXTENSIONS.has(extname(entry.name))) {
        collected.push(fullPath);
      }
    }

    return collected;
  }

  private async measureCommentDensity(
    files: string[],
  ): Promise<StandardsProfile["commentDensity"]> {
    if (files.length === 0) return "medium";

    let totalLines = 0;
    let commentLines = 0;

    for (const file of files) {
      const content = await readFile(file, "utf-8").catch(() => "");
      const lines = content.split("\n");
      totalLines += lines.length;
      commentLines += lines.filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("#")
        );
      }).length;
    }

    const ratio = totalLines > 0 ? commentLines / totalLines : 0;
    if (ratio < 0.05) return "low";
    if (ratio > 0.2) return "high";
    return "medium";
  }
}
