import type { FindingCategory, Severity } from "@veynt/core";

export interface Finding {
  id: string;
  semanticRuleId: string;
  severity: Severity;
  category: FindingCategory;
  filePath?: string;
  line?: number;
  reasoning: string;
  suggestedFix?: string;
}

export interface SuppressionEntry {
  findingId?: string;
  semanticRuleId?: string;
  reason?: string;
  expiresAt?: string;
}

export interface IgnoreConfig {
  findings: string[];
  rules: string[];
  inlinePatterns: string[];
}
