export interface ExtractedJd {
  text: string;
  source: "json-ld" | "heuristic" | "none";
}

function textFromJsonLd(doc: ParentNode): string | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent ?? "null") as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && typeof item === "object" && (item as { "@type"?: string })["@type"] === "JobPosting") {
          const description = (item as { description?: string }).description;
          if (description) return description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
      }
    } catch {
      // Not valid JSON-LD; keep looking.
    }
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
  const jsonLd = textFromJsonLd(doc);
  if (jsonLd) return { text: jsonLd, source: "json-ld" };

  const heuristic = textFromMainContent(doc);
  if (heuristic) return { text: heuristic, source: "heuristic" };

  return { text: "", source: "none" };
}
