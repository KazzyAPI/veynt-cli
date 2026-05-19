import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { BaselineFiles, ChunkingConfig } from "@veynt/config";
import type { ProviderName } from "@veynt/core";
import type { IReviewProvider } from "@veynt/providers";
import type { ProgressCallback } from "./chunked-provider-client.js";
import { AiBaselineGenerator } from "./ai-baseline-generator.js";
import { RepoSampler } from "./repo-sampler.js";
import { WorkspaceBuilder } from "./workspace-builder.js";
import { ArchitectureInferrer } from "./architecture-inferrer.js";
import { FrameworkDetector } from "./framework-detector.js";
import { StandardsInferrer } from "./standards-inferrer.js";
import type { AnalysisResult } from "./types.js";

export interface AnalyzeOptions {
  provider?: IReviewProvider | null;
  maxTokens?: number;
  chunking?: ChunkingConfig;
  providerName?: ProviderName;
  onProgress?: ProgressCallback;
}

/**
 * Produces repository baseline: heuristics first, then optional AI-enriched documentation.
 */
export class RepositoryAnalyzer {
  constructor(
    private readonly frameworkDetector = new FrameworkDetector(),
    private readonly architectureInferrer = new ArchitectureInferrer(),
    private readonly standardsInferrer = new StandardsInferrer(),
    private readonly aiBaselineGenerator = new AiBaselineGenerator(),
  ) {}

  async analyze(repoRoot: string, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const programmatic = await this.analyzeProgrammatically(repoRoot);
    const sample = await new RepoSampler().sample(repoRoot);
    const workspace = await new WorkspaceBuilder().build(repoRoot, sample, programmatic);
    const withWorkspace = { ...programmatic, workspace };

    if (!options.provider) {
      return withWorkspace;
    }

    return this.aiBaselineGenerator.enhance(repoRoot, withWorkspace, options.provider, {
      maxTokens: options.maxTokens ?? 4096,
      chunking: options.chunking ?? {
        enabled: true,
        maxFilesPerChunk: 4,
        maxCharsPerChunk: 40_000,
        delayMsBetweenChunks: 2_000,
        requestsPerMinute: 5,
        maxRetries: 6,
      },
      providerName: options.providerName ?? "openai",
      onProgress: options.onProgress,
    });
  }

  private async analyzeProgrammatically(repoRoot: string): Promise<AnalysisResult> {
    const detection = await this.frameworkDetector.detect(repoRoot);
    const architecture = await this.architectureInferrer.infer(repoRoot, detection.framework);
    const standards = await this.standardsInferrer.infer(repoRoot);

    const isMonorepo = await this.detectMonorepo(repoRoot);
    const profile = {
      framework: detection.framework,
      language: detection.language,
      architectureStyle: isMonorepo
        ? "monorepo"
        : architecture.layers.length > 2
          ? "layered"
          : "flat",
      packageManager: detection.packageManager,
      detectedAt: new Date().toISOString(),
      monorepo: isMonorepo,
    };

    return { profile, architecture, standards };
  }

  private async detectMonorepo(repoRoot: string): Promise<boolean> {
    try {
      const entries = await readdir(join(repoRoot, "packages"));
      return entries.length > 0;
    } catch {
      return false;
    }
  }

  toBaselineFiles(result: AnalysisResult): BaselineFiles {
    return {
      profile: result.profile,
      architecture: result.architecture,
      standards: result.standards,
      workspace: result.workspace,
    };
  }
}
