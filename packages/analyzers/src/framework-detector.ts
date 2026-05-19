import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

export interface FrameworkDetection {
  framework: string;
  language: string;
  packageManager: string;
}

/**
 * Detects primary framework from manifest files — extensible via pattern registry.
 */
export class FrameworkDetector {
  async detect(repoRoot: string): Promise<FrameworkDetection> {
    const hasFile = async (name: string): Promise<boolean> => {
      try {
        await access(join(repoRoot, name));
        return true;
      } catch {
        return false;
      }
    };

    if (await hasFile("pom.xml") || await hasFile("build.gradle")) {
      return {
        framework: "spring-boot",
        language: "java",
        packageManager: (await hasFile("pom.xml")) ? "maven" : "gradle",
      };
    }

    if (await hasFile("package.json")) {
      const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["@angular/core"]) {
        return { framework: "angular", language: "typescript", packageManager: await this.detectNodePm(repoRoot) };
      }
      if (deps["react"] || deps["next"]) {
        return { framework: deps["next"] ? "next" : "react", language: "typescript", packageManager: await this.detectNodePm(repoRoot) };
      }
      if (deps["@nestjs/core"]) {
        return { framework: "nestjs", language: "typescript", packageManager: await this.detectNodePm(repoRoot) };
      }
      if (deps["express"] || deps["fastify"]) {
        return { framework: deps["fastify"] ? "fastify" : "express", language: "typescript", packageManager: await this.detectNodePm(repoRoot) };
      }

      return { framework: "node", language: "typescript", packageManager: await this.detectNodePm(repoRoot) };
    }

    return { framework: "unknown", language: "unknown", packageManager: "unknown" };
  }

  private async detectNodePm(repoRoot: string): Promise<string> {
    const checks: Array<[string, string]> = [
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["package-lock.json", "npm"],
    ];
    for (const [file, pm] of checks) {
      try {
        await access(join(repoRoot, file));
        return pm;
      } catch {
        /* continue */
      }
    }
    return "npm";
  }
}
