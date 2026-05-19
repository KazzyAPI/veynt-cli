import { describe, it, expect } from "vitest";
import { DEFAULT_VEYNT_CONFIG, mergeRepoConfig } from "@veynt/config";

describe("mergeRepoConfig", () => {
  it("uses model from repo config instead of defaults", () => {
    const merged = mergeRepoConfig(DEFAULT_VEYNT_CONFIG, {
      provider: {
        name: "gemini",
        model: "gemini-2.5-flash",
        maxTokens: 8192,
      },
    });

    expect(merged.provider.name).toBe("gemini");
    expect(merged.provider.model).toBe("gemini-2.5-flash");
    expect(merged.provider.maxTokens).toBe(8192);
  });

  it("preserves chunking defaults when repo file omits chunking", () => {
    const merged = mergeRepoConfig(DEFAULT_VEYNT_CONFIG, {
      review: {
        strictness: "strict",
        suggestions: true,
        verbose: false,
      },
    });

    expect(merged.review.strictness).toBe("strict");
    expect(merged.review.chunking.enabled).toBe(true);
    expect(merged.review.chunking.maxFilesPerChunk).toBe(4);
  });

  it("merges partial provider without losing model from defaults incorrectly", () => {
    const merged = mergeRepoConfig(DEFAULT_VEYNT_CONFIG, {
      provider: {
        name: "gemini",
        model: "custom-model-v1",
        maxTokens: 4096,
      },
    });

    expect(merged.provider.model).toBe("custom-model-v1");
  });

  it("merges ollama provider with baseUrl", () => {
    const merged = mergeRepoConfig(DEFAULT_VEYNT_CONFIG, {
      provider: {
        name: "ollama",
        model: "codellama",
        maxTokens: 4096,
        baseUrl: "http://localhost:11434",
      },
    });

    expect(merged.provider.name).toBe("ollama");
    expect(merged.provider.model).toBe("codellama");
    expect(merged.provider.baseUrl).toBe("http://localhost:11434");
  });
});
