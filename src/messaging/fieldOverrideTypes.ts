import { z } from "zod";

export const setFieldOverrideRequestSchema = z.strictObject({
  type: z.literal("set-field-override"),
  payload: z.strictObject({
    fieldId: z.string(),
    /** The profile key to map this field to from now on; empty string clears any existing override. */
    profileKey: z.string(),
  }),
});

export const setFieldOverrideResultSchema = z.strictObject({
  ok: z.boolean(),
  error: z.string().optional(),
});

export type SetFieldOverrideResult = z.infer<typeof setFieldOverrideResultSchema>;
