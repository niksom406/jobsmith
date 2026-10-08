import { matchFieldsHeuristically } from "./heuristics";
import { resolveDropdownOption } from "./resolveOption";
import { dispatchChangeEvents, isEmpty, setCheckbox, setRadioGroup, setSelectValue, setTextValue } from "./setValue";
import { setDateInputValue, toIsoDateString } from "./dateFormat";
import type { DetectedField, FieldMatch, ProfileValueMap } from "./types";

export interface FillOutcome {
  fieldId: string;
  status: "filled" | "skipped_not_empty" | "skipped_no_value" | "skipped_low_confidence" | "skipped_sensitive";
  profileKey?: string;
  /** A human-readable preview of the value that was (or, in a dry run, would be) set -- shown in
   * the side panel so "Detect fields" can tell you what Fill would actually do before you run it. */
  previewValue?: string;
}

export interface UndoEntry {
  element: HTMLElement;
  kind: "text" | "select" | "checkbox" | "radio";
  previousValue: string;
  previousChecked?: boolean;
  groupElements?: HTMLElement[];
  previousGroupChecked?: boolean[];
}

export interface FillFieldsOptions {
  /** When true, computes the same matches/values/confidence decisions but never writes to the
   * DOM -- used so "Detect fields" can show an accurate preview without actually filling anything. */
  dryRun?: boolean;
}

/**
 * Fills every match where the field is currently empty and a confident value exists.
 * Returns per-field outcomes and an undo list, in fill order.
 */
export function fillFields(
  fields: DetectedField[],
  matches: FieldMatch[],
  values: ProfileValueMap,
  isSensitiveFieldId: (fieldId: string) => boolean = () => false,
  options: FillFieldsOptions = {},
): { outcomes: FillOutcome[]; undo: UndoEntry[] } {
  const dryRun = options.dryRun ?? false;
  const outcomes: FillOutcome[] = [];
  const undo: UndoEntry[] = [];
  const byId = new Map(fields.map((field) => [field.id, field]));

  for (const match of matches) {
    const field = byId.get(match.fieldId);
    if (!field) continue;

    if (isSensitiveFieldId(field.id)) {
      outcomes.push({ fieldId: field.id, status: "skipped_sensitive", profileKey: match.profileKey });
      continue;
    }

    const value = values[match.profileKey] ?? "";
    if (!value) {
      outcomes.push({ fieldId: field.id, status: "skipped_no_value", profileKey: match.profileKey });
      continue;
    }

    if (!isEmpty(field.element)) {
      outcomes.push({ fieldId: field.id, status: "skipped_not_empty", profileKey: match.profileKey });
      continue;
    }

    if (field.kind === "date") {
      const element = field.element as HTMLInputElement;
      // A native date input silently ignores anything that isn't exactly YYYY-MM-DD -- the
      // stored value (e.g. a start date typed as "15/03/2026") needs converting first, or the
      // field is left empty with no error even though this looked like a successful fill.
      const iso = toIsoDateString(value);
      if (!iso) {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence", profileKey: match.profileKey });
        continue;
      }
      if (dryRun) {
        outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: iso });
        continue;
      }
      undo.push({ element, kind: "text", previousValue: element.value });
      const accepted = setDateInputValue(element, iso);
      if (!accepted) {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence", profileKey: match.profileKey });
        continue;
      }
      dispatchChangeEvents(element);
      outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: iso });
      continue;
    }

    if (field.kind === "text" || field.kind === "textarea") {
      const element = field.element as HTMLInputElement | HTMLTextAreaElement;
      if (dryRun) {
        outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: value });
        continue;
      }
      undo.push({ element, kind: "text", previousValue: element.value });
      setTextValue(element, value);
      outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: value });
      continue;
    }

    if (field.kind === "select") {
      // Falls back to a numeric-range match (e.g. a saved salary of "50000" against an option
      // labeled "£40,000 - £50,000") when there's no exact/alias/partial text match.
      const matched = resolveDropdownOption(value, field.options);
      if (!matched.option || matched.confidence === "low") {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence", profileKey: match.profileKey });
        continue;
      }
      if (dryRun) {
        outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: matched.option.label });
        continue;
      }
      const element = field.element as HTMLSelectElement;
      undo.push({ element, kind: "select", previousValue: element.value });
      setSelectValue(element, matched.option.value);
      outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: matched.option.label });
      continue;
    }

    if (field.kind === "radio" && field.groupElements) {
      const matched = resolveDropdownOption(value, field.options);
      if (!matched.option || matched.confidence === "low") {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence", profileKey: match.profileKey });
        continue;
      }
      const groupElements = field.groupElements;
      const firstGroupElement = groupElements[0];
      if (!firstGroupElement) {
        outcomes.push({ fieldId: field.id, status: "skipped_low_confidence", profileKey: match.profileKey });
        continue;
      }
      if (dryRun) {
        outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: matched.option.label });
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
      outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue: matched.option.label });
      continue;
    }

    if (field.kind === "checkbox") {
      const checked = /^(yes|true|1)$/i.test(value);
      const previewValue = checked ? "Checked" : "Unchecked";
      if (dryRun) {
        outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue });
        continue;
      }
      const element = field.element as HTMLInputElement;
      undo.push({ element, kind: "checkbox", previousValue: "", previousChecked: element.checked });
      setCheckbox(element, checked);
      outcomes.push({ fieldId: field.id, status: "filled", profileKey: match.profileKey, previewValue });
      continue;
    }

    outcomes.push({ fieldId: field.id, status: "skipped_no_value", profileKey: match.profileKey });
  }

  return { outcomes, undo };
}

export function undoFill(entries: UndoEntry[]): void {
  for (const entry of [...entries].reverse()) {
    if (entry.kind === "text") setTextValue(entry.element as HTMLInputElement, entry.previousValue);
    else if (entry.kind === "select") setSelectValue(entry.element as HTMLSelectElement, entry.previousValue);
    else if (entry.kind === "checkbox" && entry.previousChecked !== undefined) {
      setCheckbox(entry.element as HTMLInputElement, entry.previousChecked);
    } else if (entry.kind === "radio" && entry.groupElements && entry.previousGroupChecked) {
      entry.groupElements.forEach((element, index) => {
        const input = element as HTMLInputElement;
        if (input.checked !== entry.previousGroupChecked?.[index]) input.click();
      });
    }
  }
}

export { matchFieldsHeuristically };
