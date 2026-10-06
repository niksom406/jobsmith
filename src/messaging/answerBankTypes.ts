import { z } from "zod";

export const saveAnswerRequestSchema = z.strictObject({
  type: z.literal("save-answer"),
  payload: z.strictObject({
    question: z.string().min(1),
    answer: z.string().min(1),
    fieldType: z.string(),
    company: z.string(),
    role: z.string(),
  }),
});

export type SaveAnswerRequest = z.infer<typeof saveAnswerRequestSchema>;

export const getAnswerBankRequestSchema = z.strictObject({ type: z.literal("get-answer-bank") });

export const answerBankEntrySummarySchema = z.strictObject({
  id: z.string(),
  originalQuestion: z.string(),
  normalizedQuestion: z.string(),
  answer: z.string(),
  company: z.string(),
  role: z.string(),
});

export type AnswerBankEntrySummary = z.infer<typeof answerBankEntrySummarySchema>;
