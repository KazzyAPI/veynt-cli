import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

export type AnalyseState = "idle" | "running" | "completed" | "failed";

export interface AnalyseStatus {
  state: AnalyseState;
  pid?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logFile: string;
}

const STATUS_FILE = "analyse-status.json";
const LOG_FILE = "analyse.log";

export class AnalyseStatusStore {
  constructor(private readonly veyntDir: string) {}

  get directory(): string {
    return this.veyntDir;
  }

  get statusPath(): string {
    return join(this.veyntDir, STATUS_FILE);
  }

  get logPath(): string {
    return join(this.veyntDir, LOG_FILE);
  }

  async read(): Promise<AnalyseStatus | null> {
    try {
      await access(this.statusPath);
      const raw = await readFile(this.statusPath, "utf-8");
      return JSON.parse(raw) as AnalyseStatus;
    } catch {
      return null;
    }
  }

  async write(status: AnalyseStatus): Promise<void> {
    await writeFile(this.statusPath, JSON.stringify(status, null, 2), "utf-8");
  }

  async markRunning(pid: number): Promise<AnalyseStatus> {
    const status: AnalyseStatus = {
      state: "running",
      pid,
      startedAt: new Date().toISOString(),
      logFile: this.logPath,
    };
    await this.write(status);
    return status;
  }

  async markCompleted(): Promise<void> {
    const current = (await this.read()) ?? { state: "idle", logFile: this.logPath };
    await this.write({
      ...current,
      state: "completed",
      completedAt: new Date().toISOString(),
      error: undefined,
    });
  }

  async markFailed(error: string): Promise<void> {
    const current = (await this.read()) ?? { state: "idle", logFile: this.logPath };
    await this.write({
      ...current,
      state: "failed",
      completedAt: new Date().toISOString(),
      error,
    });
  }
}
