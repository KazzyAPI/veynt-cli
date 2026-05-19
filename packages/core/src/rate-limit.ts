const RATE_LIMIT_PATTERN = /429|rate.?limit|quota|resource.?exhausted|too many requests/i;

export function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RATE_LIMIT_PATTERN.test(message);
}

export function parseRetryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);

  const retryInMessage = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (retryInMessage?.[1]) {
    return Math.ceil(parseFloat(retryInMessage[1]) * 1000) + 1_000;
  }

  const jsonStart = message.indexOf("{");
  if (jsonStart < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(message.slice(jsonStart)) as {
      error?: { details?: Array<{ retryDelay?: string }> };
    };
    for (const detail of parsed.error?.details ?? []) {
      if (detail.retryDelay) {
        const seconds = parseFloat(detail.retryDelay.replace(/s$/i, ""));
        if (!Number.isNaN(seconds)) {
          return Math.ceil(seconds * 1000) + 1_000;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function delayForRequestsPerMinute(requestsPerMinute: number): number {
  if (requestsPerMinute <= 0) {
    return 0;
  }
  return Math.ceil(60_000 / requestsPerMinute) + 500;
}
