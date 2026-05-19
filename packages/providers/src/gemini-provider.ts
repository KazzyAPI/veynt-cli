import type { IReviewProvider, ProviderRequest } from "./provider-interface.js";

export class GeminiProvider implements IReviewProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async review(request: ProviderRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
}
