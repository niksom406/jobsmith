import { z } from "zod";
import { callLlmJson } from "../llm/client";
import { db } from "../storage/db";

const briefSchema = z.strictObject({ brief: z.string() });

async function fetchAboutPageText(domain: string, fetchImpl: typeof fetch): Promise<string | null> {
  for (const path of ["/about", "/about-us", "/company"]) {
    try {
      const response = await fetchImpl(`https://${domain}${path}`);
      if (!response.ok) continue;
      const html = await response.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 200) return text.slice(0, 4000);
    } catch {
      // Try the next path.
    }
  }
  return null;
}

export interface CompanyBriefResult {
  brief: string;
  source: "cache" | "web_search" | "about_page" | "user" | "none";
}

/**
 * Checks the cache by domain first. If missing, tries an OpenAI web-search-backed summary, then the
 * company's About page, and otherwise reports "none" so the caller can ask the user for a few lines.
 */
export async function getCompanyBrief(options: {
  domain: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): Promise<CompanyBriefResult> {
  const cached = await db.companyCache.get(options.domain);
  if (cached) return { brief: cached.brief, source: "cache" };

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const result = await callLlmJson({
      apiKey: options.apiKey,
      model: options.model,
      system:
        "Use the web_search tool to look up the company at the given domain before answering. Search for its own site, " +
        "news, or a reputable profile (e.g. Crunchbase, LinkedIn) — do not rely on what you already know, since that can be " +
        "outdated or wrong. Then write a short, factual, three-sentence brief: what the company does, who it serves, and " +
        "one notable fact from what you found. If the search turns up nothing reliable about this specific company, say so " +
        "plainly instead of guessing.",
      user: `Company domain: ${options.domain}`,
      schema: briefSchema,
      schemaName: "company_brief",
      fetchImpl,
      maxOutputTokens: 800,
      tools: [{ type: "web_search" }],
    });
    if (result.data.brief && !/not confident|cannot find|unable to|nothing reliable/i.test(result.data.brief)) {
      await db.companyCache.put({ schemaVersion: 1, domain: options.domain, brief: result.data.brief, source: "web_search", fetchedAt: new Date().toISOString() });
      return { brief: result.data.brief, source: "web_search" };
    }
  } catch {
    // Some models don't support the web_search tool, or the request failed outright either way.
    // Fall through to the About page fetch, which doesn't need it.
  }

  const aboutText = await fetchAboutPageText(options.domain, fetchImpl);
  if (aboutText) {
    await db.companyCache.put({ schemaVersion: 1, domain: options.domain, brief: aboutText, source: "about_page", fetchedAt: new Date().toISOString() });
    return { brief: aboutText, source: "about_page" };
  }

  return { brief: "", source: "none" };
}

export async function saveUserProvidedBrief(domain: string, brief: string): Promise<void> {
  await db.companyCache.put({ schemaVersion: 1, domain, brief, source: "user", fetchedAt: new Date().toISOString() });
}
