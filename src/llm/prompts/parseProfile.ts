import { z } from "zod";
import { profileSchema, type Profile } from "../../schemas/profile";
import { callLlmJson } from "../client";

/** Same shape as Profile, minus the schemaVersion the model should not set. */
export const parsedProfileSchema = profileSchema.omit({ schemaVersion: true });

const SYSTEM_PROMPT = `You turn CV text into structured profile data. Use only facts present in the CV text.
Never invent an employer, date, or skill that is not written in the text. Leave a field empty ("" or []) rather than guess.
Dates should be written as they appear in the CV (for example "2021" or "Jun 2021").`;

export async function parseProfileFromCv(options: {
  apiKey: string;
  model: string;
  cvText: string;
  fetchImpl?: typeof fetch;
}): Promise<Profile> {
  const result = await callLlmJson({
    apiKey: options.apiKey,
    model: options.model,
    system: SYSTEM_PROMPT,
    user: `CV text:\n"""\n${options.cvText.slice(0, 20_000)}\n"""`,
    schema: parsedProfileSchema,
    schemaName: "profile",
    fetchImpl: options.fetchImpl,
    maxOutputTokens: 3000,
  });
  return { ...result.data, schemaVersion: 1 as const };
}

export type ParsedProfile = z.infer<typeof parsedProfileSchema>;
