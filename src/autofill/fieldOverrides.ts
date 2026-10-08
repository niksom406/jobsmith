import type { FieldMatch, DetectedField } from "./types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** A field's identity across visits to the same site: its question text and kind. Not its DOM id
 * or name, both of which can be auto-generated/random on some sites and change on reload. */
export function fieldSignature(field: DetectedField): string {
  return `${field.kind}:${normalize(field.label || field.name)}`;
}

export function overrideKey(hostname: string, field: DetectedField): string {
  return `${hostname.toLowerCase()}::${fieldSignature(field)}`;
}

/**
 * Turns saved per-site field overrides into exact-confidence matches, so a field you've manually
 * mapped once (e.g. "on this site, 'Current CTC' means my salary expectation") fills the same way
 * every time you come back -- through the exact same `fillFields` path and confidence rules as
 * every other match, just skipping the heuristic/LLM guesswork this time.
 */
export function matchesFromOverrides(
  fields: DetectedField[],
  overrides: Record<string, string>,
  hostname: string,
): { matches: FieldMatch[]; excludedFieldIds: Set<string> } {
  const matches: FieldMatch[] = [];
  const excludedFieldIds = new Set<string>();
  for (const field of fields) {
    const profileKey = overrides[overrideKey(hostname, field)];
    if (!profileKey) continue;
    matches.push({ fieldId: field.id, profileKey, confidence: "exact" });
    excludedFieldIds.add(field.id);
  }
  return { matches, excludedFieldIds };
}
