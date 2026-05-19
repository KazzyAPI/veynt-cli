import { describe, it, expect } from "vitest";
import { BlockingEngine } from "@veynt/findings";
import type { Finding } from "@veynt/findings";

describe("BlockingEngine", () => {
  const engine = new BlockingEngine({
    local: ["high", "critical"],
    ci: ["medium", "high", "critical"],
  });

  const finding = (severity: Finding["severity"]): Finding => ({
    id: "VNT-0001",
    semanticRuleId: "test.rule",
    severity,
    category: "convention",
    reasoning: "test",
  });

  it("blocks on high severity in local mode", () => {
    expect(engine.shouldBlock([finding("high")], "local")).toBe(true);
  });

  it("does not block medium in local mode", () => {
    expect(engine.shouldBlock([finding("medium")], "local")).toBe(false);
  });

  it("blocks medium in ci mode", () => {
    expect(engine.shouldBlock([finding("medium")], "ci")).toBe(true);
  });
});
