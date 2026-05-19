import { describe, it, expect } from "vitest";
import { WorkspaceBuilder } from "../../packages/analyzers/src/workspace-builder.js";
import type { RepoSample } from "../../packages/analyzers/src/repo-sampler.js";
import type { AnalysisResult } from "../../packages/analyzers/src/types.js";

const baseAnalysis: AnalysisResult = {
  profile: {
    framework: "node",
    language: "typescript",
    architectureStyle: "monorepo",
    packageManager: "pnpm",
    detectedAt: new Date().toISOString(),
    monorepo: true,
  },
  architecture: {
    layers: ["packages/cli", "packages/core"],
    separationOfConcerns: ["CLI stays thin"],
    namingConventions: { files: "kebab-case" },
    layeringConventions: ["packages/*"],
  },
  standards: {
    commentDensity: "low",
    nullabilityPattern: "explicit",
    utilityReusePatterns: [],
    dependencyPatterns: [],
    antiPatterns: [],
  },
};

describe("WorkspaceBuilder", () => {
  it("builds monorepo workspace from sample paths", async () => {
    const sample: RepoSample = {
      pathListing: [
        "packages/cli/src/index.ts",
        "packages/core/src/types.ts",
        "package.json",
      ],
      readmeExcerpt: "AI-native reviewer",
      packageSummary: {
        name: "veynt",
        description: "Pre-commit reviewer",
        dependencies: ["typescript"],
      },
      monorepoPackagePaths: ["packages/cli", "packages/core"],
      monorepoPackages: [
        { name: "@veynt/cli", path: "packages/cli" },
        { name: "@veynt/core", path: "packages/core" },
      ],
      codeSamples: [],
    };

    const workspace = await new WorkspaceBuilder().build(process.cwd(), sample, baseAnalysis);

    expect(workspace.packages.length).toBeGreaterThan(0);
    expect(workspace.overview).toContain("veynt");
    expect(workspace.tokenIndex.length).toBeGreaterThan(50);
    expect(workspace.areas.some((a) => a.id.startsWith("packages/"))).toBe(true);
  });
});
