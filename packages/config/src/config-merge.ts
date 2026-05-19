import { DEFAULT_CHUNKING_CONFIG } from "./chunking.js";
import { PROVIDER_DEFAULT_MODELS, isValidProvider } from "./provider-defaults.js";
import type { ProviderConfig, VeyntConfig } from "./types.js";

/**
 * Deep-merges repo config over defaults without top-level spread clobbering nested keys.
 * Repo `.veynt/config.yml` values always win over defaults for defined fields.
 */
/** Reads provider settings directly from repo YAML — never from ~/.veynt or CLI session state. */
export function resolveProviderFromRepo(
  fromRepo: Partial<{ provider?: Partial<ProviderConfig> }>,
  defaults: ProviderConfig,
): ProviderConfig {
  return normalizeProvider(fromRepo.provider, defaults);
}

export function mergeRepoConfig(
  defaults: VeyntConfig,
  fromRepo: Partial<VeyntConfig>,
): VeyntConfig {
  const provider = normalizeProvider(fromRepo.provider, defaults.provider);

  return {
    version: fromRepo.version ?? defaults.version,
    provider,
    review: {
      strictness: fromRepo.review?.strictness ?? defaults.review.strictness,
      suggestions: fromRepo.review?.suggestions ?? defaults.review.suggestions,
      verbose: fromRepo.review?.verbose ?? defaults.review.verbose,
      chunking: {
        ...defaults.review.chunking,
        ...fromRepo.review?.chunking,
      },
    },
    blocking: {
      local: fromRepo.blocking?.local ?? defaults.blocking.local,
      ci: fromRepo.blocking?.ci ?? defaults.blocking.ci,
    },
    ignore: {
      findings: fromRepo.ignore?.findings ?? defaults.ignore.findings,
      rules: fromRepo.ignore?.rules ?? defaults.ignore.rules,
    },
    scan: {
      includeContextFiles:
        fromRepo.scan?.includeContextFiles ?? defaults.scan.includeContextFiles,
      maxContextFiles: fromRepo.scan?.maxContextFiles ?? defaults.scan.maxContextFiles,
      scanRuleFiles: fromRepo.scan?.scanRuleFiles ?? defaults.scan.scanRuleFiles,
      excludePatterns: fromRepo.scan?.excludePatterns ?? defaults.scan.excludePatterns,
    },
  };
}

export function normalizeProvider(
  partial: Partial<ProviderConfig> | undefined,
  defaults: ProviderConfig,
): ProviderConfig {
  const name =
    partial?.name && isValidProvider(partial.name) ? partial.name : defaults.name;

  const modelFromFile = coerceModelString(partial?.model);
  const model =
    modelFromFile.length > 0 ? modelFromFile : PROVIDER_DEFAULT_MODELS[name];

  const maxTokens =
    typeof partial?.maxTokens === "number" && partial.maxTokens > 0
      ? partial.maxTokens
      : defaults.maxTokens;

  const baseUrl =
    typeof partial?.baseUrl === "string" && partial.baseUrl.trim().length > 0
      ? partial.baseUrl.trim()
      : defaults.baseUrl;

  return { name, model, maxTokens, ...(baseUrl ? { baseUrl } : {}) };
}

function coerceModelString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

/** Ensures review.chunking exists when older config files omit it entirely. */
export function ensureChunkingDefaults(config: VeyntConfig): VeyntConfig {
  return {
    ...config,
    review: {
      ...config.review,
      chunking: {
        ...DEFAULT_CHUNKING_CONFIG,
        ...config.review.chunking,
      },
    },
  };
}
