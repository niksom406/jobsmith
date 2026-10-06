import { z } from "zod";

export const testConnectionRequestSchema = z.strictObject({
  type: z.literal("test-connection"),
  requestId: z.string().min(1),
  payload: z.strictObject({
    apiKey: z.string(),
    model: z.string(),
  }),
});

export const testConnectionResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), model: z.string() }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);

export type TestConnectionRequest = z.infer<typeof testConnectionRequestSchema>;
export type TestConnectionResponse = z.infer<typeof testConnectionResultSchema>;
