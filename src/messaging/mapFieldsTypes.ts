import { z } from "zod";

const fieldForMappingSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  options: z.array(z.string()),
});

export const mapFieldsRequestSchema = z.strictObject({
  type: z.literal("map-fields"),
  payload: z.strictObject({
    fields: z.array(fieldForMappingSchema),
    profileKeys: z.array(z.string()),
  }),
});

export type MapFieldsRequest = z.infer<typeof mapFieldsRequestSchema>;

const fieldMappingSchema = z.strictObject({
  fieldId: z.string(),
  profileKey: z.string(),
  confident: z.boolean(),
});

export const mapFieldsResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), mappings: z.array(fieldMappingSchema) }),
  z.strictObject({ ok: z.literal(false), error: z.string() }),
]);

export type MapFieldsResult = z.infer<typeof mapFieldsResultSchema>;
