import type { SensitiveCategoryId } from "../schemas/sensitiveDefaults";
import type { DetectedField } from "./types";

const CATEGORY_PATTERNS: Record<SensitiveCategoryId, RegExp> = {
  gender: /\bgender\b|\bsex\b(?!ual orientation)/i,
  ethnicity: /ethnicit|race\b|racial/i,
  disability: /disabilit/i,
  veteran: /veteran|armed forces/i,
  sexualOrientation: /sexual orientation|lgbt/i,
  religion: /religio|\bfaith\b|\bcreed\b/i,
  dateOfBirth: /date of birth|\bdob\b|\bage\b/i,
};

/** Detects a sensitive category from a field's label or option text. Returns null for an ordinary field. */
export function detectSensitiveCategory(field: DetectedField): SensitiveCategoryId | null {
  const haystacks = [field.label, field.name, ...field.options.map((option) => option.label)].join(" ");
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS) as [SensitiveCategoryId, RegExp][]) {
    if (pattern.test(haystacks)) return category;
  }
  return null;
}

const PREFER_NOT_TO_SAY_PATTERN = /prefer not to say|decline to (state|answer)|rather not say|do not wish to disclose/i;

export function findPreferNotToSayOption(field: DetectedField): string | null {
  const match = field.options.find((option) => PREFER_NOT_TO_SAY_PATTERN.test(option.label));
  return match?.value ?? null;
}
