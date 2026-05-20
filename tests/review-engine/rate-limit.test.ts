import { describe, it, expect } from "vitest";
import {
  parseRetryDelayMs,
  delayForRequestsPerMinute,
  isTransientProviderError,
  isRetryableProviderError,
  retryReason,
} from "@veynt/core";

describe("parseRetryDelayMs", () => {
  it("parses Gemini retry delay from message", () => {
    const error = new Error(
      'Gemini API error (429): {"error":{"message":"Please retry in 45.193228803s","details":[{"retryDelay":"45s"}]}}',
    );
    const ms = parseRetryDelayMs(error);
    expect(ms).toBeGreaterThanOrEqual(46_000);
  });

  it("returns null for non-rate-limit errors", () => {
    expect(parseRetryDelayMs(new Error("network failure"))).toBeNull();
  });
});

describe("delayForRequestsPerMinute", () => {
  it("spaces requests for 5 RPM", () => {
    expect(delayForRequestsPerMinute(5)).toBeGreaterThanOrEqual(12_000);
  });
});

describe("isTransientProviderError", () => {
  it("detects Gemini 503 high demand errors", () => {
    const error = new Error(
      'Gemini API error (503): {"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
    );
    expect(isTransientProviderError(error)).toBe(true);
    expect(isRetryableProviderError(error)).toBe(true);
    expect(retryReason(error)).toBe("Provider temporarily unavailable");
  });

  it("does not mark validation errors as transient", () => {
    const error = new Error('Gemini API error (400): {"error":{"message":"Invalid request"}}');
    expect(isTransientProviderError(error)).toBe(false);
  });
});
