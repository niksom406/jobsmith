import type { DropdownMatchResult } from "./dropdownMatch";
import type { DetectedOption } from "./types";

/**
 * Extracts the numeric bounds implied by an option's label, e.g. "25-34" -> [25, 34],
 * "£40,000 - £50,000" -> [40000, 50000], "65+" / "Over 65" -> [65, Infinity], "Under 18" -> [-Infinity, 17].
 * Returns null when the label doesn't describe a range at all (plain non-numeric option text).
 */
function parseRange(label: string): [number, number] | null {
  const stripped = label.replace(/[£$€,]/g, "");

  const plusMatch = /(\d+(?:\.\d+)?)\s*\+/.exec(stripped) ?? /(?:over|above|more than)\s*(\d+(?:\.\d+)?)/i.exec(stripped);
  if (plusMatch?.[1]) {
    const n = Number(plusMatch[1]);
    return Number.isFinite(n) ? [n, Infinity] : null;
  }

  const underMatch = /(?:under|below|less than)\s*(\d+(?:\.\d+)?)/i.exec(stripped);
  if (underMatch?.[1]) {
    const n = Number(underMatch[1]);
    return Number.isFinite(n) ? [-Infinity, n - 1] : null;
  }

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to|–|—)\s*(\d+(?:\.\d+)?)/i.exec(stripped);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) return low <= high ? [low, high] : [high, low];
  }

  return null;
}

/**
 * Matches a plain number (an age, or a salary amount) against options whose labels describe a
 * bucket/range rather than the number itself -- e.g. a saved age of "29" against an "Age group"
 * select offering "25-34", or a saved salary of "50000" against "£40,000 - £50,000". Only returns
 * a match when the value falls inside exactly one option's range: never guesses when it's
 * ambiguous (overlapping/malformed ranges put it in more than one bucket) or when nothing matches.
 */
export function matchNumericRangeOption(rawValue: string, options: DetectedOption[]): DropdownMatchResult {
  const value = Number(rawValue.replace(/[^0-9.]/g, ""));
  if (rawValue.trim() === "" || !Number.isFinite(value)) return { option: null, confidence: "low" };

  const matches = options.filter((option) => {
    const range = parseRange(option.label);
    return range !== null && value >= range[0] && value <= range[1];
  });

  const only = matches[0];
  if (matches.length === 1 && only) return { option: only, confidence: "fuzzy" };
  return { option: null, confidence: "low" };
}
