import type { ChunkingConfig } from "@veynt/config";
import {
  delayForRequestsPerMinute,
  formatAiResponseLogBlock,
  isRetryableProviderError,
  parseRetryDelayMs,
  retryReason,
  sleep,
} from "@veynt/core";
import type { IReviewProvider, ProviderRequest } from "@veynt/providers";

export type ProgressCallback = (message: string) => void;

/**
 * Wraps provider calls with pacing and rate-limit retries for analyse chunking.
 */
export class ChunkedProviderClient {
  constructor(
    private readonly provider: IReviewProvider,
    private readonly chunking: ChunkingConfig,
    private readonly onProgress?: ProgressCallback,
  ) {}

  async invoke(request: ProviderRequest, label: string): Promise<string> {
    const maxAttempts = Math.max(this.chunking.maxRetries, 1);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.onProgress?.(`API: ${label}`);
        const response = await this.provider.review(request);
        this.onProgress?.(formatAiResponseLogBlock(label, response));
        return response;
      } catch (error) {
        const retryable = isRetryableProviderError(error);
        if (!retryable || attempt === maxAttempts - 1) {
          throw error;
        }

        const suggested = parseRetryDelayMs(error);
        const backoffMs =
          suggested ??
          Math.max(
            this.pacingDelay() * 2 ** (attempt + 1),
            delayForRequestsPerMinute(this.chunking.requestsPerMinute || 5),
          );

        this.onProgress?.(
          `${retryReason(error)} — waiting ${Math.ceil(backoffMs / 1000)}s (${label}, retry ${attempt + 2}/${maxAttempts})`,
        );
        await sleep(backoffMs);
      }
    }

    throw new Error(`Failed after ${maxAttempts} attempts: ${label}`);
  }

  async paceBetweenChunks(): Promise<void> {
    const delay = this.pacingDelay();
    if (delay <= 0) {
      return;
    }
    this.onProgress?.(`Pacing ${Math.ceil(delay / 1000)}s before next request...`);
    await sleep(delay);
  }

  private pacingDelay(): number {
    const rpmDelay =
      this.chunking.requestsPerMinute > 0
        ? delayForRequestsPerMinute(this.chunking.requestsPerMinute)
        : 0;
    return Math.max(this.chunking.delayMsBetweenChunks, rpmDelay);
  }
}
