import { dirname } from "node:path";
import type { BaselineFiles } from "@veynt/config";
import type { ReviewContextPackage } from "@veynt/core";
import { RuleFileAnalyzer, type RuleFileIssue } from "@veynt/analyzers";
import type { GitDiffResult } from "@veynt/git";
import { GitService } from "@veynt/git";
import type { BuildContextInput } from "./types.js";

/**
 * Assembles the structured review context package per PRD — not a raw diff.
 */
export class ContextPackageBuilder {
  constructor(
    private readonly gitService: GitService,
    private readonly ruleFileAnalyzer = new RuleFileAnalyzer(),
  ) {}

  async build(
    input: BuildContextInput,
    baseline: BaselineFiles,
  ): Promise<ReviewContextPackage> {
    const { diff, config, mode } = input;
    const ruleFileChanges = diff.files.filter((f) => f.isRuleFile).map((f) => f.path);
    const impactedAreas = this.inferImpactedAreas(diff.files.map((f) => f.path));
    const surroundingFiles = await this.gatherSurroundingFiles(
      diff.files.map((f) => f.path),
      config.scan.maxContextFiles,
    );

    return {
      repository: {
        framework: baseline.profile.framework,
        architectureStyle: baseline.profile.architectureStyle,
        strictness: config.review.strictness,
        profile: baseline.profile,
        architecture: baseline.architecture,
        standards: baseline.standards,
        workspace: baseline.workspace,
      },
      changes: {
        filesChanged: diff.files.map((f) => f.path),
        fileChanges: diff.files,
        dependencyChanges: diff.dependencyChanges,
        ruleFileChanges,
      },
      context: {
        relatedUtilities: this.extractUtilityHints(diff.files.map((f) => f.path)),
        surroundingFiles,
        impactedAreas,
      },
      mode,
    };
  }

  buildStaticRuleFindings(diff: GitDiffResult): RuleFileIssue[] {
    return this.ruleFileAnalyzer.analyze(diff.files);
  }

  private inferImpactedAreas(paths: string[]): string[] {
    const areas = new Set<string>();
    for (const path of paths) {
      const parts = path.replace(/\\/g, "/").split("/");
      if (parts.length >= 2) {
        areas.add(parts.slice(0, 2).join("/"));
      }
      areas.add(dirname(path).replace(/\\/g, "/"));
    }
    return [...areas].filter((a) => a !== "." && a !== "");
  }

  private async gatherSurroundingFiles(
    changedPaths: string[],
    maxFiles: number,
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const dirs = [...new Set(changedPaths.map((p) => dirname(p)))];

    for (const _dir of dirs.slice(0, maxFiles)) {
      const content = await this.gitService
        .getFileContent(changedPaths[0] ?? "")
        .catch(() => null);
      if (content && changedPaths[0]) {
        result[changedPaths[0]] = content.slice(0, 4000);
      }
    }

    return result;
  }

  private extractUtilityHints(paths: string[]): string[] {
    return paths
      .filter((p) => /util|helper|common|shared/i.test(p))
      .map((p) => p.replace(/\\/g, "/"));
  }
}
