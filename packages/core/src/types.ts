import type { WorkspaceDocument } from "./workspace.js";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Strictness = "advisory" | "balanced" | "strict" | "critical";

export type FindingCategory =
  | "security"
  | "architecture"
  | "ai-rules"
  | "slop"
  | "dependency"
  | "convention";

export type ReviewMode = "local" | "ci";

export type ProviderName = "openai" | "anthropic" | "gemini" | "ollama";

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  diff: string;
  isRuleFile: boolean;
}

export interface DiffHunk {
  filePath: string;
  content: string;
}

export interface RepositoryProfile {
  framework: string;
  language: string;
  architectureStyle: string;
  packageManager: string;
  detectedAt: string;
  summary?: string;
  purpose?: string;
  monorepo?: boolean;
}

export interface ArchitectureProfile {
  layers: string[];
  separationOfConcerns: string[];
  namingConventions: Record<string, string>;
  layeringConventions: string[];
  summary?: string;
  moduleBoundaries?: string[];
  dependencyRules?: string[];
}

export interface StandardsProfile {
  commentDensity: "low" | "medium" | "high";
  nullabilityPattern: string;
  utilityReusePatterns: string[];
  dependencyPatterns: string[];
  antiPatterns: string[];
  summary?: string;
  testingApproach?: string;
}

export interface ReviewContextPackage {
  repository: {
    framework: string;
    architectureStyle: string;
    strictness: Strictness;
    profile: RepositoryProfile;
    architecture: ArchitectureProfile;
    standards: StandardsProfile;
    workspace?: WorkspaceDocument;
  };
  changes: {
    filesChanged: string[];
    fileChanges: FileChange[];
    dependencyChanges: string[];
    ruleFileChanges: string[];
  };
  context: {
    relatedUtilities: string[];
    surroundingFiles: Record<string, string>;
    impactedAreas: string[];
  };
  mode: ReviewMode;
}

export interface ScanOptions {
  branch?: string;
  mode?: ReviewMode;
  verbose?: boolean;
}

export interface ScanResult<TFinding = unknown> {
  findings: TFinding[];
  blocked: boolean;
  contextPackage: ReviewContextPackage;
}
