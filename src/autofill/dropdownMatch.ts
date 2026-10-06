import type { DetectedOption, MatchConfidence } from "./types";

const ALIASES: Record<string, string[]> = {
  yes: ["y", "true", "yes - i require sponsorship", "i will require sponsorship"],
  no: ["n", "false", "no - i do not require sponsorship", "i will not require sponsorship"],
  "united kingdom": ["uk", "gb", "great britain", "england"],
  "united states": ["us", "usa", "united states of america"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export interface DropdownMatchResult {
  option: DetectedOption | null;
  confidence: MatchConfidence;
}

/** Exact match on the stored value, then alias match, then nothing — never guesses on a weak match. */
export function matchDropdownOption(storedValue: string, options: DetectedOption[]): DropdownMatchResult {
  const target = normalize(storedValue);
  if (!target) return { option: null, confidence: "low" };

  const exact = options.find((option) => normalize(option.label) === target || normalize(option.value) === target);
  if (exact) return { option: exact, confidence: "exact" };

  const aliasGroup = Object.entries(ALIASES).find(
    ([canonical, aliases]) => normalize(canonical) === target || aliases.some((alias) => normalize(alias) === target),
  );
  if (aliasGroup) {
    const [canonical, aliases] = aliasGroup;
    const candidates = [canonical, ...aliases].map(normalize);
    const match = options.find((option) => candidates.includes(normalize(option.label)) || candidates.includes(normalize(option.value)));
    if (match) return { option: match, confidence: "alias" };
  }

  const partial = options.find((option) => normalize(option.label).includes(target) || target.includes(normalize(option.label)));
  if (partial) return { option: partial, confidence: "alias" };

  return { option: null, confidence: "low" };
}
