import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FileChange } from "@veynt/core";
import { DiffParser } from "./diff-parser.js";
import { RuleFileDetector } from "./rule-file-detector.js";
import type { GitDiffResult } from "./types.js";

const exec = promisify(execFile);

/**
 * Wraps Git CLI operations — keeps shell usage isolated for testability.
 */
export class GitService {
  constructor(
    private readonly cwd: string,
    private readonly diffParser = new DiffParser(),
    private readonly ruleFileDetector = new RuleFileDetector(),
  ) {}

  async getStagedDiff(): Promise<GitDiffResult> {
    const { stdout } = await this.runGit(["diff", "--cached", "--no-color"]);
    return this.buildDiffResult(stdout);
  }

  async getBranchDiff(targetBranch: string): Promise<GitDiffResult> {
    const ref = await this.resolveBranchRef(targetBranch);
    const { stdout } = await this.runGit(["diff", `${ref}...HEAD`, "--no-color"]);
    return this.buildDiffResult(stdout);
  }

  async getFileContent(path: string, ref = "HEAD"): Promise<string | null> {
    try {
      const { stdout } = await this.runGit(["show", `${ref}:${path}`]);
      return stdout;
    } catch {
      return null;
    }
  }

  async listStagedFiles(): Promise<string[]> {
    const { stdout } = await this.runGit([
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR",
    ]);
    return stdout.split("\n").filter(Boolean);
  }

  private async resolveBranchRef(branch: string): Promise<string> {
    try {
      await this.runGit(["rev-parse", "--verify", branch]);
      return branch;
    } catch {
      return `origin/${branch}`;
    }
  }

  private buildDiffResult(rawDiff: string): GitDiffResult {
    const parsed = this.diffParser.parse(rawDiff);
    const files: FileChange[] = parsed.map((file) => ({
      ...file,
      isRuleFile: this.ruleFileDetector.isRuleFile(file.path),
    }));
    const dependencyChanges = files
      .filter((f) => this.isDependencyFile(f.path))
      .map((f) => f.path);

    return { files, dependencyChanges };
  }

  private isDependencyFile(path: string): boolean {
    const names = [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "pom.xml",
      "build.gradle",
      "requirements.txt",
      "Cargo.toml",
    ];
    return names.some((name) => path.endsWith(name));
  }

  private async runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return exec("git", args, {
      cwd: this.cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
    });
  }
}
