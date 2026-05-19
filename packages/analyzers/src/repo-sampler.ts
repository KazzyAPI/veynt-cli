import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".veynt",
  ".next",
  "target",
]);

const SAMPLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".java",
  ".kt",
  ".py",
  ".go",
  ".rs",
]);

export interface MonorepoPackageSummary {
  name: string;
  path: string;
  description?: string;
}

export interface RepoSample {
  pathListing: string[];
  readmeExcerpt: string | null;
  packageSummary: Record<string, unknown> | null;
  rootScripts?: string[];
  monorepoPackagePaths: string[];
  monorepoPackages: MonorepoPackageSummary[];
  codeSamples: Array<{ path: string; excerpt: string }>;
}

/**
 * Collects bounded repository samples so analyse prompts stay small per API call.
 */
export class RepoSampler {
  async sample(repoRoot: string): Promise<RepoSample> {
    const monorepoPackagePaths = await this.collectMonorepoPackagePaths(repoRoot);
    const [pathListing, readmeExcerpt, packageSummary, codeSamples, monorepoPackages] =
      await Promise.all([
        this.collectPaths(repoRoot, 280),
        this.readExcerpt(join(repoRoot, "README.md"), 2_000),
        this.readPackageSummary(join(repoRoot, "package.json")),
        this.collectCodeSamples(repoRoot, 6, 800),
        this.readMonorepoPackages(repoRoot, monorepoPackagePaths),
      ]);

    const rootScripts =
      packageSummary && Array.isArray((packageSummary as { scripts?: unknown }).scripts)
        ? Object.keys((packageSummary as { scripts: Record<string, string> }).scripts)
        : packageSummary && typeof packageSummary.scripts === "object"
          ? Object.keys(packageSummary.scripts as Record<string, string>)
          : undefined;

    return {
      pathListing,
      readmeExcerpt,
      packageSummary,
      rootScripts,
      monorepoPackagePaths,
      monorepoPackages,
      codeSamples,
    };
  }

  chunkPaths(paths: string[], maxPerChunk: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < paths.length; i += maxPerChunk) {
      chunks.push(paths.slice(i, i + maxPerChunk));
    }
    return chunks.length > 0 ? chunks : [[]];
  }

  private async collectMonorepoPackagePaths(repoRoot: string): Promise<string[]> {
    const packagesDir = join(repoRoot, "packages");
    try {
      const entries = await readdir(packagesDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => `packages/${e.name}`);
    } catch {
      return [];
    }
  }

  private async readMonorepoPackages(
    repoRoot: string,
    paths: string[],
  ): Promise<MonorepoPackageSummary[]> {
    const result: MonorepoPackageSummary[] = [];

    for (const pkgPath of paths) {
      try {
        const raw = JSON.parse(
          await readFile(join(repoRoot, pkgPath, "package.json"), "utf-8"),
        ) as Record<string, unknown>;
        result.push({
          name: String(raw.name ?? pkgPath),
          path: pkgPath,
          description: typeof raw.description === "string" ? raw.description : undefined,
        });
      } catch {
        result.push({ name: pkgPath, path: pkgPath });
      }
    }

    return result;
  }

  private async collectPaths(repoRoot: string, limit: number): Promise<string[]> {
    const paths: string[] = [];

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (paths.length >= limit || depth > 6) {
        return;
      }

      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (paths.length >= limit) {
          break;
        }
        if (entry.name.startsWith(".") && entry.name !== ".github") {
          continue;
        }
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }

        const fullPath = join(dir, entry.name);
        const rel = relative(repoRoot, fullPath).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else {
          paths.push(rel);
        }
      }
    };

    await walk(repoRoot, 0);
    return paths.sort();
  }

  private async collectCodeSamples(
    repoRoot: string,
    maxFiles: number,
    maxChars: number,
  ): Promise<Array<{ path: string; excerpt: string }>> {
    const paths = await this.collectPaths(repoRoot, 120);
    const priority = (p: string): number => {
      if (/packages\/cli\/src\/cli\.ts$/.test(p)) return 0;
      if (/packages\/review-engine\//.test(p)) return 1;
      if (/packages\/analyzers\//.test(p)) return 2;
      if (/packages\/config\//.test(p)) return 3;
      return 10;
    };

    const codePaths = paths
      .filter((p) => SAMPLE_EXTENSIONS.has(extname(p)))
      .sort((a, b) => priority(a) - priority(b));

    const samples: Array<{ path: string; excerpt: string }> = [];
    for (const path of codePaths) {
      if (samples.length >= maxFiles) {
        break;
      }
      const content = await this.readExcerpt(join(repoRoot, path), maxChars);
      if (content) {
        samples.push({ path, excerpt: content });
      }
    }

    return samples;
  }

  private async readPackageSummary(path: string): Promise<Record<string, unknown> | null> {
    const raw = await this.readExcerpt(path, 4_000);
    if (!raw) {
      return null;
    }

    try {
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      return {
        name: pkg.name,
        description: pkg.description,
        scripts: pkg.scripts,
        dependencies: Object.keys((pkg.dependencies as object) ?? {}).slice(0, 30),
        devDependencies: Object.keys((pkg.devDependencies as object) ?? {}).slice(0, 20),
      };
    } catch {
      return null;
    }
  }

  private async readExcerpt(path: string, maxChars: number): Promise<string | null> {
    try {
      const entry = await stat(path);
      if (!entry.isFile()) {
        return null;
      }
      const content = await readFile(path, "utf-8");
      return content.slice(0, maxChars);
    } catch {
      return null;
    }
  }
}
