import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDirectory } from "@veynt/core";
import { AnalyseStatusStore, type AnalyseStatus } from "./analyse-status.js";

function resolveCliEntry(): string {
  const invoked = process.argv[1];
  if (invoked) {
    const normalized = invoked.replace(/\\/g, "/");
    if (normalized.endsWith("/bin/veynt.js")) {
      return join(dirname(invoked), "..", "dist", "index.js");
    }
    return invoked;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const dir = dirname(currentFile);

  // Esbuild bundle: entire CLI is dist/index.js
  if (basename(dir) === "dist" && basename(currentFile) === "index.js") {
    return currentFile;
  }

  // tsc output: dist/analyse/background-runner.js -> dist/index.js
  return join(dir, "..", "index.js");
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawns analyse as a detached background process so the CLI returns immediately.
 */
export class BackgroundAnalyseRunner {
  constructor(
    private readonly repoRoot: string,
    private readonly statusStore: AnalyseStatusStore,
  ) {}

  async isRunning(): Promise<boolean> {
    const status = await this.statusStore.read();
    if (status?.state !== "running" || !status.pid) {
      return false;
    }

    if (await isProcessAlive(status.pid)) {
      return true;
    }

    await this.statusStore.markFailed("Analyse process exited unexpectedly.");
    return false;
  }

  async start(): Promise<{ alreadyRunning: boolean; status: AnalyseStatus }> {
    if (await this.isRunning()) {
      const status = (await this.statusStore.read())!;
      return { alreadyRunning: true, status };
    }

    await ensureDirectory(this.statusStore.directory);

    const logFd = openSync(this.statusStore.logPath, "a");
    const cliEntry = resolveCliEntry();

    const child = spawn(
      process.execPath,
      [cliEntry, "analyse", "--worker"],
      {
        cwd: this.repoRoot,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: process.env,
        windowsHide: true,
      },
    );

    closeSync(logFd);

    if (!child.pid) {
      throw new Error("Failed to start background analyse process.");
    }

    child.unref();

    const status = await this.statusStore.markRunning(child.pid);
    return { alreadyRunning: false, status };
  }

  formatStatusMessage(status: AnalyseStatus): string {
    switch (status.state) {
      case "running":
        return `Analyse in progress (pid ${status.pid}). First run with AI can take several minutes.`;
      case "completed":
        return `Last analyse completed at ${status.completedAt ?? "unknown"}.`;
      case "failed":
        return `Last analyse failed: ${status.error ?? "unknown error"}`;
      default:
        return "No analyse has been run yet.";
    }
  }
}
