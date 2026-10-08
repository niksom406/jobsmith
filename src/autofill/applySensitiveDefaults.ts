import type { SensitiveDefaults } from "../schemas/sensitiveDefaults";
import { dispatchChangeEvents, setCheckbox, setRadioGroup, setSelectValue, setTextValue, isEmpty } from "./setValue";
import { setDateInputValue, toIsoDateString } from "./dateFormat";
import { detectSensitiveCategory, findPreferNotToSayOption } from "./sensitiveFields";
import { resolveDropdownOption } from "./resolveOption";
import type { DetectedField, FieldMatch } from "./types";
import type { FillOutcome, UndoEntry } from "./fill";

export interface SensitiveSplit {
  /** Field ids that must be excluded from the normal value-based fill, whatever their category's mode is. */
  excludedFieldIds: Set<string>;
  outcomes: FillOutcome[];
  undo: UndoEntry[];
}

/**
 * Applies each sensitive category's saved default and returns the fields that must not go through
 * the normal profile-value fill path, so a sensitive value is never matched or filled like any other field.
 */
export function applySensitiveDefaults(fields: DetectedField[], defaults: SensitiveDefaults): SensitiveSplit {
  const excludedFieldIds = new Set<string>();
  const outcomes: FillOutcome[] = [];
  const undo: UndoEntry[] = [];

  for (const field of fields) {
    const category = detectSensitiveCategory(field);
    if (!category) continue;
    excludedFieldIds.add(field.id);

    const choice = defaults.categories[category];
    if (choice.mode === "ask_every_time") {
      outcomes.push({ fieldId: field.id, status: "skipped_sensitive" });
      continue;
    }

    if (!isEmpty(field.element)) {
      outcomes.push({ fieldId: field.id, status: "skipped_not_empty" });
      continue;
    }

    if (choice.mode === "prefer_not_to_say") {
      const optionValue = findPreferNotToSayOption(field);
      if (!optionValue) {
        outcomes.push({ fieldId: field.id, status: "skipped_sensitive" });
        continue;
      }
      if (field.kind === "select") {
        undo.push({ element: field.element, kind: "select", previousValue: (field.element as HTMLSelectElement).value });
        setSelectValue(field.element as HTMLSelectElement, optionValue);
      } else if (field.kind === "radio" && field.groupElements) {
        const groupElements = field.groupElements;
        const firstGroupElement = groupElements[0];
        if (!firstGroupElement) {
          outcomes.push({ fieldId: field.id, status: "skipped_sensitive" });
          continue;
        }
        undo.push({
          element: firstGroupElement,
          kind: "radio",
          previousValue: "",
          groupElements,
          previousGroupChecked: groupElements.map((element) => (element as HTMLInputElement).checked),
        });
        setRadioGroup(groupElements as HTMLInputElement[], optionValue);
      }
      outcomes.push({ fieldId: field.id, status: "filled" });
      continue;
    }

    // use_saved_answer
    const value = choice.savedValue;
    if (!value) {
      outcomes.push({ fieldId: field.id, status: "skipped_no_value" });
      continue;
    }
    if (field.kind === "select") {
      // Same exact -> alias -> word-boundary-partial -> numeric-range cascade as every other
      // dropdown fill, instead of requiring the saved value to exactly equal an option's label.
      // That strict-equality version is why "Indian" never matched "Asian or Asian British -
      // Indian", or why a saved age of "25" never matched an "Age group" select offering "25-34".
      const matched = resolveDropdownOption(value, field.options);
      if (matched.option) {
        undo.push({ element: field.element, kind: "select", previousValue: (field.element as HTMLSelectElement).value });
        setSelectValue(field.element as HTMLSelectElement, matched.option.value);
        outcomes.push({ fieldId: field.id, status: "filled" });
      } else {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
      }
    } else if (field.kind === "radio" && field.groupElements) {
      const matched = resolveDropdownOption(value, field.options);
      const groupElements = field.groupElements;
      const firstGroupElement = groupElements[0];
      if (matched.option && firstGroupElement) {
        undo.push({
          element: firstGroupElement,
          kind: "radio",
          previousValue: "",
          groupElements,
          previousGroupChecked: groupElements.map((element) => (element as HTMLInputElement).checked),
        });
        setRadioGroup(groupElements as HTMLInputElement[], matched.option.value);
        outcomes.push({ fieldId: field.id, status: "filled" });
      } else {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
      }
    } else if (field.kind === "checkbox") {
      undo.push({ element: field.element, kind: "checkbox", previousValue: "", previousChecked: (field.element as HTMLInputElement).checked });
      setCheckbox(field.element as HTMLInputElement, /^(yes|true|1)$/i.test(value));
      outcomes.push({ fieldId: field.id, status: "filled" });
    } else if (field.kind === "date") {
      // A date of birth (or any other sensitive date) saved as free text -- e.g. "15/03/1990" --
      // needs converting to YYYY-MM-DD, or the native date input silently stays empty.
      const element = field.element as HTMLInputElement;
      const iso = toIsoDateString(value);
      if (!iso) {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
        continue;
      }
      undo.push({ element, kind: "text", previousValue: element.value });
      const accepted = setDateInputValue(element, iso);
      if (!accepted) {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence" });
        continue;
      }
      dispatchChangeEvents(element);
      outcomes.push({ fieldId: field.id, status: "filled" });
    } else {
      const element = field.element as HTMLInputElement | HTMLTextAreaElement;
      undo.push({ element, kind: "text", previousValue: element.value });
      setTextValue(element, value);
      outcomes.push({ fieldId: field.id, status: "filled" });
    }
  }

  return { excludedFieldIds, outcomes, undo };
}

export function removeSensitiveMatches(matches: FieldMatch[], excludedFieldIds: Set<string>): FieldMatch[] {
  return matches.filter((match) => !excludedFieldIds.has(match.fieldId));
}
