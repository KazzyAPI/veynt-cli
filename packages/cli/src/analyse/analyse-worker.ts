import { appendFile } from "node:fs/promises";
import type { AppContext } from "../app-context.js";
import { AnalyseStatusStore } from "./analyse-status.js";

/**
 * Foreground analyse logic — invoked by the background worker process.
 */
export class AnalyseWorker {
  constructor(
    private readonly context: AppContext,
    private readonly statusStore: AnalyseStatusStore,
  ) {}

  async execute(): Promise<void> {
    const log = async (message: string): Promise<void> => {
      const timestamp = new Date().toISOString();
      const block =
        message
          .split("\n")
          .map((line) => `[${timestamp}] ${line}`)
          .join("\n") + "\n";
      await appendFile(this.statusStore.logPath, block);
    };

    try {
      await log("Analyse worker started.");
      const { configService, repositoryAnalyzer, repoRoot } = this.context;
      const provider = await this.context.createProvider();
      const providerConfig = await configService.resolveProviderConfig();

      await log(
        provider
          ? `Using ${providerConfig.name} (${provider.model}) for AI baseline.`
          : providerConfig.name === "ollama"
            ? "Ollama unavailable — heuristic baseline only."
            : "No API key — heuristic baseline only.",
      );

      const config = await configService.loadRepoConfig();

      const result = await repositoryAnalyzer.analyze(repoRoot, {
        provider,
        maxTokens: providerConfig.maxTokens,
        chunking: config.review.chunking,
        providerName: providerConfig.name,
        onProgress: (message) => log(message),
      });
      const baseline = repositoryAnalyzer.toBaselineFiles(result);

      await configService.saveBaseline(baseline);
      await this.statusStore.markCompleted();

      await log("Analyse completed successfully.");
      await log(`Framework: ${baseline.profile.framework}`);
      await log(`Architecture: ${baseline.profile.architectureStyle}`);
      if (baseline.workspace) {
        await log(
          `Workspace: ${baseline.workspace.packages.length} package(s), ${baseline.workspace.overview.length} char overview`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.statusStore.markFailed(message);
      await log(`Analyse failed: ${message}`);
      process.exitCode = 1;
    }
  }
}
