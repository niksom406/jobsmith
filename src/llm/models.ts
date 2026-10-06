/** Configurable model ids. Call sites read settings; they do not inline these strings. */
export const DEFAULT_MODELS = {
  parse: "gpt-6-luna",
  answer: "gpt-6-luna",
  answerBetter: "gpt-6.1-sol",
} as const;

export type ModelRole = keyof typeof DEFAULT_MODELS;
