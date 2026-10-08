import { z } from "zod";

export const draftCoverLetterRequestSchema = z.strictObject({
  type: z.literal("draft-cover-letter"),
  payload: z.strictObject({
    jobTitle: z.string(),
    companyName: z.string(),
    companyDomain: z.string(),
    jobDescription: z.string(),
    userNotes: z.string(),
    wordLimit: z.number().nullable(),
  }),
});
export type DraftCoverLetterRequest = z.infer<typeof draftCoverLetterRequestSchema>;

export const draftCoverLetterResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    text: z.string(),
    unsupportedClaims: z.array(z.string()),
  }),
  z.strictObject({
    ok: z.literal(false),
    error: z.string(),
    needsJobDescription: z.boolean(),
  }),
]);
export type DraftCoverLetterResult = z.infer<typeof draftCoverLetterResultSchema>;
