import { z } from "zod";

export const draftAnswersRequestSchema = z.strictObject({
  type: z.literal("draft-answers"),
  payload: z.strictObject({
    question: z.string().min(1),
    jobDescription: z.string(),
    companyDomain: z.string(),
    userNotes: z.string(),
    characterLimit: z.number().nullable(),
  }),
});

export const draftVariantSchema = z.strictObject({
  angle: z.enum(["motivation", "skills_fit", "company_mission"]),
  text: z.string(),
});

export const draftAnswersResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    variants: z.array(draftVariantSchema),
    unsupportedClaims: z.array(z.string()),
    companyBriefSource: z.enum(["cache", "web_search", "about_page", "user", "none"]),
    usedAnswerBank: z.boolean(),
  }),
  z.strictObject({ ok: z.literal(false), error: z.string(), needsCompanyBrief: z.boolean(), needsJobDescription: z.boolean() }),
]);

export type DraftAnswersRequest = z.infer<typeof draftAnswersRequestSchema>;
export type DraftAnswersResult = z.infer<typeof draftAnswersResultSchema>;
