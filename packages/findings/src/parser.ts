import { createFindingId } from "@veynt/core";
import type { FindingCategory, Severity } from "@veynt/core";
import type { Finding } from "./types.js";

const FINDING_BLOCK_PATTERN =
  /\[?(INFO|LOW|MEDIUM|HIGH|CRITICAL)\]?\s*\[?([A-Z-]+)\]?\s*\n?(VNT-\d+)?\s*([\w.-]+)\s*\n+Reason:\s*([\s\S]*?)(?:\n+Suggested fix:\s*([\s\S]*?))?(?=\n\n\[|$)/gi;

const JSON_FINDINGS_PATTERN = /```json\s*([\s\S]*?)\s*```/;

interface RawFindingJson {
  severity: string;
  category: string;
  semanticRuleId: string;
  reasoning: string;
  suggestedFix?: string;
  filePath?: string;
  line?: number;
}

/**
 * Parses structured findings from AI provider responses.
 * Supports both JSON blocks (preferred) and legacy text blocks.
 */
export class FindingParser {
  parse(response: string): Finding[] {
    const jsonFindings = this.parseJsonBlock(response);
    if (jsonFindings.length > 0) {
      return jsonFindings;
    }
    return this.parseTextBlocks(response);
  }

  private parseJsonBlock(response: string): Finding[] {
    const match = response.match(JSON_FINDINGS_PATTERN);
    if (!match?.[1]) {
      return [];
    }

    try {
      const parsed = JSON.parse(match[1]) as { findings?: RawFindingJson[] };
      if (!Array.isArray(parsed.findings)) {
        return [];
      }
      return parsed.findings.map((raw) => this.toFinding(raw));
    } catch {
      return [];
    }
  }

  private parseTextBlocks(response: string): Finding[] {
    const findings: Finding[] = [];
    let match: RegExpExecArray | null;

    const pattern = new RegExp(FINDING_BLOCK_PATTERN.source, "gi");
    while ((match = pattern.exec(response)) !== null) {
      const [, severityRaw, categoryRaw, id, ruleId, reasoning, suggestedFix] = match;
      findings.push({
        id: id?.trim() || createFindingId(),
        semanticRuleId: ruleId?.trim() || "unknown.rule",
        severity: severityRaw.toLowerCase() as Severity,
        category: this.normalizeCategory(categoryRaw),
        reasoning: reasoning.trim(),
        suggestedFix: suggestedFix?.trim(),
      });
    }

    return findings;
  }

  private toFinding(raw: RawFindingJson): Finding {
    return {
      id: createFindingId(),
      semanticRuleId: raw.semanticRuleId,
      severity: raw.severity.toLowerCase() as Severity,
      category: this.normalizeCategory(raw.category),
      reasoning: raw.reasoning,
      suggestedFix: raw.suggestedFix,
      filePath: raw.filePath,
      line: raw.line,
    };
  }

  private normalizeCategory(category: string): FindingCategory {
    const normalized = category.toLowerCase().replace(/_/g, "-");
    const map: Record<string, FindingCategory> = {
      security: "security",
      architecture: "architecture",
      "ai-rules": "ai-rules",
      airules: "ai-rules",
      slop: "slop",
      dependency: "dependency",
      convention: "convention",
    };
    return map[normalized] ?? "convention";
  }
}
