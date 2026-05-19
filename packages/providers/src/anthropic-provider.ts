import type { IReviewProvider, ProviderRequest } from "./provider-interface.js";

export class AnthropicProvider implements IReviewProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async review(request: ProviderRequest): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }
}
