/** Finds the browser's own value setter so React/Angular/Vue see the change, not just the DOM attribute. */
function nativeSetter(element: HTMLElement): ((value: string) => void) | null {
  if (element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  if (element instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  if (element instanceof HTMLSelectElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  return null;
}

export function dispatchChangeEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

/** Marks an element as having just been set by Jobsmith itself, for the duration of this
 * synchronous call stack only -- so a listener reacting to the `change` event this triggers (e.g.
 * the "want to remember this answer?" prompt on a manually-answered radio/select) can tell a real
 * user click apart from Jobsmith's own fill, without that marker lingering and wrongly suppressing
 * the prompt the next time the user actually does change the field by hand. */
const programmaticElements = new WeakSet<HTMLElement>();

function markProgrammatic(element: HTMLElement): void {
  programmaticElements.add(element);
  queueMicrotask(() => programmaticElements.delete(element));
}

export function wasSetByJobsmith(element: HTMLElement): boolean {
  return programmaticElements.has(element);
}

/** True if the field already has a value — Jobsmith only fills empty fields. */
export function isEmpty(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return !element.checked;
    return element.value.trim() === "";
  }
  if (element instanceof HTMLTextAreaElement) return element.value.trim() === "";
  if (element instanceof HTMLSelectElement) return element.value.trim() === "";
  return true;
}

export function setTextValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  markProgrammatic(element);
  const setter = nativeSetter(element);
  if (setter) setter(value);
  else element.value = value;
  dispatchChangeEvents(element);
}

export function setSelectValue(element: HTMLSelectElement, optionValue: string): boolean {
  const option = Array.from(element.options).find((candidate) => candidate.value === optionValue);
  if (!option) return false;
  markProgrammatic(element);
  const setter = nativeSetter(element);
  if (setter) setter(optionValue);
  else element.value = optionValue;
  dispatchChangeEvents(element);
  return true;
}

export function setCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.checked === checked) return;
  markProgrammatic(element);
  element.click();
}

export function setRadioGroup(elements: HTMLInputElement[], value: string): boolean {
  const target = elements.find((element) => element.value === value);
  if (!target) return false;
  if (!target.checked) {
    markProgrammatic(target);
    target.click();
  }
  return true;
}

export async function attachFileToInput(element: HTMLInputElement, file: File): Promise<void> {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  element.files = transfer.files;
  dispatchChangeEvents(element);
}
