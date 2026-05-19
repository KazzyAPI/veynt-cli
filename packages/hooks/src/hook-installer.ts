import { chmod, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "@veynt/core";
import { PRE_COMMIT_SCRIPT } from "./pre-commit-hook.js";

/**
 * Installs and repairs Git pre-commit hooks. Called from `veynt init` by default.
 */
export class HookInstaller {
  constructor(private readonly repoRoot: string) {}

  async install(): Promise<void> {
    await this.writeHook(await this.readExistingHook());
  }

  async reinstall(): Promise<void> {
    await this.writeHook(await this.readExistingHook());
  }

  private async readExistingHook(): Promise<string> {
    const hookPath = join(this.repoRoot, ".git", "hooks", "pre-commit");
    if (!(await fileExists(hookPath))) {
      return "";
    }
    return readFile(hookPath, "utf-8");
  }

  private async writeHook(existing: string): Promise<void> {
    const hooksDir = join(this.repoRoot, ".git", "hooks");
    await mkdir(hooksDir, { recursive: true });

    const hookPath = join(hooksDir, "pre-commit");
    const withoutVeynt = this.stripVeyntBlock(existing);
    const content = this.mergeHookContent(withoutVeynt);

    await writeFile(hookPath, content, "utf-8");
    await this.makeExecutable(hookPath);
  }

  private mergeHookContent(withoutVeynt: string): string {
    const meaningful = withoutVeynt
      .split("\n")
      .filter((line) => line.trim().length > 0 && line.trim() !== "#!/bin/sh")
      .join("\n")
      .trim();
    return meaningful.length > 0 ? `${meaningful}\n\n${PRE_COMMIT_SCRIPT}` : PRE_COMMIT_SCRIPT;
  }

  /** Removes the Veynt hook block; keeps any other pre-commit logic. */
  stripVeyntBlock(content: string): string {
    let result = content.replace(
      /# veynt-pre-commit[\s\S]*?^exit 127\s*$/m,
      "",
    );
    result = result.replace(
      /# veynt-pre-commit[\s\S]*?^veynt scan --hook\s*[\r\n]+^exit \$\?\s*$/m,
      "",
    );
    result = result.replace(/^\s*veynt scan --hook\s*$/gm, "");
    result = result.replace(/\n{3,}/g, "\n\n").trim();
    return result;
  }

  private async makeExecutable(hookPath: string): Promise<void> {
    if (process.platform !== "win32") {
      await chmod(hookPath, 0o755);
    }
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await access(join(this.repoRoot, ".git"));
      return true;
    } catch {
      return false;
    }
  }
}
