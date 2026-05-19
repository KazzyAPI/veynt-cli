import { describe, it, expect } from "vitest";
import { SuppressionService } from "@veynt/findings";

describe("override behavior", () => {
  it("suppression clears findings when override flag is set", () => {
    const service = new SuppressionService({ findings: [], rules: [], inlinePatterns: [] });
    const context = service.createContext(true);
    const findings = service.filter(
      [
        {
          id: "VNT-0001",
          semanticRuleId: "security.test",
          severity: "high",
          category: "security",
          reasoning: "test",
          suggestedFix: "fix",
        },
      ],
      context,
    );
    expect(findings).toHaveLength(0);
  });
});
