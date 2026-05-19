import { tokenSection, formatPathTokens } from "@veynt/core";
import type { RepoSample } from "./repo-sampler.js";
import type { AnalysisResult } from "./types.js";

/** Tokenized analyse prompt payload — structured for local/cloud models. */
export function formatAnalyseSnapshot(
  label: string,
  sample: RepoSample,
  analysis: AnalysisResult,
  extra?: string,
): string {
  const parts: string[] = [
    tokenSection(
      label,
      [
        formatPathTokens(sample.pathListing.slice(0, 80)),
        sample.pathListing.length > 80
          ? `@meta paths_truncated=${sample.pathListing.length - 80}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ];

  if (sample.packageSummary) {
    parts.push(
      tokenSection(
        "package.root",
        Object.entries(sample.packageSummary)
          .map(([k, v]) => `@field ${k}=${JSON.stringify(v)}`)
          .join("\n"),
      ),
    );
  }

  if (sample.monorepoPackages.length > 0) {
    parts.push(
      tokenSection(
        "monorepo.packages",
        sample.monorepoPackages
          .map(
            (p) =>
              `@pkg name=${p.name} path=${p.path}${p.description ? ` desc=${p.description}` : ""}`,
          )
          .join("\n"),
      ),
    );
  }

  if (sample.readmeExcerpt) {
    parts.push(tokenSection("readme", sample.readmeExcerpt));
  }

  parts.push(
    tokenSection("baseline.profile", JSON.stringify(analysis.profile, null, 2)),
    tokenSection("baseline.architecture", JSON.stringify(analysis.architecture, null, 2)),
    tokenSection("baseline.standards", JSON.stringify(analysis.standards, null, 2)),
  );

  if (sample.codeSamples.length > 0) {
    parts.push(
      tokenSection(
        "code.samples",
        sample.codeSamples
          .map((s) => `@file ${s.path}\n\`\`\`\n${s.excerpt}\n\`\`\``)
          .join("\n\n"),
      ),
    );
  }

  if (extra) {
    parts.push(tokenSection("task", extra));
  }

  return parts.join("\n");
}
