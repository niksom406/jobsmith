import { z } from "zod";

export const ANSWER_BANK_VERSION = 1;

export const answerBankSchema = z.strictObject({
  id: z.string().min(1),
  schemaVersion: z.literal(ANSWER_BANK_VERSION),
  normalizedQuestion: z.string(),
  originalQuestion: z.string(),
  answer: z.string(),
  fieldType: z.string(),
  company: z.string(),
  role: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type AnswerBankEntry = z.infer<typeof answerBankSchema>;
