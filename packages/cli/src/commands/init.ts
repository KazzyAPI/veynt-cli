import {
  DEFAULT_VEYNT_CONFIG,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_ENV_VARS,
  isValidProvider,
} from "@veynt/config";
import type { ProviderName, Strictness } from "@veynt/core";
import { STRICTNESS_LEVELS, ensureDirectory } from "@veynt/core";
import { join } from "node:path";
import type { AppContext } from "../app-context.js";
import { isInteractiveTerminal, OnboardingPrompts } from "../prompts/onboarding.js";

interface InitOptions {
  provider?: string;
  strictness?: string;
  hooks?: boolean;
  nonInteractive?: boolean;
}

export class InitCommand {
  constructor(private readonly context: AppContext) {}

  async execute(options: InitOptions): Promise<void> {
    const { configService, hookInstaller } = this.context;

    if (!(await hookInstaller.isGitRepository())) {
      throw new Error("Not a Git repository. Run `git init` first.");
    }

    const useInteractive =
      !options.nonInteractive &&
      isInteractiveTerminal() &&
      !options.provider &&
      !options.strictness;

    let provider: ProviderName = DEFAULT_VEYNT_CONFIG.provider.name;
    let strictness: Strictness = DEFAULT_VEYNT_CONFIG.review.strictness;
    let apiKey: string | undefined;

    if (useInteractive) {
      const choices = await new OnboardingPrompts().run();
      provider = choices.provider;
      strictness = choices.strictness;
      apiKey = choices.apiKey;
    } else {
      if (options.provider) {
        if (!isValidProvider(options.provider)) {
          throw new Error(
            `Invalid provider "${options.provider}". Use openai, anthropic, gemini, or ollama.`,
          );
        }
        provider = options.provider;
      }
      if (options.strictness) {
        if (!(STRICTNESS_LEVELS as readonly string[]).includes(options.strictness)) {
          throw new Error(
            `Invalid strictness "${options.strictness}". Use advisory, balanced, strict, or critical.`,
          );
        }
        strictness = options.strictness as Strictness;
      }
    }

    const config = {
      ...DEFAULT_VEYNT_CONFIG,
      provider: {
        name: provider,
        model: PROVIDER_DEFAULT_MODELS[provider],
        maxTokens: DEFAULT_VEYNT_CONFIG.provider.maxTokens,
      },
      review: {
        ...DEFAULT_VEYNT_CONFIG.review,
        strictness,
      },
    };

    await configService.saveRepoConfig(config);
    await ensureDirectory(configService.veyntDir);

    if (apiKey) {
      await configService.saveApiKey(provider, apiKey);
      console.log(`\x1b[32m✓\x1b[0m API key saved to ${join(configService.userConfigDir, "config.yml")}`);
    } else if (!useInteractive) {
      await this.printApiKeyHint(provider);
    }

    const installHooks = options.hooks !== false;
    if (installHooks) {
      await hookInstaller.install();
    }

    console.log("\n\x1b[32m✓ Veynt initialized\x1b[0m");
    console.log(`  Repo config: ${configService.repoConfigPath}`);
    console.log(`  Provider: ${provider} (${config.provider.model})`);
    console.log(`  Strictness: ${strictness}`);
    if (installHooks) {
      console.log("  Git pre-commit hook installed");
    }
    console.log("\nNext steps:");
    console.log("  1. Run `veynt analyse` to generate repository baseline");
    console.log("  2. Commit `.veynt/` to your repository");
    console.log("  3. Run `veynt scan` before commits (automatic via hook)");
  }

  private async printApiKeyHint(provider: ProviderName): Promise<void> {
    if (provider === "ollama") {
      console.log(`\n\x1b[33mOllama:\x1b[0m ensure \`ollama serve\` is running and model is pulled.`);
      return;
    }

    const userConfig = await this.context.configService.loadUserConfig();
    if (this.context.configService.isProviderConfigured(provider, userConfig)) {
      return;
    }

    console.log(
      `\n\x1b[33mSet your API key:\x1b[0m $env:${PROVIDER_ENV_VARS[provider]} = "your-key"`,
    );
    console.log(`  Or run \`veynt init\` interactively to store it in ~/.veynt/config.yml`);
  }
}
