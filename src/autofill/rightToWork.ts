import type { Preferences } from "../schemas/preferences";
import { resolveDropdownOption } from "./resolveOption";
import { isEmpty, setRadioGroup, setSelectValue } from "./setValue";
import type { DetectedField } from "./types";
import type { FillOutcome, UndoEntry } from "./fill";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Countries recognised in a "right to work in <country>?" question, mapped to the aliases that
 * can appear either in the question's own wording or in the country name the user typed into
 * Preferences. Deliberately narrow: an unrecognised country name is left for the user rather than
 * guessed at, same as everywhere else in Jobsmith. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  "united kingdom": ["uk", "u k", "great britain", "britain", "england", "scotland", "wales"],
  "united states": ["us", "u s", "usa", "u s a", "united states of america", "america"],
  ireland: ["eire", "republic of ireland"],
  canada: [],
  australia: [],
  "new zealand": ["nz"],
  "european union": ["eu", "e u"],
};

function canonicalCountry(name: string): string | null {
  const normalized = normalize(name);
  if (!normalized) return null;
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (canonical === normalized || aliases.includes(normalized)) return canonical;
  }
  return null;
}

/** Pulls the country out of a "Do you have the right to work in the UK?" style question. Returns
 * null (don't guess) when no specific, recognised country is named -- e.g. a generic "right to
 * work in this country?" phrasing gives Jobsmith nothing reliable to check the saved list against. */
function countryFromLabel(label: string): string | null {
  const match = /right to work in(?: the)?\s+([a-z][a-z .]*?)[?.,]?\s*$/i.exec(label);
  if (!match?.[1]) return null;
  return canonicalCountry(match[1]);
}

/**
 * Answers a "do you have the right to work in <country>?" yes/no question from the explicit
 * country list the user curated in Preferences -> Right to work. Never guesses: returns null when
 * that list is empty (nothing to go on yet) or when the question doesn't name a country Jobsmith
 * recognises. A non-empty list with no entry for the named country answers "No" -- the list is the
 * user's own explicit statement of every country they can legally work in, so a country missing
 * from it is a real "no", not a guess.
 */
export function matchRightToWorkAnswer(label: string, rightToWork: Preferences["rightToWork"]): "Yes" | "No" | null {
  if (rightToWork.length === 0) return null;
  const country = countryFromLabel(label);
  if (!country) return null;
  const hasIt = rightToWork.some((entry) => canonicalCountry(entry.country) === country);
  return hasIt ? "Yes" : "No";
}

export interface RightToWorkResult {
  /** Field ids this pass decided it owned (whether or not it could actually answer them), so later
   * layers (heuristics, LLM mapping) don't also spend effort on the same field. */
  excludedFieldIds: Set<string>;
  outcomes: FillOutcome[];
  undo: UndoEntry[];
}

/**
 * Fills "right to work in <country>?" style select/radio questions from Preferences -> Right to
 * work -- a question type that flattenProfileValues() can't answer on its own, since the answer
 * depends on which specific country the question names, not a single flat profile value. When
 * `dryRun` is true, computes the same decision but never writes to the DOM.
 */
export function applyRightToWork(fields: DetectedField[], rightToWork: Preferences["rightToWork"], dryRun = false): RightToWorkResult {
  const excludedFieldIds = new Set<string>();
  const outcomes: FillOutcome[] = [];
  const undo: UndoEntry[] = [];

  for (const field of fields) {
    if (field.kind !== "select" && field.kind !== "radio") continue;
    if (!/right to work/i.test(field.label)) continue;
    excludedFieldIds.add(field.id);

    if (!isEmpty(field.element)) {
      outcomes.push({ fieldId: field.id, status: "skipped_not_empty" });
      continue;
    }

    const answer = matchRightToWorkAnswer(field.label, rightToWork);
    if (!answer) {
      outcomes.push({ fieldId: field.id, status: "skipped_no_value" });
      continue;
    }

    const matched = resolveDropdownOption(answer, field.options);
    if (!matched.option) {
      outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
      continue;
    }

    if (!dryRun) {
      if (field.kind === "select") {
        undo.push({ element: field.element, kind: "select", previousValue: (field.element as HTMLSelectElement).value });
        setSelectValue(field.element as HTMLSelectElement, matched.option.value);
      } else {
        const groupElements = field.groupElements;
        const firstGroupElement = groupElements?.[0];
        if (!groupElements || !firstGroupElement) {
          outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
          continue;
        }
        undo.push({
          element: firstGroupElement,
          kind: "radio",
          previousValue: "",
          groupElements,
          previousGroupChecked: groupElements.map((element) => (element as HTMLInputElement).checked),
        });
        setRadioGroup(groupElements as HTMLInputElement[], matched.option.value);
      }
    }
    outcomes.push({ fieldId: field.id, status: "filled", previewValue: matched.option.label });
  }

  return { excludedFieldIds, outcomes, undo };
}
