import { meetsBlockingThreshold, type ReviewMode, type Severity } from "@veynt/core";
import type { Finding } from "./types.js";

export interface BlockingConfig {
  local: Severity[];
  ci: Severity[];
}

/**
 * Determines whether findings should block a commit based on mode and configured thresholds.
 */
export class BlockingEngine {
  constructor(private readonly blocking: BlockingConfig) {}

  shouldBlock(findings: Finding[], mode: ReviewMode = "local"): boolean {
    const levels = mode === "ci" ? this.blocking.ci : this.blocking.local;
    return findings.some((f) => meetsBlockingThreshold(f.severity, levels));
  }

  getBlockingFindings(findings: Finding[], mode: ReviewMode = "local"): Finding[] {
    const levels = mode === "ci" ? this.blocking.ci : this.blocking.local;
    return findings.filter((f) => meetsBlockingThreshold(f.severity, levels));
  }
}
