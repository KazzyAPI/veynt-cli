import type { ReviewContextPackage } from "@veynt/core";

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  contextPackage: ReviewContextPackage;
  maxTokens: number;
}

/** Provider adapters implement a single review call — Open/Closed for new providers. */
export interface IReviewProvider {
  readonly name: string;
  readonly model: string;
  review(request: ProviderRequest): Promise<string>;
}
