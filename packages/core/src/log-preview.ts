/** Formats AI provider output for analyse.log (truncated to keep files readable). */
export function formatAiResponseForLog(
  response: string,
  maxChars = 8_000,
): string {
  const trimmed = response.trim();
  if (trimmed.length === 0) {
    return "(empty response)";
  }
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}\n... [truncated, ${trimmed.length - maxChars} more chars]`;
}

export function formatAiResponseLogBlock(
  label: string,
  response: string,
  maxChars = 8_000,
): string {
  const body = formatAiResponseForLog(response, maxChars);
  return `Response (${label}, ${response.length} chars):\n${body}`;
}
