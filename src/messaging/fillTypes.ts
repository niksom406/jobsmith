import { z } from "zod";

export const fieldSummarySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  status: z.enum([
    "filled",
    "skipped_not_empty",
    "skipped_no_value",
    "skipped_low_confidence",
    "skipped_sensitive",
    "unmatched",
  ]),
});

export const fillStatusSchema = z.strictObject({
  blocked: z.boolean(),
  blockedReason: z.string(),
  totalFields: z.number(),
  fields: z.array(fieldSummarySchema),
});

export type FieldSummary = z.infer<typeof fieldSummarySchema>;
export type FillStatus = z.infer<typeof fillStatusSchema>;

export const runFillRequestSchema = z.strictObject({ type: z.literal("run-fill") });
export const undoFillRequestSchema = z.strictObject({ type: z.literal("undo-fill") });
export const getStatusRequestSchema = z.strictObject({ type: z.literal("get-fill-status") });
