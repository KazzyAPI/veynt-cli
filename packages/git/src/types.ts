import type { FileChange } from "@veynt/core";

export interface GitDiffResult {
  files: FileChange[];
  dependencyChanges: string[];
}
