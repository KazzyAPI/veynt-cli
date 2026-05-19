import type { ChunkingConfig } from "@veynt/config";
import {
  formatWorkspaceTokens,
  type ArchitectureProfile,
  type ProviderName,
  type RepositoryProfile,
  type StandardsProfile,
  type WorkspaceDocument,
} from "@veynt/core";
import type { IReviewProvider } from "@veynt/providers";
import { formatAnalyseSnapshot } from "./analyse-prompt-tokens.js";
import { ChunkedProviderClient, type ProgressCallback } from "./chunked-provider-client.js";
import { RepoSampler } from "./repo-sampler.js";
import type { AnalysisResult } from "./types.js";
import { WorkspaceBuilder } from "./workspace-builder.js";

const PATHS_PER_CHUNK = 40;

export interface EnhanceOptions {
  maxTokens: number;
  chunking: ChunkingConfig;
  providerName: ProviderName;
  onProgress?: ProgressCallback;
}

/**
 * Builds baseline documentation via tokenized, chunked AI calls plus a workspace synthesis step.
 */
export class AiBaselineGenerator {
  private readonly sampler = new RepoSampler();
  private readonly workspaceBuilder = new WorkspaceBuilder();

  async enhance(
    repoRoot: string,
    programmatic: AnalysisResult,
    provider: IReviewProvider,
    options: EnhanceOptions,
  ): Promise<AnalysisResult> {
    const client = new ChunkedProviderClient(provider, options.chunking, options.onProgress);

    const sample = await this.sampler.sample(repoRoot);
    const pathChunks = this.sampler.chunkPaths(sample.pathListing, PATHS_PER_CHUNK);

    const draftWorkspace = await this.workspaceBuilder.build(repoRoot, sample, programmatic);

    options.onProgress?.(
      `Analyse plan: 1 profile + ${pathChunks.length} structure + 1 standards + 1 workspace = ${pathChunks.length + 3} API calls`,
    );

    let merged: AnalysisResult = { ...programmatic };

    const profile = await this.fetchProfile(client, sample, merged, options.maxTokens);
    merged = { ...merged, profile: { ...merged.profile, ...profile } };
    await client.paceBetweenChunks();

    const architecture = await this.fetchArchitecture(
      client,
      sample,
      merged,
      pathChunks,
      options.maxTokens,
    );
    merged = { ...merged, architecture: { ...merged.architecture, ...architecture } };
    await client.paceBetweenChunks();

    const standards = await this.fetchStandards(client, sample, merged, options.maxTokens);
    merged = { ...merged, standards: { ...merged.standards, ...standards } };
    await client.paceBetweenChunks();

    let workspace: WorkspaceDocument;
    try {
      workspace = await this.fetchWorkspace(
        client,
        sample,
        merged,
        draftWorkspace,
        options.maxTokens,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.onProgress?.(
        `Workspace AI step failed — saving programmatic workspace. ${message.split("\n")[0]}`,
      );
      workspace = draftWorkspace;
    }

    return { ...merged, workspace };
  }

  private async fetchProfile(
    client: ChunkedProviderClient,
    sample: Awaited<ReturnType<RepoSampler["sample"]>>,
    analysis: AnalysisResult,
    maxTokens: number,
  ): Promise<Partial<RepositoryProfile>> {
    const response = await client.invoke(
      {
        systemPrompt: PROFILE_SYSTEM_PROMPT,
        userPrompt: formatAnalyseSnapshot(
          "repository.profile",
          sample,
          analysis,
          "Infer framework, language, architecture style, purpose, and a 2-4 sentence summary specific to THIS repo (not generic).",
        ),
        maxTokens,
        contextPackage: minimalContext(),
      },
      "profile",
    );

    return this.parseSection<Partial<RepositoryProfile>>(response, "profile") ?? {};
  }

  private async fetchArchitecture(
    client: ChunkedProviderClient,
    sample: Awaited<ReturnType<RepoSampler["sample"]>>,
    analysis: AnalysisResult,
    pathChunks: string[][],
    maxTokens: number,
  ): Promise<Partial<ArchitectureProfile>> {
    let merged: Partial<ArchitectureProfile> = { ...analysis.architecture };

    for (let i = 0; i < pathChunks.length; i++) {
      if (i > 0) {
        await client.paceBetweenChunks();
      }

      const chunkSample = {
        ...sample,
        pathListing: pathChunks[i]!,
      };

      const response = await client.invoke(
        {
          systemPrompt: ARCHITECTURE_SYSTEM_PROMPT,
          userPrompt: formatAnalyseSnapshot(
            `architecture.paths chunk ${i + 1}/${pathChunks.length}`,
            chunkSample,
            { ...analysis, architecture: merged as ArchitectureProfile },
            "Merge paths into layers, module boundaries, and dependency rules for THIS monorepo. Be specific to package names.",
          ),
          maxTokens,
          contextPackage: minimalContext(),
        },
        `architecture chunk ${i + 1}/${pathChunks.length}`,
      );

      const partial =
        this.parseSection<Partial<ArchitectureProfile>>(response, "architecture") ?? {};
      merged = mergeArchitecture(merged, partial);
    }

    return merged;
  }

  private async fetchStandards(
    client: ChunkedProviderClient,
    sample: Awaited<ReturnType<RepoSampler["sample"]>>,
    analysis: AnalysisResult,
    maxTokens: number,
  ): Promise<Partial<StandardsProfile>> {
    const response = await client.invoke(
      {
        systemPrompt: STANDARDS_SYSTEM_PROMPT,
        userPrompt: formatAnalyseSnapshot(
          "engineering.standards",
          sample,
          analysis,
          "Infer comment density, nullability, testing approach, and repo-specific anti-patterns from code samples.",
        ),
        maxTokens: Math.min(maxTokens, 3072),
        contextPackage: minimalContext(),
      },
      "standards",
    );

    return this.parseSection<Partial<StandardsProfile>>(response, "standards") ?? {};
  }

  private async fetchWorkspace(
    client: ChunkedProviderClient,
    sample: Awaited<ReturnType<RepoSampler["sample"]>>,
    analysis: AnalysisResult,
    draft: WorkspaceDocument,
    maxTokens: number,
  ): Promise<WorkspaceDocument> {
    const response = await client.invoke(
      {
        systemPrompt: WORKSPACE_SYSTEM_PROMPT,
        userPrompt: formatAnalyseSnapshot(
          "workspace.synthesis",
          sample,
          analysis,
          `Expand the draft workspace into a comprehensive document. Draft overview:\n${draft.overview}\n\nDraft packages:\n${JSON.stringify(draft.packages, null, 2)}`,
        ),
        maxTokens: Math.min(maxTokens, 2048),
        contextPackage: minimalContext(),
      },
      "workspace",
    );

    const parsed = this.parseSection<Partial<WorkspaceDocument>>(response, "workspace");
    if (!parsed) {
      return draft;
    }

    return mergeWorkspace(draft, parsed);
  }

  private parseSection<T>(response: string, key: string): T | null {
    const match = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match?.[1]) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      return (parsed[key] ?? parsed) as T;
    } catch {
      return null;
    }
  }
}

const PROFILE_SYSTEM_PROMPT = `You document repositories for an AI code reviewer. Use the tokenized snapshot.

Respond with JSON only:
\`\`\`json
{
  "profile": {
    "framework": "...",
    "language": "...",
    "architectureStyle": "monorepo-layered|layered|flat|...",
    "packageManager": "...",
    "summary": "2-4 sentences specific to this repo",
    "purpose": "one sentence",
    "monorepo": true
  }
}
\`\`\``;

const ARCHITECTURE_SYSTEM_PROMPT = `Infer architecture from tokenized paths and monorepo packages. Be specific (name packages, layers, boundaries).

Respond with JSON only:
\`\`\`json
{
  "architecture": {
    "layers": ["packages/cli", "packages/review-engine", ...],
    "separationOfConcerns": ["..."],
    "namingConventions": { "files": "...", "packages": "..." },
    "layeringConventions": ["..."],
    "moduleBoundaries": ["@veynt/cli must not import from providers directly", ...],
    "dependencyRules": ["workspace:* deps only within monorepo", ...],
    "summary": "2-4 sentences"
  }
}
\`\`\``;

const STANDARDS_SYSTEM_PROMPT = `Infer engineering standards from tokenized code samples.

Respond with JSON only:
\`\`\`json
{
  "standards": {
    "commentDensity": "low|medium|high",
    "nullabilityPattern": "...",
    "utilityReusePatterns": ["..."],
    "dependencyPatterns": ["..."],
    "antiPatterns": ["..."],
    "testingApproach": "...",
    "summary": "2-3 sentences"
  }
}
\`\`\``;

const WORKSPACE_SYSTEM_PROMPT = `Produce a comprehensive workspace document for AI reviewers. Use ALL token sections. Overview must be 4-10 paragraphs covering purpose, package map, data flow, conventions, and what to flag on scan.

Respond with JSON only:
\`\`\`json
{
  "workspace": {
    "overview": "markdown-friendly comprehensive text",
    "packages": [{ "name": "@veynt/cli", "path": "packages/cli", "role": "...", "description": "..." }],
    "areas": [{ "id": "packages/cli", "label": "CLI", "paths": ["..."], "description": "..." }],
    "entryPoints": ["packages/cli/src/index.ts"],
    "commands": ["init", "scan"],
    "techStack": ["typescript", "pnpm", ...],
    "conventions": ["..."],
    "reviewHints": ["actionable hints for reviewers"],
    "dataFlow": "how scan/analyse flows through packages"
  }
}
\`\`\``;

function mergeArchitecture(
  base: Partial<ArchitectureProfile>,
  partial: Partial<ArchitectureProfile>,
): Partial<ArchitectureProfile> {
  return {
    layers: unique([...(base.layers ?? []), ...(partial.layers ?? [])]),
    separationOfConcerns: unique([
      ...(base.separationOfConcerns ?? []),
      ...(partial.separationOfConcerns ?? []),
    ]),
    namingConventions: { ...base.namingConventions, ...partial.namingConventions },
    layeringConventions: unique([
      ...(base.layeringConventions ?? []),
      ...(partial.layeringConventions ?? []),
    ]),
    moduleBoundaries: unique([
      ...(base.moduleBoundaries ?? []),
      ...(partial.moduleBoundaries ?? []),
    ]),
    dependencyRules: unique([...(base.dependencyRules ?? []), ...(partial.dependencyRules ?? [])]),
    summary: partial.summary ?? base.summary,
  };
}

function mergeWorkspace(
  draft: WorkspaceDocument,
  ai: Partial<WorkspaceDocument>,
): WorkspaceDocument {
  const merged: WorkspaceDocument = {
    generatedAt: new Date().toISOString(),
    overview: ai.overview?.trim() || draft.overview,
    repository: { ...draft.repository, ...ai.repository },
    packages: ai.packages?.length ? ai.packages : draft.packages,
    areas: ai.areas?.length ? ai.areas : draft.areas,
    entryPoints: ai.entryPoints?.length ? ai.entryPoints : draft.entryPoints,
    commands: ai.commands?.length ? ai.commands : draft.commands,
    techStack: unique([...draft.techStack, ...(ai.techStack ?? [])]),
    conventions: unique([...draft.conventions, ...(ai.conventions ?? [])]),
    reviewHints: unique([...draft.reviewHints, ...(ai.reviewHints ?? [])]),
    dataFlow: ai.dataFlow ?? draft.dataFlow,
    tokenIndex: "",
  };

  merged.tokenIndex = formatWorkspaceTokens(merged);
  return merged;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function minimalContext(): import("@veynt/core").ReviewContextPackage {
  return {
    repository: {
      framework: "unknown",
      architectureStyle: "unknown",
      strictness: "balanced",
      profile: {
        framework: "unknown",
        language: "unknown",
        architectureStyle: "unknown",
        packageManager: "unknown",
        detectedAt: new Date().toISOString(),
      },
      architecture: {
        layers: [],
        separationOfConcerns: [],
        namingConventions: {},
        layeringConventions: [],
      },
      standards: {
        commentDensity: "medium",
        nullabilityPattern: "",
        utilityReusePatterns: [],
        dependencyPatterns: [],
        antiPatterns: [],
      },
    },
    changes: { filesChanged: [], fileChanges: [], dependencyChanges: [], ruleFileChanges: [] },
    context: { relatedUtilities: [], surroundingFiles: {}, impactedAreas: [] },
    mode: "local",
  };
}
