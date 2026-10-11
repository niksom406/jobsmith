import { z } from "zod";

const agentFieldInputSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["radio", "select", "text", "combobox"]),
  options: z.array(z.string()),
});

export const agentFillRequestSchema = z.strictObject({
  type: z.literal("agent-fill-fields"),
  payload: z.strictObject({
    fields: z.array(agentFieldInputSchema),
    profileSummary: z.string(),
  }),
});

export type AgentFillRequest = z.infer<typeof agentFillRequestSchema>;

const agentAnswerSchema = z.strictObject({
  fieldId: z.string(),
  value: z.string(),
  confident: z.boolean(),
  reason: z.string(),
});

export const agentFillResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    answers: z.array(agentAnswerSchema),
  }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);

export type AgentFillResult = z.infer<typeof agentFillResultSchema>;
