import { describe, it, expect } from "vitest";
import { ReviewChunker } from "@veynt/review-engine";

const DEFAULT_CHUNKING = {
  enabled: true,
  maxFilesPerChunk: 4,
  maxCharsPerChunk: 40_000,
  delayMsBetweenChunks: 2_000,
  maxRetries: 3,
};
import type { ReviewContextPackage } from "@veynt/core";

function buildPackage(fileCount: number, diffSize: number): ReviewContextPackage {
  const fileChanges = Array.from({ length: fileCount }, (_, i) => ({
    path: `src/file-${i}.ts`,
    status: "modified" as const,
    diff: "x".repeat(diffSize),
    isRuleFile: false,
  }));

  return {
    repository: {
      framework: "node",
      architectureStyle: "flat",
      strictness: "balanced",
      profile: {
        framework: "node",
        language: "typescript",
        architectureStyle: "flat",
        packageManager: "pnpm",
        detectedAt: new Date().toISOString(),
      },
      architecture: { layers: [], separationOfConcerns: [], namingConventions: {}, layeringConventions: [] },
      standards: {
        commentDensity: "low",
        nullabilityPattern: "",
        utilityReusePatterns: [],
        dependencyPatterns: [],
        antiPatterns: [],
      },
    },
    changes: {
      filesChanged: fileChanges.map((f) => f.path),
      fileChanges,
      dependencyChanges: [],
      ruleFileChanges: [],
    },
    context: { relatedUtilities: [], surroundingFiles: {}, impactedAreas: [] },
    mode: "local",
  };
}

describe("ReviewChunker", () => {
  it("returns a single chunk when chunking is disabled", () => {
    const chunker = new ReviewChunker({ ...DEFAULT_CHUNKING, enabled: false });
    const chunks = chunker.createChunks(buildPackage(10, 100));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.filePaths).toHaveLength(10);
  });

  it("splits many files into multiple chunks", () => {
    const chunker = new ReviewChunker({
      ...DEFAULT_CHUNKING,
      maxFilesPerChunk: 2,
      maxCharsPerChunk: 10_000,
    });
    const chunks = chunker.createChunks(buildPackage(6, 500));
    expect(chunks.length).toBeGreaterThan(1);
    const allFiles = chunks.flatMap((c) => c.filePaths);
    expect(allFiles).toHaveLength(6);
  });

  it("isolates oversized files into their own chunk", () => {
    const chunker = new ReviewChunker({
      ...DEFAULT_CHUNKING,
      maxFilesPerChunk: 10,
      maxCharsPerChunk: 1_000,
    });
    const pkg = buildPackage(3, 100);
    pkg.changes.fileChanges[0]!.diff = "x".repeat(5_000);
    const chunks = chunker.createChunks(pkg);
    const soloChunk = chunks.find((c) => c.filePaths.includes("src/file-0.ts"));
    expect(soloChunk?.filePaths).toEqual(["src/file-0.ts"]);
  });
});
