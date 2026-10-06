import { z } from "zod";

export const DOCUMENT_VERSION = 1;

export const documentMetaSchema = z.strictObject({
  id: z.string().min(1),
  schemaVersion: z.literal(DOCUMENT_VERSION),
  kind: z.enum(["cv", "cover_letter"]),
  fileName: z.string(),
  mimeType: z.string(),
  parsedText: z.string(),
  createdAt: z.string(),
});

export const documentExportSchema = documentMetaSchema.extend({
  dataBase64: z.string(),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;
export type DocumentRecord = DocumentMeta & { blob: Blob };
export type DocumentExport = z.infer<typeof documentExportSchema>;
