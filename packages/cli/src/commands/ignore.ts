import type { AppContext } from "../app-context.js";

export class IgnoreCommand {
  constructor(private readonly context: AppContext) {}

  async execute(findingId: string): Promise<void> {
    const ignore = await this.context.configService.loadIgnoreConfig();
    const normalizedId = findingId.startsWith("finding-")
      ? findingId.replace("finding-", "VNT-")
      : findingId;

    if (ignore.findings.includes(normalizedId)) {
      console.log(`Finding ${normalizedId} is already ignored.`);
      return;
    }

    await this.context.configService.saveIgnoreConfig({
      findings: [...ignore.findings, normalizedId],
      rules: ignore.rules,
    });

    console.log(`\x1b[32m✓ Ignored finding ${normalizedId}\x1b[0m`);
    console.log("  Persisted to .veynt/ignore.yml — commit to share with team.");
  }
}
