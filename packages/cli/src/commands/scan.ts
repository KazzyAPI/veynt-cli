import { formatFindingsReport } from "@veynt/findings";
import { PROVIDER_ENV_VARS } from "@veynt/config";
import { OllamaProvider } from "@veynt/providers";
import { ReviewEngine } from "@veynt/review-engine";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "@veynt/core";
import type { AppContext } from "../app-context.js";

interface ScanOptions {
  branch?: string;
  hook?: boolean;
  verbose?: boolean;
}

export class ScanCommand {
  constructor(private readonly context: AppContext) {}

  async execute(options: ScanOptions): Promise<number> {
    const { configService, gitService, repoRoot } = this.context;
    const config = await configService.loadRepoConfig();
    const providerConfig = await configService.resolveProviderConfig();
    const provider = await this.context.createProvider();
    const aiEnabled = configService.isProviderConfigured(
      providerConfig.name,
      await configService.loadUserConfig(),
    ) && provider !== null;

    const stagedFiles = options.branch
      ? []
      : await gitService.listStagedFiles();

    const overridePath = join(repoRoot, ".veynt", "override");
    const overrideActive = await fileExists(overridePath);

    this.printScanPlan({
      config,
      providerConfig,
      configPath: configService.repoConfigPath,
      activeModel: provider?.model,
      aiEnabled,
      fileCount: options.branch ? undefined : stagedFiles.length,
      branch: options.branch,
      verbose: options.verbose,
      overrideActive,
    });

    if (overrideActive) {
      console.log(
        "\x1b[33m⚡ Override active — skipping AI review and rule checks for this commit.\x1b[0m\n",
      );
    } else if (!aiEnabled) {
      const envVar = PROVIDER_ENV_VARS[providerConfig.name];
      if (providerConfig.name === "ollama") {
        console.log(`\x1b[33m⚠ Ollama unavailable — AI review skipped.\x1b[0m`);
        console.log("  Ensure Ollama is running: ollama serve");
        console.log(`  Pull your model: ollama pull ${providerConfig.model}`);
      } else {
        console.log(`\x1b[33m⚠ No API key — AI review skipped.\x1b[0m`);
        console.log(`  Set ${envVar} or add apiKeys.${providerConfig.name} to ~/.veynt/config.yml`);
      }
      console.log("  Static rule-file checks still run.\n");
    }

    const chunking = config.review.chunking ?? {
      enabled: true,
      maxFilesPerChunk: 4,
      maxCharsPerChunk: 40_000,
      delayMsBetweenChunks: 2_000,
      requestsPerMinute: 5,
      maxRetries: 6,
    };
    const engine = new ReviewEngine(configService, gitService, {
      repoRoot,
      config,
      provider,
      aiEnabled,
      onChunkProgress: aiEnabled
        ? (event) => {
            if (event.waitingMs) {
              console.log(
                `  Waiting ${Math.ceil(event.waitingMs / 1000)}s (rate-limit pacing)...`,
              );
              return;
            }
            console.log(
              `  Chunk ${event.current}/${event.total} — ${event.filePaths.length} file(s): ${event.filePaths.join(", ")}`,
            );
          }
        : undefined,
    });

    const mode = options.branch ? "ci" : "local";

    if (aiEnabled && !overrideActive && provider instanceof OllamaProvider) {
      const baseUrl = configService.resolveProviderBaseUrl(providerConfig);
      try {
        await provider.ping();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\x1b[31m✗ Cannot reach Ollama\x1b[0m\n${message}`);
        if (baseUrl) {
          console.error(`  Configured host: ${baseUrl}`);
        }
        return 1;
      }
    }

    if (aiEnabled && !overrideActive && !options.branch && stagedFiles.length > 0) {
      const effectiveFilesPerChunk =
        providerConfig.name === "ollama"
          ? Math.min(chunking.maxFilesPerChunk, 2)
          : chunking.maxFilesPerChunk;
      const pacing = Math.max(
        chunking.delayMsBetweenChunks,
        chunking.requestsPerMinute > 0 ? Math.ceil(60_000 / chunking.requestsPerMinute) : 0,
      );
      const chunkHint = chunking.enabled
        ? ` (chunked: max ${effectiveFilesPerChunk} files, ~${Math.ceil(pacing / 1000)}s between requests)`
        : "";
      console.log(
        `Sending ${stagedFiles.length} staged file(s) to ${providerConfig.name} (${provider?.model ?? providerConfig.model})${chunkHint}...\n`,
      );
    }

    let result;
    try {
      result = options.branch
        ? await engine.reviewBranch(options.branch, mode)
        : await engine.reviewStaged(mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\x1b[31m✗ Scan failed\x1b[0m\n${message}`);
      return 1;
    }

    if (result.skipReason === "no-staged-changes" && !options.branch) {
      console.log(
        "\x1b[33m⚠ No staged changes — nothing was sent to the AI provider.\x1b[0m",
      );
      console.log("  Stage files first: git add <files>\n");
    } else if (result.skipReason === "override-active") {
      console.log("\x1b[33m✓ Override applied — commit allowed.\x1b[0m\n");
    } else if (aiEnabled && result.aiInvoked) {
      const chunkSummary =
        result.chunksInvoked && result.chunksInvoked > 1
          ? ` via ${result.chunksInvoked} API request(s)`
          : "";
      console.log(
        `\x1b[32m✓\x1b[0m ${providerConfig.name} (${provider?.model ?? providerConfig.model}) review completed (${result.contextPackage.changes.filesChanged.length} file(s)${chunkSummary})\n`,
      );
    } else if (aiEnabled && !result.aiInvoked && result.skipReason !== "no-staged-changes") {
      console.log("\x1b[33m⚠ AI provider returned no parseable response.\x1b[0m\n");
    }

    if (options.verbose && result.rawResponse) {
      console.log("--- Raw AI Response ---\n");
      console.log(result.rawResponse);
      console.log();
    }

    console.log(formatFindingsReport(result.findings, result.blocked));

    if (result.blocked) {
      return 1;
    }

    await this.clearOverrideIfActive();
    return 0;
  }

  private printScanPlan(params: {
    config: Awaited<ReturnType<AppContext["configService"]["loadRepoConfig"]>>;
    providerConfig: Awaited<ReturnType<AppContext["configService"]["resolveProviderConfig"]>>;
    configPath: string;
    activeModel?: string;
    aiEnabled: boolean;
    fileCount?: number;
    branch?: string;
    verbose?: boolean;
    overrideActive?: boolean;
  }): void {
    const {
      config,
      providerConfig,
      configPath,
      activeModel,
      aiEnabled,
      fileCount,
      branch,
      verbose,
      overrideActive,
    } = params;
    const target = branch ? `branch vs ${branch}` : `${fileCount ?? 0} staged file(s)`;
    const model = activeModel ?? providerConfig.model;

    console.log(`\x1b[1mVeynt scan\x1b[0m — ${target}`);
    console.log(`  Config: ${configPath}`);
    console.log(
      `  Provider: ${providerConfig.name} (${model}) — ${
        overrideActive
          ? "skipped (override)"
          : aiEnabled
            ? "ready"
            : providerConfig.name === "ollama"
              ? "not reachable"
              : "no API key"
      }`,
    );
    if (verbose) {
      console.log(`  Strictness: ${config.review.strictness}`);
      if (config.review.chunking.enabled) {
        const c = config.review.chunking;
        console.log(
          `  Chunking: ${c.maxFilesPerChunk} files / ${c.maxCharsPerChunk} chars, ${c.delayMsBetweenChunks}ms delay`,
        );
      }
    }
    console.log();
  }

  private async clearOverrideIfActive(): Promise<void> {
    const overridePath = join(this.context.repoRoot, ".veynt", "override");
    if (await fileExists(overridePath)) {
      await unlink(overridePath);
    }
  }
}
