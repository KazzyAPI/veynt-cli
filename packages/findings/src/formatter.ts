import type { Finding } from "./types.js";

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  info: (t) => `\x1b[36m${t}\x1b[0m`,
  low: (t) => `\x1b[32m${t}\x1b[0m`,
  medium: (t) => `\x1b[33m${t}\x1b[0m`,
  high: (t) => `\x1b[35m${t}\x1b[0m`,
  critical: (t) => `\x1b[31m${t}\x1b[0m`,
};

export function formatFinding(finding: Finding): string {
  const colorize = SEVERITY_COLORS[finding.severity] ?? ((t: string) => t);
  const header = colorize(
    `[${finding.severity.toUpperCase()}][${finding.category.toUpperCase()}]`,
  );
  const location =
    finding.filePath !== undefined
      ? `\n  File: ${finding.filePath}${finding.line !== undefined ? `:${finding.line}` : ""}`
      : "";

  const fix = finding.suggestedFix
    ? `\n\nSuggested fix:\n${finding.suggestedFix}`
    : "";

  return `${header}
${finding.id} [${finding.semanticRuleId}]${location}

Reason:
${finding.reasoning}${fix}`;
}

export function formatFindingsReport(findings: Finding[], blocked: boolean): string {
  if (findings.length === 0) {
    return blocked
      ? "\x1b[31mCommit blocked — unresolved blocking findings.\x1b[0m"
      : "\x1b[32m✓ No findings — review passed.\x1b[0m";
  }

  const body = findings.map(formatFinding).join("\n\n---\n\n");
  const footer = blocked
    ? "\n\n\x1b[31m✗ Commit blocked — resolve findings or run `veynt override`.\x1b[0m"
    : "\n\n\x1b[33m⚠ Findings reported — commit allowed at current strictness.\x1b[0m";

  return `${body}${footer}`;
}
