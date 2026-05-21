import { startDashboardServer } from "../dashboard/server.js";

export class DashboardCommand {
  async execute(repoRoot: string): Promise<void> {
    const port = await startDashboardServer(repoRoot);
    // Keep process alive for detached worker
    process.stderr.write(`veynt dashboard listening on http://127.0.0.1:${port}\n`);
  }
}
