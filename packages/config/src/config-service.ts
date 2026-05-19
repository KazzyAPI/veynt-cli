import { homedir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import {
  ensureDirectory,
  fileExists,
  readTextFile,
  writeTextFile,
  resolveVeyntDir,
  type ArchitectureProfile,
  type RepositoryProfile,
  type StandardsProfile,
  type ProviderName,
} from "@veynt/core";
import {
  ensureChunkingDefaults,
  mergeRepoConfig,
  resolveProviderFromRepo,
} from "./config-merge.js";
import { DEFAULT_USER_CONFIG, DEFAULT_VEYNT_CONFIG } from "./defaults.js";
import {
  isLocalProvider,
  isValidProvider,
  OLLAMA_DEFAULT_HOST,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_ENV_HOST_VARS,
  PROVIDER_ENV_VARS,
} from "./provider-defaults.js";
import type { BaselineFiles, ProviderConfig, UserConfig, VeyntConfig } from "./types.js";

const CONFIG_FILE = "config.yml";
const PROFILE_FILE = "profile.yml";
const ARCHITECTURE_FILE = "architecture.yml";
const STANDARDS_FILE = "standards.yml";
const IGNORE_FILE = "ignore.yml";
const WORKSPACE_FILE = "workspace.yml";

/**
 * Single entry point for repository and user configuration.
 * Environment variables override local API keys per PRD.
 */
export class ConfigService {
  constructor(private readonly repoRoot: string) {}

  get veyntDir(): string {
    return resolveVeyntDir(this.repoRoot);
  }

  get userConfigDir(): string {
    return join(homedir(), ".veynt");
  }

  async isInitialized(): Promise<boolean> {
    return fileExists(join(this.veyntDir, CONFIG_FILE));
  }

  async loadRepoConfig(): Promise<VeyntConfig> {
    const path = join(this.veyntDir, CONFIG_FILE);
    if (!(await fileExists(path))) {
      return { ...DEFAULT_VEYNT_CONFIG };
    }
    const raw = parse(await readTextFile(path)) as Partial<VeyntConfig>;
    return ensureChunkingDefaults(mergeRepoConfig(DEFAULT_VEYNT_CONFIG, raw));
  }

  /**
   * Provider name/model/maxTokens come only from `.veynt/config.yml` on disk.
   * Ignores ~/.veynt provider fields and in-memory defaults except as fallbacks for missing keys.
   */
  async resolveProviderConfig(): Promise<ProviderConfig> {
    const path = this.repoConfigPath;
    if (!(await fileExists(path))) {
      return { ...DEFAULT_VEYNT_CONFIG.provider };
    }
    const raw = parse(await readTextFile(path)) as Partial<VeyntConfig>;
    return resolveProviderFromRepo(raw, DEFAULT_VEYNT_CONFIG.provider);
  }

  async saveRepoConfig(config: VeyntConfig): Promise<void> {
    await ensureDirectory(this.veyntDir);
    const sanitized = this.sanitizeRepoConfig(config);
    await writeTextFile(
      join(this.veyntDir, CONFIG_FILE),
      stringify(sanitized, { lineWidth: 0 }),
    );
  }

  get repoConfigPath(): string {
    return join(this.veyntDir, CONFIG_FILE);
  }

  async loadUserConfig(): Promise<UserConfig> {
    const path = join(this.userConfigDir, CONFIG_FILE);
    if (!(await fileExists(path))) {
      return { ...DEFAULT_USER_CONFIG };
    }
    const raw = parse(await readTextFile(path)) as Partial<UserConfig> & {
      provider?: unknown;
    };
    return {
      apiKeys: { ...DEFAULT_USER_CONFIG.apiKeys, ...raw.apiKeys },
    };
  }

  async saveUserConfig(config: UserConfig): Promise<void> {
    await ensureDirectory(this.userConfigDir);
    await writeTextFile(
      join(this.userConfigDir, CONFIG_FILE),
      stringify(config, { lineWidth: 0 }),
    );
  }

  resolveApiKey(provider: ProviderName, userConfig: UserConfig): string | undefined {
    if (isLocalProvider(provider)) {
      const optional = process.env[PROVIDER_ENV_VARS.ollama] ?? userConfig.apiKeys.ollama;
      return optional ?? "";
    }

    const fromEnv = process.env[PROVIDER_ENV_VARS[provider]];
    if (fromEnv) {
      return fromEnv;
    }
    return userConfig.apiKeys[provider];
  }

  isProviderConfigured(provider: ProviderName, userConfig: UserConfig): boolean {
    if (isLocalProvider(provider)) {
      return true;
    }
    return Boolean(this.resolveApiKey(provider, userConfig));
  }

  resolveProviderBaseUrl(provider: ProviderConfig): string | undefined {
    if (provider.name !== "ollama") {
      return undefined;
    }

    const hostVar = PROVIDER_ENV_HOST_VARS.ollama;
    if (hostVar && process.env[hostVar]) {
      return process.env[hostVar];
    }

    return provider.baseUrl ?? OLLAMA_DEFAULT_HOST;
  }

  async saveApiKey(provider: ProviderName, apiKey: string): Promise<void> {
    const userConfig = await this.loadUserConfig();
    userConfig.apiKeys[provider] = apiKey;
    await this.saveUserConfig(userConfig);
  }

  async loadBaseline(): Promise<BaselineFiles | null> {
    const profilePath = join(this.veyntDir, PROFILE_FILE);
    if (!(await fileExists(profilePath))) {
      return null;
    }

    const workspacePath = join(this.veyntDir, WORKSPACE_FILE);
    const workspacePromise = fileExists(workspacePath).then(async (exists) =>
      exists ? (parse(await readTextFile(workspacePath)) as BaselineFiles["workspace"]) : undefined,
    );

    const [profile, architecture, standards, workspace] = await Promise.all([
      parse(await readTextFile(profilePath)) as RepositoryProfile,
      parse(await readTextFile(join(this.veyntDir, ARCHITECTURE_FILE))) as ArchitectureProfile,
      parse(await readTextFile(join(this.veyntDir, STANDARDS_FILE))) as StandardsProfile,
      workspacePromise,
    ]);

    return { profile, architecture, standards, workspace };
  }

  async saveBaseline(baseline: BaselineFiles): Promise<void> {
    await ensureDirectory(this.veyntDir);
    const writes = [
      writeTextFile(join(this.veyntDir, PROFILE_FILE), stringify(baseline.profile)),
      writeTextFile(
        join(this.veyntDir, ARCHITECTURE_FILE),
        stringify(baseline.architecture),
      ),
      writeTextFile(join(this.veyntDir, STANDARDS_FILE), stringify(baseline.standards)),
    ];

    if (baseline.workspace) {
      writes.push(
        writeTextFile(join(this.veyntDir, WORKSPACE_FILE), stringify(baseline.workspace)),
      );
    }

    await Promise.all(writes);
  }

  async loadIgnoreConfig(): Promise<{ findings: string[]; rules: string[] }> {
    const path = join(this.veyntDir, IGNORE_FILE);
    if (!(await fileExists(path))) {
      return { findings: [], rules: [] };
    }
    const raw = parse(await readTextFile(path)) as {
      ignore?: { findings?: string[]; rules?: string[] };
    };
    return {
      findings: raw.ignore?.findings ?? [],
      rules: raw.ignore?.rules ?? [],
    };
  }

  async saveIgnoreConfig(ignore: { findings: string[]; rules: string[] }): Promise<void> {
    await ensureDirectory(this.veyntDir);
    await writeTextFile(
      join(this.veyntDir, IGNORE_FILE),
      stringify({ ignore }, { lineWidth: 0 }),
    );
  }

  async setConfigValue(keyPath: string, value: string): Promise<VeyntConfig> {
    const coerced = this.coerceValue(value);
    const raw = await this.loadRawRepoConfig();
    let updated = this.setNestedValue(raw, keyPath.split("."), coerced);

    if (
      keyPath === "provider.name" &&
      typeof coerced === "string" &&
      isValidProvider(coerced)
    ) {
      updated = this.setNestedValue(
        updated,
        ["provider", "model"],
        PROVIDER_DEFAULT_MODELS[coerced],
      );
    }

    await ensureDirectory(this.veyntDir);
    await writeTextFile(this.repoConfigPath, stringify(updated, { lineWidth: 0 }));
    return ensureChunkingDefaults(
      mergeRepoConfig(DEFAULT_VEYNT_CONFIG, updated as Partial<VeyntConfig>),
    );
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    keys: string[],
    value: unknown,
  ): Record<string, unknown> {
    if (keys.length === 1) {
      return { ...obj, [keys[0]!]: value };
    }
    const [head, ...rest] = keys;
    const nested = (obj[head!] as Record<string, unknown>) ?? {};
    return {
      ...obj,
      [head!]: this.setNestedValue(nested, rest, value),
    };
  }

  private async loadRawRepoConfig(): Promise<Record<string, unknown>> {
    const path = this.repoConfigPath;
    if (!(await fileExists(path))) {
      return { ...DEFAULT_VEYNT_CONFIG } as unknown as Record<string, unknown>;
    }
    const raw = parse(await readTextFile(path)) as Record<string, unknown>;
    const { apiKeys: _removed, ...withoutSecrets } = raw;
    return withoutSecrets;
  }

  /** API keys belong in ~/.veynt — never persist them in the repo config. */
  private sanitizeRepoConfig(config: VeyntConfig): VeyntConfig {
    return config;
  }

  private coerceValue(value: string): unknown {
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^\d+$/.test(value)) return Number(value);
    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}
