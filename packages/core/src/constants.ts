import type { Severity, Strictness } from "./types.js";

export const SEVERITIES: readonly Severity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const STRICTNESS_LEVELS: readonly Strictness[] = [
  "advisory",
  "balanced",
  "strict",
  "critical",
] as const;

export const FINDING_CATEGORIES = [
  "security",
  "architecture",
  "ai-rules",
  "slop",
  "dependency",
  "convention",
] as const;

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Numeric rank used for threshold comparisons — higher means more severe. */
export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER[severity];
}

export function meetsBlockingThreshold(
  severity: Severity,
  blockingLevels: Severity[],
): boolean {
  const threshold = Math.min(...blockingLevels.map(severityRank));
  return severityRank(severity) >= threshold;
}
