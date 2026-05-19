import { describe, it, expect } from "vitest";
import { isRetryableFetchError, formatFetchError } from "@veynt/core";

describe("network-errors", () => {
  it("detects fetch failed as retryable", () => {
    expect(isRetryableFetchError(new TypeError("fetch failed"))).toBe(true);
  });

  it("formats error with url and hint", () => {
    const text = formatFetchError(new TypeError("fetch failed"), {
      url: "http://127.0.0.1:11434/api/chat",
      hint: "Start Ollama",
    });
    expect(text).toContain("fetch failed");
    expect(text).toContain("11434");
    expect(text).toContain("Start Ollama");
  });
});
