import { Command } from "commander";
import { resolveRepoRoot } from "@veynt/core";
import { InitCommand } from "./commands/init.js";
import { AnalyseCommand } from "./commands/analyse.js";
import { ScanCommand } from "./commands/scan.js";
import { OverrideCommand } from "./commands/override.js";
import { IgnoreCommand } from "./commands/ignore.js";
import { ConfigCommand } from "./commands/config.js";
import { HooksCommand } from "./commands/hooks.js";
import { DashboardCommand } from "./commands/dashboard.js";
import { AppContext } from "./app-context.js";

export async function runCli(argv: string[]): Promise<void> {
  const repoRoot = await resolveRepoRoot();
  const context = new AppContext(repoRoot);

  const program = new Command();

  program
    .name("veynt")
    .description("AI-native pre-commit engineering reviewer for Git diffs")
    .version("0.1.0");

  program
    .command("init")
    .description("Configure Veynt and install Git pre-commit hooks")
    .option("--provider <name>", "AI provider: openai | anthropic | gemini | ollama")
    .option("--strictness <level>", "advisory | balanced | strict | critical")
    .option("--no-hooks", "Skip Git hook installation")
    .option("-y, --non-interactive", "Use defaults / flags only (no prompts)")
    .action(async (opts) => {
      await new InitCommand(context).execute({
        ...opts,
        nonInteractive: opts.nonInteractive ?? opts.y,
      });
    });

  program
    .command("analyse")
    .description("Analyse repository and generate baseline profiles (runs in background by default)")
    .option("--wait", "Run in foreground and block until complete")
    .option("--status", "Show background analyse progress")
    .option("--worker", "Internal: run analyse job", false)
    .action(async (opts) => {
      await new AnalyseCommand(context).execute({
        wait: opts.wait,
        status: opts.status,
        worker: opts.worker,
      });
    });

  program
    .command("scan")
    .description("Scan staged changes or branch diff")
    .option("--branch <name>", "Compare against target branch (CI mode)")
    .option("--hook", "Invoked from Git pre-commit hook")
    .option("--verbose", "Show debug output")
    .option("--no-ui", "Skip local review dashboard")
    .action(async (opts) => {
      const exitCode = await new ScanCommand(context).execute({
        ...opts,
        noUi: opts.noUi,
      });
      process.exit(exitCode);
    });

  program
    .command("dashboard")
    .description("Run local review dashboard (127.0.0.1 only)")
    .option("--repo <path>", "Repository root", repoRoot)
    .action(async (opts: { repo: string }) => {
      await new DashboardCommand().execute(opts.repo);
    });

  program
    .command("override")
    .description("Allow temporary override for the next commit")
    .option("--reason <text>", "Justification for override")
    .action(async (opts) => {
      await new OverrideCommand(context).execute(opts);
    });

  program
    .command("ignore <findingId>")
    .description("Suppress a specific finding")
    .action(async (findingId: string) => {
      await new IgnoreCommand(context).execute(findingId);
    });

  const configCmd = program.command("config").description("Manage review configuration");

  configCmd
    .command("show")
    .description("Show resolved config (repo + effective values)")
    .action(async () => {
      await new ConfigCommand(context).show();
    });

  configCmd
    .command("set <key> <value>")
    .description("Set a config value (e.g. review.strictness strict)")
    .action(async (key: string, value: string) => {
      await new ConfigCommand(context).set(key, value);
    });

  const hooksCmd = program.command("hooks").description("Git hook maintenance");

  hooksCmd
    .command("reinstall")
    .description("Repair or reinstall pre-commit hooks")
    .action(async () => {
      await new HooksCommand(context).reinstall();
    });

  await program.parseAsync(argv);
}
