import { DEFAULT_CHUNKING_CONFIG } from "./chunking.js";
import type { UserConfig, VeyntConfig } from "./types.js";

export const DEFAULT_VEYNT_CONFIG: VeyntConfig = {
  version: "1",
  provider: {
    name: "openai",
    model: "gpt-4o-mini",
    maxTokens: 4096,
  },
  review: {
    strictness: "balanced",
    suggestions: true,
    verbose: false,
    chunking: DEFAULT_CHUNKING_CONFIG,
  },
  blocking: {
    local: ["high", "critical"],
    ci: ["medium", "high", "critical"],
  },
  ignore: {
    findings: [],
    rules: [],
  },
  scan: {
    includeContextFiles: true,
    maxContextFiles: 10,
    scanRuleFiles: true,
    excludePatterns: [
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "**/*.lock",
    ],
  },
};

export const DEFAULT_USER_CONFIG: UserConfig = {
  apiKeys: {},
};
