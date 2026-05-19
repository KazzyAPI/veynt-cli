import {
  createFindingId,
  createSemanticRuleId,
  type ProviderName,
  type ReviewMode,
} from "@veynt/core";
import type { ChunkingConfig, ConfigService } from "@veynt/config";
import {
  BlockingEngine,
  SuppressionService,
  type Finding,
} from "@veynt/findings";
import type { GitService } from "@veynt/git";
import { ChunkedReviewRunner } from "./chunked-review-runner.js";
import { ContextPackageBuilder } from "./context-package-builder.js";
import { ReviewChunker } from "./review-chunker.js";
import { filterDiffForReview } from "./scan-diff-filter.js";
import type { ReviewEngineOptions, ReviewResult } from "./types.js";

/**
 * Orchestrates the full review flow: context → chunked AI → parse → block → suppress.
 */
export class ReviewEngine {
  private readonly contextBuilder: ContextPackageBuilder;

  constructor(
    private readonly configService: ConfigService,
    private readonly gitService: GitService,
    private readonly options: ReviewEngineOptions,
  ) {
    this.contextBuilder = new ContextPackageBuilder(gitService);
  }

  async reviewStaged(mode: ReviewMode = "local"): Promise<ReviewResult> {
    const diff = await this.gitService.getStagedDiff();
    return this.executeReview(diff, mode);
  }

  async reviewBranch(targetBranch: string, mode: ReviewMode = "ci"): Promise<ReviewResult> {
    const diff = await this.gitService.getBranchDiff(targetBranch);
    return this.executeReview(diff, mode);
  }

  private async executeReview(
    diff: import("@veynt/git").GitDiffResult,
    mode: ReviewMode,
  ): Promise<ReviewResult> {
    const config = this.options.config;
    const baseline = await this.configService.loadBaseline();

    if (!baseline) {
      throw new Error(
        "Repository baseline not found. Run `veynt analyse` before scanning.",
      );
    }

    const reviewDiff = filterDiffForReview(diff, config.scan.excludePatterns);

    if (await this.isOverrideActive()) {
      const contextPackage = await this.contextBuilder.build(
        { diff: reviewDiff, config, mode },
        baseline,
      );
      return {
        findings: [],
        blocked: false,
        contextPackage,
        aiInvoked: false,
        skipReason: "override-active",
        chunksTotal: 0,
        chunksInvoked: 0,
      };
    }

    if (reviewDiff.files.length === 0) {
      const emptyPackage = await this.contextBuilder.build(
        { diff: reviewDiff, config, mode },
        baseline,
      );
      return {
        findings: [],
        blocked: false,
        contextPackage: emptyPackage,
        aiInvoked: false,
        skipReason: "no-staged-changes",
      };
    }

    const contextPackage = await this.contextBuilder.build(
      { diff: reviewDiff, config, mode },
      baseline,
    );

    const staticFindings = this.mapStaticRuleFindings(
      this.contextBuilder.buildStaticRuleFindings(reviewDiff),
    );

    let aiFindings: Finding[] = [];
    let rawResponse: string | undefined;
    let chunksTotal = 1;
    let chunksInvoked = 0;

    if (this.options.aiEnabled && this.options.provider) {
      const providerConfig = await this.configService.resolveProviderConfig();
      const chunking = this.resolveChunkingForProvider(
        config.review.chunking,
        providerConfig.name,
      );
      const chunker = new ReviewChunker(chunking);
      const chunks = chunker.createChunks(contextPackage);
      chunksTotal = chunks.length;

      const runner = new ChunkedReviewRunner(
        this.options.provider,
        chunking,
        providerConfig.maxTokens,
        providerConfig.name,
        this.options.onChunkProgress,
      );

      const chunked = await runner.run(chunks, config.review.strictness);
      aiFindings = chunked.findings;
      chunksInvoked = chunked.chunksInvoked;
      rawResponse = chunked.rawResponses.join("\n\n--- chunk ---\n\n");
    }

    const allFindings = [...staticFindings, ...aiFindings];
    const suppressed = await this.applySuppressions(allFindings);
    const blockingEngine = new BlockingEngine(config.blocking);
    const blocked = blockingEngine.shouldBlock(suppressed, mode);

    const aiInvoked = Boolean(
      this.options.aiEnabled && this.options.provider && chunksInvoked > 0,
    );

    return {
      findings: suppressed,
      blocked,
      contextPackage,
      rawResponse,
      aiInvoked,
      skipReason: !aiInvoked && !this.options.aiEnabled ? "no-api-key" : undefined,
      chunksTotal,
      chunksInvoked,
    };
  }

  private mapStaticRuleFindings(
    issues: import("@veynt/analyzers").RuleFileIssue[],
  ): Finding[] {
    return issues.map((issue) => ({
      id: createFindingId(),
      semanticRuleId: createSemanticRuleId("ai-rules", "suspicious-pattern"),
      severity: issue.severity,
      category: "ai-rules" as const,
      filePath: issue.filePath,
      reasoning: issue.description,
      suggestedFix: "Review this rule file change carefully before committing.",
    }));
  }

  private async applySuppressions(findings: Finding[]): Promise<Finding[]> {
    const ignoreYaml = await this.configService.loadIgnoreConfig();
    const repoIgnore = {
      findings: [...ignoreYaml.findings, ...this.options.config.ignore.findings],
      rules: [...ignoreYaml.rules, ...this.options.config.ignore.rules],
      inlinePatterns: [],
    };

    const suppression = new SuppressionService(repoIgnore);
    const overrideActive = await this.isOverrideActive();
    const context = suppression.createContext(overrideActive);
    return suppression.filter(findings, context);
  }

  private async isOverrideActive(): Promise<boolean> {
    const { fileExists } = await import("@veynt/core");
    const { join } = await import("node:path");
    return fileExists(join(this.options.repoRoot, ".veynt", "override"));
  }

  /** Local models often choke on large multi-file payloads. */
  private resolveChunkingForProvider(
    chunking: ChunkingConfig,
    providerName: ProviderName,
  ): ChunkingConfig {
    if (providerName !== "ollama") {
      return chunking;
    }

    return {
      ...chunking,
      maxFilesPerChunk: Math.min(chunking.maxFilesPerChunk, 2),
      maxCharsPerChunk: Math.min(chunking.maxCharsPerChunk, 16_000),
    };
  }
}
