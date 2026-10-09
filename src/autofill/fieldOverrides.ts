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

/** Marks a saved override value as a literal typed answer rather than a reference to a profile key --
 * for a question with no corresponding profile field at all (e.g. "Do you have Fintech experience?",
 * "Are you able to travel to our London office 3 times a week?"), where there's nothing to map to,
 * only an answer to remember. */
const LITERAL_PREFIX = "literal:";

export function literalOverrideValue(savedValue: string): string {
  return `${LITERAL_PREFIX}${savedValue}`;
}

function isLiteralOverride(savedValue: string): boolean {
  return savedValue.startsWith(LITERAL_PREFIX);
}

/**
 * Turns saved per-site field overrides into exact-confidence matches, so a field you've manually
 * mapped once -- either to an existing profile field ("on this site, 'Current CTC' means my salary
 * expectation") or to a literal answer you typed once ("on this site, this question means Yes") --
 * fills the same way every time you come back, through the exact same `fillFields` path and
 * confidence rules as every other match, just skipping the heuristic/LLM guesswork this time.
 * Literal answers get a synthetic per-field profile key fed back in `literalValues`, since
 * `fillFields` always looks a match's value up by profile key.
 */
export function matchesFromOverrides(
  fields: DetectedField[],
  overrides: Record<string, string>,
  hostname: string,
): { matches: FieldMatch[]; excludedFieldIds: Set<string>; literalValues: Record<string, string> } {
  const matches: FieldMatch[] = [];
  const excludedFieldIds = new Set<string>();
  const literalValues: Record<string, string> = {};
  for (const field of fields) {
    const saved = overrides[overrideKey(hostname, field)];
    if (!saved) continue;
    if (isLiteralOverride(saved)) {
      const syntheticKey = `__override__:${field.id}`;
      literalValues[syntheticKey] = saved.slice(LITERAL_PREFIX.length);
      matches.push({ fieldId: field.id, profileKey: syntheticKey, confidence: "exact" });
    } else {
      matches.push({ fieldId: field.id, profileKey: saved, confidence: "exact" });
    }
    excludedFieldIds.add(field.id);
  }
  return { matches, excludedFieldIds, literalValues };
}
