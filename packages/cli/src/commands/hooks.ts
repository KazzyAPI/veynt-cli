import type { AppContext } from "../app-context.js";

export class HooksCommand {
  constructor(private readonly context: AppContext) {}

  async reinstall(): Promise<void> {
    if (!(await this.context.hookInstaller.isGitRepository())) {
      throw new Error("Not a Git repository.");
    }

    await this.context.hookInstaller.reinstall();
    console.log("\x1b[32m✓ Pre-commit hook reinstalled\x1b[0m");
  }
}
