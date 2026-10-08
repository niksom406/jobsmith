import { z } from "zod";

/**
 * Drafts an answer for one long-text field left unmatched after the heuristic/answer-bank/LLM-
 * mapping layers, during a normal "Fill" — not the manual "Draft an answer" panel. Only runs once
 * a job description was actually found on the page (never guesses one), and only ever uses facts
 * from the CV/notes already in storage, same as the manual draft flow.
 */
export const draftFieldAnswerRequestSchema = z.strictObject({
  type: z.literal("draft-field-answer"),
  payload: z.strictObject({
    question: z.string().min(1),
    jobDescription: z.string().min(1),
    companyDomain: z.string(),
    companyName: z.string(),
    // Previous drafts for this same field, sent back in on a "Replace" click so the model writes
    // something different rather than a near-duplicate.
    avoidTexts: z.array(z.string()),
  }),
});

const variantSchema = z.strictObject({ angle: z.string(), text: z.string() });

export const draftFieldAnswerResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), variants: z.array(variantSchema) }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);

export type DraftFieldAnswerResult = z.infer<typeof draftFieldAnswerResultSchema>;

export const replaceFieldAnswerRequestSchema = z.strictObject({
  type: z.literal("replace-field-answer"),
  payload: z.strictObject({ fieldId: z.string() }),
});

export const replaceFieldAnswerResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), canRevert: z.boolean() }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);

/**
 * Steps a field drafted by Jobsmith back to the variant it held before the last "Replace" click --
 * one step per click, back through this field's own history (separate from the page-wide "Undo"
 * button, which reverts every field Jobsmith touched this fill back to what was on the page before
 * it ran at all).
 */
export const revertFieldAnswerRequestSchema = z.strictObject({
  type: z.literal("revert-field-answer"),
  payload: z.strictObject({ fieldId: z.string() }),
});

export const revertFieldAnswerResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), canRevert: z.boolean() }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);
