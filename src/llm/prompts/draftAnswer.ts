import { z } from "zod";
import { callLlmJson } from "../client";

const draftSchema = z.strictObject({
  variants: z.array(
    z.strictObject({
      angle: z.enum(["motivation", "skills_fit", "company_mission"]),
      text: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You write first-person, UK English job-application answers. Use only facts given to you: the CV
(summary, skills, work, education, languages, certifications), the user's own notes (which may include saved
logistics facts like notice period or salary expectation — use one only if the question actually asks about that
topic), the job description, and the company brief. Never invent a fact, number, or employer not present in those
sources.

Answer the question that was asked:
- Personal / icebreaker questions (a fun fact, a hobby, something interesting about you) should be answered from
  anything in the CV that is actually personal or distinctive — a hobby, sport, language, unusual project,
  volunteer work, or a concrete detail from the work history. Do not refuse just because the CV has no field
  labelled "fun fact". Only refuse if the CV and notes contain nothing personal at all.
- Role / experience / skills questions should be answered from the CV. You may mention the employer or one job-
  description detail only when it genuinely explains the fit. Do not add a closing sentence that restates the
  company brief (for example "Chip's app brings savings and investments together...") if the answer already
  stands without it.
- If the question asks for a specific fact you were not given (which products they personally use, a skill never
  in the CV), say so in one short sentence and stop. Do not pad that admission with a company-brief or job-
  description detail.

Do not use cliche openers such as "I am excited to apply", "leverage my skills", or "passionate about". Be plain and
specific. Respect the character limit given, if any. Write 2 to 3 short variants with different angles: motivation,
skills fit, and company mission. If previousAnswersToAvoidRepeating is non-empty, write something noticeably
different in wording and angle from every one of those — the user asked to replace them, not see the same answer
again.`;

export interface DraftAnswerInput {
  apiKey: string;
  model: string;
  question: string;
  cvSummary: string;
  userNotes: string;
  jobDescription: string;
  companyBrief: string;
  characterLimit?: number;
  /** Earlier drafts for this same question (e.g. from a "Replace" click) that the model should
   * write something meaningfully different from, rather than a near-duplicate. */
  avoidTexts?: string[];
  fetchImpl?: typeof fetch;
}

export async function draftAnswerVariants(input: DraftAnswerInput) {
  const user = JSON.stringify({
    question: input.question,
    cvSummary: input.cvSummary,
    userNotes: input.userNotes,
    jobDescription: input.jobDescription,
    companyBrief: input.companyBrief,
    characterLimit: input.characterLimit ?? null,
    previousAnswersToAvoidRepeating: input.avoidTexts ?? [],
  });
  const result = await callLlmJson({
    apiKey: input.apiKey,
    model: input.model,
    system: SYSTEM_PROMPT,
    user,
    schema: draftSchema,
    schemaName: "answer_variants",
    fetchImpl: input.fetchImpl,
    maxOutputTokens: 1200,
  });
  return result.data.variants;
}

const verificationSchema = z.strictObject({
  unsupportedClaims: z.array(z.string()),
});

const VERIFY_SYSTEM_PROMPT = `You check a drafted job-application answer against the facts it was allowed to use (a CV
summary and the user's own notes). List any sentence or claim in the draft that is not supported by those two sources —
for example a specific employer, number, or achievement that was not in the CV or notes. If everything is supported,
return an empty list.`;

export async function verifyAnswerClaims(options: {
  apiKey: string;
  model: string;
  draft: string;
  cvSummary: string;
  userNotes: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const result = await callLlmJson({
    apiKey: options.apiKey,
    model: options.model,
    system: VERIFY_SYSTEM_PROMPT,
    user: JSON.stringify({ draft: options.draft, cvSummary: options.cvSummary, userNotes: options.userNotes }),
    schema: verificationSchema,
    schemaName: "verification",
    fetchImpl: options.fetchImpl,
    maxOutputTokens: 500,
  });
  return result.data.unsupportedClaims;
}
