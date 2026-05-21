import { ensureDirectory, readTextFile, writeTextFile, fileExists } from "@veynt/core";
import type { Finding } from "@veynt/findings";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

export type AiStatus = "pending" | "running" | "complete" | "skipped" | "error";

export interface ChunkProgress {
  current: number;
  total: number;
  filePaths: string[];
  waitingMs?: number;
}

export interface DashboardScanMeta {
  provider: string;
  model: string;
  aiEnabled: boolean;
  aiStatus: AiStatus;
  skipReason?: string;
  aiInvoked?: boolean;
  chunksTotal?: number;
  chunksInvoked?: number;
  chunkProgress?: ChunkProgress;
  stagedFileCount: number;
  errorMessage?: string;
}

export interface DashboardSession {
  phase: "idle" | "scanning" | "complete" | "error";
  blocked: boolean;
  hook: boolean;
  updatedAt: string;
  scan: DashboardScanMeta;
  findings: Finding[];
  overrideActive: boolean;
}

export interface DashboardServerInfo {
  pid: number;
  port: number;
  startedAt: string;
}

export function dashboardDir(repoRoot: string): string {
  return join(repoRoot, ".veynt", "dashboard");
}

export function sessionPath(repoRoot: string): string {
  return join(dashboardDir(repoRoot), "session.json");
}

export function serverInfoPath(repoRoot: string): string {
  return join(dashboardDir(repoRoot), "server.json");
}

export function createInitialSession(params: {
  hook: boolean;
  provider: string;
  model: string;
  aiEnabled: boolean;
  stagedFileCount: number;
  overrideActive: boolean;
}): DashboardSession {
  return {
    phase: "scanning",
    blocked: false,
    hook: params.hook,
    updatedAt: new Date().toISOString(),
    scan: {
      provider: params.provider,
      model: params.model,
      aiEnabled: params.aiEnabled,
      aiStatus: params.overrideActive ? "skipped" : params.aiEnabled ? "pending" : "skipped",
      skipReason: params.overrideActive ? "override-active" : undefined,
      stagedFileCount: params.stagedFileCount,
    },
    findings: [],
    overrideActive: params.overrideActive,
  };
}

export async function readSession(repoRoot: string): Promise<DashboardSession | null> {
  const path = sessionPath(repoRoot);
  if (!(await fileExists(path))) {
    return null;
  }
  try {
    const raw = await readTextFile(path);
    return JSON.parse(raw) as DashboardSession;
  } catch {
    return null;
  }
}

export async function writeSession(
  repoRoot: string,
  session: DashboardSession,
): Promise<void> {
  const dir = dashboardDir(repoRoot);
  await ensureDirectory(dir);
  await writeTextFile(sessionPath(repoRoot), JSON.stringify(session, null, 2));
}

export async function readServerInfo(repoRoot: string): Promise<DashboardServerInfo | null> {
  const path = serverInfoPath(repoRoot);
  if (!(await fileExists(path))) {
    return null;
  }
  try {
    const raw = await readTextFile(path);
    return JSON.parse(raw) as DashboardServerInfo;
  } catch {
    return null;
  }
}

export async function writeServerInfo(
  repoRoot: string,
  info: DashboardServerInfo,
): Promise<void> {
  await ensureDirectory(dashboardDir(repoRoot));
  await writeTextFile(serverInfoPath(repoRoot), JSON.stringify(info, null, 2));
}

export async function clearServerInfo(repoRoot: string): Promise<void> {
  const path = serverInfoPath(repoRoot);
  if (await fileExists(path)) {
    await unlink(path);
  }
}
