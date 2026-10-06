import { matchDropdownOption } from "./dropdownMatch";
import { matchLabelToProfileKey } from "./heuristics";
import { isSensitiveLabel } from "./sensitiveFields";
import { dispatchChangeEvents, isEmpty, setTextValue } from "./setValue";
import type { ProfileValueMap } from "./types";

export interface WidgetOutcome {
  label: string;
  status: "filled" | "skipped_not_empty" | "skipped_no_match" | "skipped_no_options" | "skipped_sensitive";
}

/**
 * Fills ARIA combobox widgets (`role="combobox"` / `aria-haspopup="listbox"`), the pattern Workday and
 * several other ATS platforms use instead of a native `<select>`. This has not been verified against a
 * live Workday posting — see ARCHITECTURE.md §11 — and, like the native dropdown matcher, only fills on
 * a confident label-and-option match and never guesses. Sensitive-category widgets (by label text) are
 * skipped entirely and never opened or inspected for options.
 */
export async function fillAriaComboboxes(root: Document, values: ProfileValueMap): Promise<WidgetOutcome[]> {
  const triggers = Array.from(root.querySelectorAll<HTMLElement>("[role='combobox'], button[aria-haspopup='listbox']"));
  const outcomes: WidgetOutcome[] = [];

  for (const trigger of triggers) {
    const label = labelForWidget(trigger);

    if (isSensitiveLabel(label)) {
      outcomes.push({ label, status: "skipped_sensitive" });
      continue;
    }
    if (!isComboboxEmpty(trigger)) {
      outcomes.push({ label, status: "skipped_not_empty" });
      continue;
    }
    const profileKey = matchLabelToProfileKey(label);
    const value = profileKey ? values[profileKey] : "";
    if (!value) {
      outcomes.push({ label, status: "skipped_no_match" });
      continue;
    }

    trigger.click();
    const listbox = await waitForListbox(trigger);
    if (!listbox) {
      outcomes.push({ label, status: "skipped_no_options" });
      continue;
    }

    const optionElements = Array.from(listbox.querySelectorAll<HTMLElement>("[role='option']"));
    const options = optionElements.map((element, index) => ({ value: String(index), label: element.textContent?.trim() ?? "" }));
    const matched = matchDropdownOption(value, options);
    if (!matched.option || matched.confidence === "low") {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      outcomes.push({ label, status: "skipped_no_match" });
      continue;
    }

    const target = optionElements[Number(matched.option.value)];
    target?.click();
    dispatchChangeEvents(trigger);
    outcomes.push({ label, status: "filled" });
  }

  return outcomes;
}

function labelForWidget(trigger: HTMLElement): string {
  const ariaLabel = trigger.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = trigger.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => trigger.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }

  const container = trigger.closest("[role='group'], fieldset, div");
  const legend = container?.querySelector("label, legend");
  return legend?.textContent?.trim() ?? "";
}

/** Treats a combobox's own placeholder text ("Select One", empty) as empty, anything else as already filled. */
function isComboboxEmpty(trigger: HTMLElement): boolean {
  const text = trigger.textContent?.trim() ?? "";
  return text.length === 0 || /^select( one)?\.?$/i.test(text);
}

async function waitForListbox(trigger: HTMLElement, timeoutMs = 1500): Promise<HTMLElement | null> {
  const controlsId = trigger.getAttribute("aria-controls");
  const existing = controlsId ? trigger.ownerDocument.getElementById(controlsId) : null;
  if (existing) return existing;

  const doc = trigger.ownerDocument;
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const listbox = doc.querySelector<HTMLElement>("[role='listbox']");
      if (listbox) {
        observer.disconnect();
        resolve(listbox);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(doc.querySelector<HTMLElement>("[role='listbox']"));
    }, timeoutMs);
  });
}

function parseIsoDate(value: string): { month: string; day: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const year = match?.[1];
  const month = match?.[2];
  const day = match?.[3];
  if (!year || !month || !day) return null;
  return { month, day, year };
}

/**
 * Fills Workday's three-input Month/Day/Year date-of-X groups. Only fills a group whose label maps to a
 * known, non-sensitive date (currently just "earliest start date") — a group that looks like Date of
 * birth, or any other label that doesn't map confidently, is left alone rather than guessed at, because
 * filling the wrong one of several date groups on a page would be worse than leaving it blank.
 */
export function fillWorkdayDateGroups(root: Document, values: ProfileValueMap): WidgetOutcome[] {
  const outcomes: WidgetOutcome[] = [];
  const monthInputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[aria-label='Month' i]"));

  for (const monthInput of monthInputs) {
    const container = monthInput.closest("fieldset, [role='group'], div") ?? monthInput.parentElement;
    const dayInput = container?.querySelector<HTMLInputElement>("input[aria-label='Day' i]") ?? null;
    const yearInput = container?.querySelector<HTMLInputElement>("input[aria-label='Year' i]") ?? null;
    const label = container?.querySelector("legend, label")?.textContent?.trim() || "Date";

    if (isSensitiveLabel(label)) {
      outcomes.push({ label, status: "skipped_sensitive" });
      continue;
    }
    if (!dayInput || !yearInput) {
      outcomes.push({ label, status: "skipped_no_options" });
      continue;
    }
    if (!isEmpty(monthInput) || !isEmpty(dayInput) || !isEmpty(yearInput)) {
      outcomes.push({ label, status: "skipped_not_empty" });
      continue;
    }

    const profileKey = matchLabelToProfileKey(label);
    if (profileKey !== "preferences.startDate") {
      outcomes.push({ label, status: "skipped_no_match" });
      continue;
    }
    const parsed = parseIsoDate(values[profileKey] ?? "");
    if (!parsed) {
      outcomes.push({ label, status: "skipped_no_match" });
      continue;
    }

    setTextValue(monthInput, parsed.month);
    setTextValue(dayInput, parsed.day);
    setTextValue(yearInput, parsed.year);
    outcomes.push({ label, status: "filled" });
  }

  return outcomes;
}
