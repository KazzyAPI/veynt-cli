import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  OLLAMA_DEFAULT_HOST,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_ENV_VARS,
  isLocalProvider,
  isValidProvider,
} from "@veynt/config";
import type { ProviderName, Strictness } from "@veynt/core";
import { STRICTNESS_LEVELS } from "@veynt/core";

export interface OnboardingChoices {
  provider: ProviderName;
  strictness: Strictness;
  apiKey?: string;
}

const PROVIDER_OPTIONS: Array<{ value: ProviderName; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (local)" },
];

export function isInteractiveTerminal(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

export class OnboardingPrompts {
  private readonly rl = createInterface({ input, output });

  async run(): Promise<OnboardingChoices> {
    console.log("\n\x1b[1mWelcome to Veynt\x1b[0m");
    console.log("AI-native pre-commit reviews for your repository.\n");

    const provider = await this.selectProvider();
    const strictness = await this.selectStrictness();
    const apiKey = await this.promptApiKey(provider);

    await this.rl.close();
    return { provider, strictness, apiKey };
  }

  private async selectProvider(): Promise<ProviderName> {
    console.log("Select your AI provider:\n");
    PROVIDER_OPTIONS.forEach((opt, index) => {
      console.log(
        `  ${index + 1}) ${opt.label} (${PROVIDER_DEFAULT_MODELS[opt.value]})`,
      );
    });

    while (true) {
      const answer = await this.rl.question("\nProvider [1]: ");
      const trimmed = answer.trim();

      if (trimmed === "") return "openai";

      const asNumber = Number(trimmed);
      if (asNumber >= 1 && asNumber <= PROVIDER_OPTIONS.length) {
        return PROVIDER_OPTIONS[asNumber - 1]!.value;
      }

      if (isValidProvider(trimmed)) {
        return trimmed;
      }

      console.log("\x1b[33mEnter 1–4 or openai | anthropic | gemini | ollama.\x1b[0m");
    }
  }

  private async selectStrictness(): Promise<Strictness> {
    console.log("\nReview strictness:\n");
    STRICTNESS_LEVELS.forEach((level, index) => {
      console.log(`  ${index + 1}) ${level}`);
    });

    while (true) {
      const answer = await this.rl.question("\nStrictness [2 = balanced]: ");
      const trimmed = answer.trim();

      if (trimmed === "") return "balanced";

      const asNumber = Number(trimmed);
      if (asNumber >= 1 && asNumber <= STRICTNESS_LEVELS.length) {
        return STRICTNESS_LEVELS[asNumber - 1]!;
      }

      if ((STRICTNESS_LEVELS as readonly string[]).includes(trimmed)) {
        return trimmed as Strictness;
      }

      console.log("\x1b[33mEnter 1–4 or advisory | balanced | strict | critical.\x1b[0m");
    }
  }

  private async promptApiKey(provider: ProviderName): Promise<string | undefined> {
    if (isLocalProvider(provider)) {
      console.log(`\n\x1b[32m✓\x1b[0m Ollama runs locally — no API key required.`);
      console.log(`  Default host: ${OLLAMA_DEFAULT_HOST}`);
      console.log("  Override with OLLAMA_HOST or provider.baseUrl in .veynt/config.yml");
      console.log("  Ensure the model is pulled: ollama pull llama3.2\n");
      return undefined;
    }

    const envVar = PROVIDER_ENV_VARS[provider];
    const fromEnv = process.env[envVar];
    if (fromEnv) {
      console.log(`\n\x1b[32m✓\x1b[0m Using ${envVar} from environment.`);
      return undefined;
    }

    console.log(
      `\nAPI key for \x1b[1m${provider}\x1b[0m (saved to ~/.veynt/config.yml, not committed):`,
    );
    console.log("\x1b[90mPress Enter to skip — set later with:\x1b[0m");
    console.log(`  $env:${envVar} = "your-key"\n`);

    const key = await this.rl.question("API key: ");
    const trimmed = key.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
