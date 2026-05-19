import { isValidProvider } from "@veynt/config";
import { stringify } from "yaml";
import type { AppContext } from "../app-context.js";

export class ConfigCommand {
  constructor(private readonly context: AppContext) {}

  async show(): Promise<void> {
    const { configService } = this.context;
    const config = await configService.loadRepoConfig();
    const provider = await configService.resolveProviderConfig();
    const userConfig = await configService.loadUserConfig();
    const hasKey = Boolean(
      configService.resolveApiKey(provider.name, userConfig),
    );

    console.log("\x1b[1mResolved configuration\x1b[0m\n");
    console.log(`  Repo config: ${configService.repoConfigPath}`);
    console.log(`  User config: ${configService.userConfigDir}/config.yml (API keys only)`);
    console.log(`  Provider: ${provider.name} (from repo config file)`);
    console.log(`  Model: ${provider.model} (from repo config file)`);
    console.log(`  Max tokens: ${provider.maxTokens}`);
    const baseUrl = configService.resolveProviderBaseUrl(provider);
    if (baseUrl) {
      console.log(`  Ollama host: ${baseUrl}`);
    }
    console.log(
      `  API key: ${provider.name === "ollama" ? "not required (local)" : hasKey ? "configured" : "missing"}`,
    );
    console.log(`  Strictness: ${config.review.strictness}`);
    console.log(
      `  Chunking: ${config.review.chunking.enabled ? "on" : "off"} (${config.review.chunking.maxFilesPerChunk} files, ${config.review.chunking.delayMsBetweenChunks}ms delay)`,
    );
    console.log("\nFull repo config:\n");
    console.log(stringify(config, { lineWidth: 0 }));
  }

  async set(key: string, value: string): Promise<void> {
    if (key === "provider" || key === "provider.name") {
      if (!isValidProvider(value)) {
        throw new Error(`Invalid provider "${value}". Use openai, anthropic, gemini, or ollama.`);
      }
      if (key === "provider") {
        console.log(
          "\x1b[33mTip:\x1b[0m use `veynt config set provider.name <name>` (you used `provider`). Applying as provider.name.",
        );
        key = "provider.name";
      }
    }

    const updated = await this.context.configService.setConfigValue(key, value);
    const { configService } = this.context;

    console.log(`\x1b[32m✓ Set ${key} = ${value}\x1b[0m`);
    console.log(`  Updated: ${configService.repoConfigPath}`);

    if (key === "provider.name" || key.startsWith("provider.")) {
      console.log(`  Provider: ${updated.provider.name} (${updated.provider.model})`);
    }
    if (key.startsWith("review.")) {
      console.log(`  Strictness: ${updated.review.strictness}`);
    }
  }
}
