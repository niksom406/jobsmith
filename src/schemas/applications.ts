import { z } from "zod";

export const APPLICATION_VERSION = 1;

export const applicationSchema = z.strictObject({
  id: z.string().min(1),
  schemaVersion: z.literal(APPLICATION_VERSION),
  url: z.string(),
  company: z.string(),
  role: z.string(),
  date: z.string(),
  answerIds: z.array(z.string()),
  status: z.enum(["draft", "filled", "submitted_by_user", "abandoned"]),
});

export type ApplicationRecord = z.infer<typeof applicationSchema>;
