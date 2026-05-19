import type { ProviderName } from "@veynt/core";

export const OLLAMA_DEFAULT_HOST = "http://127.0.0.1:11434";

export const PROVIDER_ENV_VARS: Record<ProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  ollama: "OLLAMA_API_KEY",
};

export const PROVIDER_ENV_HOST_VARS: Partial<Record<ProviderName, string>> = {
  ollama: "OLLAMA_HOST",
};

export const PROVIDER_DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.5-flash",
  ollama: "deepseek-v3.2",
};

export function isValidProvider(name: string): name is ProviderName {
  return (
    name === "openai" ||
    name === "anthropic" ||
    name === "gemini" ||
    name === "ollama"
  );
}

export function isLocalProvider(name: ProviderName): boolean {
  return name === "ollama";
}
