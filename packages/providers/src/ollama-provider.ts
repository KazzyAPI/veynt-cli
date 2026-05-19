import { formatFetchError } from "@veynt/core";
import type { IReviewProvider, ProviderRequest } from "./provider-interface.js";

export const OLLAMA_DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 600_000;

/**
 * Local Ollama chat API — no cloud API key required.
 * Uses streaming so slow local models do not hit undici's ~300s headers timeout.
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export class OllamaProvider implements IReviewProvider {
  readonly name = "ollama";

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async review(request: ProviderRequest): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/chat`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const body = JSON.stringify({
      model: this.model,
      stream: true,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      options: {
        num_predict: request.maxTokens,
        temperature: 0.2,
      },
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const sizeKb = Math.ceil(body.length / 1024);
      throw new Error(
        formatFetchError(error, {
          url,
          hint: [
            `Request size: ~${sizeKb} KB.`,
            this.headersTimeoutHint(error),
            "Ensure Ollama or LM Studio is running and reachable.",
            `Check OLLAMA_HOST (current: ${this.baseUrl}).`,
            `Verify model exists: ollama list (configured: ${this.model})`,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      );
    }

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Ollama API error (${response.status}): ${responseBody}. Is Ollama running? Try: ollama serve`,
      );
    }

    if (!response.body) {
      const data = (await response.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    }

    return this.readStream(response.body);
  }

  /** Quick connectivity check before a long chunked scan. */
  async ping(): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/tags`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      throw new Error(
        formatFetchError(error, {
          url,
          hint: `Cannot reach Ollama at ${this.baseUrl}. Start Ollama (ollama serve) or LM Studio with the local server enabled, then set OLLAMA_HOST if not using port 11434.`,
        }),
      );
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    const drain = (): void => {
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const chunk = JSON.parse(trimmed) as { message?: { content?: string } };
          if (chunk.message?.content) {
            content += chunk.message.content;
          }
        } catch {
          // ignore partial JSON lines
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      drain();
    }

    buffer += decoder.decode();
    drain();

    return content;
  }

  private headersTimeoutHint(error: unknown): string | undefined {
    const text = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    if (/headers timeout/i.test(text) || /headers timeout/i.test(cause)) {
      return "Headers timeout: local model took too long before responding. Streaming is enabled; if this persists, lower maxTokens or skip the workspace step by re-running analyse with pacing disabled.";
    }
    return undefined;
  }
}
