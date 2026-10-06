import { z } from "zod";
import { DEFAULT_MODELS } from "../llm/models";

export const SETTINGS_VERSION = 1;

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(SETTINGS_VERSION),
  apiKey: z.string(),
  models: z.strictObject({
    parse: z.string().min(1),
    answer: z.string().min(1),
    answerBetter: z.string().min(1),
  }),
  betterQuality: z.boolean(),
  language: z.string().min(2),
});

export type Settings = z.infer<typeof settingsSchema>;

export function createDefaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_VERSION,
    apiKey: "",
    models: { ...DEFAULT_MODELS },
    betterQuality: false,
    language: "en-GB",
  };
}
