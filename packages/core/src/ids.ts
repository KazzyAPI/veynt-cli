import { randomBytes } from "node:crypto";

/** Stable human-readable finding IDs (VNT-XXXX) for suppression and ignore flows. */
export function createFindingId(): string {
  const suffix = randomBytes(2).readUInt16BE(0) % 10000;
  return `VNT-${String(suffix).padStart(4, "0")}`;
}

/** Semantic rule IDs group findings by rule type across scans. */
export function createSemanticRuleId(category: string, slug: string): string {
  return `${category}.${slug}`;
}
