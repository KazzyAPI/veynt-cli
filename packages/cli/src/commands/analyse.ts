import type { AppContext } from "../app-context.js";
import { AnalyseStatusStore } from "../analyse/analyse-status.js";
import { BackgroundAnalyseRunner } from "../analyse/background-runner.js";
import { AnalyseWorker } from "../analyse/analyse-worker.js";

export interface AnalyseOptions {
  wait?: boolean;
  status?: boolean;
  worker?: boolean;
}

export class AnalyseCommand {
  constructor(private readonly context: AppContext) {}

  async execute(options: AnalyseOptions = {}): Promise<void> {
    const statusStore = new AnalyseStatusStore(this.context.configService.veyntDir);

    if (options.worker) {
      await new AnalyseWorker(this.context, statusStore).execute();
      return;
    }

    if (options.status) {
      await this.printStatus(statusStore);
      return;
    }

    if (options.wait) {
      await this.runForeground(statusStore);
      return;
    }

    await this.runBackground(statusStore);
  }

  private async runBackground(statusStore: AnalyseStatusStore): Promise<void> {
    const runner = new BackgroundAnalyseRunner(this.context.repoRoot, statusStore);
    const { alreadyRunning, status } = await runner.start();

    if (alreadyRunning) {
      console.log("\x1b[33m⚠ Analyse already running.\x1b[0m");
    } else {
      console.log("\x1b[32m✓ Analyse started in the background\x1b[0m");
      console.log("  First run with AI enrichment can take several minutes.");
    }

    console.log(`  ${runner.formatStatusMessage(status)}`);
    console.log(`  Log: ${status.logFile}`);
    console.log("\nCheck progress:");
    console.log("  veynt analyse --status");
    console.log("\nOr wait for completion:");
    console.log("  veynt analyse --wait");
  }

  private async runForeground(statusStore: AnalyseStatusStore): Promise<void> {
    const runner = new BackgroundAnalyseRunner(this.context.repoRoot, statusStore);

    if (await runner.isRunning()) {
      console.log("\x1b[33m⚠ Background analyse already in progress.\x1b[0m");
      console.log("  Wait for it to finish or check: veynt analyse --status");
      return;
    }

    console.log("Analysing repository (foreground)...\n");
    await new AnalyseWorker(this.context, statusStore).execute();

    const status = await statusStore.read();
    if (status?.state === "completed") {
      console.log("\n\x1b[32m✓ Repository baseline generated\x1b[0m");
      console.log(
        "  Files: .veynt/profile.yml, architecture.yml, standards.yml, workspace.yml",
      );
      console.log("  Commit `.veynt/` to establish your repository baseline.");
    }
  }

  private async printStatus(statusStore: AnalyseStatusStore): Promise<void> {
    const runner = new BackgroundAnalyseRunner(this.context.repoRoot, statusStore);
    const running = await runner.isRunning();
    const status = (await statusStore.read()) ?? {
      state: "idle" as const,
      logFile: statusStore.logPath,
    };

    console.log("\x1b[1mAnalyse status\x1b[0m\n");
    console.log(`  State: ${running ? "running" : status.state}`);
    if (status.pid) {
      console.log(`  PID: ${status.pid}`);
    }
    if (status.startedAt) {
      console.log(`  Started: ${status.startedAt}`);
    }
    if (status.completedAt) {
      console.log(`  Finished: ${status.completedAt}`);
    }
    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
    console.log(`  Log: ${status.logFile}`);

    if (status.state === "completed") {
      console.log("\n  Baseline files are ready under .veynt/");
    }
  }
}
