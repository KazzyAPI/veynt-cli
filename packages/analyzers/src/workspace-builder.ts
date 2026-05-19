import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  formatWorkspaceTokens,
  type WorkspaceArea,
  type WorkspaceDocument,
  type WorkspacePackageRef,
} from "@veynt/core";
import type { RepoSample } from "./repo-sampler.js";
import type { AnalysisResult } from "./types.js";

const PACKAGE_DIR = /^packages\/([^/]+)/;

/**
 * Builds a comprehensive workspace document from repository structure (no AI required).
 */
export class WorkspaceBuilder {
  async build(
    repoRoot: string,
    sample: RepoSample,
    analysis: AnalysisResult,
  ): Promise<WorkspaceDocument> {
    const packages = await this.collectPackages(repoRoot, sample);
    const areas = this.groupPathsIntoAreas(sample.pathListing);
    const entryPoints = this.detectEntryPoints(sample.pathListing);
    const commands = this.detectCliCommands(sample);
    const techStack = this.inferTechStack(analysis, sample, packages);
    const overview = this.buildProgrammaticOverview(
      sample,
      analysis,
      packages,
      areas,
      entryPoints,
    );

    const draft: Omit<WorkspaceDocument, "tokenIndex"> = {
      generatedAt: new Date().toISOString(),
      overview,
      repository: {
        name: String(sample.packageSummary?.name ?? basename(repoRoot)),
        description:
          typeof sample.packageSummary?.description === "string"
            ? sample.packageSummary.description
            : undefined,
        packageManager: analysis.profile.packageManager,
        monorepo: packages.length > 1 || analysis.profile.monorepo === true,
        rootScripts: sample.rootScripts,
      },
      packages,
      areas,
      entryPoints,
      commands,
      techStack,
      conventions: [
        ...analysis.architecture.separationOfConcerns,
        ...Object.entries(analysis.architecture.namingConventions).map(
          ([k, v]) => `${k}: ${v}`,
        ),
        ...analysis.standards.utilityReusePatterns,
      ],
      reviewHints: this.defaultReviewHints(analysis),
      dataFlow: this.inferDataFlow(packages),
    };

    const doc = { ...draft, tokenIndex: "" } as WorkspaceDocument;
    doc.tokenIndex = formatWorkspaceTokens(doc);
    return doc;
  }

  private async collectPackages(
    repoRoot: string,
    sample: RepoSample,
  ): Promise<WorkspacePackageRef[]> {
    const refs: WorkspacePackageRef[] = [];

    for (const pkgPath of sample.monorepoPackagePaths) {
      const full = join(repoRoot, pkgPath, "package.json");
      try {
        const raw = JSON.parse(await readFile(full, "utf-8")) as Record<string, unknown>;
        const name = String(raw.name ?? pkgPath);
        const description =
          typeof raw.description === "string" ? raw.description : undefined;
        const deps = Object.keys((raw.dependencies as object) ?? {}).slice(0, 15);
        refs.push({
          name,
          path: pkgPath.replace(/\\/g, "/"),
          role: this.inferPackageRole(pkgPath, name, deps),
          description,
          dependencies: deps.length > 0 ? deps : undefined,
        });
      } catch {
        refs.push({
          name: basename(pkgPath),
          path: pkgPath.replace(/\\/g, "/"),
          role: "package",
        });
      }
    }

    if (refs.length === 0 && sample.packageSummary) {
      refs.push({
        name: String(sample.packageSummary.name ?? "root"),
        path: ".",
        role: "application",
        description:
          typeof sample.packageSummary.description === "string"
            ? sample.packageSummary.description
            : undefined,
      });
    }

    return refs;
  }

  private groupPathsIntoAreas(paths: string[]): WorkspaceArea[] {
    const buckets = new Map<string, string[]>();

    for (const path of paths) {
      const normalized = path.replace(/\\/g, "/");
      let areaId: string;

      const pkgMatch = normalized.match(PACKAGE_DIR);
      if (pkgMatch) {
        areaId = `packages/${pkgMatch[1]}`;
      } else if (normalized.startsWith("tests/") || normalized.includes("/tests/")) {
        areaId = "tests";
      } else if (normalized.startsWith("docs/")) {
        areaId = "docs";
      } else if (normalized.startsWith(".github/")) {
        areaId = "ci";
      } else {
        const top = normalized.split("/")[0] ?? "root";
        areaId = top.includes(".") ? "root" : top;
      }

      const list = buckets.get(areaId) ?? [];
      list.push(normalized);
      buckets.set(areaId, list);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, areaPaths]) => ({
        id,
        label: id,
        paths: areaPaths.sort(),
        description: this.describeArea(id),
      }));
  }

  private describeArea(id: string): string {
    if (id.startsWith("packages/")) {
      return `Monorepo package: ${id.replace("packages/", "")}`;
    }
    const labels: Record<string, string> = {
      tests: "Automated tests",
      docs: "Documentation",
      ci: "CI and automation",
      root: "Repository root files",
    };
    return labels[id] ?? `Top-level area: ${id}`;
  }

  private detectEntryPoints(paths: string[]): string[] {
    const patterns = [
      /^packages\/[^/]+\/src\/index\.tsx?$/,
      /^packages\/cli\/src\/index\.tsx?$/,
      /^src\/index\.tsx?$/,
      /^src\/main\.(java|kt)$/,
    ];
    return paths
      .map((p) => p.replace(/\\/g, "/"))
      .filter((p) => patterns.some((re) => re.test(p)))
      .slice(0, 12);
  }

  private detectCliCommands(sample: RepoSample): string[] | undefined {
    const fromCli = sample.codeSamples.find((s) => /cli\.ts|command/i.test(s.path));
    if (!fromCli) {
      return ["init", "analyse", "scan", "config", "hooks", "override", "ignore"];
    }

    const matches = fromCli.excerpt.matchAll(/\.command\(\s*["'`]([^"'`]+)["'`]/g);
    const cmds = [...matches].map((m) => m[1]!);
    return cmds.length > 0 ? cmds : undefined;
  }

  private inferPackageRole(pkgPath: string, _name: string, deps: string[]): string {
    const segment = basename(pkgPath);
    if (segment === "cli") return "CLI entrypoint and commands";
    if (segment === "core") return "Shared types and utilities";
    if (segment === "config") return "Configuration loading and merge";
    if (segment === "providers") return "AI provider adapters";
    if (segment === "review-engine") return "Review orchestration and prompts";
    if (segment === "analyzers") return "Repository analysis and baselines";
    if (segment === "git") return "Git diff and hook integration";
    if (segment === "findings") return "Finding parsing and blocking";
    if (segment === "hooks") return "Git hook installation";
    if (deps.some((d) => d.startsWith("@veynt/"))) return "internal library";
    return "library";
  }

  private inferTechStack(
    analysis: AnalysisResult,
    sample: RepoSample,
    packages: WorkspacePackageRef[],
  ): string[] {
    const stack = new Set<string>([
      analysis.profile.language,
      analysis.profile.framework,
      analysis.profile.packageManager,
    ]);

    if (sample.packageSummary?.dependencies) {
      for (const dep of sample.packageSummary.dependencies as string[]) {
        if (dep.startsWith("@")) stack.add(dep);
        else stack.add(dep.split("/")[0] ?? dep);
      }
    }

    for (const pkg of packages) {
      pkg.dependencies?.forEach((d) => stack.add(d));
    }

    return [...stack].filter(Boolean).slice(0, 25);
  }

  private inferDataFlow(packages: WorkspacePackageRef[]): string | undefined {
    const names = new Set(packages.map((p) => p.name));
    if (!names.has("@veynt/cli")) {
      return undefined;
    }

    return [
      "Git pre-commit hook invokes `veynt scan`.",
      "CLI loads `.veynt/config.yml` and baseline (profile, architecture, standards, workspace).",
      "`review-engine` builds a tokenized context package from the diff + baseline.",
      "Chunked AI review runs through `providers`; findings parsed by `findings`.",
      "`veynt analyse` populates baseline via `analyzers` (heuristics + optional AI).",
    ].join(" ");
  }

  private defaultReviewHints(analysis: AnalysisResult): string[] {
    return [
      "Respect monorepo package boundaries — avoid cross-package coupling that bypasses public APIs.",
      "Keep CLI commands thin; business logic belongs in review-engine, analyzers, or config.",
      "Do not commit API keys; user secrets live in ~/.veynt/config.yml only.",
      "Match existing TypeScript conventions and pnpm workspace dependency patterns.",
      ...analysis.standards.antiPatterns.map((a) => `Avoid: ${a}`),
    ];
  }

  private buildProgrammaticOverview(
    sample: RepoSample,
    analysis: AnalysisResult,
    packages: WorkspacePackageRef[],
    areas: WorkspaceArea[],
    entryPoints: string[],
  ): string {
    const name = String(sample.packageSummary?.name ?? "this repository");
    const desc =
      typeof sample.packageSummary?.description === "string"
        ? sample.packageSummary.description
        : "No description in package.json.";

    const pkgList =
      packages.length > 0
        ? packages.map((p) => `- **${p.name}** (\`${p.path}\`): ${p.role}`).join("\n")
        : "- Single-package layout";

    const areaSummary = areas
      .slice(0, 8)
      .map((a) => `- \`${a.id}\`: ${a.paths.length} tracked path(s)`)
      .join("\n");

    return [
      `**${name}** is a ${analysis.profile.language} / ${analysis.profile.framework} project using ${analysis.profile.packageManager}.`,
      desc,
      analysis.profile.summary ?? "",
      "",
      "### Structure",
      pkgList,
      "",
      "### Key areas",
      areaSummary,
      "",
      "### Entry points",
      entryPoints.length > 0
        ? entryPoints.map((e) => `- \`${e}\``).join("\n")
        : "- (none detected)",
      "",
      sample.readmeExcerpt
        ? `### README excerpt\n${sample.readmeExcerpt.slice(0, 800)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
