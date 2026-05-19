import type { FileChange } from "@veynt/core";

export interface RuleFileIssue {
  filePath: string;
  pattern: string;
  description: string;
  severity: "medium" | "high" | "critical";
}

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; description: string; severity: RuleFileIssue["severity"] }> = [
  {
    pattern: /ignore\s+(all|previous)\s+(instructions|rules)/i,
    description: "Instruction override attempting to bypass prior rules",
    severity: "critical",
  },
  {
    pattern: /exfiltrat|send\s+(all|every)\s+(file|data|secret)/i,
    description: "Potential data exfiltration instruction",
    severity: "critical",
  },
  {
    pattern: /always\s+run\s+with\s+--no-verify|skip\s+hooks/i,
    description: "Attempt to disable safety hooks",
    severity: "high",
  },
  {
    pattern: /sudo|rm\s+-rf|format\s+c:/i,
    description: "Dangerous shell command pattern in rules",
    severity: "high",
  },
  {
    pattern: /grant\s+(full|unrestricted)\s+(access|permissions)/i,
    description: "Permission escalation language",
    severity: "high",
  },
  {
    pattern: /never\s+(ask|confirm|tell)\s+the\s+user/i,
    description: "Hidden behavioural modification",
    severity: "medium",
  },
];

/**
 * Static analysis for AI rule files before AI review — catches obvious malicious patterns.
 */
export class RuleFileAnalyzer {
  analyze(changes: FileChange[]): RuleFileIssue[] {
    const ruleChanges = changes.filter((c) => c.isRuleFile);
    const issues: RuleFileIssue[] = [];

    for (const change of ruleChanges) {
      for (const { pattern, description, severity } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(change.diff)) {
          issues.push({
            filePath: change.path,
            pattern: pattern.source,
            description,
            severity,
          });
        }
      }
    }

    return issues;
  }
}
