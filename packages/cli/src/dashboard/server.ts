import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppContext } from "../app-context.js";
import { OverrideCommand } from "../commands/override.js";
import { IgnoreCommand } from "../commands/ignore.js";
import {
  readSession,
  writeServerInfo,
  clearServerInfo,
  readServerInfo,
  type DashboardServerInfo,
} from "./session.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

export interface ScanDashboardHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

export function resolveDashboardPublicDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "dashboard", "public");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isLocalRequest(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function buildRequestHandler(repoRoot: string, publicDir: string) {
  const context = new AppContext(repoRoot);

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!req.url || !isLocalRequest(req)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const url = new URL(req.url, "http://127.0.0.1");

    try {
      if (req.method === "GET" && url.pathname === "/api/status") {
        const session = await readSession(repoRoot);
        sendJson(res, 200, { session });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/override") {
        const raw = await readBody(req);
        let reason: string | undefined;
        if (raw) {
          try {
            reason = (JSON.parse(raw) as { reason?: string }).reason;
          } catch {
            reason = raw;
          }
        }
        await new OverrideCommand(context).execute({ reason });
        sendJson(res, 200, { ok: true });
        return;
      }

      const ignoreMatch = url.pathname.match(/^\/api\/ignore\/(.+)$/);
      if (req.method === "POST" && ignoreMatch) {
        const findingId = decodeURIComponent(ignoreMatch[1]!);
        await new IgnoreCommand(context).execute(findingId);
        sendJson(res, 200, { ok: true, findingId });
        return;
      }

      if (req.method === "GET") {
        const filePath =
          url.pathname === "/" ? join(publicDir, "index.html") : join(publicDir, url.pathname);
        const normalized = filePath.replace(publicDir, "");
        if (normalized.includes("..")) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        const ext = extname(filePath);
        const content = await readFile(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(content);
        return;
      }

      res.writeHead(405);
      res.end("Method not allowed");
    } catch (error) {
      console.error("Dashboard server request failed:", error);
      sendJson(res, 500, { error: "Internal server error" });
    }
  };
}

async function listenOnLocalhost(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind dashboard server");
  }
  return address.port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Stops a leftover dashboard from a previous scan (detached or crashed). */
export async function stopStaleDashboardServer(repoRoot: string): Promise<void> {
  const info = await readServerInfo(repoRoot);
  if (!info || info.pid === process.pid) {
    return;
  }
  try {
    process.kill(info.pid, "SIGTERM");
  } catch {
    // Already exited
  }
  await clearServerInfo(repoRoot);
}

/** In-process dashboard tied to the current scan — call stop() when the scan finishes. */
export async function createScanDashboard(repoRoot: string): Promise<ScanDashboardHandle> {
  const publicDir = resolveDashboardPublicDir();
  const server = createServer(buildRequestHandler(repoRoot, publicDir));
  const port = await listenOnLocalhost(server);

  const info: DashboardServerInfo = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
  };
  await writeServerInfo(repoRoot, info);

  const url = `http://127.0.0.1:${port}`;

  return {
    port,
    url,
    stop: async () => {
      await closeServer(server);
      await clearServerInfo(repoRoot);
    },
  };
}

/** Long-running dashboard for `veynt dashboard` (manual use). */
export async function startDashboardServer(repoRoot: string): Promise<number> {
  await stopStaleDashboardServer(repoRoot);
  const handle = await createScanDashboard(repoRoot);
  return handle.port;
}
