import { z } from "zod";

export const fieldSummarySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  status: z.enum([
    "filled",
    "filled_ai_draft",
    "skipped_not_empty",
    "skipped_no_value",
    "skipped_low_confidence",
    "skipped_sensitive",
    "unmatched",
  ]),
  /** Why this status, in plain language -- shown when you click the field in the side panel. */
  detail: z.string().optional(),
  /** A readable preview of the value that was (or, during a dry-run preview, would be) set. */
  previewValue: z.string().optional(),
});

export const fillStatusSchema = z.strictObject({
  blocked: z.boolean(),
  blockedReason: z.string(),
  totalFields: z.number(),
  fields: z.array(fieldSummarySchema),
  /** True when nothing on the page was actually written to -- "Detect fields" previews what Fill
   * would do; only "Fill" itself sets this false. */
  preview: z.boolean().optional(),
});

export type FieldSummary = z.infer<typeof fieldSummarySchema>;
export type FillStatus = z.infer<typeof fillStatusSchema>;

export const runFillRequestSchema = z.strictObject({ type: z.literal("run-fill") });
export const undoFillRequestSchema = z.strictObject({ type: z.literal("undo-fill") });
export const getStatusRequestSchema = z.strictObject({ type: z.literal("get-fill-status") });
