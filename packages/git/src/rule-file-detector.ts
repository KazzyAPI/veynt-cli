const RULE_FILE_PATTERNS: readonly RegExp[] = [
  /\.cursor\/rules\//,
  /\.cursorrules$/,
  /CLAUDE\.md$/i,
  /claude\.md$/i,
  /\.mcp\.json$/,
  /mcp\.json$/,
  /\.cursor\/mcp\.json$/,
  /AGENTS\.md$/i,
  /\.cursor\/hooks\.json$/,
  /prompt.*\.md$/i,
  /\/rules\/.*\.md$/,
  /\.cursor\/skills\//,
];

/**
 * Identifies AI rule and agent configuration files per V1 scope.
 */
export class RuleFileDetector {
  isRuleFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    return RULE_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
  }
}
