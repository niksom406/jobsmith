import { matchDropdownOption, type DropdownMatchResult } from "./dropdownMatch";
import { matchNumericRangeOption } from "./rangeMatch";
import type { DetectedOption } from "./types";

/**
 * Resolves a saved value against a select/radio field's options: the standard exact -> alias ->
 * word-boundary-partial cascade first, then (only if that found nothing) a numeric range/bucket
 * fallback -- e.g. a saved age of "29" against an "Age group" select offering "25-34", or a saved
 * salary of "50000" against "£40,000 - £50,000". Used everywhere a select/radio gets filled from a
 * saved value, so every layer (profile fields, sensitive saved defaults) resolves options the same,
 * conservative, never-guess-on-a-weak-match way.
 */
export function resolveDropdownOption(value: string, options: DetectedOption[]): DropdownMatchResult {
  const direct = matchDropdownOption(value, options);
  if (direct.option) return direct;
  return matchNumericRangeOption(value, options);
}
