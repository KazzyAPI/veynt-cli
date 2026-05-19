import { describe, it, expect } from "vitest";
import { RuleFileDetector } from "@veynt/git";

describe("RuleFileDetector", () => {
  const detector = new RuleFileDetector();

  it("detects Cursor rules", () => {
    expect(detector.isRuleFile(".cursor/rules/typescript.mdc")).toBe(true);
  });

  it("detects CLAUDE.md", () => {
    expect(detector.isRuleFile("CLAUDE.md")).toBe(true);
  });

  it("rejects regular source files", () => {
    expect(detector.isRuleFile("src/index.ts")).toBe(false);
  });
});
