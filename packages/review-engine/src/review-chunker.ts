import type { ChunkingConfig } from "@veynt/config";
import type { FileChange, ReviewContextPackage } from "@veynt/core";

export interface ReviewChunk {
  index: number;
  total: number;
  contextPackage: ReviewContextPackage;
  filePaths: string[];
}

/**
 * Splits a review context into smaller requests to reduce payload size and rate-limit pressure.
 * Chunks are sized by file count and approximate character budget (diff + path).
 */
export class ReviewChunker {
  constructor(private readonly options: ChunkingConfig) {}

  createChunks(fullPackage: ReviewContextPackage): ReviewChunk[] {
    const files = fullPackage.changes.fileChanges;

    if (!this.options.enabled || files.length <= 1) {
      return [this.toChunk(fullPackage, files, 1, 1)];
    }

    const fileGroups = this.partitionFiles(files);
    const total = fileGroups.length;

    return fileGroups.map((group, index) =>
      this.toChunk(fullPackage, group, index + 1, total),
    );
  }

  private partitionFiles(files: FileChange[]): FileChange[][] {
    const { maxFilesPerChunk, maxCharsPerChunk } = this.options;
    const sorted = [...files].sort(
      (a, b) => this.estimateFileSize(b) - this.estimateFileSize(a),
    );

    const groups: FileChange[][] = [];
    let current: FileChange[] = [];
    let currentChars = 0;

    const flush = (): void => {
      if (current.length > 0) {
        groups.push(current);
        current = [];
        currentChars = 0;
      }
    };

    for (const file of sorted) {
      const fileSize = this.estimateFileSize(file);

      if (fileSize > maxCharsPerChunk) {
        flush();
        groups.push([file]);
        continue;
      }

      const exceedsFiles = current.length >= maxFilesPerChunk;
      const exceedsChars = currentChars + fileSize > maxCharsPerChunk;

      if (exceedsFiles || exceedsChars) {
        flush();
        current = [file];
        currentChars = fileSize;
      } else {
        current.push(file);
        currentChars += fileSize;
      }
    }

    flush();
    return groups;
  }

  private toChunk(
    full: ReviewContextPackage,
    files: FileChange[],
    index: number,
    total: number,
  ): ReviewChunk {
    const paths = new Set(files.map((f) => f.path));
    const dependencyChanges = full.changes.dependencyChanges.filter((dep) =>
      paths.has(dep),
    );

    return {
      index,
      total,
      filePaths: files.map((f) => f.path),
      contextPackage: {
        ...full,
        changes: {
          filesChanged: files.map((f) => f.path),
          fileChanges: files,
          dependencyChanges,
          ruleFileChanges: full.changes.ruleFileChanges.filter((p) => paths.has(p)),
        },
        context: {
          relatedUtilities: full.context.relatedUtilities.filter((u) =>
            files.some((f) => u.includes(f.path) || f.path.includes(u)),
          ),
          impactedAreas: full.context.impactedAreas.filter((area) =>
            files.some((f) => f.path.startsWith(area)),
          ),
          surroundingFiles: this.filterSurroundingFiles(full.context.surroundingFiles, paths),
        },
      },
    };
  }

  private filterSurroundingFiles(
    surrounding: Record<string, string>,
    paths: Set<string>,
  ): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [path, content] of Object.entries(surrounding)) {
      if (paths.has(path)) {
        filtered[path] = content;
      }
    }
    return filtered;
  }

  private estimateFileSize(file: FileChange): number {
    return file.path.length + file.diff.length + 64;
  }
}
