import { z } from "zod";
import { callLlmJson } from "../llm/client";
import { isAtsVendorHostname } from "../sites/access";
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
 * Checks the cache first. If missing, tries an OpenAI web-search-backed summary, then the
 * company's About page, and otherwise reports "none" so the caller can ask the user for a few lines.
 *
 * `domain` is ignored when it's an ATS vendor's own hosting domain (e.g. jobs.ashbyhq.com,
 * boards.greenhouge.io) — that domain describes the ATS platform, not the company actually
 * hiring through it, and using it produces a brief about Ashby/Greenhouse/etc instead of the
 * employer. `companyName` (extracted from the page's JSON-LD or title) is used instead whenever
 * the domain isn't usable.
 */
export async function getCompanyBrief(options: {
  domain: string;
  companyName?: string | null;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): Promise<CompanyBriefResult> {
  const effectiveDomain = options.domain && !isAtsVendorHostname(options.domain) ? options.domain : "";
  const companyName = options.companyName?.trim() || "";
  const cacheKey = effectiveDomain || (companyName ? `name:${companyName.toLowerCase()}` : "");
  if (!cacheKey) return { brief: "", source: "none" };

  const cached = await db.companyCache.get(cacheKey);
  if (cached) return { brief: cached.brief, source: "cache" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const subjectLine = effectiveDomain ? `Company domain: ${effectiveDomain}` : `Company name: ${companyName}`;

  try {
    const result = await callLlmJson({
      apiKey: options.apiKey,
      model: options.model,
      system:
        "Use the web_search tool to look up the company named or at the domain given before answering. Search for its own " +
        "site, news, or a reputable profile (e.g. Crunchbase, LinkedIn) — do not rely on what you already know, since that " +
        "can be outdated or wrong. Then write a short, factual, three-sentence brief about that specific company: what it " +
        "does, who it serves, and one notable fact from what you found. If the search turns up nothing reliable about this " +
        "specific company, say so plainly instead of guessing.",
      user: subjectLine,
      schema: briefSchema,
      schemaName: "company_brief",
      fetchImpl,
      maxOutputTokens: 800,
      tools: [{ type: "web_search" }],
    });
    if (result.data.brief && !/not confident|cannot find|unable to|nothing reliable/i.test(result.data.brief)) {
      await db.companyCache.put({ schemaVersion: 1, domain: cacheKey, brief: result.data.brief, source: "web_search", fetchedAt: new Date().toISOString() });
      return { brief: result.data.brief, source: "web_search" };
    }
  } catch {
    // Some models don't support the web_search tool, or the request failed outright either way.
    // Fall through to the About page fetch, which doesn't need it.
  }

  if (effectiveDomain) {
    const aboutText = await fetchAboutPageText(effectiveDomain, fetchImpl);
    if (aboutText) {
      await db.companyCache.put({ schemaVersion: 1, domain: cacheKey, brief: aboutText, source: "about_page", fetchedAt: new Date().toISOString() });
      return { brief: aboutText, source: "about_page" };
    }
  }

  return { brief: "", source: "none" };
}

export async function saveUserProvidedBrief(domain: string, brief: string): Promise<void> {
  await db.companyCache.put({ schemaVersion: 1, domain, brief, source: "user", fetchedAt: new Date().toISOString() });
}
