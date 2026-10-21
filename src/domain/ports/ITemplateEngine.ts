import type { BotProfile } from "../entities/BotProfile.js";

export interface TemplateContext {
  git?: {
    repo?: string | undefined;
    branch?: string | undefined;
    author?: string | undefined;
    shortHash?: string | undefined;
  } | undefined;
  timestamp?: string | undefined;
  [key: string]: unknown;
}

export interface ITemplateEngine {
  render(
    profile: BotProfile,
    payload: Record<string, unknown>,
    context?: TemplateContext | undefined
  ): string;
}
