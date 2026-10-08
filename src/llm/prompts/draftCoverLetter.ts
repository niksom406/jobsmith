import { z } from "zod";
import { callLlmJson } from "../client";

const coverLetterSchema = z.strictObject({
  text: z.string(),
});

const SYSTEM_PROMPT = `You write a complete, first-person, UK English cover letter for one specific job application.
Use only facts given to you: the CV summary, the user's own notes, the job description, and the company brief. Never
invent a fact, number, employer, dates, or qualification not present in those sources. Reference at least one
specific detail from the job description and one from the company brief, woven in naturally rather than listed. Open
directly with why this role at this company, without a cliche line such as "I am excited to apply" or "I am writing
to express my interest". Close with a plain, confident call to action, not "I look forward to hearing from you".
Write three to five short paragraphs with no greeting line and no signature line (the user adds "Dear ..." and their
name themselves) -- just the body. Respect the word limit given, if any.`;

export interface DraftCoverLetterInput {
  apiKey: string;
  model: string;
  jobTitle: string;
  companyName: string;
  cvSummary: string;
  userNotes: string;
  jobDescription: string;
  companyBrief: string;
  wordLimit?: number;
  fetchImpl?: typeof fetch;
}

export async function draftCoverLetter(input: DraftCoverLetterInput): Promise<string> {
  const user = JSON.stringify({
    jobTitle: input.jobTitle,
    companyName: input.companyName,
    cvSummary: input.cvSummary,
    userNotes: input.userNotes,
    jobDescription: input.jobDescription,
    companyBrief: input.companyBrief,
    wordLimit: input.wordLimit ?? null,
  });
  const result = await callLlmJson({
    apiKey: input.apiKey,
    model: input.model,
    system: SYSTEM_PROMPT,
    user,
    schema: coverLetterSchema,
    schemaName: "cover_letter",
    fetchImpl: input.fetchImpl,
    maxOutputTokens: 1600,
  });
  return result.data.text;
}
