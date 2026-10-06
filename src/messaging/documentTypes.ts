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
    // Base64, not a raw ArrayBuffer: a plain string survives chrome.runtime.sendMessage and Zod's
    // instanceof checks reliably across the background/content-script boundary. Binary types can
    // come back from structured clone tied to a different global's constructors depending on the
    // Chrome version and call shape, which makes `instanceof ArrayBuffer` fail unpredictably.
    dataBase64: z.string(),
  }),
  z.strictObject({ ok: z.literal(false) }),
]);

export type GetCvFileResult = z.infer<typeof getCvFileResultSchema>;
