import type { ProviderName } from "@veynt/core";
import { AnthropicProvider } from "./anthropic-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import { OllamaProvider, OLLAMA_DEFAULT_HOST } from "./ollama-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import type { IReviewProvider } from "./provider-interface.js";

export interface ProviderFactoryOptions {
  baseUrl?: string;
}

export class ProviderFactory {
  static create(
    name: ProviderName,
    apiKey: string,
    model: string,
    options: ProviderFactoryOptions = {},
  ): IReviewProvider {
    switch (name) {
      case "openai":
        return new OpenAiProvider(apiKey, model);
      case "anthropic":
        return new AnthropicProvider(apiKey, model);
      case "gemini":
        return new GeminiProvider(apiKey, model);
      case "ollama":
        return new OllamaProvider(
          model,
          options.baseUrl ?? OLLAMA_DEFAULT_HOST,
          apiKey || undefined,
        );
      default: {
        const exhaustive: never = name;
        throw new Error(`Unsupported provider: ${exhaustive}`);
      }
    }
  }
}
