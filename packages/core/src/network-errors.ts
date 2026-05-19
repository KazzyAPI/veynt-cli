const RETRYABLE_PATTERN =
  /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|socket hang up|network|aborted|headers timeout/i;

export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof Error) {
    if (RETRYABLE_PATTERN.test(error.message)) {
      return true;
    }
    if (error.cause) {
      return isRetryableFetchError(error.cause);
    }
  }
  return RETRYABLE_PATTERN.test(String(error));
}

export function formatFetchError(error: unknown, context?: { url?: string; hint?: string }): string {
  const parts: string[] = [];
  const message = error instanceof Error ? error.message : String(error);

  parts.push(message);

  if (context?.url) {
    parts.push(`URL: ${context.url}`);
  }

  const cause = error instanceof Error ? error.cause : undefined;
  if (cause) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    if (causeMessage && causeMessage !== message) {
      parts.push(`Cause: ${causeMessage}`);
    }
  }

  if (context?.hint) {
    parts.push(context.hint);
  }

  return parts.join("\n");
}
