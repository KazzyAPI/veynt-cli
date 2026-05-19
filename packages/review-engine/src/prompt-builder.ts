import { formatPathTokens, formatWorkspaceTokens, tokenSection } from "@veynt/core";
import type { ReviewContextPackage, Strictness } from "@veynt/core";
import { stringify } from "yaml";

const MAX_BASELINE_CHARS = 12_000;
const MAX_DIFF_CHARS_PER_FILE = 8_000;
const MAX_TOTAL_USER_PROMPT_CHARS = 48_000;

const STRICTNESS_GUIDANCE: Record<Strictness, string> = {
  advisory: "Report issues but lean toward leniency. Focus on critical security only.",
  balanced: "Balance thoroughness with pragmatism. Flag clear issues.",
  strict: "Apply senior-engineer scrutiny. Flag architecture drift, slop, and security.",
  critical: "Maximum scrutiny. Block-worthy findings for any meaningful deviation.",
};

/**
 * Builds system and user prompts sent to AI providers.
 * Response format is JSON-first for reliable parsing.
 */
export class PromptBuilder {
  buildSystemPrompt(strictness: Strictness): string {
    return `You are Veynt, an AI-native senior engineering reviewer.

Your role: analyse Git diffs against the repository baseline and detect:
- Security vulnerabilities (SQL injection, XSS, SSRF, RCE, auth issues, secrets, path traversal)
- Architectural drift and logic placement violations
- Malicious or risky AI rule file changes
- AI-generated code slop (over-abstraction, over-commenting, unnecessary helpers)
- Poor engineering practices

Strictness: ${strictness}
${STRICTNESS_GUIDANCE[strictness]}

Rules:
- Be specific and actionable
- Reference baseline conventions when flagging drift
- Discourage over-engineering and framework misuse
- Do not store or reference data beyond this review

Respond with a JSON block wrapped in \`\`\`json fences:
\`\`\`json
{
  "findings": [
    {
      "severity": "medium",
      "category": "architecture",
      "semanticRuleId": "architecture.logic-placement",
      "reasoning": "...",
      "suggestedFix": "...",
      "filePath": "optional/path",
      "line": 42
    }
  ]
}
\`\`\`

If no issues found, return: { "findings": [] }`;
  }

  buildUserPrompt(
    contextPackage: ReviewContextPackage,
    chunkIndex?: number,
    chunkTotal?: number,
  ): string {
    const chunkNote =
      chunkIndex !== undefined && chunkTotal !== undefined && chunkTotal > 1
        ? `\nThis is review chunk ${chunkIndex} of ${chunkTotal}. Only analyse files present in this chunk.\n`
        : "";

    const workspace = contextPackage.repository.workspace;
    let baselineSection = workspace
      ? formatWorkspaceTokens(workspace)
      : this.formatBaselineFallback(contextPackage);
    if (baselineSection.length > MAX_BASELINE_CHARS) {
      baselineSection =
        baselineSection.slice(0, MAX_BASELINE_CHARS) +
        "\n@meta baseline_truncated=true";
    }

    const changesSection = tokenSection(
      "changes",
      [
        `@strictness ${contextPackage.repository.strictness}`,
        `@mode ${contextPackage.mode}`,
        `@files_changed ${contextPackage.changes.filesChanged.length}`,
        formatPathTokens(contextPackage.changes.filesChanged),
        contextPackage.changes.ruleFileChanges.length > 0
          ? tokenSection(
              "ruleFiles",
              contextPackage.changes.ruleFileChanges.map((p) => `@rule-file ${p}`).join("\n"),
            )
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const diffSection = contextPackage.changes.fileChanges
      .map((f) => {
        let diff = f.diff;
        if (diff.length > MAX_DIFF_CHARS_PER_FILE) {
          diff =
            diff.slice(0, MAX_DIFF_CHARS_PER_FILE) +
            "\n... [diff truncated for local model context limit]";
        }
        return `@diff file=${f.path} status=${f.status} ruleFile=${f.isRuleFile}\n\`\`\`diff\n${diff}\n\`\`\``;
      })
      .join("\n\n");

    let prompt = `Review the following changes against the repository baseline.${chunkNote}

${tokenSection("baseline.workspace", baselineSection)}

${changesSection}

${tokenSection("diffs", diffSection)}

Return findings as JSON only.`;

    if (prompt.length > MAX_TOTAL_USER_PROMPT_CHARS) {
      prompt =
        prompt.slice(0, MAX_TOTAL_USER_PROMPT_CHARS) +
        "\n@meta prompt_truncated=true\nReturn findings as JSON only.";
    }

    return prompt;
  }

  private formatBaselineFallback(contextPackage: ReviewContextPackage): string {
    return stringify({
      profile: contextPackage.repository.profile,
      architecture: contextPackage.repository.architecture,
      standards: contextPackage.repository.standards,
    });
  }
}
