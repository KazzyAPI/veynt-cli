import { describe, it, expect } from "vitest";
import { formatAiResponseForLog, formatAiResponseLogBlock } from "@veynt/core";

describe("formatAiResponseForLog", () => {
  it("truncates long responses", () => {
    const text = formatAiResponseForLog("x".repeat(100), 20);
    expect(text).toContain("truncated");
    expect(text.length).toBeLessThan(100);
  });

  it("builds labelled log block", () => {
    const block = formatAiResponseLogBlock("profile", '{"ok":true}');
    expect(block).toContain("Response (profile, 11 chars)");
    expect(block).toContain('{"ok":true}');
  });
});
