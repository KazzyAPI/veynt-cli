import { writeTextFile, ensureDirectory } from "@veynt/core";
import { join } from "node:path";
import type { AppContext } from "../app-context.js";

interface OverrideOptions {
  reason?: string;
}

export class OverrideCommand {
  constructor(private readonly context: AppContext) {}

  async execute(options: OverrideOptions): Promise<void> {
    const overridePath = join(this.context.repoRoot, ".veynt", "override");
    const payload = {
      reason: options.reason ?? "No reason provided",
      createdAt: new Date().toISOString(),
    };

    await ensureDirectory(join(this.context.repoRoot, ".veynt"));
    await writeTextFile(overridePath, JSON.stringify(payload, null, 2));

    console.log("\x1b[33m✓ Override active for next commit\x1b[0m");
    console.log("  The next `veynt scan` / pre-commit hook will skip AI review and allow the commit.");
    if (!options.reason) {
      console.log("  Tip: provide --reason for audit trail.");
    }
  }
}
