import type { ChunkingConfig } from "@veynt/config";
import type { ProviderName, Strictness } from "@veynt/core";
import { FindingParser, type Finding } from "@veynt/findings";
import type { IReviewProvider } from "@veynt/providers";
import { PromptBuilder } from "./prompt-builder.js";
import {
  delayForRequestsPerMinute,
  isRateLimitError,
  isRetryableFetchError,
  parseRetryDelayMs,
  sleep,
} from "@veynt/core";
import type { ReviewChunk } from "./review-chunker.js";

export interface ChunkProgressEvent {
  current: number;
  total: number;
  filePaths: string[];
  waitingMs?: number;
}

export interface ChunkedReviewResult {
  findings: Finding[];
  rawResponses: string[];
  chunksInvoked: number;
  chunksFailed: number;
}

/**
 * Executes AI reviews chunk-by-chunk with RPM-aware pacing and rate-limit retries.
 */
export class ChunkedReviewRunner {
  private readonly promptBuilder = new PromptBuilder();
  private readonly findingParser = new FindingParser();

  constructor(
    private readonly provider: IReviewProvider,
    private readonly chunking: ChunkingConfig,
    private readonly maxTokens: number,
    private readonly providerName: ProviderName,
    private readonly onProgress?: (event: ChunkProgressEvent) => void,
  ) {}

  async run(chunks: ReviewChunk[], strictness: Strictness): Promise<ChunkedReviewResult> {
    const systemPrompt = this.promptBuilder.buildSystemPrompt(strictness);
    const allFindings: Finding[] = [];
    const rawResponses: string[] = [];
    let chunksInvoked = 0;
    let chunksFailed = 0;

    const pacingMs = this.resolvePacingDelay();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;

      if (i > 0 && pacingMs > 0) {
        this.onProgress?.({
          current: chunk.index,
          total: chunk.total,
          filePaths: chunk.filePaths,
          waitingMs: pacingMs,
        });
        await sleep(pacingMs);
      }

      this.onProgress?.({
        current: chunk.index,
        total: chunk.total,
        filePaths: chunk.filePaths,
      });

      const userPrompt = this.promptBuilder.buildUserPrompt(
        chunk.contextPackage,
        chunk.index,
        chunk.total,
      );

      try {
        const raw = await this.invokeWithRetry({
          systemPrompt,
          userPrompt,
          contextPackage: chunk.contextPackage,
          maxTokens: this.maxTokens,
        });

        rawResponses.push(raw);
        allFindings.push(...this.findingParser.parse(raw));
        chunksInvoked++;
      } catch (error) {
        chunksFailed++;
        if (isRateLimitError(error)) {
          console.warn(
            `\x1b[33m⚠ Chunk ${chunk.index}/${chunk.total} skipped after rate-limit retries.\x1b[0m`,
          );
          continue;
        }
        throw error;
      }
    }

    if (chunksInvoked === 0 && chunks.length > 0) {
      throw new Error(
        "All review chunks failed. Increase review.chunking.delayMsBetweenChunks or review.chunking.requestsPerMinute in .veynt/config.yml.",
      );
    }

    return {
      findings: this.deduplicateFindings(allFindings),
      rawResponses,
      chunksInvoked,
      chunksFailed,
    };
  }

  private resolvePacingDelay(): number {
    const rpmDelay =
      this.chunking.requestsPerMinute > 0
        ? delayForRequestsPerMinute(this.chunking.requestsPerMinute)
        : 0;
    return Math.max(this.chunking.delayMsBetweenChunks, rpmDelay);
  }

  private async invokeWithRetry(
    request: Parameters<IReviewProvider["review"]>[0],
  ): Promise<string> {
    let lastError: unknown;
    const maxAttempts = Math.max(this.chunking.maxRetries, 1);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.provider.review(request);
      } catch (error) {
        lastError = error;
        const retryable = isRateLimitError(error) || isRetryableFetchError(error);
        if (!retryable || attempt === maxAttempts - 1) {
          throw error;
        }

        const suggested = parseRetryDelayMs(error);
        const backoffMs =
          suggested ??
          Math.max(
            this.resolvePacingDelay() * 2 ** (attempt + 1),
            delayForRequestsPerMinute(this.chunking.requestsPerMinute || 5),
          );

        const reason = isRateLimitError(error) ? "rate limited" : "connection error";
        console.warn(
          `\x1b[33m  ${this.providerName} ${reason} — waiting ${Math.ceil(backoffMs / 1000)}s before retry ${attempt + 2}/${maxAttempts}...\x1b[0m`,
        );
        await sleep(backoffMs);
      }
    }

    throw lastError;
  }

  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    return findings.filter((finding) => {
      const key = `${finding.semanticRuleId}|${finding.filePath ?? ""}|${finding.reasoning}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
