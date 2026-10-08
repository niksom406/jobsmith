import { z } from "zod";

export const FIELD_OVERRIDES_VERSION = 1;

/**
 * Per-site, per-field manual overrides: "on this exact field (identified by its question and
 * kind) on this hostname, always use this profile key." Lets you teach Jobsmith a mapping it
 * missed once, and have it remembered for every future visit to that same application form --
 * without ever guessing on its own. Keyed by `${hostname}::${fieldSignature}` -> profileKey.
 */
export const fieldOverridesSchema = z.strictObject({
  schemaVersion: z.literal(FIELD_OVERRIDES_VERSION),
  overrides: z.record(z.string(), z.string()),
});

export type FieldOverrides = z.infer<typeof fieldOverridesSchema>;

export function createEmptyFieldOverrides(): FieldOverrides {
  return { schemaVersion: FIELD_OVERRIDES_VERSION, overrides: {} };
}
