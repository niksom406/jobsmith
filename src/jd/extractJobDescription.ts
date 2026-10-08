import { isAtsVendorName } from "../sites/access";

export interface ExtractedJd {
  text: string;
  source: "json-ld" | "heuristic" | "none";
  /** The actual employer's name, not the ATS vendor hosting the page -- best effort, null if
   * nothing reliable was found. Used so a company-brief lookup searches for the right company. */
  companyName: string | null;
}

function jobPostingsFromJsonLd(doc: ParentNode): Record<string, unknown>[] {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const postings: Record<string, unknown>[] = [];
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent ?? "null") as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && typeof item === "object" && (item as { "@type"?: string })["@type"] === "JobPosting") {
          postings.push(item as Record<string, unknown>);
        }
      }
    } catch {
      // Not valid JSON-LD; keep looking.
    }
  }
  return postings;
}

function textFromJsonLd(doc: ParentNode): string | null {
  for (const posting of jobPostingsFromJsonLd(doc)) {
    const description = posting.description;
    if (typeof description === "string" && description) {
      return description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

/** Best-effort employer name: JSON-LD's hiringOrganization first, then common "<Role> at
 * <Company>" / og:site_name page-title patterns. Never returns the ATS vendor's own name --
 * a smaller employer's unbranded Ashby/Greenhouse/etc board sometimes leaves those exact
 * fields as literally "Ashby" or "Greenhouse", which would otherwise leak straight through. */
export function extractCompanyName(doc: ParentNode = document): string | null {
  const reject = (name: string | null): string | null => (name && !isAtsVendorName(name) ? name : null);

  for (const posting of jobPostingsFromJsonLd(doc)) {
    const org = posting.hiringOrganization;
    if (org && typeof org === "object" && typeof (org as { name?: unknown }).name === "string") {
      const name = reject((org as { name: string }).name.trim());
      if (name) return name;
    }
  }

  if (doc instanceof Document) {
    const siteName = reject(doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ?? null);
    if (siteName) return siteName;

    const title = doc.title || "";
    const atMatch = /\bat\s+(.+?)(?:\s*[-|].*)?$/i.exec(title);
    const fromTitle = reject(atMatch?.[1]?.trim() ?? null);
    if (fromTitle) return fromTitle;
  }

  return null;
}

function textFromMainContent(doc: ParentNode): string | null {
  const candidates = doc.querySelectorAll<HTMLElement>("main, article, [class*='job'], [class*='posting'], [class*='description']");
  let best: HTMLElement | null = null;
  let bestLength = 0;
  for (const candidate of Array.from(candidates)) {
    const length = candidate.textContent?.trim().length ?? 0;
    if (length > bestLength) {
      best = candidate;
      bestLength = length;
    }
  }
  if (best && bestLength > 200) return best.textContent?.replace(/\s+/g, " ").trim() ?? null;
  return null;
}

/** Tries JSON-LD JobPosting first, then the largest job-like content block. Never guesses with no signal. */
export function extractJobDescription(doc: ParentNode = document): ExtractedJd {
  const companyName = extractCompanyName(doc);

  const jsonLd = textFromJsonLd(doc);
  if (jsonLd) return { text: jsonLd, source: "json-ld", companyName };

  const heuristic = textFromMainContent(doc);
  if (heuristic) return { text: heuristic, source: "heuristic", companyName };

  return { text: "", source: "none", companyName };
}
