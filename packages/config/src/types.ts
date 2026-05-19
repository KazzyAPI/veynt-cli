import type {
  ArchitectureProfile,
  ProviderName,
  RepositoryProfile,
  Severity,
  StandardsProfile,
  Strictness,
  WorkspaceDocument,
} from "@veynt/core";
import type { ChunkingConfig } from "./chunking.js";

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  maxTokens: number;
  /** Ollama server URL (default http://127.0.0.1:11434). Overridden by OLLAMA_HOST env. */
  baseUrl?: string;
}

export interface BlockingConfig {
  local: Severity[];
  ci: Severity[];
}

export interface ReviewConfig {
  strictness: Strictness;
  suggestions: boolean;
  verbose: boolean;
  chunking: ChunkingConfig;
}

export interface IgnoreConfigYaml {
  findings: string[];
  rules: string[];
}

export interface VeyntConfig {
  version: string;
  provider: ProviderConfig;
  review: ReviewConfig;
  blocking: BlockingConfig;
  ignore: IgnoreConfigYaml;
  scan: {
    includeContextFiles: boolean;
    maxContextFiles: number;
    scanRuleFiles: boolean;
    excludePatterns: string[];
  };
}

export interface UserConfig {
  apiKeys: Partial<Record<ProviderName, string>>;
}

export interface BaselineFiles {
  profile: RepositoryProfile;
  architecture: ArchitectureProfile;
  standards: StandardsProfile;
  workspace?: WorkspaceDocument;
}
