import type { GitDiffResult } from "@veynt/git";

/**
 * Removes generated/low-signal paths from AI review to save quota (lockfiles, etc.).
 */
export function filterDiffForReview(
  diff: GitDiffResult,
  excludePatterns: string[],
): GitDiffResult {
  const files = diff.files.filter((file) => !shouldExclude(file.path, excludePatterns));
  const keptPaths = new Set(files.map((f) => f.path));

  return {
    files,
    dependencyChanges: diff.dependencyChanges.filter((path) => keptPaths.has(path)),
  };
}

function shouldExclude(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");

  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, "/");

    if (normalizedPattern.includes("*")) {
      const regex = globToRegex(normalizedPattern);
      return regex.test(normalized);
    }

    return (
      normalized === normalizedPattern ||
      normalized.endsWith(`/${normalizedPattern}`)
    );
  });
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}
