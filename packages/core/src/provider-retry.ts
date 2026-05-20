import { isRateLimitError, isTransientProviderError } from "./rate-limit.js";
import { isRetryableFetchError } from "./network-errors.js";

export function isRetryableProviderError(error: unknown): boolean {
  return (
    isRateLimitError(error) ||
    isTransientProviderError(error) ||
    isRetryableFetchError(error)
  );
}

export function retryReason(error: unknown): string {
  if (isRateLimitError(error)) {
    return "Rate limited";
  }
  if (isTransientProviderError(error)) {
    return "Provider temporarily unavailable";
  }
  return "Connection error";
}
