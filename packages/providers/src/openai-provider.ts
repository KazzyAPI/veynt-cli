import type { IReviewProvider, ProviderRequest } from "./provider-interface.js";

export class OpenAiProvider implements IReviewProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async review(request: ProviderRequest): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message.content ?? "";
  }
}
