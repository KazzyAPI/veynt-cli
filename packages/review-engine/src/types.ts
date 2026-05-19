import type { ReviewContextPackage, ReviewMode, ScanOptions } from "@veynt/core";
import type { VeyntConfig } from "@veynt/config";
import type { Finding } from "@veynt/findings";
import type { GitDiffResult } from "@veynt/git";
import type { IReviewProvider } from "@veynt/providers";

export interface ReviewEngineOptions {
  repoRoot: string;
  config: VeyntConfig;
  provider: IReviewProvider | null;
  aiEnabled: boolean;
  mode?: ReviewMode;
  scanOptions?: ScanOptions;
  onChunkProgress?: (event: import("./chunked-review-runner.js").ChunkProgressEvent) => void;
}

export type ReviewSkipReason = "no-api-key" | "no-staged-changes" | "override-active";

export interface ReviewResult {
  findings: Finding[];
  blocked: boolean;
  contextPackage: ReviewContextPackage;
  rawResponse?: string;
  aiInvoked: boolean;
  skipReason?: ReviewSkipReason;
  chunksTotal?: number;
  chunksInvoked?: number;
}

export interface BuildContextInput {
  diff: GitDiffResult;
  config: VeyntConfig;
  mode: ReviewMode;
}
