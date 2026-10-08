import { z } from "zod";

export const upsertApplicationRequestSchema = z.strictObject({
  type: z.literal("upsert-application"),
  payload: z.strictObject({
    url: z.string(),
    company: z.string(),
    role: z.string(),
    status: z.enum(["draft", "filled", "submitted_by_user", "abandoned"]),
  }),
});

export const upsertApplicationResultSchema = z.strictObject({ ok: z.boolean() });

export const listApplicationsRequestSchema = z.strictObject({ type: z.literal("list-applications") });

export const applicationSummarySchema = z.strictObject({
  id: z.string(),
  url: z.string(),
  company: z.string(),
  role: z.string(),
  date: z.string(),
  status: z.enum(["draft", "filled", "submitted_by_user", "abandoned"]),
});
export type ApplicationSummary = z.infer<typeof applicationSummarySchema>;

export const updateApplicationStatusRequestSchema = z.strictObject({
  type: z.literal("update-application-status"),
  payload: z.strictObject({
    id: z.string(),
    status: z.enum(["draft", "filled", "submitted_by_user", "abandoned"]),
  }),
});

export const deleteApplicationRequestSchema = z.strictObject({
  type: z.literal("delete-application"),
  payload: z.strictObject({ id: z.string() }),
});
