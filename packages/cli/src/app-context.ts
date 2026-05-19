import { ConfigService } from "@veynt/config";
import { GitService } from "@veynt/git";
import { HookInstaller } from "@veynt/hooks";
import { RepositoryAnalyzer } from "@veynt/analyzers";
import { ProviderFactory } from "@veynt/providers";
import type { IReviewProvider } from "@veynt/providers";
import type { ProviderName } from "@veynt/core";

/**
 * Composition root — wires dependencies for CLI commands (dependency injection).
 */
export class AppContext {
  readonly configService: ConfigService;
  readonly gitService: GitService;
  readonly hookInstaller: HookInstaller;
  readonly repositoryAnalyzer: RepositoryAnalyzer;

  constructor(readonly repoRoot: string) {
    this.configService = new ConfigService(repoRoot);
    this.gitService = new GitService(repoRoot);
    this.hookInstaller = new HookInstaller(repoRoot);
    this.repositoryAnalyzer = new RepositoryAnalyzer();
  }

  async createProvider(): Promise<IReviewProvider | null> {
    const providerConfig = await this.configService.resolveProviderConfig();
    const userConfig = await this.configService.loadUserConfig();
    if (!this.configService.isProviderConfigured(providerConfig.name, userConfig)) {
      return null;
    }

    const apiKey = this.configService.resolveApiKey(providerConfig.name, userConfig) ?? "";

    return ProviderFactory.create(providerConfig.name, apiKey, providerConfig.model, {
      baseUrl: this.configService.resolveProviderBaseUrl(providerConfig),
    });
  }

  async resolveProviderName(override?: string): Promise<ProviderName> {
    if (override) {
      return override as ProviderName;
    }
    const config = await this.configService.loadRepoConfig();
    return config.provider.name;
  }
}
