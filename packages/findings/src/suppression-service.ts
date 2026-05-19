import type { IgnoreConfig } from "./types.js";
import type { Finding } from "./types.js";

export interface SuppressionContext {
  ignoredFindingIds: Set<string>;
  ignoredRuleIds: Set<string>;
  oneTimeOverrideActive: boolean;
}

/**
 * Filters findings against repo-level ignores, inline suppressions, and one-time overrides.
 */
export class SuppressionService {
  constructor(private readonly ignoreConfig: IgnoreConfig) {}

  createContext(oneTimeOverride = false): SuppressionContext {
    return {
      ignoredFindingIds: new Set(this.ignoreConfig.findings),
      ignoredRuleIds: new Set(this.ignoreConfig.rules),
      oneTimeOverrideActive: oneTimeOverride,
    };
  }

  filter(findings: Finding[], context: SuppressionContext): Finding[] {
    if (context.oneTimeOverrideActive) {
      return [];
    }

    return findings.filter((finding) => {
      if (context.ignoredFindingIds.has(finding.id)) {
        return false;
      }
      if (context.ignoredRuleIds.has(finding.semanticRuleId)) {
        return false;
      }
      return true;
    });
  }

  addIgnoredFinding(findingId: string): IgnoreConfig {
    if (this.ignoreConfig.findings.includes(findingId)) {
      return this.ignoreConfig;
    }
    return {
      ...this.ignoreConfig,
      findings: [...this.ignoreConfig.findings, findingId],
    };
  }

  addIgnoredRule(ruleId: string): IgnoreConfig {
    if (this.ignoreConfig.rules.includes(ruleId)) {
      return this.ignoreConfig;
    }
    return {
      ...this.ignoreConfig,
      rules: [...this.ignoreConfig.rules, ruleId],
    };
  }
}
