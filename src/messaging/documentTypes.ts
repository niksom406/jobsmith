import { z } from "zod";

/**
 * Fetches the stored CV so the content script can attach it to a file input.
 *
 * The content script never touches Dexie directly (only the background service worker does) —
 * partly for architectural separation, and partly because Dexie's bundled IndexedDB range helpers
 * embed the Unicode noncharacter U+FFFF as a "maximum string" sentinel, which Chrome's content-script
 * loader rejects outright ("isn't UTF-8 encoded") if it ends up inside a content script bundle.
 */
export const getCvFileRequestSchema = z.strictObject({ type: z.literal("get-cv-file") });

export const getCvFileResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    fileName: z.string(),
    mimeType: z.string(),
    data: z.instanceof(ArrayBuffer),
  }),
  z.strictObject({ ok: z.literal(false) }),
]);

export type GetCvFileResult = z.infer<typeof getCvFileResultSchema>;
