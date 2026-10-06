import { z } from "zod";

export const COMPANY_CACHE_VERSION = 1;

export const companyCacheSchema = z.strictObject({
  schemaVersion: z.literal(COMPANY_CACHE_VERSION),
  domain: z.string().min(1),
  brief: z.string(),
  source: z.enum(["user", "web_search", "about_page"]),
  fetchedAt: z.string(),
});

export type CompanyCacheEntry = z.infer<typeof companyCacheSchema>;
