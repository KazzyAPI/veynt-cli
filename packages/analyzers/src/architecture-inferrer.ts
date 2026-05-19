import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ArchitectureProfile } from "@veynt/core";

const LAYER_PATTERNS: Record<string, RegExp[]> = {
  controllers: [/controller/i, /handlers?/i, /routes?/i],
  services: [/service/i, /use-?case/i, /application/i],
  domain: [/domain/i, /entities/i, /models/i, /enums?/i],
  infrastructure: [/repository/i, /infra/i, /adapters?/i, /persistence/i],
  presentation: [/components?/i, /views?/i, /pages?/i],
};

/**
 * Infers layering and naming conventions from directory structure.
 */
export class ArchitectureInferrer {
  async infer(repoRoot: string, framework: string): Promise<ArchitectureProfile> {
    const monorepoLayers = await this.detectMonorepoPackages(repoRoot);
    const layers =
      monorepoLayers.length > 0
        ? monorepoLayers
        : await this.detectLayers(repoRoot);
    const namingConventions = this.inferNamingConventions(framework);

    const separationOfConcerns =
      monorepoLayers.length > 0
        ? [
            "Each packages/* workspace is a bounded module with a single responsibility",
            "CLI orchestrates commands; review-engine owns review flow; providers are adapters only",
            "Shared types live in @veynt/core; config loading stays in @veynt/config",
            "Cross-package imports use workspace:* and public package entrypoints only",
          ]
        : [
            "Business logic belongs in domain or service layers",
            "Controllers handle HTTP only — no business rules",
            "Repositories handle persistence only",
          ];

    return {
      layers,
      separationOfConcerns,
      namingConventions,
      layeringConventions: layers.length > 0 ? layers : ["flat"],
      moduleBoundaries:
        monorepoLayers.length > 0
          ? ["Do not bypass package boundaries with deep relative imports across packages/*"]
          : undefined,
    };
  }

  private async detectMonorepoPackages(repoRoot: string): Promise<string[]> {
    const packagesDir = join(repoRoot, "packages");
    try {
      const entries = await readdir(packagesDir);
      return entries
        .filter((e) => !e.startsWith("."))
        .map((e) => `packages/${e}`);
    } catch {
      return [];
    }
  }

  private async detectLayers(repoRoot: string, depth = 0, maxDepth = 4): Promise<string[]> {
    if (depth > maxDepth) return [];

    const found = new Set<string>();
    let entries: string[];

    try {
      entries = await readdir(repoRoot);
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") {
        continue;
      }

      const fullPath = join(repoRoot, entry);
      const entryStat = await stat(fullPath).catch(() => null);
      if (!entryStat?.isDirectory()) continue;

      for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
        if (patterns.some((p) => p.test(entry))) {
          found.add(layer);
        }
      }

      const nested = await this.detectLayers(fullPath, depth + 1, maxDepth);
      nested.forEach((l) => found.add(l));
    }

    return [...found];
  }

  private inferNamingConventions(framework: string): Record<string, string> {
    const javaStyle = {
      classes: "PascalCase",
      methods: "camelCase",
      constants: "UPPER_SNAKE_CASE",
    };
    const tsStyle = {
      components: "PascalCase",
      functions: "camelCase",
      files: "kebab-case or PascalCase for components",
    };

    if (framework === "spring-boot") return javaStyle;
    if (["react", "angular", "next", "nestjs", "express", "fastify", "node"].includes(framework)) {
      return tsStyle;
    }
    return { general: "follow existing repository conventions" };
  }
}
