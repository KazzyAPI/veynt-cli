import { describe, it, expect } from "vitest";
import { FindingParser } from "@veynt/findings";

describe("FindingParser", () => {
  const parser = new FindingParser();

  it("parses JSON findings block", () => {
    const response = `\`\`\`json
{
  "findings": [
    {
      "severity": "high",
      "category": "security",
      "semanticRuleId": "security.sql-injection",
      "reasoning": "Unparameterized query detected",
      "suggestedFix": "Use prepared statements"
    }
  ]
}
\`\`\``;

    const findings = parser.parse(response);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
    expect(findings[0]?.category).toBe("security");
    expect(findings[0]?.semanticRuleId).toBe("security.sql-injection");
  });

  it("returns empty array for no findings", () => {
    const response = '```json\n{ "findings": [] }\n```';
    expect(parser.parse(response)).toHaveLength(0);
  });
});
