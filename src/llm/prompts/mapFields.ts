import { z } from "zod";
import { callLlmJson } from "../client";
import type { DetectedField } from "../../autofill/types";

const mappingSchema = z.strictObject({
  mappings: z.array(
    z.strictObject({
      fieldId: z.string(),
      profileKey: z.string(),
      confident: z.boolean(),
    }),
  ),
});

const SYSTEM_PROMPT = `You map job application form fields to profile keys. You are given only field labels, types, and
option lists — never personal values. Pick the closest profileKey from the list given, or omit a field entirely if
nothing fits. Set confident to false if the match is only a guess.`;

export interface FieldForMapping {
  id: string;
  label: string;
  kind: string;
  options: string[];
}

export function fieldsForMapping(fields: DetectedField[]): FieldForMapping[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    kind: field.kind,
    options: field.options.map((option) => option.label),
  }));
}

export async function mapUnmatchedFields(options: {
  apiKey: string;
  model: string;
  fields: FieldForMapping[];
  profileKeys: string[];
  fetchImpl?: typeof fetch;
}): Promise<{ fieldId: string; profileKey: string; confident: boolean }[]> {
  if (options.fields.length === 0) return [];
  const result = await callLlmJson({
    apiKey: options.apiKey,
    model: options.model,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ fields: options.fields, profileKeys: options.profileKeys }),
    schema: mappingSchema,
    schemaName: "field_mapping",
    fetchImpl: options.fetchImpl,
  });
  return result.data.mappings;
}
