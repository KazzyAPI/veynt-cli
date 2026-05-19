export interface ChunkingConfig {
  enabled: boolean;
  maxFilesPerChunk: number;
  maxCharsPerChunk: number;
  /** Minimum pause between chunk requests. */
  delayMsBetweenChunks: number;
  /** When set, enforces spacing (e.g. 5 for Gemini free tier ≈ 12.5s between calls). */
  requestsPerMinute: number;
  maxRetries: number;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  enabled: true,
  maxFilesPerChunk: 4,
  maxCharsPerChunk: 40_000,
  delayMsBetweenChunks: 2_000,
  requestsPerMinute: 5,
  maxRetries: 6,
};
